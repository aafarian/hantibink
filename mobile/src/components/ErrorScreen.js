import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import GlowPulseIcon from './shared/GlowPulseIcon';
import { commonStyles } from '../styles/commonStyles';
import { theme } from '../styles/theme';

export const ErrorScreen = ({
  message = 'Something went wrong',
  onRetry,
  retryText = 'Try Again',
  style = {},
}) => {
  const iconScale = useSharedValue(0);
  const iconOpacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(20);
  const buttonOpacity = useSharedValue(0);
  const buttonScale = useSharedValue(0.9);

  useEffect(() => {
    // Icon uses spring for bouncy entrance (safe - no touchable children)
    iconScale.value = withSpring(1, { damping: 12, stiffness: 100 });
    iconOpacity.value = withTiming(1, { duration: 300 });
    textOpacity.value = withDelay(150, withTiming(1, { duration: 300 }));
    textTranslateY.value = withDelay(150, withTiming(0, { duration: 300 }));
    // Button uses timing to avoid blocking touches while animation settles
    buttonOpacity.value = withDelay(300, withTiming(1, { duration: 300 }));
    buttonScale.value = withDelay(300, withTiming(1, { duration: 300 }));
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
 * Draggable wrapper that springs its child back to center when released
 */
const DraggableIcon = ({ children }) => {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);

  const panGesture = Gesture.Pan()
    .onUpdate(event => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
      scale.value = withSpring(1.1, { damping: 15 });
    })
    .onEnd(() => {
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
      <Animated.View style={[styles.draggableIcon, animatedStyle]}>{children}</Animated.View>
    </GestureDetector>
  );
};

export const EmptyState = ({
  icon = 'heart-outline',
  title = 'Nothing here yet',
  subtitle = 'Come back later to see updates',
  action = null,
  style = {},
  draggableIcon = false,
  iconColors,
}) => {
  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(15);
  const subtitleOpacity = useSharedValue(0);
  const subtitleTranslateY = useSharedValue(15);

  // The medallion animates its own entrance; only the text staggers here
  useEffect(() => {
    titleOpacity.value = withDelay(150, withTiming(1, { duration: 250 }));
    titleTranslateY.value = withDelay(150, withTiming(0, { duration: 300 }));
    subtitleOpacity.value = withDelay(250, withTiming(1, { duration: 250 }));
    subtitleTranslateY.value = withDelay(250, withTiming(0, { duration: 300 }));
  }, [titleOpacity, titleTranslateY, subtitleOpacity, subtitleTranslateY]);

  const titleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));

  const subtitleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
    transform: [{ translateY: subtitleTranslateY.value }],
  }));

  // The medallion renders filled glyphs — outline variants read too thin
  // on the gradient disc
  const medallionIcon = String(icon).replace(/-outline$/, '');
  const medallion = <GlowPulseIcon icon={medallionIcon} colors={iconColors} />;

  // Button is not animated to avoid touch blocking issues on navigation
  return (
    <View style={[commonStyles.centered, commonStyles.p_huge, style]}>
      <View style={commonStyles.mb_lg}>
        {draggableIcon ? <DraggableIcon>{medallion}</DraggableIcon> : medallion}
      </View>
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
        <TouchableOpacity style={commonStyles.buttonPrimary} onPress={action.onPress}>
          <Text style={commonStyles.buttonText}>{action.text}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  draggableIcon: {
    ...(Platform.OS === 'web' ? { cursor: 'grab' } : {}),
  },
});
