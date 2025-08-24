import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { ChatKeyboardWrapper } from '../components/KeyboardAvoidWrapper';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
// Unread count now handled globally in UnreadContext
import { useFeatureFlags } from '../contexts/FeatureFlagsContext';
import { useMatchesWithProfiles } from '../hooks/useMatches';
import { useUnread } from '../contexts/UnreadContext';
import { LoadingScreen } from '../components/LoadingScreen';
import { ErrorScreen, EmptyState } from '../components/ErrorScreen';
import SocketService from '../services/SocketService';
import { MatchCard } from '../components/MatchCard';
import { theme } from '../styles/theme';
import { commonStyles } from '../styles/commonStyles';
import ApiDataService from '../services/ApiDataService';
import Logger from '../utils/logger';
import { handleErrorWithToast } from '../utils/errorHandler';
import { getUserProfilePhoto, getUserDisplayName } from '../utils/profileHelpers';

const MessagesScreen = () => {
  const { user } = useAuth();
  const { showError } = useToast();
  const { hasFeature, FEATURES } = useFeatureFlags();
  // Unread count now handled globally in UnreadContext
  const { conversations, loading, error, refresh } = useMatchesWithProfiles();
  const { conversations: unreadConversations } = useUnread();
  const navigation = useNavigation();

  // Merge real-time data from UnreadContext with profile data from useMatchesWithProfiles
  const [mergedConversations, setMergedConversations] = useState([]);

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

  // Note: We don't auto-mark conversations as viewed here to preserve unread counts
  // Conversations should only be marked as viewed when user actually opens them

  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [realTimeMessages, setRealTimeMessages] = useState([]);
  const [sendingMessage, setSendingMessage] = useState(false);

  // Typing indicators
  const [typingUsers, setTypingUsers] = useState([]);
  const [isCurrentUserTyping, setIsCurrentUserTyping] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const typingTimeoutRef = useRef(null);

  // Animation for typing dots
  const typingAnim1 = useRef(new Animated.Value(0.4)).current;
  const typingAnim2 = useRef(new Animated.Value(0.4)).current;
  const typingAnim3 = useRef(new Animated.Value(0.4)).current;

  // Ref for auto-scrolling to bottom
  const flatListRef = useRef(null);

  // Listen for tab press to reset conversation view
  useEffect(() => {
    const parent = navigation.getParent();
    if (!parent) return;

    const unsubscribe = parent.addListener('tabPress', e => {
      // Only reset if this is the Messages tab being pressed
      if (e.target?.includes('Messages') && selectedConversation) {
        setSelectedConversation(null);
      }
    });

    return unsubscribe;
  }, [navigation, selectedConversation]);

  // Handle typing indicator logic
  const handleTypingStart = async () => {
    if (!selectedConversation?.matchId || isCurrentUserTyping) return;

    try {
      SocketService.startTyping(selectedConversation.matchId, user.uid, user.displayName || 'User');
      setIsCurrentUserTyping(true);
    } catch (err) {
      Logger.error('Error setting typing status:', err);
    }
  };

  const handleTypingStop = async () => {
    if (!selectedConversation?.matchId || !isCurrentUserTyping) return;

    try {
      SocketService.stopTyping(selectedConversation.matchId, user.uid);
      setIsCurrentUserTyping(false);
    } catch (err) {
      Logger.error('Error clearing typing status:', err);
    }
  };

  const handleTextChange = text => {
    setMessageText(text);

    if (text.length > 0) {
      handleTypingStart();

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Set new timeout to stop typing after 3 seconds of no typing
      typingTimeoutRef.current = setTimeout(handleTypingStop, 3000);
    } else {
      // If text is empty, stop typing immediately
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      handleTypingStop();
    }
  };

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // Unread count now handled globally in UnreadContext

  // Animate typing dots
  useEffect(() => {
    if (typingUsers.length > 0) {
      // Start the staggered animation when someone is typing
      const animate = () => {
        Animated.sequence([
          Animated.timing(typingAnim1, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(typingAnim2, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(typingAnim3, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(typingAnim1, { toValue: 0.4, duration: 500, useNativeDriver: true }),
          Animated.timing(typingAnim2, { toValue: 0.4, duration: 500, useNativeDriver: true }),
          Animated.timing(typingAnim3, { toValue: 0.4, duration: 500, useNativeDriver: true }),
        ]).start(() => {
          if (typingUsers.length > 0) {
            animate(); // Loop the animation
          }
        });
      };
      animate();
    } else {
      // Reset animation when no one is typing
      typingAnim1.setValue(0.4);
      typingAnim2.setValue(0.4);
      typingAnim3.setValue(0.4);
    }
  }, [typingUsers.length, typingAnim1, typingAnim2, typingAnim3]);

  // Set up real-time listener for typing indicators
  useEffect(() => {
    if (!selectedConversation?.matchId) {
      setTypingUsers([]);
      return;
    }

    // TODO: Implement typing status via WebSocket in future PR
    const unsubscribe = null;
    // const unsubscribe = DataService.subscribeToTypingStatus(
    //   selectedConversation.matchId,
    //   user.uid,
    //   typingUsersList => {
    //     setTypingUsers(typingUsersList);
    //   }
    // );

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [selectedConversation?.matchId, user.uid]);

  // Set up real-time listener for messages when a conversation is selected
  useEffect(() => {
    if (!selectedConversation?.matchId) {
      setRealTimeMessages([]);
      return;
    }

    Logger.info(`Setting up real-time listener for match: ${selectedConversation.matchId}`);

    // Mark messages as read when opening conversation
    ApiDataService.markMessagesAsRead(selectedConversation.matchId);

    // Load initial messages
    const loadMessages = async () => {
      try {
        const messages = await ApiDataService.getMessages(selectedConversation.matchId);
        setRealTimeMessages(messages);
      } catch (err) {
        Logger.error('Error loading messages:', err);
      }
    };

    loadMessages();

    // Join the match room for real-time messaging
    SocketService.joinMatchRoom(selectedConversation.matchId);

    // Set up real-time message listener
    Logger.info('🔗 Setting up real-time message listeners...');
    const unsubscribeMessages = SocketService.onMessage((eventType, data) => {
      if (eventType === 'new-message' && data.matchId === selectedConversation.matchId) {
        Logger.info('📩 Real-time message received in MessagesScreen:', data);
        setRealTimeMessages(prev => {
          // Check if message already exists (including temp messages) to prevent duplicates
          const exists = prev.some(
            msg =>
              msg.id === data.message.id ||
              (msg.id.startsWith('temp-') &&
                msg.content === data.message.content &&
                msg.senderId === data.message.senderId)
          );
          if (!exists) {
            return [...prev, data.message].sort(
              (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
            );
          }
          return prev;
        });
      } else if (eventType === 'messages-read' && data.matchId === selectedConversation.matchId) {
        Logger.info('👁️ Messages marked as read:', data);
        // Update read status of messages sent by current user
        setRealTimeMessages(prev =>
          prev.map(msg => ({
            ...msg,
            isRead: msg.senderId === user.uid ? true : msg.isRead, // Only update our own messages
          }))
        );
      } else if (eventType === 'user-typing' && data.matchId === selectedConversation.matchId) {
        Logger.info('⌨️ User typing status changed:', data);
        if (data.userId !== user.uid) {
          // Don't show our own typing
          setTypingUsers(prev => {
            if (data.isTyping) {
              return [...prev.filter(u => u.userId !== data.userId), data];
            } else {
              return prev.filter(u => u.userId !== data.userId);
            }
          });
        }
      }
    });

    // Set up match listener for online status
    const unsubscribeMatch = SocketService.onMatch((eventType, data) => {
      if (eventType === 'user-online-status') {
        Logger.info('🟢 User online status changed:', data);
        setOnlineUsers(prev => {
          const newSet = new Set(prev);
          if (data.isOnline) {
            newSet.add(data.userId);
          } else {
            newSet.delete(data.userId);
          }
          return newSet;
        });
      }
    });

    const unsubscribe = () => {
      SocketService.leaveMatchRoom(selectedConversation.matchId);
      unsubscribeMessages();
      unsubscribeMatch();
    };

    // Cleanup listener when conversation changes or component unmounts
    return () => {
      if (unsubscribe) {
        Logger.info(`Cleaning up listener for match: ${selectedConversation.matchId}`);
        unsubscribe();
      }
    };
  }, [selectedConversation?.matchId, user.uid]);

  const sendMessage = async () => {
    if (!messageText.trim() || !selectedConversation || sendingMessage) {
      return;
    }

    setSendingMessage(true);
    const messageToSend = messageText.trim();
    setMessageText(''); // Clear input immediately for better UX

    // Clear typing indicator when sending message
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    handleTypingStop();

    // Add message to local state immediately for instant feedback
    const tempMessage = {
      id: `temp-${Date.now()}`,
      content: messageToSend,
      senderId: user.uid,
      timestamp: new Date(),
      isDelivered: false,
      isRead: false,
      isSending: true,
    };

    setRealTimeMessages(prev => [...prev, tempMessage]);

    try {
      const result = await ApiDataService.sendMessage(selectedConversation.matchId, messageToSend);

      if (result.success) {
        Logger.info('Message sent successfully:', messageToSend);

        // Replace temp message with real message from server
        setRealTimeMessages(prev => {
          const tempIndex = prev.findIndex(msg => msg.id === tempMessage.id);
          if (tempIndex !== -1) {
            const newMessages = [...prev];
            newMessages[tempIndex] = { ...result.data, isSending: false };
            return newMessages;
          }
          // If temp message not found (maybe already replaced by WebSocket), just add if not exists
          const exists = prev.some(msg => msg.id === result.data.id);
          return exists
            ? prev
            : [...prev, { ...result.data, isSending: false }].sort(
                (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
              );
        });

        // Auto-scroll to top (newest message) after sending
        setTimeout(() => {
          flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        }, 100);
      } else {
        throw new Error(result.error);
      }
    } catch (e) {
      handleErrorWithToast(e, 'Failed to send message. Please try again.', showError);
      setMessageText(messageToSend); // Restore message text on error

      // Remove temp message on error
      setRealTimeMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
    } finally {
      setSendingMessage(false);
    }
  };

  const renderConversation = ({ item }) => (
    <MatchCard
      match={item}
      onPress={() => {
        // Mark conversation as viewed when selected

        ApiDataService.markMessagesAsRead(item.matchId);
        setSelectedConversation(item);
      }}
      onMessagePress={() => {
        // Mark conversation as viewed when selected
        ApiDataService.markMessagesAsRead(item.matchId);
        setSelectedConversation(item);
      }}
      showMessageButton={false}
      unreadCount={item.unreadCount}
      showLastMessage={true}
    />
  );

  const renderMessage = ({ item }) => {
    // Handle typing indicator as special message type
    if (item.isTyping) {
      return (
        <View style={styles.typingIndicatorMessage}>
          <View style={styles.typingBubble}>
            <Text style={styles.typingText}>
              {selectedConversation?.otherUser?.name || 'Someone'} is typing
            </Text>
            <View style={styles.typingDots}>
              <Animated.View style={[styles.typingDot, { opacity: typingAnim1 }]} />
              <Animated.View style={[styles.typingDot, { opacity: typingAnim2 }]} />
              <Animated.View style={[styles.typingDot, { opacity: typingAnim3 }]} />
            </View>
          </View>
        </View>
      );
    }

    const isOwnMessage = item.senderId === user.uid;
    const _isSending = item.status === 'sending';

    // Check if message has been read by the other user (for read receipts)
    const otherUserId = selectedConversation?.otherUserId;
    const _isRead = item.readBy && otherUserId && item.readBy.includes(otherUserId);

    return (
      <View
        style={[styles.messageContainer, isOwnMessage ? styles.ownMessage : styles.otherMessage]}
      >
        <View style={[styles.messageBubble, isOwnMessage ? styles.ownBubble : styles.otherBubble]}>
          <Text
            style={[
              styles.messageText,
              isOwnMessage ? styles.ownMessageText : styles.otherMessageText,
            ]}
          >
            {item.content || item.text}
          </Text>
        </View>

        {/* Timestamp and status */}
        <View
          style={[
            styles.messageFooter,
            isOwnMessage ? styles.ownMessageFooter : styles.otherMessageFooter,
          ]}
        >
          <Text
            style={[
              styles.messageTime,
              isOwnMessage ? styles.ownMessageTime : styles.otherMessageTime,
            ]}
          >
            {new Date(item.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>

          {/* Status indicator for own messages - Premium Feature */}
          {isOwnMessage && hasFeature(FEATURES.READ_RECEIPTS) && (
            <View style={styles.messageStatus}>
              {item.isSending ? (
                <Ionicons name="time-outline" size={12} color="#999" />
              ) : item.isRead ? (
                <Ionicons name="checkmark-done" size={12} color="#4ECDC4" />
              ) : item.isDelivered ? (
                <Ionicons name="checkmark-done" size={12} color="#999" />
              ) : (
                <Ionicons name="checkmark" size={12} color="#999" />
              )}
            </View>
          )}

          {/* Premium upgrade hint for read receipts */}
          {isOwnMessage && !hasFeature(FEATURES.READ_RECEIPTS) && (
            <TouchableOpacity
              style={styles.premiumHint}
              onPress={() => showError('Upgrade to Premium to see read receipts! 💎')}
            >
              <Ionicons name="diamond-outline" size={10} color="#FFD700" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (selectedConversation) {
    return (
      <ChatKeyboardWrapper>
        {/* Chat Header */}
        <View style={styles.chatHeader}>
          <TouchableOpacity onPress={() => setSelectedConversation(null)}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Image
            source={{
              uri: getUserProfilePhoto(selectedConversation.otherUser),
            }}
            style={styles.chatHeaderPhoto}
          />

          <View style={styles.chatHeaderInfo}>
            <View style={styles.chatHeaderNameContainer}>
              <Text style={styles.chatHeaderName}>
                {getUserDisplayName(selectedConversation.otherUser)}
              </Text>
              {hasFeature(FEATURES.PREMIUM) &&
                onlineUsers.has(selectedConversation.otherUser.id) && (
                  <View style={styles.onlineDot} />
                )}
            </View>
            <Text style={styles.chatHeaderStatus}>
              {hasFeature(FEATURES.PREMIUM) && onlineUsers.has(selectedConversation.otherUser.id)
                ? 'Online now'
                : typingUsers.length > 0
                  ? 'Typing...'
                  : 'Matched recently'}
            </Text>
          </View>
        </View>

        {/* Messages area - scrollable content */}
        <View style={styles.messagesContainer}>
          <FlatList
            ref={flatListRef}
            style={styles.messagesList}
            data={[
              ...(typingUsers.length > 0 ? [{ id: 'typing-indicator', isTyping: true }] : []),
              ...realTimeMessages.slice().reverse(),
            ]}
            renderItem={renderMessage}
            keyExtractor={(item, index) => {
              if (item.isTyping) return 'typing-indicator';
              if (item.id) return `msg-${item.id}`;
              return `fallback-${index}-${Date.now()}`;
            }}
            inverted={true}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToOffset({ offset: 0, animated: false })
            }
            onLayout={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: false })}
          />
        </View>

        {/* Input area - fixed at bottom with keyboard avoidance */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.messageInput}
            value={messageText}
            onChangeText={handleTextChange}
            placeholder="Type a message..."
            multiline
            maxLength={500}
            blurOnSubmit={false}
            returnKeyType="send"
            onSubmitEditing={sendMessage}
          />
          <TouchableOpacity
            style={[styles.sendButton, sendingMessage && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={sendingMessage}
          >
            <Ionicons name={sendingMessage ? 'hourglass' : 'send'} size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </ChatKeyboardWrapper>
    );
  }

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

const styles = StyleSheet.create({
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#FF6B6B',
  },
  chatHeaderPhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginLeft: 15,
    marginRight: 15,
  },
  chatHeaderInfo: {
    flex: 1,
  },
  chatHeaderNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chatHeaderName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginRight: 6,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ECDC4',
    borderWidth: 1,
    borderColor: '#fff',
  },
  chatHeaderStatus: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.8,
  },
  messagesContainer: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  messagesList: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
  },
  messageContainer: {
    marginBottom: 10,
  },
  ownMessage: {
    alignItems: 'flex-end',
  },
  otherMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 20,
  },
  ownBubble: {
    backgroundColor: '#FF6B6B',
    borderBottomRightRadius: 5,
  },
  otherBubble: {
    backgroundColor: '#e0e0e0',
    borderBottomLeftRadius: 5,
  },
  messageText: {
    fontSize: 16,
    marginBottom: 5,
  },
  ownMessageText: {
    color: '#fff',
  },
  otherMessageText: {
    color: '#333',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginHorizontal: 12,
  },
  messageTime: {
    fontSize: 11,
  },
  messageStatus: {
    marginLeft: 4,
  },
  ownMessageFooter: {
    justifyContent: 'flex-end',
  },
  otherMessageFooter: {
    justifyContent: 'flex-start',
  },
  ownMessageTime: {
    color: '#999',
    textAlign: 'right',
  },
  otherMessageTime: {
    color: '#999',
    textAlign: 'left',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    backgroundColor: theme.colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.light,
    marginBottom: 0,
  },
  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginRight: 10,
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#FF6B6B',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#CCC',
    opacity: 0.6,
  },
  // Typing indicator styles
  typingIndicatorMessage: {
    paddingHorizontal: 15,
    paddingVertical: 5,
    marginBottom: 5,
  },
  typingBubble: {
    backgroundColor: '#f0f0f0',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '70%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  typingText: {
    fontSize: 14,
    color: '#666',
    marginRight: 8,
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typingDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#999',
    marginHorizontal: 1,
  },
  // Removed static opacity styles - now handled by animation

  // Premium feature styles
  premiumHint: {
    marginLeft: 4,
    opacity: 0.7,
  },
});

export default MessagesScreen;
