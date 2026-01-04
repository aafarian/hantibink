import { Mixpanel } from 'mixpanel-react-native';
import Logger from './logger';

// Initialize Mixpanel - will be null if no token configured
let mixpanel = null;

const MIXPANEL_TOKEN = process.env.EXPO_PUBLIC_MIXPANEL_TOKEN;

/**
 * Initialize analytics - call once at app startup
 * Safe to call multiple times - will only initialize once
 */
export const initAnalytics = async () => {
  // Already initialized
  if (mixpanel) return;

  if (!MIXPANEL_TOKEN) {
    Logger.warn('📊 Analytics disabled - no MIXPANEL_TOKEN configured');
    return;
  }

  try {
    const instance = new Mixpanel(MIXPANEL_TOKEN, true); // true = track automatic events
    await instance.init();
    mixpanel = instance; // Only assign after successful init
    Logger.info('📊 Analytics initialized');
  } catch (error) {
    Logger.error('📊 Failed to initialize analytics:', error);
    mixpanel = null; // Ensure mixpanel stays null on failure
  }
};

/**
 * Identify user - call after login/registration
 */
export const identifyUser = (userId, traits = {}) => {
  if (!mixpanel || !userId) return;

  try {
    mixpanel.identify(String(userId));

    // Get people instance safely
    const people = mixpanel.getPeople?.();
    if (!people) return;

    // Set user properties
    if (traits.email) people.set('$email', traits.email);
    if (traits.name) people.set('$name', traits.name);
    if (traits.createdAt) people.set('$created', traits.createdAt);

    // Set custom properties
    if (traits && typeof traits === 'object') {
      Object.entries(traits).forEach(([key, value]) => {
        if (!['email', 'name', 'createdAt'].includes(key) && value !== undefined) {
          people.set(key, value);
        }
      });
    }

    Logger.debug('📊 User identified:', userId);
  } catch (error) {
    Logger.error('📊 Failed to identify user:', error);
  }
};

/**
 * Reset analytics - call on logout
 */
export const resetAnalytics = () => {
  if (!mixpanel) return;

  try {
    mixpanel.reset();
    Logger.debug('📊 Analytics reset');
  } catch (error) {
    Logger.error('📊 Failed to reset analytics:', error);
  }
};

/**
 * Track an event
 * Safe to call even if analytics not initialized - will silently no-op
 */
export const track = (eventName, properties = {}) => {
  if (!mixpanel || !eventName) return;

  try {
    // Ensure properties is an object
    const safeProps = properties && typeof properties === 'object' ? properties : {};
    mixpanel.track(String(eventName), safeProps);
    Logger.debug('📊 Event tracked:', eventName, safeProps);
  } catch (error) {
    // Never let analytics crash the app
    Logger.error('📊 Failed to track event:', error);
  }
};

// ============================================
// Pre-defined event helpers for consistency
// ============================================

// Auth events
export const trackRegistrationStarted = method => {
  track('Registration Started', { method }); // email, google, apple
};

export const trackRegistrationCompleted = (method, hasPhotos = false) => {
  track('Registration Completed', { method, has_photos: hasPhotos });
};

export const trackLogin = method => {
  track('Login', { method });
};

export const trackLogout = () => {
  track('Logout');
};

// Profile events
export const trackProfileCompleted = completionPercentage => {
  track('Profile Completed', { completion_percentage: completionPercentage });
};

export const trackProfileUpdated = (fieldsUpdated = []) => {
  track('Profile Updated', { fields_updated: fieldsUpdated });
};

export const trackPhotoAdded = photoCount => {
  track('Photo Added', { total_photos: photoCount });
};

export const trackPhotoRemoved = photoCount => {
  track('Photo Removed', { total_photos: photoCount });
};

// Discovery events
export const trackSwipeRight = () => {
  track('Swipe Right');
};

export const trackSwipeLeft = () => {
  track('Swipe Left');
};

export const trackSuperLike = () => {
  track('Super Like');
};

export const trackMatchCreated = () => {
  track('Match Created');
};

export const trackProfileViewed = duration => {
  track('Profile Viewed', { duration_seconds: duration });
};

// Messaging events
export const trackChatOpened = source => {
  track('Chat Opened', { source }); // matches_list, notification, new_match
};

export const trackMessageSent = (messageType = 'text') => {
  track('Message Sent', { type: messageType }); // text, gif, image
};

export const trackGifSent = () => {
  track('GIF Sent');
};

export const trackVoiceMessageSent = (durationSeconds = 0) => {
  track('Voice Message Sent', { duration_seconds: durationSeconds });
};

// Engagement events
export const trackAppOpened = (source = 'direct') => {
  track('App Opened', { source }); // direct, notification, deep_link
};

export const trackScreenViewed = screenName => {
  track('Screen Viewed', { screen: screenName });
};

// Moderation events
export const trackUserBlocked = () => {
  track('User Blocked');
};

export const trackUserReported = reason => {
  track('User Reported', { reason });
};

export const trackUnmatched = () => {
  track('Unmatched');
};

// Settings events
export const trackPreferencesUpdated = (changes = {}) => {
  track('Preferences Updated', changes);
};

export const trackNotificationSettingsChanged = enabled => {
  track('Notification Settings Changed', { enabled });
};

export const trackProfilePaused = () => {
  track('Profile Paused');
};

export const trackProfileResumed = () => {
  track('Profile Resumed');
};

// Premium events (for future use)
export const trackPremiumPromptShown = feature => {
  track('Premium Prompt Shown', { trigger_feature: feature });
};

export const trackPremiumPurchased = plan => {
  track('Premium Purchased', { plan });
};

export default {
  initAnalytics,
  identifyUser,
  resetAnalytics,
  track,
  // Auth
  trackRegistrationStarted,
  trackRegistrationCompleted,
  trackLogin,
  trackLogout,
  // Profile
  trackProfileCompleted,
  trackProfileUpdated,
  trackPhotoAdded,
  trackPhotoRemoved,
  // Discovery
  trackSwipeRight,
  trackSwipeLeft,
  trackSuperLike,
  trackMatchCreated,
  trackProfileViewed,
  // Messaging
  trackChatOpened,
  trackMessageSent,
  trackGifSent,
  trackVoiceMessageSent,
  // Engagement
  trackAppOpened,
  trackScreenViewed,
  // Moderation
  trackUserBlocked,
  trackUserReported,
  trackUnmatched,
  // Settings
  trackPreferencesUpdated,
  trackNotificationSettingsChanged,
  trackProfilePaused,
  trackProfileResumed,
  // Premium
  trackPremiumPromptShown,
  trackPremiumPurchased,
};
