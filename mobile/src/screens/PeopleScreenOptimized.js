import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from '@react-navigation/native';
import ImageViewing from 'react-native-image-viewing';
import { useAuth } from '../contexts/AuthContext';
import { useIsPremium } from '../contexts/FeatureFlagsContext';
import { useToast } from '../contexts/ToastContext';
import { useTabNavigation } from '../hooks/useTabNavigation';
import ApiDataService from '../services/ApiDataService';
import apiClient from '../services/ApiClient';
import SocketService from '../services/SocketService';
import SwipeableCardStack from '../components/SwipeableCardStack';
import MatchModal from '../components/MatchModal';
import { LoadingScreen } from '../components/LoadingScreen';
import { ErrorScreen, EmptyState } from '../components/ErrorScreen';
import ProfileSetupModal from '../components/modals/ProfileSetupModal';
import PremiumUpgradeModal from '../components/modals/PremiumUpgradeModal';
import { pickAdvancedFilters } from '../components/shared/FilterPreferencesForm';
import Logger from '../utils/logger';
import { getUserProfilePhoto } from '../utils/profileHelpers';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme } from '../styles/theme';
import {
  trackSwipeLeft,
  trackSwipeRight,
  trackSuperLike,
  trackMatchCreated,
} from '../utils/analytics';

const BATCH_SIZE = 10; // Load 10 profiles at a time

const PeopleScreenOptimized = ({ navigation }) => {
  const { user, userProfile, refreshUserProfile } = useAuth();
  const isPremium = useIsPremium();
  const { showError, showSuccess } = useToast();
  const insets = useSafeAreaInsets();
  const [showSetupModal, setShowSetupModal] = useState(false);
  const { navigateToChat } = useTabNavigation();

  // State
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true); // Start as loading to prevent race condition
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchedUser, setMatchedUser] = useState(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [error, setError] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Photo viewer state
  const [photoViewerVisible, setPhotoViewerVisible] = useState(false);
  const [photoViewerImages, setPhotoViewerImages] = useState([]);
  const [photoViewerIndex, setPhotoViewerIndex] = useState(0);

  // Track processed profiles to avoid duplicates
  const processedIds = useRef(new Set());
  // Match IDs we've already shown the "It's a match!" modal for. Prevents the
  // modal from re-firing if a socket reconnect replays the new-match event,
  // or if a swipe handler runs twice for the same match.
  const seenMatchIds = useRef(new Set());
  const cardStackRef = useRef(null);

  // Filters state - load from storage or use defaults
  const [filters, setFilters] = useState({
    minAge: 18,
    maxAge: 50,
    maxDistance: 100,
    interestedIn: userProfile?.interestedIn || [],
    strictAge: false,
    strictDistance: false,
    relationshipType: [],
    strictRelationshipType: false,
    education: [],
    strictEducation: false,
    smoking: [],
    strictSmoking: false,
    drinking: [],
    strictDrinking: false,
    languages: [],
    strictLanguages: false,
  });
  const [filtersLoaded, setFiltersLoaded] = useState(false);

  // Load filters: core preferences from API, advanced filters from AsyncStorage
  useEffect(() => {
    const loadFilters = async () => {
      try {
        // Load core preferences from API
        const response = await apiClient.getUserPreferences();
        let corePrefs = {};
        if (response.success && response.data) {
          const data = response.data;
          corePrefs = {
            minAge: data.ageRange?.min || 18,
            maxAge: data.ageRange?.max || 99,
            maxDistance: data.distance || 50,
          };
          Logger.info('📱 Loaded core preferences from API');
        }

        // Load advanced filters from AsyncStorage. Sanitize via
        // pickAdvancedFilters so any leaked core keys from older session
        // builds (minAge, maxAge, maxDistance) get dropped before they
        // override the fresh values we just fetched from the API.
        const savedFilters = await AsyncStorage.getItem('@HantibinkAdvancedFilters');
        let advancedFilters = {};
        if (savedFilters) {
          advancedFilters = pickAdvancedFilters(JSON.parse(savedFilters));
          Logger.info('📱 Loaded advanced filters from storage');
        }

        setFilters(prev => ({
          ...prev,
          ...corePrefs,
          ...advancedFilters,
          interestedIn: userProfile?.interestedIn || [],
        }));
      } catch (loadFilterErr) {
        Logger.error('Failed to load filters:', loadFilterErr);
      } finally {
        setFiltersLoaded(true);
      }
    };

    if (userProfile) {
      loadFilters();
    }
  }, [userProfile]);

  // Track previous interestedIn to detect changes
  const prevInterestedInRef = useRef();

  // Check if profile is complete for discovery
  const isProfileComplete = useCallback(() => {
    if (!userProfile) return false;

    const hasGender = userProfile.gender;
    const hasInterestedIn = userProfile.interestedIn && userProfile.interestedIn.length > 0;
    const hasPhotos = userProfile.photos && userProfile.photos.length > 0;
    const hasLocation = userProfile.location && userProfile.latitude && userProfile.longitude;

    return hasGender && hasInterestedIn && hasPhotos && hasLocation;
  }, [userProfile]);

  // Check profile completeness on mount for logging
  useEffect(() => {
    if (userProfile) {
      const complete = isProfileComplete();
      Logger.info('Profile completeness check:', {
        hasGender: !!userProfile.gender,
        gender: userProfile.gender,
        hasInterestedIn: userProfile.interestedIn && userProfile.interestedIn.length > 0,
        interestedIn: userProfile.interestedIn,
        hasPhotos: userProfile.photos && userProfile.photos.length > 0,
        photosCount: userProfile.photos?.length || 0,
        hasLocation: !!(userProfile.location && userProfile.latitude && userProfile.longitude),
        location: userProfile.location,
        isComplete: complete,
      });

      if (!complete) {
        Logger.info('Profile incomplete - will show setup modal');
        setLoading(false);
      }
    }
  }, [userProfile, isProfileComplete]);

  // Initial load and handle interestedIn changes
  useEffect(() => {
    // Check if profile just became complete
    const isNowComplete = isProfileComplete();

    if (user?.uid && userProfile && filtersLoaded && isNowComplete) {
      // Check if interestedIn changed
      const interestedInChanged =
        prevInterestedInRef.current &&
        JSON.stringify(prevInterestedInRef.current) !== JSON.stringify(userProfile.interestedIn);

      if (interestedInChanged) {
        Logger.info('🔄 Interested in changed, clearing cache and reloading...');
        processedIds.current.clear();
        setProfiles([]);
        setHasMore(true);
        setHasInitialized(false);
      }

      // Store current interestedIn for next comparison
      prevInterestedInRef.current = userProfile.interestedIn;

      // Load profiles only if not already initialized or if interestedIn changed
      if (!hasInitialized || interestedInChanged) {
        loadInitialProfiles();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, userProfile, filtersLoaded]);

  // Refresh when screen comes into focus to catch any matches from other screens
  useFocusEffect(
    useCallback(() => {
      // If we have profiles and we're not loading, check if we need to remove any
      if (profiles.length > 0 && !loading && hasInitialized) {
        // The backend will handle exclusions, but we should check if current profiles need updating
        Logger.info('📱 People screen focused - checking for updates');

        // Filter out any profiles that have been processed (matched/swiped) from other screens
        setProfiles(prev => {
          const filtered = prev.filter(p => !processedIds.current.has(p.id));
          if (filtered.length < prev.length) {
            Logger.info(`📱 Removed ${prev.length - filtered.length} already-processed profiles`);
          }
          return filtered;
        });
      }
    }, [profiles.length, loading, hasInitialized])
  );

  // Show the "It's a match!" modal, but only once per matchId. Dedup is
  // necessary because the new-match WebSocket event can replay on socket
  // reconnect (typical on app foreground/background) and re-trigger this
  // handler for a match the user has already seen.
  // Declared BEFORE the useEffects/useCallbacks that reference it in their
  // dep arrays — otherwise the dep-array evaluation hits the const in its
  // temporal dead zone on every render and throws.
  const triggerMatchModal = useCallback(matchInfo => {
    const { matchId } = matchInfo;
    if (matchId && seenMatchIds.current.has(matchId)) {
      Logger.debug(`🎉 Suppressing duplicate match modal for matchId=${matchId}`);
      return;
    }
    if (matchId) {
      seenMatchIds.current.add(matchId);
    }
    setMatchedUser(matchInfo);
    setShowMatchModal(true);
  }, []);

  // Listen for real-time match events
  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = SocketService.onMatch((event, data) => {
      if (event === 'new-match' && data?.matchedUser) {
        Logger.info('🎉 New match received:', data);

        // Add matched user to processed IDs to prevent showing them again
        if (data.matchedUser.id) {
          processedIds.current.add(data.matchedUser.id);

          // Also remove from current profiles if they're in the stack
          setProfiles(prev => prev.filter(p => p.id !== data.matchedUser.id));
        }

        triggerMatchModal({
          id: data.matchedUser.id,
          name: data.matchedUser.name,
          photo: data.matchedUser.mainPhoto || null,
          matchId: data.matchId, // Include matchId from WebSocket event
        });
      }
    });

    return () => unsubscribe();
  }, [user?.uid, triggerMatchModal]);

  // Load initial batch of profiles
  const loadInitialProfiles = async (customFilters = null) => {
    const filtersToUse = customFilters || filters;
    setLoading(true);
    try {
      Logger.info('📱 Loading initial profiles batch...');
      const result = await ApiDataService.getUsersForDiscovery({
        limit: BATCH_SIZE,
        excludeIds: [], // Let the backend handle all exclusions based on database state
        filters: {
          ageRange: { min: filtersToUse.minAge, max: filtersToUse.maxAge },
          maxDistance: filtersToUse.maxDistance,
          strictAge: filtersToUse.strictAge || false,
          strictDistance: filtersToUse.strictDistance || false,
          onlyWithPhotos: true, // Always require photos
          relationshipType: filtersToUse.relationshipType,
          strictRelationshipType: filtersToUse.strictRelationshipType || false,
          education: filtersToUse.education,
          strictEducation: filtersToUse.strictEducation || false,
          smoking: filtersToUse.smoking,
          strictSmoking: filtersToUse.strictSmoking || false,
          drinking: filtersToUse.drinking,
          strictDrinking: filtersToUse.strictDrinking || false,
          languages: filtersToUse.languages,
          strictLanguages: filtersToUse.strictLanguages || false,
        },
      });

      if (result && result.length > 0) {
        // Backend already excludes swiped users, just filter session duplicates
        const newProfiles = result.filter(p => {
          if (processedIds.current.has(p.id)) {
            Logger.warn(`Duplicate profile ${p.id} filtered out`);
            return false;
          }
          return true;
        });

        // Log all profiles being shown
        Logger.info(`🎴 People Tab: Loading ${newProfiles.length} profiles:`);
        newProfiles.forEach((p, index) => {
          Logger.info(
            `  ${index + 1}. ${p.name} (ID: ${p.id}, Age: ${p.age}, Gender: ${p.gender})`
          );
        });

        setProfiles(newProfiles);
        setHasMore(newProfiles.length === BATCH_SIZE);
        setError(null);
        Logger.success(`✅ Loaded ${newProfiles.length} initial profiles`);
      } else {
        Logger.warn('No profiles available');
        setHasMore(false);
        setError(null);
      }
    } catch (loadProfilesErr) {
      Logger.error('Failed to load profiles:', loadProfilesErr);

      // Handle specific discovery eligibility errors with robust API error parsing
      const errorCode =
        loadProfilesErr.response?.data?.error ||
        loadProfilesErr.message ||
        loadProfilesErr.toString();

      if (errorCode === 'PROFILE_INCOMPLETE' || errorCode.includes('PROFILE_INCOMPLETE')) {
        showError('Please complete your profile to use discovery');
        // Navigate to profile setup
        navigation.navigate('Profile', { screen: 'ProfileMain' });
      } else if (errorCode === 'PHOTOS_REQUIRED' || errorCode.includes('PHOTOS_REQUIRED')) {
        showError('Please add at least one photo to use discovery');
        navigation.navigate('Profile', { screen: 'ProfileMain' });
      } else if (errorCode === 'LOCATION_REQUIRED' || errorCode.includes('LOCATION_REQUIRED')) {
        showError('Please enable location to find matches near you');
        navigation.navigate('Profile', { screen: 'ProfileMain' });
      } else if (errorCode === 'NOT_DISCOVERABLE' || errorCode.includes('NOT_DISCOVERABLE')) {
        showError('Please verify your email to use discovery');
      } else {
        showError('Failed to load profiles. Please try again.');
        setError('Failed to load profiles. Please try again.');
      }
    } finally {
      setLoading(false);
      setHasInitialized(true); // Mark as initialized after first load
    }
  };

  // Load more profiles when running low
  const loadMoreProfiles = useCallback(async () => {
    // Don't load more if we haven't initialized yet or already loading
    if (!hasInitialized || loading || isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    try {
      Logger.info('📱 Loading more profiles...');
      const result = await ApiDataService.getUsersForDiscovery({
        limit: BATCH_SIZE,
        excludeIds: [], // Let the backend handle all exclusions based on database state
        filters: {
          ageRange: { min: filters.minAge, max: filters.maxAge },
          maxDistance: filters.maxDistance,
          strictAge: filters.strictAge || false,
          strictDistance: filters.strictDistance || false,
          onlyWithPhotos: true, // Always require photos
          relationshipType: filters.relationshipType,
          strictRelationshipType: filters.strictRelationshipType || false,
          education: filters.education,
          strictEducation: filters.strictEducation || false,
          smoking: filters.smoking,
          strictSmoking: filters.strictSmoking || false,
          drinking: filters.drinking,
          strictDrinking: filters.strictDrinking || false,
          languages: filters.languages,
          strictLanguages: filters.strictLanguages || false,
        },
      });

      if (result && result.length > 0) {
        // Backend already excludes swiped users, just filter session duplicates
        const newProfiles = result.filter(p => {
          if (processedIds.current.has(p.id)) {
            Logger.warn(`Duplicate profile ${p.id} filtered out`);
            return false;
          }
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
    } catch (loadMoreErr) {
      Logger.error('Failed to load more profiles:', loadMoreErr);
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasInitialized, loading, isLoadingMore, hasMore, filters]);

  // Handle swipe left (pass)
  const handleSwipeLeft = useCallback(async profile => {
    try {
      Logger.info(`👈 Swiped left on ${profile.name}`);
      trackSwipeLeft();

      // Mark as processed to avoid showing again in this session
      processedIds.current.add(profile.id);

      // Fire and forget - don't wait for API response
      ApiDataService.passUser(profile.id).catch(passErr => {
        Logger.error('Failed to save pass:', passErr);
      });
    } catch (swipeLeftErr) {
      Logger.error('Error handling swipe left:', swipeLeftErr);
    }
  }, []);

  // Handle swipe right (like)
  const handleSwipeRight = useCallback(
    async profile => {
      try {
        Logger.info(`👉 Swiped right on ${profile.name} (ID: ${profile.id})`);
        Logger.info(
          `💭 Profile details: Age ${profile.age}, Gender: ${profile.gender}, Location: ${profile.location}`
        );
        trackSwipeRight();

        // Mark as processed to avoid showing again in this session
        processedIds.current.add(profile.id);

        // Send like to API
        const result = await ApiDataService.likeUser(profile.id);

        if (result.success) {
          if (result.isMatch) {
            Logger.info(`🎉 MATCH! ${profile.name} had already liked you!`);
            Logger.info(`🔗 Match ID: ${result.match?.id}`);
            trackMatchCreated();

            // Show match modal with match details
            triggerMatchModal({
              id: profile.id,
              name: profile.name,
              photo: getUserProfilePhoto(profile),
              matchId: result.match?.id, // Include the match ID for navigation
            });
            // Don't show toast - the modal is enough notification
          } else {
            Logger.info(`💌 Like sent to ${profile.name} - waiting for them to like back`);
          }
        } else {
          Logger.error('Failed to save like:', result);
          // If user already acted on this profile, don't show error
          // This can happen if they matched from LikedYou and the profile wasn't removed yet
          if (
            result.error?.includes('already acted') ||
            result.message?.includes('already acted')
          ) {
            Logger.warn(`User already acted on ${profile.name}, silently skipping`);
            return;
          }
        }
      } catch (swipeRightErr) {
        Logger.error('Error handling swipe right:', swipeRightErr);
        // Don't show error to user for "already acted" cases
        // This can happen if they matched from LikedYou and the profile wasn't removed yet
        if (
          swipeRightErr.message?.includes('already acted') ||
          swipeRightErr.message?.includes('already swiped')
        ) {
          Logger.warn('User already acted on this person, silently skipping');
          return;
        }
        // Out of likes is not an error — it's the premium pitch
        if (
          swipeRightErr.code === 'DAILY_LIMIT_REACHED' ||
          swipeRightErr.code === 'PREMIUM_REQUIRED'
        ) {
          setShowUpgradeModal(true);
          return;
        }
        showError('Failed to save like. Please try again.');
      }
    },
    [showError, triggerMatchModal]
  );

  // Handle super like (premium feature)
  const handleSwipeSuperLike = useCallback(
    async profile => {
      try {
        Logger.info(`⭐ Super liked ${profile.name} (ID: ${profile.id})`);
        trackSuperLike();

        // Mark as processed to avoid showing again in this session
        processedIds.current.add(profile.id);

        // Send super like to API
        const result = await ApiDataService.superLikeUser(profile.id);

        if (result.success) {
          if (result.isMatch) {
            Logger.info(`🎉 SUPER MATCH! ${profile.name} had already liked you!`);
            trackMatchCreated();

            // Show match modal
            triggerMatchModal({
              id: profile.id,
              name: profile.name,
              photo: getUserProfilePhoto(profile),
              matchId: result.match?.id,
            });
          } else {
            Logger.info(`💫 Super Like sent to ${profile.name}`);
            showSuccess('Super Like sent!');
          }
        } else {
          Logger.error('Failed to save super like:', result);
          if (result.error === 'PREMIUM_REQUIRED') {
            setShowUpgradeModal(true);
          } else if (result.error === 'DAILY_LIMIT_REACHED') {
            showError("You've used all your Super Likes for today");
          }
        }
      } catch (superLikeErr) {
        Logger.error('Error handling super like:', superLikeErr);
        if (superLikeErr.message?.includes('already acted')) {
          Logger.warn('User already acted on this person, silently skipping');
          return;
        }
        showError('Failed to send Super Like. Please try again.');
      }
    },
    [showError, showSuccess, triggerMatchModal]
  );

  // Handle undo (premium feature)
  const handleUndo = useCallback(async () => {
    try {
      Logger.info('↩️ Attempting to undo last action...');

      const result = await ApiDataService.undoLastAction();

      if (result.success) {
        Logger.success('✅ Undo successful');
        // Remove the undone profile from our processed set so it can show again
        if (result.undoneAction?.receiverId) {
          processedIds.current.delete(result.undoneAction.receiverId);
        }
        return { success: true };
      } else {
        Logger.error('❌ Undo failed:', result.message);
        if (result.error === 'PREMIUM_REQUIRED') {
          setShowUpgradeModal(true);
        } else {
          showError(result.message || 'Failed to undo');
        }
        return { success: false, error: result.error };
      }
    } catch (undoErr) {
      Logger.error('Error handling undo:', undoErr);
      showError('Failed to undo. Please try again.');
      return { success: false, error: undoErr.message };
    }
  }, [showError]);

  // Handle photo press - show fullscreen viewer
  const handlePhotoPress = useCallback((photos, index) => {
    const images = photos.map(uri => ({ uri }));
    setPhotoViewerImages(images);
    setPhotoViewerIndex(index);
    setPhotoViewerVisible(true);
  }, []);

  // Handle match modal actions
  const handleSendMessage = useCallback(() => {
    setShowMatchModal(false);

    // Capture the matched user data before clearing
    const userToNavigate = matchedUser;
    setMatchedUser(null); // Clear matched user after capturing

    // Small delay to ensure modal closes before navigation
    setTimeout(() => {
      if (userToNavigate) {
        // Navigate directly to the chat with this match
        const matchData = {
          matchId: userToNavigate.matchId,
          otherUser: {
            id: userToNavigate.id,
            name: userToNavigate.name,
            mainPhoto: userToNavigate.photo,
            photos: userToNavigate.photo ? [{ url: userToNavigate.photo }] : [],
          },
        };
        navigateToChat(matchData);
      }
    }, 100);
  }, [matchedUser, navigateToChat]);

  const handleKeepSwiping = useCallback(() => {
    setShowMatchModal(false);
    setMatchedUser(null);
  }, []);

  // Don't show discovery if profile is incomplete
  if (userProfile && !isProfileComplete()) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.incompleteProfileContainer}>
          <View style={styles.incompleteIconContainer}>
            <Ionicons name="heart-outline" size={60} color={theme.colors.primary} />
          </View>
          <Text style={styles.incompleteTitle}>Almost there!</Text>
          <Text style={styles.incompleteSubtitle}>
            Complete your profile to start discovering amazing people nearby
          </Text>
          <TouchableOpacity
            style={styles.completeProfileButton}
            onPress={() => setShowSetupModal(true)}
          >
            <Ionicons
              name="sparkles"
              size={20}
              color={theme.colors.text.white}
              style={{ marginRight: 8 }}
            />
            <Text style={styles.completeProfileButtonText}>Complete Profile</Text>
          </TouchableOpacity>
        </View>

        <ProfileSetupModal
          visible={showSetupModal}
          onClose={() => setShowSetupModal(false)}
          onComplete={async () => {
            setShowSetupModal(false);
            if (refreshUserProfile) {
              setTimeout(() => {
                refreshUserProfile();
              }, 500);
            }
          }}
          userProfile={userProfile}
        />
      </SafeAreaView>
    );
  }

  // Check if user has photos (only after profile is complete)
  if (!userProfile?.photos || userProfile.photos.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.noPhotosContainer}>
          <Ionicons name="camera-outline" size={80} color={theme.colors.border.medium} />
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
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingScreen message="Finding people near you..." />
      </SafeAreaView>
    );
  }

  // Error state
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <ErrorScreen message={error} onRetry={() => loadInitialProfiles()} />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      {/* Filter Button - positioned below tab navigator title */}
      <TouchableOpacity
        style={[styles.filterButton, { top: insets.top + 10 }]}
        onPress={() =>
          navigation.navigate('Filter', {
            userPreferences: filters,
            onSavePreferences: newFilters => {
              // FilterScreen already saves to API and AsyncStorage
              // Just update local state and reload profiles
              setFilters(newFilters);
              processedIds.current.clear();
              setProfiles([]);
              setHasMore(true);
              setHasInitialized(false);
              loadInitialProfiles(newFilters);
            },
          })
        }
      >
        <Ionicons name="options-outline" size={24} color={theme.colors.text.secondary} />
      </TouchableOpacity>

      {/* Fullscreen Card Stack */}
      <View style={styles.cardStackContainer}>
        {profiles.length === 0 && hasInitialized && !loading && !error ? (
          <EmptyState
            icon="heart-outline"
            title="No more profiles nearby"
            subtitle="Try adjusting your filters or check back later"
            draggableIcon={true}
            action={{
              text: 'Adjust Filters',
              onPress: () =>
                navigation.navigate('Filter', {
                  userPreferences: filters,
                  onSavePreferences: newFilters => {
                    setFilters(newFilters);
                    processedIds.current.clear();
                    setProfiles([]);
                    setHasMore(true);
                    setHasInitialized(false);
                    loadInitialProfiles(newFilters);
                  },
                }),
            }}
            style={{ flex: 1 }}
          />
        ) : (
          <SwipeableCardStack
            ref={cardStackRef}
            profiles={profiles}
            onSwipeLeft={handleSwipeLeft}
            onSwipeRight={handleSwipeRight}
            onSwipeSuperLike={handleSwipeSuperLike}
            onUndo={handleUndo}
            onNeedMore={loadMoreProfiles}
            onPhotoPress={handlePhotoPress}
            loadingMore={isLoadingMore}
          />
        )}
      </View>

      {/* Floating Action Buttons */}
      {profiles.length > 0 && (
        <View style={[styles.actionButtons, { bottom: 10 }]}>
          <TouchableOpacity
            style={[styles.actionButton, styles.undoButton]}
            onPress={async () => {
              if (!isPremium) {
                setShowUpgradeModal(true);
              } else {
                const result = await cardStackRef.current?.undo?.();
                if (result?.success) {
                  showSuccess('Undo successful!');
                } else if (result?.error === 'NO_SWIPE_TO_UNDO') {
                  showError('No recent swipe to undo');
                }
              }
            }}
          >
            <Ionicons name="arrow-undo" size={24} color={theme.colors.action.rewind} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.passButton]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              cardStackRef.current?.swipeLeft();
            }}
          >
            <Ionicons name="close" size={35} color={theme.colors.action.nope} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.superLikeButton]}
            onPress={() => {
              if (!isPremium) {
                setShowUpgradeModal(true);
              } else {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                cardStackRef.current?.swipeSuperLike();
              }
            }}
          >
            <Ionicons name="star" size={28} color={theme.colors.action.superlike} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.likeButton]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              cardStackRef.current?.swipeRight();
            }}
          >
            <Ionicons name="heart" size={30} color={theme.colors.action.like} />
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

      {/* Premium Upgrade Modal */}
      <PremiumUpgradeModal visible={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />

      {/* Fullscreen Photo Viewer - rendered at screen level to avoid gesture conflicts */}
      {photoViewerVisible && (
        <ImageViewing
          key={`photo-viewer-${photoViewerIndex}`}
          images={photoViewerImages}
          imageIndex={photoViewerIndex}
          visible={photoViewerVisible}
          onRequestClose={() => setPhotoViewerVisible(false)}
          swipeToCloseEnabled={true}
          doubleTapToZoomEnabled={true}
          animationType="none"
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.secondary,
  },
  filterButton: {
    position: 'absolute',
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 8,
  },
  cardStackContainer: {
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 100,
  },
  actionButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 10,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 8,
  },
  passButton: {
    borderWidth: 2,
    borderColor: theme.colors.action.nope,
  },
  likeButton: {
    borderWidth: 2,
    borderColor: theme.colors.action.like,
  },
  superLikeButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: theme.colors.action.superlike,
  },
  undoButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: theme.colors.action.rewind,
  },
  noPhotosContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  incompleteProfileContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    backgroundColor: theme.colors.background.primary,
  },
  incompleteIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: `${theme.colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  incompleteTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    fontFamily: theme.typography.fontFamily.display,
    color: theme.colors.text.primary,
    marginBottom: 12,
  },
  incompleteSubtitle: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  completeProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 30,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  completeProfileButtonText: {
    color: theme.colors.text.white,
    fontSize: 18,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamily.semibold,
  },
  noPhotosTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: theme.typography.fontFamily.heading,
    marginTop: 20,
    marginBottom: 10,
  },
  noPhotosSubtitle: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginBottom: 30,
  },
  addPhotosButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  addPhotosButtonText: {
    color: theme.colors.text.white,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamily.semibold,
  },
});

export default PeopleScreenOptimized;
