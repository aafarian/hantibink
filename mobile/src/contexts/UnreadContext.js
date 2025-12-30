import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import ApiDataService from '../services/ApiDataService';
import SocketService from '../services/SocketService';
import Logger from '../utils/logger';

const UnreadContext = createContext();

export const UnreadProvider = ({ children }) => {
  const { user } = useAuth();
  const [unreadConversationCount, setUnreadConversationCount] = useState(0);
  const [conversations, setConversations] = useState([]);

  // Helper function to update conversation with latest data (moved outside useEffect to avoid stale closures)
  const updateConversationWithMessages = useCallback(
    (matchData, messages) => {
      if (!user?.uid) return;

      const conversationUnreadCount = ApiDataService.getUnreadCount(messages, user.uid);

      // Update conversation with latest unread count
      setConversations(prev => {
        const updated = prev.filter(conv => conv.matchId !== matchData.id);
        updated.push({
          matchId: matchData.id,
          match: matchData,
          unreadCount: conversationUnreadCount,
          lastMessage: matchData.lastMessage,
          lastMessageTime: matchData.lastMessageTime,
        });

        // Calculate total unread conversations
        const totalUnread = updated.filter(conv => conv.unreadCount > 0).length;
        setUnreadConversationCount(totalUnread);

        return updated;
      });
    },
    [user?.uid]
  );

  // Real-time listener for all matches and their unread counts
  useEffect(() => {
    if (!user?.uid) {
      setUnreadConversationCount(0);
      setConversations([]);
      return;
    }

    let unsubscribes = [];

    const setupRealTimeListeners = async () => {
      try {
        // Get all user matches and initialize unread counts
        const matches = await ApiDataService.getUserMatches();

        // Initialize conversations with data from API
        if (matches && matches.length > 0) {
          const initialConversations = matches.map(match => ({
            matchId: match.id,
            id: match.id,
            match: match,
            unreadCount: match.unreadCount || 0,
            // API returns lastMessage as object { content, timestamp, senderId, isFromMe }
            lastMessage: match.lastMessage || null,
            lastMessageTime: match.lastMessage?.timestamp || match.lastMessageTime,
            isTyping: false,
            typingUser: null,
          }));

          setConversations(initialConversations);

          // Calculate initial total unread
          const totalUnread = initialConversations.filter(conv => conv.unreadCount > 0).length;
          setUnreadConversationCount(totalUnread);

          Logger.info(
            `📬 Initialized ${matches.length} conversations, ${totalUnread} with unread messages`
          );
        }

        // Set up real-time listeners for each match's messages AND match document changes
        const matchListeners = [];

        // Set up WebSocket listeners for real-time updates (replaces polling)
        const unsubscribeMessage = SocketService.onMessage((eventType, data) => {
          if (eventType === 'new-message') {
            // Update the specific conversation with the new message
            setConversations(prev => {
              const updated = prev.map(conv => {
                if (conv.matchId === data.matchId) {
                  const existingMessage = conv.messages?.find(msg => msg.id === data.message.id);
                  if (!existingMessage) {
                    // Only increment unread count if message is from the other user
                    const shouldIncrementUnread = data.message.senderId !== user?.uid;
                    return {
                      ...conv,
                      messages: [...(conv.messages || []), data.message],
                      unreadCount: shouldIncrementUnread ? conv.unreadCount + 1 : conv.unreadCount,
                      lastMessage: data.message,
                      lastMessageTime: data.message.timestamp || data.message.createdAt,
                    };
                  }
                }
                return conv;
              });

              // Calculate total unread conversations
              const totalUnread = updated.filter(conv => conv.unreadCount > 0).length;
              setUnreadConversationCount(totalUnread);

              return updated;
            });
          } else if (eventType === 'message-notification') {
            // Handle push notifications or update UI indicators
          } else if (eventType === 'messages-read') {
            // Reset unread count when messages are marked as read
            setConversations(prev => {
              const updated = prev.map(conv => {
                if (conv.matchId === data.matchId) {
                  return {
                    ...conv,
                    unreadCount: 0,
                  };
                }
                return conv;
              });

              // Calculate total unread conversations
              const totalUnread = updated.filter(conv => conv.unreadCount > 0).length;
              setUnreadConversationCount(totalUnread);

              return updated;
            });
          } else if (eventType === 'user-typing') {
            // Update typing status for conversations
            setConversations(prev =>
              prev.map(conv => {
                // Check both matchId and id for compatibility
                if (
                  (conv.matchId === data.matchId || conv.id === data.matchId) &&
                  data.userId !== user?.uid
                ) {
                  return {
                    ...conv,
                    isTyping: data.isTyping,
                    typingUser: data.isTyping ? data.userName : null,
                  };
                }
                return conv;
              })
            );
          }
        });

        const unsubscribeMatch = SocketService.onMatch((eventType, data) => {
          if (eventType === 'new-match') {
            // Add new match to conversations with consistent structure
            setConversations(prev => [
              ...prev,
              {
                matchId: data.matchId,
                id: data.matchId,
                match: data.matchedUser || data.user,
                unreadCount: 0,
                lastMessage: null,
                lastMessageTime: data.timestamp,
                isTyping: false,
                typingUser: null,
              },
            ]);
          }
        });

        matchListeners.push(unsubscribeMessage);
        matchListeners.push(unsubscribeMatch);

        unsubscribes = matchListeners;
      } catch (error) {
        Logger.error('Failed to set up unread listeners:', error);
      }
    };

    setupRealTimeListeners();

    // Cleanup function
    return () => {
      unsubscribes.forEach(unsubscribe => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      });
    };
  }, [user?.uid, updateConversationWithMessages]);

  // Legacy function for manual updates (keeping for compatibility)
  const updateUnreadCount = count => {
    setUnreadConversationCount(count);
  };

  return (
    <UnreadContext.Provider
      value={{
        unreadConversationCount,
        conversations,
        updateUnreadCount, // Keep for backward compatibility
      }}
    >
      {children}
    </UnreadContext.Provider>
  );
};

export const useUnread = () => {
  const context = useContext(UnreadContext);
  if (!context) {
    throw new Error('useUnread must be used within an UnreadProvider');
  }
  return context;
};
