import apiClient from './ApiClient';
import Logger from '../utils/logger';

/**
 * API-based Data Service
 * Replaces Firebase DataService with API calls
 */
class ApiDataService {
  // ============ USER PROFILE METHODS ============

  /**
   * Get user profile from API
   */
  static async getUserProfile() {
    try {
      Logger.info('📊 Getting user profile from API...');

      const response = await apiClient.getUserProfile();

      if (response.success) {
        Logger.success('✅ User profile loaded from API');
        return response.data.data;
      } else {
        Logger.error('❌ Failed to get user profile from API:', response.message);
        return null;
      }
    } catch (error) {
      Logger.error('❌ Error getting user profile from API:', error);
      return null;
    }
  }

  /**
   * Update user profile via API
   * Note: userId is not needed as API uses JWT to identify user
   */
  static async updateUserProfile(profileData) {
    try {
      Logger.info('📝 Updating user profile via API...');

      const response = await apiClient.updateUserProfile(profileData);

      if (response.success) {
        Logger.success('✅ User profile updated via API');
        return true;
      } else {
        Logger.error('❌ Failed to update user profile via API:', response.message);
        return false;
      }
    } catch (error) {
      Logger.error('❌ Error updating user profile via API:', error);
      return false;
    }
  }

  /**
   * Complete profile setup via API
   */
  static async completeProfileSetup(setupData) {
    try {
      Logger.info('🎯 Completing profile setup via API...');

      const response = await apiClient.post('/users/profile/complete-setup', setupData);

      if (response.success) {
        Logger.success('✅ Profile setup completed via API');
        return response.data;
      } else {
        Logger.error('❌ Failed to complete profile setup via API:', response.message);
        throw new Error(response.message || 'Setup failed');
      }
    } catch (error) {
      Logger.error('❌ Error completing profile setup via API:', error);
      throw error;
    }
  }

  /**
   * Add photo URL to user profile via API
   */
  static async addPhotoUrl(photoUrl, isMain = false) {
    try {
      Logger.info('📷 Adding photo URL via API...');

      const response = await apiClient.post('/users/photos', {
        photoUrl,
        isMain,
      });

      if (response.success) {
        Logger.success('✅ Photo added via API');
        return response.data;
      } else {
        Logger.error('❌ Failed to add photo via API:', response.message);
        throw new Error(response.message || 'Failed to add photo');
      }
    } catch (error) {
      Logger.error('❌ Error adding photo via API:', error);
      throw error;
    }
  }

  // ============ AUTHENTICATION METHODS ============

  /**
   * Register new user via API
   */
  static async registerUser(userData) {
    try {
      Logger.info('👤 Registering user via API...');

      const response = await apiClient.register(userData);

      if (response.success) {
        Logger.success('✅ User registered via API');
        return response.data.data;
      } else {
        Logger.error('❌ Failed to register user via API:', response.message);
        throw new Error(response.message || 'Registration failed');
      }
    } catch (error) {
      Logger.error('❌ Error registering user via API:', error);
      throw error;
    }
  }

  /**
   * Login user via API
   */
  static async loginUser(email, password) {
    try {
      Logger.info('🔐 Logging in user via API...');

      const response = await apiClient.login(email, password);

      if (response.success) {
        Logger.success('✅ User logged in via API');
        return response.data.data;
      } else {
        Logger.error('❌ Failed to login user via API:', response.message);
        throw new Error(response.message || 'Login failed');
      }
    } catch (error) {
      Logger.error('❌ Error logging in user via API:', error);
      // Throw a clean error message without the "Error: " prefix
      const cleanMessage = error.message || 'Login failed';
      throw new Error(cleanMessage);
    }
  }

  // ============ PREFERENCES METHODS ============

  /**
   * Get user preferences from API
   * Note: userId parameter is not used since API uses JWT for user identification
   */
  static async getUserPreferences() {
    try {
      Logger.info('⚙️ Getting user preferences from API...');

      const response = await apiClient.getUserPreferences();

      if (response.success) {
        Logger.success('✅ User preferences loaded from API');
        return response.data.data;
      } else {
        Logger.error('❌ Failed to get user preferences from API:', response.message);
        return null;
      }
    } catch (error) {
      Logger.error('❌ Error getting user preferences from API:', error);
      return null;
    }
  }

  /**
   * Update user preferences via API
   * Note: userId parameter is not used since API uses JWT for user identification
   */
  static async updateUserPreferences(preferences) {
    try {
      Logger.info('⚙️ Updating user preferences via API...');

      const response = await apiClient.updateUserPreferences(preferences);

      if (response.success) {
        Logger.success('✅ User preferences updated via API');
        return true;
      } else {
        Logger.error('❌ Failed to update user preferences via API:', response.message);
        return false;
      }
    } catch (error) {
      Logger.error('❌ Error updating user preferences via API:', error);
      return false;
    }
  }

  // ============ UTILITY METHODS ============

  /**
   * Check API health
   */
  static async checkApiHealth() {
    try {
      Logger.info('🏥 Checking API health...');

      const response = await apiClient.healthCheck();

      if (response.success) {
        Logger.success('✅ API is healthy');
        return true;
      } else {
        Logger.error('❌ API health check failed');
        return false;
      }
    } catch (error) {
      Logger.error('❌ Error checking API health:', error);
      return false;
    }
  }

  /**
   * Initialize API client
   */
  static async initialize() {
    try {
      Logger.info('🚀 Initializing API Data Service...');
      await apiClient.initialize();
      Logger.success('✅ API Data Service initialized');
    } catch (error) {
      Logger.error('❌ Failed to initialize API Data Service:', error);
    }
  }

  // ============ MIGRATION HELPERS ============

  /**
   * Check if user is authenticated with API
   */
  static isAuthenticated() {
    return apiClient.isAuthenticated();
  }

  /**
   * Logout user from API
   */
  static async logout() {
    try {
      Logger.info('👋 Logging out from API...');
      await apiClient.logout();
      Logger.success('✅ Logged out from API');
    } catch (error) {
      Logger.error('❌ Error logging out from API:', error);
    }
  }

  // ============ PHOTO MANAGEMENT METHODS ============

  /**
   * Add photo to user profile
   */
  static async addUserPhoto(photoUrl, isMain = false) {
    try {
      Logger.info('📸 Adding photo to user profile via API...');

      const response = await apiClient.addPhoto(photoUrl, isMain);

      if (response.success) {
        Logger.success('✅ Photo added via API');
        return response.data.data;
      } else {
        Logger.error('❌ Failed to add photo via API:', response.message);
        throw new Error(response.message || 'Photo upload failed');
      }
    } catch (error) {
      Logger.error('❌ Error adding photo via API:', error);
      throw error;
    }
  }

  /**
   * Delete photo from user profile
   */
  static async deleteUserPhoto(photoId) {
    try {
      Logger.info('🗑️ Deleting photo from user profile via API...');

      const response = await apiClient.deletePhoto(photoId);

      if (response.success) {
        Logger.success('✅ Photo deleted via API');
        return response.data.data;
      } else {
        Logger.error('❌ Failed to delete photo via API:', response.message);
        throw new Error(response.message || 'Photo deletion failed');
      }
    } catch (error) {
      Logger.error('❌ Error deleting photo via API:', error);
      throw error;
    }
  }

  /**
   * Reorder user photos
   */
  static async reorderUserPhotos(photoIds) {
    try {
      Logger.info('🔄 Reordering user photos via API...');

      const response = await apiClient.reorderPhotos(photoIds);

      if (response.success) {
        Logger.success('✅ Photos reordered via API');
        return response.data.data;
      } else {
        Logger.error('❌ Failed to reorder photos via API:', response.message);
        throw new Error(response.message || 'Photo reordering failed');
      }
    } catch (error) {
      Logger.error('❌ Error reordering photos via API:', error);
      throw error;
    }
  }

  /**
   * Set main photo
   */
  static async setMainPhoto(photoId) {
    try {
      Logger.info('⭐ Setting main photo via API...');

      const response = await apiClient.setMainPhoto(photoId);

      if (response.success) {
        Logger.success('✅ Main photo set via API');
        return response.data.data;
      } else {
        Logger.error('❌ Failed to set main photo via API:', response.message);
        throw new Error(response.message || 'Set main photo failed');
      }
    } catch (error) {
      Logger.error('❌ Error setting main photo via API:', error);
      throw error;
    }
  }

  // ============ DISCOVERY METHODS ============

  /**
   * Get users for discovery/swiping with filters
   */
  static async getUsersForDiscovery(options = {}) {
    try {
      Logger.info('🔍 Getting users for discovery from API...');

      const { limit = 20, excludeIds = [], filters = {} } = options;

      const queryParams = new URLSearchParams({
        limit: limit.toString(),
      });

      if (excludeIds.length > 0) {
        queryParams.append('excludeIds', excludeIds.join(','));
      }

      // Add filter parameters
      if (filters.minAge) {
        queryParams.append('minAge', filters.minAge.toString());
      }
      if (filters.maxAge) {
        queryParams.append('maxAge', filters.maxAge.toString());
      }
      if (filters.maxDistance) {
        queryParams.append('maxDistance', filters.maxDistance.toString());
      }

      // Send ALL filters as JSON in a filters parameter
      // This ensures all filter options are sent to the backend
      if (Object.keys(filters).length > 0) {
        queryParams.append('filters', JSON.stringify(filters));
      }

      Logger.debug('Discovery API call with params:', queryParams.toString());
      const response = await apiClient.get(`/discovery/users?${queryParams}`);

      if (response.success) {
        Logger.success(
          `✅ Discovery users loaded from API (${response.data?.data?.length || 0} users)`
        );
        return response.data?.data || response.data || [];
      } else {
        Logger.error('❌ Failed to get discovery users from API:', response.message);
        // Throw error to allow proper error handling in the UI
        throw new Error(response.error || response.message || 'Failed to get discovery users');
      }
    } catch (error) {
      Logger.error('❌ Error getting discovery users from API:', error);
      // Re-throw the error to allow proper error handling
      throw error;
    }
  }

  // ============ ACTION METHODS ============

  /**
   * Like a user
   */
  static async likeUser(targetUserId) {
    try {
      Logger.info('👍 Liking user via API...');

      const response = await apiClient.post('/actions/like', { targetUserId });

      if (response.success && response.data) {
        Logger.success('✅ User liked via API');
        // The API returns { success, message, data } where data contains our result
        const result = response.data;
        Logger.info('Like result:', result);
        return {
          success: true,
          isMatch: result.isMatch || false,
          match: result.match || null,
          action: result.action,
        };
      } else {
        Logger.error('❌ Failed to like user via API:', response.message);
        throw new Error(response.message || 'Like failed');
      }
    } catch (error) {
      Logger.error('❌ Error liking user via API:', error);
      // Handle specific error cases more gracefully
      if (error.message?.includes('already acted')) {
        throw new Error('You have already swiped on this person');
      }
      throw new Error(error.message || 'Like failed');
    }
  }

  /**
   * Pass on a user
   */
  static async passUser(targetUserId) {
    try {
      Logger.info('👎 Passing on user via API...');

      const response = await apiClient.post('/actions/pass', { targetUserId });

      if (response.success && response.data) {
        Logger.success('✅ User passed via API');
        // Extract the actual data from the nested structure
        const result = response.data.data || response.data;
        return {
          success: true,
          action: result.action,
          isMatch: false,
        };
      } else {
        Logger.error('❌ Failed to pass user via API:', response.message);
        throw new Error(response.message || 'Pass failed');
      }
    } catch (error) {
      Logger.error('❌ Error passing on user via API:', error);
      throw error;
    }
  }

  /**
   * Super like a user (premium feature)
   */
  static async superLikeUser(targetUserId) {
    try {
      Logger.info('💫 Super liking user via API...');

      const response = await apiClient.post('/actions/super-like', { targetUserId });

      if (response.success) {
        Logger.success('✅ User super liked via API');
        return response.data;
      } else {
        Logger.error('❌ Failed to super like user via API:', response.message);
        throw new Error(response.message || 'Super like failed');
      }
    } catch (error) {
      Logger.error('❌ Error super liking user via API:', error);
      throw error;
    }
  }

  /**
   * Get user action history
   */
  static async getUserActions(options = {}) {
    try {
      Logger.info('📋 Getting user actions from API...');

      const { limit = 50, offset = 0 } = options;
      const queryParams = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });

      const response = await apiClient.get(`/actions/history?${queryParams}`);

      if (response.success) {
        Logger.success('✅ User actions loaded from API');
        return response.data?.data || response.data || [];
      } else {
        Logger.error('❌ Failed to get user actions from API:', response.message);
        return [];
      }
    } catch (error) {
      Logger.error('❌ Error getting user actions from API:', error);
      return [];
    }
  }

  // ============ MATCH METHODS ============

  /**
   * Get user matches
   */
  static async getUserMatches(options = {}) {
    try {
      Logger.info('💕 Getting user matches from API...');

      const { limit = 50, offset = 0 } = options;
      const queryParams = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });

      const response = await apiClient.get(`/matches/list?${queryParams}`);

      if (response.success) {
        Logger.success('✅ User matches loaded from API');
        return response.data?.data || response.data || [];
      } else {
        Logger.error('❌ Failed to get user matches from API:', response.message || response.error);
        throw new Error(response.message || response.error || 'Failed to get matches');
      }
    } catch (error) {
      Logger.error('❌ Error getting user matches from API:', error);
      // Add more debugging info
      if (error.response) {
        Logger.error('API response details:', error.response.status, error.response.data);
      }
      throw new Error(error.message || 'Unknown error');
    }
  }

  /**
   * Get match details
   */
  static async getMatchDetails(matchId) {
    try {
      Logger.info('💕 Getting match details from API...');

      const response = await apiClient.get(`/matches/${matchId}`);

      if (response.success) {
        Logger.success('✅ Match details loaded from API');
        return response.data;
      } else {
        Logger.error('❌ Failed to get match details from API:', response.message);
        return null;
      }
    } catch (error) {
      Logger.error('❌ Error getting match details from API:', error);
      return null;
    }
  }

  /**
   * Deactivate a match (unmatch)
   */
  static async deactivateMatch(matchId) {
    try {
      Logger.info('💔 Deactivating match via API...');

      const response = await apiClient.delete(`/matches/${matchId}`);

      if (response.success) {
        Logger.success('✅ Match deactivated via API');
        return response.data;
      } else {
        Logger.error('❌ Failed to deactivate match via API:', response.message);
        throw new Error(response.message || 'Match deactivation failed');
      }
    } catch (error) {
      Logger.error('❌ Error deactivating match via API:', error);
      throw error;
    }
  }

  // ============ MESSAGE METHODS ============

  /**
   * Get messages for a match
   */
  static async getMessages(matchId, options = {}) {
    try {
      Logger.info('💬 Getting messages from API...');

      const { limit = 100, offset = 0 } = options;
      const queryParams = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });

      const response = await apiClient.get(`/messages/${matchId}?${queryParams}`);

      if (response.success) {
        Logger.success('✅ Messages loaded from API');
        return response.data?.data || response.data || [];
      } else {
        Logger.error('❌ Failed to get messages from API:', response.message);
        return [];
      }
    } catch (error) {
      Logger.error('❌ Error getting messages from API:', error);
      return [];
    }
  }

  /**
   * Send a message
   * @param {string} matchId - The match ID
   * @param {string|object} contentOrOptions - Message content string OR options object
   * @param {string} messageType - Message type (only used if contentOrOptions is a string)
   */
  static async sendMessage(matchId, contentOrOptions, messageType = 'TEXT') {
    try {
      Logger.info('📤 Sending message via API...');

      // Support both old signature (content, messageType) and new signature (options object)
      let body;
      if (typeof contentOrOptions === 'object') {
        body = {
          content: contentOrOptions.content,
          messageType: contentOrOptions.messageType || 'TEXT',
          mediaUrl: contentOrOptions.mediaUrl || null,
          replyToId: contentOrOptions.replyToId || null,
        };
      } else {
        body = {
          content: contentOrOptions,
          messageType,
        };
      }

      const response = await apiClient.post(`/messages/${matchId}`, body);

      if (response.success) {
        Logger.success('✅ Message sent via API');
        // response.data is the API response body { success, message, data }
        // response.data.data is the actual message object with id, content, etc.
        return response.data?.data || response.data;
      } else {
        Logger.error('❌ Failed to send message via API:', response.message);
        throw new Error(response.message || 'Message sending failed');
      }
    } catch (error) {
      Logger.error('❌ Error sending message via API:', error);
      throw error;
    }
  }

  /**
   * Mark messages as read
   */
  static async markMessagesAsRead(matchId, messageIds = []) {
    try {
      Logger.info('👁️ Marking messages as read via API...');

      const response = await apiClient.put(`/messages/${matchId}/read`, {
        messageIds,
      });

      if (response.success) {
        Logger.success('✅ Messages marked as read via API');
        return response.data;
      } else {
        Logger.error('❌ Failed to mark messages as read via API:', response.message);
        return false;
      }
    } catch (error) {
      Logger.error('❌ Error marking messages as read via API:', error);
      return false;
    }
  }

  /**
   * Add reaction to a message
   */
  static async addMessageReaction(matchId, messageId, emoji) {
    try {
      Logger.info(`${emoji} Adding reaction to message via API...`);

      const response = await apiClient.post(`/messages/${matchId}/${messageId}/reaction`, {
        emoji,
      });

      if (response.success) {
        Logger.success(`✅ Reaction added via API`);
        return response.data;
      } else {
        Logger.error('❌ Failed to add reaction via API:', response.message);
        throw new Error(response.message || 'Failed to add reaction');
      }
    } catch (error) {
      Logger.error('❌ Error adding reaction via API:', error);
      throw error;
    }
  }

  /**
   * Remove reaction from a message
   */
  static async removeMessageReaction(matchId, messageId, emoji) {
    try {
      Logger.info(`Removing reaction from message via API...`);

      const response = await apiClient.delete(`/messages/${matchId}/${messageId}/reaction`, {
        data: { emoji },
      });

      if (response.success) {
        Logger.success(`✅ Reaction removed via API`);
        return response.data;
      } else {
        Logger.error('❌ Failed to remove reaction via API:', response.message);
        throw new Error(response.message || 'Failed to remove reaction');
      }
    } catch (error) {
      Logger.error('❌ Error removing reaction via API:', error);
      throw error;
    }
  }

  /**
   * Send a GIF message
   */
  static async sendGifMessage(matchId, gifUrl) {
    try {
      Logger.info('🎬 Sending GIF message via API...');

      const response = await apiClient.post(`/messages/${matchId}`, {
        messageType: 'GIF',
        content: gifUrl,
      });

      if (response.success) {
        Logger.success('✅ GIF sent via API');
        return response.data;
      } else {
        Logger.error('❌ Failed to send GIF via API:', response.message);
        throw new Error(response.message || 'Failed to send GIF');
      }
    } catch (error) {
      Logger.error('❌ Error sending GIF via API:', error);
      throw error;
    }
  }

  // ============ UTILITY METHODS ============

  /**
   * Calculate unread count for messages (client-side helper)
   */
  static getUnreadCount(messages, currentUserId) {
    try {
      return messages.filter(msg => {
        return msg.senderId !== currentUserId && !msg.isRead;
      }).length;
    } catch (error) {
      Logger.error('❌ Error calculating unread count:', error);
      return 0;
    }
  }

  // ============ MODERATION METHODS ============

  /**
   * Mute match notifications
   */
  static async muteMatch(matchId) {
    try {
      Logger.info('🔇 Muting match via API...');
      const response = await apiClient.post(`/moderation/mute/${matchId}`);
      if (response.success) {
        Logger.success('✅ Match muted');
        return true;
      }
      Logger.error('❌ Failed to mute match:', response.message);
      return false;
    } catch (error) {
      Logger.error('❌ Error muting match:', error);
      return false;
    }
  }

  /**
   * Unmute match notifications
   */
  static async unmuteMatch(matchId) {
    try {
      Logger.info('🔔 Unmuting match via API...');
      const response = await apiClient.delete(`/moderation/mute/${matchId}`);
      if (response.success) {
        Logger.success('✅ Match unmuted');
        return true;
      }
      Logger.error('❌ Failed to unmute match:', response.message);
      return false;
    } catch (error) {
      Logger.error('❌ Error unmuting match:', error);
      return false;
    }
  }

  /**
   * Check if match is muted
   */
  static async isMatchMuted(matchId) {
    try {
      const response = await apiClient.get(`/moderation/mute/${matchId}/status`);
      if (response.success) {
        return response.data?.data?.isMuted || false;
      }
      return false;
    } catch (error) {
      Logger.error('❌ Error checking mute status:', error);
      return false;
    }
  }

  /**
   * Block a user
   */
  static async blockUser(userId, matchId = null) {
    try {
      Logger.info('🚫 Blocking user via API...');
      const response = await apiClient.post(`/moderation/block/${userId}`, { matchId });
      if (response.success) {
        Logger.success('✅ User blocked');
        return true;
      }
      Logger.error('❌ Failed to block user:', response.message);
      return false;
    } catch (error) {
      Logger.error('❌ Error blocking user:', error);
      return false;
    }
  }

  /**
   * Unblock a user
   */
  static async unblockUser(userId) {
    try {
      Logger.info('✅ Unblocking user via API...');
      const response = await apiClient.delete(`/moderation/block/${userId}`);
      if (response.success) {
        Logger.success('✅ User unblocked');
        return true;
      }
      Logger.error('❌ Failed to unblock user:', response.message);
      return false;
    } catch (error) {
      Logger.error('❌ Error unblocking user:', error);
      return false;
    }
  }

  /**
   * Unmatch from a match
   */
  static async unmatch(matchId) {
    try {
      Logger.info('💔 Unmatching via API...');
      const response = await apiClient.post(`/moderation/unmatch/${matchId}`);
      if (response.success) {
        Logger.success('✅ Unmatched successfully');
        return true;
      }
      Logger.error('❌ Failed to unmatch:', response.message);
      return false;
    } catch (error) {
      Logger.error('❌ Error unmatching:', error);
      return false;
    }
  }

  /**
   * Report a user
   */
  static async reportUser(reportedId, reason, description = null) {
    try {
      Logger.info('🚨 Reporting user via API...');
      const response = await apiClient.post('/moderation/report', {
        reportedId,
        reason,
        description,
      });
      if (response.success) {
        Logger.success('✅ Report submitted');
        return true;
      }
      Logger.error('❌ Failed to submit report:', response.message);
      return false;
    } catch (error) {
      Logger.error('❌ Error submitting report:', error);
      return false;
    }
  }

  // ============ ACCOUNT METHODS ============

  /**
   * Delete user account and all associated data
   */
  static async deleteAccount() {
    try {
      Logger.info('🗑️ Deleting account via API...');
      const response = await apiClient.delete('/users/account');
      if (response.success) {
        Logger.success('✅ Account deleted successfully');
        return { success: true };
      }
      Logger.error('❌ Failed to delete account:', response.message);
      return { success: false, error: response.message || 'Failed to delete account' };
    } catch (error) {
      Logger.error('❌ Error deleting account:', error);
      return { success: false, error: error.message || 'Failed to delete account' };
    }
  }
}

export default ApiDataService;
