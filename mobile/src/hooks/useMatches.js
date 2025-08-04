import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { useAsyncOperation } from './useAsyncOperation';
import DataService from '../services/DataService';

export const useMatches = () => {
  const { user } = useAuth();
  const { loading, error, execute } = useAsyncOperation();
  const [matches, setMatches] = useState([]);
  const [lastRefresh, setLastRefresh] = useState(null);

  const loadMatches = useCallback(async () => {
    if (!user?.uid) return { success: false, error: 'No user logged in' };

    const result = await execute(() => DataService.getUserMatches(user.uid), {
      loadingMessage: `Loading matches for user: ${user.uid}`,
      errorMessage: 'Failed to load matches',
      successMessage: 'Matches loaded successfully',
    });

    if (result.success) {
      setMatches(result.data || []);
      setLastRefresh(new Date());
    }

    return result;
  }, [user, execute]);

  // Load matches when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (user?.uid) {
        loadMatches();
      }
    }, [user, loadMatches])
  );

  const refreshMatches = () => {
    return loadMatches();
  };

  return {
    matches,
    loading,
    error,
    refresh: refreshMatches,
    lastRefresh,
    hasMatches: matches.length > 0,
    matchCount: matches.length,
  };
};

export const useMatchesWithProfiles = () => {
  const { user } = useAuth();
  const { loading, error, execute } = useAsyncOperation();
  const [conversations, setConversations] = useState([]);

  const loadMatchesWithProfiles = useCallback(async () => {
    if (!user?.uid) return { success: false, error: 'No user logged in' };

    const result = await execute(
      async () => {
        // Get matches
        const matches = await DataService.getUserMatches(user.uid);

        // Get profiles for each match
        const conversationsWithProfiles = await Promise.all(
          matches.map(async match => {
            const otherUserId = match.users.find(id => id !== user.uid);
            const otherUserProfile = await DataService.getUserProfile(otherUserId);

            // Load messages for this match
            const messages = await DataService.getMessages(match.id);

            // Calculate unread count
            const unreadCount = DataService.getUnreadCount(messages, match, user.uid);

            return {
              matchId: match.id,
              match: match,
              otherUser: otherUserProfile,
              otherUserId: otherUserId,
              messages: messages,
              lastMessage: match.lastMessage,
              lastMessageTime: match.lastMessageTime,
              unreadCount: unreadCount,
            };
          })
        );

        return conversationsWithProfiles.filter(conv => conv.otherUser); // Filter out failed profile loads
      },
      {
        loadingMessage: `Loading matches with profiles for user: ${user.uid}`,
        errorMessage: 'Failed to load matches',
        successMessage: 'Conversations loaded successfully',
      }
    );

    if (result.success) {
      setConversations(result.data || []);
    }

    return result;
  }, [user, execute]);

  // Load matches when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (user?.uid) {
        loadMatchesWithProfiles();
      }
    }, [user, loadMatchesWithProfiles])
  );

  return {
    conversations,
    loading,
    error,
    refresh: loadMatchesWithProfiles,
    hasConversations: conversations.length > 0,
    conversationCount: conversations.length,
  };
};
