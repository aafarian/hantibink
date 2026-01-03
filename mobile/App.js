import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import ErrorBoundary from './src/components/ErrorBoundary';
import { AuthProvider } from './src/contexts/AuthContext';
import { ToastProvider } from './src/contexts/ToastContext';
import { UnreadProvider } from './src/contexts/UnreadContext';
import { FeatureFlagsProvider } from './src/contexts/FeatureFlagsContext';
import { PhotoViewerProvider } from './src/contexts/PhotoViewerContext';
import AppNavigator from './src/navigation/AppNavigator';

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

function App() {
  return (
    <ErrorBoundary>
      <PaperProvider>
        <SafeAreaProvider>
          <ToastProvider>
            <AuthProvider>
              <FeatureFlagsProvider>
                <UnreadProvider>
                  <GestureHandlerRootView style={styles.container}>
                    <StatusBar style="light" backgroundColor="#D32F2F" translucent={true} />
                    <PhotoViewerProvider>
                      <AppNavigator />
                    </PhotoViewerProvider>
                  </GestureHandlerRootView>
                </UnreadProvider>
              </FeatureFlagsProvider>
            </AuthProvider>
          </ToastProvider>
        </SafeAreaProvider>
      </PaperProvider>
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
