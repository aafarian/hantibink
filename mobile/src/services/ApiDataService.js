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
        // Fix: Return response.data.data instead of response.data
        // because the API wraps responses in {success, message, data}
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

  /**
   * Login with Firebase token via API
   */
  static async loginWithFirebase(idToken) {
    try {
      Logger.info('🔥 Logging in with Firebase token via API...');

      const response = await apiClient.loginWithFirebase(idToken);

      if (response.success) {
        Logger.success('✅ Firebase login successful via API');
        return response.data.data;
      } else {
        Logger.error('❌ Failed to login with Firebase via API:', response.message);
        throw new Error(response.message || 'Firebase login failed');
      }
    } catch (error) {
      Logger.error('❌ Error logging in with Firebase via API:', error);
      throw error;
    }
  }

  // ============ PREFERENCES METHODS ============

  /**
   * Get user preferences from API
   */
  static async getUserPreferences(userId = null) {
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
   */
  static async updateUserPreferences(userId, preferences) {
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

  // ============ PLACEHOLDER METHODS (for future implementation) ============

  /**
   * Get user matches (placeholder)
   */
  static async getUserMatches(userId) {
    Logger.info('💕 getUserMatches - Coming in PR #8: Matching Algorithm');
    return [];
  }

  /**
   * Like a user (placeholder)
   */
  static async likeUser(userId, targetUserId) {
    Logger.info('👍 likeUser - Coming in PR #8: Matching Algorithm');
    return false;
  }

  /**
   * Pass on a user (placeholder)
   */
  static async passUser(userId, targetUserId) {
    Logger.info('👎 passUser - Coming in PR #8: Matching Algorithm');
    return false;
  }

  /**
   * Get messages (placeholder)
   */
  static async getMessages(userId, matchId) {
    Logger.info('💬 getMessages - Coming in PR #10: Real-time Chat');
    return [];
  }

  /**
   * Send message (placeholder)
   */
  static async sendMessage(userId, matchId, message) {
    Logger.info('📤 sendMessage - Coming in PR #10: Real-time Chat');
    return false;
  }
}

export default ApiDataService;
