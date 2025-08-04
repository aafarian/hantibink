import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { commonStyles } from '../styles/commonStyles';
import { theme } from '../styles/theme';

export const ErrorScreen = ({
  message = 'Something went wrong',
  onRetry,
  retryText = 'Try Again',
  style = {},
}) => (
  <View style={[commonStyles.container, commonStyles.centered, style]}>
    <Ionicons
      name="alert-circle-outline"
      size={64}
      color={theme.colors.status.error}
      style={{ marginBottom: theme.spacing.lg }}
    />
    <Text style={[commonStyles.errorText, { marginBottom: theme.spacing.xl }]}>{message}</Text>
    {onRetry && (
      <TouchableOpacity style={commonStyles.buttonPrimary} onPress={onRetry}>
        <Text style={commonStyles.buttonText}>{retryText}</Text>
      </TouchableOpacity>
    )}
  </View>
);

export const EmptyState = ({
  icon = 'heart-outline',
  title = 'Nothing here yet',
  subtitle = 'Come back later to see updates',
  action = null, // { text: "Get Started", onPress: () => {} }
  style = {},
}) => (
  <View style={[commonStyles.centered, { padding: theme.spacing.huge }, style]}>
    <Ionicons
      name={icon}
      size={80}
      color={theme.colors.text.muted}
      style={{ marginBottom: theme.spacing.lg }}
    />
    <Text style={[commonStyles.h3, { marginBottom: theme.spacing.sm, textAlign: 'center' }]}>
      {title}
    </Text>
    <Text style={[commonStyles.textMuted, { textAlign: 'center', marginBottom: theme.spacing.xl }]}>
      {subtitle}
    </Text>
    {action && (
      <TouchableOpacity style={commonStyles.buttonPrimary} onPress={action.onPress}>
        <Text style={commonStyles.buttonText}>{action.text}</Text>
      </TouchableOpacity>
    )}
  </View>
);
