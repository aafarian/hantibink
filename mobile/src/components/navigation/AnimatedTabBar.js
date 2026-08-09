import React, { useCallback, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  cancelAnimation,
} from 'react-native-reanimated';
import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '../../styles/theme';

// Create animated pressable component
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Tab icon configuration mapping route names to Ionicons.
 */
const TAB_ICONS = {
  Profile: { active: 'person', inactive: 'person-outline' },
  People: { active: 'people', inactive: 'people-outline' },
  'Liked You': { active: 'heart', inactive: 'heart-outline' },
  Messages: { active: 'chatbubbles', inactive: 'chatbubbles-outline' },
};

/**
 * AnimatedTabButton - Individual tab button with scale animation and haptic feedback.
 *
 * @param {Object} props - Component props
 * @param {Object} props.route - Navigation route object
 * @param {boolean} props.isFocused - Whether this tab is currently focused
 * @param {Object} props.options - Tab screen options
 * @param {Function} props.onPress - Press handler
 * @param {Function} props.onLongPress - Long press handler
 * @param {number} [props.badgeCount] - Optional badge count to display
 */
const AnimatedTabButton = ({ route, isFocused, options, onPress, onLongPress, badgeCount }) => {
  // Animation shared values
  const scale = useSharedValue(theme.animation.scales.resting);
  const iconBounce = useSharedValue(1);

  // Get icon names based on route
  const iconConfig = TAB_ICONS[route.name] || TAB_ICONS.Profile;
  const iconName = isFocused ? iconConfig.active : iconConfig.inactive;
  const iconColor = isFocused ? theme.colors.primary : 'gray';
  const iconSize = 24;

  // Trigger bounce animation when tab becomes focused
  useEffect(() => {
    // Cancel any in-progress animation first
    cancelAnimation(iconBounce);

    if (isFocused) {
      // Bounce: scale up to 1.3, then settle back to 1
      iconBounce.value = withSequence(
        withSpring(1.3, { damping: 8, stiffness: 400 }),
        withSpring(1, { damping: 10, stiffness: 200 })
      );
    } else {
      // Reset when unfocused
      iconBounce.value = 1;
    }
  }, [isFocused, iconBounce]);

  // Get label
  const label =
    options.tabBarLabel !== undefined
      ? options.tabBarLabel
      : options.title !== undefined
        ? options.title
        : route.name;

  // Handle press in - scale down
  const handlePressIn = useCallback(() => {
    scale.value = withSpring(theme.animation.scales.pressed, theme.animation.springs.stiff);
  }, [scale]);

  // Handle press out - spring bounce back
  const handlePressOut = useCallback(() => {
    scale.value = withSpring(theme.animation.scales.resting, theme.animation.springs.bouncy);
  }, [scale]);

  // Handle press - trigger haptic and navigation
  const handlePress = useCallback(() => {
    // Provide haptic feedback on tab switch
    if (!isFocused) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  }, [isFocused, onPress]);

  // Animated style with scale transform for press
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  // Animated style for icon bounce on selection
  const iconAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: iconBounce.value }],
    };
  });

  // Get accessibility label
  const accessibilityLabel = options.tabBarAccessibilityLabel || `${label} tab`;

  return (
    <AnimatedPressable
      style={[styles.tabButton, animatedStyle]}
      accessibilityRole="button"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={accessibilityLabel}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onLongPress={onLongPress}
    >
      <View style={styles.iconContainer}>
        <Animated.View style={iconAnimatedStyle}>
          <Ionicons name={iconName} size={iconSize} color={iconColor} />
        </Animated.View>
        {/* Badge for unread counts */}
        {badgeCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badgeCount > 99 ? '99+' : badgeCount}</Text>
          </View>
        )}
      </View>
      <Text style={[styles.label, { color: iconColor }]} numberOfLines={1}>
        {label}
      </Text>
    </AnimatedPressable>
  );
};

/**
 * AnimatedTabBar - Custom tab bar component with scale/bounce animations and haptic feedback.
 *
 * This component replaces the default bottom tab bar navigator's tab bar.
 * It provides:
 * - Scale down animation on press (using theme.animation.scales.pressed)
 * - Spring bounce-back animation on release
 * - Haptic feedback on tab switch
 * - Badge support for unread counts (e.g., Messages tab)
 *
 * @param {Object} props - Component props
 * @param {Object} props.state - Navigation state from @react-navigation/bottom-tabs
 * @param {Object} props.descriptors - Route descriptors from @react-navigation/bottom-tabs
 * @param {Object} props.navigation - Navigation object from @react-navigation/bottom-tabs
 * @param {number} [props.unreadCount=0] - Unread message count for Messages tab badge
 *
 * @example
 * // Usage in Tab.Navigator
 * <Tab.Navigator
 *   tabBar={(props) => <AnimatedTabBar {...props} unreadCount={unreadConversationCount} />}
 * >
 *   <Tab.Screen name="Profile" component={ProfileScreen} />
 *   <Tab.Screen name="Messages" component={MessagesScreen} />
 * </Tab.Navigator>
 */
const AnimatedTabBar = ({ state, descriptors, navigation, unreadCount = 0 }) => {
  const insets = useSafeAreaInsets();

  // Memoize tab bar style with safe area padding
  const tabBarStyle = useMemo(
    () => [
      styles.tabBar,
      {
        paddingBottom: Platform.OS === 'android' ? insets.bottom : 5,
        height: Platform.OS === 'android' ? 60 + insets.bottom : 60,
      },
    ],
    [insets.bottom]
  );

  return (
    <View style={tabBarStyle}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;

        // Determine badge count (only for Messages tab)
        const badgeCount = route.name === 'Messages' ? unreadCount : 0;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        return (
          <AnimatedTabButton
            key={route.key}
            route={route}
            isFocused={isFocused}
            options={options}
            onPress={onPress}
            onLongPress={onLongPress}
            badgeCount={badgeCount}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: theme.colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.light,
    paddingTop: 5,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    right: -6,
    top: -3,
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: theme.typography.fontFamily.bold,
  },
  label: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    marginTop: 2,
  },
});

export default AnimatedTabBar;
