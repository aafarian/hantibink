module.exports = () => {
  const IS_DEV = process.env.NODE_ENV === 'development';

  return {
    expo: {
      name: IS_DEV ? 'Hantibink (Dev)' : 'Hantibink',
      slug: 'hantibink',
      scheme: 'hantibink',
      version: '1.0.0',
      orientation: 'portrait',
      icon: './assets/icon.png',
      userInterfaceStyle: 'light',
      newArchEnabled: true,
      splash: {
        image: './assets/splash-icon.png',
        resizeMode: 'contain',
        backgroundColor: '#ffffff',
      },
      ios: {
        supportsTablet: true,
        infoPlist: {
          NSLocationWhenInUseUsageDescription:
            'This app uses location to show you people nearby and improve your dating experience.',
          ITSAppUsesNonExemptEncryption: false,
        },
        bundleIdentifier: IS_DEV ? 'com.antoafarian.hantibink.dev' : 'com.antoafarian.hantibink',
      },
      android: {
        adaptiveIcon: {
          foregroundImage: './assets/adaptive-icon.png',
          backgroundColor: '#ffffff',
        },
        edgeToEdgeEnabled: true,
        permissions: [
          'android.permission.ACCESS_FINE_LOCATION',
          'android.permission.ACCESS_COARSE_LOCATION',
          'android.permission.RECORD_AUDIO',
        ],
        package: IS_DEV ? 'com.antoafarian.hantibink.dev' : 'com.antoafarian.hantibink',
        googleServicesFile: process.env.GOOGLE_SERVICES_JSON || './google-services.json',
      },
      web: {
        favicon: './assets/favicon.png',
      },
      plugins: [
        'expo-dev-client',
        'expo-image-picker',
        [
          'expo-location',
          {
            locationAlwaysAndWhenInUsePermission:
              'This app uses location to show you people nearby and improve your dating experience.',
          },
        ],
        'expo-web-browser',
        [
          'expo-notifications',
          {
            icon: './assets/notification-icon.png',
            color: '#C0392B',
          },
        ],
        '@react-native-google-signin/google-signin',
        'expo-font',
        [
          '@sentry/react-native/expo',
          {
            organization: process.env.SENTRY_ORG,
            project: process.env.SENTRY_PROJECT,
          },
        ],
      ],
      extra: {
        eas: {
          projectId: '316f94ce-dca3-4d3d-868a-5885e6704f84',
        },
        sentryDsn: process.env.SENTRY_DSN,
      },
      runtimeVersion: {
        policy: 'appVersion',
      },
      updates: {
        url: 'https://u.expo.dev/316f94ce-dca3-4d3d-868a-5885e6704f84',
      },
    },
  };
};
