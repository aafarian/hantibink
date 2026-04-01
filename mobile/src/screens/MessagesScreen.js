import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useMatchesWithProfiles } from '../hooks/useMatches';
import { useUnread } from '../contexts/UnreadContext';
import useCollapsibleHeader from '../hooks/useCollapsibleHeader';
import { LoadingScreen } from '../components/LoadingScreen';
import { ErrorScreen, EmptyState } from '../components/ErrorScreen';
import { MatchCard } from '../components/MatchCard';
import { theme } from '../styles/theme';
import { commonStyles } from '../styles/commonStyles';

// Constants for collapsible header
const HEADER_MAX_HEIGHT = 96;
const HEADER_MIN_HEIGHT = 56;
const COLLAPSE_THRESHOLD = 60;

const MessagesScreen = () => {
  // Unread count now handled globally in UnreadContext
  const { conversations, loading, refreshing, error, refresh } = useMatchesWithProfiles();
  const { conversations: unreadConversations } = useUnread();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  // Initialize collapsible header hook
  const { animatedHeaderStyle, animatedContentStyle, scrollHandler, resetHeader } =
    useCollapsibleHeader({
      maxHeight: HEADER_MAX_HEIGHT + insets.top,
      minHeight: HEADER_MIN_HEIGHT + insets.top,
      collapseThreshold: COLLAPSE_THRESHOLD,
    });

  // Merge real-time data from UnreadContext with profile data from useMatchesWithProfiles
  const [mergedConversations, setMergedConversations] = useState([]);

  // Note: Focus-based refresh with throttling is handled in useMatchesWithProfiles hook

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

  // Reset header when screen comes into focus (for navigation transitions)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      resetHeader();
    });
    return unsubscribe;
  }, [navigation, resetHeader]);

  if (loading) {
    return <LoadingScreen message="Loading your matches..." />;
  }

  if (error) {
    return <ErrorScreen message="Failed to load matches" onRetry={refresh} />;
  }

  return (
    <View style={commonStyles.container}>
      {/* Collapsible Header */}
      <Animated.View style={[styles.header, { paddingTop: insets.top }, animatedHeaderStyle]}>
        <Animated.View style={[styles.headerContent, animatedContentStyle]}>
          <Text style={styles.headerTitle}>Messages</Text>
        </Animated.View>
      </Animated.View>

      {/* Message List */}
      <Animated.FlatList
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
        refreshing={refreshing}
        onRefresh={refresh}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.listContent, { paddingTop: theme.spacing.md }]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: theme.colors.primary,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    zIndex: 10,
    ...theme.shadows.medium,
  },
  headerContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text.white,
  },
  listContent: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
});

export default MessagesScreen;
