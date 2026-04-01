import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { commonStyles } from '../styles/commonStyles';
import { theme } from '../styles/theme';

export const ErrorScreen = ({
  message = 'Something went wrong',
  onRetry,
  retryText = 'Try Again',
  style = {},
}) => {
  const hasAnimated = useRef(false);

  // Animation values - start at final state if already animated
  const iconScale = useSharedValue(hasAnimated.current ? 1 : 0);
  const iconOpacity = useSharedValue(hasAnimated.current ? 1 : 0);
  const textOpacity = useSharedValue(hasAnimated.current ? 1 : 0);
  const textTranslateY = useSharedValue(hasAnimated.current ? 0 : 20);
  const buttonOpacity = useSharedValue(hasAnimated.current ? 1 : 0);
  const buttonScale = useSharedValue(hasAnimated.current ? 1 : 0.9);

  useEffect(() => {
    if (hasAnimated.current) return;
    hasAnimated.current = true;

    // Icon appears first
    iconScale.value = withSpring(1, { damping: 12, stiffness: 100 });
    iconOpacity.value = withTiming(1, { duration: 300 });

    // Text slides up
    textOpacity.value = withDelay(150, withTiming(1, { duration: 300 }));
    textTranslateY.value = withDelay(150, withSpring(0, { damping: 15 }));

    // Button appears last
    buttonOpacity.value = withDelay(300, withTiming(1, { duration: 300 }));
    buttonScale.value = withDelay(300, withSpring(1, { damping: 12 }));
  }, [iconScale, iconOpacity, textOpacity, textTranslateY, buttonOpacity, buttonScale]);

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
    opacity: iconOpacity.value,
  }));

  const textAnimatedStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslateY.value }],
  }));

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
    transform: [{ scale: buttonScale.value }],
  }));

  return (
    <View style={[commonStyles.container, commonStyles.centered, style]}>
      <Animated.View style={[commonStyles.mb_lg, iconAnimatedStyle]}>
        <Ionicons name="alert-circle-outline" size={64} color={theme.colors.status.error} />
      </Animated.View>
      <Animated.Text style={[commonStyles.errorText, commonStyles.mb_xl, textAnimatedStyle]}>
        {message}
      </Animated.Text>
      {onRetry && (
        <Animated.View style={buttonAnimatedStyle}>
          <TouchableOpacity style={commonStyles.buttonPrimary} onPress={onRetry}>
            <Text style={commonStyles.buttonText}>{retryText}</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
};

/**
 * Draggable icon that springs back to center when released
 */
const DraggableIcon = ({ icon, size, color }) => {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);

  const panGesture = Gesture.Pan()
    .onUpdate(event => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
      // Slight scale up while dragging
      scale.value = withSpring(1.1, { damping: 15 });
    })
    .onEnd(() => {
      // Spring back to center
      translateX.value = withSpring(0, { damping: 12, stiffness: 120 });
      translateY.value = withSpring(0, { damping: 12, stiffness: 120 });
      scale.value = withSpring(1, { damping: 15 });
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.draggableIcon, animatedStyle]}>
        <Ionicons name={icon} size={size} color={color} />
      </Animated.View>
    </GestureDetector>
  );
};

export const EmptyState = ({
  icon = 'heart-outline',
  title = 'Nothing here yet',
  subtitle = 'Come back later to see updates',
  action = null, // { text: "Get Started", onPress: () => {} }
  style = {},
  draggableIcon = false, // Enable draggable icon feature
}) => {
  const hasAnimated = useRef(false);

  // Animation values - start at final state if already animated
  const iconScale = useSharedValue(hasAnimated.current ? 1 : 0);
  const iconOpacity = useSharedValue(hasAnimated.current ? 1 : 0);
  const titleOpacity = useSharedValue(hasAnimated.current ? 1 : 0);
  const titleTranslateY = useSharedValue(hasAnimated.current ? 0 : 15);
  const subtitleOpacity = useSharedValue(hasAnimated.current ? 1 : 0);
  const subtitleTranslateY = useSharedValue(hasAnimated.current ? 0 : 15);
  const buttonOpacity = useSharedValue(hasAnimated.current ? 1 : 0);
  const buttonScale = useSharedValue(hasAnimated.current ? 1 : 0.9);

  useEffect(() => {
    if (hasAnimated.current) return;
    hasAnimated.current = true;

    // Icon appears first with gentle scale
    iconScale.value = withSpring(1, { damping: 14, stiffness: 100 });
    iconOpacity.value = withTiming(1, { duration: 300 });

    // Title fades and slides up
    titleOpacity.value = withDelay(150, withTiming(1, { duration: 250 }));
    titleTranslateY.value = withDelay(150, withTiming(0, { duration: 300 }));

    // Subtitle follows
    subtitleOpacity.value = withDelay(250, withTiming(1, { duration: 250 }));
    subtitleTranslateY.value = withDelay(250, withTiming(0, { duration: 300 }));

    // Button appears last
    buttonOpacity.value = withDelay(350, withTiming(1, { duration: 250 }));
    buttonScale.value = withDelay(350, withSpring(1, { damping: 14 }));
  }, [
    iconScale,
    iconOpacity,
    titleOpacity,
    titleTranslateY,
    subtitleOpacity,
    subtitleTranslateY,
    buttonOpacity,
    buttonScale,
  ]);

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
    opacity: iconOpacity.value,
  }));

  const titleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));

  const subtitleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
    transform: [{ translateY: subtitleTranslateY.value }],
  }));

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
    transform: [{ scale: buttonScale.value }],
  }));

  return (
    <View style={[commonStyles.centered, commonStyles.p_huge, style]}>
      <Animated.View style={[commonStyles.mb_lg, iconAnimatedStyle]}>
        {draggableIcon ? (
          <DraggableIcon icon={icon} size={80} color={theme.colors.text.muted} />
        ) : (
          <Ionicons name={icon} size={80} color={theme.colors.text.muted} />
        )}
      </Animated.View>
      <Animated.Text
        style={[commonStyles.h3, commonStyles.mb_sm, commonStyles.textCenter, titleAnimatedStyle]}
      >
        {title}
      </Animated.Text>
      <Animated.Text
        style={[
          commonStyles.textMuted,
          commonStyles.textCenter,
          commonStyles.mb_xl,
          subtitleAnimatedStyle,
        ]}
      >
        {subtitle}
      </Animated.Text>
      {action && (
        <Animated.View style={buttonAnimatedStyle}>
          <TouchableOpacity style={commonStyles.buttonPrimary} onPress={action.onPress}>
            <Text style={commonStyles.buttonText}>{action.text}</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  draggableIcon: {
    cursor: 'grab',
  },
});
