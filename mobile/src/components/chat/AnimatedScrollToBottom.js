import React, { useEffect, memo, useCallback } from 'react';
import { StyleSheet, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { theme } from '../../styles/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * AnimatedScrollToBottom - Floating action button to scroll to bottom of chat.
 *
 * Features:
 * - Smooth fade/scale animation when appearing/disappearing
 * - Press animation with haptic feedback
 * - Bouncy entrance animation
 *
 * @param {Object} props
 * @param {boolean} props.visible - Whether the button should be visible
 * @param {Function} props.onPress - Called when button is pressed
 */
const AnimatedScrollToBottom = ({ visible, onPress }) => {
  const progress = useSharedValue(0);
  const pressScale = useSharedValue(1);

  useEffect(() => {
    progress.value = withSpring(visible ? 1 : 0, {
      damping: 15,
      stiffness: 150,
    });
  }, [visible, progress]);

  const handlePressIn = useCallback(() => {
    pressScale.value = withSpring(0.9, theme.animation.springs.stiff);
  }, [pressScale]);

  const handlePressOut = useCallback(() => {
    pressScale.value = withSpring(1, theme.animation.springs.bouncy);
  }, [pressScale]);

  const handlePress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Bounce animation
    pressScale.value = withSequence(
      withSpring(0.85, { damping: 10, stiffness: 400 }),
      withSpring(1, { damping: 12, stiffness: 200 })
    );

    if (onPress) {
      onPress();
    }
  }, [pressScale, onPress]);

  const containerStyle = useAnimatedStyle(() => {
    const opacity = interpolate(progress.value, [0, 1], [0, 1], Extrapolation.CLAMP);

    const scale = interpolate(progress.value, [0, 1], [0.5, 1], Extrapolation.CLAMP);

    const translateY = interpolate(progress.value, [0, 1], [20, 0], Extrapolation.CLAMP);

    return {
      opacity,
      transform: [{ scale: scale * pressScale.value }, { translateY }],
      pointerEvents: progress.value > 0.5 ? 'auto' : 'none',
    };
  });

  return (
    <AnimatedPressable
      style={[styles.container, containerStyle]}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
    >
      <Ionicons name="chevron-down" size={24} color={theme.colors.text.white} />
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 80,
    alignSelf: 'center',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 10,
  },
});

export default memo(AnimatedScrollToBottom);
