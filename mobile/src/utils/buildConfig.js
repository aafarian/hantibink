/**
 * Build configuration utilities
 * Helps detect if we're in development, preview, or production builds
 */

/**
 * Check if we're in a development environment
 * This includes local development with Metro bundler
 */
export const isDevelopment = __DEV__;

/**
 * Check if we're in a preview/internal build
 * Preview builds are internal distribution builds for testing
 * They use production API but should show developer options
 */
export const isPreviewBuild = () => {
  // Explicit per-profile flag set in eas.json — NEVER inferred from the API
  // URL: production builds point at the same production API, and the old
  // heuristic made store builds show Developer Settings
  return !__DEV__ && process.env.EXPO_PUBLIC_BUILD_PROFILE === 'preview';
};

/**
 * Check if developer options should be shown
 * Shows in both development and preview builds
 */
export const shouldShowDeveloperOptions = () => {
  return isDevelopment || isPreviewBuild();
};

/**
 * Get the current build environment
 */
export const getBuildEnvironment = () => {
  if (isDevelopment) {
    return 'development';
  }
  if (isPreviewBuild()) {
    return 'preview';
  }
  return 'production';
};

/**
 * Check if we're in a production build (App Store/Play Store)
 */
export const isProduction = () => {
  return !isDevelopment && !isPreviewBuild();
};

export default {
  isDevelopment,
  isPreviewBuild,
  shouldShowDeveloperOptions,
  getBuildEnvironment,
  isProduction,
};
