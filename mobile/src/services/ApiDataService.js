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
      throw error;
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

  // ============ PLACEHOLDER METHODS (for future implementation) ============

  /**
   * Get user matches (placeholder)
   */
  static async getUserMatches(_userId) {
    Logger.info('💕 getUserMatches - Coming in PR #8: Matching Algorithm');
    return [];
  }

  /**
   * Like a user (placeholder)
   */
  static async likeUser(_userId, _targetUserId) {
    Logger.info('👍 likeUser - Coming in PR #8: Matching Algorithm');
    return false;
  }

  /**
   * Pass on a user (placeholder)
   */
  static async passUser(_userId, _targetUserId) {
    Logger.info('👎 passUser - Coming in PR #8: Matching Algorithm');
    return false;
  }

  /**
   * Get messages (placeholder)
   */
  static async getMessages(_userId, _matchId) {
    Logger.info('💬 getMessages - Coming in PR #10: Real-time Chat');
    return [];
  }

  /**
   * Send message (placeholder)
   */
  static async sendMessage(_userId, _matchId, _message) {
    Logger.info('📤 sendMessage - Coming in PR #10: Real-time Chat');
    return false;
  }
}

export default ApiDataService;
