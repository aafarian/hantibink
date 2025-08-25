import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Image,
  Animated,
  PanResponder,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { getUserProfilePhoto } from '../utils/profileHelpers';
import Logger from '../utils/logger';
import { formatDistanceAway } from '../utils/distanceUtils';

const { width, height } = Dimensions.get('window');
const SWIPE_THRESHOLD = width * 0.25;
const SWIPE_OUT_DURATION = 250;

const SwipeableCard = ({ profile, isTop, position, scale, opacity }) => {
  const rotate = position.x.interpolate({
    inputRange: [-width, 0, width],
    outputRange: ['-30deg', '0deg', '30deg'],
    extrapolate: 'clamp',
  });

  const likeOpacity = position.x.interpolate({
    inputRange: [0, width / 4],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const nopeOpacity = position.x.interpolate({
    inputRange: [-width / 4, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const animatedCardStyle = {
    transform: [{ translateX: position.x }, { translateY: position.y }, { rotate }, { scale }],
    opacity: isTop ? 1 : opacity, // Top card always fully opaque
  };

  return (
    <Animated.View style={[styles.card, animatedCardStyle]}>
      <Image
        source={{ uri: getUserProfilePhoto(profile) }}
        style={styles.cardImage}
        resizeMode="cover"
      />

      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.gradient}>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>
            {profile.name}, {profile.age} ({profile.gender?.toLowerCase() || 'unknown'})
          </Text>
          {profile.distance !== null && profile.distance !== undefined && (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={16} color="#fff" />
              <Text style={styles.cardLocation}>
                {formatDistanceAway(profile.distance, 'both')}
              </Text>
            </View>
          )}
          {!profile.distance && profile.location && (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={16} color="#fff" />
              <Text style={styles.cardLocation}>{profile.location}</Text>
            </View>
          )}
          {profile.bio && (
            <Text style={styles.cardBio} numberOfLines={2}>
              {profile.bio}
            </Text>
          )}
        </View>
      </LinearGradient>

      {/* Like/Nope indicators */}
      {isTop && (
        <>
          <Animated.View style={[styles.likeLabel, { opacity: likeOpacity }]}>
            <Text style={styles.likeText}>LIKE</Text>
          </Animated.View>
          <Animated.View style={[styles.nopeLabel, { opacity: nopeOpacity }]}>
            <Text style={styles.nopeText}>NOPE</Text>
          </Animated.View>
        </>
      )}
    </Animated.View>
  );
};

const SwipeableCardStack = forwardRef(
  ({ profiles, onSwipeLeft, onSwipeRight, onNeedMore, loadingMore = false }, ref) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const processedProfiles = useRef(new Set()); // Track processed profiles to avoid duplicates

    // Animation values for top card
    const position = useRef(new Animated.ValueXY()).current;
    const topCardScale = useRef(new Animated.Value(1)).current;
    const topCardOpacity = useRef(new Animated.Value(1)).current;

    // Animation values for next card - all cards same size
    const nextCardScale = useRef(new Animated.Value(1)).current;
    const nextCardOpacity = useRef(new Animated.Value(1)).current;

    // Static position values for non-top cards
    const staticPosition = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

    // Memoized default animation values to prevent recreation in render
    const defaultScale = useRef(new Animated.Value(1)).current;
    const defaultOpacity = useRef(new Animated.Value(1)).current;

    // Request more profiles when we're running low
    useEffect(() => {
      const remainingCards = profiles.length - currentIndex;
      // Count how many profiles ahead are not yet processed
      let unprocessedAhead = 0;
      for (let i = currentIndex; i < profiles.length; i++) {
        if (!processedProfiles.current.has(profiles[i].id)) {
          unprocessedAhead++;
        }
      }

      if (unprocessedAhead <= 3 && !loadingMore && remainingCards > 0) {
        Logger.info('📱 Running low on profiles, requesting more...');
        onNeedMore?.();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentIndex, profiles.length, loadingMore, onNeedMore]);

    // Clear processed profiles when we get a completely new set (e.g., after filter change)
    useEffect(() => {
      // If current index is 0 and we have new profiles, clear the processed set
      if (currentIndex === 0 && profiles.length > 0) {
        processedProfiles.current.clear();
        Logger.info('🔄 Cleared processed profiles cache');
      }
    }, [profiles, currentIndex]);

    // Expose imperative methods for programmatic swiping
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
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [isProcessing, currentIndex, profiles.length]
    );

    const panResponder = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => !isProcessing && currentIndex < profiles.length,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return (
            !isProcessing &&
            currentIndex < profiles.length &&
            (Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5)
          );
        },

        onPanResponderGrant: () => {
          // Clear any existing animations when starting a new gesture
          position.stopAnimation();
        },

        onPanResponderMove: (_, gestureState) => {
          position.setValue({ x: gestureState.dx, y: gestureState.dy });

          // No scaling since all cards are same size
          // Just move the top card
        },

        onPanResponderRelease: (_, gestureState) => {
          if (isProcessing) return; // Prevent double processing

          if (gestureState.dx > SWIPE_THRESHOLD) {
            // Swipe right
            forceSwipe('right');
          } else if (gestureState.dx < -SWIPE_THRESHOLD) {
            // Swipe left
            forceSwipe('left');
          } else {
            // Reset position
            resetPosition();
          }
        },
      })
    ).current;

    const forceSwipe = direction => {
      if (isProcessing || currentIndex >= profiles.length) return;

      setIsProcessing(true);
      const x = direction === 'right' ? width * 1.5 : -width * 1.5;

      // Start opacity fade for smooth transition
      Animated.timing(topCardOpacity, {
        toValue: 0,
        duration: SWIPE_OUT_DURATION,
        useNativeDriver: false,
      }).start();

      Animated.timing(position, {
        toValue: { x, y: 0 },
        duration: SWIPE_OUT_DURATION,
        useNativeDriver: false, // Can't use native driver with x,y values
      }).start(() => {
        onSwipeComplete(direction);
      });
    };

    const onSwipeComplete = direction => {
      // Use functional update to get the current index value
      setCurrentIndex(prevIndex => {
        // Safety check - ensure we have a valid profile at current index
        if (prevIndex >= profiles.length) {
          Logger.warn('No more profiles to swipe');
          position.setValue({ x: 0, y: 0 });
          setIsProcessing(false);
          return prevIndex;
        }

        const swipedProfile = profiles[prevIndex];
        Logger.info(
          `🎯 Swiping profile at index ${prevIndex}: ${swipedProfile.name} (${swipedProfile.id})`
        );

        // Check if we've already processed this profile
        if (!processedProfiles.current.has(swipedProfile.id)) {
          // Mark profile as processed BEFORE making API call
          processedProfiles.current.add(swipedProfile.id);
          Logger.info(`✅ Marked profile ${swipedProfile.id} as processed`);

          // Call the appropriate callback (fire and forget)
          if (direction === 'right') {
            onSwipeRight(swipedProfile).catch(error =>
              Logger.error('Error processing swipe right:', error)
            );
          } else {
            onSwipeLeft(swipedProfile).catch(error =>
              Logger.error('Error processing swipe left:', error)
            );
          }
        } else {
          Logger.warn(`Profile ${swipedProfile.id} already processed, skipping API call`);
        }

        const newIndex = prevIndex + 1;
        Logger.info(`📍 Moving from index ${prevIndex} to ${newIndex}`);

        // Return the new index
        return newIndex;
      });

      // Reset animations after state update
      requestAnimationFrame(() => {
        position.setValue({ x: 0, y: 0 });
        topCardScale.setValue(1);
        topCardOpacity.setValue(1);
        nextCardScale.setValue(1);
        nextCardOpacity.setValue(1);
        setIsProcessing(false);
      });
    };

    const resetPosition = () => {
      Animated.spring(position, {
        toValue: { x: 0, y: 0 },
        friction: 4,
        useNativeDriver: false, // Can't use native driver with x,y values
      }).start();

      // No scaling animation needed since all cards are same size
    };

    const renderCards = () => {
      // Logger.info(`🎴 Rendering cards - currentIndex: ${currentIndex}, profiles.length: ${profiles.length}`);

      if (currentIndex >= profiles.length) {
        return (
          <View style={styles.noMoreCards}>
            {loadingMore ? (
              <>
                <ActivityIndicator size="large" color="#FF6B6B" />
                <Text style={styles.loadingText}>Finding more people...</Text>
              </>
            ) : (
              <>
                <Ionicons name="people-outline" size={60} color="#ccc" />
                <Text style={styles.noMoreText}>No more profiles</Text>
                <Text style={styles.noMoreSubtext}>Check back later for more matches!</Text>
              </>
            )}
          </View>
        );
      }

      // Render up to 3 cards in the stack (current + next 2)
      const cardsToRender = [];
      let cardsAdded = 0;

      // Look for up to 3 unprocessed profiles starting from current index
      for (let offset = 0; offset < profiles.length - currentIndex && cardsAdded < 3; offset++) {
        const profileIndex = currentIndex + offset;
        const profile = profiles[profileIndex];

        if (!profile) continue;

        // For the top card (offset 0), always render it even if processed
        // For other cards, skip if already processed
        const isProcessed = processedProfiles.current.has(profile.id);
        if (offset > 0 && isProcessed) {
          Logger.info(`🚫 Skipping processed profile at offset ${offset}: ${profile.id}`);
          continue;
        }

        const isTop = cardsAdded === 0;
        // Create unique key that includes both profile ID and its index in the queue
        const cardKey = `${profile.id}-${profileIndex}`;
        const zIndex = 3 - cardsAdded; // 3 for top, 2 for next, 1 for third

        // Logger.info(`🃏 Rendering card ${cardsAdded}: ${profile.name} (${profile.id}) at index ${profileIndex}, isTop: ${isTop}, zIndex: ${zIndex}`);

        if (isTop) {
          // Top card with pan responder
          cardsToRender.push(
            <Animated.View
              key={cardKey}
              style={[styles.cardContainer, { zIndex }]}
              {...panResponder.panHandlers}
            >
              <SwipeableCard
                profile={profile}
                isTop={true}
                position={position}
                scale={topCardScale}
                opacity={topCardOpacity}
                onSwipeLeft={() => forceSwipe('left')}
                onSwipeRight={() => forceSwipe('right')}
              />
            </Animated.View>
          );
        } else {
          // Non-top cards
          cardsToRender.push(
            <Animated.View key={cardKey} style={[styles.cardContainer, { zIndex }]}>
              <SwipeableCard
                profile={profile}
                isTop={false}
                position={staticPosition}
                scale={cardsAdded === 1 ? nextCardScale : defaultScale}
                opacity={cardsAdded === 1 ? nextCardOpacity : defaultOpacity}
                onSwipeLeft={() => {}}
                onSwipeRight={() => {}}
              />
            </Animated.View>
          );
        }

        cardsAdded++;
      }

      // Don't reverse - render in the order we built them
      return cardsToRender;
    };

    return <View style={styles.container}>{renderCards()}</View>;
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContainer: {
    position: 'absolute',
    width: width * 0.92,
    height: height * 0.68, // Good size without covering header
    top: 0, // Start below the tab header
  },
  card: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: 'hidden',
    position: 'absolute', // Ensure cards stack properly
  },
  cardImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '40%',
    justifyContent: 'flex-end',
    padding: 20,
  },
  cardInfo: {
    paddingBottom: 10,
  },
  cardName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardLocation: {
    fontSize: 16,
    color: '#fff',
    marginLeft: 5,
  },
  cardBio: {
    fontSize: 15,
    color: '#fff',
    opacity: 0.9,
    marginTop: 5,
  },
  likeLabel: {
    position: 'absolute',
    top: 50,
    left: 40,
    padding: 10,
    borderWidth: 4,
    borderColor: '#4CAF50',
    borderRadius: 10,
    transform: [{ rotate: '-30deg' }],
  },
  likeText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  nopeLabel: {
    position: 'absolute',
    top: 50,
    right: 40,
    padding: 10,
    borderWidth: 4,
    borderColor: '#FF5252',
    borderRadius: 10,
    transform: [{ rotate: '30deg' }],
  },
  nopeText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FF5252',
  },
  noMoreCards: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  noMoreText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
  },
  noMoreSubtext: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
    textAlign: 'center',
  },
  loadingText: {
    fontSize: 18,
    color: '#666',
    marginTop: 20,
  },
});

export default SwipeableCardStack;
