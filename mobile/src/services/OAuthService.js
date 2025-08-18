/**
 * OAuth Service for Social Authentication
 * Handles Google, Facebook, and Apple sign-in
 */

import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Logger from '../utils/logger';
import OAUTH_CONFIG from '../config/oauth';

// Google discovery document for OAuth
const GOOGLE_DISCOVERY = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

// Ensure web browser sessions complete properly
WebBrowser.maybeCompleteAuthSession();

// Get OAuth configuration
const getOAuthConfig = () => {
  const env = __DEV__ ? 'development' : 'production';

  return {
    google: {
      clientId: OAUTH_CONFIG.google[env],
      scopes: ['openid', 'profile', 'email'],
      responseType: AuthSession.ResponseType.Token,
    },
    facebook: {
      clientId: OAUTH_CONFIG.facebook[env],
      scopes: ['public_profile', 'email'],
      responseType: AuthSession.ResponseType.Token,
    },
    apple: {
      serviceId: OAUTH_CONFIG.apple.serviceId,
      scopes: ['email', 'name'],
    },
  };
};

class OAuthService {
  constructor() {
    // Force use of Expo proxy in development
    if (__DEV__) {
      // In development, always use Expo proxy
      this.redirectUri = 'https://auth.expo.io/@antoafarian/hantibink';
    } else {
      // In production, use the actual app scheme
      this.redirectUri = AuthSession.makeRedirectUri({
        scheme: 'hantibink',
        useProxy: false,
      });
    }
    Logger.info('🔐 OAuth redirect URI:', this.redirectUri);
  }

  /**
   * Sign in with Google
   */
  async signInWithGoogle() {
    try {
      Logger.info('🔐 Starting Google sign-in...');

      const config = getOAuthConfig();

      // Create auth request without PKCE for implicit grant flow
      const request = new AuthSession.AuthRequest({
        clientId: config.google.clientId,
        scopes: config.google.scopes,
        responseType: AuthSession.ResponseType.Token, // Use implicit grant flow
        redirectUri: this.redirectUri,
        prompt: AuthSession.Prompt.SelectAccount,
        usePKCE: false, // Explicitly disable PKCE for implicit grant
        extraParams: {
          access_type: 'online', // For web applications
        },
      });

      // Use Google discovery with proxy enabled
      const result = await request.promptAsync(GOOGLE_DISCOVERY, {
        useProxy: true, // Always use proxy for OAuth
      });

      Logger.info(
        '🔍 Google OAuth result:',
        JSON.stringify(
          {
            type: result.type,
            params: result.params,
            authentication: result.authentication,
            error: result.error,
            errorCode: result.errorCode,
            url: result.url,
          },
          null,
          2
        )
      );

      if (result.type === 'success') {
        Logger.success('✅ Google authentication successful');

        // Check if we have an access token
        const accessToken = result.params?.access_token || result.authentication?.accessToken;

        if (!accessToken) {
          Logger.error('❌ No access token in OAuth response');
          return {
            success: false,
            error: 'No access token received',
          };
        }

        // Get user info from Google
        const userInfo = await this.fetchGoogleUserInfo(accessToken);

        // Structure the OAuth response
        return {
          success: true,
          provider: 'google',
          accessToken: accessToken,
          idToken: result.params?.id_token || result.authentication?.idToken,
          user: {
            email: userInfo.email,
            name: userInfo.name,
            firstName: userInfo.given_name,
            lastName: userInfo.family_name,
            photo: userInfo.picture,
            emailVerified: userInfo.verified_email,
            providerId: userInfo.id,
          },
        };
      } else if (result.type === 'cancel') {
        Logger.info('❌ Google sign-in cancelled');
        return {
          success: false,
          error: 'Sign-in cancelled',
        };
      } else if (result.type === 'dismiss') {
        Logger.info('❌ Google sign-in dismissed');
        return {
          success: false,
          error: 'Sign-in dismissed',
        };
      } else {
        Logger.error('❌ Google sign-in error:', {
          type: result.type,
          error: result.error,
          errorCode: result.errorCode,
          url: result.url,
        });
        return {
          success: false,
          error: result.error?.message || result.errorCode || 'Sign-in failed',
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
        responseType: config.facebook.responseType,
        redirectUri: this.redirectUri,
      });

      // Initiate authentication
      const result = await request.promptAsync({
        useProxy: __DEV__,
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
   * Generate a secure state parameter for OAuth
   */
  async generateStateParameter() {
    const state = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      Math.random().toString(36).substring(7) + Date.now().toString(),
      { encoding: Crypto.CryptoEncoding.HEX }
    );
    return state;
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

    // Check if client IDs are configured (not placeholder values)
    if (provider === 'google') {
      return providerConfig.clientId && !providerConfig.clientId.includes('YOUR_');
    }
    if (provider === 'facebook') {
      return providerConfig.clientId && !providerConfig.clientId.includes('YOUR_');
    }
    if (provider === 'apple') {
      return providerConfig.serviceId && !providerConfig.serviceId.includes('YOUR_');
    }

    return false;
  }
}

// Export singleton instance
export default new OAuthService();
