const logger = require('../utils/logger');
const { getPrismaClient } = require('../config/database');
const { sendMessageNotification, shouldSendNotification } = require('./notificationService');
const { getReactionsForMessages } = require('./reactionsService');

const prisma = getPrismaClient();

/**
 * Get messages for a match
 */
const getMessages = async (matchId, userId, options = {}) => {
  try {
    const { limit = 100, offset = 0 } = options;

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

    // Get the most recent messages first, then reverse for chronological display
    // This ensures we always get the newest messages when there's a limit
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
      orderBy: { createdAt: 'desc' },  // Get newest first
      take: limit,
      skip: offset,
    });

    // Reverse to get chronological order for display
    messages.reverse();

    // Get reactions for all messages
    const messageIds = messages.map((m) => m.id);
    const reactionsMap = await getReactionsForMessages(messageIds);

    // Transform messages for client
    const transformedMessages = messages.map((message) => ({
      id: message.id,
      content: message.content,
      messageType: message.messageType,
      mediaUrl: message.mediaUrl,
      metadata: message.metadata,
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
    const { content, messageType = 'TEXT', mediaUrl = null, metadata = null, replyToId = null } = messageData;

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

    // Defense in depth: blocking deactivates the match, but re-check here in
    // case a message races the block or a match is ever reactivated.
    const { isUserBlocked } = require('./moderationService');
    if (await isUserBlocked(senderId, receiverId)) {
      throw new Error('Cannot send message to inactive match');
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        matchId,
        senderId,
        receiverId,
        content,
        messageType,
        mediaUrl,
        metadata,
        replyToId,
        isDelivered: true,
        deliveredAt: new Date(),
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            photos: true,
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
    } else if (messageType === 'AUDIO') {
      lastMessagePreview = '[Voice message]';
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
      metadata: message.metadata,
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
      const messagePayload = {
        matchId,
        message: transformedMessage,
      };

      // Emit to the match room (for users who have chat open)
      io.to(`match:${matchId}`).emit('new-message', messagePayload);

      // Also emit to BOTH personal rooms. The receiver needs it for threads
      // list updates when not in chat; the sender needs it for messages the
      // SERVER authors on their behalf (game start/summary cards) — their
      // match-room membership can silently lapse across reconnects, and the
      // client dedupes self-sent chat messages by id, so this is safe.
      io.to(`user:${receiverId}`).emit('new-message', messagePayload);
      io.to(`user:${senderId}`).emit('new-message', messagePayload);

      // Emit message notification for push/in-app notifications
      io.to(`user:${receiverId}`).emit('message-notification', {
        matchId,
        senderId,
        senderName: message.sender.name,
        content:
          content.length > 50 ? `${content.substring(0, 50)}...` : content,
        timestamp: message.createdAt,
      });

      logger.info(`📡 Real-time message events sent for match ${matchId} (to match room and user:${receiverId})`);
    }

    // Send push notification to receiver with stacked unread messages
    const receiver = await prisma.user.findUnique({
      where: { id: receiverId },
      select: { pushToken: true },
    });

    if (receiver?.pushToken) {
      // Check global preference AND the per-match mute
      const shouldNotify = await shouldSendNotification(receiverId, 'messages');
      const muted = await prisma.mutedMatch.findFirst({
        where: { userId: receiverId, matchId },
        select: { id: true },
      });
      if (!shouldNotify || muted) {
        logger.info(`📵 Message notification skipped for ${receiverId} (${muted ? 'match muted' : 'messages disabled'})`);
      } else {
        // Get recent unread messages from this sender in this match (for stacking)
        const recentUnread = await prisma.message.findMany({
          where: {
            matchId,
            senderId,
            receiverId,
            isRead: false,
          },
          orderBy: { createdAt: 'desc' },
          take: 5, // Max 5 messages in stacked notification
          select: { content: true, messageType: true },
        });

        const unreadCount = recentUnread.length;
        logger.info(`📊 Notification: ${unreadCount} unread messages from ${message.sender.name}`);

        // Simple notification: count in title, latest message in body
        const notificationBody = lastMessagePreview.length > 100
          ? `${lastMessagePreview.substring(0, 100)}...`
          : lastMessagePreview;

        const title = unreadCount > 1
          ? `💬 ${message.sender.name} (${unreadCount})`
          : `💬 ${message.sender.name}`;

        sendMessageNotification(
          receiver.pushToken,
          title,
          notificationBody,
          {
            matchId,
            sender: {
              id: message.sender.id,
              name: message.sender.name,
              photos: message.sender.photos,
            },
          }
        ).catch(err =>
          logger.error('Failed to send push notification for message:', err)
        );
      }
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

      const readData = {
        matchId,
        readByUserId: userId,
        messageCount: result.count,
        timestamp: new Date(),
      };

      // Emit to the match room that messages were read (for users in chat)
      io.to(`match:${matchId}`).emit('messages-read', readData);

      // Also emit to both users' personal rooms (for threads list updates)
      io.to(`user:${userId}`).emit('messages-read', readData);
      io.to(`user:${otherUserId}`).emit('messages-read', readData);

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

/**
 * Search a conversation by text and/or message type (voice notes, games).
 * Newest first, capped — results carry enough to render a preview row.
 */
const searchMessages = async (matchId, userId, { q = '', type = null, limit = 100 } = {}) => {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) {
    throw new Error('Match not found');
  }
  if (match.user1Id !== userId && match.user2Id !== userId) {
    throw new Error('Unauthorized access to match');
  }

  const query = String(q || '').trim();
  const where = {
    matchId,
    ...(type ? { messageType: type } : {}),
    ...(query ? { content: { contains: query, mode: 'insensitive' } } : {}),
  };

  const messages = await prisma.message.findMany({
    where,
    select: {
      id: true,
      content: true,
      messageType: true,
      metadata: true,
      senderId: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Number(limit) || 100, 100),
  });

  return messages;
};

module.exports = {
  getMessages,
  sendMessage,
  markMessagesAsRead,
  deleteMessage,
  searchMessages,
};
