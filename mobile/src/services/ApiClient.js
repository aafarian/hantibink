import AsyncStorage from '@react-native-async-storage/async-storage';
import Logger from '../utils/logger';
import environment from '../config/environment';

class ApiClient {
  constructor() {
    this.baseURL = `${environment.apiUrl}/api`;
    this.token = null;
    this.refreshToken = null;
  }

  /**
   * Initialize API client with stored tokens
   */
  async initialize() {
    try {
      const storedToken = await AsyncStorage.getItem('accessToken');
      const storedRefreshToken = await AsyncStorage.getItem('refreshToken');

      if (storedToken) {
        this.token = storedToken;
        Logger.info('🔑 API Client initialized with stored token');
      }

      if (storedRefreshToken) {
        this.refreshToken = storedRefreshToken;
      }
    } catch (error) {
      Logger.error('❌ Failed to initialize API client:', error);
      // Don't throw error here - just log it and continue
    }
  }

  /**
   * Set authentication tokens
   */
  async setTokens(accessToken, refreshToken) {
    this.token = accessToken;
    this.refreshToken = refreshToken;

    try {
      await AsyncStorage.setItem('accessToken', accessToken);
      if (refreshToken) {
        await AsyncStorage.setItem('refreshToken', refreshToken);
      }
      Logger.info('🔑 Tokens stored successfully');
    } catch (error) {
      Logger.error('❌ Failed to store tokens:', error);
    }
  }

  /**
   * Clear authentication tokens
   */
  async clearTokens() {
    this.token = null;
    this.refreshToken = null;

    try {
      await AsyncStorage.removeItem('accessToken');
      await AsyncStorage.removeItem('refreshToken');
      Logger.info('🔑 Tokens cleared');
    } catch (error) {
      Logger.error('❌ Failed to clear tokens:', error);
    }
  }

  // ============ HTTP METHODS ============

  /**
   * GET request
   */
  async get(endpoint, options = {}) {
    return this.request(endpoint, { method: 'GET', ...options });
  }

  /**
   * POST request
   */
  async post(endpoint, data = null, options = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
  }

  /**
   * PUT request
   */
  async put(endpoint, data = null, options = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
  }

  /**
   * DELETE request
   */
  async delete(endpoint, options = {}) {
    return this.request(endpoint, { method: 'DELETE', ...options });
  }

  /**
   * PATCH request
   */
  async patch(endpoint, data = null, options = {}) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });
  }

  /**
   * Get authentication headers
   */
  getAuthHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    return headers;
  }

  /**
   * Make HTTP request with automatic token refresh
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      ...options,
      headers: {
        ...this.getAuthHeaders(),
        ...options.headers,
      },
    };

    Logger.info(`🌐 API Request: ${options.method || 'GET'} ${endpoint}`);

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      // Handle successful responses
      if (response.ok) {
        Logger.success(`✅ API Success: ${options.method || 'GET'} ${endpoint}`);
        return { success: true, data, status: response.status };
      }

      // Handle 401 Unauthorized - try token refresh
      if (response.status === 401 && this.refreshToken && !endpoint.includes('/refresh')) {
        Logger.warn('🔄 Token expired, attempting refresh...');
        const refreshResult = await this.refreshAccessToken();

        if (refreshResult.success) {
          // Retry original request with new token
          const retryConfig = {
            ...config,
            headers: {
              ...this.getAuthHeaders(),
              ...options.headers,
            },
          };

          const retryResponse = await fetch(url, retryConfig);
          const retryData = await retryResponse.json();

          if (retryResponse.ok) {
            Logger.success(
              `✅ API Success (after refresh): ${options.method || 'GET'} ${endpoint}`
            );
            return { success: true, data: retryData, status: retryResponse.status };
          }
        }
      }

      // Handle rate limiting (429)
      if (response.status === 429) {
        const retryAfter = data.retryAfter || 60; // seconds
        Logger.warn(`⏰ Rate limited. Retry after ${retryAfter}s. Endpoint: ${endpoint}`);
        return {
          success: false,
          error: data.error || 'Rate limited - too many requests',
          message: data.message || 'Too many requests, please wait',
          status: response.status,
          rateLimited: true,
          retryAfter,
        };
      }

      // Handle other errors
      Logger.error(`❌ API Error: ${response.status} ${endpoint}`, data);
      return {
        success: false,
        error: data.error || 'Request failed',
        message: data.message || 'Unknown error',
        status: response.status,
      };
    } catch (error) {
      Logger.error(`❌ Network Error: ${endpoint}`, error);
      return {
        success: false,
        error: 'Network Error',
        message: error.message || 'Failed to connect to server',
      };
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken() {
    if (!this.refreshToken) {
      Logger.error('❌ No refresh token available');
      return { success: false, error: 'No refresh token' };
    }

    try {
      const response = await this.request('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      if (response.success) {
        const { accessToken, refreshToken } = response.data || {};

        if (!accessToken) {
          Logger.error('❌ No accessToken in refresh response:', response);
          // Don't clear tokens here - might be a temporary server issue
          return { success: false, error: 'No access token in response' };
        }

        await this.setTokens(accessToken, refreshToken || this.refreshToken);
        Logger.success('🔄 Token refreshed successfully');
        return { success: true };
      } else {
        Logger.error('❌ Token refresh failed:', response.message);
        // Clear tokens only on auth failures, not network issues
        if (
          response.status === 401 ||
          response.message?.includes('invalid') ||
          response.message?.includes('expired')
        ) {
          await this.clearTokens();
        }
        return { success: false, error: 'Token refresh failed' };
      }
    } catch (error) {
      Logger.error('❌ Token refresh error:', error);
      // Don't clear tokens on network errors - only on auth failures
      if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
        await this.clearTokens();
      }
      return { success: false, error: error.message };
    }
  }

  // ============ AUTH ENDPOINTS ============

  /**
   * Register new user
   */
  async register(userData) {
    const response = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });

    if (response.success) {
      const { tokens } = response.data.data;
      if (tokens && tokens.accessToken && tokens.refreshToken) {
        await this.setTokens(tokens.accessToken, tokens.refreshToken);
      } else {
        Logger.error('❌ Invalid token structure in register response:', response.data);
      }
    }

    return response;
  }

  /**
   * Check if email exists
   */
  async checkEmailExists(email) {
    const response = await this.request('/auth/check-email', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });

    return response;
  }

  /**
   * Login with email and password
   */
  async login(email, password) {
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (response.success) {
      const { tokens } = response.data.data;
      if (tokens && tokens.accessToken && tokens.refreshToken) {
        await this.setTokens(tokens.accessToken, tokens.refreshToken);
      } else {
        Logger.error('❌ Invalid token structure in login response:', response.data);
      }
    }

    return response;
  }

  /**
   * Login with Firebase ID token
   */
  async loginWithFirebase(idToken) {
    const response = await this.request('/auth/firebase-login', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });

    if (response.success) {
      const { tokens } = response.data.data;
      if (tokens && tokens.accessToken && tokens.refreshToken) {
        await this.setTokens(tokens.accessToken, tokens.refreshToken);
      } else {
        Logger.error('❌ Invalid token structure in Firebase login response:', response.data);
      }
    }

    return response;
  }

  /**
   * Logout user
   */
  async logout() {
    const response = await this.request('/auth/logout', {
      method: 'POST',
    });

    // Clear tokens regardless of response
    await this.clearTokens();
    return response;
  }

  // ============ PHOTO MANAGEMENT METHODS ============

  /**
   * Add photo to user profile
   */
  async addPhoto(photoUrl, isMain = false) {
    return this.request('/users/photos', {
      method: 'POST',
      body: JSON.stringify({ photoUrl, isMain }),
    });
  }

  /**
   * Delete photo from user profile
   */
  async deletePhoto(photoId) {
    return this.request(`/users/photos/${photoId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Reorder user photos
   */
  async reorderPhotos(photoIds) {
    return this.request('/users/photos/reorder', {
      method: 'PUT',
      body: JSON.stringify({ photoIds }),
    });
  }

  /**
   * Set main photo
   */
  async setMainPhoto(photoId) {
    return this.request(`/users/photos/${photoId}/main`, {
      method: 'PUT',
    });
  }

  // ============ USER ENDPOINTS ============

  /**
   * Get user profile
   */
  async getUserProfile() {
    const response = await this.request('/users/profile');

    return response;
  }

  /**
   * Update user profile
   */
  async updateUserProfile(profileData) {
    return this.request('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  }

  /**
   * Get user preferences
   */
  async getUserPreferences() {
    return this.request('/users/preferences');
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(preferences) {
    return this.request('/users/preferences', {
      method: 'PUT',
      body: JSON.stringify(preferences),
    });
  }

  // ============ UTILITY METHODS ============

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!this.token;
  }

  /**
   * Get current token
   */
  getToken() {
    return this.token;
  }

  /**
   * Health check
   */
  async healthCheck() {
    // Remove /api from baseURL for health check
    const healthUrl = this.baseURL.replace('/api', '/health');

    try {
      const response = await fetch(healthUrl);
      const data = await response.json();

      if (response.ok) {
        Logger.success('✅ API Health Check: Server is healthy');
        return { success: true, data };
      } else {
        Logger.error('❌ API Health Check: Server unhealthy');
        return { success: false, error: 'Server unhealthy' };
      }
    } catch (error) {
      Logger.error('❌ API Health Check: Connection failed', error);
      return { success: false, error: 'Connection failed' };
    }
  }
}

// Create singleton instance
const apiClient = new ApiClient();

export default apiClient;
