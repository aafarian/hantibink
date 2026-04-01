import { useCallback } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { theme } from '../styles/theme';

/**
 * Default configuration for press animations.
 * Can be overridden via the config parameter.
 */
const DEFAULT_CONFIG = {
  /** Scale value when pressed */
  scalePressed: theme.animation.scales.pressed,
  /** Scale value when released (resting state) */
  scaleResting: theme.animation.scales.resting,
  /** Use spring animation (true) or timing animation (false) */
  useSpring: true,
  /** Spring configuration - defaults to theme's stiff spring for snappy feedback */
  springConfig: theme.animation.springs.stiff,
  /** Timing duration when not using spring animation */
  timingDuration: theme.animation.durations.quick,
};

/**
 * Custom hook that provides press animation functionality using react-native-reanimated.
 * Animates scale transform on press for tactile feedback.
 *
 * @param {Object} [config] - Optional configuration to customize animation behavior
 * @param {number} [config.scalePressed] - Scale value when pressed (default: 0.96)
 * @param {number} [config.scaleResting] - Scale value at rest (default: 1)
 * @param {boolean} [config.useSpring] - Use spring animation vs timing (default: true)
 * @param {Object} [config.springConfig] - Spring configuration for react-native-reanimated
 * @param {number} [config.timingDuration] - Duration for timing-based animation
 *
 * @returns {Object} Animation handlers and animated style
 * @returns {Function} returns.onPressIn - Handler for press in events
 * @returns {Function} returns.onPressOut - Handler for press out events
 * @returns {Object} returns.animatedStyle - Animated style object with scale transform
 * @returns {Object} returns.pressHandlers - Object containing both onPressIn and onPressOut
 *
 * @example
 * // Basic usage
 * const { animatedStyle, pressHandlers } = useAnimatedPress();
 * return (
 *   <AnimatedPressable style={animatedStyle} {...pressHandlers}>
 *     <Text>Press Me</Text>
 *   </AnimatedPressable>
 * );
 *
 * @example
 * // With custom configuration
 * const { animatedStyle, onPressIn, onPressOut } = useAnimatedPress({
 *   scalePressed: 0.9,
 *   springConfig: theme.animation.springs.bouncy,
 * });
 */
const useAnimatedPress = (config = {}) => {
  const {
    scalePressed = DEFAULT_CONFIG.scalePressed,
    scaleResting = DEFAULT_CONFIG.scaleResting,
    useSpring: shouldUseSpring = DEFAULT_CONFIG.useSpring,
    springConfig = DEFAULT_CONFIG.springConfig,
    timingDuration = DEFAULT_CONFIG.timingDuration,
  } = config;

  // Shared value for scale animation
  const scale = useSharedValue(scaleResting);

  // Track if reduce motion is enabled
  const reduceMotion = useSharedValue(false);

  // Check accessibility settings once on mount
  // Note: We check this lazily on first press for better performance
  const checkReduceMotion = useCallback(async () => {
    try {
      const isReduceMotionEnabled = await AccessibilityInfo.isReduceMotionEnabled();
      reduceMotion.value = isReduceMotionEnabled;
    } catch {
      // Silently fail - assume motion is allowed
      reduceMotion.value = false;
    }
  }, [reduceMotion]);

  // Handle press in - scale down
  const onPressIn = useCallback(() => {
    checkReduceMotion();

    // Skip animation if reduce motion is enabled
    if (reduceMotion.value) {
      return;
    }

    if (shouldUseSpring) {
      scale.value = withSpring(scalePressed, springConfig);
    } else {
      scale.value = withTiming(scalePressed, { duration: timingDuration });
    }
  }, [
    checkReduceMotion,
    reduceMotion,
    scale,
    scalePressed,
    shouldUseSpring,
    springConfig,
    timingDuration,
  ]);

  // Handle press out - scale back to resting
  const onPressOut = useCallback(() => {
    // Skip animation if reduce motion is enabled
    if (reduceMotion.value) {
      return;
    }

    if (shouldUseSpring) {
      scale.value = withSpring(scaleResting, springConfig);
    } else {
      scale.value = withTiming(scaleResting, { duration: timingDuration });
    }
  }, [reduceMotion, scale, scaleResting, shouldUseSpring, springConfig, timingDuration]);

  // Animated style with scale transform
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  // Combined press handlers for convenience
  const pressHandlers = {
    onPressIn,
    onPressOut,
  };

  return {
    onPressIn,
    onPressOut,
    animatedStyle,
    pressHandlers,
  };
};

export default useAnimatedPress;
