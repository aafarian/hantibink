/**
 * OAuth Configuration
 * Store your OAuth client IDs here
 */

import Logger from '../utils/logger';

const isDevelopment = __DEV__ || process.env.NODE_ENV === 'development';

/**
 * Validate OAuth configuration
 * @param {string} value - The env var value
 * @param {string} name - The env var name (for logging)
 * @param {object} options - Validation options
 * @param {boolean} options.required - If true, logs warning when missing in production
 * @param {boolean} options.silent - If true, doesn't log anything (for optional/future features)
 */
const validateConfig = (value, name, { required = false, silent = false } = {}) => {
  if (!value || value.includes('YOUR_')) {
    if (!isDevelopment && required && !silent) {
      Logger.warn(`OAuth config missing: ${name} - this OAuth provider won't work`);
    }
    return `MISSING_${name}`; // Placeholder string for OAuthService.isConfigured() compatibility
  }
  return value;
};

const OAUTH_CONFIG = {
  google: {
    // Get these from Google Cloud Console
    // https://console.cloud.google.com/apis/credentials
    development: validateConfig(
      process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_DEV,
      'EXPO_PUBLIC_GOOGLE_CLIENT_ID_DEV',
      { required: false } // Dev config not required in production
    ),
    production: validateConfig(
      process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_PROD,
      'EXPO_PUBLIC_GOOGLE_CLIENT_ID_PROD',
      { required: true } // Google OAuth is actively used
    ),
  },
  facebook: {
    // Get these from Facebook Developer Console
    // https://developers.facebook.com/apps/
    // NOTE: Facebook OAuth not yet implemented - silent validation
    development: validateConfig(
      process.env.EXPO_PUBLIC_FACEBOOK_APP_ID_DEV,
      'EXPO_PUBLIC_FACEBOOK_APP_ID_DEV',
      { silent: true }
    ),
    production: validateConfig(
      process.env.EXPO_PUBLIC_FACEBOOK_APP_ID_PROD,
      'EXPO_PUBLIC_FACEBOOK_APP_ID_PROD',
      { silent: true }
    ),
  },
  apple: {
    // Get this from Apple Developer Console
    // https://developer.apple.com/account/resources/identifiers/list
    // NOTE: Apple OAuth not yet implemented - silent validation
    serviceId: validateConfig(
      process.env.EXPO_PUBLIC_APPLE_SERVICE_ID,
      'EXPO_PUBLIC_APPLE_SERVICE_ID',
      { silent: true }
    ),
  },
};

/**
 * Helper to check if a provider is configured
 */
export const isProviderConfigured = provider => {
  const config = OAUTH_CONFIG[provider];
  if (!config) return false;

  const isValidValue = val => val && !val.includes('MISSING_') && !val.includes('YOUR_');

  if (provider === 'apple') {
    return isValidValue(config.serviceId);
  }

  const key = isDevelopment ? 'development' : 'production';
  return isValidValue(config[key]);
};

export default OAUTH_CONFIG;
