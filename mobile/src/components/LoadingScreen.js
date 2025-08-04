import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { commonStyles } from '../styles/commonStyles';
import { theme } from '../styles/theme';

export const LoadingScreen = ({
  message = 'Loading...',
  size = 'large',
  color = theme.colors.primary,
  style = {},
}) => (
  <View style={[commonStyles.container, commonStyles.centered, style]}>
    <ActivityIndicator size={size} color={color} />
    <Text style={[commonStyles.loadingText, { marginTop: theme.spacing.md }]}>{message}</Text>
  </View>
);

export const LoadingSpinner = ({ size = 'small', color = theme.colors.primary, style = {} }) => (
  <ActivityIndicator size={size} color={color} style={style} />
);

export const LoadingOverlay = ({
  visible,
  message = 'Loading...',
  backgroundColor = theme.colors.background.overlay,
}) => {
  if (!visible) return null;

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 999,
      }}
    >
      <View
        style={{
          backgroundColor: theme.colors.background.primary,
          padding: theme.spacing.xl,
          borderRadius: theme.borderRadius.lg,
          alignItems: 'center',
          ...theme.shadows.large,
        }}
      >
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[commonStyles.textPrimary, { marginTop: theme.spacing.md }]}>{message}</Text>
      </View>
    </View>
  );
};
