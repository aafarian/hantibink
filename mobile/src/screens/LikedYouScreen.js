import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  Image,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useIsPremium, useFeatureFlags } from '../contexts/FeatureFlagsContext';
import ApiDataService from '../services/ApiDataService';
import apiClient from '../services/ApiClient';
import SocketService from '../services/SocketService';
import MatchModal from '../components/MatchModal';
import Logger from '../utils/logger';
import { useTabNavigation } from '../hooks/useTabNavigation';

const { width: screenWidth } = Dimensions.get('window');
const CARD_WIDTH = (screenWidth - 30) / 2; // 2 columns with padding

const LikedYouScreen = () => {
  const { user, userProfile } = useAuth();
  const { showError, showSuccess, showInfo } = useToast();
  const isPremium = useIsPremium();
  const { togglePremiumForTesting } = useFeatureFlags();
  const { navigateToMessages } = useTabNavigation();

  const [incomingLikes, setIncomingLikes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchedUser, setMatchedUser] = useState(null);
  const [pendingMatchToast, setPendingMatchToast] = useState(false);
  const [hasShownUpgradeHint, setHasShownUpgradeHint] = useState(false);
  const timeoutRef = useRef(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Fetch users who liked the current user
  const fetchWhoLikedMe = useCallback(async () => {
    try {
      const response = await apiClient.get('/actions/who-liked-me?limit=50');

      // ApiClient returns { success: true, data: actualApiResponse }
      // The actual API response has { success, message, data: likesArray }
      if (response.success && response.data) {
        // Extract the likes array from the nested structure
        const responseData = response.data.data || [];

        // Ensure data is an array
        if (!Array.isArray(responseData)) {
          setIncomingLikes([]);
          return;
        }

        // Transform the data to match our UI expectations
        const likes = responseData.map(item => {
          return {
            id: item.user.id,
            actionId: item.actionId,
            name: item.user.name,
            age: item.user.age || '?',
            location: item.user.location || 'Unknown location',
            bio: item.user.bio || 'No bio available',
            photos: item.user.photos || [],
            mainPhoto:
              item.user.photos?.find(p => p.isMain)?.url ||
              item.user.photos?.[0]?.url ||
              'https://via.placeholder.com/150',
            isSuperLike: item.actionType === 'SUPER_LIKE',
            likedAt: item.likedAt,
            isNew: false, // You could track this with timestamps
          };
        });

        setIncomingLikes(likes);

        if (likes.length > 0 && !isPremium && !hasShownUpgradeHint) {
          // Subtle nudge for non-premium users - only show once per session
          setHasShownUpgradeHint(true);
          // Clear any existing timeout
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          timeoutRef.current = setTimeout(() => {
            showInfo(`${likes.length} people liked you! Upgrade to see who they are 👀`);
            timeoutRef.current = null;
          }, 1000);
        }
      } else {
        setIncomingLikes([]);
      }
    } catch (error) {
      Logger.error('Failed to fetch who liked me:', error);
      // Only show toast, suppress expo error
      if (error.message) {
        showError('Could not load likes. Pull down to retry.');
      }
      setIncomingLikes([]);
    } finally {
      setLoading(false);
    }
  }, [isPremium, showInfo, showError, hasShownUpgradeHint]);

  useEffect(() => {
    if (user?.uid) {
      fetchWhoLikedMe();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]); // Intentionally exclude fetchWhoLikedMe to prevent infinite loop

  // Listen for real-time updates from Socket.IO
  useEffect(() => {
    if (!user?.uid) return;

    // Subscribe to liked-you updates
    const unsubscribe = SocketService.onLikedYouUpdate((event, data) => {
      if (event === 'liked-you-update' && data) {
        if (data.action === 'remove' && data.userId) {
          // Remove the user from the incoming likes list
          setIncomingLikes(prev => {
            const filtered = prev.filter(like => like.id !== data.userId);
            return filtered;
          });

          // Show toast after state update using setTimeout to avoid the warning
          if (data.reason === 'matched') {
            // Set flag to show toast later instead of checking showMatchModal directly
            setPendingMatchToast(true);
          }

          // If the removed user was selected, close the modal
          if (selectedUser?.id === data.userId) {
            setSelectedUser(null);
          }
        } else if (data.action === 'add' && data.user) {
          // Add a new like to the list (for future use when someone likes you)
          setIncomingLikes(prev => {
            // Check if this user already exists in the list
            const existingLike = prev.find(like => like.id === data.user.id);
            if (existingLike) {
              // User already in list, don't add duplicate
              return prev;
            }

            const newLike = {
              id: data.user.id,
              actionId: data.actionId,
              name: data.user.name,
              age: data.user.age || '?',
              location: data.user.location || 'Unknown location',
              bio: data.user.bio || 'No bio available',
              photos: data.user.photos || [],
              mainPhoto:
                data.user.photos?.find(p => p.isMain)?.url ||
                data.user.photos?.[0]?.url ||
                'https://via.placeholder.com/150',
              isSuperLike: data.actionType === 'SUPER_LIKE',
              likedAt: data.likedAt,
              isNew: true,
            };

            // Only show toast if this is truly a new like
            if (!existingLike) {
              // Use setTimeout to avoid React state update warnings
              setTimeout(() => {
                showInfo('Someone new liked you! 💕');
              }, 100);
            }

            // Add to beginning of list to show new likes first
            return [newLike, ...prev];
          });
        }
      }
    });

    // Subscribe to match events
    const unsubscribeMatch = SocketService.onMatch((event, data) => {
      if (event === 'new-match' && data) {
        // If we matched with someone from the liked you list, remove them
        if (data.matchedUser?.id) {
          setIncomingLikes(prev => prev.filter(like => like.id !== data.matchedUser.id));
        }
      }
    });

    return () => {
      unsubscribe();
      unsubscribeMatch();
    };
  }, [user?.uid, selectedUser, showSuccess, showInfo]);

  // Handle pending match toast separately
  useEffect(() => {
    if (pendingMatchToast && !showMatchModal) {
      showSuccess("It's a match! 🎉 Check your messages to start chatting!");
      setPendingMatchToast(false);
    }
  }, [pendingMatchToast, showMatchModal, showSuccess]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchWhoLikedMe();
    setRefreshing(false);
  };

  const handleLikeBack = async profile => {
    if (!isPremium) {
      setShowUpgradeModal(true);
      return;
    }

    try {
      const result = await ApiDataService.likeUser(profile.id);

      if (result.success) {
        // Close the user detail modal first if it's open
        if (selectedUser) {
          setSelectedUser(null);
        }

        if (result.isMatch) {
          // Set matched user and show match modal
          setMatchedUser({
            id: profile.id,
            name: profile.name,
            photo: profile.mainPhoto,
          });
          // Show match modal immediately without delay
          setShowMatchModal(true);
        } else {
          showSuccess('Like sent back! 💘');
        }

        // Remove from incoming likes
        setIncomingLikes(prev => prev.filter(like => like.id !== profile.id));
      }
    } catch (error) {
      Logger.error('Failed to like back:', error);
      showError('Could not like back. Please try again.');
    }
  };

  const handlePass = async profile => {
    if (!isPremium) {
      setShowUpgradeModal(true);
      return;
    }

    try {
      const result = await ApiDataService.passUser(profile.id);

      if (result.success) {
        // Remove from incoming likes with animation
        setIncomingLikes(prev => prev.filter(like => like.id !== profile.id));
        setSelectedUser(null);
      }
    } catch (error) {
      Logger.error('Failed to pass:', error);
      showError('Could not pass. Please try again.');
    }
  };

  const renderLikeCard = ({ item, index }) => {
    const isEven = index % 2 === 0;

    return (
      <TouchableOpacity
        style={[styles.likeCard, isEven && styles.leftCard]}
        onPress={() => (isPremium ? setSelectedUser(item) : setShowUpgradeModal(true))}
        activeOpacity={0.9}
      >
        {item.isSuperLike && (
          <View style={styles.superLikeBadge}>
            <Ionicons name="star" size={16} color="#FFD700" />
          </View>
        )}

        {item.isNew && (
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>NEW</Text>
          </View>
        )}

        <View style={styles.imageContainer}>
          {/* Show blurred/pixelated image for non-premium users */}
          {!isPremium ? (
            <Image
              source={{ uri: item.mainPhoto }}
              style={styles.cardImage}
              blurRadius={40} // Strong blur for maximum privacy
            />
          ) : (
            <Image source={{ uri: item.mainPhoto }} style={styles.cardImage} />
          )}

          {!isPremium && (
            <View style={styles.blurOverlay}>
              <View style={styles.lockCircle}>
                <Ionicons name="lock-closed" size={24} color="white" />
              </View>
            </View>
          )}

          {isPremium && (
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.gradient}>
              <Text style={styles.cardName}>
                {item.name}, {item.age}
              </Text>
              <Text style={styles.cardLocation}>
                <Ionicons name="location-outline" size={12} color="white" /> {item.location}
              </Text>
            </LinearGradient>
          )}
        </View>

        {isPremium && (
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={[styles.quickActionButton, styles.passQuickButton]}
              onPress={e => {
                e.stopPropagation();
                handlePass(item);
              }}
            >
              <Ionicons name="close" size={20} color="#FF6B6B" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickActionButton, styles.likeQuickButton]}
              onPress={e => {
                e.stopPropagation();
                handleLikeBack(item);
              }}
            >
              <Ionicons name="heart" size={20} color="#4ECDC4" />
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerContent}>
        <Text style={styles.headerTitle}>Who Liked You</Text>
        <View style={styles.likeCountBadge}>
          <Text style={styles.likeCountText}>{incomingLikes.length}</Text>
        </View>
      </View>

      {/* 🧪 Development Premium Toggle */}
      {__DEV__ && togglePremiumForTesting && (
        <TouchableOpacity style={styles.debugToggle} onPress={togglePremiumForTesting}>
          <Text style={styles.debugText}>
            🧪 {isPremium ? '💎 PREMIUM' : '🆓 FREE'} (Tap to toggle)
          </Text>
        </TouchableOpacity>
      )}

      {!isPremium && incomingLikes.length > 0 && (
        <TouchableOpacity style={styles.upgradeButton} onPress={() => setShowUpgradeModal(true)}>
          <LinearGradient
            colors={['#FFD700', '#FFA500']}
            style={styles.upgradeGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons name="star" size={16} color="white" />
            <Text style={styles.upgradeButtonText}>See Who Liked You</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {isPremium && (
        <View style={styles.premiumBadge}>
          <Ionicons name="star" size={14} color="#FFD700" />
          <Text style={styles.premiumText}>PREMIUM</Text>
        </View>
      )}
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <Ionicons name="heart-outline" size={80} color="#E0E0E0" />
      </View>
      <Text style={styles.emptyTitle}>No Likes Yet</Text>
      <Text style={styles.emptySubtitle}>
        Don't worry! Keep swiping and updating your profile to get more likes.
      </Text>
      <View style={styles.tipContainer}>
        <Text style={styles.tipTitle}>💡 Pro Tips:</Text>
        <Text style={styles.tipText}>• Add more photos to your profile</Text>
        <Text style={styles.tipText}>• Write an interesting bio</Text>
        <Text style={styles.tipText}>• Be active and swipe daily</Text>
      </View>
    </View>
  );

  // User detail modal
  const renderUserModal = () => (
    <Modal
      visible={!!selectedUser && isPremium}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setSelectedUser(null)}
    >
      {selectedUser && (
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.modalClose} onPress={() => setSelectedUser(null)}>
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>

            <Image source={{ uri: selectedUser.mainPhoto }} style={styles.modalImage} />

            <View style={styles.modalInfo}>
              <Text style={styles.modalName}>
                {selectedUser.name}, {selectedUser.age}
              </Text>
              <Text style={styles.modalLocation}>
                <Ionicons name="location" size={16} color="#666" /> {selectedUser.location}
              </Text>
              <Text style={styles.modalBio}>{selectedUser.bio}</Text>

              {selectedUser.isSuperLike && (
                <View style={styles.superLikeInfo}>
                  <Ionicons name="star" size={20} color="#FFD700" />
                  <Text style={styles.superLikeText}>They Super Liked You!</Text>
                </View>
              )}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.passButton]}
                onPress={() => handlePass(selectedUser)}
              >
                <Ionicons name="close" size={24} color="#FF6B6B" />
                <Text style={styles.passButtonText}>Pass</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.likeButton]}
                onPress={() => handleLikeBack(selectedUser)}
              >
                <Ionicons name="heart" size={24} color="white" />
                <Text style={styles.likeButtonText}>Like Back</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </Modal>
  );

  // Upgrade modal
  const renderUpgradeModal = () => (
    <Modal
      visible={showUpgradeModal}
      animationType="fade"
      transparent={true}
      onRequestClose={() => setShowUpgradeModal(false)}
    >
      <View style={styles.upgradeModalContainer}>
        <View style={styles.upgradeModalContent}>
          <LinearGradient colors={['#FFD700', '#FFA500']} style={styles.upgradeModalHeader}>
            <Ionicons name="star" size={40} color="white" />
            <Text style={styles.upgradeModalTitle}>Unlock Premium</Text>
          </LinearGradient>

          <View style={styles.upgradeFeatures}>
            <View style={styles.featureItem}>
              <Ionicons name="eye" size={24} color="#4ECDC4" />
              <Text style={styles.featureText}>See who liked you</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="heart" size={24} color="#FF6B6B" />
              <Text style={styles.featureText}>Unlimited likes</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="arrow-undo" size={24} color="#9C27B0" />
              <Text style={styles.featureText}>Undo swipes</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="star" size={24} color="#FFD700" />
              <Text style={styles.featureText}>5 Super Likes per day</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.upgradeModalButton}>
            <LinearGradient
              colors={['#FF6B6B', '#FF8E53']}
              style={styles.upgradeModalButtonGradient}
            >
              <Text style={styles.upgradeModalButtonText}>Get Premium</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.upgradeModalClose}
            onPress={() => setShowUpgradeModal(false)}
          >
            <Text style={styles.upgradeModalCloseText}>Maybe Later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="heart" size={40} color="#FF6B6B" />
        <Text style={styles.loadingText}>Loading likes...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#FF6B6B']}
            tintColor="#FF6B6B"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {renderHeader()}

        {incomingLikes.length > 0 ? (
          <FlatList
            data={incomingLikes}
            renderItem={renderLikeCard}
            keyExtractor={item => item.actionId || item.id}
            numColumns={2}
            scrollEnabled={false}
            contentContainerStyle={styles.gridContainer}
            columnWrapperStyle={styles.row}
          />
        ) : (
          renderEmptyState()
        )}
      </ScrollView>

      {renderUserModal()}
      {renderUpgradeModal()}

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
          // Ensure user detail modal is closed as safety measure
          if (selectedUser) {
            setSelectedUser(null);
          }
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
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: 'white',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  likeCountBadge: {
    backgroundColor: '#FF6B6B',
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  likeCountText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  upgradeButton: {
    marginTop: 10,
  },
  upgradeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
  },
  upgradeButtonText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 16,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8DC',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    alignSelf: 'flex-start',
  },
  premiumText: {
    color: '#FFD700',
    fontWeight: 'bold',
    marginLeft: 4,
    fontSize: 12,
  },
  gridContainer: {
    padding: 10,
  },
  row: {
    justifyContent: 'space-between',
  },
  likeCard: {
    width: CARD_WIDTH,
    marginBottom: 15,
    borderRadius: 15,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  leftCard: {
    marginRight: 10,
  },
  imageContainer: {
    position: 'relative',
    height: CARD_WIDTH * 1.3,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  blurOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)', // Slight dark overlay for better contrast
  },
  lockCircle: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 30,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 15,
  },
  cardName: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  cardLocation: {
    color: 'white',
    fontSize: 12,
  },
  superLikeBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#FFD700',
    borderRadius: 15,
    padding: 6,
    zIndex: 1,
  },
  newBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#4ECDC4',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    zIndex: 1,
  },
  newBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 10,
  },
  quickActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  passQuickButton: {
    backgroundColor: '#FFE5E5',
  },
  likeQuickButton: {
    backgroundColor: '#E5F9F9',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyIconContainer: {
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  tipContainer: {
    backgroundColor: '#FFF8DC',
    padding: 20,
    borderRadius: 15,
    width: '100%',
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  tipText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    maxHeight: '80%',
  },
  modalClose: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 1,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 5,
  },
  modalImage: {
    width: '100%',
    height: 300,
  },
  modalInfo: {
    padding: 20,
  },
  modalName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  modalLocation: {
    fontSize: 16,
    color: '#666',
    marginBottom: 15,
  },
  modalBio: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },
  superLikeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8DC',
    padding: 10,
    borderRadius: 10,
    marginTop: 15,
  },
  superLikeText: {
    marginLeft: 8,
    color: '#FFD700',
    fontWeight: 'bold',
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 15,
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 25,
  },
  passButton: {
    backgroundColor: '#FFE5E5',
  },
  passButtonText: {
    color: '#FF6B6B',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  likeButton: {
    backgroundColor: '#4ECDC4',
  },
  likeButtonText: {
    color: 'white',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  upgradeModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  upgradeModalContent: {
    backgroundColor: 'white',
    borderRadius: 25,
    width: '85%',
    overflow: 'hidden',
  },
  upgradeModalHeader: {
    alignItems: 'center',
    padding: 30,
  },
  upgradeModalTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 10,
  },
  upgradeFeatures: {
    padding: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  featureText: {
    marginLeft: 15,
    fontSize: 16,
    color: '#333',
  },
  upgradeModalButton: {
    margin: 20,
  },
  upgradeModalButtonGradient: {
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: 'center',
  },
  upgradeModalButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  upgradeModalClose: {
    paddingVertical: 15,
    alignItems: 'center',
  },
  upgradeModalCloseText: {
    color: '#666',
    fontSize: 16,
  },
  debugToggle: {
    backgroundColor: '#FFE5E5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginVertical: 10,
  },
  debugText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FF6B6B',
  },
});

export default LikedYouScreen;
