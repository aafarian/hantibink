/**
 * Custom transition configurations for React Navigation stack navigators.
 * Uses theme animation tokens for consistent motion throughout the app.
 *
 * @module navigation/transitions
 */
import { Easing, Platform } from 'react-native';
import { theme } from '../styles/theme';

/**
 * Creates a cubic bezier easing function from theme easing config.
 * @param {Object} config - Easing config with x1, y1, x2, y2
 * @returns {function} Easing function
 */
const createBezier = config => Easing.bezier(config.x1, config.y1, config.x2, config.y2);

/**
 * TransitionSpec for fade animations using timing.
 * Uses theme.animation.durations.transition for duration.
 */
export const fadeTransitionSpec = {
  animation: 'timing',
  config: {
    duration: theme.animation.durations.transition,
    easing: createBezier(theme.animation.easings.standard),
  },
};

/**
 * TransitionSpec for slide animations using timing.
 * Spring animations can block touches while settling, so we use
 * timing for reliable touch responsiveness after transitions.
 */
export const slideTransitionSpec = {
  animation: 'timing',
  config: {
    duration: theme.animation.durations.slow,
    easing: createBezier(theme.animation.easings.decelerate),
  },
};

/**
 * Combined fade+slide transition spec for screen transitions.
 * Uses timing for fade (opacity) and spring for slide (position).
 */
export const fadeSlideTransitionSpec = {
  open: slideTransitionSpec,
  close: slideTransitionSpec,
};

/**
 * Card style interpolator for fade transitions.
 * Animates opacity based on screen progress.
 * @param {Object} params - Interpolation params from React Navigation
 * @returns {Object} Card style with opacity
 */
export const forFade = ({ current }) => ({
  cardStyle: {
    opacity: current.progress,
  },
});

/**
 * Card style interpolator for horizontal slide transitions.
 * Slides screen in from right with slight fade.
 * @param {Object} params - Interpolation params from React Navigation
 * @returns {Object} Card style with transform and opacity
 */
export const forSlide = ({ current, layouts }) => ({
  cardStyle: {
    transform: [
      {
        translateX: current.progress.interpolate({
          inputRange: [0, 1],
          outputRange: [layouts.screen.width, 0],
        }),
      },
    ],
    opacity: current.progress.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0.3, 0.8, 1],
    }),
  },
});

/**
 * Card style interpolator for combined fade and slide.
 * Creates a smooth entrance with both position and opacity animation.
 * @param {Object} params - Interpolation params from React Navigation
 * @returns {Object} Card style with transform and opacity
 */
export const forFadeSlide = ({ current, layouts }) => ({
  cardStyle: {
    transform: [
      {
        translateX: current.progress.interpolate({
          inputRange: [0, 1],
          outputRange: [layouts.screen.width * 0.3, 0],
        }),
      },
    ],
    opacity: current.progress,
  },
});

/**
 * Card style interpolator for vertical slide (modal-style).
 * Slides screen up from bottom with fade.
 * @param {Object} params - Interpolation params from React Navigation
 * @returns {Object} Card style with transform and opacity
 */
export const forVerticalSlide = ({ current, layouts }) => ({
  cardStyle: {
    transform: [
      {
        translateY: current.progress.interpolate({
          inputRange: [0, 1],
          outputRange: [layouts.screen.height, 0],
        }),
      },
    ],
    opacity: current.progress.interpolate({
      inputRange: [0, 0.3, 1],
      outputRange: [0, 0.7, 1],
    }),
  },
});

/**
 * Card style interpolator for iOS-style horizontal slide with parallax and shadow.
 * Creates a native iOS feel with the previous screen sliding slightly left
 * and a shadow appearing under the top card during the gesture.
 * @param {Object} params - Interpolation params from React Navigation
 * @returns {Object} Card and overlay styles with transforms, opacity, and shadow
 */
export const forHorizontalIOS = ({ current, next, layouts }) => {
  const translateFocused = current.progress.interpolate({
    inputRange: [0, 1],
    outputRange: [layouts.screen.width, 0],
  });

  // Parallax effect: previous screen slides left slightly (30% of screen width)
  const translateUnfocused = next
    ? next.progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, layouts.screen.width * -0.3],
      })
    : 0;

  // Shadow opacity during gesture
  const shadowOpacity = current.progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.25],
  });

  // Overlay on previous screen during transition
  const overlayOpacity = next
    ? next.progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 0.1],
      })
    : 0;

  return {
    cardStyle: {
      transform: [{ translateX: translateFocused }, { translateX: translateUnfocused }],
      // Add shadow to the card (iOS only, Android uses elevation)
      ...(Platform.OS === 'ios' && {
        shadowColor: theme.colors.shadow,
        shadowOffset: { width: -3, height: 0 },
        shadowOpacity,
        shadowRadius: 8,
      }),
      ...(Platform.OS === 'android' && {
        elevation: current.progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 8],
        }),
      }),
    },
    overlayStyle: {
      opacity: overlayOpacity,
      backgroundColor: theme.colors.background.dark,
    },
  };
};

/**
 * iOS back gesture configuration with enhanced response distance.
 * Increases the hit area for easier gesture triggering.
 */
export const iosGestureConfig = {
  // Increase gesture response distance for easier back gesture triggering
  // Default is ~25, we increase to 50 for a larger hit area
  gestureResponseDistance: 50,
  // Use full screen width for gesture on iOS
  ...(Platform.OS === 'ios' && {
    fullScreenGestureEnabled: true,
  }),
};

/**
 * Factory function to create screen options with custom transitions.
 * Use this to apply consistent transitions across stack navigators.
 *
 * @param {Object} options - Configuration options
 * @param {string} options.variant - Transition variant: 'fade', 'slide', 'fadeSlide', 'vertical', 'horizontalIOS'
 * @param {boolean} options.enhancedGesture - Enable enhanced iOS back gesture (default: true for horizontal variants)
 * @returns {Object} Screen options object for React Navigation
 *
 * @example
 * <Stack.Navigator screenOptions={createScreenOptions({ variant: 'fadeSlide' })}>
 *   <Stack.Screen name="Home" component={HomeScreen} />
 * </Stack.Navigator>
 */
export const createScreenOptions = ({ variant = 'fadeSlide', enhancedGesture = true } = {}) => {
  const cardStyleInterpolators = {
    fade: forFade,
    slide: forSlide,
    fadeSlide: forFadeSlide,
    vertical: forVerticalSlide,
    horizontalIOS: forHorizontalIOS,
  };

  const transitionSpecs = {
    fade: {
      open: fadeTransitionSpec,
      close: fadeTransitionSpec,
    },
    slide: fadeSlideTransitionSpec,
    fadeSlide: fadeSlideTransitionSpec,
    vertical: fadeSlideTransitionSpec,
    horizontalIOS: fadeSlideTransitionSpec,
  };

  const isVertical = variant === 'vertical';
  const isHorizontal = !isVertical;

  // Base options
  const options = {
    transitionSpec: transitionSpecs[variant],
    cardStyleInterpolator: cardStyleInterpolators[variant],
    gestureEnabled: true,
    gestureDirection: isVertical ? 'vertical' : 'horizontal',
  };

  // Add enhanced gesture config for horizontal transitions on iOS
  if (enhancedGesture && isHorizontal && Platform.OS === 'ios') {
    options.gestureResponseDistance = iosGestureConfig.gestureResponseDistance;
  }

  return options;
};

/**
 * Pre-configured screen options for common transition patterns.
 */
export const screenOptions = {
  /** Fade-only transition for subtle screen changes */
  fade: createScreenOptions({ variant: 'fade' }),
  /** Horizontal slide transition for standard navigation */
  slide: createScreenOptions({ variant: 'slide' }),
  /** Combined fade and slide for smooth entrances (default) */
  fadeSlide: createScreenOptions({ variant: 'fadeSlide' }),
  /** Vertical slide for modal-style screens */
  vertical: createScreenOptions({ variant: 'vertical' }),
  /** iOS-style horizontal slide with parallax and shadow (recommended for main stacks) */
  horizontalIOS: createScreenOptions({ variant: 'horizontalIOS' }),
};

/**
 * Default export: fadeSlide transition config
 * This is the recommended transition for most stack navigators.
 */
export default {
  transitionSpec: fadeSlideTransitionSpec,
  cardStyleInterpolator: forFadeSlide,
  gestureEnabled: true,
};
