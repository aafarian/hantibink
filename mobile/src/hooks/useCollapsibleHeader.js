import { useCallback, useEffect, useRef } from 'react';
import { AccessibilityInfo } from 'react-native';
import {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { theme } from '../styles/theme';

/**
 * Default configuration for collapsible header behavior.
 */
const DEFAULT_CONFIG = {
  /** Maximum (expanded) header height */
  maxHeight: 100,
  /** Minimum (collapsed) header height */
  minHeight: 50,
  /** Scroll distance required to fully collapse the header */
  collapseThreshold: 80,
  /** Velocity threshold to trigger snap animation (pixels/second) */
  velocityThreshold: 500,
  /** Duration for snap animations */
  snapDuration: theme.animation.durations.normal,
};

/**
 * Custom hook that provides collapsible header functionality based on scroll position.
 * Uses react-native-reanimated for smooth, performant animations on the UI thread.
 *
 * Features:
 * - Header collapses smoothly as user scrolls down
 * - Header expands when scrolling up
 * - Respects reduce motion accessibility setting
 * - Works with FlatList, ScrollView, and any scrollable component
 * - Supports configurable heights and thresholds
 *
 * @param {Object} [config] - Optional configuration to customize header behavior
 * @param {number} [config.maxHeight=100] - Maximum (expanded) header height
 * @param {number} [config.minHeight=50] - Minimum (collapsed) header height
 * @param {number} [config.collapseThreshold=80] - Scroll distance to fully collapse
 * @param {number} [config.velocityThreshold=500] - Velocity to trigger snap (px/s)
 * @param {number} [config.snapDuration=200] - Duration for snap animations in ms
 *
 * @returns {Object} Animation values and handlers
 * @returns {Object} returns.animatedHeaderStyle - Animated style with height and opacity
 * @returns {Function} returns.scrollHandler - Scroll handler to attach to scrollable component
 * @returns {Object} returns.headerHeight - Shared value for header height (for custom use)
 * @returns {Object} returns.scrollY - Shared value for scroll position (for custom use)
 *
 * @example
 * // Basic usage with FlatList
 * const { animatedHeaderStyle, scrollHandler } = useCollapsibleHeader();
 * return (
 *   <>
 *     <Animated.View style={[styles.header, animatedHeaderStyle]}>
 *       <Text>Messages</Text>
 *     </Animated.View>
 *     <Animated.FlatList
 *       data={messages}
 *       onScroll={scrollHandler}
 *       scrollEventThrottle={16}
 *       renderItem={renderItem}
 *     />
 *   </>
 * );
 *
 * @example
 * // With custom configuration
 * const { animatedHeaderStyle, scrollHandler } = useCollapsibleHeader({
 *   maxHeight: 120,
 *   minHeight: 60,
 *   collapseThreshold: 100,
 * });
 */
const useCollapsibleHeader = (config = {}) => {
  const {
    maxHeight = DEFAULT_CONFIG.maxHeight,
    minHeight = DEFAULT_CONFIG.minHeight,
    collapseThreshold = DEFAULT_CONFIG.collapseThreshold,
    velocityThreshold = DEFAULT_CONFIG.velocityThreshold,
    snapDuration = DEFAULT_CONFIG.snapDuration,
  } = config;

  // Shared values for smooth animations on UI thread
  const scrollY = useSharedValue(0);
  const headerHeight = useSharedValue(maxHeight);
  const previousScrollY = useSharedValue(0);
  const isScrollingDown = useSharedValue(false);

  // Track reduce motion setting
  const reduceMotion = useSharedValue(false);
  const reduceMotionChecked = useRef(false);

  // Check accessibility settings on mount
  useEffect(() => {
    const checkReduceMotion = async () => {
      if (reduceMotionChecked.current) return;
      reduceMotionChecked.current = true;

      try {
        const isEnabled = await AccessibilityInfo.isReduceMotionEnabled();
        reduceMotion.value = isEnabled;
      } catch {
        // Silently fail - assume motion is allowed
        reduceMotion.value = false;
      }
    };

    checkReduceMotion();

    // Listen for changes to reduce motion setting
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', isEnabled => {
      reduceMotion.value = isEnabled;
    });

    return () => {
      subscription?.remove();
    };
  }, [reduceMotion]);

  /**
   * Animated scroll handler that updates header height based on scroll position.
   * Runs on UI thread for smooth 60fps animations.
   */
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: event => {
      'worklet';
      const currentScrollY = event.contentOffset.y;

      // Determine scroll direction
      isScrollingDown.value = currentScrollY > previousScrollY.value;
      const scrollDelta = currentScrollY - previousScrollY.value;

      // Update previous scroll position
      previousScrollY.value = currentScrollY;

      // Don't animate header when at the top (bouncing)
      if (currentScrollY <= 0) {
        headerHeight.value = maxHeight;
        scrollY.value = 0;
        return;
      }

      // Update scroll position
      scrollY.value = currentScrollY;

      // If reduce motion is enabled, snap instantly
      if (reduceMotion.value) {
        headerHeight.value = currentScrollY > collapseThreshold / 2 ? minHeight : maxHeight;
        return;
      }

      // Calculate new header height based on scroll position
      // When scrolling down, collapse the header
      // When scrolling up, expand the header
      if (isScrollingDown.value) {
        // Collapse proportionally to scroll
        const newHeight = interpolate(
          currentScrollY,
          [0, collapseThreshold],
          [maxHeight, minHeight],
          Extrapolation.CLAMP
        );
        headerHeight.value = newHeight;
      } else {
        // Expand when scrolling up (if not at the top)
        const expansionAmount = Math.abs(scrollDelta) * 0.5;
        const newHeight = Math.min(maxHeight, headerHeight.value + expansionAmount);
        headerHeight.value = newHeight;
      }
    },
    onEndDrag: event => {
      'worklet';
      // Skip snap animation if reduce motion is enabled
      if (reduceMotion.value) return;

      const velocity = event.velocity?.y || 0;
      const currentHeight = headerHeight.value;
      const midpoint = (maxHeight + minHeight) / 2;

      // Snap to fully expanded or collapsed based on velocity or position
      let targetHeight;
      if (Math.abs(velocity) > velocityThreshold) {
        // Use velocity to determine snap direction
        targetHeight = velocity > 0 ? minHeight : maxHeight;
      } else {
        // Use current position to determine snap direction
        targetHeight = currentHeight < midpoint ? minHeight : maxHeight;
      }

      headerHeight.value = withTiming(targetHeight, { duration: snapDuration });
    },
    onMomentumEnd: () => {
      'worklet';
      // Skip snap animation if reduce motion is enabled
      if (reduceMotion.value) return;

      // Final snap after momentum scroll ends
      const currentHeight = headerHeight.value;
      const midpoint = (maxHeight + minHeight) / 2;

      if (currentHeight > minHeight && currentHeight < maxHeight) {
        const targetHeight = currentHeight < midpoint ? minHeight : maxHeight;
        headerHeight.value = withTiming(targetHeight, { duration: snapDuration });
      }
    },
  });

  /**
   * Animated style for the header.
   * Includes height and opacity transitions.
   */
  const animatedHeaderStyle = useAnimatedStyle(() => {
    // Calculate opacity based on header height
    const opacity = interpolate(
      headerHeight.value,
      [minHeight, maxHeight],
      [0.9, 1],
      Extrapolation.CLAMP
    );

    return {
      height: headerHeight.value,
      opacity,
    };
  });

  /**
   * Animated style for header content (title, etc.).
   * Provides additional transforms for content within the header.
   */
  const animatedContentStyle = useAnimatedStyle(() => {
    // Scale down content slightly when collapsed
    const scale = interpolate(
      headerHeight.value,
      [minHeight, maxHeight],
      [0.85, 1],
      Extrapolation.CLAMP
    );

    // Translate content up slightly when collapsed
    const translateY = interpolate(
      headerHeight.value,
      [minHeight, maxHeight],
      [-5, 0],
      Extrapolation.CLAMP
    );

    return {
      transform: [{ scale }, { translateY }],
    };
  });

  /**
   * Reset header to expanded state.
   * Useful when navigating to a new screen or refreshing content.
   */
  const resetHeader = useCallback(() => {
    'worklet';
    scrollY.value = 0;
    previousScrollY.value = 0;
    if (reduceMotion.value) {
      headerHeight.value = maxHeight;
    } else {
      headerHeight.value = withTiming(maxHeight, { duration: snapDuration });
    }
  }, [headerHeight, maxHeight, previousScrollY, reduceMotion, scrollY, snapDuration]);

  return {
    animatedHeaderStyle,
    animatedContentStyle,
    scrollHandler,
    headerHeight,
    scrollY,
    resetHeader,
    // Expose config for reference
    config: {
      maxHeight,
      minHeight,
      collapseThreshold,
    },
  };
};

export default useCollapsibleHeader;
