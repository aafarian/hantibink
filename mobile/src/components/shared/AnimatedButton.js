import React, { useCallback, useMemo } from 'react';
import { Text, StyleSheet, ActivityIndicator } from 'react-native';
import Animated from 'react-native-reanimated';
import { Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';

import useAnimatedPress from '../../hooks/useAnimatedPress';
import { theme } from '../../styles/theme';

// Create animated pressable component
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Size configurations for button variants.
 * Each size defines padding and font size values.
 */
const SIZE_CONFIG = {
  sm: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontSize: theme.typography.sizes.sm,
    minHeight: 32,
  },
  md: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    fontSize: theme.typography.sizes.lg,
    minHeight: 44,
  },
  lg: {
    paddingHorizontal: theme.spacing.xxl,
    paddingVertical: theme.spacing.lg,
    fontSize: theme.typography.sizes.xl,
    minHeight: 52,
  },
};

/**
 * Variant configurations for button styles.
 * Each variant defines background, border, and text colors.
 */
const VARIANT_CONFIG = {
  primary: {
    backgroundColor: theme.colors.primary,
    borderColor: 'transparent',
    borderWidth: 0,
    textColor: theme.colors.text.white,
    shadow: theme.shadows.medium,
  },
  secondary: {
    backgroundColor: theme.colors.secondary,
    borderColor: 'transparent',
    borderWidth: 0,
    textColor: theme.colors.text.white,
    shadow: theme.shadows.medium,
  },
  outline: {
    backgroundColor: 'transparent',
    borderColor: theme.colors.primary,
    borderWidth: 2,
    textColor: theme.colors.primary,
    shadow: null,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderWidth: 0,
    textColor: theme.colors.primary,
    shadow: null,
  },
};

/**
 * Disabled state styling configurations.
 */
const DISABLED_CONFIG = {
  primary: {
    backgroundColor: theme.colors.border.light,
    textColor: theme.colors.text.muted,
  },
  secondary: {
    backgroundColor: theme.colors.border.light,
    textColor: theme.colors.text.muted,
  },
  outline: {
    borderColor: theme.colors.border.light,
    textColor: theme.colors.text.muted,
  },
  ghost: {
    textColor: theme.colors.text.muted,
  },
};

/**
 * AnimatedButton - A pressable button with scale animation and haptic feedback.
 *
 * @param {Object} props - Component props
 * @param {React.ReactNode} props.children - Button content (text or element)
 * @param {string} [props.title] - Button text (alternative to children)
 * @param {'primary'|'secondary'|'outline'|'ghost'} [props.variant='primary'] - Visual variant
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Button size
 * @param {boolean} [props.loading=false] - Show loading indicator
 * @param {boolean} [props.disabled=false] - Disable button interaction
 * @param {boolean} [props.haptic=true] - Enable haptic feedback on press
 * @param {'light'|'medium'|'heavy'|'soft'|'rigid'} [props.hapticStyle='light'] - Haptic intensity
 * @param {Function} [props.onPress] - Press handler
 * @param {Function} [props.onPressIn] - Press in handler
 * @param {Function} [props.onPressOut] - Press out handler
 * @param {Object} [props.style] - Additional container styles
 * @param {Object} [props.textStyle] - Additional text styles
 * @param {Object} [props.animationConfig] - Override animation configuration
 * @param {string} [props.accessibilityLabel] - Accessibility label
 * @param {string} [props.accessibilityHint] - Accessibility hint
 *
 * @example
 * // Basic primary button
 * <AnimatedButton title="Submit" onPress={handleSubmit} />
 *
 * @example
 * // Outline button with loading state
 * <AnimatedButton
 *   variant="outline"
 *   size="lg"
 *   loading={isSubmitting}
 *   onPress={handleSubmit}
 * >
 *   Save Changes
 * </AnimatedButton>
 *
 * @example
 * // Ghost button without haptics
 * <AnimatedButton variant="ghost" haptic={false} onPress={handleCancel}>
 *   Cancel
 * </AnimatedButton>
 */
const AnimatedButton = ({
  children,
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  haptic = true,
  hapticStyle = 'light',
  onPress,
  onPressIn: onPressInProp,
  onPressOut: onPressOutProp,
  style,
  textStyle,
  animationConfig,
  accessibilityLabel,
  accessibilityHint,
  ...rest
}) => {
  // Get animation handlers from hook
  const {
    animatedStyle,
    onPressIn: animatedPressIn,
    onPressOut: animatedPressOut,
  } = useAnimatedPress(animationConfig);

  // Get variant and size configurations
  const variantConfig = VARIANT_CONFIG[variant] || VARIANT_CONFIG.primary;
  const sizeConfig = SIZE_CONFIG[size] || SIZE_CONFIG.md;
  const disabledConfig = DISABLED_CONFIG[variant] || DISABLED_CONFIG.primary;

  // Determine if button is interactive
  const isInteractive = !disabled && !loading;

  // Map haptic style to Haptics impact style
  const getHapticImpact = useCallback(() => {
    const hapticMap = {
      light: Haptics.ImpactFeedbackStyle.Light,
      medium: Haptics.ImpactFeedbackStyle.Medium,
      heavy: Haptics.ImpactFeedbackStyle.Heavy,
      soft: Haptics.ImpactFeedbackStyle.Soft,
      rigid: Haptics.ImpactFeedbackStyle.Rigid,
    };
    return hapticMap[hapticStyle] || Haptics.ImpactFeedbackStyle.Light;
  }, [hapticStyle]);

  // Handle press with haptic feedback
  const handlePress = useCallback(() => {
    if (!isInteractive) return;

    if (haptic) {
      Haptics.impactAsync(getHapticImpact());
    }

    onPress?.();
  }, [isInteractive, haptic, getHapticImpact, onPress]);

  // Handle press in - trigger animation
  const handlePressIn = useCallback(() => {
    if (!isInteractive) return;

    animatedPressIn();
    onPressInProp?.();
  }, [isInteractive, animatedPressIn, onPressInProp]);

  // Handle press out - release animation
  const handlePressOut = useCallback(() => {
    if (!isInteractive) return;

    animatedPressOut();
    onPressOutProp?.();
  }, [isInteractive, animatedPressOut, onPressOutProp]);

  // Compute button container styles
  const buttonStyles = useMemo(() => {
    const baseStyles = [
      styles.button,
      {
        paddingHorizontal: sizeConfig.paddingHorizontal,
        paddingVertical: sizeConfig.paddingVertical,
        minHeight: sizeConfig.minHeight,
        backgroundColor: variantConfig.backgroundColor,
        borderColor: variantConfig.borderColor,
        borderWidth: variantConfig.borderWidth,
      },
      variantConfig.shadow,
    ];

    // Apply disabled styling
    if (disabled) {
      baseStyles.push({
        backgroundColor: disabledConfig.backgroundColor || variantConfig.backgroundColor,
        borderColor: disabledConfig.borderColor || variantConfig.borderColor,
      });
    }

    // Apply custom styles
    if (style) {
      baseStyles.push(style);
    }

    return baseStyles;
  }, [sizeConfig, variantConfig, disabledConfig, disabled, style]);

  // Compute text styles
  const computedTextStyle = useMemo(() => {
    const baseTextStyles = [
      styles.text,
      {
        fontSize: sizeConfig.fontSize,
        color: disabled ? disabledConfig.textColor : variantConfig.textColor,
      },
    ];

    if (textStyle) {
      baseTextStyles.push(textStyle);
    }

    return baseTextStyles;
  }, [sizeConfig.fontSize, variantConfig.textColor, disabledConfig.textColor, disabled, textStyle]);

  // Determine loading indicator color
  const loaderColor = disabled ? disabledConfig.textColor : variantConfig.textColor;

  // Render button content
  const renderContent = () => {
    if (loading) {
      return <ActivityIndicator size="small" color={loaderColor} />;
    }

    // If children is provided, render it directly
    if (children) {
      if (typeof children === 'string') {
        return <Text style={computedTextStyle}>{children}</Text>;
      }
      return children;
    }

    // Fall back to title prop
    if (title) {
      return <Text style={computedTextStyle}>{title}</Text>;
    }

    return null;
  };

  return (
    <AnimatedPressable
      style={[buttonStyles, animatedStyle]}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel || title || (typeof children === 'string' ? children : undefined)
      }
      accessibilityHint={accessibilityHint}
      accessibilityState={{
        disabled: disabled || loading,
        busy: loading,
      }}
      {...rest}
    >
      {renderContent()}
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.xxl,
  },
  text: {
    fontWeight: theme.typography.weights.semibold,
  },
});

export default AnimatedButton;
