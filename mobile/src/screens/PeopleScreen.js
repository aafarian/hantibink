import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Image,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useTabNavigation } from '../hooks/useTabNavigation';
import { useAsyncOperation } from '../hooks/useAsyncOperation';
import { LoadingScreen } from '../components/LoadingScreen';
import ApiDataService from '../services/ApiDataService';
import SocketService from '../services/SocketService';
import MatchModal from '../components/MatchModal';
import Logger from '../utils/logger';
import { handleError } from '../utils/errorHandler';
import { getUserProfilePhoto } from '../utils/profileHelpers';

const { width } = Dimensions.get('window');
const SWIPE_THRESHOLD = width * 0.25;

const PeopleScreen = ({ navigation }) => {
  const { user, userProfile } = useAuth();
  const { showSuccess, showError } = useToast();
  const { navigateToMessages } = useTabNavigation();
  const { loading, execute } = useAsyncOperation();

  const [profiles, setProfiles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [position] = useState(new Animated.ValueXY());
  const [actionLoading, setActionLoading] = useState(false);

  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchedUser, setMatchedUser] = useState(null);

  useEffect(() => {
    if (user?.uid) {
      loadProfiles();
      loadUserActions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]); // Only re-run when user ID changes (callbacks excluded to prevent infinite loops)

  // Listen for real-time match events from Socket.IO
  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = SocketService.onMatch((event, data) => {
      if (event === 'new-match' && data) {
        Logger.info('New match received in PeopleScreen:', data);

        // If we're not already showing a match modal, show this one
        if (!showMatchModal && data.matchedUser) {
          // Simplify the matched user data for the modal
          setMatchedUser({
            id: data.matchedUser.id,
            name: data.matchedUser.name,
            photo: data.matchedUser.mainPhoto || null,
          });
          setShowMatchModal(true);
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [user?.uid, showMatchModal]);

  // Handle skipping invalid profiles
  useEffect(() => {
    if (currentIndex < profiles.length) {
      const profile = profiles[currentIndex];
      if (profile && (!profile.name || typeof profile.age !== 'number')) {
        Logger.warn('Skipping invalid profile at index:', currentIndex);
        // Use a timeout to avoid immediate state update during render
        const timer = setTimeout(() => {
          nextCard();
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [currentIndex, profiles, nextCard]);

  const loadUserActions = useCallback(async () => {
    try {
      if (user?.uid) {
        const actions = await ApiDataService.getUserActions();
        Logger.info('User actions loaded:', actions.length);
      }
    } catch (error) {
      Logger.error('Error loading user actions:', error);
    }
  }, [user]);

  const loadProfiles = useCallback(async () => {
    if (!user?.uid) return;

    const result = await execute(
      async () => {
        // Get already processed user IDs (liked or passed)
        const actions = await ApiDataService.getUserActions();
        const processedUserIds = Array.isArray(actions)
          ? actions.map(action => action.receiverId)
          : [];

        // Get fresh users for discovery
        const users = await ApiDataService.getUsersForDiscovery({
          excludeIds: processedUserIds,
        });

        // Ensure users is an array
        const safeUsers = Array.isArray(users) ? users : [];

        // For now, show all users (later we can add photo filtering)
        // const usersWithPhotos = safeUsers.filter(
        //   mappedUser => mappedUser.photos && mappedUser.photos.length > 0 && mappedUser.mainPhoto
        // );

        // Filter out users with missing required data and normalize photo URLs
        const validUsers = safeUsers
          .filter(
            safeUser => safeUser && safeUser.id && safeUser.name && typeof safeUser.age === 'number'
          )
          .map(userData => {
            // Extract photo URLs as strings, not objects
            let mainPhotoUrl = null;
            let photoUrls = [];

            if (userData.photos && Array.isArray(userData.photos)) {
              photoUrls = userData.photos
                .map(photo => {
                  if (typeof photo === 'string') return photo;
                  if (photo && typeof photo === 'object' && photo.url) return photo.url;
                  return null;
                })
                .filter(Boolean);

              mainPhotoUrl = photoUrls[0] || null;
            }

            // Also check if there's a mainPhoto field
            if (!mainPhotoUrl && userData.mainPhoto) {
              mainPhotoUrl =
                typeof userData.mainPhoto === 'string'
                  ? userData.mainPhoto
                  : userData.mainPhoto?.url || null;
            }

            return {
              ...userData,
              photos: photoUrls,
              mainPhoto: mainPhotoUrl,
            };
          });

        return validUsers;
      },
      {
        loadingMessage: 'Loading profiles for swiping',
        errorMessage: 'Failed to load profiles',
        successMessage: `Loaded ${profiles.length} profiles`,
      }
    );

    if (result.success) {
      setProfiles(result.data);
      setCurrentIndex(0);
    } else {
      const errorInfo = handleError(result.originalError, result.errorMessage);
      showError(errorInfo.message, {
        action: { text: 'Retry', onPress: () => loadProfiles() },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, execute, showError]); // profiles.length excluded to avoid circular dependency

  const handleLike = async () => {
    if (currentIndex < profiles.length && !actionLoading) {
      const currentProfile = profiles[currentIndex];
      setActionLoading(true);

      try {
        const result = await ApiDataService.likeUser(currentProfile.id);
        if (result.success) {
          Logger.success(`Liked ${currentProfile.name}`);

          // Check if this created a match
          if (result.isMatch) {
            // Simplify the matched user data for the modal
            setMatchedUser({
              id: currentProfile.id,
              name: currentProfile.name,
              photo: currentProfile.mainPhoto || currentProfile.photos?.[0] || null,
            });
            setShowMatchModal(true);
          }

          nextCard();
        } else {
          const errorInfo = handleError(result.originalError, 'Failed to save like');
          showError(errorInfo.message, {
            action: { text: 'Retry', onPress: handleLike },
          });
        }
      } catch (error) {
        const errorInfo = handleError(error, 'Failed to save like');
        showError(errorInfo.message, {
          action: { text: 'Retry', onPress: handleLike },
        });
      } finally {
        setActionLoading(false);
      }
    }
  };

  const handleDislike = async () => {
    if (currentIndex < profiles.length && !actionLoading) {
      const currentProfile = profiles[currentIndex];
      setActionLoading(true);

      try {
        const result = await ApiDataService.passUser(currentProfile.id);
        if (result.success) {
          Logger.success(`Passed on ${currentProfile.name}`);
          nextCard();
        } else {
          showError('Failed to save pass. Please try again.');
        }
      } catch (error) {
        Logger.error('Error saving pass:', error);
        showError('Failed to save pass. Please try again.');
      } finally {
        setActionLoading(false);
      }
    }
  };

  const nextCard = useCallback(() => {
    if (currentIndex < profiles.length - 1) {
      setCurrentIndex(currentIndex + 1);
      position.setValue({ x: 0, y: 0 });
    } else {
      // Load more profiles when we run out
      loadProfiles();
    }
  }, [currentIndex, profiles, loadProfiles, position]);

  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: position.x, translationY: position.y } }],
    { useNativeDriver: false }
  );

  const onHandlerStateChange = event => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      const { translationX } = event.nativeEvent;

      if (translationX > SWIPE_THRESHOLD && !actionLoading) {
        // Swipe right - like
        Animated.timing(position, {
          toValue: { x: width, y: 0 },
          duration: 300,
          useNativeDriver: false,
        }).start(() => {
          handleLike();
        });
      } else if (translationX < -SWIPE_THRESHOLD && !actionLoading) {
        // Swipe left - pass
        Animated.timing(position, {
          toValue: { x: -width, y: 0 },
          duration: 300,
          useNativeDriver: false,
        }).start(() => {
          handleDislike();
        });
      } else {
        // Return to center
        Animated.spring(position, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: false,
        }).start();
      }
    }
  };

  const resetCards = () => {
    loadProfiles(); // Reload fresh profiles
  };

  const renderCard = () => {
    if (loading) {
      return <LoadingScreen message="Loading profiles..." />;
    }

    if (currentIndex >= profiles.length) {
      return (
        <View style={styles.noMoreCards}>
          <Ionicons name="heart-outline" size={80} color="#ccc" />
          <Text style={styles.noMoreCardsText}>No more profiles to show</Text>
          <TouchableOpacity style={styles.resetButton} onPress={resetCards}>
            <Text style={styles.resetButtonText}>Load More</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const profile = profiles[currentIndex];

    // Safety check for invalid profile data
    if (!profile || !profile.name || typeof profile.age !== 'number') {
      Logger.warn('Invalid profile data at index:', currentIndex, profile);
      // Don't call nextCard here as it causes re-render loops
      // Instead, return a placeholder and handle skipping via useEffect at component level
      return (
        <View style={styles.noMoreCards}>
          <ActivityIndicator size="large" color="#FF6B6B" />
          <Text style={styles.noMoreCardsText}>Loading next profile...</Text>
        </View>
      );
    }

    const rotate = position.x.interpolate({
      inputRange: [-width / 2, 0, width / 2],
      outputRange: ['-10deg', '0deg', '10deg'],
      extrapolate: 'clamp',
    });

    const likeOpacity = position.x.interpolate({
      inputRange: [0, width / 4],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    });

    const dislikeOpacity = position.x.interpolate({
      inputRange: [-width / 4, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });

    return (
      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
        enabled={!actionLoading}
      >
        <Animated.View
          style={[
            styles.card,
            {
              transform: [{ translateX: position.x }, { translateY: position.y }, { rotate }],
            },
          ]}
        >
          <Image source={{ uri: getUserProfilePhoto(profile) }} style={styles.cardImage} />

          <View style={styles.cardOverlay}>
            <View style={styles.cardInfo}>
              <Text style={styles.cardName}>
                {profile.name}, {profile.age}
              </Text>
              <Text style={styles.cardLocation}>{profile.location}</Text>
              <Text style={styles.cardBio}>{profile.bio}</Text>

              <View style={styles.interestsContainer}>
                {Array.isArray(profile.interests)
                  ? profile.interests.map((interest, index) => (
                      <View key={index} style={styles.interestTag}>
                        <Text style={styles.interestText}>{interest}</Text>
                      </View>
                    ))
                  : null}
              </View>
            </View>
          </View>

          {/* Like/Dislike indicators */}
          <Animated.View style={[styles.likeIndicator, { opacity: likeOpacity }]}>
            <Text style={styles.likeText}>LIKE</Text>
          </Animated.View>

          <Animated.View style={[styles.dislikeIndicator, { opacity: dislikeOpacity }]}>
            <Text style={styles.dislikeText}>NOPE</Text>
          </Animated.View>
        </Animated.View>
      </PanGestureHandler>
    );
  };

  // Check if user has photos before allowing swiping
  if (!userProfile?.photos || userProfile.photos.length === 0) {
    return (
      <View style={styles.noPhotosContainer}>
        <Ionicons name="camera-outline" size={80} color="#ccc" />
        <Text style={styles.noPhotosTitle}>Add photos to start swiping!</Text>
        <Text style={styles.noPhotosSubtitle}>
          You need at least one photo to be visible to others and start discovering matches.
        </Text>
        <TouchableOpacity
          style={styles.addPhotosButton}
          onPress={() => navigation.navigate('Profile', { screen: 'ProfileMain' })}
        >
          <Text style={styles.addPhotosButtonText}>Add Photos</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Filter Button */}
      <TouchableOpacity
        style={styles.filterButton}
        onPress={() =>
          navigation.navigate('Filter', {
            userPreferences: {
              ageRange: { min: 18, max: 50 }, // This should come from user profile
              maxDistance: 50, // This should come from user profile
              genderPreference: ['men', 'women'], // This should come from user profile
            },
          })
        }
      >
        <Ionicons name="filter" size={24} color="#FF6B6B" />
      </TouchableOpacity>

      {/* Test Button - Keep for development/testing */}
      <TouchableOpacity
        style={styles.testButton}
        onPress={async () => {
          if (profiles.length > 0) {
            const testUser = profiles[currentIndex];
            Logger.info('🧪 Testing match creation with:', testUser.name, 'ID:', testUser.id);
            showError('Testing like for ' + testUser.name); // Visual feedback

            // Test like functionality - this should create a match if implemented
            try {
              const result = await ApiDataService.likeUser(testUser.id);
              Logger.info('🧪 Like result:', result);

              if (result && result.isMatch) {
                setMatchedUser(testUser);
                setShowMatchModal(true);
                Logger.success('🧪 Test match created!');
                showSuccess('Match created with ' + testUser.name + '!');
              } else {
                Logger.info('🧪 Test like sent (no match)');
                showSuccess('Like sent to ' + testUser.name);
                // Move to next profile after like
                nextCard();
              }
            } catch (error) {
              Logger.error('🧪 Test like failed:', error.message);
              showError('Failed: ' + error.message);
            }
          } else {
            showError('No profiles available to test');
          }
        }}
      >
        <Text style={styles.testButtonText}>TEST</Text>
      </TouchableOpacity>

      {/* Main content area - card takes up most space */}
      <View style={styles.mainContent}>
        <View style={styles.cardContainer}>{renderCard()}</View>

        {/* Action buttons positioned at bottom of main content */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, actionLoading && styles.disabledButton]}
            onPress={handleDislike}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator size="small" color="#FF6B6B" />
            ) : (
              <Ionicons name="close" size={30} color="#FF6B6B" />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, actionLoading && styles.disabledButton]}
            onPress={handleLike}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator size="small" color="#4ECDC4" />
            ) : (
              <Ionicons name="heart" size={30} color="#4ECDC4" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Match Modal */}
      <MatchModal
        visible={showMatchModal}
        onClose={() => {
          setShowMatchModal(false);
          setMatchedUser(null);
        }}
        currentUserPhoto={
          userProfile?.mainPhoto || userProfile?.photos?.[0]?.url || userProfile?.photos?.[0]
        }
        currentUserName={userProfile?.name || user?.displayName}
        matchedUserPhoto={matchedUser?.photo}
        matchedUserName={matchedUser?.name}
        onSendMessage={() => {
          navigateToMessages();
        }}
        onKeepSwiping={() => {
          // Just close, the modal handles it
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  filterButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 1000,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  mainContent: {
    flex: 1,
    paddingTop: 20, // Small space from "Discover" header
    paddingBottom: 0, // No bottom padding - let actions sit close to tabs
  },
  cardContainer: {
    flex: 1,
    justifyContent: 'flex-start', // Start card at top instead of centering
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: width - 40,
    flex: 1, // Take up all available space in cardContainer
    backgroundColor: '#fff',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  cardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    padding: 20,
  },
  cardInfo: {
    color: '#fff',
  },
  cardName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  cardLocation: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 10,
  },
  cardBio: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 15,
    lineHeight: 20,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  interestTag: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    marginRight: 8,
    marginBottom: 5,
  },
  interestText: {
    color: '#fff',
    fontSize: 12,
  },
  likeIndicator: {
    position: 'absolute',
    top: 50,
    right: 40,
    transform: [{ rotate: '15deg' }],
  },
  likeText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4ECDC4',
    borderWidth: 4,
    borderColor: '#4ECDC4',
    padding: 10,
  },
  dislikeIndicator: {
    position: 'absolute',
    top: 50,
    left: 40,
    transform: [{ rotate: '-15deg' }],
  },
  dislikeText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FF6B6B',
    borderWidth: 4,
    borderColor: '#FF6B6B',
    padding: 10,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    marginBottom: 10, // Small gap above navigation tabs
  },
  actionButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  disabledButton: {
    opacity: 0.5,
  },
  noMoreCards: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  noMoreCardsText: {
    fontSize: 18,
    color: '#666',
    marginTop: 20,
    marginBottom: 30,
  },
  resetButton: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  testButton: {
    position: 'absolute',
    top: 110,
    right: 20,
    zIndex: 1000,
    backgroundColor: '#4ECDC4',
    borderRadius: 20,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  testButtonText: {
    color: '#fff',
    fontSize: 12,
  },
  // No photos styles
  noPhotosContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#f8f9fa',
  },
  noPhotosTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    textAlign: 'center',
  },
  noPhotosSubtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    marginBottom: 30,
    textAlign: 'center',
    lineHeight: 24,
  },
  addPhotosButton: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  addPhotosButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default PeopleScreen;
