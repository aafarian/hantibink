import React, { useCallback, memo } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../../styles/theme';

/**
 * AnimatedSendButton - A send button with haptic feedback.
 *
 * Note: Visual animations removed since the button switches to mic immediately
 * after sending (text clears), so animations aren't visible. Haptic feedback
 * provides the tactile confirmation instead.
 *
 * @param {Object} props
 * @param {Function} props.onSend - Called when button is pressed and enabled
 * @param {boolean} props.disabled - Whether the button is disabled
 * @param {string} props.iconColor - Color of the send icon
 */
const AnimatedSendButton = ({ onSend, disabled = false, iconColor }) => {
  const handlePress = useCallback(() => {
    if (disabled) return;

    // Haptic feedback is the main feedback since visual animation isn't visible
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (onSend) {
      onSend();
    }
  }, [disabled, onSend]);

  const color = disabled ? theme.colors.text.muted : iconColor || theme.colors.primary;

  return (
    <TouchableOpacity
      style={[styles.button, disabled && styles.disabled]}
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons name="send" size={22} color={color} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
});

export default memo(AnimatedSendButton);
