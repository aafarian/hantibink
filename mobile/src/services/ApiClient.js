import AsyncStorage from '@react-native-async-storage/async-storage';
import Logger from '../utils/logger';
import environment from '../config/environment';

// Retry configuration for transient failures
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000, // 1 second initial delay
  // HTTP methods that are safe to retry (idempotent)
  safeMethodsToRetry: ['GET', 'HEAD', 'OPTIONS'],
};

/**
 * Check if an error is transient and should be retried
 * @param {number|null} status - HTTP status code (null for network errors)
 * @param {Error|null} error - Error object for network failures
 * @returns {boolean} - Whether the error is transient
 */
function isTransientError(status, error) {
  // Network errors (no response received) are transient
  if (error && !status) {
    const errorMsg = error.message?.toLowerCase() || '';
    // Common transient network errors
    return (
      errorMsg.includes('network') ||
      errorMsg.includes('timeout') ||
      errorMsg.includes('connection') ||
      errorMsg.includes('failed to fetch') ||
      errorMsg.includes('aborted')
    );
  }

  // 5xx server errors are transient (server may recover)
  if (status >= 500 && status < 600) {
    return true;
  }

  return false;
}

/**
 * Calculate delay for exponential backoff
 * @param {number} attempt - Current retry attempt (0-indexed)
 * @param {number} baseDelayMs - Base delay in milliseconds
 * @returns {number} - Delay in milliseconds
 */
function getBackoffDelay(attempt, baseDelayMs) {
  // Exponential backoff: 1s, 2s, 4s...
  return baseDelayMs * Math.pow(2, attempt);
}

/**
 * Sleep for specified milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Prior hostnames of the SAME production backend (same database, same JWT
// secret). A stored URL matching one of these is a region migration, not an
// environment switch — the session must survive it.
const LEGACY_API_URLS = ['https://hantibink-api-393816901275.us-central1.run.app/api'];

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
      // Check if API URL has changed (environment switch)
      const storedApiUrl = await AsyncStorage.getItem('currentApiUrl');
      const currentApiUrl = this.baseURL;

      if (storedApiUrl && storedApiUrl !== currentApiUrl) {
        if (LEGACY_API_URLS.includes(storedApiUrl)) {
          // Same backend under a new hostname (region move): the stored
          // session is fully valid, so migrate the URL without logging out
          Logger.info('🔄 API URL migrated to new region, keeping session');
          await AsyncStorage.setItem('currentApiUrl', currentApiUrl);
        } else {
          Logger.warn('🔄 API URL changed, clearing old tokens');
          await this.clearTokens();
          await AsyncStorage.setItem('currentApiUrl', currentApiUrl);
          return;
        }
      }

      // Store current API URL if not set
      if (!storedApiUrl) {
        await AsyncStorage.setItem('currentApiUrl', currentApiUrl);
      }

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
      // Also remove stored API URL to ensure clean state
      await AsyncStorage.removeItem('currentApiUrl');
      Logger.info('🔑 Tokens and API URL cleared');
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
   * Make HTTP request with automatic token refresh and retry for transient failures
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Request options
   * @param {boolean} options.noRetry - Skip retry logic for this request
   * @param {number} _retryAttempt - Internal: current retry attempt (0-indexed)
   */
  async request(endpoint, options = {}, _retryAttempt = 0) {
    const url = `${this.baseURL}${endpoint}`;
    const method = options.method || 'GET';
    const { noRetry, ...fetchOptions } = options;
    const config = {
      ...fetchOptions,
      headers: {
        ...this.getAuthHeaders(),
        ...fetchOptions.headers,
      },
    };

    // Determine if this request is safe to retry
    const isSafeMethod = RETRY_CONFIG.safeMethodsToRetry.includes(method.toUpperCase());
    const canRetry = !noRetry && isSafeMethod && _retryAttempt < RETRY_CONFIG.maxRetries;

    if (_retryAttempt === 0) {
      Logger.info(`API Request: ${method} ${endpoint}`);
    }

    try {
      const response = await fetch(url, config);

      // Handle 5xx server errors - potentially retryable
      if (response.status >= 500 && response.status < 600) {
        let data;
        try {
          data = await response.json();
        } catch {
          data = { error: 'Server error', message: `Server returned ${response.status}` };
        }

        if (canRetry && isTransientError(response.status, null)) {
          const delay = getBackoffDelay(_retryAttempt, RETRY_CONFIG.baseDelayMs);
          Logger.warn(
            `Transient error (${response.status}) on ${method} ${endpoint}. ` +
              `Retrying in ${delay}ms (attempt ${_retryAttempt + 1}/${RETRY_CONFIG.maxRetries})`
          );
          await sleep(delay);
          return this.request(endpoint, options, _retryAttempt + 1);
        }

        Logger.error(`API Error: ${response.status} ${endpoint}`, data);
        return {
          success: false,
          error: data.error || 'Server error',
          // Machine-readable reason (DAILY_LIMIT_REACHED etc.) when provided
          code: data.code,
          message: data.message || 'Server error occurred',
          status: response.status,
        };
      }

      const data = await response.json();

      // Handle successful responses
      if (response.ok) {
        if (_retryAttempt > 0) {
          Logger.success(`API Success (after ${_retryAttempt} retries): ${method} ${endpoint}`);
        } else {
          Logger.success(`API Success: ${method} ${endpoint}`);
        }
        // Unwrap API response if it follows { success, data, ...rest } pattern
        if (data?.success && 'data' in data) {
          const { success: _apiSuccess, data: innerData, ...rest } = data;
          return { success: true, data: innerData, ...rest, status: response.status };
        }
        return { success: true, data, status: response.status };
      }

      // Handle 401 Unauthorized - try token refresh
      if (response.status === 401 && this.refreshToken && !endpoint.includes('/refresh')) {
        Logger.warn('Token expired, attempting refresh...');
        const refreshResult = await this.refreshAccessToken();

        if (refreshResult.success) {
          // Retry original request with new token
          const retryConfig = {
            ...config,
            headers: {
              ...this.getAuthHeaders(),
              ...fetchOptions.headers,
            },
          };

          const retryResponse = await fetch(url, retryConfig);
          const retryData = await retryResponse.json();

          if (retryResponse.ok) {
            Logger.success(`API Success (after refresh): ${method} ${endpoint}`);
            // Unwrap API response if it follows { success, data, ...rest } pattern
            if (retryData?.success && 'data' in retryData) {
              const { success: _apiSuccess, data: innerData, ...rest } = retryData;
              return { success: true, data: innerData, ...rest, status: retryResponse.status };
            }
            return { success: true, data: retryData, status: retryResponse.status };
          }
        }
      }

      // Handle rate limiting (429) - do NOT retry, surface immediately
      if (response.status === 429) {
        const retryAfter = data.retryAfter || 60; // seconds
        Logger.warn(`Rate limited. Retry after ${retryAfter}s. Endpoint: ${endpoint}`);
        return {
          success: false,
          error: data.error || 'Rate limited - too many requests',
          message: data.message || 'Too many requests, please wait',
          status: response.status,
          rateLimited: true,
          retryAfter,
        };
      }

      // Handle other 4xx errors - do NOT retry (client errors)
      Logger.error(`API Error: ${response.status} ${endpoint}`, data);
      return {
        success: false,
        error: data.error || 'Request failed',
        message: data.message || 'Unknown error',
        status: response.status,
      };
    } catch (error) {
      // Network error - potentially retryable
      if (canRetry && isTransientError(null, error)) {
        const delay = getBackoffDelay(_retryAttempt, RETRY_CONFIG.baseDelayMs);
        Logger.warn(
          `Network error on ${method} ${endpoint}: ${error.message}. ` +
            `Retrying in ${delay}ms (attempt ${_retryAttempt + 1}/${RETRY_CONFIG.maxRetries})`
        );
        await sleep(delay);
        return this.request(endpoint, options, _retryAttempt + 1);
      }

      Logger.error(`Network Error: ${endpoint}`, error);
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
      const { tokens } = response.data;
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
      const { tokens } = response.data;
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
      const { tokens } = response.data;
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
      headers: { 'Content-Type': 'application/json' },
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

  /**
   * Get notification settings
   */
  async getNotificationSettings() {
    return this.request('/users/notification-settings');
  }

  /**
   * Update notification settings
   */
  async updateNotificationSettings(settings) {
    return this.request('/users/notification-settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  // ============ PASSWORD RESET METHODS ============

  /**
   * Request password reset code
   */
  async forgotPassword(email) {
    return this.post('/auth/forgot-password', { email });
  }

  /**
   * Verify password reset code
   */
  async verifyResetCode(email, code) {
    return this.post('/auth/verify-reset-code', { email, code });
  }

  /**
   * Reset password with verified token
   */
  async resetPassword(token, newPassword) {
    return this.post('/auth/reset-password', { token, newPassword });
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
