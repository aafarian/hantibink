import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useIsPremium } from '../contexts/FeatureFlagsContext';
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
  const { navigateToChat } = useTabNavigation();

  const [incomingLikes, setIncomingLikes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchedUser, setMatchedUser] = useState(null);
  const [pendingMatchToast, setPendingMatchToast] = useState(false);
  const [hasShownUpgradeHint, setHasShownUpgradeHint] = useState(false);
  const [totalLikesCount, setTotalLikesCount] = useState(0); // Track the total count
  const timeoutRef = useRef(null);
  const BATCH_SIZE = 10;

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Fetch users who liked the current user with pagination
  const fetchWhoLikedMe = useCallback(
    async (isLoadMore = false) => {
      try {
        if (isLoadMore) {
          setLoadingMore(true);
        } else {
          setLoading(true);
        }

        const currentOffset = isLoadMore ? offset : 0;
        const response = await apiClient.get(
          `/actions/who-liked-me?limit=${BATCH_SIZE}&offset=${currentOffset}`
        );

        // ApiClient returns { success: true, data: actualApiResponse }
        // The actual API response has { success, message, data: likesArray, totalCount }
        if (response.success && response.data) {
          // Extract the likes array and total count from the response
          const responseData = response.data.data || [];
          const totalCount = response.data.totalCount || 0;
          const totalLikesCountFromAPI = response.data.totalLikesCount || 0;

          // Set the total count
          setTotalLikesCount(totalCount);
          Logger.info(`📊 Batch ${currentOffset}-${currentOffset + BATCH_SIZE}:`);
          Logger.info(`   • Total unacted likes: ${totalCount}`);
          Logger.info(`   • Total likes (including acted): ${totalLikesCountFromAPI}`);
          Logger.info(`   • Users in this batch: ${responseData.length}`);

          // Ensure data is an array
          if (!Array.isArray(responseData)) {
            if (!isLoadMore) {
              setIncomingLikes([]);
            }
            setHasMore(false);
            return;
          }

          // Transform the data to match our UI expectations
          const likes = responseData.map(item => {
            const likeData = {
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

            // Log each user that should appear in LikedYou
            Logger.info(
              `📋 LikedYou User: ${likeData.name} (ID: ${likeData.id}, Action: ${item.actionType}, Date: ${new Date(likeData.likedAt).toLocaleDateString()})`
            );

            return likeData;
          });

          if (isLoadMore) {
            // Filter out duplicates before setting state
            const existingIds = new Set(incomingLikes.map(u => u.id));
            const uniqueNewLikes = likes.filter(u => !existingIds.has(u.id));

            if (uniqueNewLikes.length < likes.length) {
              const duplicates = likes.filter(u => existingIds.has(u.id));
              Logger.warn(
                `🔄 Filtered out ${likes.length - uniqueNewLikes.length} duplicate users:`
              );
              duplicates.forEach(u => {
                Logger.warn(`   - ${u.name} (ID: ${u.id})`);
              });
            }

            if (uniqueNewLikes.length === 0) {
              Logger.info('📋 LikedYou: No new unique users in this batch (all duplicates)');
              // Still update offset to continue pagination
              setOffset(currentOffset + likes.length);
              return;
            }

            // Append to existing likes and re-sort everything
            setIncomingLikes(prev => {
              const newTotal = [...prev, ...uniqueNewLikes];

              // Count super likes before sorting
              const superLikesBefore = newTotal.filter(u => u.isSuperLike).length;
              Logger.info(
                `⭐ Before sort: ${superLikesBefore} Super Likes in list of ${newTotal.length}`
              );

              // Sort the entire list: Super Likes first, then by date
              newTotal.sort((a, b) => {
                // Super Likes come first
                if (a.isSuperLike && !b.isSuperLike) return -1;
                if (!a.isSuperLike && b.isSuperLike) return 1;
                // Within same type, sort by date (newest first)
                return new Date(b.likedAt) - new Date(a.likedAt);
              });

              // Log first 5 after sorting to verify order
              Logger.info(`📋 After sort - First 5 users:`);
              newTotal.slice(0, 5).forEach((u, i) => {
                Logger.info(`   ${i + 1}. ${u.name} ${u.isSuperLike ? '⭐ SUPER' : '❤️ regular'}`);
              });

              Logger.info(
                `📋 LikedYou: Appending ${uniqueNewLikes.length} unique users to existing ${prev.length} = ${newTotal.length} total loaded (sorted)`
              );

              return newTotal;
            });

            // Update offset by the number of unique users added
            setOffset(currentOffset + uniqueNewLikes.length);
          } else {
            // Initial load - sort the batch
            const superLikesInBatch = likes.filter(u => u.isSuperLike).length;
            Logger.info(
              `⭐ Initial batch: ${superLikesInBatch} Super Likes out of ${likes.length}`
            );

            likes.sort((a, b) => {
              // Super Likes come first
              if (a.isSuperLike && !b.isSuperLike) return -1;
              if (!a.isSuperLike && b.isSuperLike) return 1;
              // Within same type, sort by date (newest first)
              return new Date(b.likedAt) - new Date(a.likedAt);
            });

            // Log first 5 after sorting
            Logger.info(`📋 Initial sort - First 5 users:`);
            likes.slice(0, 5).forEach((u, i) => {
              Logger.info(`   ${i + 1}. ${u.name} ${u.isSuperLike ? '⭐ SUPER' : '❤️ regular'}`);
            });

            setIncomingLikes(likes);
            setOffset(likes.length);
            Logger.info(`📋 LikedYou: Initial load of ${likes.length} users (sorted)`);
          }

          // Check if there are more to load - use the totalCount from API response, not state
          const moreAvailable =
            likes.length === BATCH_SIZE && currentOffset + likes.length < totalCount;
          setHasMore(moreAvailable);

          Logger.info(
            `📋 Pagination state - hasMore: ${moreAvailable}, likes.length: ${likes.length}, BATCH_SIZE: ${BATCH_SIZE}, offset: ${currentOffset}, totalCount: ${totalCount}`
          );

          if (likes.length < BATCH_SIZE) {
            Logger.info(
              `📋 LikedYou: Reached end of list (loaded ${likes.length} of max ${BATCH_SIZE})`
            );
          } else if (!moreAvailable) {
            Logger.info(
              `📋 LikedYou: All users loaded (${currentOffset + likes.length} of ${totalCount})`
            );
          }

          if (!isLoadMore && likes.length > 0 && !isPremium && !hasShownUpgradeHint) {
            // Subtle nudge for non-premium users - only show once per session
            setHasShownUpgradeHint(true);
            // Clear any existing timeout
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
            }
            timeoutRef.current = setTimeout(() => {
              showInfo(`People have liked you! Upgrade to see who they are 👀`);
              timeoutRef.current = null;
            }, 1000);
          }
        } else {
          if (!isLoadMore) {
            setIncomingLikes([]);
          }
          setHasMore(false);
        }
      } catch (error) {
        Logger.error('Failed to fetch who liked me:', error);
        // Only show toast, suppress expo error
        if (error.message && !isLoadMore) {
          showError('Could not load likes. Pull down to retry.');
        }
        if (!isLoadMore) {
          setIncomingLikes([]);
        }
        setHasMore(false);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [offset, isPremium, showInfo, showError, hasShownUpgradeHint, incomingLikes]
  );

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
      Logger.info(`🔔 LikedYou WebSocket event received: ${event}`, data);
      if (event === 'liked-you-update' && data) {
        if (data.action === 'remove' && data.userId) {
          Logger.info(
            `🗑️ WebSocket: Removing user ${data.userId} from LikedYou (reason: ${data.reason})`
          );
          // Remove the user from the incoming likes list
          setIncomingLikes(prev => {
            const filtered = prev.filter(like => like.id !== data.userId);
            return filtered;
          });
          // Decrement total count
          setTotalLikesCount(prev => Math.max(0, prev - 1));

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
    setOffset(0); // Reset offset for refresh
    setHasMore(true); // Reset hasMore flag
    setTotalLikesCount(0); // Reset total count
    await fetchWhoLikedMe(false); // false = not loading more, it's a refresh
    setRefreshing(false);
  };

  const handleLoadMore = () => {
    Logger.info(
      `📜 handleLoadMore called - loadingMore: ${loadingMore}, hasMore: ${hasMore}, loading: ${loading}, offset: ${offset}`
    );
    if (!loadingMore && hasMore && !loading) {
      Logger.info(`📜 Loading more users from offset ${offset}`);
      fetchWhoLikedMe(true); // true = loading more
    }
  };

  // Handle match modal actions
  const handleSendMessage = useCallback(() => {
    setShowMatchModal(false);
    setMatchedUser(null); // Clear matched user immediately

    // Small delay to ensure modal closes before navigation
    setTimeout(() => {
      if (matchedUser) {
        // Navigate directly to the chat with this match
        const matchData = {
          matchId: matchedUser.matchId,
          otherUser: {
            id: matchedUser.id,
            name: matchedUser.name,
            mainPhoto: matchedUser.photo,
            photos: matchedUser.photo ? [{ url: matchedUser.photo }] : [],
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

  const handleLikeBack = async profile => {
    if (!isPremium) {
      setShowUpgradeModal(true);
      return;
    }

    try {
      const result = await ApiDataService.likeUser(profile.id);

      Logger.info(`💘 Like result for ${profile.name}:`, JSON.stringify(result, null, 2));

      if (result.success) {
        // Close the user detail modal first if it's open
        if (selectedUser) {
          setSelectedUser(null);
        }

        // When liking someone from LikedYou, it's ALWAYS a match
        // because they already liked you!
        if (result.isMatch) {
          Logger.info(`🎉 It's a match with ${profile.name}! Match ID: ${result.match?.id}`);
          // Close the user detail modal first
          setSelectedUser(null);

          // Set matched user and show match modal
          setMatchedUser({
            id: profile.id,
            name: profile.name,
            photo: profile.mainPhoto,
            matchId: result.match?.id, // Include the match ID
          });
          // Show match modal immediately without delay
          setShowMatchModal(true);
        } else {
          // This shouldn't happen when liking from LikedYou
          Logger.warn(`⚠️ Unexpected: Like to ${profile.name} didn't create a match`);
          showSuccess('Like sent back! 💘');
        }

        // Remove from incoming likes
        Logger.info(
          `🗑️ Removing ${profile.name} (ID: ${profile.id}) from LikedYou list after match`
        );
        setIncomingLikes(prev => {
          const newList = prev.filter(like => like.id !== profile.id);
          Logger.info(`📊 LikedYou list updated: ${prev.length} -> ${newList.length} users`);
          return newList;
        });
        // Decrement total count
        setTotalLikesCount(prev => Math.max(0, prev - 1));
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
        Logger.info(
          `🗑️ Removing ${profile.name} (ID: ${profile.id}) from LikedYou list after pass`
        );
        setIncomingLikes(prev => {
          const newList = prev.filter(like => like.id !== profile.id);
          Logger.info(`📊 LikedYou list updated: ${prev.length} -> ${newList.length} users`);
          return newList;
        });
        setSelectedUser(null);
        // Decrement total count
        setTotalLikesCount(prev => Math.max(0, prev - 1));
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

  const renderHeader = () => {
    // Log the actual count of users being displayed
    const uniqueUserIds = new Set(incomingLikes.map(u => u.id));
    if (incomingLikes.length > 0) {
      Logger.info(
        `📊 Display count: Showing ${incomingLikes.length} users (${uniqueUserIds.size} unique) vs API total: ${totalLikesCount}`
      );
    }

    return (
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Who Liked You</Text>
          <View style={styles.likeCountBadge}>
            <Text style={styles.likeCountText}>{totalLikesCount}</Text>
          </View>
        </View>

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
  };

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

  const renderFooter = () => {
    if (!loadingMore) return null;

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color="#FF6B6B" />
        <Text style={styles.loadingMoreText}>Loading more...</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={incomingLikes}
        renderItem={renderLikeCard}
        keyExtractor={item => item.actionId || item.id}
        extraData={incomingLikes.length} // Force re-render when list changes
        numColumns={2}
        columnWrapperStyle={styles.row}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={!loading ? renderEmptyState : null}
        ListFooterComponent={renderFooter}
        contentContainerStyle={styles.gridContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#FF6B6B']}
            tintColor="#FF6B6B"
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
      />

      {renderUserModal()}
      {renderUpgradeModal()}

      {/* Match Modal */}
      {showMatchModal && matchedUser && (
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
          onSendMessage={handleSendMessage}
          onKeepSwiping={handleKeepSwiping}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
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
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingMoreText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
  },
});

export default LikedYouScreen;
