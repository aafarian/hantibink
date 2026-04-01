import React, { useEffect, memo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withDelay,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { theme } from '../../styles/theme';

/**
 * AnimatedMessageBubble - Wrapper component that provides entry animations for chat messages.
 *
 * Animates messages with:
 * - Fade in from 0 to 1 opacity
 * - Scale from 0.8 to 1
 * - Slide from bottom (own messages) or left (other messages)
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - The message content to animate
 * @param {boolean} props.isOwnMessage - Whether this is the current user's message
 * @param {boolean} props.isNew - Whether this is a newly added message (triggers animation)
 * @param {number} props.index - Index in the list for stagger delay
 * @param {boolean} props.skipAnimation - Skip animation (for initial load)
 */
const AnimatedMessageBubble = ({
  children,
  isOwnMessage,
  isNew = false,
  index = 0,
  skipAnimation = false,
}) => {
  const progress = useSharedValue(skipAnimation ? 1 : 0);

  useEffect(() => {
    if (skipAnimation) {
      progress.value = 1;
      return;
    }

    // Stagger delay based on index (max 5 items staggered)
    const delay = Math.min(index, 5) * 30;

    progress.value = withDelay(
      delay,
      withSpring(1, {
        damping: theme.animation.springs.smooth.damping,
        stiffness: theme.animation.springs.smooth.stiffness,
        mass: theme.animation.springs.smooth.mass,
      })
    );
  }, [progress, index, skipAnimation]);

  const animatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(progress.value, [0, 1], [0, 1], Extrapolation.CLAMP);

    const scale = interpolate(progress.value, [0, 1], [0.85, 1], Extrapolation.CLAMP);

    // Own messages slide from right, other messages slide from left
    const translateX = interpolate(
      progress.value,
      [0, 1],
      [isOwnMessage ? 20 : -20, 0],
      Extrapolation.CLAMP
    );

    // Slight upward slide for new messages
    const translateY = interpolate(
      progress.value,
      [0, 1],
      [isNew ? 10 : 0, 0],
      Extrapolation.CLAMP
    );

    return {
      opacity,
      transform: [{ scale }, { translateX }, { translateY }],
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
