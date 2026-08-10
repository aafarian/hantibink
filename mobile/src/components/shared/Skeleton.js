import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { theme } from '../../styles/theme';

/**
 * Skeleton loading component with shimmer animation.
 *
 * @param {Object} props
 * @param {string} [props.variant] - Preset shape: 'text', 'avatar', 'card', 'button'
 * @param {number} [props.width] - Custom width (overrides variant)
 * @param {number} [props.height] - Custom height (overrides variant)
 * @param {number} [props.borderRadius] - Custom border radius (overrides variant)
 * @param {Object} [props.style] - Additional styles
 *
 * @example
 * // Text skeleton
 * <Skeleton variant="text" />
 *
 * // Avatar skeleton
 * <Skeleton variant="avatar" />
 *
 * // Custom dimensions
 * <Skeleton width={200} height={100} borderRadius={8} />
 */

// Preset dimensions for common shapes
const PRESETS = {
  text: {
    width: '100%',
    height: 16,
    borderRadius: theme.borderRadius.sm,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.round,
  },
  card: {
    width: '100%',
    height: 120,
    borderRadius: theme.borderRadius.lg,
  },
  button: {
    width: 120,
    height: 44,
    borderRadius: theme.borderRadius.md,
  },
};

// Colors for skeleton shimmer effect
const SKELETON_COLORS = {
  base: theme.colors.gray[300],
  highlight: theme.colors.gray[100],
};

const Skeleton = ({ variant, width, height, borderRadius, style }) => {
  const shimmerValue = useSharedValue(0);

  useEffect(() => {
    // Start shimmer animation
    shimmerValue.value = withRepeat(
      withTiming(1, {
        duration: 1200,
        easing: Easing.linear,
      }),
      -1, // Infinite repeat
      false // Don't reverse
    );
  }, [shimmerValue]);

  // Get preset values or use custom props
  const preset = variant && PRESETS[variant] ? PRESETS[variant] : {};
  const finalWidth = width ?? preset.width ?? 100;
  const finalHeight = height ?? preset.height ?? 20;
  const finalBorderRadius = borderRadius ?? preset.borderRadius ?? theme.borderRadius.sm;

  const animatedStyle = useAnimatedStyle(() => {
    // Interpolate shimmer position across the component
    const translateX = interpolate(shimmerValue.value, [0, 1], [-100, 100]);

    return {
      transform: [{ translateX }],
    };
  });

  return (
    <View
      style={[
        styles.container,
        {
          width: finalWidth,
          height: finalHeight,
          borderRadius: finalBorderRadius,
        },
        style,
      ]}
    >
      <Animated.View style={[styles.shimmer, animatedStyle]} />
    </View>
  );
};

/**
 * SkeletonGroup - Renders multiple text skeletons with varying widths
 *
 * @param {Object} props
 * @param {number} [props.lines=3] - Number of text lines
 * @param {number} [props.spacing=8] - Spacing between lines
 *
 * @example
 * <Skeleton.Group lines={3} />
 */
Skeleton.Group = ({ lines = 3, spacing = theme.spacing.sm }) => {
  // Create varying widths for more natural look
  const widths = ['100%', '90%', '75%', '80%', '95%'];

  return (
    <View style={{ gap: spacing }}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton key={index} variant="text" width={widths[index % widths.length]} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: SKELETON_COLORS.base,
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: SKELETON_COLORS.highlight,
    opacity: 0.5,
    // Create a gradient-like effect with width
    width: '50%',
  },
});

export default Skeleton;
