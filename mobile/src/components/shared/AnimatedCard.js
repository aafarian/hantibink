import React, { useEffect } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { theme } from '../../styles/theme';
import useAnimatedPress from '../../hooks/useAnimatedPress';

/**
 * AnimatedCard component with press animations and enter animations.
 *
 * Features:
 * - Scale on press when onPress is provided
 * - Supports elevation/shadow variants (small, medium, large)
 * - Supports padding size variations (small, medium, large)
 * - Optional press highlight color
 * - Smooth enter animation (fade + scale)
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Card content
 * @param {Function} [props.onPress] - Press handler (enables press animation when provided)
 * @param {'small'|'medium'|'large'} [props.shadow='medium'] - Shadow variant from theme.shadows
 * @param {'small'|'medium'|'large'} [props.size='medium'] - Padding size variant
 * @param {string} [props.highlightColor] - Optional background color on press
 * @param {boolean} [props.animateEnter=true] - Whether to animate on mount
 * @param {number} [props.enterDelay=0] - Delay before enter animation (for staggered lists)
 * @param {Object} [props.style] - Additional styles
 * @param {string} [props.testID] - Test ID for testing
 * @param {boolean} [props.disabled] - Disable press interactions
 * @param {Object} [props.pressConfig] - Custom config for useAnimatedPress hook
 *
 * @example
 * // Basic card without press
 * <AnimatedCard>
 *   <Text>Card content</Text>
 * </AnimatedCard>
 *
 * @example
 * // Pressable card with large shadow
 * <AnimatedCard onPress={() => console.log('pressed')} shadow="large">
 *   <Text>Pressable card</Text>
 * </AnimatedCard>
 *
 * @example
 * // Card with staggered enter animation
 * {items.map((item, index) => (
 *   <AnimatedCard key={item.id} enterDelay={index * 50}>
 *     <Text>{item.title}</Text>
 *   </AnimatedCard>
 * ))}
 */

// Padding presets for different sizes
const SIZE_PADDING = {
  small: theme.spacing.md,
  medium: theme.spacing.lg,
  large: theme.spacing.xl,
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const AnimatedCard = ({
  children,
  onPress,
  shadow = 'medium',
  size = 'medium',
  highlightColor,
  animateEnter = true,
  enterDelay = 0,
  style,
  testID,
  disabled = false,
  pressConfig,
}) => {
  // Press animation - only active when onPress is provided
  const { animatedStyle: pressAnimatedStyle, pressHandlers } = useAnimatedPress({
    ...pressConfig,
    // Use subtle press for cards
    scalePressed: theme.animation.scales.subtlePress,
    springConfig: theme.animation.springs.stiff,
  });

  // Enter animation values
  const enterOpacity = useSharedValue(animateEnter ? 0 : 1);
  const enterScale = useSharedValue(animateEnter ? 0.95 : 1);

  // Run enter animation on mount
  useEffect(() => {
    if (animateEnter) {
      const delay = enterDelay;

      // Create custom easing from theme tokens
      const { decelerate } = theme.animation.easings;
      const customEasing = Easing.bezier(
        decelerate.x1,
        decelerate.y1,
        decelerate.x2,
        decelerate.y2
      );

      // Animate opacity with timing
      enterOpacity.value = withTiming(1, {
        duration: theme.animation.durations.slow,
        easing: customEasing,
      });

      // Animate scale with spring for a more natural feel
      setTimeout(() => {
        enterScale.value = withSpring(1, theme.animation.springs.smooth);
      }, delay);

      // Start opacity animation after delay too
      if (delay > 0) {
        enterOpacity.value = 0;
        setTimeout(() => {
          enterOpacity.value = withTiming(1, {
            duration: theme.animation.durations.slow,
            easing: customEasing,
          });
        }, delay);
      }
    }
  }, [animateEnter, enterDelay, enterOpacity, enterScale]);

  // Enter animation style
  const enterAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: enterOpacity.value,
      transform: [{ scale: enterScale.value }],
    };
  });

  // Get shadow style from theme
  const shadowStyle = theme.shadows[shadow] || theme.shadows.medium;

  // Get padding from size
  const padding = SIZE_PADDING[size] || SIZE_PADDING.medium;

  // Combine all styles
  const cardStyle = [styles.card, shadowStyle, { padding }, style];

  // If onPress is provided, render as pressable with animations
  if (onPress && !disabled) {
    return (
      <AnimatedPressable
        onPress={onPress}
        onPressIn={pressHandlers.onPressIn}
        onPressOut={pressHandlers.onPressOut}
        style={[cardStyle, pressAnimatedStyle, enterAnimatedStyle]}
        testID={testID}
        android_ripple={highlightColor ? { color: highlightColor } : undefined}
      >
        {({ pressed }) => (
          <View style={pressed && highlightColor ? { backgroundColor: highlightColor } : undefined}>
            {children}
          </View>
        )}
      </AnimatedPressable>
    );
  }

  // Non-pressable card - just animate enter
  return (
    <Animated.View style={[cardStyle, enterAnimatedStyle]} testID={testID}>
      {children}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
  },
});

export default AnimatedCard;
