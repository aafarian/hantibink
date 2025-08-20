/**
 * WebSocket Service using Socket.IO
 * Handles real-time communication for messages and matches
 */

import { io } from 'socket.io-client';
import Logger from '../utils/logger';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.userId = null;
    this.messageListeners = new Set();
    this.matchListeners = new Set();
    this.connectionListeners = new Set();
    this.likedYouListeners = new Set();
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
    const serverUrl = __DEV__ ? 'http://192.168.68.67:3000' : 'https://your-production-domain.com';

    Logger.info(`🔌 Connecting to WebSocket server: ${serverUrl}`);

    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
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

      // Notify connection listeners
      this.connectionListeners.forEach(callback => callback(true));
    });

    this.socket.on('disconnect', reason => {
      this.isConnected = false;
      Logger.warn(`🔌 Disconnected from WebSocket server. Reason: ${reason}`);

      // Notify connection listeners
      this.connectionListeners.forEach(callback => callback(false));
    });

    this.socket.on('connect_error', error => {
      Logger.error('🔌 WebSocket connection error:', error);
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
      Logger.info('💕 New match received via WebSocket:', data);
      this.matchListeners.forEach(callback => callback('new-match', data));
    });

    // Liked You update events
    this.socket.on('liked-you-update', data => {
      Logger.info('💘 Liked You update received via WebSocket:', data);
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
    });
  }

  /**
   * Join a match room for real-time messaging
   */
  joinMatchRoom(matchId) {
    if (this.socket && this.isConnected) {
      this.socket.emit('join-match-room', matchId);
      Logger.info(`📱 Joined match room: match:${matchId}`);
      Logger.info(`📱 Socket connected: ${this.isConnected}, Socket ID: ${this.socket.id}`);
    } else {
      Logger.warn(`📱 Cannot join match room ${matchId} - socket not connected`);
      Logger.warn(`📱 Socket exists: ${!!this.socket}, Connected: ${this.isConnected}`);
    }
  }

  /**
   * Leave a match room
   */
  leaveMatchRoom(matchId) {
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
   * Disconnect from WebSocket server
   */
  disconnect() {
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
