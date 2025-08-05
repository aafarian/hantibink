import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import DataService from '../services/DataService';
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

      const conversationUnreadCount = DataService.getConversationUnreadCount(
        messages,
        matchData,
        user.uid
      );

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
        // Get all user matches
        const matches = await DataService.getUserMatches(user.uid);

        // Set up real-time listeners for each match's messages AND match document changes
        const matchListeners = [];

        matches.forEach(match => {
          // Listen to messages changes
          const messagesListener = DataService.subscribeToMessages(match.id, messages => {
            // Use the current match data from the closure, but the callback ensures fresh data
            updateConversationWithMessages(match, messages);
          });

          // Listen to match document changes (for lastViewedBy updates)
          const matchListener = DataService.subscribeToMatch(match.id, updatedMatch => {
            // Get current messages for this match to recalculate unread count
            DataService.getMessages(match.id).then(messages => {
              // Use the updatedMatch from the callback parameter (fresh data)
              updateConversationWithMessages(updatedMatch, messages);
            });
          });

          matchListeners.push(messagesListener, matchListener);
        });

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
