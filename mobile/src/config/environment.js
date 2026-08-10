import * as Updates from 'expo-updates';

// GIPHY API key (same across all environments)
const giphyApiKey = process.env.EXPO_PUBLIC_GIPHY_API_KEY || '';

const ENV = {
  dev: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4242',
    socketUrl: process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:4242',
    giphyApiKey,
  },
  staging: {
    // TODO: Create staging Cloud Run service before launch
    apiUrl: process.env.EXPO_PUBLIC_API_URL || 'https://hantibink-api-staging.us-central1.run.app',
    socketUrl:
      process.env.EXPO_PUBLIC_SOCKET_URL || 'wss://hantibink-api-staging.us-central1.run.app',
    giphyApiKey,
  },
  prod: {
    apiUrl:
      process.env.EXPO_PUBLIC_API_URL || 'https://hantibink-api-393816901275.us-central1.run.app',
    socketUrl:
      process.env.EXPO_PUBLIC_SOCKET_URL || 'wss://hantibink-api-393816901275.us-central1.run.app',
    giphyApiKey,
  },
};

export const getEnvVars = () => {
  if (__DEV__) {
    return ENV.dev;
  }

  // EAS Update channel (the old Constants.expoConfig.releaseChannel is a
  // classic-updates field that is always undefined under EAS Update).
  const channel = Updates.channel;

  if (channel === 'staging') {
    return ENV.staging;
  }

  // Fail-safe inversion: any non-dev build without a recognized channel talks
  // to PROD, never to localhost. A misconfigured release hitting production
  // is recoverable; one hitting localhost is a broken app in users' hands.
  return ENV.prod;
};

export default getEnvVars();
