import React, { useEffect, useState, memo } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  cancelAnimation,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { theme } from '../../styles/theme';

/**
 * AnimatedTypingIndicator - Shows bouncing dots when the other user is typing.
 *
 * Uses react-native-reanimated for smooth 60fps animations.
 * Dots bounce in sequence with a wave effect.
 *
 * @param {Object} props
 * @param {boolean} props.isVisible - Whether to show the indicator
 * @param {string} props.avatarUrl - URL of the typing user's avatar
 */
const AnimatedTypingIndicator = ({ isVisible, avatarUrl }) => {
  // Track whether component should render (stays true during fade-out)
  const [shouldRender, setShouldRender] = useState(isVisible);

  // Individual animated values for each dot
  const dot1Y = useSharedValue(0);
  const dot2Y = useSharedValue(0);
  const dot3Y = useSharedValue(0);

  // Container opacity for fade in/out
  const containerOpacity = useSharedValue(0);

  useEffect(() => {
    if (isVisible) {
      // Ensure component is rendered before animating in
      setShouldRender(true);
      // Fade in the container
      containerOpacity.value = withTiming(1, { duration: 150 });

      // Start bouncing animation for each dot with staggered delay
      const bounceAnimation = delay =>
        withDelay(
          delay,
          withRepeat(
            withSequence(
              withTiming(-6, {
                duration: 300,
                easing: Easing.out(Easing.ease),
              }),
              withTiming(0, {
                duration: 300,
                easing: Easing.in(Easing.ease),
              })
            ),
            -1, // Infinite repeat
            false // Don't reverse
          )
        );

      dot1Y.value = bounceAnimation(0);
      dot2Y.value = bounceAnimation(100);
      dot3Y.value = bounceAnimation(200);
    } else {
      // Stop dot animations
      cancelAnimation(dot1Y);
      cancelAnimation(dot2Y);
      cancelAnimation(dot3Y);
      dot1Y.value = 0;
      dot2Y.value = 0;
      dot3Y.value = 0;
      // Fade out, then unmount after animation completes
      containerOpacity.value = withTiming(0, { duration: 150 }, finished => {
        if (finished) {
          runOnJS(setShouldRender)(false);
        }
      });
    }
  }, [isVisible, containerOpacity, dot1Y, dot2Y, dot3Y]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  const dot1Style = useAnimatedStyle(() => ({
    transform: [{ translateY: dot1Y.value }],
  }));

  const dot2Style = useAnimatedStyle(() => ({
    transform: [{ translateY: dot2Y.value }],
  }));

  const dot3Style = useAnimatedStyle(() => ({
    transform: [{ translateY: dot3Y.value }],
  }));

  if (!shouldRender) return null;

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      {avatarUrl && <Image source={{ uri: avatarUrl }} style={styles.avatar} />}
      <View style={styles.bubble}>
        <View style={styles.dotsContainer}>
          <Animated.View style={[styles.dot, dot1Style]} />
          <Animated.View style={[styles.dot, dot2Style]} />
          <Animated.View style={[styles.dot, dot3Style]} />
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  bubble: {
    backgroundColor: theme.colors.background.secondary,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 20,
    borderBottomLeftRadius: 4,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.text.muted,
    marginHorizontal: 2,
  },
});

export default memo(AnimatedTypingIndicator);
