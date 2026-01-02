/**
 * OAuth Service for Social Authentication
 * Handles Google, Facebook, and Apple sign-in
 */

import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Logger from '../utils/logger';
import OAUTH_CONFIG from '../config/oauth';
import { Platform } from 'react-native';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';

// Ensure web browser sessions complete properly
WebBrowser.maybeCompleteAuthSession();

// Google discovery document (for web fallback)
const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

// Get OAuth configuration
const getOAuthConfig = () => {
  const env = __DEV__ ? 'development' : 'production';

  return {
    google: {
      // Web client ID - used for getting idToken on native platforms
      webClientId: OAUTH_CONFIG.google[env],
      scopes: ['openid', 'profile', 'email'],
    },
    facebook: {
      clientId: OAUTH_CONFIG.facebook[env],
      scopes: ['public_profile', 'email'],
    },
    apple: {
      serviceId: OAUTH_CONFIG.apple.serviceId,
      scopes: ['email', 'name'],
    },
  };
};

class OAuthService {
  constructor() {
    this.isNativeGoogleSignIn = Platform.OS !== 'web';
    this.googleSignInConfigured = false;

    // Configure Google Sign-In for native platforms
    if (this.isNativeGoogleSignIn) {
      try {
        const config = getOAuthConfig();
        GoogleSignin.configure({
          webClientId: config.google.webClientId,
          offlineAccess: false,
          scopes: config.google.scopes,
        });
        this.googleSignInConfigured = true;
        Logger.info('✅ Native Google Sign-In configured');
      } catch (error) {
        Logger.error('❌ Failed to configure Google Sign-In:', error);
      }
    }

    // For web platform, set up redirect URI
    if (Platform.OS === 'web') {
      this.redirectUri = AuthSession.makeRedirectUri({ useProxy: false });
      this.useProxy = false;
    }

    Logger.info('📱 Platform:', Platform.OS);
    Logger.info('🔐 Using native Google Sign-In:', this.isNativeGoogleSignIn);
  }

  /**
   * Sign in with Google
   * Uses native Google Sign-In for iOS/Android, falls back to AuthSession for web
   */
  async signInWithGoogle() {
    try {
      Logger.info('🔐 Starting Google sign-in...');
      Logger.info('📱 Platform:', Platform.OS);
      Logger.info('🔐 Using native sign-in:', this.isNativeGoogleSignIn);

      // Use native Google Sign-In for iOS/Android
      if (this.isNativeGoogleSignIn) {
        return await this.nativeGoogleSignIn();
      }

      // Fall back to AuthSession for web
      return await this.webGoogleSignIn();
    } catch (error) {
      Logger.error('❌ Google sign-in error:', error);
      return {
        success: false,
        error: error.message || 'Google sign-in failed',
      };
    }
  }

  /**
   * Native Google Sign-In for iOS/Android
   */
  async nativeGoogleSignIn() {
    try {
      if (!this.googleSignInConfigured) {
        Logger.error('❌ Google Sign-In not configured');
        return {
          success: false,
          error: 'Google Sign-In not configured',
        };
      }

      // Check if user is already signed in
      const isSignedIn = await GoogleSignin.hasPreviousSignIn();
      if (isSignedIn) {
        Logger.info('📱 User was previously signed in, signing out first...');
        await GoogleSignin.signOut();
      }

      // Trigger sign-in flow
      Logger.info('📱 Triggering native Google Sign-In...');
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const userInfo = await GoogleSignin.signIn();

      Logger.info('📱 Got user info:', {
        hasUser: !!userInfo,
        hasIdToken: !!userInfo?.data?.idToken,
        email: userInfo?.data?.user?.email,
      });

      // Get the ID token
      const idToken = userInfo?.data?.idToken;

      if (!idToken) {
        Logger.error('❌ No ID token received from Google Sign-In');
        return {
          success: false,
          error: 'No ID token received from Google',
        };
      }

      Logger.success('✅ Native Google Sign-In successful');
      return {
        success: true,
        provider: 'google',
        idToken: idToken,
        accessToken: null, // Native sign-in gives us idToken, not accessToken
        user: {
          email: userInfo?.data?.user?.email || '',
          name: userInfo?.data?.user?.name || '',
          firstName: userInfo?.data?.user?.givenName || '',
          lastName: userInfo?.data?.user?.familyName || '',
          photo: userInfo?.data?.user?.photo || '',
          emailVerified: true,
          providerId: userInfo?.data?.user?.id || '',
        },
      };
    } catch (error) {
      Logger.error('❌ Native Google sign-in error:', error);
      Logger.error('❌ Error code:', error.code);

      // Handle specific error codes
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        return {
          success: false,
          error: 'User cancelled',
        };
      } else if (error.code === statusCodes.IN_PROGRESS) {
        return {
          success: false,
          error: 'Sign-in already in progress',
        };
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        return {
          success: false,
          error: 'Google Play Services not available',
        };
      }

      return {
        success: false,
        error: error.message || 'Google sign-in failed',
      };
    }
  }

  /**
   * Web-based Google Sign-In using AuthSession (fallback for web platform)
   */
  async webGoogleSignIn() {
    try {
      const config = getOAuthConfig();

      const request = new AuthSession.AuthRequest({
        clientId: config.google.webClientId,
        scopes: config.google.scopes,
        responseType: AuthSession.ResponseType.Token,
        redirectUri: this.redirectUri,
        prompt: AuthSession.Prompt.SelectAccount,
        usePKCE: false,
        extraParams: {
          nonce: Math.random().toString(36).substring(7),
          access_type: 'online',
        },
      });

      Logger.info('📤 Web OAuth Request:', {
        clientId: config.google.webClientId,
        redirectUri: this.redirectUri,
      });

      const result = await request.promptAsync(discovery, {
        useProxy: this.useProxy,
      });

      Logger.info('🔍 OAuth Result:', {
        type: result.type,
        hasParams: !!result.params,
        error: result.error,
      });

      if (result.type === 'success') {
        const { params, authentication } = result;
        const idToken = params?.id_token || authentication?.idToken;
        const accessToken = params?.access_token || authentication?.accessToken;

        if (idToken || accessToken) {
          Logger.success('✅ Got tokens from Google');
          return {
            success: true,
            provider: 'google',
            idToken: idToken || null,
            accessToken: accessToken || null,
            user: {
              email: '',
              name: '',
              firstName: '',
              lastName: '',
              photo: '',
              emailVerified: true,
              providerId: '',
            },
          };
        } else {
          return {
            success: false,
            error: 'No tokens received from Google',
          };
        }
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        return {
          success: false,
          error: 'Sign-in cancelled',
        };
      } else {
        return {
          success: false,
          error: result.error?.message || 'Authentication failed',
        };
      }
    } catch (error) {
      Logger.error('❌ Web Google sign-in error:', error);
      return {
        success: false,
        error: error.message || 'Google sign-in failed',
      };
    }
  }

  /**
   * Fetch Google user info
   */
  async fetchGoogleUserInfo(accessToken) {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user info');
      }

      const userInfo = await response.json();
      Logger.info('📝 Google user info:', userInfo);
      return userInfo;
    } catch (error) {
      Logger.error('❌ Error fetching Google user info:', error);
      throw error;
    }
  }

  /**
   * Sign in with Facebook
   */
  async signInWithFacebook() {
    try {
      Logger.info('🔐 Starting Facebook sign-in...');

      const config = getOAuthConfig();

      // Create auth request
      const request = new AuthSession.AuthRequest({
        clientId: config.facebook.clientId,
        scopes: config.facebook.scopes,
        responseType: AuthSession.ResponseType.Token,
        redirectUri: this.redirectUri,
      });

      // Initiate authentication
      const result = await request.promptAsync({
        useProxy: false,
      });

      if (result.type === 'success') {
        Logger.success('✅ Facebook authentication successful');

        // Get user info from Facebook
        const userInfo = await this.fetchFacebookUserInfo(result.params.access_token);

        // Structure the OAuth response
        return {
          success: true,
          provider: 'facebook',
          accessToken: result.params.access_token,
          user: {
            email: userInfo.email,
            name: userInfo.name,
            firstName: userInfo.first_name,
            lastName: userInfo.last_name,
            photo: userInfo.picture?.data?.url,
            providerId: userInfo.id,
          },
        };
      } else if (result.type === 'cancel') {
        Logger.info('❌ Facebook sign-in cancelled');
        return {
          success: false,
          error: 'Sign-in cancelled',
        };
      } else {
        Logger.error('❌ Facebook sign-in error:', result);
        return {
          success: false,
          error: 'Sign-in failed',
        };
      }
    } catch (error) {
      Logger.error('❌ Facebook sign-in error:', error);
      return {
        success: false,
        error: error.message || 'Facebook sign-in failed',
      };
    }
  }

  /**
   * Fetch Facebook user info
   */
  async fetchFacebookUserInfo(accessToken) {
    try {
      const response = await fetch(
        `https://graph.facebook.com/me?fields=id,name,email,first_name,last_name,picture.type(large)&access_token=${accessToken}`
      );

      if (!response.ok) {
        throw new Error('Failed to fetch user info');
      }

      const userInfo = await response.json();
      Logger.info('📝 Facebook user info:', userInfo);
      return userInfo;
    } catch (error) {
      Logger.error('❌ Error fetching Facebook user info:', error);
      throw error;
    }
  }

  /**
   * Sign in with Apple (iOS only)
   */
  async signInWithApple() {
    try {
      Logger.info('🔐 Starting Apple sign-in...');

      // Note: Apple Sign-In requires additional native setup
      // This is a placeholder for the implementation

      return {
        success: false,
        error: 'Apple sign-in not yet implemented',
      };
    } catch (error) {
      Logger.error('❌ Apple sign-in error:', error);
      return {
        success: false,
        error: error.message || 'Apple sign-in failed',
      };
    }
  }

  /**
   * Process OAuth sign-in result
   * Determines if user needs to complete registration or can proceed to app
   */
  async processOAuthResult(oauthResult, apiClient) {
    try {
      if (!oauthResult.success) {
        return oauthResult;
      }

      Logger.info('🔄 Processing OAuth result...');

      // Check if user exists in our backend
      const checkResponse = await apiClient.checkOAuthUser({
        provider: oauthResult.provider,
        providerId: oauthResult.user.providerId,
        email: oauthResult.user.email,
      });

      if (checkResponse.exists) {
        // User exists - sign them in
        Logger.info('✅ Existing OAuth user - signing in...');

        const loginResponse = await apiClient.oauthLogin({
          provider: oauthResult.provider,
          providerId: oauthResult.user.providerId,
          accessToken: oauthResult.accessToken,
        });

        return {
          success: true,
          action: 'login',
          data: loginResponse.data,
        };
      } else {
        // New user - need to complete registration
        Logger.info('📝 New OAuth user - needs registration...');

        // Store OAuth data temporarily for registration flow
        await this.storeOAuthData(oauthResult);

        return {
          success: true,
          action: 'register',
          oauthData: oauthResult,
        };
      }
    } catch (error) {
      Logger.error('❌ Error processing OAuth result:', error);
      return {
        success: false,
        error: error.message || 'Failed to process sign-in',
      };
    }
  }

  /**
   * Store OAuth data temporarily for registration completion
   */
  async storeOAuthData(oauthData) {
    try {
      await AsyncStorage.setItem('pendingOAuthData', JSON.stringify(oauthData));
      Logger.info('💾 OAuth data stored for registration');
    } catch (error) {
      Logger.error('❌ Error storing OAuth data:', error);
      throw error;
    }
  }

  /**
   * Retrieve stored OAuth data
   */
  async getStoredOAuthData() {
    try {
      const data = await AsyncStorage.getItem('pendingOAuthData');
      return data ? JSON.parse(data) : null;
    } catch (error) {
      Logger.error('❌ Error retrieving OAuth data:', error);
      return null;
    }
  }

  /**
   * Clear stored OAuth data
   */
  async clearStoredOAuthData() {
    try {
      await AsyncStorage.removeItem('pendingOAuthData');
      Logger.info('🗑️ OAuth data cleared');
    } catch (error) {
      Logger.error('❌ Error clearing OAuth data:', error);
    }
  }

  /**
   * Validate OAuth response
   */
  validateOAuthResponse(response) {
    if (!response || !response.user) {
      return {
        valid: false,
        error: 'Invalid OAuth response',
      };
    }

    const { user } = response;

    // Check required fields
    if (!user.email) {
      return {
        valid: false,
        error: 'Email is required for registration',
      };
    }

    if (!user.name && !user.firstName && !user.lastName) {
      return {
        valid: false,
        error: 'Name is required for registration',
      };
    }

    return {
      valid: true,
    };
  }

  /**
   * Extract profile data from OAuth response
   */
  extractProfileData(oauthData) {
    const { user } = oauthData;

    return {
      email: user.email,
      name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      photo: user.photo,
      provider: oauthData.provider,
      providerId: user.providerId,
      emailVerified: user.emailVerified || false,
    };
  }

  /**
   * Check if OAuth is configured
   */
  isConfigured(provider) {
    const config = getOAuthConfig();
    const providerConfig = config[provider];

    if (!providerConfig) return false;

    // Check if client IDs are configured (not placeholder or missing values)
    if (provider === 'google') {
      return (
        providerConfig.clientId &&
        !providerConfig.clientId.includes('YOUR_') &&
        !providerConfig.clientId.includes('MISSING_')
      );
    }
    if (provider === 'facebook') {
      return (
        providerConfig.clientId &&
        !providerConfig.clientId.includes('YOUR_') &&
        !providerConfig.clientId.includes('MISSING_')
      );
    }
    if (provider === 'apple') {
      return (
        providerConfig.serviceId &&
        !providerConfig.serviceId.includes('YOUR_') &&
        !providerConfig.serviceId.includes('MISSING_')
      );
    }

    return false;
  }
}

// Export singleton instance
export default new OAuthService();
