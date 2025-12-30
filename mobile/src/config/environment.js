import Constants from 'expo-constants';

// GIPHY API key (same across all environments)
const giphyApiKey = process.env.EXPO_PUBLIC_GIPHY_API_KEY || '';

const ENV = {
  dev: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000',
    socketUrl: process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:3000',
    giphyApiKey,
  },
  staging: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL || 'https://staging-api.hantibink.com',
    socketUrl: process.env.EXPO_PUBLIC_SOCKET_URL || 'https://staging-api.hantibink.com',
    giphyApiKey,
  },
  prod: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL || 'https://api.hantibink.com',
    socketUrl: process.env.EXPO_PUBLIC_SOCKET_URL || 'https://api.hantibink.com',
    giphyApiKey,
  },
};

const getEnvVars = () => {
  if (__DEV__) {
    return ENV.dev;
  }

  const releaseChannel = Constants.expoConfig?.releaseChannel;

  if (releaseChannel === 'staging') {
    return ENV.staging;
  }

  if (releaseChannel === 'prod') {
    return ENV.prod;
  }

  return ENV.dev;
};

export default getEnvVars();
