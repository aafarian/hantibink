const { getPrismaClient } = require('../config/database');
const logger = require('../utils/logger');

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

      if (reverseAction && reverseAction.action === 'LIKE') {
        // It's a match! Create match record
        logger.info(`🎯 MATCH DETECTED: ${receiverId} had already liked ${senderId} on ${reverseAction.createdAt}`);
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
        
        // Also emit an event to update the "Liked You" screen
        io.to(`user:${senderId}`).emit('liked-you-update', {
          action: 'remove',
          userId: receiverId,
          reason: 'matched',
        });

      logger.info(`Real-time match notifications sent to users ${senderId} and ${receiverId}`);
    }

    // Total likes already incremented in the transaction above

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
    // Check if action already exists
    const existingAction = await prisma.userAction.findUnique({
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
    const action = await prisma.userAction.create({
      data: {
        senderId,
        receiverId,
        action: 'PASS',
      },
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
const undoLastAction = async (userId) => {
  try {
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
    await prisma.$transaction(async (tx) => {
      // If it was a LIKE that created a match, we need to deactivate the match
      if (lastAction.action === 'LIKE') {
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

          if (reverseAction && reverseAction.action === 'LIKE') {
            // This would break a mutual match, need to deactivate the match
            await tx.match.update({
              where: { id: match.id },
              data: { isActive: false },
            });

            // Decrement match counts for both users
            await tx.user.updateMany({
              where: { id: { in: [userId, lastAction.receiverId] } },
              data: { totalMatches: { decrement: 1 } },
            });

            logger.info(`Match ${match.id} deactivated due to undo action`);
          }
        }

        // Decrement total likes for receiver
        await tx.user.update({
          where: { id: lastAction.receiverId },
          data: { totalLikes: { decrement: 1 } },
        });
      }

      // Delete the action
      await tx.userAction.delete({
        where: { id: lastAction.id },
      });
    });

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
    const { limit = 20, offset = 0 } = options;

    // Get the total count of users who liked the current user (before filtering)
    const totalLikesCount = await prisma.userAction.count({
      where: {
        receiverId: userId,
        action: { in: ['LIKE', 'SUPER_LIKE'] },
      },
    });

    // Get users the current user has already acted on FIRST
    const allCurrentUserActions = await prisma.userAction.findMany({
      where: {
        senderId: userId,
      },
      select: {
        receiverId: true,
      },
    });

    const allActedOnUserIds = Array.from(new Set(allCurrentUserActions.map(a => a.receiverId)));
    
    // Now fetch users who liked the current user, excluding those already acted on
    logger.info(`🔍 Fetching who liked user ${userId} (limit: ${limit}, offset: ${offset}, excluding ${allActedOnUserIds.length} acted-on users)`);
    const likers = await prisma.userAction.findMany({
      where: {
        receiverId: userId,
        action: { in: ['LIKE', 'SUPER_LIKE'] },
        senderId: { notIn: allActedOnUserIds }, // Filter in the query, not after
      },
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
      where: {
        receiverId: userId,
        action: { in: ['LIKE', 'SUPER_LIKE'] },
        senderId: { notIn: allActedOnUserIds },
      },
    });
    
    logger.info(`📋 Retrieved ${transformedLikers.length} users in this batch for user ${userId}`);
    logger.info(`📋 Total unacted likes: ${totalUnactedCount} (${totalLikesCount} total likes - ${allActedOnUserIds.length} users we've acted on)`);
    
    // Log first few users for debugging
    if (transformedLikers.length > 0) {
      logger.info(`📋 First 3 likers: ${transformedLikers.slice(0, 3).map(l => `${l.user.name} (ID: ${l.user.id})`).join(', ')}`);
    }

    return {
      users: transformedLikers,
      totalCount: totalUnactedCount, // Total users who liked you that you haven't acted on
      totalLikesCount, // Total users who liked you (including acted on)
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