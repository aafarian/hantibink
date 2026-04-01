/**
 * Shared Element Transition Utility
 *
 * Provides utilities for creating shared element transitions using
 * react-native-reanimated's SharedTransition API.
 *
 * @module utils/sharedElementTransition
 *
 * @example
 * // Basic usage with profile photo morphing between screens:
 *
 * // On source screen (e.g., SwipeCard):
 * import Animated from 'react-native-reanimated';
 * import { createSharedTag, defaultTransition } from '../utils/sharedElementTransition';
 *
 * const tag = createSharedTag('profile-photo', userId);
 *
 * <Animated.Image
 *   source={{ uri: photoUrl }}
 *   sharedTransitionTag={tag}
 *   sharedTransitionStyle={defaultTransition}
 * />
 *
 * // On destination screen (e.g., ProfileScreen):
 * // Use the SAME tag and transition for the matching element
 *
 * <Animated.Image
 *   source={{ uri: photoUrl }}
 *   sharedTransitionTag={tag}
 *   sharedTransitionStyle={defaultTransition}
 * />
 */

import { SharedTransition, withSpring, withTiming } from 'react-native-reanimated';
import { theme } from '../styles/theme';

/**
 * Creates a unique shared element tag for transition matching.
 * Tags must be unique across the app and match between source and destination.
 *
 * @param {string} prefix - Category prefix (e.g., 'profile-photo', 'card-image')
 * @param {string|number} id - Unique identifier (e.g., userId, photoId)
 * @param {number} [index] - Optional index for multiple elements (e.g., photo gallery)
 * @returns {string} Unique tag string for sharedTransitionTag prop
 *
 * @example
 * // Single profile photo
 * createSharedTag('profile-photo', 'user-123')
 * // => 'profile-photo-user-123'
 *
 * // Photo in gallery
 * createSharedTag('gallery-photo', 'user-123', 2)
 * // => 'gallery-photo-user-123-2'
 */
export const createSharedTag = (prefix, id, index) => {
  if (index !== undefined) {
    return `${prefix}-${id}-${index}`;
  }
  return `${prefix}-${id}`;
};

/**
 * Standard shared element tag prefixes used throughout the app.
 * Use these constants to ensure consistency.
 */
export const SharedTagPrefixes = {
  /** Primary profile photo on cards and profile screens */
  PROFILE_PHOTO: 'profile-photo',
  /** Gallery photos in profile */
  GALLERY_PHOTO: 'gallery-photo',
  /** User name text element */
  USER_NAME: 'user-name',
  /** Profile card container */
  PROFILE_CARD: 'profile-card',
  /** Chat avatar in messages */
  CHAT_AVATAR: 'chat-avatar',
};

/**
 * Creates a spring-based shared transition configuration.
 * Spring animations feel more natural for element morphing.
 *
 * @param {Object} [springConfig] - Custom spring configuration
 * @param {number} [springConfig.damping] - Spring damping (default: 15)
 * @param {number} [springConfig.stiffness] - Spring stiffness (default: 120)
 * @param {number} [springConfig.mass] - Spring mass (default: 0.8)
 * @returns {SharedTransition} Configured SharedTransition object
 */
export const createSpringTransition = (springConfig = {}) => {
  const config = {
    ...theme.animation.springs.smooth,
    ...springConfig,
  };

  return SharedTransition.custom(values => {
    'worklet';
    return {
      originX: withSpring(values.targetOriginX, config),
      originY: withSpring(values.targetOriginY, config),
      width: withSpring(values.targetWidth, config),
      height: withSpring(values.targetHeight, config),
    };
  });
};

/**
 * Creates a timing-based shared transition configuration.
 * Use for more controlled, predictable animations.
 *
 * @param {Object} [options] - Timing options
 * @param {number} [options.duration] - Animation duration in ms (default: 300)
 * @returns {SharedTransition} Configured SharedTransition object
 */
export const createTimingTransition = (options = {}) => {
  const duration = options.duration ?? theme.animation.durations.slow;

  return SharedTransition.custom(values => {
    'worklet';
    return {
      originX: withTiming(values.targetOriginX, { duration }),
      originY: withTiming(values.targetOriginY, { duration }),
      width: withTiming(values.targetWidth, { duration }),
      height: withTiming(values.targetHeight, { duration }),
    };
  });
};

/**
 * Creates a transition with different configs for progress and regress (going back).
 * Useful for asymmetric transitions where forward and back feel different.
 *
 * @param {Object} [options] - Configuration options
 * @param {Object} [options.progressSpring] - Spring config for forward navigation
 * @param {Object} [options.regressSpring] - Spring config for back navigation
 * @returns {SharedTransition} Configured SharedTransition object
 */
export const createAsymmetricTransition = (options = {}) => {
  const progressConfig = {
    ...theme.animation.springs.smooth,
    ...options.progressSpring,
  };

  const regressConfig = {
    ...theme.animation.springs.stiff,
    ...options.regressSpring,
  };

  return SharedTransition.custom(values => {
    'worklet';
    // Use stiffer config for going back
    const config = values.progress > 0 ? progressConfig : regressConfig;

    return {
      originX: withSpring(values.targetOriginX, config),
      originY: withSpring(values.targetOriginY, config),
      width: withSpring(values.targetWidth, config),
      height: withSpring(values.targetHeight, config),
    };
  });
};

/**
 * Transition preset configurations for common use cases.
 */
export const TransitionPresets = {
  /** Smooth spring for profile photo morphing */
  smooth: createSpringTransition(theme.animation.springs.smooth),

  /** Bouncy spring for playful interactions */
  bouncy: createSpringTransition(theme.animation.springs.bouncy),

  /** Stiff spring for snappy feedback */
  stiff: createSpringTransition(theme.animation.springs.stiff),

  /** Gentle spring for subtle transitions */
  gentle: createSpringTransition(theme.animation.springs.gentle),

  /** Timing-based for predictable animations */
  linear: createTimingTransition({ duration: theme.animation.durations.slow }),
};

/**
 * Default shared transition - smooth spring animation.
 * Use this for most shared element transitions.
 */
export const defaultTransition = TransitionPresets.smooth;

/**
 * Helper hook to generate consistent shared element props.
 * Returns an object spread for Animated.Image or Animated.View.
 *
 * @param {string} prefix - Tag prefix from SharedTagPrefixes
 * @param {string|number} id - Unique identifier
 * @param {Object} [options] - Configuration options
 * @param {number} [options.index] - Optional index for galleries
 * @param {SharedTransition} [options.transition] - Custom transition (default: smooth)
 * @returns {Object} Props object with sharedTransitionTag and sharedTransitionStyle
 *
 * @example
 * const sharedProps = getSharedElementProps(
 *   SharedTagPrefixes.PROFILE_PHOTO,
 *   user.id,
 *   { transition: TransitionPresets.bouncy }
 * );
 *
 * <Animated.Image {...sharedProps} source={{ uri: photoUrl }} />
 */
export const getSharedElementProps = (prefix, id, options = {}) => {
  const { index, transition = defaultTransition } = options;

  return {
    sharedTransitionTag: createSharedTag(prefix, id, index),
    sharedTransitionStyle: transition,
  };
};

/**
 * Creates a factory function for generating shared element props
 * with consistent settings for a specific component/screen.
 *
 * @param {Object} defaults - Default configuration
 * @param {string} defaults.prefix - Default tag prefix
 * @param {SharedTransition} [defaults.transition] - Default transition
 * @returns {Function} Factory function that takes (id, options) and returns props
 *
 * @example
 * // Create factory for profile photos in SwipeCard
 * const getProfilePhotoProps = createSharedElementFactory({
 *   prefix: SharedTagPrefixes.PROFILE_PHOTO,
 *   transition: TransitionPresets.bouncy,
 * });
 *
 * // Use in component
 * <Animated.Image {...getProfilePhotoProps(user.id)} source={{ uri: photoUrl }} />
 */
export const createSharedElementFactory = defaults => {
  return (id, options = {}) =>
    getSharedElementProps(defaults.prefix, id, {
      transition: defaults.transition || defaultTransition,
      ...options,
    });
};

export default {
  createSharedTag,
  SharedTagPrefixes,
  createSpringTransition,
  createTimingTransition,
  createAsymmetricTransition,
  TransitionPresets,
  defaultTransition,
  getSharedElementProps,
  createSharedElementFactory,
};
