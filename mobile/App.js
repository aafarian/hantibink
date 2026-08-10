import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useCallback } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Sentry from '@sentry/react-native';
import * as SplashScreen from 'expo-splash-screen';
import Constants from 'expo-constants';
import { useFonts } from 'expo-font';
import ErrorBoundary from './src/components/ErrorBoundary';
import { AuthProvider } from './src/contexts/AuthContext';
import { ToastProvider } from './src/contexts/ToastContext';
import { UnreadProvider } from './src/contexts/UnreadContext';
import { FeatureFlagsProvider } from './src/contexts/FeatureFlagsContext';
import { PhotoViewerProvider } from './src/contexts/PhotoViewerContext';
import { UpdateProvider } from './src/contexts/UpdateContext';
import AppNavigator from './src/navigation/AppNavigator';
import { theme } from './src/styles/theme';
import { fontMap } from './src/styles/fonts';
import { initAnalytics, trackAppOpened } from './src/utils/analytics';
import { configurePurchases } from './src/utils/purchases';

// Keep splash screen visible while fonts load
SplashScreen.preventAutoHideAsync();

// Initialize Sentry - only in production builds
const SENTRY_DSN = Constants.expoConfig?.extra?.sentryDsn;
if (SENTRY_DSN && !__DEV__) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: 'production',
    enableAutoSessionTracking: true,
    tracesSampleRate: 0.1,
  });
}

// RevenueCat (no-op when no key is baked into this build)
configurePurchases();

function App() {
  const [fontsLoaded, fontError] = useFonts(fontMap);

  // Initialize analytics on app start
  useEffect(() => {
    const setupAnalytics = async () => {
      await initAnalytics();
      trackAppOpened();
    };
    setupAnalytics();
  }, []);

  // Hide splash screen once fonts are loaded or on error
  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <UpdateProvider>
          <ToastProvider>
            <AuthProvider>
              <FeatureFlagsProvider>
                <UnreadProvider>
                  <GestureHandlerRootView style={styles.container} onLayout={onLayoutRootView}>
                    <StatusBar
                      style="light"
                      backgroundColor={theme.colors.primary}
                      translucent={true}
                    />
                    <PhotoViewerProvider>
                      <AppNavigator />
                    </PhotoViewerProvider>
                  </GestureHandlerRootView>
                </UnreadProvider>
              </FeatureFlagsProvider>
            </AuthProvider>
          </ToastProvider>
        </UpdateProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

// Wrap with Sentry for automatic error tracking
export default Sentry.wrap(App);
