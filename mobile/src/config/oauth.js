/**
 * OAuth Configuration
 * Store your OAuth client IDs here
 */

// Validate OAuth configuration - returns placeholder if missing (no longer throws)
const validateConfig = (value, name) => {
  if (!value || value.includes('YOUR_')) {
    // Return placeholder - OAuth will fail gracefully if user tries to use unconfigured provider
    return `MISSING_${name}_PLEASE_CONFIGURE`;
  }
  return value;
};

const isDevelopment = __DEV__ || process.env.NODE_ENV === 'development';

const OAUTH_CONFIG = {
  google: {
    // Get these from Google Cloud Console
    // https://console.cloud.google.com/apis/credentials
    development: validateConfig(
      process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_DEV,
      'EXPO_PUBLIC_GOOGLE_CLIENT_ID_DEV',
      true
    ),
    production: validateConfig(
      process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_PROD,
      'EXPO_PUBLIC_GOOGLE_CLIENT_ID_PROD',
      isDevelopment
    ),
  },
  facebook: {
    // Get these from Facebook Developer Console
    // https://developers.facebook.com/apps/
    development: validateConfig(
      process.env.EXPO_PUBLIC_FACEBOOK_APP_ID_DEV,
      'EXPO_PUBLIC_FACEBOOK_APP_ID_DEV',
      true
    ),
    production: validateConfig(
      process.env.EXPO_PUBLIC_FACEBOOK_APP_ID_PROD,
      'EXPO_PUBLIC_FACEBOOK_APP_ID_PROD',
      isDevelopment
    ),
  },
  apple: {
    // Get this from Apple Developer Console
    // https://developer.apple.com/account/resources/identifiers/list
    serviceId: validateConfig(
      process.env.EXPO_PUBLIC_APPLE_SERVICE_ID,
      'EXPO_PUBLIC_APPLE_SERVICE_ID',
      isDevelopment
    ),
  },
};

export default OAUTH_CONFIG;
