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
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { theme } from '../../styles/theme';

// The layout box is intentionally smaller than the glow spread: halos
// overflow it as pure decoration, so the medallion doesn't reserve a
// huge square and push content below the fold on small screens
const LAYOUT_SCALE = 1.2;
// Weightless bob: gentle vertical drift, one direction per cycle
const FLOAT_RANGE = 5;
const FLOAT_MS = 2600;
// Light glint sweeping across the disc, then a long rest
const SHINE_SWEEP_MS = 900;
const SHINE_PAUSE_MS = 2800;

/**
 * Animated icon medallion for empty states and upsells: a gradient disc
 * over layered static glow halos, floating gently with a periodic shine
 * sweep. Purely decorative — wrap it in a GestureDetector or Touchable
 * at the call site if interaction is needed.
 */
const GlowPulseIcon = ({
  icon = 'heart',
  size = 96,
  colors = [theme.colors.primaryLight, theme.colors.primary],
  glowColor = theme.colors.primary,
  iconColor = theme.colors.text.white,
}) => {
  const float = useSharedValue(0);
  const shine = useSharedValue(0);

  useEffect(() => {
    float.value = withRepeat(
      withTiming(1, { duration: FLOAT_MS, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
    shine.value = withRepeat(
      withSequence(
        withTiming(1, { duration: SHINE_SWEEP_MS, easing: Easing.inOut(Easing.cubic) }),
        withTiming(0, { duration: 0 }),
        withTiming(0, { duration: SHINE_PAUSE_MS })
      ),
      -1,
      false
    );
    return () => {
      cancelAnimation(float);
      cancelAnimation(shine);
    };
  }, [float, shine]);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: FLOAT_RANGE - float.value * 2 * FLOAT_RANGE }],
  }));

  const shineStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -size + shine.value * 2 * size }, { rotate: '25deg' }],
  }));

  const box = size * LAYOUT_SCALE;

  return (
    <View style={[styles.container, { width: box, height: box }]}>
      {/* Layered static halos give depth without motion */}
      <View
        pointerEvents="none"
        style={[
          styles.halo,
          {
            width: size * 1.52,
            height: size * 1.52,
            borderRadius: (size * 1.52) / 2,
            backgroundColor: `${glowColor}0A`,
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.halo,
          {
            width: size * 1.26,
            height: size * 1.26,
            borderRadius: (size * 1.26) / 2,
            backgroundColor: `${glowColor}14`,
          },
        ]}
      />
      <Animated.View style={floatStyle}>
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.disc, { width: size, height: size, borderRadius: size / 2 }]}
        >
          <Ionicons name={icon} size={size * 0.44} color={iconColor} />
          {/* Shine strip parks outside the disc between sweeps; the disc's
              overflow clipping hides it at rest */}
          <Animated.View
            pointerEvents="none"
            style={[styles.shine, { width: size * 0.5, height: size * 1.6 }, shineStyle]}
          >
            <LinearGradient
              colors={['transparent', theme.colors.overlay.light, 'transparent']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.shineGradient}
            />
          </Animated.View>
        </LinearGradient>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
  },
  disc: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...theme.shadows.medium,
  },
  shine: {
    position: 'absolute',
  },
  shineGradient: {
    flex: 1,
  },
});

export default GlowPulseIcon;
