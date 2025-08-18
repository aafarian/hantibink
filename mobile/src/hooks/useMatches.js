import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { useAsyncOperation } from './useAsyncOperation';
import ApiDataService from '../services/ApiDataService';
import Logger from '../utils/logger';

export const useMatches = () => {
  const { user } = useAuth();
  const { loading, error, execute } = useAsyncOperation();
  const [matches, setMatches] = useState([]);
  const [lastRefresh, setLastRefresh] = useState(null);

  const loadMatches = useCallback(async () => {
    if (!user?.uid) return { success: false, error: 'No user logged in' };

    const result = await execute(() => ApiDataService.getUserMatches(), {
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

  // Load matches when screen comes into focus (with throttling)
  useFocusEffect(
    React.useCallback(() => {
      if (user?.uid) {
        // Only reload if it's been more than 30 seconds since last refresh
        const now = new Date();
        if (!lastRefresh || now - lastRefresh > 30000) {
          loadMatches();
        } else {
          Logger.info('⏰ Skipping matches reload (too recent)');
        }
      }
    }, [user, loadMatches, lastRefresh])
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
        const matches = await ApiDataService.getUserMatches();

        // Transform API matches to expected format
        const conversationsWithProfiles = await Promise.all(
          (Array.isArray(matches) ? matches : []).map(async match => {
            // Load messages for this match
            const messages = await ApiDataService.getMessages(match.id);

            // Calculate unread count using API method
            const unreadCount = ApiDataService.getUnreadCount(messages, user.uid);

            return {
              matchId: match.id,
              match: match,
              otherUser: match.otherUser,
              otherUserId: match.otherUser.id,
              messages: messages,
              lastMessage: match.lastMessage?.content || null,
              lastMessageTime: match.lastMessage?.timestamp || null,
              unreadCount: unreadCount,
            };
          })
        );

        // Filter out failed profile loads and log failures for debugging
        const validConversations = conversationsWithProfiles.filter(conv => {
          if (!conv.otherUser) {
            Logger.warn('Failed to load profile for user:', conv.otherUserId);
            return false;
          }
          return true;
        });

        const failedCount = conversationsWithProfiles.length - validConversations.length;
        if (failedCount > 0) {
          Logger.warn(
            `${failedCount} profile(s) failed to load out of ${conversationsWithProfiles.length} matches`
          );
        }

        return validConversations;
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

  // Load matches when screen comes into focus (throttled)
  const [lastProfileRefresh, setLastProfileRefresh] = useState(null);
  useFocusEffect(
    React.useCallback(() => {
      if (user?.uid) {
        // Only reload if it's been more than 30 seconds since last refresh
        const now = new Date();
        if (!lastProfileRefresh || now - lastProfileRefresh > 30000) {
          loadMatchesWithProfiles().then(() => setLastProfileRefresh(new Date()));
        } else {
          Logger.info('⏰ Skipping matches with profiles reload (too recent)');
        }
      }
    }, [user, loadMatchesWithProfiles, lastProfileRefresh])
  );

  // Real-time updates will be handled by subscribing to UnreadContext changes
  // This avoids conflicts with multiple WebSocket listeners

  return {
    conversations,
    loading,
    error,
    refresh: loadMatchesWithProfiles,
    hasConversations: conversations.length > 0,
    conversationCount: conversations.length,
  };
};
