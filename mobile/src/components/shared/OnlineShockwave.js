import React, { useEffect } from 'react';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { theme } from '../../styles/theme';

/**
 * Expanding pulse ring behind an online-presence dot.
 *
 * Runs entirely on the UI thread. The previous per-consumer implementation
 * was a permanent JS-thread Animated.loop — one per visible list row.
 *
 * @param {Object} props
 * @param {boolean} props.active - Animate while true; resets when false
 * @param {number} props.size - Dot diameter the ring expands from
 * @param {string} props.color - Ring color (defaults to the online token)
 * @param {Object} props.style - Extra styles for the ring
 */
const OnlineShockwave = ({ active = true, size = 8, color = theme.colors.online, style }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (active) {
      progress.value = 0;
      progress.value = withRepeat(
        withTiming(1, { duration: 1500, easing: Easing.out(Easing.ease) }),
        -1,
        false
      );
    } else {
      cancelAnimation(progress);
      progress.value = 0;
    }
    return () => cancelAnimation(progress);
  }, [active, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + progress.value * 1.2 }],
    opacity: 0.6 * (1 - progress.value),
  }));

  return (
    <Reanimated.View
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        style,
        animatedStyle,
      ]}
    />
  );
};

export default OnlineShockwave;
