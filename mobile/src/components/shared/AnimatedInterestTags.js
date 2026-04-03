import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { theme } from '../../styles/theme';

/**
 * Single animated tag with staggered entrance
 */
const AnimatedTag = ({ text, index, maxDelay = 400, tagStyle, textStyle }) => {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    // Stagger based on index, capped at maxDelay
    const delay = Math.min(index * 50, maxDelay);
    scale.value = withDelay(delay, withSpring(1, { damping: 12, stiffness: 150 }));
    opacity.value = withDelay(delay, withTiming(1, { duration: 200 }));
  }, [index, maxDelay, scale, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.tag, tagStyle, animatedStyle]}>
      <Text style={[styles.tagText, textStyle]}>{text}</Text>
    </Animated.View>
  );
};

/**
 * Container for animated interest tags with stagger effect
 */
const AnimatedInterestTags = ({
  items,
  maxItems = 6,
  animate = true,
  tagStyle,
  textStyle,
  containerStyle,
}) => {
  // Memoize processed items
  const displayItems = useMemo(() => {
    if (!items || items.length === 0) return [];
    return items.slice(0, maxItems);
  }, [items, maxItems]);

  const hasMore = items && items.length > maxItems;
  const moreCount = items ? items.length - maxItems : 0;

  if (displayItems.length === 0) return null;

  if (!animate) {
    // Non-animated version for performance when needed
    return (
      <View style={[styles.container, containerStyle]}>
        {displayItems.map((item, index) => (
          <View key={index} style={[styles.tag, tagStyle]}>
            <Text style={[styles.tagText, textStyle]}>{item}</Text>
          </View>
        ))}
        {hasMore && (
          <View style={[styles.tag, tagStyle]}>
            <Text style={[styles.tagText, textStyle]}>+{moreCount}</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, containerStyle]}>
      {displayItems.map((item, index) => (
        <AnimatedTag
          key={index}
          text={item}
          index={index}
          tagStyle={tagStyle}
          textStyle={textStyle}
        />
      ))}
      {hasMore && (
        <AnimatedTag
          text={`+${moreCount}`}
          index={displayItems.length}
          tagStyle={tagStyle}
          textStyle={textStyle}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  tagText: {
    color: theme.colors.text.white,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
  },
});

export default AnimatedInterestTags;
