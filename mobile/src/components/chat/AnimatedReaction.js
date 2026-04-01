import React, { useEffect, memo } from 'react';
import { Text, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withDelay,
} from 'react-native-reanimated';

/**
 * AnimatedReaction - Renders an emoji reaction with a pop animation.
 *
 * Animates with a bounce effect when first appearing or when count changes.
 *
 * @param {Object} props
 * @param {string} props.emoji - The emoji to display
 * @param {number} props.count - Number of this reaction (for superscript)
 * @param {boolean} props.isNew - Whether this is a newly added reaction
 */
const AnimatedReaction = ({ emoji, count, isNew = false }) => {
  const scale = useSharedValue(isNew ? 0.5 : 1);

  useEffect(() => {
    if (isNew) {
      // Pop animation for new reactions
      scale.value = withSequence(
        withSpring(1.3, { damping: 8, stiffness: 400 }),
        withSpring(1, { damping: 12, stiffness: 200 })
      );
    }
  }, [isNew, scale]);

  // Animate when count changes
  useEffect(() => {
    if (!isNew && count > 0) {
      scale.value = withDelay(
        50,
        withSequence(
          withSpring(1.15, { damping: 10, stiffness: 350 }),
          withSpring(1, { damping: 12, stiffness: 200 })
        )
      );
    }
  }, [count, isNew, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Superscript characters for counts
  const superscripts = {
    2: '\u00B2',
    3: '\u00B3',
    4: '\u2074',
    5: '\u2075',
    6: '\u2076',
    7: '\u2077',
    8: '\u2078',
    9: '\u2079',
  };
  const getSuperscript = c => (c > 1 ? superscripts[c] || `\u207A${c}` : '');

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <Text style={styles.emoji}>
        {emoji}
        {count > 1 && <Text style={styles.superscript}>{getSuperscript(count)}</Text>}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    // Inline display
  },
  emoji: {
    fontSize: 16,
  },
  superscript: {
    fontSize: 10,
    lineHeight: 14,
  },
});

export default memo(AnimatedReaction);
