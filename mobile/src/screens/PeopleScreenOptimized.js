import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useTabNavigation } from '../hooks/useTabNavigation';
import ApiDataService from '../services/ApiDataService';
import SocketService from '../services/SocketService';
import SwipeableCardStack from '../components/SwipeableCardStack';
import MatchModal from '../components/MatchModal';
import Logger from '../utils/logger';
import { getUserProfilePhoto } from '../utils/profileHelpers';

const BATCH_SIZE = 10; // Load 10 profiles at a time

const PeopleScreenOptimized = ({ navigation }) => {
  const { user, userProfile } = useAuth();
  const { showSuccess, showError } = useToast();
  const { navigateToMessages } = useTabNavigation();

  // State
  const [profiles, setProfiles] = useState([]);
  const [isLoading, setIsLoading] = useState(true); // Start as loading to prevent race condition
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchedUser, setMatchedUser] = useState(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  // Track processed profiles to avoid duplicates
  const processedIds = useRef(new Set());
  const cardStackRef = useRef(null);

  // Filters state
  const [filters, setFilters] = useState({
    minAge: 18,
    maxAge: 50,
    maxDistance: 50,
    interestedIn: null,
  });

  // Initial load
  useEffect(() => {
    if (user?.uid && userProfile) {
      loadInitialProfiles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, userProfile]);

  // Listen for real-time match events
  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = SocketService.onMatch((event, data) => {
      if (event === 'new-match' && data?.matchedUser) {
        Logger.info('🎉 New match received:', data);
        setMatchedUser({
          id: data.matchedUser.id,
          name: data.matchedUser.name,
          photo: data.matchedUser.mainPhoto || null,
        });
        setShowMatchModal(true);
      }
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Load initial batch of profiles
  const loadInitialProfiles = async () => {
    setIsLoading(true);
    try {
      Logger.info('📱 Loading initial profiles batch...');
      const result = await ApiDataService.getUsersForDiscovery({
        limit: BATCH_SIZE,
        excludeIds: Array.from(processedIds.current),
      });

      if (result && result.length > 0) {
        const newProfiles = result.filter(p => {
          if (processedIds.current.has(p.id)) {
            return false;
          }
          processedIds.current.add(p.id);
          return true;
        });

        setProfiles(newProfiles);
        setHasMore(newProfiles.length === BATCH_SIZE);
        Logger.success(`✅ Loaded ${newProfiles.length} initial profiles`);
      } else {
        Logger.warn('No profiles available');
        setHasMore(false);
      }
    } catch (error) {
      Logger.error('Failed to load profiles:', error);
      showError('Failed to load profiles. Please try again.');
    } finally {
      setIsLoading(false);
      setHasInitialized(true); // Mark as initialized after first load
    }
  };

  // Load more profiles when running low
  const loadMoreProfiles = useCallback(async () => {
    // Don't load more if we haven't initialized yet or already loading
    if (!hasInitialized || isLoading || isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    try {
      Logger.info('📱 Loading more profiles...');
      const result = await ApiDataService.getUsersForDiscovery({
        limit: BATCH_SIZE,
        excludeIds: Array.from(processedIds.current),
      });

      if (result && result.length > 0) {
        const newProfiles = result.filter(p => {
          if (processedIds.current.has(p.id)) {
            return false;
          }
          processedIds.current.add(p.id);
          return true;
        });

        if (newProfiles.length > 0) {
          setProfiles(prev => [...prev, ...newProfiles]);
          Logger.success(`✅ Loaded ${newProfiles.length} more profiles`);
        }

        // Only set hasMore to false if we got less than requested
        setHasMore(result.length === BATCH_SIZE);
      } else {
        setHasMore(false);
        Logger.info('No more profiles available');
      }
    } catch (error) {
      Logger.error('Failed to load more profiles:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasInitialized, isLoading, isLoadingMore, hasMore]);

  // Handle swipe left (pass)
  const handleSwipeLeft = useCallback(async profile => {
    try {
      Logger.info(`👈 Swiped left on ${profile.name}`);

      // Fire and forget - don't wait for API response
      ApiDataService.passUser(profile.id).catch(error => {
        Logger.error('Failed to save pass:', error);
      });
    } catch (error) {
      Logger.error('Error handling swipe left:', error);
    }
  }, []);

  // Handle swipe right (like)
  const handleSwipeRight = useCallback(
    async profile => {
      try {
        Logger.info(`👉 Swiped right on ${profile.name}`);

        // Send like to API
        const result = await ApiDataService.likeUser(profile.id);

        if (result.success) {
          if (result.isMatch) {
            // Show match modal
            setMatchedUser({
              id: profile.id,
              name: profile.name,
              photo: getUserProfilePhoto(profile),
            });
            setShowMatchModal(true);
            showSuccess(`It's a match with ${profile.name}! 🎉`);
          }
        } else {
          Logger.error('Failed to save like:', result);
        }
      } catch (error) {
        Logger.error('Error handling swipe right:', error);
        showError('Failed to save like. Please try again.');
      }
    },
    [showSuccess, showError]
  );

  // Handle match modal actions
  const handleSendMessage = useCallback(() => {
    setShowMatchModal(false);
    if (matchedUser) {
      navigateToMessages(matchedUser.id);
    }
  }, [matchedUser, navigateToMessages]);

  const handleKeepSwiping = useCallback(() => {
    setShowMatchModal(false);
    setMatchedUser(null);
  }, []);

  // Check if user has photos
  if (!userProfile?.photos || userProfile.photos.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
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
      </SafeAreaView>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B6B" />
          <Text style={styles.loadingText}>Finding people near you...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Floating Filter Button */}
      <TouchableOpacity
        style={styles.floatingFilterButton}
        onPress={() =>
          navigation.navigate('Filter', {
            userPreferences: filters,
            onSavePreferences: newFilters => {
              setFilters(newFilters);
              // Reset everything when filters change
              processedIds.current.clear();
              setProfiles([]);
              setHasMore(true);
              setHasInitialized(false);
              loadInitialProfiles();
            },
          })
        }
      >
        <Ionicons name="options-outline" size={24} color="#666" />
      </TouchableOpacity>

      {/* Card Stack */}
      <View style={styles.cardStackContainer}>
        <SwipeableCardStack
          ref={cardStackRef}
          profiles={profiles}
          onSwipeLeft={handleSwipeLeft}
          onSwipeRight={handleSwipeRight}
          onNeedMore={loadMoreProfiles}
          loadingMore={isLoadingMore}
        />
      </View>

      {/* Action Buttons */}
      {profiles.length > 0 && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.rewindButton]}
            disabled={true} // Will implement undo later
          >
            <Ionicons name="refresh" size={30} color="#FFA500" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.passButton]}
            onPress={() => cardStackRef.current?.swipeLeft()}
          >
            <Ionicons name="close" size={35} color="#FF5252" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.likeButton]}
            onPress={() => cardStackRef.current?.swipeRight()}
          >
            <Ionicons name="heart" size={30} color="#4CAF50" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.superLikeButton]}
            disabled={!userProfile?.isPremium}
          >
            <Ionicons name="star" size={30} color="#00BCD4" />
          </TouchableOpacity>
        </View>
      )}

      {/* Match Modal */}
      {showMatchModal && matchedUser && (
        <MatchModal
          visible={showMatchModal}
          currentUserPhoto={userProfile?.photos?.[0]?.url || userProfile?.mainPhoto}
          currentUserName={userProfile?.name}
          matchedUserPhoto={matchedUser?.photo}
          matchedUserName={matchedUser?.name}
          onClose={() => setShowMatchModal(false)}
          onSendMessage={handleSendMessage}
          onKeepSwiping={handleKeepSwiping}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  floatingFilterButton: {
    position: 'absolute',
    top: 10,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 5,
  },
  cardStackContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 40,
    backgroundColor: 'transparent', // No background to block cards
    position: 'absolute',
    bottom: 5, // Just above the tab bar
    left: 0,
    right: 0,
    zIndex: 10, // Above the cards
  },
  actionButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.95)', // Slightly transparent white
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 8,
  },
  rewindButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  passButton: {
    borderWidth: 2,
    borderColor: '#FF5252',
  },
  likeButton: {
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  superLikeButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#00BCD4',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#666',
  },
  noPhotosContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  noPhotosTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },
  noPhotosSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  addPhotosButton: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  addPhotosButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PeopleScreenOptimized;
