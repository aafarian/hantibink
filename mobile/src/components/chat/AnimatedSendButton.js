import React, { useCallback, memo } from 'react';
import { StyleSheet, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../../styles/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * AnimatedSendButton - A send button with satisfying press animations.
 *
 * Features:
 * - Scale down on press
 * - Pop/bounce effect when actually sending
 * - Haptic feedback
 * - Disabled state styling
 *
 * @param {Object} props
 * @param {Function} props.onSend - Called when button is pressed and enabled
 * @param {boolean} props.disabled - Whether the button is disabled
 * @param {string} props.iconColor - Color of the send icon
 */
const AnimatedSendButton = ({ onSend, disabled = false, iconColor }) => {
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);

  const handlePressIn = useCallback(() => {
    if (disabled) return;
    scale.value = withSpring(0.85, theme.animation.springs.stiff);
  }, [disabled, scale]);

  const handlePressOut = useCallback(() => {
    if (disabled) return;
    scale.value = withSpring(1, theme.animation.springs.bouncy);
  }, [disabled, scale]);

  const triggerSendAnimation = useCallback(() => {
    // Pop effect: quick scale up then back
    scale.value = withSequence(
      withSpring(1.15, { damping: 8, stiffness: 400 }),
      withSpring(1, { damping: 12, stiffness: 200 })
    );

    // Slight rotation for extra flair
    rotation.value = withSequence(
      withSpring(-5, { damping: 10, stiffness: 300 }),
      withSpring(0, { damping: 12, stiffness: 200 })
    );
  }, [scale, rotation]);

  const handlePress = useCallback(() => {
    if (disabled) return;

    // Trigger haptic
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Trigger animation
    triggerSendAnimation();

    // Call the onSend callback
    if (onSend) {
      runOnJS(onSend)();
    }
  }, [disabled, triggerSendAnimation, onSend]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${rotation.value}deg` }],
    opacity: disabled ? 0.5 : 1,
  }));

  const color = disabled ? theme.colors.text.muted : iconColor || theme.colors.primary;

  return (
    <AnimatedPressable
      style={[styles.button, animatedStyle]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={disabled}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons name="send" size={22} color={color} />
    </AnimatedPressable>
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
});

export default memo(AnimatedSendButton);
