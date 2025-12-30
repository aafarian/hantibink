const logger = require('../utils/logger');
const { getPrismaClient } = require('../config/database');

const prisma = getPrismaClient();

/**
 * Add or toggle a reaction to a message
 */
const addReaction = async (messageId, userId, emoji, io = null) => {
  try {
    // Get the message and verify access
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        match: true,
      },
    });

    if (!message) {
      throw new Error('Message not found');
    }

    // Verify user has access to this match
    const { match } = message;
    if (match.user1Id !== userId && match.user2Id !== userId) {
      throw new Error('Unauthorized access to message');
    }

    // Check if reaction already exists
    const existingReaction = await prisma.messageReaction.findUnique({
      where: {
        messageId_userId_emoji: {
          messageId,
          userId,
          emoji,
        },
      },
    });

    let action;

    if (existingReaction) {
      // Remove the reaction (toggle off)
      await prisma.messageReaction.delete({
        where: { id: existingReaction.id },
      });
      action = 'removed';
      logger.info(`Reaction ${emoji} removed from message ${messageId} by user ${userId}`);
    } else {
      // Add the reaction
      await prisma.messageReaction.create({
        data: {
          messageId,
          userId,
          emoji,
        },
      });
      action = 'added';
      logger.info(`Reaction ${emoji} added to message ${messageId} by user ${userId}`);
    }

    // Get updated reactions for the message
    const reactions = await getReactionsForMessage(messageId);

    // Emit WebSocket event for real-time sync
    if (io) {
      io.to(`match:${match.id}`).emit('message-reaction', {
        matchId: match.id,
        messageId,
        reactions,
        updatedBy: userId,
        action,
        emoji,
      });
      logger.info(`📡 Reaction event emitted for message ${messageId}`);
    }

    return {
      success: true,
      action,
      reactions,
    };
  } catch (error) {
    logger.error('❌ Error adding reaction:', error);
    throw error;
  }
};

/**
 * Remove a specific reaction from a message
 */
const removeReaction = async (messageId, userId, emoji, io = null) => {
  try {
    // Get the message and verify access
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        match: true,
      },
    });

    if (!message) {
      throw new Error('Message not found');
    }

    // Verify user has access to this match
    const { match } = message;
    if (match.user1Id !== userId && match.user2Id !== userId) {
      throw new Error('Unauthorized access to message');
    }

    // Find and delete the reaction
    const existingReaction = await prisma.messageReaction.findUnique({
      where: {
        messageId_userId_emoji: {
          messageId,
          userId,
          emoji,
        },
      },
    });

    if (!existingReaction) {
      throw new Error('Reaction not found');
    }

    await prisma.messageReaction.delete({
      where: { id: existingReaction.id },
    });

    logger.info(`Reaction ${emoji} removed from message ${messageId} by user ${userId}`);

    // Get updated reactions for the message
    const reactions = await getReactionsForMessage(messageId);

    // Emit WebSocket event for real-time sync
    if (io) {
      io.to(`match:${match.id}`).emit('message-reaction', {
        matchId: match.id,
        messageId,
        reactions,
        updatedBy: userId,
        action: 'removed',
        emoji,
      });
      logger.info(`📡 Reaction removal event emitted for message ${messageId}`);
    }

    return {
      success: true,
      reactions,
    };
  } catch (error) {
    logger.error('❌ Error removing reaction:', error);
    throw error;
  }
};

/**
 * Get all reactions for a message, grouped by emoji
 * Returns: { "❤️": ["userId1", "userId2"], "😂": ["userId3"] }
 */
const getReactionsForMessage = async (messageId) => {
  try {
    const reactions = await prisma.messageReaction.findMany({
      where: { messageId },
      select: {
        emoji: true,
        userId: true,
      },
    });

    // Group by emoji
    const grouped = {};
    for (const reaction of reactions) {
      if (!grouped[reaction.emoji]) {
        grouped[reaction.emoji] = [];
      }
      grouped[reaction.emoji].push(reaction.userId);
    }

    return grouped;
  } catch (error) {
    logger.error('❌ Error getting reactions:', error);
    throw error;
  }
};

/**
 * Get reactions for multiple messages (bulk)
 * Returns: { messageId: { "❤️": ["userId1"], ... }, ... }
 */
const getReactionsForMessages = async (messageIds) => {
  try {
    const reactions = await prisma.messageReaction.findMany({
      where: { messageId: { in: messageIds } },
      select: {
        messageId: true,
        emoji: true,
        userId: true,
      },
    });

    // Group by messageId, then by emoji
    const grouped = {};
    for (const reaction of reactions) {
      if (!grouped[reaction.messageId]) {
        grouped[reaction.messageId] = {};
      }
      if (!grouped[reaction.messageId][reaction.emoji]) {
        grouped[reaction.messageId][reaction.emoji] = [];
      }
      grouped[reaction.messageId][reaction.emoji].push(reaction.userId);
    }

    return grouped;
  } catch (error) {
    logger.error('❌ Error getting reactions for messages:', error);
    throw error;
  }
};

module.exports = {
  addReaction,
  removeReaction,
  getReactionsForMessage,
  getReactionsForMessages,
};
