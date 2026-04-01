import React from 'react';
import { View, StatusBar, Platform, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../styles/theme';

/**
 * Reusable screen wrapper that handles safe areas consistently across iOS and Android.
 *
 * Usage:
 * <ScreenWrapper>
 *   <YourScreenContent />
 * </ScreenWrapper>
 *
 * With custom status bar:
 * <ScreenWrapper statusBarColor="#000" statusBarStyle="light-content">
 *   <YourScreenContent />
 * </ScreenWrapper>
 *
 * Without safe area (for screens that handle it themselves):
 * <ScreenWrapper useSafeArea={false}>
 *   <YourScreenContent />
 * </ScreenWrapper>
 */
const ScreenWrapper = ({
  children,
  style,
  statusBarColor = theme.colors.primary,
  statusBarStyle = 'light-content',
  useSafeArea = true,
  edges = ['top', 'bottom'], // Which edges to apply safe area insets
  backgroundColor = theme.colors.background.primary,
}) => {
  const insets = useSafeAreaInsets();

  // On iOS, use SafeAreaView for proper safe area handling
  // On Android, we need to manually handle the status bar height
  const WrapperComponent = Platform.OS === 'ios' && useSafeArea ? SafeAreaView : View;

  const containerStyle = [styles.container, { backgroundColor }, style];

  // For Android, add padding for safe areas if useSafeArea is true
  if (Platform.OS === 'android' && useSafeArea) {
    if (edges.includes('bottom')) {
      containerStyle.push({ paddingBottom: insets.bottom });
    }
  }

  return (
    <>
      <StatusBar
        backgroundColor={statusBarColor}
        barStyle={statusBarStyle}
        translucent={Platform.OS === 'android'}
      />
      {/* Android status bar spacer */}
      {Platform.OS === 'android' && useSafeArea && edges.includes('top') && (
        <View style={{ height: StatusBar.currentHeight, backgroundColor: statusBarColor }} />
      )}
      <WrapperComponent style={containerStyle} edges={edges}>
        {children}
      </WrapperComponent>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default ScreenWrapper;
