import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { View, Text, StyleSheet, Dimensions, ActivityIndicator } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import FullscreenSwipeableCard from './FullscreenSwipeableCard';
import Logger from '../utils/logger';
import { theme } from '../styles/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.25;
const SWIPE_OUT_DURATION = 300;

const SwipeableCardStack = forwardRef(
  (
    {
      profiles,
      onSwipeLeft,
      onSwipeRight,
      onSwipeSuperLike,
      onUndo,
      onNeedMore,
      onPhotoPress,
      loadingMore = false,
    },
    ref
  ) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const processedProfiles = useRef(new Set());
    const lastSwipedProfile = useRef(null); // Track last swiped profile for undo

    // Reanimated shared values
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const cardRotate = useSharedValue(0);
    const cardOpacity = useSharedValue(1);
    const staticTranslateX = useSharedValue(0); // For background cards

    // Request more profiles when running low
    useEffect(() => {
      const remainingCards = profiles.length - currentIndex;
      let unprocessedAhead = 0;
      for (let i = currentIndex; i < profiles.length; i++) {
        if (!processedProfiles.current.has(profiles[i].id)) {
          unprocessedAhead++;
        }
      }

      if (unprocessedAhead <= 3 && !loadingMore && remainingCards > 0) {
        Logger.info('Running low on profiles, requesting more...');
        onNeedMore?.();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentIndex, profiles.length, loadingMore, onNeedMore]);

    // Clear processed profiles when we get a new set
    useEffect(() => {
      if (currentIndex === 0 && profiles.length > 0) {
        processedProfiles.current.clear();
        Logger.info('Cleared processed profiles cache');
      }
    }, [profiles, currentIndex]);

    // Handle swipe completion
    const handleSwipeComplete = direction => {
      if (currentIndex >= profiles.length) {
        Logger.warn('No more profiles to swipe');
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        setIsProcessing(false);
        return;
      }

      const swipedProfile = profiles[currentIndex];
      Logger.info(`Swiping profile: ${swipedProfile.name} (${swipedProfile.id}) - ${direction}`);

      // Save for potential undo (only track last one)
      lastSwipedProfile.current = {
        profile: swipedProfile,
        index: currentIndex,
        direction,
      };

      if (!processedProfiles.current.has(swipedProfile.id)) {
        processedProfiles.current.add(swipedProfile.id);

        if (direction === 'superlike') {
          // Super like uses a different API endpoint
          onSwipeSuperLike?.(swipedProfile)?.catch(error =>
            Logger.error('Error processing super like:', error)
          );
        } else if (direction === 'right') {
          onSwipeRight(swipedProfile).catch(error =>
            Logger.error('Error processing swipe right:', error)
          );
        } else {
          onSwipeLeft(swipedProfile).catch(error =>
            Logger.error('Error processing swipe left:', error)
          );
        }
      }

      setCurrentIndex(prev => prev + 1);

      // Reset after animation completes
      setTimeout(() => {
        translateX.value = 0;
        translateY.value = 0;
        cardRotate.value = 0;
        cardOpacity.value = 1;
        setIsProcessing(false);
      }, 50);
    };

    // Force swipe animation
    const forceSwipe = direction => {
      if (isProcessing || currentIndex >= profiles.length) return;

      setIsProcessing(true);
      const x = direction === 'right' ? SCREEN_WIDTH * 1.5 : -SCREEN_WIDTH * 1.5;

      translateX.value = withTiming(x, { duration: SWIPE_OUT_DURATION });
      cardOpacity.value = withTiming(0, { duration: SWIPE_OUT_DURATION }, () => {
        runOnJS(handleSwipeComplete)(direction);
      });
    };

    // Undo last swipe
    const performUndo = async () => {
      const lastSwiped = lastSwipedProfile.current;
      if (!lastSwiped || isProcessing) {
        Logger.warn('No swipe to undo or processing');
        return { success: false, error: 'NO_SWIPE_TO_UNDO' };
      }

      setIsProcessing(true);

      try {
        // Call the undo callback first (API call)
        if (onUndo) {
          const result = await onUndo(lastSwiped.profile);
          if (!result?.success) {
            setIsProcessing(false);
            return result;
          }
        }

        // Restore the card
        processedProfiles.current.delete(lastSwiped.profile.id);

        // Animate card back from off-screen
        const offscreenX =
          lastSwiped.direction === 'left' ? -SCREEN_WIDTH * 1.5 : SCREEN_WIDTH * 1.5;
        translateX.value = offscreenX;
        cardOpacity.value = 0;

        // Decrement index first (so the card is in position)
        setCurrentIndex(prev => Math.max(0, prev - 1));

        // Then animate back to center
        setTimeout(() => {
          translateX.value = withSpring(0, { damping: 15 });
          cardOpacity.value = withTiming(1, { duration: 200 });
          setIsProcessing(false);
        }, 50);

        lastSwipedProfile.current = null;
        Logger.info('Undo successful');
        return { success: true };
      } catch (error) {
        Logger.error('Undo failed:', error);
        setIsProcessing(false);
        return { success: false, error: error.message };
      }
    };

    // Expose imperative methods
    useImperativeHandle(
      ref,
      () => ({
        swipeLeft: () => {
          if (!isProcessing && currentIndex < profiles.length) {
            forceSwipe('left');
          }
        },
        swipeRight: () => {
          if (!isProcessing && currentIndex < profiles.length) {
            forceSwipe('right');
          }
        },
        swipeSuperLike: () => {
          if (!isProcessing && currentIndex < profiles.length) {
            forceSwipe('superlike');
          }
        },
        undo: performUndo,
        canUndo: () => !!lastSwipedProfile.current && !isProcessing,
        getCurrentProfile: () => {
          if (currentIndex < profiles.length) {
            return profiles[currentIndex];
          }
          return null;
        },
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [isProcessing, currentIndex, profiles.length]
    );

    // Pan gesture for horizontal swipes only
    // Fail immediately on vertical movement so ScrollView takes over
    const panGesture = Gesture.Pan()
      .activeOffsetX([-20, 20]) // Only activate after 20px horizontal movement
      .failOffsetY([-10, 10]) // FAIL (let ScrollView handle) if 10px vertical first
      .onUpdate(event => {
        'worklet';
        translateX.value = event.translationX;
        cardRotate.value = interpolate(
          event.translationX,
          [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
          [-15, 0, 15],
          Extrapolation.CLAMP
        );
      })
      .onEnd(event => {
        'worklet';
        const velX = event.velocityX;

        // Check if swipe should complete based on position OR velocity
        const shouldSwipeRight =
          translateX.value > SWIPE_THRESHOLD || (velX > 800 && translateX.value > 20);
        const shouldSwipeLeft =
          translateX.value < -SWIPE_THRESHOLD || (velX < -800 && translateX.value < -20);

        if (shouldSwipeRight) {
          translateX.value = withTiming(SCREEN_WIDTH * 1.5, { duration: SWIPE_OUT_DURATION });
          cardOpacity.value = withTiming(0, { duration: SWIPE_OUT_DURATION }, () => {
            runOnJS(handleSwipeComplete)('right');
          });
        } else if (shouldSwipeLeft) {
          translateX.value = withTiming(-SCREEN_WIDTH * 1.5, { duration: SWIPE_OUT_DURATION });
          cardOpacity.value = withTiming(0, { duration: SWIPE_OUT_DURATION }, () => {
            runOnJS(handleSwipeComplete)('left');
          });
        } else {
          // Snap back
          translateX.value = withSpring(0, { damping: 15, stiffness: 150 });
          cardRotate.value = withSpring(0, { damping: 15, stiffness: 150 });
        }
      });

    // Animated styles for top card
    const topCardStyle = useAnimatedStyle(() => {
      return {
        transform: [{ translateX: translateX.value }, { rotate: `${cardRotate.value}deg` }],
        opacity: cardOpacity.value,
      };
    });

    // Render no more cards state
    if (currentIndex >= profiles.length) {
      return (
        <View style={styles.noMoreCards}>
          {loadingMore ? (
            <>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.loadingText}>Finding more people...</Text>
            </>
          ) : (
            <>
              <Ionicons name="people-outline" size={60} color={theme.colors.gray[300]} />
              <Text style={styles.noMoreText}>No more profiles</Text>
              <Text style={styles.noMoreSubtext}>Check back later for more matches!</Text>
            </>
          )}
        </View>
      );
    }

    // Render card stack
    const renderCards = () => {
      const cards = [];

      // Render up to 2 cards (current and next)
      for (let i = 0; i < 2; i++) {
        const profileIndex = currentIndex + i;
        if (profileIndex >= profiles.length) break;

        const profile = profiles[profileIndex];
        if (!profile) continue;

        const isTop = i === 0;
        const cardKey = `${profile.id}-${profileIndex}`;

        if (isTop) {
          // Top card with gesture handler
          cards.push(
            <GestureDetector key={cardKey} gesture={panGesture}>
              <Animated.View style={[styles.cardContainer, styles.topCard, topCardStyle]}>
                <FullscreenSwipeableCard
                  profile={profile}
                  translateX={translateX}
                  isTop={true}
                  onPhotoPress={onPhotoPress}
                />
              </Animated.View>
            </GestureDetector>
          );
        } else {
          // Background card (static)
          cards.push(
            <View key={cardKey} style={[styles.cardContainer, styles.backgroundCard]}>
              <FullscreenSwipeableCard
                profile={profile}
                translateX={staticTranslateX}
                isTop={false}
                onPhotoPress={onPhotoPress}
              />
            </View>
          );
        }
      }

      // Return in reverse order so top card renders last (on top)
      return cards.reverse();
    };

    return <View style={styles.container}>{renderCards()}</View>;
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray[100],
  },
  cardContainer: {
    position: 'absolute',
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    top: 0,
    left: 0,
  },
  topCard: {
    zIndex: 2,
  },
  backgroundCard: {
    zIndex: 1,
  },
  noMoreCards: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xxxl,
  },
  noMoreText: {
    fontSize: theme.typography.sizes.xxl,
    fontWeight: theme.typography.weights.bold,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.text.primary,
    marginTop: theme.spacing.xl,
  },
  noMoreSubtext: {
    fontSize: theme.typography.sizes.lg,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.gray[600],
    marginTop: theme.spacing.sm,
    textAlign: 'center',
  },
  loadingText: {
    fontSize: theme.typography.sizes.xl,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.gray[600],
    marginTop: theme.spacing.xl,
  },
});

export default SwipeableCardStack;
