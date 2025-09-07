import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  ActivityIndicator,
  StatusBar,
  Vibration,
  Keyboard,
  BackHandler,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useIsPremium } from '../contexts/FeatureFlagsContext';
import ApiDataService from '../services/ApiDataService';
import SocketService from '../services/SocketService';
import Logger from '../utils/logger';
import { getUserProfilePhoto, getUserDisplayName } from '../utils/profileHelpers';
import ProfileBottomSheet from '../components/shared/ProfileBottomSheet';

const ChatScreen = ({ route, navigation }) => {
  const { match } = route.params;
  const { user } = useAuth();
  const { showError, showSuccess } = useToast();
  const isPremium = useIsPremium();
  const _insets = useSafeAreaInsets();

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
  const [_longPressMessage, setLongPressMessage] = useState(null);
  const [_keyboardVisible, setKeyboardVisible] = useState(false);

  // Refs
  const flatListRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const lastTapRef = useRef(null);
  const hasMarkedAsReadRef = useRef(false);
  const profileSheetRef = useRef(null);
  const hasInitialScrollRef = useRef(false);

  // Animation values
  const typingDotsAnim = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  // Memoize reversed messages to avoid creating new array on every render
  const reversedMessages = useMemo(() => [...messages].reverse(), [messages]);

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

  // Track keyboard state and handle Android back button
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
    });

    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });

    // Handle Android back button for reaction picker
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showReactionPicker !== null) {
        Logger.info('Back button pressed, closing reaction picker');
        setShowReactionPicker(null);
        setLongPressMessage(null);
        return true; // Prevent default back behavior
      }
      return false; // Let default back behavior happen
    });

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
      backHandler.remove();
    };
  }, [showReactionPicker]);

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
      // Scroll to bottom when receiving new message
      setTimeout(() => scrollToBottom(true), 100);
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
    // Scroll to bottom when sending a message
    setTimeout(() => scrollToBottom(true), 100);

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
    Logger.info(`Adding reaction ${emoji} to message ${messageId}`);

    // For now, just handle reactions locally since API endpoint doesn't exist yet
    // TODO: Uncomment when API endpoint is implemented
    // try {
    //   await ApiDataService.addMessageReaction(match.matchId, messageId, emoji);
    // } catch (error) {
    //   Logger.error('Failed to add reaction:', error);
    // }

    // Optimistic update (now it's the actual update)
    setMessages(prev =>
      prev.map(msg => {
        if (msg.id === messageId) {
          const reactions = msg.reactions || {};
          const currentReaction = reactions[emoji] || [];

          if (currentReaction.includes(user.uid)) {
            // Remove reaction
            reactions[emoji] = currentReaction.filter(id => id !== user.uid);
            if (reactions[emoji].length === 0) {
              delete reactions[emoji];
            }
          } else {
            // Add reaction
            reactions[emoji] = [...currentReaction, user.uid];
          }

          return { ...msg, reactions };
        }
        return msg;
      })
    );

    setShowReactionPicker(null);
    setLongPressMessage(null);
  };

  // Scroll to bottom with delay for keyboard animation (inverted list scrolls to index 0)
  const scrollToBottom = (animated = true, delay = 100) => {
    setTimeout(() => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated });
    }, delay);
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

  // Handle long press on message
  const handleMessageLongPress = useCallback(message => {
    Logger.info('Long press triggered for message:', message.id);
    // Trigger haptic feedback
    Vibration.vibrate(10);
    setLongPressMessage(message);
    setShowReactionPicker(message.id);
    Logger.info('Reaction picker should be visible for message:', message.id);
  }, []);

  // Render message item
  const renderMessage = ({ item, index }) => {
    const isOwnMessage = item.senderId === user.uid;
    const showAvatar = index === 0 || reversedMessages[index - 1]?.senderId !== item.senderId;
    // For inverted list, the last message in a group is when the next message (index - 1) is from a different sender
    const isLastInGroup = index === 0 || reversedMessages[index - 1]?.senderId !== item.senderId;

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
            <Pressable
              onLongPress={() => handleMessageLongPress(item)}
              delayLongPress={500}
              style={({ pressed }) => [
                styles.messageBubble,
                isOwnMessage ? styles.ownMessageBubble : styles.otherMessageBubble,
                item.isTemp && styles.tempMessage,
                pressed && styles.messageBubblePressed,
              ]}
            >
              {item.type === 'gif' ? (
                <Image source={{ uri: item.gifUrl }} style={styles.gifMessage} />
              ) : (
                <Text style={[styles.messageText, isOwnMessage && styles.ownMessageText]}>
                  {item.text || item.content || ''}
                </Text>
              )}
            </Pressable>

            {/* Reactions - positioned overlapping the message bubble */}
            {item.reactions && Object.keys(item.reactions).length > 0 && (
              <View
                style={[
                  styles.reactionsContainer,
                  isOwnMessage ? styles.ownReactionsContainer : styles.otherReactionsContainer,
                ]}
              >
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

  // Reaction picker overlay (no Modal)
  const renderReactionPicker = () => {
    const reactions = ['❤️', '😂', '😍', '😮', '😢', '👍', '🔥', '💯'];

    Logger.info('renderReactionPicker called, showReactionPicker:', showReactionPicker);

    if (showReactionPicker === null) {
      return null;
    }

    return (
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          elevation: 999,
        }}
      >
        <Pressable
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
          }}
          onPress={() => {
            Logger.info('Overlay pressed, closing modal');
            setShowReactionPicker(null);
            setLongPressMessage(null);
          }}
        />
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#fff',
            borderRadius: 16,
            padding: 16,
            width: 280,
            elevation: 10,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
          }}
        >
          {reactions.map(emoji => (
            <TouchableOpacity
              key={emoji}
              style={styles.reactionOption}
              onPress={() => {
                Logger.info('Reaction selected:', emoji);
                Vibration.vibrate(5);
                addReaction(showReactionPicker, emoji);
              }}
            >
              <Text style={styles.reactionOptionEmoji}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const WrapperComponent = Platform.OS === 'ios' ? SafeAreaView : View;

  return (
    <>
      <StatusBar backgroundColor="#FF6B6B" barStyle="light-content" />
      {Platform.OS === 'android' && (
        <View style={{ height: StatusBar.currentHeight, backgroundColor: '#FF6B6B' }} />
      )}
      <WrapperComponent style={styles.wrapper}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : StatusBar.currentHeight}
          enabled={true}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.headerProfile}
              onPress={() => {
                profileSheetRef.current?.open();
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
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#E91E63" />
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={reversedMessages}
              renderItem={renderMessage}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.messagesList}
              ListHeaderComponent={renderTypingIndicator}
              inverted={true}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              maintainVisibleContentPosition={{
                minIndexForVisible: 0,
                autoscrollToTopThreshold: 10,
              }}
              style={styles.chatContainer}
              onContentSizeChange={() => {
                // Scroll to bottom on initial load only
                if (!hasInitialScrollRef.current && messages.length > 0) {
                  hasInitialScrollRef.current = true;
                  setTimeout(() => {
                    flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
                  }, 100);
                }
              }}
            />
          )}

          {/* Input */}
          <View style={styles.inputContainer}>
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

          {/* Profile Bottom Sheet - Always rendered but hidden */}
          <ProfileBottomSheet
            ref={profileSheetRef}
            profile={match.otherUser}
            showActions={false}
            onClose={() => {}}
          />
        </KeyboardAvoidingView>

        {/* Render reaction picker as overlay inside wrapper */}
        {renderReactionPicker()}
      </WrapperComponent>
    </>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#fff', // White background
  },
  container: {
    flex: 1,
    backgroundColor: '#fff', // White background for chat content
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
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
  },
  messageWrapper: {
    marginVertical: 2,
    marginBottom: 16, // Extra space for reactions
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
    position: 'relative',
  },
  ownBubbleContainer: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    marginBottom: 2,
    minHeight: 40,
    justifyContent: 'center',
    maxWidth: '100%',
  },
  ownMessageBubble: {
    backgroundColor: '#FF6B6B',
    borderTopRightRadius: 24,
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 8,
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  otherMessageBubble: {
    backgroundColor: '#F0F0F3',
    borderTopRightRadius: 24,
    borderTopLeftRadius: 24,
    borderBottomRightRadius: 24,
    borderBottomLeftRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  tempMessage: {
    opacity: 0.7,
  },
  messageBubblePressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  messageText: {
    fontSize: 16,
    color: '#1c1c1e',
    lineHeight: 22,
    letterSpacing: 0.2,
    fontWeight: '400',
  },
  ownMessageText: {
    color: '#FFFFFF',
    fontWeight: '400',
  },
  gifMessage: {
    width: 200,
    height: 150,
    borderRadius: 12,
  },
  reactionsContainer: {
    position: 'absolute',
    bottom: -2,
    left: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    zIndex: 1,
    gap: 4,
  },
  ownReactionsContainer: {
    // All reactions on the left now
  },
  otherReactionsContainer: {
    // All reactions on the left now
  },
  reactionBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  reactionEmoji: {
    fontSize: 16,
  },
  reactionCount: {
    fontSize: 12,
    color: '#505050',
    marginLeft: 4,
    fontWeight: '600',
  },
  messageStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    paddingHorizontal: 4,
  },
  messageTime: {
    fontSize: 11,
    color: '#a0a0a0',
    fontWeight: '400',
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
    paddingTop: 4,
    paddingBottom: 4,
    backgroundColor: '#fff',
  },
  attachButton: {
    paddingBottom: 4,
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
    paddingBottom: 4,
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
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
