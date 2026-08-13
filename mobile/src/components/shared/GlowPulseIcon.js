import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { theme } from '../../styles/theme';

/**
 * Animated icon medallion for empty states and upsells: a gradient disc
 * with sonar rings rippling outward (searching…) and an optional heartbeat
 * pulse on the icon. Purely decorative — wrap it in a GestureDetector or
 * Touchable at the call site if interaction is needed.
 *
 * Rings expand outward on a staggered loop; the layout box is sized to
 * contain them fully so surrounding content never shifts.
 */
const RING_COUNT = 2;
const RING_LOOP_MS = 2400;
const RING_MAX_SCALE = 1.9;

const SonarRing = ({ size, color, delay }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: RING_LOOP_MS, easing: Easing.out(Easing.quad) }),
        -1,
        false
      )
    );
  }, [progress, delay]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.35 * (1 - progress.value),
    transform: [{ scale: 1 + (RING_MAX_SCALE - 1) * progress.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        ringStyle,
      ]}
    />
  );
};

const GlowPulseIcon = ({
  icon = 'heart',
  size = 96,
  colors = [theme.colors.primaryLight, theme.colors.primary],
  ringColor = theme.colors.primary,
  iconColor = theme.colors.text.white,
  heartbeat = false,
}) => {
  const beat = useSharedValue(1);

  useEffect(() => {
    if (heartbeat) {
      // Lub-dub, then rest — a heartbeat, not a metronome
      beat.value = withRepeat(
        withSequence(
          withTiming(1.14, { duration: 130, easing: Easing.out(Easing.quad) }),
          withTiming(1, { duration: 150 }),
          withTiming(1.08, { duration: 130, easing: Easing.out(Easing.quad) }),
          withTiming(1, { duration: 200 }),
          withTiming(1, { duration: 1100 })
        ),
        -1,
        false
      );
    }
    return () => {
      beat.value = 1;
    };
  }, [heartbeat, beat]);

  const beatStyle = useAnimatedStyle(() => ({
    transform: [{ scale: beat.value }],
  }));

  const box = size * RING_MAX_SCALE;

  return (
    <View style={[styles.container, { width: box, height: box }]}>
      {Array.from({ length: RING_COUNT }, (_, i) => (
        <SonarRing key={i} size={size} color={ringColor} delay={(i * RING_LOOP_MS) / RING_COUNT} />
      ))}
      {/* Soft static halo for depth between the rings and the disc */}
      <View
        pointerEvents="none"
        style={[
          styles.halo,
          {
            width: size * 1.28,
            height: size * 1.28,
            borderRadius: (size * 1.28) / 2,
            backgroundColor: `${ringColor}14`,
          },
        ]}
      />
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.disc, { width: size, height: size, borderRadius: size / 2 }]}
      >
        <Animated.View style={beatStyle}>
          <Ionicons name={icon} size={size * 0.44} color={iconColor} />
        </Animated.View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
  },
  halo: {
    position: 'absolute',
  },
  disc: {
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.medium,
  },
});

export default GlowPulseIcon;
