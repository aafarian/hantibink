const logger = require('../utils/logger');

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
 */
async function sendMessageNotification(pushToken, senderName, messagePreview) {
  return sendPushNotification(pushToken, {
    title: `💬 ${senderName}`,
    body: messagePreview,
    data: { type: 'message' },
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
};
