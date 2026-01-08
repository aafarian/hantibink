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
  Keyboard,
  BackHandler,
  AppState,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useIsPremium } from '../contexts/FeatureFlagsContext';
import { usePhotoViewer } from '../contexts/PhotoViewerContext';
import ApiDataService from '../services/ApiDataService';
import SocketService from '../services/SocketService';
import Logger from '../utils/logger';
import { clearNotificationForMatch } from '../utils/notifications';
import { getUserProfilePhoto, getUserDisplayName } from '../utils/profileHelpers';
import { isUserOnline } from '../utils/userHelpers';
import { formatLastSeen } from '../utils/timeHelpers';
import ProfileBottomSheet from '../components/shared/ProfileBottomSheet';
import GifPicker from '../components/GifPicker';
import ConfirmationModal from '../components/ConfirmationModal';
import ReportReasonModal from '../components/ReportReasonModal';
import EmojiPicker from 'rn-emoji-keyboard';
import {
  trackChatOpened,
  trackMessageSent,
  trackGifSent,
  trackVoiceMessageSent,
} from '../utils/analytics';
import { uploadAudioToFirebase } from '../utils/audioUpload';
import AudioMessage from '../components/AudioMessage';
import AudioRecorder from '../components/AudioRecorder';
import { theme } from '../styles/theme';
import BottomSheet, { BottomSheetScrollView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';

const ChatScreen = ({ route, navigation }) => {
  const { match } = route.params;
  const { user } = useAuth();
  const { showError, showInfo, showSuccess } = useToast();
  const isPremium = useIsPremium();
  const { openPhotoViewer } = usePhotoViewer();
  const _insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  // State
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [_selectedMessage, _setSelectedMessage] = useState(null);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(null);
  const [onlineStatus, setOnlineStatus] = useState(false);
  const [lastSeen, setLastSeen] = useState(null);
  const [_longPressMessage, setLongPressMessage] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [_keyboardVisible, setKeyboardVisible] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [tappedMessageId, setTappedMessageId] = useState(null);
  const [isProfileSheetOpen, setIsProfileSheetOpen] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [reactionsDetailMessageId, setReactionsDetailMessageId] = useState(null);
  const [reactionsTab, setReactionsTab] = useState('all'); // 'all', 'you', 'them'

  // Moderation modals state
  const [showMuteConfirm, setShowMuteConfirm] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showUnmatchConfirm, setShowUnmatchConfirm] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);

  // Refs
  const flatListRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const lastTapRef = useRef(null);
  const hasMarkedAsReadRef = useRef(false);
  const profileSheetRef = useRef(null);
  const hasInitialScrollRef = useRef(false);
  const swipeableRefs = useRef({});
  const sentMessageIdsRef = useRef(new Set()); // Track IDs of messages we sent to avoid socket duplicates
  const sentMessageTimeoutsRef = useRef(new Map()); // Track cleanup timeouts for sentMessageIds
  const scrollButtonAnim = useRef(new Animated.Value(0)).current;
  const rightIconAnim = useRef(new Animated.Value(1)).current; // For icon transitions
  const isFocusedRef = useRef(isFocused); // Track focus state for callbacks
  const appStateRef = useRef(AppState.currentState); // Track app foreground/background state

  // Max number of message IDs to track (prevents unbounded growth)
  const MAX_SENT_MESSAGE_IDS = 100;
  const reactionsSheetRef = useRef(null);
  const inputRef = useRef(null);

  // Snap points for reactions bottom sheet - fixed height for consistency
  const reactionsSnapPoints = useMemo(() => [350], []);

  // Animation values
  const typingDotsAnim = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;
  const shockwaveScale = useRef(new Animated.Value(1)).current;
  const shockwaveOpacity = useRef(new Animated.Value(0.6)).current;

  // Shockwave animation for online dot
  useEffect(() => {
    let shockwaveAnimation;
    if (onlineStatus && isPremium) {
      shockwaveAnimation = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(shockwaveScale, {
              toValue: 2.2,
              duration: 1500,
              useNativeDriver: true,
            }),
            Animated.timing(shockwaveScale, {
              toValue: 1,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(shockwaveOpacity, {
              toValue: 0,
              duration: 1500,
              useNativeDriver: true,
            }),
            Animated.timing(shockwaveOpacity, {
              toValue: 0.6,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      shockwaveAnimation.start();
    } else {
      shockwaveScale.setValue(1);
      shockwaveOpacity.setValue(0.6);
    }
    return () => {
      if (shockwaveAnimation) {
        shockwaveAnimation.stop();
      }
    };
  }, [onlineStatus, isPremium, shockwaveScale, shockwaveOpacity]);

  // Keep focus ref in sync for callbacks
  useEffect(() => {
    isFocusedRef.current = isFocused;
  }, [isFocused]);

  // Memoize reversed messages to avoid creating new array on every render
  const reversedMessages = useMemo(() => [...messages].reverse(), [messages]);

  // Helper to track sent message IDs with max size limit and proper cleanup
  const trackSentMessageId = useCallback(messageId => {
    if (!messageId) return;

    // Add to set
    sentMessageIdsRef.current.add(messageId);

    // Enforce max size by removing oldest entries (FIFO-style)
    if (sentMessageIdsRef.current.size > MAX_SENT_MESSAGE_IDS) {
      const idsArray = Array.from(sentMessageIdsRef.current);
      const idsToRemove = idsArray.slice(0, idsArray.length - MAX_SENT_MESSAGE_IDS);
      idsToRemove.forEach(id => {
        sentMessageIdsRef.current.delete(id);
        // Also clear associated timeout
        const timeoutId = sentMessageTimeoutsRef.current.get(id);
        if (timeoutId) {
          clearTimeout(timeoutId);
          sentMessageTimeoutsRef.current.delete(id);
        }
      });
    }

    // Schedule cleanup after 10 seconds
    const timeoutId = setTimeout(() => {
      sentMessageIdsRef.current.delete(messageId);
      sentMessageTimeoutsRef.current.delete(messageId);
    }, 10000);

    sentMessageTimeoutsRef.current.set(messageId, timeoutId);
  }, []);

  // Cleanup sent message tracking on unmount
  useEffect(() => {
    // Capture refs for cleanup
    const timeoutsMap = sentMessageTimeoutsRef.current;
    const idsSet = sentMessageIdsRef.current;

    return () => {
      // Clear all pending timeouts
      timeoutsMap.forEach(timeoutId => clearTimeout(timeoutId));
      timeoutsMap.clear();
      idsSet.clear();
    };
  }, []);

  // Load messages on mount
  useEffect(() => {
    loadMessages();
    joinChatRoom();
    // Clear any pending notification for this conversation
    clearNotificationForMatch(match.matchId);
    // Track chat opened in analytics
    trackChatOpened('matches_list');
    // Don't mark as read on mount - wait until we have messages

    return () => {
      leaveChatRoom();
      // Clear typing timeout on unmount
      if (otherUserTypingTimeoutRef.current) {
        clearTimeout(otherUserTypingTimeoutRef.current);
        otherUserTypingTimeoutRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.matchId]);

  // Initialize online status from match data
  useEffect(() => {
    if (match.otherUser?.lastActive) {
      const online = isUserOnline(match.otherUser.lastActive);
      setOnlineStatus(online);
      if (!online) {
        setLastSeen(new Date(match.otherUser.lastActive));
      }
    }
  }, [match.otherUser?.lastActive]);

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

  // Animate right icon when switching between mic and send
  const showSendButton = messageText.trim() && !isRecording;
  const prevShowSendButtonRef = useRef(showSendButton);

  useEffect(() => {
    if (prevShowSendButtonRef.current !== showSendButton) {
      // Quick scale down and up for a subtle transition
      Animated.sequence([
        Animated.timing(rightIconAnim, {
          toValue: 0.8,
          duration: 50,
          useNativeDriver: true,
        }),
        Animated.spring(rightIconAnim, {
          toValue: 1,
          friction: 5,
          tension: 100,
          useNativeDriver: true,
        }),
      ]).start();
      prevShowSendButtonRef.current = showSendButton;
    }
  }, [showSendButton, rightIconAnim]);

  // Load messages from API
  const loadMessages = async () => {
    try {
      setIsLoading(true);
      const loadedMessages = await ApiDataService.getMessages(match.matchId);

      // Filter out any messages without valid IDs and normalize the data
      const validMessages = (loadedMessages || [])
        .filter(msg => {
          if (!msg.id) {
            Logger.warn('Message without ID found:', msg);
            return false;
          }
          return true;
        })
        .map(msg => ({
          ...msg,
          // Normalize timestamp field - API returns 'timestamp', we use 'createdAt' internally
          createdAt: msg.timestamp || msg.createdAt,
        }));

      setMessages(validMessages);

      // Only mark as read if there are messages from the other user
      if (validMessages.some(msg => msg.senderId !== user.uid)) {
        markMessagesAsRead();
      }
    } catch (error) {
      Logger.error('Failed to load messages:', error);
      showError('Failed to load messages', { error });
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
        // Use String() to handle potential type mismatches
        const messageSenderId = String(data.message?.senderId || '');
        const currentUserId = String(user.uid || '');
        const messageId = data.message?.id;

        // Skip if it's our own message OR if we already added this message (via API response)
        if (messageSenderId === currentUserId || sentMessageIdsRef.current.has(messageId)) {
          Logger.info(`📩 Skipping own/duplicate message: ${messageId}`);
          return;
        }
        handleNewMessage(data);
      } else if (event === 'message-reaction' && data.matchId === match.matchId) {
        handleMessageReaction(data);
      } else if (event === 'user-typing' && data.matchId === match.matchId) {
        handleUserTyping(data);
      } else if (event === 'messages-read' && data.matchId === match.matchId) {
        handleMessagesRead(data);
      }
    });

    // Check online status
    const unsubscribeOnline = SocketService.onUserStatus((userId, isOnline, timestamp) => {
      if (userId === match.otherUser.id) {
        setOnlineStatus(isOnline);
        if (!isOnline && timestamp) {
          setLastSeen(new Date(timestamp));
        }
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

  // Mark messages as read when returning from background while screen is focused
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      const previousState = appStateRef.current;
      appStateRef.current = nextAppState;

      // If returning to foreground while this screen is focused, mark messages as read
      if (
        previousState.match(/inactive|background/) &&
        nextAppState === 'active' &&
        isFocusedRef.current
      ) {
        markMessagesAsRead();
      }
    });
    return () => subscription?.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.matchId]);

  // Handle new incoming message
  const handleNewMessage = messageData => {
    // Transform the message data to match our format
    const msg = messageData.message || messageData;

    // Validate message has an ID
    if (!msg.id) {
      Logger.warn('Received message without ID, skipping:', msg);
      return;
    }

    const transformedMessage = {
      id: msg.id,
      text: msg.content || msg.text,
      content: msg.content,
      mediaUrl: msg.mediaUrl,
      senderId: msg.senderId,
      senderName: msg.senderName,
      createdAt: msg.timestamp || msg.createdAt,
      messageType: msg.messageType || 'TEXT',
      isRead: msg.isRead || false,
      isDelivered: msg.isDelivered || false,
      reactions: msg.reactions || {},
      replyTo: msg.replyTo || null,
    };

    setMessages(prev => {
      const exists = prev.some(m => m.id === transformedMessage.id);
      if (exists) return prev;
      // Scroll to bottom when receiving new message
      setTimeout(() => scrollToBottom(true), 100);
      return [...prev, transformedMessage];
    });

    // Mark as read only if it's from the other user AND screen is focused AND app is in foreground
    const isAppActive = appStateRef.current === 'active';
    if (transformedMessage.senderId !== user.uid && isFocusedRef.current && isAppActive) {
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

  // Ref for typing timeout (auto-clear if no stop event received)
  const otherUserTypingTimeoutRef = useRef(null);

  // Handle typing indicator with auto-clear timeout
  const handleUserTyping = typingData => {
    if (typingData.userId !== user.uid) {
      // Clear existing timeout
      if (otherUserTypingTimeoutRef.current) {
        clearTimeout(otherUserTypingTimeoutRef.current);
        otherUserTypingTimeoutRef.current = null;
      }

      setOtherUserTyping(typingData.isTyping);

      // If user started typing, set a timeout to auto-clear after 5 seconds
      // This prevents stuck typing indicators if stop event is missed
      if (typingData.isTyping) {
        otherUserTypingTimeoutRef.current = setTimeout(() => {
          setOtherUserTyping(false);
          otherUserTypingTimeoutRef.current = null;
        }, 5000);
      }
    }
  };

  // Handle messages read status
  const handleMessagesRead = useCallback(
    data => {
      // Only update if the OTHER user read our messages
      // (readByUserId is the user who read, so it should be the other user, not us)
      if (data?.readByUserId && data.readByUserId !== user.uid) {
        setMessages(prev =>
          prev.map(msg => {
            // Mark ALL our messages as read (including temp - we'll preserve this during replacement)
            if (msg.senderId === user.uid) {
              return { ...msg, isRead: true };
            }
            return msg;
          })
        );
      }
    },
    [user.uid]
  );

  // Core message sending function (handles both text and GIF)
  const sendMessageCore = async ({
    content,
    messageType,
    mediaUrl = null,
    metadata = null,
    replyToData = null,
  }) => {
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Build temp message for optimistic update
    const tempMessage = {
      id: tempId,
      content,
      text: messageType === 'TEXT' ? content : undefined,
      messageType,
      mediaUrl,
      metadata,
      senderId: user.uid,
      senderName: user.displayName,
      createdAt: new Date().toISOString(),
      isTemp: true,
      isRead: false, // Not read yet - other user hasn't seen it
      isDelivered: false, // Not delivered until API confirms
      reactions: {},
      replyTo: replyToData,
    };

    // Add to messages immediately
    setMessages(prev => [...prev, tempMessage]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => scrollToBottom(true), 100);

    try {
      const apiPayload = {
        content,
        messageType,
        ...(mediaUrl && { mediaUrl }),
        ...(metadata && { metadata }),
        ...(replyToData && { replyToId: replyToData.id }),
      };

      const sentMessage = await ApiDataService.sendMessage(match.matchId, apiPayload);

      if (!sentMessage?.id) {
        Logger.error(`API returned ${messageType} message without ID:`, sentMessage);
        throw new Error('Invalid message response from server');
      }

      trackSentMessageId(sentMessage.id);

      // Track message sent in analytics
      if (messageType === 'GIF') {
        trackGifSent();
      } else {
        trackMessageSent(messageType.toLowerCase());
      }

      // Replace temp message with real one
      setMessages(prev =>
        prev.map(msg =>
          msg.id === tempId
            ? {
                ...sentMessage,
                senderId: user.uid,
                isTemp: false,
                isDelivered: true, // Delivered once API confirms
                // Preserve read status: if temp was already marked read (via socket), keep it
                // Otherwise use server value or default to false
                isRead: msg.isRead || sentMessage.isRead || false,
                ...(mediaUrl && { mediaUrl }),
              }
            : msg
        )
      );
    } catch (error) {
      Logger.error(`Failed to send ${messageType.toLowerCase()}:`, error);
      showError(`Failed to send ${messageType === 'GIF' ? 'GIF' : 'message'}`, { error });
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
    }
  };

  // Send text message
  const sendMessage = async () => {
    if (!messageText.trim() || isSending) return;

    const text = messageText.trim();
    const currentReplyTo = replyTo;

    // Clear inputs immediately
    setMessageText('');
    setReplyTo(null);
    setIsSending(true);

    // Stop typing indicator when sending
    if (isTyping) {
      setIsTyping(false);
      SocketService.stopTyping(match.matchId, user.uid);
    }
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    // Build replyTo data if replying
    const replyToData = currentReplyTo
      ? {
          id: currentReplyTo.id,
          content: currentReplyTo.content || currentReplyTo.text,
          messageType: currentReplyTo.messageType || 'TEXT',
          senderId: currentReplyTo.senderId,
          senderName:
            currentReplyTo.senderId === user.uid
              ? user.displayName
              : getUserDisplayName(match.otherUser),
        }
      : null;

    await sendMessageCore({ content: text, messageType: 'TEXT', replyToData });
    setIsSending(false);
  };

  // Send GIF
  const sendGif = async gifUrl => {
    setShowGifPicker(false);
    setIsSending(true);

    await sendMessageCore({ content: gifUrl, messageType: 'GIF', mediaUrl: gifUrl });
    setIsSending(false);
  };

  // Send Audio (voice message)
  const sendAudio = async (audioUri, durationMs, waveform = null) => {
    Logger.info(`>>> sendAudio CALLED at ${Date.now()}`);
    try {
      setIsUploadingAudio(true);

      Logger.info(
        `sendAudio received waveform: ${waveform ? 'yes' : 'no'}, length: ${waveform?.length}`
      );
      if (waveform) {
        Logger.info(`sendAudio waveform sample: ${JSON.stringify(waveform.slice(0, 5))}`);
      }

      // Upload audio to Firebase Storage
      const audioUrl = await uploadAudioToFirebase(audioUri, user.uid);

      const metadata = waveform ? JSON.stringify({ waveform, durationMs }) : null;

      // Send the message with waveform data
      await sendMessageCore({
        content: 'Voice message',
        messageType: 'AUDIO',
        mediaUrl: audioUrl,
        metadata,
      });

      // Track analytics
      trackVoiceMessageSent(Math.round(durationMs / 1000));

      Logger.info('Voice message sent successfully');
    } catch (error) {
      Logger.error('Failed to send voice message:', error);
      showError('Failed to send voice message', { error });
    } finally {
      setIsUploadingAudio(false);
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

  // Add reaction to message
  const addReaction = async (messageId, emoji) => {
    Logger.info(`Adding reaction ${emoji} to message ${messageId}`);

    // Optimistic update first
    setMessages(prev =>
      prev.map(msg => {
        if (msg.id === messageId) {
          const reactions = { ...(msg.reactions || {}) };
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

    // Call API to persist reaction
    try {
      await ApiDataService.addMessageReaction(match.matchId, messageId, emoji);
    } catch (error) {
      Logger.error('Failed to add reaction:', error);
      // Revert optimistic update on error
      setMessages(prev =>
        prev.map(msg => {
          if (msg.id === messageId) {
            const reactions = { ...(msg.reactions || {}) };
            const currentReaction = reactions[emoji] || [];

            // Reverse the action
            if (currentReaction.includes(user.uid)) {
              reactions[emoji] = currentReaction.filter(id => id !== user.uid);
              if (reactions[emoji].length === 0) {
                delete reactions[emoji];
              }
            } else {
              reactions[emoji] = [...currentReaction, user.uid];
            }

            return { ...msg, reactions };
          }
          return msg;
        })
      );
    }
  };

  // Scroll to bottom with delay for keyboard animation (inverted list scrolls to index 0)
  const scrollToBottom = (animated = true, delay = 100) => {
    setTimeout(() => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated });
    }, delay);
  };

  // Handle scroll to show/hide scroll-to-bottom button
  const handleScroll = useCallback(
    event => {
      const offsetY = event.nativeEvent.contentOffset.y;
      // Show button when scrolled up more than 200px (inverted list, so > 200 means scrolled up)
      const shouldShow = offsetY > 200;

      if (shouldShow !== showScrollButton) {
        setShowScrollButton(shouldShow);
        Animated.spring(scrollButtonAnim, {
          toValue: shouldShow ? 1 : 0,
          useNativeDriver: true,
          tension: 50,
          friction: 7,
        }).start();
      }
    },
    [showScrollButton, scrollButtonAnim]
  );

  // Scroll to a specific message (for tapping on quoted reply)
  const scrollToMessage = useCallback(
    messageId => {
      const index = reversedMessages.findIndex(m => m.id === messageId);
      if (index !== -1 && flatListRef.current) {
        flatListRef.current.scrollToIndex({
          index,
          animated: true,
          viewPosition: 0.5, // Center the message
        });
        // Briefly highlight the message
        setTappedMessageId(messageId);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setTimeout(() => setTappedMessageId(null), 1500);
      }
    },
    [reversedMessages]
  );

  // Handle tap on message to show timestamp
  const handleMessageTap = useCallback(
    message => {
      const now = Date.now();
      const DOUBLE_TAP_DELAY = 300;

      if (lastTapRef.current && now - lastTapRef.current < DOUBLE_TAP_DELAY) {
        // Double tap detected - add heart reaction
        addReaction(message.id, '❤️');
        lastTapRef.current = null;
      } else {
        lastTapRef.current = now;
        // Single tap - toggle timestamp visibility
        setTappedMessageId(prev => (prev === message.id ? null : message.id));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLongPressMessage(message);
    setShowReactionPicker(message.id);
    Logger.info('Reaction picker should be visible for message:', message.id);
  }, []);

  // Handle swipe to reply
  const handleSwipeToReply = useCallback(message => {
    // Trigger haptic immediately for responsiveness
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Close the swipeable first for smooth animation
    if (swipeableRefs.current[message.id]) {
      swipeableRefs.current[message.id].close();
    }
    // Defer state update to avoid blocking the animation
    requestAnimationFrame(() => {
      setReplyTo(message);
    });
  }, []);

  // Render swipe action for own messages (swipe left to reveal on right)
  const renderRightActions = useCallback((progress, dragX) => {
    const translateX = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [0, 80],
      extrapolate: 'clamp',
    });
    return (
      <Animated.View style={[styles.swipeActionRight, { transform: [{ translateX }] }]}>
        <Ionicons name="arrow-undo" size={24} color={theme.colors.primary} />
      </Animated.View>
    );
  }, []);

  // Render swipe action for other's messages (swipe right to reveal on left)
  const renderLeftActions = useCallback((progress, dragX) => {
    const translateX = dragX.interpolate({
      inputRange: [0, 80],
      outputRange: [-80, 0],
      extrapolate: 'clamp',
    });
    return (
      <Animated.View style={[styles.swipeActionLeft, { transform: [{ translateX }] }]}>
        <Ionicons name="arrow-undo" size={24} color={theme.colors.primary} />
      </Animated.View>
    );
  }, []);

  // Render message item
  const renderMessage = ({ item, index }) => {
    const isOwnMessage = item.senderId === user.uid;
    const showAvatar = index === 0 || reversedMessages[index - 1]?.senderId !== item.senderId;
    // For inverted list, the last message in a group is when the next message (index - 1) is from a different sender
    const isLastInGroup = index === 0 || reversedMessages[index - 1]?.senderId !== item.senderId;
    const isTapped = tappedMessageId === item.id;
    const isHighlighted = isTapped;
    // Show timestamp for last in group OR when tapped (iMessage-style tap to reveal)
    const showTimestamp = isLastInGroup || isTapped;

    // Determine if we're quoting ourselves or the other person
    const isQuotingSelf = item.replyTo?.senderId === user.uid;

    return (
      <Swipeable
        ref={ref => (swipeableRefs.current[item.id] = ref)}
        renderRightActions={isOwnMessage ? renderRightActions : undefined}
        renderLeftActions={isOwnMessage ? undefined : renderLeftActions}
        onSwipeableOpen={direction => {
          if ((isOwnMessage && direction === 'right') || (!isOwnMessage && direction === 'left')) {
            handleSwipeToReply(item);
          }
        }}
        rightThreshold={isOwnMessage ? 60 : undefined}
        leftThreshold={isOwnMessage ? undefined : 60}
        overshootRight={false}
        overshootLeft={false}
        friction={2}
        containerStyle={styles.swipeableContainer}
      >
        <View style={styles.messageWrapper}>
          <View style={[styles.messageRow, isOwnMessage && styles.ownMessageRow]}>
            {!isOwnMessage && showAvatar && (
              <Image
                source={{ uri: getUserProfilePhoto(match.otherUser) }}
                style={styles.messageAvatar}
              />
            )}
            {!isOwnMessage && !showAvatar && <View style={styles.avatarPlaceholder} />}

            <View
              style={[styles.messageBubbleContainer, isOwnMessage && styles.ownBubbleContainer]}
            >
              {/* Quoted Reply - Separate element above the message bubble */}
              {item.replyTo && (
                <TouchableOpacity
                  style={[
                    styles.quotedReplyStandalone,
                    isOwnMessage
                      ? styles.ownQuotedReplyStandalone
                      : styles.otherQuotedReplyStandalone,
                    isQuotingSelf ? styles.quotingSelfStandalone : styles.quotingOtherStandalone,
                  ]}
                  onPress={() => scrollToMessage(item.replyTo.id)}
                  activeOpacity={0.7}
                >
                  <Image
                    source={{
                      uri: isQuotingSelf
                        ? getUserProfilePhoto(user)
                        : getUserProfilePhoto(match.otherUser),
                    }}
                    style={styles.quotedReplyAvatar}
                  />
                  <View
                    style={[
                      styles.quotedReplyBar,
                      isQuotingSelf ? styles.quotingSelfBar : styles.quotingOtherBar,
                    ]}
                  />
                  <View style={styles.quotedReplyContent}>
                    <Text
                      style={[
                        styles.quotedReplyName,
                        isQuotingSelf ? styles.quotingSelfName : styles.quotingOtherName,
                      ]}
                    >
                      {item.replyTo.senderId === user.uid
                        ? 'You'
                        : item.replyTo.senderName || getUserDisplayName(match.otherUser)}
                    </Text>
                    <Text
                      style={[
                        styles.quotedReplyText,
                        isQuotingSelf ? styles.quotingSelfText : styles.quotingOtherText,
                      ]}
                      numberOfLines={2}
                    >
                      {item.replyTo.messageType === 'GIF'
                        ? '📷 GIF'
                        : item.replyTo.messageType === 'AUDIO'
                          ? '🎤 Voice message'
                          : item.replyTo.content || item.replyTo.text}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}

              <Pressable
                onPress={() => handleMessageTap(item)}
                onLongPress={() => handleMessageLongPress(item)}
                delayLongPress={500}
                style={({ pressed }) => [
                  styles.messageBubble,
                  isOwnMessage ? styles.ownMessageBubble : styles.otherMessageBubble,
                  item.messageType === 'AUDIO' && styles.audioBubble,
                  item.isTemp && styles.tempMessage,
                  pressed && styles.messageBubblePressed,
                  isHighlighted && styles.highlightedMessage,
                ]}
              >
                {item.messageType === 'GIF' ? (
                  <TouchableOpacity
                    onPress={() => openPhotoViewer([item.mediaUrl || item.content], 0)}
                    onLongPress={() => handleMessageLongPress(item)}
                    delayLongPress={500}
                    activeOpacity={0.9}
                  >
                    <Image
                      source={{ uri: item.mediaUrl || item.content }}
                      style={styles.gifMessage}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                ) : item.messageType === 'AUDIO' ? (
                  <AudioMessage
                    messageId={item.id}
                    audioUrl={item.mediaUrl}
                    isOwnMessage={isOwnMessage}
                    duration={item.duration}
                    metadata={item.metadata}
                  />
                ) : (
                  <Text style={[styles.messageText, isOwnMessage && styles.ownMessageText]}>
                    {item.text || item.content || ''}
                  </Text>
                )}
              </Pressable>

              {/* Reactions - Android Messages style, overlapping the bubble */}
              {item.reactions &&
                Object.keys(item.reactions).length > 0 &&
                (() => {
                  const reactionEntries = Object.entries(item.reactions).filter(
                    ([, users]) => users.length > 0
                  );

                  const MAX_VISIBLE = 3;

                  // Prioritize showing at least one reaction from each person
                  // First, find reactions unique to each person
                  const myReactions = reactionEntries.filter(
                    ([, users]) => users.includes(user.uid) && users.length === 1
                  );
                  const theirReactions = reactionEntries.filter(
                    ([, users]) => !users.includes(user.uid)
                  );
                  const sharedReactions = reactionEntries.filter(
                    ([, users]) => users.includes(user.uid) && users.length > 1
                  );

                  // Build visible list ensuring fair representation
                  const visibleReactions = [];

                  // Add one from each person first if available
                  if (myReactions.length > 0) {
                    visibleReactions.push(myReactions[0]);
                  }
                  if (theirReactions.length > 0 && visibleReactions.length < MAX_VISIBLE) {
                    visibleReactions.push(theirReactions[0]);
                  }
                  if (sharedReactions.length > 0 && visibleReactions.length < MAX_VISIBLE) {
                    visibleReactions.push(sharedReactions[0]);
                  }

                  // Fill remaining slots
                  const remaining = [...myReactions, ...theirReactions, ...sharedReactions].filter(
                    r => !visibleReactions.includes(r)
                  );
                  while (visibleReactions.length < MAX_VISIBLE && remaining.length > 0) {
                    visibleReactions.push(remaining.shift());
                  }

                  const hiddenCount = reactionEntries.length - visibleReactions.length;

                  // Superscript characters for counts
                  const superscripts = {
                    2: '²',
                    3: '³',
                    4: '⁴',
                    5: '⁵',
                    6: '⁶',
                    7: '⁷',
                    8: '⁸',
                    9: '⁹',
                  };
                  const getSuperscript = count =>
                    count > 1 ? superscripts[count] || `⁺${count}` : '';

                  return (
                    <TouchableOpacity
                      style={[
                        styles.reactionsContainer,
                        isOwnMessage
                          ? styles.ownReactionsContainer
                          : styles.otherReactionsContainer,
                      ]}
                      onPress={() => {
                        setReactionsDetailMessageId(item.id);
                        reactionsSheetRef.current?.expand();
                      }}
                      activeOpacity={0.8}
                    >
                      {visibleReactions.map(([emoji, users]) => (
                        <Text key={emoji} style={styles.reactionEmoji}>
                          {emoji}
                          {users.length > 1 && (
                            <Text style={styles.reactionSuperscript}>
                              {getSuperscript(users.length)}
                            </Text>
                          )}
                        </Text>
                      ))}
                      {hiddenCount > 0 && (
                        <Text style={styles.reactionOverflow}>+{hiddenCount}</Text>
                      )}
                    </TouchableOpacity>
                  );
                })()}

              {/* Timestamp for all messages, read receipts only for own messages */}
              {showTimestamp && (
                <View style={[styles.messageStatus, !isOwnMessage && styles.otherMessageStatus]}>
                  <Text style={styles.messageTime}>
                    {item.createdAt
                      ? new Date(item.createdAt).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })
                      : ''}
                  </Text>
                  {/* Read receipts only for own messages */}
                  {isOwnMessage &&
                    (isPremium ? (
                      item.isRead ? (
                        <Ionicons
                          name="checkmark-done"
                          size={14}
                          color="#4CAF50"
                          style={styles.readIcon}
                        />
                      ) : (
                        <Ionicons name="checkmark" size={14} color="#999" style={styles.readIcon} />
                      )
                    ) : (
                      <View style={styles.premiumHint}>
                        <Ionicons name="checkmark" size={14} color="#999" style={styles.readIcon} />
                        <Ionicons
                          name="diamond-outline"
                          size={12}
                          color="#FFB800"
                          style={styles.premiumDiamond}
                        />
                      </View>
                    ))}
                </View>
              )}
            </View>
          </View>
        </View>
      </Swipeable>
    );
  };

  // Render typing indicator (premium only)
  const renderTypingIndicator = () => {
    if (!otherUserTyping || !isPremium) return null;

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

  // Handle emoji selection from the emoji keyboard
  const handleEmojiSelected = useCallback(
    emojiObject => {
      if (showReactionPicker) {
        Haptics.selectionAsync();
        addReaction(showReactionPicker, emojiObject.emoji);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showReactionPicker]
  );

  // Close emoji picker
  const handleCloseEmojiPicker = useCallback(() => {
    setShowReactionPicker(null);
    setLongPressMessage(null);
  }, []);

  // Menu action handlers
  const handleMenuAction = useCallback(
    action => {
      setShowMenu(false);
      switch (action) {
        case 'viewProfile':
          setIsProfileSheetOpen(true);
          profileSheetRef.current?.open();
          break;
        case 'search':
          showInfo('Coming soon!');
          break;
        case 'mute':
          setShowMuteConfirm(true);
          break;
        case 'block':
          setShowBlockConfirm(true);
          break;
        case 'unmatch':
          setShowUnmatchConfirm(true);
          break;
        case 'report':
          setShowReportModal(true);
          break;
        default:
          break;
      }
    },
    [showInfo]
  );

  // Load mute status on mount
  useEffect(() => {
    const checkMuteStatus = async () => {
      if (match?.id) {
        const muted = await ApiDataService.isMatchMuted(match.id);
        setIsMuted(muted);
      }
    };
    checkMuteStatus();
  }, [match?.id]);

  // Moderation action handlers
  const handleMuteToggle = useCallback(async () => {
    setIsSubmitting(true);
    try {
      let success;
      if (isMuted) {
        success = await ApiDataService.unmuteMatch(match.id);
        if (success) {
          setIsMuted(false);
          showSuccess('Notifications unmuted');
        }
      } else {
        success = await ApiDataService.muteMatch(match.id);
        if (success) {
          setIsMuted(true);
          showSuccess('Notifications muted');
        }
      }
      if (!success) {
        showError('Failed to update notification settings');
      }
    } catch (error) {
      Logger.error('Mute toggle error:', error);
      showError('Something went wrong');
    } finally {
      setIsSubmitting(false);
      setShowMuteConfirm(false);
    }
  }, [match?.id, isMuted, showSuccess, showError]);

  const handleBlock = useCallback(async () => {
    setIsSubmitting(true);
    try {
      const success = await ApiDataService.blockUser(match?.otherUser?.id, match?.id);
      if (success) {
        showSuccess(`${match?.otherUser?.name || 'User'} has been blocked`);
        navigation.navigate('MessagesList');
      } else {
        showError('Failed to block user');
      }
    } catch (error) {
      Logger.error('Block error:', error);
      showError('Something went wrong');
    } finally {
      setIsSubmitting(false);
      setShowBlockConfirm(false);
    }
  }, [match?.id, match?.otherUser, navigation, showSuccess, showError]);

  const handleUnmatch = useCallback(async () => {
    setIsSubmitting(true);
    try {
      const success = await ApiDataService.unmatch(match?.id);
      if (success) {
        showSuccess('Unmatched successfully');
        navigation.navigate('MessagesList');
      } else {
        showError('Failed to unmatch');
      }
    } catch (error) {
      Logger.error('Unmatch error:', error);
      showError('Something went wrong');
    } finally {
      setIsSubmitting(false);
      setShowUnmatchConfirm(false);
    }
  }, [match?.id, navigation, showSuccess, showError]);

  const handleReport = useCallback(
    async (reason, description) => {
      setIsSubmitting(true);
      try {
        const success = await ApiDataService.reportUser(match?.otherUser?.id, reason, description);
        if (success) {
          showSuccess('Report submitted. Thank you for helping keep our community safe.');
          setShowReportModal(false);
        } else {
          showError('Failed to submit report');
        }
      } catch (error) {
        Logger.error('Report error:', error);
        showError('Something went wrong');
      } finally {
        setIsSubmitting(false);
      }
    },
    [match?.otherUser?.id, showSuccess, showError]
  );

  // Render menu overlay
  const renderMenu = () => {
    if (!showMenu) return null;

    const menuItems = [
      { id: 'search', icon: 'search', label: 'Search in conversation', color: '#333' },
      { id: 'viewProfile', icon: 'person', label: 'View profile', color: '#333' },
      { id: 'mute', icon: 'notifications-off', label: 'Mute notifications', color: '#333' },
      { id: 'block', icon: 'ban', label: 'Block user', color: '#FF9800' },
      { id: 'unmatch', icon: 'heart-dislike', label: 'Unmatch', color: '#F44336' },
      { id: 'report', icon: 'flag', label: 'Report user', color: '#F44336' },
    ];

    return (
      <View style={styles.menuOverlay}>
        <Pressable style={styles.menuBackdrop} onPress={() => setShowMenu(false)} />
        <View style={styles.menuContainer}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.menuItem, index === menuItems.length - 1 && styles.menuItemLast]}
              onPress={() => handleMenuAction(item.id)}
              activeOpacity={0.7}
            >
              <Ionicons name={item.icon} size={20} color={item.color} />
              <Text style={[styles.menuItemText, { color: item.color }]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  // Get the live message for reactions detail (derived from messages array)
  const reactionsDetailMessage = useMemo(() => {
    if (!reactionsDetailMessageId) return null;
    return messages.find(m => m.id === reactionsDetailMessageId) || null;
  }, [reactionsDetailMessageId, messages]);

  // Get reactions data for the bottom sheet
  const getReactionsData = useCallback(() => {
    if (!reactionsDetailMessage) return { reactionsList: [], filteredReactions: [] };

    const reactions = reactionsDetailMessage.reactions || {};
    const reactionEntries = Object.entries(reactions).filter(([, users]) => users.length > 0);

    const reactionsList = [];
    reactionEntries.forEach(([emoji, userIds]) => {
      userIds.forEach(userId => {
        const isMe = userId === user.uid;
        reactionsList.push({
          emoji,
          userId,
          name: isMe ? 'You' : getUserDisplayName(match.otherUser),
          avatar: isMe ? getUserProfilePhoto(user) : getUserProfilePhoto(match.otherUser),
          isMe,
        });
      });
    });

    const filteredReactions = reactionsList.filter(r => {
      if (reactionsTab === 'all') return true;
      if (reactionsTab === 'you') return r.isMe;
      if (reactionsTab === 'them') return !r.isMe;
      return true;
    });

    return { reactionsList, filteredReactions };
  }, [reactionsDetailMessage, reactionsTab, user, match.otherUser]);

  // Handle reactions sheet close
  const handleReactionsSheetClose = useCallback(() => {
    setReactionsDetailMessageId(null);
    setReactionsTab('all');
  }, []);

  // Backdrop for reactions sheet - tap to close
  const renderReactionsBackdrop = useCallback(
    props => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    []
  );

  // Handle add reaction from sheet
  const handleAddReactionFromSheet = useCallback(() => {
    const messageToReact = reactionsDetailMessage;
    reactionsSheetRef.current?.close();
    setTimeout(() => {
      if (messageToReact) {
        handleMessageLongPress(messageToReact);
      }
    }, 300);
  }, [reactionsDetailMessage, handleMessageLongPress]);

  const WrapperComponent = Platform.OS === 'ios' ? SafeAreaView : View;

  return (
    <>
      <StatusBar backgroundColor={theme.colors.primary} barStyle="light-content" />
      {Platform.OS === 'android' && (
        <View style={{ height: StatusBar.currentHeight, backgroundColor: theme.colors.primary }} />
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
                setIsProfileSheetOpen(true);
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
                  {isPremium && otherUserTyping ? (
                    <Text style={styles.statusText}>Typing...</Text>
                  ) : isPremium && onlineStatus ? (
                    <>
                      <View style={styles.onlineDotContainer}>
                        <Animated.View
                          style={[
                            styles.onlineShockwave,
                            { transform: [{ scale: shockwaveScale }], opacity: shockwaveOpacity },
                          ]}
                        />
                        <View style={styles.onlineDot} />
                      </View>
                      <Text style={styles.statusText}>Online</Text>
                    </>
                  ) : isPremium ? (
                    <Text style={styles.statusText}>
                      {lastSeen ? formatLastSeen(lastSeen) : 'New to Hantibink'}
                    </Text>
                  ) : (
                    <View style={styles.premiumHint}>
                      <Text style={styles.statusText}>See activity</Text>
                      <Ionicons
                        name="diamond-outline"
                        size={12}
                        color="#FFB800"
                        style={styles.premiumDiamond}
                      />
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.menuButton} onPress={() => setShowMenu(true)}>
              <Ionicons name="ellipsis-vertical" size={20} color="#333" />
            </TouchableOpacity>
          </View>

          {/* Messages */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
          ) : (
            <>
              <FlatList
                ref={flatListRef}
                data={reversedMessages}
                renderItem={renderMessage}
                keyExtractor={(item, index) =>
                  item.id || `msg-${index}-${item.createdAt || Date.now()}`
                }
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
                onScroll={handleScroll}
                scrollEventThrottle={16}
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

              {/* Scroll to bottom FAB - hidden when profile sheet or reactions panel is open */}
              {!isProfileSheetOpen && !reactionsDetailMessage && (
                <Animated.View
                  style={[
                    styles.scrollToBottomFab,
                    {
                      opacity: scrollButtonAnim,
                      transform: [
                        {
                          scale: scrollButtonAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.5, 1],
                          }),
                        },
                      ],
                    },
                  ]}
                  pointerEvents={showScrollButton ? 'auto' : 'none'}
                >
                  <TouchableOpacity
                    style={styles.scrollToBottomButton}
                    onPress={() => {
                      scrollToBottom(true);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="chevron-down" size={24} color="#fff" />
                  </TouchableOpacity>
                </Animated.View>
              )}
            </>
          )}

          {/* Reply Preview */}
          {replyTo && (
            <View style={styles.replyPreview}>
              <View style={styles.replyPreviewContent}>
                <View style={styles.replyPreviewBar} />
                <View style={styles.replyPreviewText}>
                  <Text style={styles.replyPreviewName}>
                    {replyTo.senderId === user.uid ? 'You' : getUserDisplayName(match.otherUser)}
                  </Text>
                  <Text style={styles.replyPreviewMessage} numberOfLines={1}>
                    {replyTo.messageType === 'GIF'
                      ? 'GIF'
                      : replyTo.messageType === 'AUDIO'
                        ? 'Voice message'
                        : replyTo.content || replyTo.text}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setReplyTo(null)} style={styles.replyPreviewClose}>
                <Ionicons name="close" size={20} color="#666" />
              </TouchableOpacity>
            </View>
          )}

          {/* Input */}
          <View style={styles.inputContainer}>
            {/* Hide GIF and input when recording */}
            {!isRecording && (
              <>
                <TouchableOpacity
                  style={styles.attachButton}
                  onPress={() => setShowGifPicker(true)}
                  disabled={isUploadingAudio}
                >
                  <Text style={[styles.gifButtonText, isUploadingAudio && styles.disabledText]}>
                    GIF
                  </Text>
                </TouchableOpacity>

                <TextInput
                  ref={inputRef}
                  style={styles.messageInput}
                  placeholder={isUploadingAudio ? 'Sending voice message...' : 'Type a message...'}
                  value={messageText}
                  onChangeText={handleTypingChange}
                  multiline
                  maxLength={500}
                  editable={!isUploadingAudio}
                />
              </>
            )}

            {/* Show send button when has text, otherwise show AudioRecorder */}
            {showSendButton ? (
              <Animated.View style={{ transform: [{ scale: rightIconAnim }] }}>
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
                    size={22}
                    color={messageText.trim() && !isSending ? '#F44336' : '#999'}
                  />
                </TouchableOpacity>
              </Animated.View>
            ) : (
              <AudioRecorder
                onRecordingComplete={(uri, duration, waveform) => {
                  setIsRecording(false);
                  sendAudio(uri, duration, waveform);
                }}
                onRecordingStart={() => setIsRecording(true)}
                onRecordingCancel={() => setIsRecording(false)}
                onError={error => {
                  setIsRecording(false);
                  showError('Recording failed', { error });
                }}
                disabled={isSending || isUploadingAudio}
              />
            )}
          </View>

          {/* Profile Bottom Sheet - Always rendered but hidden */}
          <ProfileBottomSheet
            ref={profileSheetRef}
            profile={match.otherUser}
            onClose={() => setIsProfileSheetOpen(false)}
          />

          {/* GIF Picker Modal */}
          <GifPicker
            visible={showGifPicker}
            onClose={() => setShowGifPicker(false)}
            onSelectGif={sendGif}
          />
        </KeyboardAvoidingView>

        {/* Menu overlay */}
        {renderMenu()}

        {/* Reactions detail bottom sheet */}
        <BottomSheet
          ref={reactionsSheetRef}
          index={-1}
          snapPoints={reactionsSnapPoints}
          enableDynamicSizing={false}
          enablePanDownToClose={true}
          backgroundStyle={styles.reactionsSheetBackground}
          handleIndicatorStyle={styles.reactionsSheetIndicator}
          backdropComponent={renderReactionsBackdrop}
          onChange={index => {
            if (index === -1) {
              handleReactionsSheetClose();
            }
          }}
        >
          <View style={styles.reactionsSheetContent}>
            <Text style={styles.reactionsDetailTitle}>Reactions</Text>

            {/* Tabs */}
            {reactionsDetailMessage && (
              <>
                <View style={styles.reactionsTabs}>
                  <TouchableOpacity
                    style={[
                      styles.reactionsTab,
                      reactionsTab === 'all' && styles.reactionsTabActive,
                    ]}
                    onPress={() => setReactionsTab('all')}
                  >
                    <Text
                      style={[
                        styles.reactionsTabText,
                        reactionsTab === 'all' && styles.reactionsTabTextActive,
                      ]}
                    >
                      All ({getReactionsData().reactionsList.length})
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.reactionsTab,
                      reactionsTab === 'you' && styles.reactionsTabActive,
                    ]}
                    onPress={() => setReactionsTab('you')}
                  >
                    <Text
                      style={[
                        styles.reactionsTabText,
                        reactionsTab === 'you' && styles.reactionsTabTextActive,
                      ]}
                    >
                      You ({getReactionsData().reactionsList.filter(r => r.isMe).length})
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.reactionsTab,
                      reactionsTab === 'them' && styles.reactionsTabActive,
                    ]}
                    onPress={() => setReactionsTab('them')}
                  >
                    <Text
                      style={[
                        styles.reactionsTabText,
                        reactionsTab === 'them' && styles.reactionsTabTextActive,
                      ]}
                    >
                      {getUserDisplayName(match.otherUser).split(' ')[0]} (
                      {getReactionsData().reactionsList.filter(r => !r.isMe).length})
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Scrollable reactions list - fixed height, fills available space */}
                <View style={styles.reactionsScrollContainer}>
                  <BottomSheetScrollView contentContainerStyle={styles.reactionsScrollContent}>
                    {getReactionsData().filteredReactions.map((reaction, index) => (
                      <View
                        key={`${reaction.userId}-${reaction.emoji}-${index}`}
                        style={styles.reactionDetailRow}
                      >
                        <View style={styles.reactionDetailLeft}>
                          <Image
                            source={{ uri: reaction.avatar }}
                            style={styles.reactionDetailAvatar}
                          />
                          <Text style={styles.reactionDetailName}>{reaction.name}</Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => {
                            if (reaction.isMe && reactionsDetailMessage) {
                              addReaction(reactionsDetailMessage.id, reaction.emoji);
                            }
                          }}
                          activeOpacity={reaction.isMe ? 0.7 : 1}
                          style={styles.reactionEmojiContainer}
                        >
                          <Text style={styles.reactionDetailEmoji}>{reaction.emoji}</Text>
                          {reaction.isMe && (
                            <View style={styles.removeReactionBadge}>
                              <Ionicons name="close" size={10} color="#fff" />
                            </View>
                          )}
                        </TouchableOpacity>
                      </View>
                    ))}

                    {getReactionsData().filteredReactions.length === 0 && (
                      <View style={styles.noReactionsContainer}>
                        <Text style={styles.noReactionsText}>No reactions yet</Text>
                      </View>
                    )}
                  </BottomSheetScrollView>
                </View>

                {/* Add reaction button - anchored at bottom */}
                <TouchableOpacity
                  style={styles.addReactionRow}
                  onPress={handleAddReactionFromSheet}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add-circle-outline" size={24} color={theme.colors.primary} />
                  <Text style={styles.addReactionText}>Add reaction</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </BottomSheet>

        {/* Emoji Picker for reactions */}
        <EmojiPicker
          onEmojiSelected={handleEmojiSelected}
          open={showReactionPicker !== null}
          onClose={handleCloseEmojiPicker}
          theme={{
            backdrop: '#00000080',
            knob: theme.colors.primary,
            category: {
              icon: '#666',
              iconActive: theme.colors.primary,
              container: '#fff',
              containerActive: 'rgba(211, 47, 47, 0.15)',
            },
            search: {
              background: '#f5f5f5',
              placeholder: '#999',
              text: '#333',
            },
            header: '#999',
            skinTonesContainer: '#fff',
          }}
          enableSearchBar={true}
          enableRecentlyUsed={true}
          categoryPosition="top"
        />

        {/* Mute Confirmation Modal */}
        <ConfirmationModal
          visible={showMuteConfirm}
          title={isMuted ? 'Unmute Notifications' : 'Mute Notifications'}
          message={
            isMuted
              ? `You will start receiving notifications from ${match?.otherUser?.name || 'this user'} again.`
              : `You won't receive notifications from ${match?.otherUser?.name || 'this user'}. You can unmute them anytime.`
          }
          confirmText={isMuted ? 'Unmute' : 'Mute'}
          confirmColor={theme.colors.primary}
          onConfirm={handleMuteToggle}
          onCancel={() => setShowMuteConfirm(false)}
        />

        {/* Block Confirmation Modal */}
        <ConfirmationModal
          visible={showBlockConfirm}
          title={`Block ${match?.otherUser?.name || 'User'}?`}
          message="They won't be able to see your profile or message you. Your match will be removed. You can unblock them from Settings."
          confirmText="Block"
          onConfirm={handleBlock}
          onCancel={() => setShowBlockConfirm(false)}
        />

        {/* Unmatch Confirmation Modal */}
        <ConfirmationModal
          visible={showUnmatchConfirm}
          title={`Unmatch with ${match?.otherUser?.name || 'User'}?`}
          message="This will remove your match and conversation permanently. This action cannot be undone."
          confirmText="Unmatch"
          onConfirm={handleUnmatch}
          onCancel={() => setShowUnmatchConfirm(false)}
        />

        {/* Report Modal */}
        <ReportReasonModal
          visible={showReportModal}
          userName={match?.otherUser?.name || 'User'}
          onSubmit={handleReport}
          onCancel={() => setShowReportModal(false)}
          isSubmitting={isSubmitting}
        />
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
  onlineDotContainer: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 2,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    position: 'absolute',
  },
  onlineShockwave: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    position: 'absolute',
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
    marginVertical: 4,
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
    maxWidth: '85%',
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
    backgroundColor: theme.colors.primary,
    borderTopRightRadius: 24,
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 8,
    shadowColor: theme.colors.primary,
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
    opacity: 1, // Full opacity for optimistic updates - no visual difference while sending
  },
  messageBubblePressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  highlightedMessage: {
    transform: [{ translateY: -2 }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  audioBubble: {
    paddingLeft: 8,
    paddingRight: 12,
    paddingVertical: 10,
    minWidth: 220,
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
  quotedReplyStandalone: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 4,
  },
  quotedReplyAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 6,
  },
  ownQuotedReplyStandalone: {
    alignSelf: 'flex-end',
  },
  otherQuotedReplyStandalone: {
    alignSelf: 'flex-start',
  },
  // Colors based on WHO is being quoted
  quotingSelfStandalone: {
    backgroundColor: 'rgba(211, 47, 47, 0.15)', // theme.colors.primary with opacity
  },
  quotingOtherStandalone: {
    backgroundColor: 'rgba(21, 101, 192, 0.12)', // theme.colors.secondary with opacity
  },
  quotedReplyBar: {
    width: 3,
    alignSelf: 'stretch',
    borderRadius: 2,
    marginRight: 8,
  },
  quotingSelfBar: {
    backgroundColor: theme.colors.primary,
  },
  quotingOtherBar: {
    backgroundColor: theme.colors.secondary,
  },
  quotedReplyContent: {
    flexShrink: 1,
    flexGrow: 1,
  },
  quotedReplyName: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  quotingSelfName: {
    color: theme.colors.primary,
  },
  quotingOtherName: {
    color: theme.colors.secondary,
  },
  quotedReplyText: {
    fontSize: 13,
  },
  quotingSelfText: {
    color: '#666',
  },
  quotingOtherText: {
    color: '#555',
  },
  reactionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 3,
    marginTop: -8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  ownReactionsContainer: {
    alignSelf: 'flex-end',
    marginRight: 4,
  },
  otherReactionsContainer: {
    alignSelf: 'flex-start',
    marginLeft: 4,
  },
  reactionEmoji: {
    fontSize: 16,
  },
  reactionSuperscript: {
    fontSize: 10,
    lineHeight: 14,
  },
  reactionOverflow: {
    fontSize: 12,
    color: '#666',
    marginLeft: 2,
    fontWeight: '500',
  },
  // Reactions detail bottom sheet styles
  reactionsSheetBackground: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  reactionsSheetIndicator: {
    backgroundColor: '#ddd',
    width: 36,
    height: 4,
  },
  reactionsSheetContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  reactionsScrollContainer: {
    flex: 1,
  },
  reactionsScrollContent: {
    flexGrow: 1,
  },
  reactionsDetailTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  reactionsTabs: {
    flexDirection: 'row',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  reactionsTab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  reactionsTabActive: {
    borderBottomColor: theme.colors.primary,
  },
  reactionsTabText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  reactionsTabTextActive: {
    color: theme.colors.primary,
  },
  noReactionsContainer: {
    paddingVertical: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactionDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  reactionDetailLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reactionDetailAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  reactionDetailName: {
    fontSize: 16,
    color: '#333',
  },
  noReactionsText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  reactionDetailEmoji: {
    fontSize: 24,
  },
  reactionEmojiContainer: {
    position: 'relative',
    marginRight: 8,
  },
  removeReactionBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#999',
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addReactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#f0f0f0',
  },
  addReactionText: {
    fontSize: 16,
    color: theme.colors.primary,
    marginLeft: 12,
    fontWeight: '500',
  },
  messageStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    paddingHorizontal: 4,
    alignSelf: 'flex-end',
  },
  otherMessageStatus: {
    alignSelf: 'flex-start',
  },
  messageTime: {
    fontSize: 11,
    color: '#8e8e93',
    fontWeight: '400',
  },
  readIcon: {
    marginLeft: 4,
  },
  premiumHint: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  premiumDiamond: {
    marginLeft: 2,
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
  swipeableContainer: {
    backgroundColor: '#fff',
  },
  swipeActionRight: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    backgroundColor: 'transparent',
  },
  swipeActionLeft: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    backgroundColor: 'transparent',
  },
  replyPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  replyPreviewContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  replyPreviewBar: {
    width: 3,
    height: '100%',
    minHeight: 32,
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
    marginRight: 8,
  },
  replyPreviewText: {
    flex: 1,
  },
  replyPreviewName: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.primary,
    marginBottom: 2,
  },
  replyPreviewMessage: {
    fontSize: 14,
    color: '#666',
  },
  replyPreviewClose: {
    padding: 4,
    marginLeft: 8,
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
  disabledText: {
    opacity: 0.4,
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
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  scrollToBottomFab: {
    position: 'absolute',
    bottom: 80,
    alignSelf: 'center',
    left: '50%',
    marginLeft: -22,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  scrollToBottomButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    elevation: 999,
  },
  menuBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  menuContainer: {
    position: 'absolute',
    top: 60,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 8,
    minWidth: 220,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuItemText: {
    fontSize: 15,
    marginLeft: 12,
    fontWeight: '400',
  },
});

export default ChatScreen;
