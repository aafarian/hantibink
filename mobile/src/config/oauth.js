/**
 * OAuth Configuration
 * Store your OAuth client IDs here
 */

const OAUTH_CONFIG = {
  google: {
    // Get these from Google Cloud Console
    // https://console.cloud.google.com/apis/credentials
    development:
      process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_DEV ||
      'YOUR_DEV_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
    production:
      process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_PROD ||
      'YOUR_PROD_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
  },
  facebook: {
    // Get these from Facebook Developer Console
    // https://developers.facebook.com/apps/
    development: process.env.EXPO_PUBLIC_FACEBOOK_APP_ID_DEV || 'YOUR_DEV_FACEBOOK_APP_ID',
    production: process.env.EXPO_PUBLIC_FACEBOOK_APP_ID_PROD || 'YOUR_PROD_FACEBOOK_APP_ID',
  },
  apple: {
    // Get this from Apple Developer Console
    // https://developer.apple.com/account/resources/identifiers/list
    serviceId: process.env.EXPO_PUBLIC_APPLE_SERVICE_ID || 'YOUR_APPLE_SERVICE_ID',
  },
};

export default OAUTH_CONFIG;
