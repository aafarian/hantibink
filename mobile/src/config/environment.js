import Constants from 'expo-constants';

const ENV = {
  dev: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://192.168.68.67:3000',
    socketUrl: process.env.EXPO_PUBLIC_SOCKET_URL || 'http://192.168.68.67:3000',
  },
  staging: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL || 'https://staging-api.hantibink.com',
    socketUrl: process.env.EXPO_PUBLIC_SOCKET_URL || 'https://staging-api.hantibink.com',
  },
  prod: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL || 'https://api.hantibink.com',
    socketUrl: process.env.EXPO_PUBLIC_SOCKET_URL || 'https://api.hantibink.com',
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
