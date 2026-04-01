import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { commonStyles } from '../styles/commonStyles';
import { theme } from '../styles/theme';

export const ErrorScreen = ({
  message = 'Something went wrong',
  onRetry,
  retryText = 'Try Again',
  style = {},
}) => {
  // Simple static error screen - no animations needed
  return (
    <View style={[commonStyles.container, commonStyles.centered, style]}>
      <View style={commonStyles.mb_lg}>
        <Ionicons name="alert-circle-outline" size={64} color={theme.colors.status.error} />
      </View>
      <Text style={[commonStyles.errorText, commonStyles.mb_xl]}>{message}</Text>
      {onRetry && (
        <TouchableOpacity style={commonStyles.buttonPrimary} onPress={onRetry}>
          <Text style={commonStyles.buttonText}>{retryText}</Text>
        </TouchableOpacity>
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
  // No entrance animations - content appears immediately
  // The draggable icon provides the interactive element
  return (
    <View style={[commonStyles.centered, commonStyles.p_huge, style]}>
      <View style={commonStyles.mb_lg}>
        {draggableIcon ? (
          <DraggableIcon icon={icon} size={80} color={theme.colors.text.muted} />
        ) : (
          <Ionicons name={icon} size={80} color={theme.colors.text.muted} />
        )}
      </View>
      <Text style={[commonStyles.h3, commonStyles.mb_sm, commonStyles.textCenter]}>{title}</Text>
      <Text style={[commonStyles.textMuted, commonStyles.textCenter, commonStyles.mb_xl]}>
        {subtitle}
      </Text>
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
    cursor: 'grab',
  },
});
