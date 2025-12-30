const logger = require('../utils/logger');
const { getPrismaClient } = require('../config/database');
const { sendMessageNotification } = require('./notificationService');
const { getReactionsForMessages } = require('./reactionsService');

const prisma = getPrismaClient();

/**
 * Get messages for a match
 */
const getMessages = async (matchId, userId, options = {}) => {
  try {
    const { limit = 50, offset = 0 } = options;

    // Verify user has access to this match
    const match = await prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      throw new Error('Match not found');
    }

    if (match.user1Id !== userId && match.user2Id !== userId) {
      throw new Error('Unauthorized access to match');
    }

    if (!match.isActive) {
      throw new Error('Match is no longer active');
    }

    // Get messages
    const messages = await prisma.message.findMany({
      where: { matchId },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
          },
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            messageType: true,
            senderId: true,
            sender: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
      skip: offset,
    });

    // Get reactions for all messages
    const messageIds = messages.map((m) => m.id);
    const reactionsMap = await getReactionsForMessages(messageIds);

    // Transform messages for client
    const transformedMessages = messages.map((message) => ({
      id: message.id,
      content: message.content,
      messageType: message.messageType,
      mediaUrl: message.mediaUrl,
      senderId: message.senderId,
      senderName: message.sender.name,
      isFromMe: message.senderId === userId,
      timestamp: message.createdAt,
      isRead: message.isRead,
      readAt: message.readAt,
      isDelivered: message.isDelivered,
      deliveredAt: message.deliveredAt,
      reactions: reactionsMap[message.id] || {},
      replyTo: message.replyTo ? {
        id: message.replyTo.id,
        content: message.replyTo.content,
        messageType: message.replyTo.messageType,
        senderId: message.replyTo.senderId,
        senderName: message.replyTo.sender?.name,
      } : null,
    }));

    logger.info(
      `Retrieved ${transformedMessages.length} messages for match ${matchId}`,
    );
    return transformedMessages;
  } catch (error) {
    logger.error('❌ Error getting messages:', error);
    throw error;
  }
};

/**
 * Send a message in a match
 */
const sendMessage = async (matchId, senderId, messageData, io = null) => {
  try {
    const { content, messageType = 'TEXT', mediaUrl = null, replyToId = null } = messageData;

    // Verify user has access to this match
    const match = await prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      throw new Error('Match not found');
    }

    if (match.user1Id !== senderId && match.user2Id !== senderId) {
      throw new Error('Unauthorized access to match');
    }

    if (!match.isActive) {
      throw new Error('Cannot send message to inactive match');
    }

    // Get receiver ID
    const receiverId =
      match.user1Id === senderId ? match.user2Id : match.user1Id;

    // Create message
    const message = await prisma.message.create({
      data: {
        matchId,
        senderId,
        receiverId,
        content,
        messageType,
        mediaUrl,
        replyToId,
        isDelivered: true,
        deliveredAt: new Date(),
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
          },
        },
        replyTo: {
          select: {
            id: true,
            content: true,
            messageType: true,
            senderId: true,
            sender: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    // Determine last message preview (show [GIF] for GIFs, etc.)
    let lastMessagePreview = content;
    if (messageType === 'GIF') {
      lastMessagePreview = '[GIF]';
    } else if (messageType === 'IMAGE') {
      lastMessagePreview = '[Image]';
    } else if (messageType === 'VIDEO') {
      lastMessagePreview = '[Video]';
    }

    // Update match with last message info
    await prisma.match.update({
      where: { id: matchId },
      data: {
        lastMessage: lastMessagePreview,
        lastMessageTime: message.createdAt,
        lastMessageBy: senderId,
      },
    });

    // Transform message for response
    const transformedMessage = {
      id: message.id,
      content: message.content,
      messageType: message.messageType,
      mediaUrl: message.mediaUrl,
      senderId: message.senderId,
      senderName: message.sender.name,
      timestamp: message.createdAt,
      isRead: message.isRead,
      isDelivered: message.isDelivered,
      reactions: {},
      replyTo: message.replyTo ? {
        id: message.replyTo.id,
        content: message.replyTo.content,
        messageType: message.replyTo.messageType,
        senderId: message.replyTo.senderId,
        senderName: message.replyTo.sender?.name,
      } : null,
    };

    logger.info(`Message sent in match ${matchId} by user ${senderId}`);

    // Emit WebSocket event for real-time delivery
    if (io) {
      // Emit to the match room (both users will be listening)
      io.to(`match:${matchId}`).emit('new-message', {
        matchId,
        message: transformedMessage,
      });

      // Emit to receiver's personal room for notifications
      io.to(`user:${receiverId}`).emit('message-notification', {
        matchId,
        senderId,
        senderName: message.sender.name,
        content:
          content.length > 50 ? `${content.substring(0, 50)}...` : content,
        timestamp: message.createdAt,
      });

      logger.info(`📡 Real-time message events sent for match ${matchId}`);
    }

    // Send push notification to receiver
    const receiver = await prisma.user.findUnique({
      where: { id: receiverId },
      select: { pushToken: true },
    });

    if (receiver?.pushToken) {
      const messagePreview =
        lastMessagePreview.length > 100 ? `${lastMessagePreview.substring(0, 100)}...` : lastMessagePreview;
      sendMessageNotification(
        receiver.pushToken,
        message.sender.name,
        messagePreview
      ).catch(err =>
        logger.error('Failed to send push notification for message:', err)
      );
    }

    return transformedMessage;
  } catch (error) {
    logger.error('❌ Error sending message:', error);
    throw error;
  }
};

/**
 * Mark messages as read
 */
const markMessagesAsRead = async (
  matchId,
  userId,
  messageIds = [],
  io = null,
) => {
  try {
    // Verify user has access to this match
    const match = await prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      throw new Error('Match not found');
    }

    if (match.user1Id !== userId && match.user2Id !== userId) {
      throw new Error('Unauthorized access to match');
    }

    // Build where clause
    const whereClause = {
      matchId,
      senderId: { not: userId }, // Only mark messages from other user as read
      isRead: false,
    };

    // If specific message IDs provided, only mark those
    if (messageIds.length > 0) {
      whereClause.id = { in: messageIds };
    }

    // Mark messages as read
    const result = await prisma.message.updateMany({
      where: whereClause,
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    logger.info(
      `Marked ${result.count} messages as read in match ${matchId} by user ${userId}`,
    );

    // Emit WebSocket event for read receipts
    if (io && result.count > 0) {
      // Get the other user ID
      const otherUserId =
        match.user1Id === userId ? match.user2Id : match.user1Id;

      // Emit to the match room that messages were read
      io.to(`match:${matchId}`).emit('messages-read', {
        matchId,
        readByUserId: userId,
        messageCount: result.count,
        timestamp: new Date(),
      });

      // Emit to sender's personal room for read receipt notification
      io.to(`user:${otherUserId}`).emit('read-receipt', {
        matchId,
        readByUserId: userId,
        messageCount: result.count,
      });

      logger.info(`📧 Read receipt events sent for match ${matchId}`);
    }

    return {
      success: true,
      markedCount: result.count,
    };
  } catch (error) {
    logger.error('❌ Error marking messages as read:', error);
    throw error;
  }
};

/**
 * Delete a message
 */
const deleteMessage = async (messageId, userId) => {
  try {
    // Get message and verify ownership
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        match: true,
      },
    });

    if (!message) {
      throw new Error('Message not found');
    }

    if (message.senderId !== userId) {
      throw new Error('You can only delete your own messages');
    }

    // Delete the message
    await prisma.message.delete({
      where: { id: messageId },
    });

    logger.info(`Message ${messageId} deleted by user ${userId}`);

    return {
      success: true,
      deletedMessage: message,
    };
  } catch (error) {
    logger.error('❌ Error deleting message:', error);
    throw error;
  }
};

module.exports = {
  getMessages,
  sendMessage,
  markMessagesAsRead,
  deleteMessage,
};
