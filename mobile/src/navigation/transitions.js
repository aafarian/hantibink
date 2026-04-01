/**
 * Custom transition configurations for React Navigation stack navigators.
 * Uses theme animation tokens for consistent motion throughout the app.
 *
 * @module navigation/transitions
 */
import { Easing } from 'react-native-reanimated';
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
 * TransitionSpec for slide animations using spring physics.
 * Uses theme.animation.springs.smooth for spring config.
 */
export const slideTransitionSpec = {
  animation: 'spring',
  config: {
    ...theme.animation.springs.smooth,
    overshootClamping: false,
    restDisplacementThreshold: 0.01,
    restSpeedThreshold: 0.01,
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
 * Factory function to create screen options with custom transitions.
 * Use this to apply consistent transitions across stack navigators.
 *
 * @param {Object} options - Configuration options
 * @param {string} options.variant - Transition variant: 'fade', 'slide', 'fadeSlide', 'vertical'
 * @returns {Object} Screen options object for React Navigation
 *
 * @example
 * <Stack.Navigator screenOptions={createScreenOptions({ variant: 'fadeSlide' })}>
 *   <Stack.Screen name="Home" component={HomeScreen} />
 * </Stack.Navigator>
 */
export const createScreenOptions = ({ variant = 'fadeSlide' } = {}) => {
  const cardStyleInterpolators = {
    fade: forFade,
    slide: forSlide,
    fadeSlide: forFadeSlide,
    vertical: forVerticalSlide,
  };

  const transitionSpecs = {
    fade: {
      open: fadeTransitionSpec,
      close: fadeTransitionSpec,
    },
    slide: fadeSlideTransitionSpec,
    fadeSlide: fadeSlideTransitionSpec,
    vertical: fadeSlideTransitionSpec,
  };

  return {
    transitionSpec: transitionSpecs[variant],
    cardStyleInterpolator: cardStyleInterpolators[variant],
    gestureEnabled: true,
    gestureDirection: variant === 'vertical' ? 'vertical' : 'horizontal',
  };
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
