const { getPrismaClient } = require('../config/database');
const logger = require('../utils/logger');
const {
  sendMatchNotification,
  sendLikeNotification,
  sendSuperLikeNotification,
  shouldSendNotification,
} = require('./notificationService');
const {
  canLike,
  canSuperLike,
  canUndo,
  getWhoLikedMeLimit,
} = require('./premiumService');

const prisma = getPrismaClient();

/**
 * Like a user
 */
const likeUser = async (
  senderId,
  receiverId,
  actionType = 'LIKE',
  io = null,
) => {
  try {
    if (senderId === receiverId) {
      const error = new Error('Cannot act on yourself');
      error.code = 'INVALID_TARGET';
      throw error;
    }

    // Blocked pairs cannot interact; 404-style wording avoids revealing
    // the block to the sender.
    const { isUserBlocked } = require('./moderationService');
    if (await isUserBlocked(senderId, receiverId)) {
      const error = new Error('User not available');
      error.code = 'USER_NOT_AVAILABLE';
      throw error;
    }

    // Check premium quotas before proceeding
    if (actionType === 'SUPER_LIKE') {
      const superLikeCheck = await canSuperLike(senderId);
      if (!superLikeCheck.allowed) {
        const error = new Error(superLikeCheck.message);
        error.code = superLikeCheck.error;
        error.quotas = superLikeCheck.quotas;
        throw error;
      }
    } else if (actionType === 'LIKE') {
      const likeCheck = await canLike(senderId);
      if (!likeCheck.allowed) {
        const error = new Error(likeCheck.message);
        error.code = likeCheck.error;
        error.quotas = likeCheck.quotas;
        throw error;
      }
    }

    // Use transaction for all database operations
    const result = await prisma.$transaction(async (tx) => {
      // Check if action already exists
      const existingAction = await tx.userAction.findUnique({
        where: {
          senderId_receiverId: {
            senderId,
            receiverId,
          },
        },
      });

      if (existingAction) {
        throw new Error('You have already acted on this user');
      }

      // Create the like action
      const action = await tx.userAction.create({
        data: {
          senderId,
          receiverId,
          action: actionType,
        },
      });

      // Increment total likes for receiver if it's a LIKE action
      if (actionType === 'LIKE') {
        await tx.user.update({
          where: { id: receiverId },
          data: { totalLikes: { increment: 1 } },
        });
      }

      // Check if this creates a match
      const reverseAction = await tx.userAction.findUnique({
        where: {
          senderId_receiverId: {
            senderId: receiverId,
            receiverId: senderId,
          },
        },
      });

      let isMatch = false;
      let match = null;

      if (reverseAction && (reverseAction.action === 'LIKE' || reverseAction.action === 'SUPER_LIKE')) {
        // It's a match! Create match record
        logger.info(`🎯 MATCH DETECTED: ${receiverId} had already liked ${senderId} with ${reverseAction.action} on ${reverseAction.createdAt}`);
        match = await tx.match.create({
          data: {
            user1Id: senderId < receiverId ? senderId : receiverId,
            user2Id: senderId < receiverId ? receiverId : senderId,
          },
          include: {
            user1: {
              select: {
                id: true,
                name: true,
                pushToken: true,
                photos: {
                  where: { isMain: true },
                  select: { url: true },
                },
              },
            },
            user2: {
              select: {
                id: true,
                name: true,
                pushToken: true,
                photos: {
                  where: { isMain: true },
                  select: { url: true },
                },
              },
            },
          },
        });

        // Increment match counts for both users
        await tx.user.updateMany({
          where: { id: { in: [senderId, receiverId] } },
          data: { totalMatches: { increment: 1 } },
        });

        isMatch = true;
      }

      // Spend quota inside the transaction to prevent race conditions.
      // Super Likes come from the banked balance; the conditional WHERE is a
      // race-safe backstop so concurrent spends can't drive it negative.
      if (actionType === 'SUPER_LIKE') {
        const spent = await tx.user.updateMany({
          where: { id: senderId, superLikeBalance: { gte: 1 } },
          data: { superLikeBalance: { decrement: 1 } },
        });
        if (spent.count === 0) {
          const error = new Error('You\'re out of Super Likes. You bank 2 more each day, up to 5.');
          error.code = 'DAILY_LIMIT_REACHED';
          throw error;
        }
      } else if (actionType === 'LIKE') {
        await tx.user.update({
          where: { id: senderId },
          data: { dailyLikesUsed: { increment: 1 } },
        });
      }

      return { action, match, isMatch };
    });

    const { action, match, isMatch } = result;

    // Send real-time notification if Socket.IO is available for matches
    if (isMatch && match && io) {
        // Notify BOTH users about the new match
        const matchData = {
          matchId: match.id,
          timestamp: new Date(),
        };
        
        // Prepare matched user data with proper structure
        // Extract photo URLs as strings, not objects
        const user1Photos = match.user1.photos ? 
          match.user1.photos.map(p => typeof p === 'string' ? p : p.url).filter(Boolean) : [];
        const user2Photos = match.user2.photos ? 
          match.user2.photos.map(p => typeof p === 'string' ? p : p.url).filter(Boolean) : [];
        
        const user1Data = {
          id: match.user1.id,
          name: match.user1.name,
          photos: user1Photos,
          mainPhoto: user1Photos[0] || null,
        };
        
        const user2Data = {
          id: match.user2.id,
          name: match.user2.name,
          photos: user2Photos,
          mainPhoto: user2Photos[0] || null,
        };
        
        // Notify the receiver (the person who was just liked back)
        io.to(`user:${receiverId}`).emit('new-match', {
          ...matchData,
          matchedUser: match.user1Id === receiverId ? user2Data : user1Data,
          message: 'You have a new match! 🎉',
        });
        
        // Notify the sender (the person who just liked)
        io.to(`user:${senderId}`).emit('new-match', {
          ...matchData,
          matchedUser: match.user1Id === senderId ? user2Data : user1Data,
          message: "It's a match! 🎉",
        });

        // Send push notifications to both users (respecting their preferences)
        if (match.user1.pushToken) {
          shouldSendNotification(match.user1Id, 'matches').then(shouldNotify => {
            if (shouldNotify) {
              sendMatchNotification(match.user1.pushToken, user2Data.name).catch(err =>
                logger.error('Failed to send push notification to user1:', err)
              );
            } else {
              logger.info(`📵 Match notification skipped for user1 - matches disabled`);
            }
          }).catch(err => logger.error('Match notification pref check failed (user1):', err));
        }
        if (match.user2.pushToken) {
          shouldSendNotification(match.user2Id, 'matches').then(shouldNotify => {
            if (shouldNotify) {
              sendMatchNotification(match.user2.pushToken, user1Data.name).catch(err =>
                logger.error('Failed to send push notification to user2:', err)
              );
            } else {
              logger.info(`📵 Match notification skipped for user2 - matches disabled`);
            }
          }).catch(err => logger.error('Match notification pref check failed (user2):', err));
        }

        // Also emit an event to update the "Liked You" screen
        io.to(`user:${senderId}`).emit('liked-you-update', {
          action: 'remove',
          userId: receiverId,
          reason: 'matched',
        });

      logger.info(`Real-time match notifications sent to users ${senderId} and ${receiverId}`);
    }

    // Send notification for likes/super-likes (when NOT a match)
    // This lets users know someone is interested in them
    if (!isMatch && (actionType === 'LIKE' || actionType === 'SUPER_LIKE')) {
      try {
        // Get receiver's push token and premium status, and sender's name
        const [receiver, sender] = await Promise.all([
          prisma.user.findUnique({
            where: { id: receiverId },
            select: { pushToken: true, isPremium: true },
          }),
          prisma.user.findUnique({
            where: { id: senderId },
            select: { name: true },
          }),
        ]);

        if (receiver?.pushToken && sender?.name) {
          // Check if user wants like notifications
          const shouldNotify = await shouldSendNotification(receiverId, 'likes');
          if (!shouldNotify) {
            logger.info(`📵 Like notification skipped - user ${receiverId} has likes disabled`);
          } else if (actionType === 'SUPER_LIKE') {
            sendSuperLikeNotification(receiver.pushToken, sender.name, receiver.isPremium).catch(
              err => logger.error('Failed to send super like notification:', err)
            );
            logger.info(`📩 Sent ${actionType} notification to user ${receiverId}`);
          } else {
            sendLikeNotification(receiver.pushToken, sender.name, receiver.isPremium).catch(err =>
              logger.error('Failed to send like notification:', err)
            );
            logger.info(`📩 Sent ${actionType} notification to user ${receiverId}`);
          }
        }
      } catch (notifError) {
        // Don't fail the action if notification fails
        logger.warn('Could not send like notification:', notifError.message);
      }
    }

    logger.info(
      `${actionType} action created: ${senderId} -> ${receiverId}${isMatch ? ' (MATCH!)' : ''}`,
    );

    return {
      success: true,
      action,
      isMatch,
      match,
    };
  } catch (error) {
    logger.error('❌ Error liking user:', error);
    throw error;
  }
};

/**
 * Pass on a user
 */
const passUser = async (senderId, receiverId, io = null) => {
  try {
    if (senderId === receiverId) {
      const error = new Error('Cannot act on yourself');
      error.code = 'INVALID_TARGET';
      throw error;
    }

    // Blocked pairs cannot interact; 404-style wording avoids revealing
    // the block to the sender.
    const { isUserBlocked } = require('./moderationService');
    if (await isUserBlocked(senderId, receiverId)) {
      const error = new Error('User not available');
      error.code = 'USER_NOT_AVAILABLE';
      throw error;
    }

    const action = await prisma.$transaction(async (tx) => {
      // Check if action already exists
      const existingAction = await tx.userAction.findUnique({
        where: {
          senderId_receiverId: {
            senderId,
            receiverId,
          },
        },
      });

      if (existingAction) {
        throw new Error('You have already acted on this user');
      }

      // Create the pass action
      const created = await tx.userAction.create({
        data: {
          senderId,
          receiverId,
          action: 'PASS',
        },
      });

      // Re-check the block inside the transaction: a block committed
      // between the entry check and this insert rolls the PASS back
      // instead of persisting an action for a blocked pair
      const blocked = await tx.blockedUser.findFirst({
        where: {
          OR: [
            { blockerId: senderId, blockedId: receiverId },
            { blockerId: receiverId, blockedId: senderId },
          ],
        },
      });
      if (blocked) {
        const error = new Error('User not available');
        error.code = 'USER_NOT_AVAILABLE';
        throw error;
      }

      return created;
    });

    // If Socket.IO is available, emit an event to update the "Liked You" screen
    if (io) {
      io.to(`user:${senderId}`).emit('liked-you-update', {
        action: 'remove',
        userId: receiverId,
        reason: 'passed',
      });
    }

    logger.info(`Pass action saved: ${senderId} -> ${receiverId}`);

    return {
      success: true,
      action,
      isMatch: false,
    };
  } catch (error) {
    logger.error('❌ Error passing on user:', error);
    throw error;
  }
};

/**
 * Get user action history
 */
const getUserActions = async (userId, options = {}) => {
  try {
    const { limit = 50, offset = 0 } = options;

    const actions = await prisma.userAction.findMany({
      where: { senderId: userId },
      include: {
        receiver: {
          select: {
            id: true,
            name: true,
            photos: {
              where: { isMain: true },
              select: { url: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return actions;
  } catch (error) {
    logger.error('❌ Error getting user actions:', error);
    throw error;
  }
};

/**
 * Undo last action (premium feature)
 */
const undoLastAction = async (userId, io = null) => {
  try {
    // Check if user can undo (premium feature)
    const undoCheck = await canUndo(userId);
    if (!undoCheck.allowed) {
      const error = new Error(undoCheck.message);
      error.code = undoCheck.error;
      error.quotas = undoCheck.quotas;
      throw error;
    }

    // Get the last action
    const lastAction = await prisma.userAction.findFirst({
      where: { senderId: userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!lastAction) {
      throw new Error('No action to undo');
    }

    // Check if it's recent enough to undo (e.g., within 5 minutes)
    const actionAge = Date.now() - lastAction.createdAt.getTime();
    const maxUndoTime = 5 * 60 * 1000; // 5 minutes

    if (actionAge > maxUndoTime) {
      throw new Error('Too late to undo this action');
    }

    // Use transaction to ensure all operations succeed or fail together
    let deactivatedMatchId = null;
    await prisma.$transaction(async (tx) => {
      // LIKE and SUPER_LIKE both create matches — undoing either must
      // deactivate a match it formed
      if (lastAction.action === 'LIKE' || lastAction.action === 'SUPER_LIKE') {
        const match = await tx.match.findFirst({
          where: {
            OR: [
              { user1Id: userId, user2Id: lastAction.receiverId },
              { user1Id: lastAction.receiverId, user2Id: userId },
            ],
            isActive: true,
          },
        });

        if (match) {
          // Check if there was a reverse like
          const reverseAction = await tx.userAction.findUnique({
            where: {
              senderId_receiverId: {
                senderId: lastAction.receiverId,
                receiverId: userId,
              },
            },
          });

          if (reverseAction && (reverseAction.action === 'LIKE' || reverseAction.action === 'SUPER_LIKE')) {
            // This would break a mutual match, need to deactivate the match
            await tx.match.update({
              where: { id: match.id },
              data: { isActive: false },
            });
            deactivatedMatchId = match.id;

            // Decrement match counts for both users
            await tx.user.updateMany({
              where: { id: { in: [userId, lastAction.receiverId] } },
              data: { totalMatches: { decrement: 1 } },
            });

            logger.info(`Match ${match.id} deactivated due to undo action`);
          }
        }

        // Decrement total likes for receiver (only LIKE increments it)
        if (lastAction.action === 'LIKE') {
          await tx.user.update({
            where: { id: lastAction.receiverId },
            data: { totalLikes: { decrement: 1 } },
          });
        }
      }

      // Delete the action
      await tx.userAction.delete({
        where: { id: lastAction.id },
      });
    });

    // Same revocation as block/unmatch: an undone mutual match must not
    // leave either participant with live presence access to its room
    if (deactivatedMatchId) {
      io?.evictMatchRoom?.(deactivatedMatchId);
    }

    logger.info(`Action undone: ${lastAction.id} (${lastAction.action})`);

    return {
      success: true,
      undoneAction: lastAction,
    };
  } catch (error) {
    logger.error('❌ Error undoing action:', error);
    throw error;
  }
};

/**
 * Get users who liked the current user (for "Liked You" feature)
 */
const getWhoLikedMe = async (userId, options = {}) => {
  try {
    let { limit = 20 } = options;
    const { offset = 0 } = options;

    // Check premium status to determine result limit
    const premiumLimit = await getWhoLikedMeLimit(userId);

    limit = premiumLimit.isPremium ? limit : Math.min(limit, premiumLimit.limit);

    // Get the total count of users who liked the current user (before filtering)
    const totalLikesCount = await prisma.userAction.count({
      where: {
        receiverId: userId,
        action: { in: ['LIKE', 'SUPER_LIKE'] },
      },
    });

    // Blocked users (either direction) never appear in the liker list
    const { getBlockedUserIds } = require('./moderationService');
    const blockedUserIds = await getBlockedUserIds(userId);

    // Shared filter: likers not yet acted on (relation filter compiles to a
    // NOT EXISTS subquery — no more materializing every acted-on user ID
    // into the query, which grew without bound) and not blocked.
    const unactedLikersWhere = {
      receiverId: userId,
      action: { in: ['LIKE', 'SUPER_LIKE'] },
      sender: { actionsReceived: { none: { senderId: userId } } },
      ...(blockedUserIds.length ? { senderId: { notIn: blockedUserIds } } : {}),
    };

    // Free users get NO liker entries — only counts for the upsell teaser.
    // totalCount stays "unacted likers" (same meaning as the premium path,
    // and what the mobile screen displays); totalLikesCount is the raw total.
    if (!premiumLimit.isPremium) {
      const totalUnactedCount = await prisma.userAction.count({
        where: unactedLikersWhere,
      });
      return {
        users: [],
        totalCount: totalUnactedCount,
        totalLikesCount,
        hiddenCount: totalUnactedCount,
        isPremium: false,
        premiumRequired: true,
        message: 'Upgrade to Premium to see everyone who liked you!',
      };
    }

    logger.info(`🔍 Fetching who liked user ${userId} (limit: ${limit}, offset: ${offset})`);
    const likers = await prisma.userAction.findMany({
      where: unactedLikersWhere,
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            bio: true,
            birthDate: true,
            location: true,
            photos: {
              orderBy: { order: 'asc' },
              select: {
                id: true,
                url: true,
                isMain: true,
                order: true,
              },
            },
            interests: {
              include: {
                interest: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
    
    logger.info(`🔍 Batch ${offset}-${offset+limit}: Found ${likers.length} unacted likers`);

    // Transform the data to include age calculation and format
    const transformedLikers = likers.map((action) => {
      const birthDate = action.sender.birthDate;
      let age = null;
      if (birthDate) {
        const today = new Date();
        const birth = new Date(birthDate);
        age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
          age--;
        }
      }

      return {
        actionId: action.id,
        actionType: action.action,
        likedAt: action.createdAt,
        user: {
          ...action.sender,
          age,
          interests: action.sender.interests.map(ui => ui.interest.name),
        },
      };
    });

    // Get the accurate count of unacted users
    const totalUnactedCount = await prisma.userAction.count({
      where: unactedLikersWhere,
    });
    
    logger.info(`📋 Retrieved ${transformedLikers.length} users in this batch for user ${userId}`);
    logger.info(`📋 Total unacted likes: ${totalUnactedCount} of ${totalLikesCount} total likes`);
    
    // Log first few users for debugging
    if (transformedLikers.length > 0) {
      logger.info(`📋 First 3 likers: ${transformedLikers.slice(0, 3).map(l => `${l.user.name} (ID: ${l.user.id})`).join(', ')}`);
    }

    return {
      users: transformedLikers,
      totalCount: totalUnactedCount, // Total users who liked you that you haven't acted on
      totalLikesCount, // Total users who liked you (including acted on)
      isPremium: premiumLimit.isPremium,
      premiumRequired: !premiumLimit.isPremium && totalUnactedCount > premiumLimit.limit,
      hiddenCount: !premiumLimit.isPremium ? Math.max(0, totalUnactedCount - premiumLimit.limit) : 0,
    };
  } catch (error) {
    logger.error('❌ Error getting who liked me:', error);
    throw error;
  }
};

module.exports = {
  likeUser,
  passUser,
  getUserActions,
  undoLastAction,
  getWhoLikedMe,
};