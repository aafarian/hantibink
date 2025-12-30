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
            icon: './assets/adaptive-icon.png',
            color: '#E91E63',
          },
        ],
      ],
      extra: {
        eas: {
          projectId: '316f94ce-dca3-4d3d-868a-5885e6704f84',
        },
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
