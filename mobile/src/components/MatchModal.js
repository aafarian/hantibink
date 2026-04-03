import React, { useEffect, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  interpolate,
  Extrapolation,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { theme } from '../styles/theme';

const { width: screenWidth } = Dimensions.get('window');

const MatchModal = ({
  visible,
  onClose,
  currentUserPhoto,
  currentUserName,
  matchedUserPhoto,
  matchedUserName,
  onSendMessage,
  onKeepSwiping,
}) => {
  // Ensure we have valid photo URLs or use placeholders
  const safeCurrentPhoto = currentUserPhoto || 'https://via.placeholder.com/150';
  const safeMatchedPhoto = matchedUserPhoto || 'https://via.placeholder.com/150';

  // Animation values
  const containerScale = useSharedValue(0);
  const containerOpacity = useSharedValue(0);
  const leftPhotoX = useSharedValue(-100);
  const rightPhotoX = useSharedValue(100);
  const photoOpacity = useSharedValue(0);
  const heartScale = useSharedValue(0);
  const heartPulse = useSharedValue(1);
  const buttonOpacity = useSharedValue(0);
  const buttonTranslateY = useSharedValue(20);

  // Start animations when modal becomes visible
  useEffect(() => {
    if (visible) {
      // Trigger haptic feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Reset values
      containerScale.value = 0.8;
      containerOpacity.value = 0;
      leftPhotoX.value = -100;
      rightPhotoX.value = 100;
      photoOpacity.value = 0;
      heartScale.value = 0;
      heartPulse.value = 1;
      buttonOpacity.value = 0;
      buttonTranslateY.value = 20;

      // Container entrance
      containerScale.value = withSpring(1, { damping: 15, stiffness: 120 });
      containerOpacity.value = withTiming(1, { duration: 200 });

      // Photos slide in
      leftPhotoX.value = withDelay(150, withSpring(0, { damping: 12, stiffness: 100 }));
      rightPhotoX.value = withDelay(150, withSpring(0, { damping: 12, stiffness: 100 }));
      photoOpacity.value = withDelay(150, withTiming(1, { duration: 300 }));

      // Heart appears with bounce
      heartScale.value = withDelay(
        350,
        withSequence(
          withSpring(1.3, { damping: 8, stiffness: 200 }),
          withSpring(1, { damping: 10, stiffness: 150 })
        )
      );

      // Heart pulse animation (repeating)
      heartPulse.value = withDelay(
        600,
        withRepeat(
          withSequence(
            withTiming(1.15, { duration: 400, easing: Easing.inOut(Easing.ease) }),
            withTiming(1, { duration: 400, easing: Easing.inOut(Easing.ease) })
          ),
          -1, // infinite repeat
          false
        )
      );

      // Buttons fade in - use timing instead of spring to avoid blocking touches
      buttonOpacity.value = withDelay(500, withTiming(1, { duration: 300 }));
      buttonTranslateY.value = withDelay(500, withTiming(0, { duration: 300 }));
    }
  }, [
    visible,
    containerScale,
    containerOpacity,
    leftPhotoX,
    rightPhotoX,
    photoOpacity,
    heartScale,
    heartPulse,
    buttonOpacity,
    buttonTranslateY,
  ]);

  // Animated styles
  const containerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: containerScale.value }],
    opacity: containerOpacity.value,
  }));

  const leftPhotoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: leftPhotoX.value }],
    opacity: photoOpacity.value,
  }));

  const rightPhotoAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: rightPhotoX.value }],
    opacity: photoOpacity.value,
  }));

  const heartAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value * heartPulse.value }],
    opacity: interpolate(heartScale.value, [0, 0.5, 1], [0, 1, 1], Extrapolation.CLAMP),
  }));

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
    transform: [{ translateY: buttonTranslateY.value }],
  }));

  // Handle send message - parent handles modal closing and navigation
  const handleSendMessage = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (onSendMessage) {
      onSendMessage();
    }
  }, [onSendMessage]);

  // Handle keep swiping - parent handles modal closing
  const handleKeepSwiping = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onKeepSwiping) {
      onKeepSwiping();
    }
  }, [onKeepSwiping]);

  return (
    <Modal animationType="fade" transparent={true} visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* Tappable background to dismiss */}
        <Pressable style={styles.dismissArea} onPress={onClose} />

        <Animated.View style={[styles.container, containerAnimatedStyle]}>
          {/* Close button */}
          <TouchableOpacity style={styles.closeIcon} onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.colors.text.secondary} />
          </TouchableOpacity>

          {/* Header with gradient */}
          <LinearGradient
            colors={[theme.colors.primary, '#FF8E53']}
            style={styles.header}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.title}>It's a Match!</Text>
            <Text style={styles.subtitle}>You and {matchedUserName} liked each other</Text>
          </LinearGradient>

          {/* Photos section */}
          <View style={styles.photosContainer}>
            <Animated.View style={[styles.photoWrapper, leftPhotoAnimatedStyle]}>
              <Image source={{ uri: safeCurrentPhoto }} style={styles.photo} />
              <Text style={styles.photoName}>{currentUserName || 'You'}</Text>
            </Animated.View>

            <Animated.View style={[styles.heartContainer, heartAnimatedStyle]}>
              <View style={styles.heartBadge}>
                <Ionicons name="heart" size={28} color={theme.colors.primary} />
              </View>
            </Animated.View>

            <Animated.View style={[styles.photoWrapper, rightPhotoAnimatedStyle]}>
              <Image source={{ uri: safeMatchedPhoto }} style={styles.photo} />
              <Text style={styles.photoName}>{matchedUserName}</Text>
            </Animated.View>
          </View>

          {/* Actions */}
          <Animated.View style={[styles.actions, buttonAnimatedStyle]}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleSendMessage}
              activeOpacity={0.8}
            >
              <Ionicons name="chatbubble-ellipses" size={20} color={theme.colors.text.white} />
              <Text style={styles.primaryButtonText}>Send Message</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={handleKeepSwiping}>
              <Text style={styles.secondaryButtonText}>Keep Swiping</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay.medium,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dismissArea: {
    ...StyleSheet.absoluteFillObject,
  },
  container: {
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.borderRadius.xxl,
    width: screenWidth * 0.88,
    maxWidth: 380,
    overflow: 'hidden',
    ...theme.shadows.large,
  },
  closeIcon: {
    position: 'absolute',
    top: theme.spacing.md,
    right: theme.spacing.md,
    padding: theme.spacing.xs,
    zIndex: 10,
    backgroundColor: `${theme.colors.background.primary}E6`, // 90% opacity
    borderRadius: theme.borderRadius.round,
  },
  header: {
    paddingVertical: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.xl,
    alignItems: 'center',
  },
  title: {
    fontSize: theme.typography.sizes.xxxl,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text.white,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.text.white,
    textAlign: 'center',
    opacity: 0.9,
  },
  photosContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  photoWrapper: {
    alignItems: 'center',
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: theme.colors.primary,
  },
  photoName: {
    marginTop: theme.spacing.sm,
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text.primary,
  },
  heartContainer: {
    marginHorizontal: theme.spacing.sm,
  },
  heartBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: `${theme.colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.secondary,
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.borderRadius.round,
    gap: theme.spacing.sm,
    ...theme.shadows.medium,
  },
  primaryButtonText: {
    color: theme.colors.text.white,
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
  },
  secondaryButton: {
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.round,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: theme.colors.text.muted,
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.medium,
  },
});

export default MatchModal;
