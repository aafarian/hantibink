const logger = require('../utils/logger');
const { getPrismaClient } = require('../config/database');

const prisma = getPrismaClient();

/**
 * Check if a notification should be sent based on user preferences
 * @param {string} userId - User ID to check preferences for
 * @param {string} type - Notification type: 'messages', 'matches', or 'likes'
 * @returns {Promise<boolean>} - Whether the notification should be sent
 */
async function shouldSendNotification(userId, type) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        notifyMessages: true,
        notifyMatches: true,
        notifyLikes: true,
      },
    });

    if (!user) {
      return false;
    }

    switch (type) {
      case 'messages':
        return user.notifyMessages !== false;
      case 'matches':
        return user.notifyMatches !== false;
      case 'likes':
        return user.notifyLikes !== false;
      default:
        return true;
    }
  } catch (error) {
    logger.error('Error checking notification preferences:', error);
    // Default to sending if we can't check preferences
    return true;
  }
}

/**
 * Send push notification using Expo Push Notification Service
 * @param {string} pushToken - Expo push token
 * @param {object} notification - Notification data
 * @param {string} notification.title - Notification title
 * @param {string} notification.body - Notification body
 * @param {object} notification.data - Additional data
 */
async function sendPushNotification(pushToken, notification) {
  try {
    if (!pushToken || !pushToken.startsWith('ExponentPushToken[')) {
      logger.warn('Invalid push token format:', pushToken);
      return { success: false, error: 'Invalid push token format' };
    }

    const message = {
      to: pushToken,
      sound: 'default',
      title: notification.title,
      body: notification.body,
      data: notification.data || {},
      priority: 'high',
      channelId: 'default',
    };

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      logger.error('Push notification HTTP error:', response.status);
      return { success: false, error: `HTTP ${response.status}` };
    }

    const result = await response.json();

    if (result.data && result.data.status === 'error') {
      logger.error('Push notification error:', result.data);
      return { success: false, error: result.data.message };
    }

    logger.info('Push notification sent successfully:', {
      token: `${pushToken.substring(0, 20)}...`,
      title: notification.title,
    });

    return { success: true, data: result };
  } catch (error) {
    logger.error('Failed to send push notification:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send notification for a new match
 */
async function sendMatchNotification(pushToken, matchedUserName) {
  return sendPushNotification(pushToken, {
    title: '🎉 New Match!',
    body: `You matched with ${matchedUserName}!`,
    data: { type: 'match' },
  });
}

/**
 * Send notification for a new message
 * @param {string} pushToken - Expo push token
 * @param {string} title - Notification title (e.g. "💬 John" or "💬 John (3)")
 * @param {string} body - Message content
 * @param {object} navigationData - Data needed for navigating to chat on tap
 * @param {string} navigationData.matchId - Match ID
 * @param {object} navigationData.sender - Sender info (id, name, photos)
 */
async function sendMessageNotification(pushToken, title, body, navigationData = {}) {
  const { matchId, sender } = navigationData;
  return sendPushNotification(pushToken, {
    title,
    body,
    data: {
      type: 'message',
      matchId,
      otherUser: sender ? {
        id: sender.id,
        name: sender.name,
        photos: sender.photos || [],
      } : null,
    },
  });
}

/**
 * Send notification for a new like
 */
async function sendLikeNotification(pushToken, likerName) {
  return sendPushNotification(pushToken, {
    title: '💖 Someone likes you!',
    body: `${likerName} likes you!`,
    data: { type: 'like' },
  });
}

/**
 * Send notification for a super like
 */
async function sendSuperLikeNotification(pushToken, likerName) {
  return sendPushNotification(pushToken, {
    title: '⭐ Super Like!',
    body: `${likerName} super liked you!`,
    data: { type: 'superlike' },
  });
}

module.exports = {
  sendPushNotification,
  sendMatchNotification,
  sendMessageNotification,
  sendLikeNotification,
  sendSuperLikeNotification,
  shouldSendNotification,
};
