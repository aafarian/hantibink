import React, { useCallback, useState } from 'react';
import { View, TextInput, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  interpolate,
  interpolateColor,
  Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

/**
 * AnimatedInput - A text input with smooth focus animations, floating labels,
 * error shake animation, and icon support.
 *
 * @param {Object} props
 * @param {string} props.label - Floating label text (optional)
 * @param {string} props.placeholder - Placeholder text
 * @param {string} props.value - Input value
 * @param {function} props.onChangeText - Change handler
 * @param {string} props.error - Error message to display
 * @param {boolean} props.success - Success state indicator
 * @param {string} props.leftIcon - Ionicons name for left icon
 * @param {string} props.rightIcon - Ionicons name for right icon
 * @param {function} props.onRightIconPress - Handler for right icon press
 * @param {boolean} props.disabled - Disable the input
 * @param {boolean} props.multiline - Enable multiline input
 * @param {Object} props.style - Additional container styles
 * @param {Object} props.inputStyle - Additional input styles
 * @param {Object} props.rest - Additional TextInput props
 */
const AnimatedInput = ({
  label,
  placeholder,
  value = '',
  onChangeText,
  error,
  success,
  leftIcon,
  rightIcon,
  onRightIconPress,
  disabled = false,
  multiline = false,
  style,
  inputStyle,
  ...rest
}) => {
  const [isFocused, setIsFocused] = useState(false);

  // Animation values
  const focusProgress = useSharedValue(0);
  const labelPosition = useSharedValue(value ? 1 : 0);
  const shakeValue = useSharedValue(0);

  // Determine if label should be floating
  const shouldFloat = isFocused || value?.length > 0;

  // Handle focus
  const handleFocus = useCallback(
    e => {
      setIsFocused(true);
      focusProgress.value = withTiming(1, {
        duration: theme.animation.durations.normal,
        easing: Easing.bezier(
          theme.animation.easings.standard.x1,
          theme.animation.easings.standard.y1,
          theme.animation.easings.standard.x2,
          theme.animation.easings.standard.y2
        ),
      });
      if (label) {
        labelPosition.value = withSpring(1, theme.animation.springs.smooth);
      }
      rest.onFocus?.(e);
    },
    [focusProgress, labelPosition, label, rest]
  );

  // Handle blur
  const handleBlur = useCallback(
    e => {
      setIsFocused(false);
      focusProgress.value = withTiming(0, {
        duration: theme.animation.durations.normal,
        easing: Easing.bezier(
          theme.animation.easings.standard.x1,
          theme.animation.easings.standard.y1,
          theme.animation.easings.standard.x2,
          theme.animation.easings.standard.y2
        ),
      });
      if (label && !value) {
        labelPosition.value = withSpring(0, theme.animation.springs.smooth);
      }
      rest.onBlur?.(e);
    },
    [focusProgress, labelPosition, label, value, rest]
  );

  // Trigger shake animation on error
  React.useEffect(() => {
    if (error) {
      shakeValue.value = withSequence(
        withTiming(10, { duration: 50 }),
        withTiming(-10, { duration: 50 }),
        withTiming(8, { duration: 50 }),
        withTiming(-8, { duration: 50 }),
        withTiming(5, { duration: 50 }),
        withTiming(-5, { duration: 50 }),
        withTiming(0, { duration: 50 })
      );
    }
  }, [error, shakeValue]);

  // Container animated style (border color + shake)
  const containerAnimatedStyle = useAnimatedStyle(() => {
    let borderColor;

    if (error) {
      borderColor = theme.colors.status.error;
    } else if (success) {
      borderColor = theme.colors.status.success;
    } else {
      borderColor = interpolateColor(
        focusProgress.value,
        [0, 1],
        [theme.colors.border.light, theme.colors.primary]
      );
    }

    return {
      borderColor,
      transform: [{ translateX: shakeValue.value }],
    };
  }, [error, success]);

  // Floating label animated style
  const labelAnimatedStyle = useAnimatedStyle(() => {
    const translateY = interpolate(labelPosition.value, [0, 1], [0, -24]);

    const scale = interpolate(labelPosition.value, [0, 1], [1, 0.85]);

    let color;
    if (error) {
      color = theme.colors.status.error;
    } else if (success) {
      color = theme.colors.status.success;
    } else {
      color = interpolateColor(
        focusProgress.value,
        [0, 1],
        [theme.colors.text.muted, theme.colors.primary]
      );
    }

    return {
      transform: [{ translateY }, { scale }],
      color,
    };
  }, [error, success]);

  // Determine icon color based on state
  const getIconColor = () => {
    if (error) return theme.colors.status.error;
    if (success) return theme.colors.status.success;
    if (isFocused) return theme.colors.primary;
    return theme.colors.text.muted;
  };

  return (
    <View style={[styles.wrapper, style]}>
      <Animated.View
        style={[
          styles.container,
          leftIcon && styles.containerWithLeftIcon,
          rightIcon && styles.containerWithRightIcon,
          disabled && styles.containerDisabled,
          containerAnimatedStyle,
        ]}
      >
        {/* Left Icon */}
        {leftIcon && (
          <View style={styles.leftIconContainer}>
            <Ionicons name={leftIcon} size={20} color={getIconColor()} />
          </View>
        )}

        {/* Floating Label */}
        {label && (
          <Animated.Text
            style={[styles.label, leftIcon && styles.labelWithLeftIcon, labelAnimatedStyle]}
            pointerEvents="none"
          >
            {label}
          </Animated.Text>
        )}

        {/* Text Input */}
        <AnimatedTextInput
          style={[
            styles.input,
            leftIcon && styles.inputWithLeftIcon,
            rightIcon && styles.inputWithRightIcon,
            multiline && styles.inputMultiline,
            inputStyle,
          ]}
          placeholder={label && shouldFloat ? '' : placeholder}
          placeholderTextColor={theme.colors.text.muted}
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          editable={!disabled}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          {...rest}
        />

        {/* Right Icon */}
        {rightIcon && (
          <Pressable
            style={styles.rightIconContainer}
            onPress={onRightIconPress}
            disabled={!onRightIconPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name={rightIcon} size={20} color={getIconColor()} />
          </Pressable>
        )}

        {/* Success Indicator */}
        {success && !rightIcon && (
          <View style={styles.rightIconContainer}>
            <Ionicons name="checkmark-circle" size={20} color={theme.colors.status.success} />
          </View>
        )}
      </Animated.View>

      {/* Error Message */}
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: theme.spacing.md,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.background.primary,
    minHeight: 52,
    paddingHorizontal: theme.spacing.lg,
  },
  containerWithLeftIcon: {
    paddingLeft: theme.spacing.sm,
  },
  containerWithRightIcon: {
    paddingRight: theme.spacing.sm,
  },
  containerDisabled: {
    backgroundColor: theme.colors.background.secondary,
    opacity: 0.6,
  },
  leftIconContainer: {
    marginRight: theme.spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    width: 28,
  },
  rightIconContainer: {
    marginLeft: theme.spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    width: 28,
    padding: theme.spacing.xs,
  },
  label: {
    position: 'absolute',
    left: theme.spacing.lg,
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.text.muted,
    backgroundColor: theme.colors.background.primary,
    paddingHorizontal: theme.spacing.xs,
  },
  labelWithLeftIcon: {
    left: 44,
  },
  input: {
    flex: 1,
    fontFamily: theme.typography.fontFamily.regular,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.text.primary,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: 0,
  },
  inputWithLeftIcon: {
    paddingLeft: 0,
  },
  inputWithRightIcon: {
    paddingRight: 0,
  },
  inputMultiline: {
    minHeight: 100,
    paddingTop: theme.spacing.md,
  },
  errorText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.status.error,
    marginTop: theme.spacing.xs,
    marginLeft: theme.spacing.lg,
  },
});

export default AnimatedInput;
