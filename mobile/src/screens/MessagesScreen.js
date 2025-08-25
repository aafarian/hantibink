import React, { useState, useEffect } from 'react';
import { View, FlatList } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useMatchesWithProfiles } from '../hooks/useMatches';
import { useUnread } from '../contexts/UnreadContext';
import { LoadingScreen } from '../components/LoadingScreen';
import { ErrorScreen, EmptyState } from '../components/ErrorScreen';
import { MatchCard } from '../components/MatchCard';
import { theme } from '../styles/theme';
import { commonStyles } from '../styles/commonStyles';

const MessagesScreen = () => {
  // Unread count now handled globally in UnreadContext
  const { conversations, loading, error, refresh } = useMatchesWithProfiles();
  const { conversations: unreadConversations } = useUnread();
  const navigation = useNavigation();

  // Merge real-time data from UnreadContext with profile data from useMatchesWithProfiles
  const [mergedConversations, setMergedConversations] = useState([]);

  // Refresh when screen comes into focus (e.g., after creating a new match)
  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [refresh])
  );

  useEffect(() => {
    if (!conversations?.length) {
      setMergedConversations([]);
      return;
    }

    const merged = conversations.map(conv => {
      // Find matching conversation in UnreadContext for real-time data
      const unreadConv = unreadConversations?.find(
        uc => uc.id === conv.matchId || uc.matchId === conv.id
      );

      if (unreadConv) {
        return {
          ...conv,
          lastMessage: unreadConv.lastMessage?.content || conv.lastMessage,
          lastMessageTime: unreadConv.lastMessage?.timestamp || conv.lastMessageTime,
          unreadCount: unreadConv.unreadCount || 0,
          isTyping: unreadConv.isTyping || false,
          typingUser: unreadConv.typingUser || null,
        };
      }

      return conv;
    });

    setMergedConversations(merged);
  }, [conversations, unreadConversations]);

  const renderConversation = ({ item }) => (
    <MatchCard
      match={item}
      onPress={() => {
        navigation.navigate('Chat', { match: item });
      }}
      onMessagePress={() => {
        navigation.navigate('Chat', { match: item });
      }}
      showMessageButton={false}
      unreadCount={item.unreadCount}
      showLastMessage={true}
    />
  );

  if (loading) {
    return <LoadingScreen message="Loading your matches..." />;
  }

  if (error) {
    return <ErrorScreen message="Failed to load matches" onRetry={refresh} />;
  }

  return (
    <View style={commonStyles.container}>
      <FlatList
        data={mergedConversations}
        renderItem={renderConversation}
        keyExtractor={item => item.matchId}
        ListEmptyComponent={
          <EmptyState
            icon="heart-outline"
            title="No matches yet"
            subtitle="Start swiping to find your perfect match!"
          />
        }
        refreshing={loading}
        onRefresh={refresh}
        contentContainerStyle={{ padding: theme.spacing.md }}
      />
    </View>
  );
};

export default MessagesScreen;
