/**
 * OAuth Configuration
 * Store your OAuth client IDs here
 */

// Validate OAuth configuration for production
const validateConfig = (value, name, isDev = false) => {
  if (!value || value.includes('YOUR_')) {
    if (!isDev) {
      throw new Error(
        `Missing required OAuth configuration: ${name}. ` +
          `Please set the appropriate environment variable.`
      );
    }
    // Return an obviously invalid value for development
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
