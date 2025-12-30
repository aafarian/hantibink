import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import Logger from './logger';
import ApiClient from '../services/ApiClient';

// Configure notification behavior - wrapped in try-catch to prevent crash on module load
try {
  Notifications.setNotificationHandler({
    handleNotification: async notification => {
      const data = notification.request.content.data;

      // For message notifications, dismiss any existing notifications for this match
      // so the new one (with updated count) replaces them
      if (data?.type === 'message' && data?.matchId) {
        try {
          const presented = await Notifications.getPresentedNotificationsAsync();
          for (const n of presented) {
            if (n.request.content.data?.matchId === data.matchId) {
              await Notifications.dismissNotificationAsync(n.request.identifier);
            }
          }
        } catch (err) {
          // Ignore errors - just show the notification
        }
      }

      return {
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      };
    },
  });
} catch (error) {
  // Silently fail - notifications will still work, just won't show when app is in foreground
  Logger.warn('Failed to set notification handler:', error?.message);
}

/**
 * Clear notifications for a match (call when user opens the chat)
 * @param {string} matchId - The match ID to clear
 */
export function clearNotificationForMatch(matchId) {
  // Dismiss all delivered notifications for this match
  Notifications.getPresentedNotificationsAsync()
    .then(notifications => {
      notifications.forEach(notification => {
        if (notification.request.content.data?.matchId === matchId) {
          Notifications.dismissNotificationAsync(notification.request.identifier).catch(() => {});
        }
      });
    })
    .catch(() => {});
}

/**
 * Request notification permissions and register for push notifications
 * @returns {Promise<boolean>} Whether registration was successful
 */
export async function registerForPushNotificationsAsync() {
  try {
    // Check if running on a physical device
    if (!Device.isDevice) {
      Logger.info('📱 Push notifications require a physical device - skipping registration');
      return false;
    }

    // Configure notification channel for Android first
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Messages',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        showBadge: true,
        enableVibrate: true,
        enableLights: true,
      });
    }

    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permissions if not already granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      Logger.info('📱 Push notification permissions not granted by user');
      return false;
    }

    // Get the project ID from Constants or use hardcoded value
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId || '316f94ce-dca3-4d3d-868a-5885e6704f84';

    // Get Expo push token
    const token = await Notifications.getExpoPushTokenAsync({ projectId });

    Logger.info('📱 Push token obtained:', token.data);

    // Send token to backend
    try {
      await ApiClient.post('/users/push-token', {
        pushToken: token.data,
      });
      Logger.success('✅ Push token registered with server');
    } catch (apiError) {
      // Log but don't fail - push token can be registered later
      Logger.warn('📱 Could not save push token to server (will retry later):', apiError.message);
    }

    return true;
  } catch (error) {
    // Be more graceful with errors - don't alarm the user
    if (error.message?.includes('not configured') || error.message?.includes('credentials')) {
      Logger.info('📱 Push notifications not configured for this build - skipping');
    } else {
      Logger.warn('📱 Push notification setup incomplete:', error.message);
    }
    return false;
  }
}

/**
 * Handle notification received while app is in foreground
 */
export function addNotificationReceivedListener(callback) {
  return Notifications.addNotificationReceivedListener(callback);
}

/**
 * Handle notification tap/click
 */
export function addNotificationResponseReceivedListener(callback) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

/**
 * Schedule a local notification (for testing)
 */
export async function scheduleTestNotification() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Test Notification',
      body: 'This is a test notification from Hantibink!',
      data: { type: 'test' },
    },
    trigger: { seconds: 2 },
  });
}
