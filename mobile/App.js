import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { StyleSheet, Platform, View, StatusBar as RNStatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ErrorBoundary from './src/components/ErrorBoundary';
import { AuthProvider } from './src/contexts/AuthContext';

import { UnreadProvider } from './src/contexts/UnreadContext';
import { FeatureFlagsProvider } from './src/contexts/FeatureFlagsContext';
import { PhotoViewerProvider } from './src/contexts/PhotoViewerContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <ErrorBoundary>
      <PaperProvider>
        <SafeAreaProvider>
          <AuthProvider>
            <FeatureFlagsProvider>
              <UnreadProvider>
                <GestureHandlerRootView style={styles.container}>
                  <StatusBar style="light" backgroundColor="#FF6B6B" translucent={false} />
                  <View style={styles.statusBarBackground} />
                  <PhotoViewerProvider>
                    <AppNavigator />
                  </PhotoViewerProvider>
                </GestureHandlerRootView>
              </UnreadProvider>
            </FeatureFlagsProvider>
          </AuthProvider>
        </SafeAreaProvider>
      </PaperProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  statusBarBackground: {
    height: Platform.OS === 'android' ? RNStatusBar.currentHeight || 24 : 0,
    backgroundColor: '#FF6B6B',
  },
});
