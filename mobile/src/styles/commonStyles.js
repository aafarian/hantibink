import { StyleSheet } from 'react-native';
import { theme } from './theme';

export const commonStyles = StyleSheet.create({
  // Layout
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.secondary,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spaceBetween: {
    justifyContent: 'space-between',
  },

  // Typography
  textPrimary: {
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.primary,
    fontSize: theme.typography.sizes.md,
  },
  textSecondary: {
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.secondary,
    fontSize: theme.typography.sizes.md,
  },
  textMuted: {
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.muted,
    fontSize: theme.typography.sizes.sm,
  },
  textWhite: {
    color: theme.colors.text.white,
  },
  textBold: {
    fontFamily: theme.typography.fontFamily.bold,
    fontWeight: theme.typography.weights.bold,
  },
  textMedium: {
    fontFamily: theme.typography.fontFamily.medium,
    fontWeight: theme.typography.weights.medium,
  },

  // Headings
  h1: {
    fontFamily: theme.typography.fontFamily.bold,
    fontSize: theme.typography.sizes.huge,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text.primary,
    lineHeight: theme.typography.sizes.huge * theme.typography.lineHeights.tight,
  },
  h2: {
    fontFamily: theme.typography.fontFamily.bold,
    fontSize: theme.typography.sizes.xxxl,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text.primary,
    lineHeight: theme.typography.sizes.xxxl * theme.typography.lineHeights.tight,
  },
  h3: {
    fontFamily: theme.typography.fontFamily.semibold,
    fontSize: theme.typography.sizes.xxl,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text.primary,
    lineHeight: theme.typography.sizes.xxl * theme.typography.lineHeights.tight,
  },

  // Buttons
  buttonPrimary: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.medium,
  },
  buttonSecondary: {
    backgroundColor: theme.colors.secondary,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.medium,
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.text.white,
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
  },
  buttonTextOutline: {
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.primary,
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
  },

  // Cards
  card: {
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    ...theme.shadows.medium,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },

  // Loading states
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.typography.sizes.lg,
    color: theme.colors.text.secondary,
    textAlign: 'center',
  },

  // Error states
  errorText: {
    fontSize: theme.typography.sizes.lg,
    color: theme.colors.status.error,
    textAlign: 'center',
  },

  // Text alignment
  textCenter: {
    textAlign: 'center',
  },
  textLeft: {
    textAlign: 'left',
  },
  textRight: {
    textAlign: 'right',
  },

  // Spacing
  mb_xs: { marginBottom: theme.spacing.xs },
  mb_sm: { marginBottom: theme.spacing.sm },
  mb_md: { marginBottom: theme.spacing.md },
  mb_lg: { marginBottom: theme.spacing.lg },
  mb_xl: { marginBottom: theme.spacing.xl },

  mt_xs: { marginTop: theme.spacing.xs },
  mt_sm: { marginTop: theme.spacing.sm },
  mt_md: { marginTop: theme.spacing.md },
  mt_lg: { marginTop: theme.spacing.lg },
  mt_xl: { marginTop: theme.spacing.xl },

  mx_xs: { marginHorizontal: theme.spacing.xs },
  mx_sm: { marginHorizontal: theme.spacing.sm },
  mx_md: { marginHorizontal: theme.spacing.md },
  mx_lg: { marginHorizontal: theme.spacing.lg },
  mx_xl: { marginHorizontal: theme.spacing.xl },

  p_xs: { padding: theme.spacing.xs },
  p_sm: { padding: theme.spacing.sm },
  p_md: { padding: theme.spacing.md },
  p_lg: { padding: theme.spacing.lg },
  p_xl: { padding: theme.spacing.xl },
  p_xxl: { padding: theme.spacing.xxl },
  p_huge: { padding: theme.spacing.huge },

  // Animation containers
  /**
   * Base container for animated content with fade/scale enter animations.
   * Use with Animated.View and opacity/scale transforms.
   */
  animatedContainer: {
    flex: 1,
  },
  /**
   * Container for staggered list item animations.
   * Items start invisible and animate in sequence.
   */
  animatedListItem: {
    opacity: 1,
  },

  // Pressable feedback styles
  /**
   * Base style for pressable elements with scale feedback.
   * Apply scale transform on press using theme.animation.scales.pressed.
   */
  pressableFeedback: {
    overflow: 'hidden',
  },
  /**
   * Subtle pressable style for small interactive elements.
   * Use theme.animation.scales.subtlePress for smaller elements.
   */
  pressableFeedbackSubtle: {
    overflow: 'hidden',
  },

  // Skeleton placeholder styles
  /**
   * Base skeleton loading placeholder with animated shimmer.
   * Use with LinearGradient and translateX animation.
   */
  skeleton: {
    backgroundColor: theme.colors.border.light,
    overflow: 'hidden',
  },
  skeletonRound: {
    backgroundColor: theme.colors.border.light,
    overflow: 'hidden',
    borderRadius: theme.borderRadius.round,
  },
  skeletonText: {
    backgroundColor: theme.colors.border.light,
    height: 16,
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
  },
  skeletonTextSmall: {
    backgroundColor: theme.colors.border.light,
    height: 12,
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
  },
  skeletonAvatar: {
    backgroundColor: theme.colors.border.light,
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.round,
    overflow: 'hidden',
  },
  skeletonButton: {
    backgroundColor: theme.colors.border.light,
    height: 44,
    borderRadius: theme.borderRadius.xxl,
    overflow: 'hidden',
  },
  skeletonCard: {
    backgroundColor: theme.colors.border.light,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    overflow: 'hidden',
  },

  // Focus ring styles
  /**
   * Focus ring for accessibility. Apply when element is focused.
   * Use with animated border color/width for smooth transitions.
   */
  focusRing: {
    borderWidth: 2,
    borderColor: theme.colors.secondary,
    borderRadius: theme.borderRadius.md,
  },
  focusRingPrimary: {
    borderWidth: 2,
    borderColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
  },
  focusRingRound: {
    borderWidth: 2,
    borderColor: theme.colors.secondary,
    borderRadius: theme.borderRadius.round,
  },
});

/**
 * Animation style helpers for use with react-native-reanimated.
 * These functions return style objects for common animation patterns.
 */
export const animationStyles = {
  /**
   * Creates enter animation style with fade and scale.
   * @param {number} opacity - Current opacity value (0-1)
   * @param {number} scale - Current scale value
   * @returns {Object} Style object with opacity and transform
   */
  fadeScaleIn: (opacity, scale) => ({
    opacity,
    transform: [{ scale }],
  }),

  /**
   * Creates slide animation style for horizontal movement.
   * @param {number} translateX - Current translateX value
   * @param {number} opacity - Optional opacity value (0-1), defaults to 1
   * @returns {Object} Style object with opacity and transform
   */
  slideHorizontal: (translateX, opacity = 1) => ({
    opacity,
    transform: [{ translateX }],
  }),

  /**
   * Creates slide animation style for vertical movement.
   * @param {number} translateY - Current translateY value
   * @param {number} opacity - Optional opacity value (0-1), defaults to 1
   * @returns {Object} Style object with opacity and transform
   */
  slideVertical: (translateY, opacity = 1) => ({
    opacity,
    transform: [{ translateY }],
  }),

  /**
   * Creates press feedback style with scale transform.
   * @param {number} scale - Current scale value (use theme.animation.scales)
   * @returns {Object} Style object with transform
   */
  pressScale: scale => ({
    transform: [{ scale }],
  }),

  /**
   * Creates shimmer animation style for skeleton loaders.
   * @param {number} translateX - Current translateX value for shimmer effect
   * @returns {Object} Style object with transform
   */
  shimmer: translateX => ({
    transform: [{ translateX }],
  }),

  /**
   * Creates rotation animation style.
   * @param {string} rotate - Rotation value (e.g., '45deg', '180deg')
   * @returns {Object} Style object with transform
   */
  rotate: rotate => ({
    transform: [{ rotate }],
  }),

  /**
   * Creates combined transform animation style.
   * @param {Object} transforms - Object with transform values
   * @param {number} [transforms.scale] - Scale value
   * @param {number} [transforms.translateX] - TranslateX value
   * @param {number} [transforms.translateY] - TranslateY value
   * @param {string} [transforms.rotate] - Rotation value
   * @param {number} [transforms.opacity] - Opacity value
   * @returns {Object} Style object with opacity and transforms
   */
  combined: ({ scale, translateX, translateY, rotate, opacity = 1 }) => {
    const transforms = [];
    if (scale !== undefined) transforms.push({ scale });
    if (translateX !== undefined) transforms.push({ translateX });
    if (translateY !== undefined) transforms.push({ translateY });
    if (rotate !== undefined) transforms.push({ rotate });
    return {
      opacity,
      transform: transforms.length > 0 ? transforms : undefined,
    };
  },
};
