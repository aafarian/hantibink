import React, { useEffect, useRef, memo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';

/**
 * AnimatedMessageBubble - Wrapper component that provides entry animations for chat messages.
 *
 * Animates NEW messages (isTemp or recently added) with:
 * - Fade in from 0 to 1 opacity
 * - Scale from 0.7 to 1 (bouncy pop effect)
 * - Slide up from bottom
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
      // Bouncy spring for a noticeable pop effect
      progress.value = withSpring(1, {
        damping: 12,
        stiffness: 180,
        mass: 0.8,
      });
    }
  }, [shouldAnimate, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(progress.value, [0, 1], [0, 1], Extrapolation.CLAMP);

    // More dramatic scale for noticeable pop
    const scale = interpolate(progress.value, [0, 1], [0.7, 1], Extrapolation.CLAMP);

    // Slide up from bottom (more noticeable for sent messages)
    const translateY = interpolate(progress.value, [0, 1], [30, 0], Extrapolation.CLAMP);

    // Slight horizontal slide based on message owner
    const translateX = interpolate(
      progress.value,
      [0, 1],
      [isOwnMessage ? 15 : -15, 0],
      Extrapolation.CLAMP
    );

    return {
      opacity,
      transform: [{ scale }, { translateY }, { translateX }],
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
