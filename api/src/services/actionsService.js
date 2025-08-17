const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

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

    // Create the like action
    const action = await prisma.userAction.create({
      data: {
        senderId,
        receiverId,
        action: actionType,
      },
    });

    // Check if this creates a match
    const reverseAction = await prisma.userAction.findUnique({
      where: {
        senderId_receiverId: {
          senderId: receiverId,
          receiverId: senderId,
        },
      },
    });

    let isMatch = false;
    let match = null;

    // If both users liked each other, create a match
    if (reverseAction && reverseAction.action === 'LIKE') {
      isMatch = true;

      // Check if match already exists
      const existingMatch = await prisma.match.findFirst({
        where: {
          OR: [
            { user1Id: senderId, user2Id: receiverId },
            { user1Id: receiverId, user2Id: senderId },
          ],
        },
      });

      if (!existingMatch) {
        // Create new match (ensure consistent ordering)
        const [user1Id, user2Id] = [senderId, receiverId].sort();

        match = await prisma.match.create({
          data: {
            user1Id,
            user2Id,
            isActive: true,
          },
        });

        logger.info(
          `🎉 New match created: ${match.id} between ${user1Id} and ${user2Id}`,
        );

        // Emit WebSocket events for new match
        if (io) {
          // Get user details for notifications
          const [user1, user2] = await Promise.all([
            prisma.user.findUnique({
              where: { id: user1Id },
              select: { id: true, name: true, photos: true },
            }),
            prisma.user.findUnique({
              where: { id: user2Id },
              select: { id: true, name: true, photos: true },
            }),
          ]);

          // Emit to both users' personal rooms
          io.to(`user:${user1Id}`).emit('new-match', {
            matchId: match.id,
            user: user2,
            timestamp: match.createdAt,
          });

          io.to(`user:${user2Id}`).emit('new-match', {
            matchId: match.id,
            user: user1,
            timestamp: match.createdAt,
          });

          logger.info(`📡 Real-time match events sent for match ${match.id}`);
        }
      } else {
        match = existingMatch;
        logger.info(`Match already exists: ${existingMatch.id}`);
      }
    }

    logger.info(
      `${actionType} action saved: ${senderId} -> ${receiverId}, isMatch: ${isMatch}`,
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
const passUser = async (senderId, receiverId) => {
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

    logger.info(`Retrieved ${actions.length} actions for user ${userId}`);
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
    // Get the most recent action
    const lastAction = await prisma.userAction.findFirst({
      where: { senderId: userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!lastAction) {
      throw new Error('No actions to undo');
    }

    // If this was a like that created a match, we need to handle the match
    if (lastAction.action === 'LIKE') {
      // Check if there's a match between these users
      const match = await prisma.match.findFirst({
        where: {
          OR: [
            { user1Id: userId, user2Id: lastAction.receiverId },
            { user1Id: lastAction.receiverId, user2Id: userId },
          ],
          isActive: true,
        },
      });

      if (match) {
        // Check if the other user also liked (if so, this undo would break the match)
        const reverseAction = await prisma.userAction.findUnique({
          where: {
            senderId_receiverId: {
              senderId: lastAction.receiverId,
              receiverId: userId,
            },
          },
        });

        if (reverseAction && reverseAction.action === 'LIKE') {
          // This would break a mutual match, need to deactivate the match
          await prisma.match.update({
            where: { id: match.id },
            data: { isActive: false },
          });

          logger.info(`Match ${match.id} deactivated due to undo action`);
        }
      }
    }

    // Delete the action
    await prisma.userAction.delete({
      where: { id: lastAction.id },
    });

    logger.info(`Action undone: ${lastAction.id} (${lastAction.action})`);

    return {
      success: true,
      undoneAction: lastAction,
    };
  } catch (error) {
    logger.error('❌ Error undoing last action:', error);
    throw error;
  }
};

module.exports = {
  likeUser,
  passUser,
  getUserActions,
  undoLastAction,
};
