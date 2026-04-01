import React, { useEffect, useRef, memo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSequence,
  withDelay,
  interpolate,
  Extrapolation,
  Easing,
} from 'react-native-reanimated';

/**
 * AnimatedMessageBubble - Wrapper component that provides entry animations for chat messages.
 *
 * Animates sent messages with a visible "pop up" effect:
 * - Starts small and below final position
 * - Scales up with slight overshoot
 * - Slides into place
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - The message content to animate
 * @param {boolean} props.isOwnMessage - Whether this is the current user's message
 * @param {boolean} props.shouldAnimate - Whether this message should animate (new messages only)
 */
const AnimatedMessageBubble = ({ children, isOwnMessage, shouldAnimate = false }) => {
  // Track if we've already animated this message
  const hasAnimated = useRef(false);
  const progress = useSharedValue(shouldAnimate && !hasAnimated.current ? 0 : 1);

  useEffect(() => {
    if (shouldAnimate && !hasAnimated.current) {
      hasAnimated.current = true;

      // Slower, more visible animation with overshoot
      progress.value = withSequence(
        // First animate to 1.08 (slight overshoot) over 250ms
        withTiming(1.08, {
          duration: 250,
          easing: Easing.out(Easing.back(1.5)),
        }),
        // Then settle back to 1 over 150ms
        withDelay(
          20,
          withTiming(1, {
            duration: 150,
            easing: Easing.out(Easing.ease),
          })
        )
      );
    }
  }, [shouldAnimate, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    // Fade in
    const opacity = interpolate(progress.value, [0, 0.5, 1], [0, 1, 1], Extrapolation.CLAMP);

    // Scale with overshoot support (progress goes to 1.08 then back to 1)
    const scale = interpolate(progress.value, [0, 1, 1.08], [0.5, 1, 1.05], Extrapolation.CLAMP);

    // Slide up from below - more dramatic 50px
    const translateY = interpolate(progress.value, [0, 1], [50, 0], Extrapolation.CLAMP);

    // Slide from side based on sender
    const translateX = interpolate(
      progress.value,
      [0, 1],
      [isOwnMessage ? 30 : -30, 0],
      Extrapolation.CLAMP
    );

    return {
      opacity,
      transform: [{ translateY }, { translateX }, { scale }],
    };
  });

  return <Animated.View style={[styles.container, animatedStyle]}>{children}</Animated.View>;
};

const styles = StyleSheet.create({
  container: {
    // Container needs no special styles, just wraps children
  },
});

export default memo(AnimatedMessageBubble);
