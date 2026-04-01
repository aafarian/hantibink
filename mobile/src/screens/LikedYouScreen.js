import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useIsPremium } from '../contexts/FeatureFlagsContext';
import ApiDataService from '../services/ApiDataService';
import apiClient from '../services/ApiClient';
import SocketService from '../services/SocketService';
import MatchModal from '../components/MatchModal';
import PremiumUpgradeModal from '../components/modals/PremiumUpgradeModal';
import { LoadingScreen } from '../components/LoadingScreen';
import { ErrorScreen } from '../components/ErrorScreen';
import Logger from '../utils/logger';
import { useTabNavigation } from '../hooks/useTabNavigation';
import { theme } from '../styles/theme';
import LikedYouCard from './liked-you/LikedYouCard';
import LikedYouUserModal from './liked-you/LikedYouUserModal';

const LikedYouScreen = () => {
  const { user, userProfile } = useAuth();
  const { showError, showSuccess, showInfo } = useToast();
  const isPremium = useIsPremium();
  const { navigateToChat } = useTabNavigation();

  const [incomingLikes, setIncomingLikes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
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
  const [loadingAction, setLoadingAction] = useState(null); // Track which user action is loading { userId, type: 'like' | 'pass' }
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

        // ApiClient unwraps API response, so response.data is the likes array
        // Extra fields like totalCount are at response.totalCount
        if (response.success) {
          // Extract the likes array and total count from the response
          const responseData = response.data || [];
          const totalCount = response.totalCount || 0;
          const totalLikesCountFromAPI = response.totalLikesCount || 0;

          // Clear error state on successful load
          setError(false);

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
              // Still update offset by the fetched count to continue pagination
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

            // Update offset by the fetched count (not unique count) to avoid skipping records
            setOffset(currentOffset + likes.length);
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
      } catch (err) {
        Logger.error('Failed to fetch who liked me:', err);
        if (!isLoadMore) {
          setError(true);
          setIncomingLikes([]);
        }
        setHasMore(false);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [offset, isPremium, showInfo, showError, hasShownUpgradeHint] // incomingLikes excluded to prevent infinite re-renders
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
                showInfo('Someone new liked you!');
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
      showSuccess("It's a match! Check your messages to start chatting.");
      setPendingMatchToast(false);
    }
  }, [pendingMatchToast, showMatchModal, showSuccess]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setOffset(0); // Reset offset for refresh
    setHasMore(true); // Reset hasMore flag
    setTotalLikesCount(0); // Reset total count
    await fetchWhoLikedMe(false); // false = not loading more, it's a refresh
    setRefreshing(false);
  }, [fetchWhoLikedMe]);

  const handleLoadMore = useCallback(() => {
    Logger.info(
      `📜 handleLoadMore called - loadingMore: ${loadingMore}, hasMore: ${hasMore}, loading: ${loading}, offset: ${offset}`
    );
    if (!loadingMore && hasMore && !loading) {
      Logger.info(`📜 Loading more users from offset ${offset}`);
      fetchWhoLikedMe(true); // true = loading more
    }
  }, [loadingMore, hasMore, loading, offset, fetchWhoLikedMe]);

  // Handle match modal actions
  const handleSendMessage = useCallback(() => {
    // Capture the matched user data before clearing
    const userToNavigate = matchedUser;

    // Close modal and clear state immediately
    setShowMatchModal(false);
    setMatchedUser(null);

    // Navigate after a longer delay to ensure modal is fully unmounted
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
    }, 300); // Longer delay to ensure modal animation completes
  }, [matchedUser, navigateToChat]);

  const handleKeepSwiping = useCallback(() => {
    setShowMatchModal(false);
    setMatchedUser(null);
  }, []);

  const handleLikeBack = useCallback(
    async profile => {
      if (!isPremium) {
        setShowUpgradeModal(true);
        return;
      }

      // Set loading state
      setLoadingAction({ userId: profile.id, type: 'like' });

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
      } catch (err) {
        Logger.error('Failed to like back:', err);
        showError('Could not like back. Please try again.');
      } finally {
        setLoadingAction(null);
      }
    },
    [isPremium, selectedUser, showSuccess, showError]
  );

  const handlePass = useCallback(
    async profile => {
      if (!isPremium) {
        setShowUpgradeModal(true);
        return;
      }

      // Set loading state
      setLoadingAction({ userId: profile.id, type: 'pass' });

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
      } catch (err) {
        Logger.error('Failed to pass:', err);
        showError('Could not pass. Please try again.');
      } finally {
        setLoadingAction(null);
      }
    },
    [isPremium, showError]
  );

  const renderLikeCard = useCallback(
    ({ item, index }) => (
      <LikedYouCard
        item={item}
        index={index}
        isPremium={isPremium}
        onPress={() => (isPremium ? setSelectedUser(item) : setShowUpgradeModal(true))}
        onLike={handleLikeBack}
        onPass={handlePass}
        loadingAction={loadingAction}
      />
    ),
    [isPremium, loadingAction, handleLikeBack, handlePass]
  );

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
          <View style={styles.headerLeft}>
            <View style={styles.likeCountBadge}>
              <Ionicons name="heart" size={14} color="white" />
              <Text style={styles.likeCountText}>{totalLikesCount}</Text>
            </View>
            <Text style={styles.headerSubtitle}>
              {totalLikesCount === 0
                ? 'Your likes will appear here'
                : totalLikesCount === 1
                  ? 'person likes you'
                  : 'people like you'}
            </Text>
          </View>

          {isPremium && (
            <View style={styles.premiumBadge}>
              <Ionicons name="diamond" size={12} color={theme.colors.premium} />
              <Text style={styles.premiumText}>Premium</Text>
            </View>
          )}
        </View>

        {!isPremium && incomingLikes.length > 0 && (
          <TouchableOpacity style={styles.upgradeButton} onPress={() => setShowUpgradeModal(true)}>
            <Ionicons name="diamond-outline" size={18} color="white" />
            <Text style={styles.upgradeButtonText}>Unlock to see who</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderEmptyState = () => {
    // Show premium upsell for free users with tips
    if (!isPremium) {
      return (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconContainer, styles.premiumIconContainer]}>
            <Ionicons name="sparkles" size={32} color={theme.colors.premium} />
          </View>
          <Text style={styles.emptyTitle}>Get Discovered</Text>
          <Text style={styles.emptySubtitle}>
            When someone likes your profile, you'll see them here. Upgrade to Premium to see who
            they are instantly.
          </Text>

          <View style={styles.tipContainer}>
            <Text style={styles.tipTitle}>Boost Your Visibility</Text>
            <View style={styles.tipItem}>
              <Ionicons name="camera-outline" size={18} color={theme.colors.primary} />
              <Text style={styles.tipText}>Add more photos to stand out</Text>
            </View>
            <View style={styles.tipItem}>
              <Ionicons name="create-outline" size={18} color={theme.colors.primary} />
              <Text style={styles.tipText}>Write a bio that shows your personality</Text>
            </View>
            <View style={styles.tipItem}>
              <Ionicons name="flame-outline" size={18} color={theme.colors.primary} />
              <Text style={styles.tipText}>Swipe daily to increase your reach</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.emptyUpgradeButton}
            onPress={() => setShowUpgradeModal(true)}
          >
            <Ionicons name="diamond" size={18} color="white" style={styles.upgradeButtonIcon} />
            <Text style={styles.emptyUpgradeButtonText}>Upgrade to Premium</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Premium users with no likes
    return (
      <View style={styles.emptyState}>
        <View style={[styles.emptyIconContainer, styles.emptyHeartContainer]}>
          <Ionicons name="heart-outline" size={32} color={theme.colors.primary} />
        </View>
        <Text style={styles.emptyTitle}>No Likes Yet</Text>
        <Text style={styles.emptySubtitle}>
          Your likes will show up here. In the meantime, here are some tips to get noticed.
        </Text>
        <View style={styles.tipContainer}>
          <Text style={styles.tipTitle}>Boost Your Visibility</Text>
          <View style={styles.tipItem}>
            <Ionicons name="camera-outline" size={18} color={theme.colors.primary} />
            <Text style={styles.tipText}>Add more photos to stand out</Text>
          </View>
          <View style={styles.tipItem}>
            <Ionicons name="create-outline" size={18} color={theme.colors.primary} />
            <Text style={styles.tipText}>Write a bio that shows your personality</Text>
          </View>
          <View style={styles.tipItem}>
            <Ionicons name="flame-outline" size={18} color={theme.colors.primary} />
            <Text style={styles.tipText}>Swipe daily to increase your reach</Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return <LoadingScreen message="Loading likes..." />;
  }

  if (error) {
    return (
      <ErrorScreen
        message="Failed to load likes"
        onRetry={() => {
          setError(false);
          setOffset(0);
          setHasMore(true);
          fetchWhoLikedMe(false);
        }}
      />
    );
  }

  const renderFooter = () => {
    if (!loadingMore) return null;

    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
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
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
        // Performance optimizations
        initialNumToRender={6}
        maxToRenderPerBatch={4}
        windowSize={5}
        removeClippedSubviews={true}
      />

      <LikedYouUserModal
        user={selectedUser}
        visible={!!selectedUser && isPremium}
        onClose={() => setSelectedUser(null)}
        onLike={handleLikeBack}
        onPass={handlePass}
        loadingAction={loadingAction}
      />
      <PremiumUpgradeModal visible={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />

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
    backgroundColor: theme.colors.background.secondary,
  },
  header: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.light,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerSubtitle: {
    fontSize: 15,
    color: theme.colors.text.secondary,
  },
  likeCountBadge: {
    backgroundColor: theme.colors.primary,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  likeCountText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginTop: 12,
    gap: 8,
  },
  upgradeButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${theme.colors.premium}15`,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  premiumText: {
    color: theme.colors.premium,
    fontWeight: '600',
    fontSize: 12,
  },
  gridContainer: {
    padding: 10,
  },
  row: {
    justifyContent: 'space-between',
  },
  emptyState: {
    padding: 24,
    alignItems: 'center',
  },
  emptyIconContainer: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 15,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  tipContainer: {
    backgroundColor: theme.colors.background.secondary,
    padding: 20,
    borderRadius: 16,
    width: '100%',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#eee',
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text.primary,
    marginBottom: 16,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  tipText: {
    fontSize: 14,
    color: '#555',
    flex: 1,
  },
  premiumIconContainer: {
    backgroundColor: `${theme.colors.premium}15`,
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyHeartContainer: {
    backgroundColor: `${theme.colors.primary}10`,
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyUpgradeButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  upgradeButtonIcon: {
    marginRight: 8,
  },
  emptyUpgradeButtonText: {
    color: theme.colors.text.white,
    fontSize: 16,
    fontWeight: '600',
  },
  footerLoader: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingMoreText: {
    marginTop: 8,
    fontSize: 14,
    color: theme.colors.text.secondary,
  },
});

export default LikedYouScreen;
