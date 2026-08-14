import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  cancelAnimation,
} from 'react-native-reanimated';
import { theme } from '../../styles/theme';

// The layout box is intentionally smaller than the glow spread: halos
// overflow it as pure decoration, so the medallion doesn't reserve a
// huge square and push content below the fold on small screens
const LAYOUT_SCALE = 1.2;

/**
 * Icon medallion for empty states and upsells: a gradient disc over
 * layered static glow halos. Springs in once on mount (slight overshoot),
 * then rests — no ambient motion. Purely decorative; wrap it in a
 * GestureDetector or Touchable at the call site if interaction is needed.
 */
const GlowPulseIcon = ({
  icon = 'heart',
  size = 96,
  colors = [theme.colors.primaryLight, theme.colors.primary],
  glowColor = theme.colors.primary,
  iconColor = theme.colors.text.white,
}) => {
  const appear = useSharedValue(0);

  useEffect(() => {
    appear.value = withSpring(1, { damping: 13, stiffness: 130 });
    return () => cancelAnimation(appear);
  }, [appear]);

  const appearStyle = useAnimatedStyle(() => ({
    opacity: Math.min(appear.value * 1.5, 1),
    transform: [{ scale: 0.6 + appear.value * 0.4 }],
  }));

  const box = size * LAYOUT_SCALE;

  return (
    <Animated.View style={[styles.container, { width: box, height: box }, appearStyle]}>
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
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.disc, { width: size, height: size, borderRadius: size / 2 }]}
      >
        <Ionicons name={icon} size={size * 0.44} color={iconColor} />
      </LinearGradient>
    </Animated.View>
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
    ...theme.shadows.medium,
  },
});

export default GlowPulseIcon;
