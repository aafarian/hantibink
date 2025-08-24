/**
 * Build configuration utilities
 * Helps detect if we're in development, preview, or production builds
 */

import Constants from 'expo-constants';

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
  // In preview builds:
  // - __DEV__ is false (production bundle)
  // - distribution is 'internal'
  // - API URL points to production

  // Check if we have the production API URL but it's an internal build
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || '';
  const isInternalDistribution = Constants.expoConfig?.distribution === 'internal';
  const hasProductionApi = apiUrl.includes('hantibink-api');

  return !__DEV__ && (isInternalDistribution || hasProductionApi);
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
