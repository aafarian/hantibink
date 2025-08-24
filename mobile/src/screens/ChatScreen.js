import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Pressable,
  Modal,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useIsPremium } from '../contexts/FeatureFlagsContext';
import ApiDataService from '../services/ApiDataService';
import SocketService from '../services/SocketService';
import Logger from '../utils/logger';
import { getUserProfilePhoto, getUserDisplayName } from '../utils/profileHelpers';

const ChatScreen = ({ route, navigation }) => {
  const { match } = route.params;
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();
  const isPremium = useIsPremium();
  const insets = useSafeAreaInsets();

  // State
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [_selectedMessage, _setSelectedMessage] = useState(null);
  const [_showGifPicker, setShowGifPicker] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(null);
  const [onlineStatus, setOnlineStatus] = useState(false);

  // Refs
  const flatListRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const lastTapRef = useRef(null);
  const hasMarkedAsReadRef = useRef(false);

  // Animation values
  const typingDotsAnim = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  // Load messages on mount
  useEffect(() => {
    loadMessages();
    joinChatRoom();
    // Don't mark as read on mount - wait until we have messages

    return () => {
      leaveChatRoom();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.matchId]);

  // Load messages from API
  const loadMessages = async () => {
    try {
      setIsLoading(true);
      const loadedMessages = await ApiDataService.getMessages(match.matchId);
      setMessages(loadedMessages || []);

      // Only mark as read if there are messages from the other user
      if (loadedMessages?.some(msg => msg.senderId !== user.uid)) {
        markMessagesAsRead();
      }
    } catch (error) {
      Logger.error('Failed to load messages:', error);
      showError('Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  };

  // Join Socket.io room
  const joinChatRoom = () => {
    SocketService.joinMatchRoom(match.matchId);

    // Set up listeners
    const unsubscribeMessage = SocketService.onMessage((event, data) => {
      if (event === 'new-message' && data.matchId === match.matchId) {
        // Don't add our own messages via socket (they're already added optimistically)
        if (data.message?.senderId !== user.uid) {
          handleNewMessage(data);
        }
      } else if (event === 'message-reaction' && data.matchId === match.matchId) {
        handleMessageReaction(data);
      } else if (event === 'user-typing' && data.matchId === match.matchId) {
        handleUserTyping(data);
      } else if (event === 'messages-read' && data.matchId === match.matchId) {
        handleMessagesRead(data);
      }
    });

    // Check online status
    const unsubscribeOnline = SocketService.onUserStatus((userId, isOnline) => {
      if (userId === match.otherUser.id) {
        setOnlineStatus(isOnline);
      }
    });

    return () => {
      unsubscribeMessage();
      unsubscribeOnline();
    };
  };

  // Leave Socket.io room
  const leaveChatRoom = () => {
    SocketService.leaveMatchRoom(match.matchId);
  };

  // Mark messages as read (with debouncing to prevent multiple calls)
  const markMessagesAsRead = async () => {
    // Prevent duplicate calls
    if (hasMarkedAsReadRef.current) return;

    try {
      hasMarkedAsReadRef.current = true;
      await ApiDataService.markMessagesAsRead(match.matchId);

      // Reset after a delay to allow marking as read again later
      setTimeout(() => {
        hasMarkedAsReadRef.current = false;
      }, 2000);
    } catch (error) {
      Logger.error('Failed to mark messages as read:', error);
      hasMarkedAsReadRef.current = false;
    }
  };

  // Handle new incoming message
  const handleNewMessage = messageData => {
    // Transform the message data to match our format
    const transformedMessage = {
      id: messageData.message?.id || messageData.id,
      text: messageData.message?.content || messageData.content || messageData.text,
      senderId: messageData.message?.senderId || messageData.senderId,
      senderName: messageData.message?.senderName || messageData.senderName,
      createdAt: messageData.message?.timestamp || messageData.timestamp || messageData.createdAt,
      messageType: messageData.message?.messageType || messageData.messageType || 'TEXT',
      isRead: messageData.message?.isRead || messageData.isRead || false,
      isDelivered: messageData.message?.isDelivered || messageData.isDelivered || false,
    };

    setMessages(prev => {
      const exists = prev.some(msg => msg.id === transformedMessage.id);
      if (exists) return prev;
      return [...prev, transformedMessage];
    });

    // Mark as read only if it's from the other user
    if (transformedMessage.senderId !== user.uid) {
      markMessagesAsRead();
    }
  };

  // Handle message reaction
  const handleMessageReaction = reactionData => {
    setMessages(prev =>
      prev.map(msg =>
        msg.id === reactionData.messageId ? { ...msg, reactions: reactionData.reactions } : msg
      )
    );
  };

  // Handle typing indicator
  const handleUserTyping = typingData => {
    if (typingData.userId !== user.uid) {
      setOtherUserTyping(typingData.isTyping);
    }
  };

  // Handle messages read status
  const handleMessagesRead = () => {
    setMessages(prev =>
      prev.map(msg => ({
        ...msg,
        isRead: msg.senderId === user.uid ? true : msg.isRead,
      }))
    );
  };

  // Send text message
  const sendMessage = async () => {
    if (!messageText.trim() || isSending) return;

    const text = messageText.trim();
    setMessageText('');
    setIsSending(true);

    // Optimistic update
    const tempMessage = {
      id: `temp-${Date.now()}`,
      text,
      senderId: user.uid,
      senderName: user.displayName,
      createdAt: new Date().toISOString(),
      isTemp: true,
    };

    setMessages(prev => [...prev, tempMessage]);
    scrollToBottom();

    try {
      const result = await ApiDataService.sendMessage(match.matchId, text);

      // Replace temp message with real one
      setMessages(prev =>
        prev.map(msg => (msg.id === tempMessage.id ? { ...result.data, isTemp: false } : msg))
      );
    } catch (error) {
      Logger.error('Failed to send message:', error);
      showError('Failed to send message');

      // Remove temp message on error
      setMessages(prev => prev.filter(msg => msg.id !== tempMessage.id));
    } finally {
      setIsSending(false);
    }
  };

  // Send GIF
  const _sendGif = async gifUrl => {
    setShowGifPicker(false);
    setIsSending(true);

    try {
      await ApiDataService.sendGifMessage(match.matchId, gifUrl);
      showSuccess('GIF sent!');
    } catch (error) {
      Logger.error('Failed to send GIF:', error);
      showError('Failed to send GIF');
    } finally {
      setIsSending(false);
    }
  };

  // Handle typing
  const handleTypingChange = text => {
    setMessageText(text);

    // Notify typing start
    if (!isTyping && text.length > 0) {
      setIsTyping(true);
      SocketService.startTyping(match.matchId, user.uid, user.displayName);
    }

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      if (isTyping) {
        setIsTyping(false);
        SocketService.stopTyping(match.matchId, user.uid);
      }
    }, 1000);
  };

  // Double tap to react
  const handleDoubleTap = useCallback(message => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    if (lastTapRef.current && now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      // Double tap detected - add heart reaction
      addReaction(message.id, '❤️');
      lastTapRef.current = null;
    } else {
      lastTapRef.current = now;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Add reaction to message
  const addReaction = async (messageId, emoji) => {
    try {
      await ApiDataService.addMessageReaction(match.matchId, messageId, emoji);

      // Optimistic update
      setMessages(prev =>
        prev.map(msg => {
          if (msg.id === messageId) {
            const reactions = msg.reactions || {};
            const currentReaction = reactions[emoji] || [];

            if (currentReaction.includes(user.uid)) {
              // Remove reaction
              reactions[emoji] = currentReaction.filter(id => id !== user.uid);
            } else {
              // Add reaction
              reactions[emoji] = [...currentReaction, user.uid];
            }

            return { ...msg, reactions };
          }
          return msg;
        })
      );
    } catch (error) {
      Logger.error('Failed to add reaction:', error);
    }

    setShowReactionPicker(null);
  };

  // Scroll to bottom
  const scrollToBottom = () => {
    flatListRef.current?.scrollToEnd({ animated: true });
  };

  // Animate typing dots
  useEffect(() => {
    if (otherUserTyping) {
      const animations = typingDotsAnim.map((anim, index) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(index * 200),
            Animated.timing(anim, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0.3,
              duration: 400,
              useNativeDriver: true,
            }),
          ])
        )
      );

      Animated.parallel(animations).start();
    } else {
      typingDotsAnim.forEach(anim => anim.setValue(0));
    }
  }, [otherUserTyping, typingDotsAnim]);

  // Render message item
  const renderMessage = ({ item, index }) => {
    const isOwnMessage = item.senderId === user.uid;
    const showAvatar = index === 0 || messages[index - 1]?.senderId !== item.senderId;
    const isLastInGroup =
      index === messages.length - 1 || messages[index + 1]?.senderId !== item.senderId;

    return (
      <Pressable onPress={() => handleDoubleTap(item)} style={styles.messageWrapper}>
        <View style={[styles.messageRow, isOwnMessage && styles.ownMessageRow]}>
          {!isOwnMessage && showAvatar && (
            <Image
              source={{ uri: getUserProfilePhoto(match.otherUser) }}
              style={styles.messageAvatar}
            />
          )}
          {!isOwnMessage && !showAvatar && <View style={styles.avatarPlaceholder} />}

          <View style={[styles.messageBubbleContainer, isOwnMessage && styles.ownBubbleContainer]}>
            <TouchableOpacity
              onLongPress={() => setShowReactionPicker(item.id)}
              style={[
                styles.messageBubble,
                isOwnMessage ? styles.ownMessageBubble : styles.otherMessageBubble,
                item.isTemp && styles.tempMessage,
              ]}
            >
              {item.type === 'gif' ? (
                <Image source={{ uri: item.gifUrl }} style={styles.gifMessage} />
              ) : (
                <Text style={[styles.messageText, isOwnMessage && styles.ownMessageText]}>
                  {item.text || item.content || ''}
                </Text>
              )}
            </TouchableOpacity>

            {/* Reactions */}
            {item.reactions && Object.keys(item.reactions).length > 0 && (
              <View style={styles.reactionsContainer}>
                {Object.entries(item.reactions).map(
                  ([emoji, users]) =>
                    users.length > 0 && (
                      <TouchableOpacity
                        key={emoji}
                        style={styles.reactionBubble}
                        onPress={() => addReaction(item.id, emoji)}
                      >
                        <Text style={styles.reactionEmoji}>{emoji}</Text>
                        {users.length > 1 && (
                          <Text style={styles.reactionCount}>{users.length}</Text>
                        )}
                      </TouchableOpacity>
                    )
                )}
              </View>
            )}

            {/* Timestamp and read receipts for own messages */}
            {isOwnMessage && isLastInGroup && (
              <View style={styles.messageStatus}>
                <Text style={styles.messageTime}>
                  {item.createdAt
                    ? new Date(item.createdAt).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })
                    : ''}
                </Text>
                {isPremium && (
                  <>
                    {item.isRead ? (
                      <Ionicons
                        name="checkmark-done"
                        size={14}
                        color="#4CAF50"
                        style={styles.readIcon}
                      />
                    ) : (
                      <Ionicons name="checkmark" size={14} color="#999" style={styles.readIcon} />
                    )}
                  </>
                )}
              </View>
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  // Render typing indicator
  const renderTypingIndicator = () => {
    if (!otherUserTyping) return null;

    return (
      <View style={[styles.messageRow, styles.typingRow]}>
        <Image
          source={{ uri: getUserProfilePhoto(match.otherUser) }}
          style={styles.messageAvatar}
        />
        <View style={styles.typingBubble}>
          <View style={styles.typingDots}>
            {typingDotsAnim.map((anim, index) => (
              <Animated.View key={index} style={[styles.typingDot, { opacity: anim }]} />
            ))}
          </View>
        </View>
      </View>
    );
  };

  // Reaction picker modal
  const renderReactionPicker = () => {
    const reactions = ['❤️', '😂', '😍', '😮', '😢', '👍', '🔥', '💯'];

    return (
      <Modal
        visible={showReactionPicker !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReactionPicker(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowReactionPicker(null)}>
          <View style={styles.reactionPicker}>
            {reactions.map(emoji => (
              <TouchableOpacity
                key={emoji}
                style={styles.reactionOption}
                onPress={() => addReaction(showReactionPicker, emoji)}
              >
                <Text style={styles.reactionOptionEmoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      {/* Status bar background for Android */}
      {Platform.OS === 'android' && (
        <View
          style={{
            height: StatusBar.currentHeight,
            backgroundColor: '#fff',
          }}
        />
      )}

      {/* Header */}
      <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? insets.top : 0 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerProfile}
          onPress={() => {
            /* View profile */
          }}
        >
          <Image
            source={{ uri: getUserProfilePhoto(match.otherUser) }}
            style={styles.headerAvatar}
          />
          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>{getUserDisplayName(match.otherUser)}</Text>
            <View style={styles.statusRow}>
              {isPremium && onlineStatus ? (
                <>
                  <View style={styles.onlineDot} />
                  <Text style={styles.statusText}>Online</Text>
                </>
              ) : otherUserTyping ? (
                <Text style={styles.statusText}>Typing...</Text>
              ) : (
                <Text style={styles.statusText}>Matched recently</Text>
              )}
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuButton}>
          <Ionicons name="ellipsis-vertical" size={20} color="#333" />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#E91E63" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={scrollToBottom}
            onLayout={scrollToBottom}
            ListFooterComponent={renderTypingIndicator}
            inverted={false}
            keyboardShouldPersistTaps="handled"
            maintainVisibleContentPosition={{
              minIndexForVisible: 0,
              autoscrollToTopThreshold: 100,
            }}
          />
        )}

        {/* Input */}
        <View
          style={[
            styles.inputContainer,
            { paddingBottom: Platform.OS === 'android' ? 8 : Math.max(insets.bottom, 8) },
          ]}
        >
          <TouchableOpacity style={styles.attachButton} onPress={() => setShowGifPicker(true)}>
            <Text style={styles.gifButtonText}>GIF</Text>
          </TouchableOpacity>

          <TextInput
            style={styles.messageInput}
            placeholder="Type a message..."
            value={messageText}
            onChangeText={handleTypingChange}
            multiline
            maxLength={500}
          />

          <TouchableOpacity
            style={[
              styles.sendButton,
              (!messageText.trim() || isSending) && styles.sendButtonDisabled,
            ]}
            onPress={sendMessage}
            disabled={!messageText.trim() || isSending}
          >
            <Ionicons
              name="send"
              size={20}
              color={messageText.trim() && !isSending ? '#E91E63' : '#999'}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {renderReactionPicker()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    marginRight: 12,
  },
  headerProfile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginRight: 6,
  },
  statusText: {
    fontSize: 13,
    color: '#666',
  },
  menuButton: {
    padding: 8,
  },
  chatContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesList: {
    paddingVertical: 16,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  messageWrapper: {
    marginVertical: 2,
  },
  messageRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    alignItems: 'flex-end',
  },
  ownMessageRow: {
    flexDirection: 'row-reverse',
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  avatarPlaceholder: {
    width: 32,
    marginRight: 8,
  },
  messageBubbleContainer: {
    maxWidth: '75%',
    alignItems: 'flex-start',
  },
  ownBubbleContainer: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 2,
  },
  ownMessageBubble: {
    backgroundColor: '#E91E63',
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: '#f0f0f0',
    borderBottomLeftRadius: 4,
  },
  tempMessage: {
    opacity: 0.7,
  },
  messageText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#fff',
  },
  gifMessage: {
    width: 200,
    height: 150,
    borderRadius: 12,
  },
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    marginLeft: 8,
  },
  reactionBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 4,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  messageStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    paddingHorizontal: 8,
  },
  messageTime: {
    fontSize: 11,
    color: '#999',
  },
  readIcon: {
    marginLeft: 4,
  },
  typingRow: {
    marginBottom: 8,
  },
  typingBubble: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderBottomLeftRadius: 4,
  },
  typingDots: {
    flexDirection: 'row',
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#666',
    marginHorizontal: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  attachButton: {
    paddingBottom: 10,
    paddingRight: 8,
    justifyContent: 'center',
  },
  gifButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#666',
  },
  messageInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    fontSize: 15,
  },
  sendButton: {
    paddingLeft: 12,
    paddingBottom: 10,
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactionPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    maxWidth: 280,
  },
  reactionOption: {
    padding: 8,
    margin: 4,
  },
  reactionOptionEmoji: {
    fontSize: 28,
  },
});

export default ChatScreen;
