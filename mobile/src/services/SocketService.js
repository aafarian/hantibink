/**
 * WebSocket Service using Socket.IO
 * Handles real-time communication for messages and matches
 */

import { io } from 'socket.io-client';
import { AppState } from 'react-native';
import Logger from '../utils/logger';
import environment from '../config/environment';
import ApiClient from './ApiClient';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.userId = null;
    this.messageListeners = new Set();
    this.matchListeners = new Set();
    this.connectionListeners = new Set();
    this.likedYouListeners = new Set();
    this.userStatusListeners = new Set();
    this.gameListeners = new Set();
    this.joinedMatchRooms = new Set();
    this.heartbeatInterval = null;
    this.appStateSubscription = null;
    this.isAppActive = true;
    this.isRefreshingToken = false;
  }

  /**
   * Connect to WebSocket server
   */
  connect(userId) {
    if (this.socket && this.isConnected) {
      Logger.info('🔌 Socket already connected');
      return;
    }

    this.userId = userId;
    const serverUrl = environment.socketUrl;

    Logger.info(`🔌 Connecting to WebSocket server: ${serverUrl}`);

    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      // Function form: every (re)connection attempt reads the current access
      // token, so a token refreshed mid-session is picked up automatically.
      auth: cb => cb({ token: ApiClient.token }),
    });

    this.setupEventListeners();
  }

  /**
   * Setup Socket.IO event listeners
   */
  setupEventListeners() {
    if (!this.socket) return;

    // Remove existing listeners to prevent duplicates
    this.socket.removeAllListeners();

    this.socket.on('connect', () => {
      this.isConnected = true;
      Logger.success(`🔌 Connected to WebSocket server. Socket ID: ${this.socket.id}`);
      Logger.info(`🔌 User ID: ${this.userId}`);

      // Join user's personal room
      if (this.userId) {
        this.socket.emit('join-user-room', this.userId);
        Logger.info(`👤 Joining user room: user:${this.userId}`);
      }

      // Re-join match rooms: socket.io rooms are per-socket and drop on
      // every disconnect, so without this any reconnect silently removes
      // us from the chat we're looking at (server re-validates membership)
      this.joinedMatchRooms.forEach(matchId => {
        this.socket.emit('join-match-room', matchId);
        Logger.info(`📱 Re-joined match room after reconnect: match:${matchId}`);
      });

      // Start heartbeat to keep online status updated (only if app is active)
      if (this.isAppActive) {
        this.startHeartbeat();
      }

      // Setup AppState listener to track foreground/background
      this.setupAppStateListener();

      // Notify connection listeners
      this.connectionListeners.forEach(callback => callback(true));
    });

    this.socket.on('disconnect', reason => {
      this.isConnected = false;
      Logger.warn(`🔌 Disconnected from WebSocket server. Reason: ${reason}`);

      // Stop heartbeat
      this.stopHeartbeat();

      // Notify connection listeners
      this.connectionListeners.forEach(callback => callback(false));
    });

    this.socket.on('connect_error', error => {
      Logger.error('🔌 WebSocket connection error:', error);

      // The server rejects sockets with a missing/expired access token.
      // Refresh it once; the function-form `auth` option sends the new token
      // on the next automatic reconnection attempt.
      if (error?.message === 'unauthorized' && !this.isRefreshingToken) {
        this.isRefreshingToken = true;
        ApiClient.refreshAccessToken()
          .then(refreshed => {
            Logger.info(`🔌 Socket auth refresh ${refreshed ? 'succeeded' : 'failed'}`);
          })
          .catch(refreshError => {
            Logger.error('🔌 Socket auth refresh error:', refreshError);
          })
          .finally(() => {
            this.isRefreshingToken = false;
          });
      }
    });

    // Real-time message events
    this.socket.on('new-message', data => {
      Logger.info('📩 New message received via WebSocket:', data);
      Logger.info(`📩 Message listeners count: ${this.messageListeners.size}`);
      this.messageListeners.forEach(callback => callback('new-message', data));
    });

    this.socket.on('message-notification', data => {
      Logger.info('🔔 Message notification received:', data);
      this.messageListeners.forEach(callback => callback('message-notification', data));
    });

    // Real-time match events
    this.socket.on('new-match', data => {
      Logger.info('💕 New match received via WebSocket!');
      Logger.info(
        `🎯 Match Details: Match ID: ${data.matchId}, Matched User: ${data.matchedUser?.name} (ID: ${data.matchedUser?.id})`
      );
      Logger.info(
        `📸 Matched User Photo: ${data.matchedUser?.mainPhoto ? 'Has photo' : 'No photo'}`
      );
      Logger.info(`💬 Message: ${data.message}`);
      this.matchListeners.forEach(callback => callback('new-match', data));
    });

    // In-chat game state deltas (per-viewer redacted snapshots)
    this.socket.on('game-updated', data => {
      this.gameListeners.forEach(callback => callback('game-updated', data));
    });

    // Liked You update events
    this.socket.on('liked-you-update', data => {
      Logger.info('💘 Liked You update received via WebSocket!');
      Logger.info(
        `🔄 Update Action: ${data.action}, User ID: ${data.userId}, Reason: ${data.reason}`
      );
      this.likedYouListeners.forEach(callback => callback('liked-you-update', data));
    });

    // Read receipt events
    this.socket.on('messages-read', data => {
      Logger.info('👁️ Messages read via WebSocket:', data);
      this.messageListeners.forEach(callback => callback('messages-read', data));
    });

    this.socket.on('read-receipt', data => {
      Logger.info('📧 Read receipt received:', data);
      this.messageListeners.forEach(callback => callback('read-receipt', data));
    });

    // Typing indicator events
    this.socket.on('user-typing', data => {
      Logger.info('⌨️ User typing status:', data);
      this.messageListeners.forEach(callback => callback('user-typing', data));
    });

    // Online status events
    this.socket.on('user-online-status', data => {
      Logger.info('🟢 User online status:', data);
      this.matchListeners.forEach(callback => callback('user-online-status', data));
      // Also notify user status listeners with timestamp
      this.userStatusListeners.forEach(callback =>
        callback(data.userId, data.isOnline, data.timestamp)
      );
    });

    // Additional online/offline events for user status tracking (legacy)
    this.socket.on('user-online', data => {
      Logger.info('🟢 User came online:', data);
      this.userStatusListeners.forEach(callback => callback(data.userId, true, new Date()));
    });

    this.socket.on('user-offline', data => {
      Logger.info('🔴 User went offline:', data);
      this.userStatusListeners.forEach(callback => callback(data.userId, false, new Date()));
    });

    // Message reaction events
    this.socket.on('message-reaction', data => {
      Logger.info('😊 Message reaction received:', data);
      this.messageListeners.forEach(callback => callback('message-reaction', data));
    });
  }

  /**
   * Join a match room for real-time messaging
   */
  joinMatchRoom(matchId) {
    // Track intent regardless of connection state: the connect handler
    // replays these, so a join requested while offline (or lost to a
    // reconnect) happens as soon as we're back
    this.joinedMatchRooms.add(matchId);
    if (this.socket && this.isConnected) {
      this.socket.emit('join-match-room', matchId);
      Logger.info(`📱 Joined match room: match:${matchId}`);
    } else {
      Logger.warn(`📱 Queued match room join for reconnect: ${matchId}`);
    }
  }

  /**
   * Leave a match room
   */
  leaveMatchRoom(matchId) {
    this.joinedMatchRooms.delete(matchId);
    if (this.socket && this.isConnected) {
      this.socket.emit('leave-match-room', matchId);
      Logger.info(`📱 Left match room: ${matchId}`);
    }
  }

  /**
   * Add message event listener
   */
  onMessage(callback) {
    this.messageListeners.add(callback);
    return () => this.messageListeners.delete(callback);
  }

  /**
   * Add match event listener
   */
  onMatch(callback) {
    this.matchListeners.add(callback);
    return () => this.matchListeners.delete(callback);
  }

  /**
   * Add connection status listener
   */
  onConnection(callback) {
    this.connectionListeners.add(callback);
    return () => this.connectionListeners.delete(callback);
  }

  /**
   * Add liked-you update listener
   */
  onLikedYouUpdate(callback) {
    this.likedYouListeners.add(callback);
    return () => this.likedYouListeners.delete(callback);
  }

  /**
   * Subscribe to game session updates
   * @param {function} callback - Called with (event, data)
   * @returns {function} Unsubscribe function
   */
  onGame(callback) {
    this.gameListeners.add(callback);
    return () => this.gameListeners.delete(callback);
  }

  /**
   * Emit typing start event
   */
  startTyping(matchId, userId, userName) {
    if (this.socket && this.isConnected) {
      this.socket.emit('typing-start', { matchId, userId, userName });
      Logger.info(`⌨️ Started typing in match: ${matchId} (user: ${userId})`);
    } else {
      Logger.warn(`⌨️ Cannot start typing - socket not connected`);
    }
  }

  /**
   * Emit typing stop event
   */
  stopTyping(matchId, userId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('typing-stop', { matchId, userId });
      Logger.info(`⌨️ Stopped typing in match: ${matchId}`);
    }
  }

  /**
   * Update online status
   */
  updateOnlineStatus(userId, isOnline) {
    if (this.socket && this.isConnected) {
      this.socket.emit('update-online-status', { userId, isOnline });
      Logger.info(`🟢 Updated online status: ${isOnline}`);
    }
  }

  /**
   * Subscribe to user status updates
   */
  onUserStatus(callback) {
    this.userStatusListeners.add(callback);
    Logger.info('👂 User status listener added');
    return () => {
      this.userStatusListeners.delete(callback);
      Logger.info('🔇 User status listener removed');
    };
  }

  /**
   * Setup AppState listener to track when app is in foreground/background
   */
  setupAppStateListener() {
    // Clean up existing subscription
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }

    this.appStateSubscription = AppState.addEventListener('change', nextAppState => {
      const wasActive = this.isAppActive;
      this.isAppActive = nextAppState === 'active';

      if (this.isAppActive && !wasActive) {
        // App came to foreground - start heartbeat and broadcast online
        Logger.info('📱 App came to foreground - starting heartbeat');
        this.startHeartbeat();
      } else if (!this.isAppActive && wasActive) {
        // App went to background - stop heartbeat
        Logger.info('📱 App went to background - stopping heartbeat');
        this.stopHeartbeat();
      }
    });
  }

  /**
   * Start heartbeat to keep online status updated
   * Only runs while app is in the foreground
   */
  startHeartbeat() {
    // Clear any existing heartbeat
    this.stopHeartbeat();

    // Send heartbeat every 30 seconds while app is active
    this.heartbeatInterval = setInterval(() => {
      if (this.socket && this.isConnected && this.userId && this.isAppActive) {
        this.socket.emit('heartbeat', { userId: this.userId });
      }
    }, 30000); // 30 seconds

    // Send initial heartbeat immediately
    if (this.socket && this.isConnected && this.userId) {
      this.socket.emit('heartbeat', { userId: this.userId });
    }
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    // Stop heartbeat
    this.stopHeartbeat();

    // Clean up AppState listener
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    if (this.socket) {
      Logger.info('🔌 Disconnecting from WebSocket server');
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.userId = null;

      // Clear all listeners
      this.messageListeners.clear();
      this.matchListeners.clear();
      this.connectionListeners.clear();
      this.likedYouListeners.clear();
      this.userStatusListeners.clear();
    }
  }

  /**
   * Get connection status
   */
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      socketId: this.socket?.id,
      userId: this.userId,
    };
  }
}

// Export singleton instance
export default new SocketService();
