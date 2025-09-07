/**
 * OAuth Service for Social Authentication
 * Handles Google, Facebook, and Apple sign-in
 */

import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import Logger from '../utils/logger';
import OAUTH_CONFIG from '../config/oauth';
import { Platform } from 'react-native';

// Ensure web browser sessions complete properly
WebBrowser.maybeCompleteAuthSession();

// Google discovery document
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
      clientId: OAUTH_CONFIG.google[env],
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
    // Check if running in Expo Go
    const isExpoGo = Constants.appOwnership === 'expo';

    if (Platform.OS === 'web') {
      // Web platform
      this.redirectUri = AuthSession.makeRedirectUri({
        useProxy: false,
      });
    } else if (isExpoGo) {
      // Running in Expo Go - must use proxy
      this.redirectUri = AuthSession.makeRedirectUri({
        useProxy: true,
        projectNameForProxy: '@antoafarian/hantibink',
      });
    } else {
      // Development build or standalone app - use custom scheme
      this.redirectUri = AuthSession.makeRedirectUri({
        scheme: 'hantibink',
        useProxy: false,
      });
    }

    Logger.info('🔐 OAuth redirect URI:', this.redirectUri);
    Logger.info('📱 Platform:', Platform.OS);
    Logger.info('📦 App Ownership:', Constants.appOwnership || 'standalone');
  }

  /**
   * Sign in with Google using AuthSession
   */
  async signInWithGoogle() {
    try {
      Logger.info('🔐 Starting Google sign-in...');

      const config = getOAuthConfig();

      // For web platform, use different response type
      const isWeb = Platform.OS === 'web';

      // Create the auth request - use appropriate response type based on platform
      const request = new AuthSession.AuthRequest({
        clientId: config.google.clientId,
        scopes: config.google.scopes,
        // Use IdToken for native platforms, Token for web
        responseType: isWeb ? AuthSession.ResponseType.Token : AuthSession.ResponseType.IdToken,
        redirectUri: this.redirectUri,
        prompt: AuthSession.Prompt.SelectAccount,
        extraParams: {
          // Add nonce for security
          nonce: Math.random().toString(36).substring(7),
          // For web, we may need explicit access type
          ...(isWeb && { access_type: 'online' }),
        },
      });

      Logger.info('📤 OAuth Request:', {
        clientId: config.google.clientId,
        redirectUri: this.redirectUri,
        responseType: request.responseType,
        platform: Platform.OS,
      });

      // Check if running in Expo Go
      const isExpoGo = Constants.appOwnership === 'expo';

      // Prompt for authentication
      const result = await request.promptAsync(discovery, {
        useProxy: isExpoGo && Platform.OS !== 'web', // Only use proxy for Expo Go
      });

      Logger.info('🔍 OAuth Result:', {
        type: result.type,
        hasParams: !!result.params,
        hasAuthentication: !!result.authentication,
        error: result.error,
        errorCode: result.errorCode,
      });

      if (result.type === 'success') {
        // Get tokens from the response
        const { params, authentication } = result;

        // Try to get ID token from params or authentication
        const idToken = params?.id_token || authentication?.idToken;
        const accessToken = params?.access_token || authentication?.accessToken;

        Logger.info('📦 Token info:', {
          hasIdToken: !!idToken,
          hasAccessToken: !!accessToken,
        });

        // If we have an access token but no ID token (common on web),
        // we'll send the access token to the backend
        if (idToken || accessToken) {
          Logger.success('✅ Got tokens from Google');
          return {
            success: true,
            provider: 'google',
            idToken: idToken || null,
            accessToken: accessToken || null,
            user: {
              // These will be populated by the backend
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
          Logger.error('❌ No tokens in response');
          Logger.error('Full params:', params);
          Logger.error('Full authentication:', authentication);
          return {
            success: false,
            error: 'No tokens received from Google',
          };
        }
      } else if (result.type === 'cancel') {
        Logger.info('❌ Google sign-in cancelled by user');
        return {
          success: false,
          error: 'Sign-in cancelled',
        };
      } else if (result.type === 'dismiss') {
        Logger.error('❌ Google sign-in dismissed');
        return {
          success: false,
          error: 'Authentication window closed',
        };
      } else if (result.type === 'error') {
        Logger.error('❌ Google sign-in error:', {
          error: result.error,
          errorCode: result.errorCode,
        });
        return {
          success: false,
          error: result.error?.message || result.errorCode || 'Authentication failed',
        };
      } else {
        Logger.error('❌ Unknown result type:', result.type);
        return {
          success: false,
          error: 'Authentication failed',
        };
      }
    } catch (error) {
      Logger.error('❌ Google sign-in error:', error);
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
