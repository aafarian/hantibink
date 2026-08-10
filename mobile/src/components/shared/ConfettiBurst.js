import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { theme } from '../../styles/theme';

const PARTICLE_COLORS = [
  theme.colors.primary,
  theme.colors.primaryLight,
  theme.colors.secondaryLight,
  theme.colors.accentLight,
  theme.colors.premium,
];

// Precomputed launch vectors: evenly spread angles with alternating radii
// (Math.random is avoided so renders are deterministic and testable)
const PARTICLES = Array.from({ length: 16 }, (_, i) => {
  const angle = (i / 16) * Math.PI * 2;
  const radius = i % 2 === 0 ? 120 : 85;
  return {
    id: i,
    dx: Math.cos(angle) * radius,
    dy: Math.sin(angle) * radius - 40, // bias upward
    rotation: (i % 4) * 90 + 45,
    delay: (i % 5) * 40,
    color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
    size: i % 3 === 0 ? 10 : 7,
  };
});

const Particle = ({ particle, progress }) => {
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: p < 0.7 ? 1 : (1 - p) / 0.3,
      transform: [
        { translateX: particle.dx * p },
        { translateY: particle.dy * p + 60 * p * p }, // gravity
        { rotate: `${particle.rotation * p}deg` },
        { scale: 1 - p * 0.4 },
      ],
    };
  });

  return (
    <Reanimated.View
      style={[
        styles.particle,
        {
          width: particle.size,
          height: particle.size,
          backgroundColor: particle.color,
          borderRadius: particle.id % 2 === 0 ? particle.size / 2 : 2,
        },
        style,
      ]}
    />
  );
};

/**
 * Hand-rolled 16-particle celebration burst (no dependency).
 * Fires once when `trigger` becomes truthy; re-fires on change.
 */
const ConfettiBurst = ({ trigger = true, duration = 1200 }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (trigger) {
      progress.value = 0;
      progress.value = withDelay(120, withTiming(1, { duration, easing: Easing.out(Easing.quad) }));
    }
  }, [trigger, duration, progress]);

  return (
    <View pointerEvents="none" style={styles.container}>
      {PARTICLES.map(particle => (
        <Particle key={particle.id} particle={particle} progress={progress} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  particle: {
    position: 'absolute',
  },
});

export default ConfettiBurst;
