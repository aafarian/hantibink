import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ActivityIndicator,
  StatusBar,
  Keyboard,
  BackHandler,
  AppState,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused, useFocusEffect } from '@react-navigation/native';
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
import ChatReplyPreview from './ChatScreen/ChatReplyPreview';
import ChatMenu from './chat/ChatMenu';
import ChatHeader from './chat/ChatHeader';
import ChatInput from './chat/ChatInput';
import ChatReactionsSheet from './chat/ChatReactionsSheet';
import ChatSearchModal from './chat/ChatSearchModal';
import ChatMessageBubble from './chat/ChatMessageBubble';
import AnimatedTypingIndicator from '../components/chat/AnimatedTypingIndicator';
import AnimatedMessageBubble from '../components/chat/AnimatedMessageBubble';
import AnimatedScrollToBottom from '../components/chat/AnimatedScrollToBottom';
import { theme } from '../styles/theme';
import GamesApiService from '../services/GamesApiService';
import useGameSession from '../hooks/useGameSession';
import {
  GamePickerSheet,
  TwoTruthsComposer,
  RouletteComposer,
  RiddlePickerSheet,
  ActiveGameBar,
  ActiveGamePanel,
  GameMessageCard,
  GameRecapModal,
} from '../components/games/GameComponents';

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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
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

  // In-chat games. Roulette and the riddle are drafts until the creator
  // commits (answers / picks) — no session exists server-side before that.
  const [showGamePicker, setShowGamePicker] = useState(false);
  const [showTwoTruthsComposer, setShowTwoTruthsComposer] = useState(false);
  const [rouletteOffer, setRouletteOffer] = useState(null);
  const [riddleOffers, setRiddleOffers] = useState(null);
  const [gamePanelExpanded, setGamePanelExpanded] = useState(true);
  const [showEndGameConfirm, setShowEndGameConfirm] = useState(false);
  const [gamesAvailable, setGamesAvailable] = useState(true);
  const [recapSession, setRecapSession] = useState(null);
  const [showChatSearch, setShowChatSearch] = useState(false);
  const {
    session: gameSession,
    refresh: refreshGameSession,
    applySnapshot: applyGameSnapshot,
  } = useGameSession(match.matchId);

  // Games entry point renders only when BOTH members have games enabled
  // (server-enforced too — this just hides the icon)
  useEffect(() => {
    let cancelled = false;
    GamesApiService.getAvailability(match.matchId)
      .then(availability => {
        if (!cancelled && availability) {
          setGamesAvailable(!!availability.enabled);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [match.matchId]);

  // A freshly active game opens the docked panel; collapsing it is
  // remembered until the next game starts
  const activeGameId = gameSession?.status === 'ACTIVE' ? gameSession.id : null;
  useEffect(() => {
    if (activeGameId) {
      setGamePanelExpanded(true);
    }
  }, [activeGameId]);

  const createGame = useCallback(
    async (gameType, payload = null) => {
      try {
        const created = await GamesApiService.createSession(match.matchId, gameType, payload);
        applyGameSnapshot(created);
      } catch (error) {
        showError(error.message || 'Could not start the game');
      }
    },
    [match.matchId, showError, applyGameSnapshot]
  );

  const handlePickGame = useCallback(
    async gameType => {
      setShowGamePicker(false);
      if (gameType === 'TWO_TRUTHS') {
        setShowTwoTruthsComposer(true);
        return;
      }
      if (gameType === 'QUESTION_ROULETTE' || gameType === 'EMOJI_RIDDLE') {
        try {
          const { offers } = await GamesApiService.getOffers(match.matchId, gameType);
          if (gameType === 'QUESTION_ROULETTE') {
            setRouletteOffer(offers?.[0] || null);
          } else {
            setRiddleOffers(offers || []);
          }
        } catch (error) {
          showError(error.message || 'Could not load the game');
        }
        return;
      }
      createGame(gameType);
    },
    [match.matchId, showError, createGame]
  );

  const handleTwoTruthsSubmit = useCallback(
    async payload => {
      setShowTwoTruthsComposer(false);
      createGame('TWO_TRUTHS', payload);
    },
    [createGame]
  );

  const handleRouletteSubmit = useCallback(
    async answer => {
      const questionId = rouletteOffer?.id;
      setRouletteOffer(null);
      createGame('QUESTION_ROULETTE', { questionId, answer });
    },
    [rouletteOffer?.id, createGame]
  );

  const handleRiddleSubmit = useCallback(
    async riddleId => {
      setRiddleOffers(null);
      createGame('EMOJI_RIDDLE', { riddleId });
    },
    [createGame]
  );

  const handleGameMove = useCallback(
    async move => {
      try {
        const updated = await GamesApiService.submitMove(match.matchId, gameSession?.id, move);
        applyGameSnapshot(updated);
      } catch (error) {
        showError(error.message || 'Move failed');
        refreshGameSession();
      }
    },
    [match.matchId, gameSession?.id, showError, refreshGameSession, applyGameSnapshot]
  );

  // "I'm done" is available to both players and ends the game for both:
  // the creator forfeits their own game, the opponent declines it
  const handleEndActiveGame = useCallback(async () => {
    setShowGamePicker(false);
    try {
      const isCreator = gameSession?.createdBy === user.uid;
      const ended = isCreator
        ? await GamesApiService.forfeit(match.matchId, gameSession?.id)
        : await GamesApiService.decline(match.matchId, gameSession?.id);
      applyGameSnapshot(ended);
    } catch (error) {
      showError(error.message || 'Could not end the game');
      refreshGameSession();
    }
  }, [
    match.matchId,
    gameSession?.id,
    gameSession?.createdBy,
    user.uid,
    showError,
    applyGameSnapshot,
    refreshGameSession,
  ]);

  // Ending is destructive for both players, so "I'm done" confirms first.
  // The ToT pre-pick X stays instant — nothing is committed yet.
  const requestEndGame = useCallback(() => {
    setShowGamePicker(false);
    setShowEndGameConfirm(true);
  }, []);

  // Tap a game card (live or long over) → recap modal. The live session
  // is used directly so the modal updates in real time; old games are
  // fetched by the sessionId stored in the message metadata.
  const handleOpenGameDetails = useCallback(
    async metadata => {
      if (!metadata?.sessionId) {
        return;
      }
      if (gameSession?.id === metadata.sessionId) {
        setRecapSession(gameSession);
        return;
      }
      try {
        const past = await GamesApiService.getSession(match.matchId, metadata.sessionId);
        if (past) {
          setRecapSession(past);
        } else {
          showError('Could not load this game');
        }
      } catch (error) {
        showError('Could not load this game');
      }
    },
    [match.matchId, gameSession, showError]
  );

  const confirmEndGame = useCallback(() => {
    setShowEndGameConfirm(false);
    handleEndActiveGame();
  }, [handleEndActiveGame]);

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
  const isFocusedRef = useRef(isFocused); // Track focus state for callbacks
  const appStateRef = useRef(AppState.currentState); // Track app foreground/background state

  // Max number of message IDs to track (prevents unbounded growth)
  const MAX_SENT_MESSAGE_IDS = 100;
  const reactionsSheetRef = useRef(null);
  const inputRef = useRef(null);

  // Animation values
  const shockwaveScale = useRef(new Animated.Value(1)).current;
  const shockwaveOpacity = useRef(new Animated.Value(0.6)).current;

  // Shockwave animation for online dot — only run when screen is focused
  useEffect(() => {
    let shockwaveAnimation;
    if (onlineStatus && isPremium && isFocused) {
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
  }, [onlineStatus, isPremium, isFocused, shockwaveScale, shockwaveOpacity]);

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

  // One-time setup on mount (analytics, notifications)
  useEffect(() => {
    loadMessages();
    clearNotificationForMatch(match.matchId);
    trackChatOpened('matches_list');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.matchId]);

  // Socket listeners — subscribe on focus, unsubscribe on blur/unmount.
  // This prevents background state updates from causing scroll jitter on other tabs.
  useFocusEffect(
    useCallback(() => {
      const unsubscribeListeners = joinChatRoom();
      // Refresh messages when returning to this screen
      loadMessages();

      return () => {
        unsubscribeListeners?.();
        leaveChatRoom();
        if (otherUserTypingTimeoutRef.current) {
          clearTimeout(otherUserTypingTimeoutRef.current);
          otherUserTypingTimeoutRef.current = null;
        }
        setOtherUserTyping(false);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [match.matchId])
  );

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

  // Track keyboard state and handle Android back button — only when focused
  // to prevent background re-renders when typing on other screens
  useFocusEffect(
    useCallback(() => {
      const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
        setKeyboardVisible(true);
      });

      const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
        setKeyboardVisible(false);
      });

      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        if (showReactionPicker !== null) {
          Logger.info('Back button pressed, closing reaction picker');
          setShowReactionPicker(null);
          setLongPressMessage(null);
          return true;
        }
        return false;
      });

      return () => {
        keyboardDidShowListener.remove();
        keyboardDidHideListener.remove();
        backHandler.remove();
        setKeyboardVisible(false);
      };
    }, [showReactionPicker])
  );

  // Note: Send button animation is now handled by AnimatedSendButton component

  // Load messages from API
  const loadMessages = async () => {
    try {
      setLoading(true);
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
      setLoadError(false);

      // Only mark as read if there are messages from the other user
      if (validMessages.some(msg => msg.senderId !== user.uid)) {
        markMessagesAsRead();
      }
    } catch (error) {
      Logger.error('Failed to load messages:', error);
      setLoadError(true);
      showError('Failed to load messages', { error });
    } finally {
      setLoading(false);
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

        // Skip our own optimistically-added messages. Server-created GAME
        // messages (start/summary cards) are never in the optimistic list,
        // so they flow through even when we authored the action —
        // handleNewMessage dedupes by id if both paths deliver.
        const isServerCreated = data.message?.messageType === 'GAME';
        if (
          sentMessageIdsRef.current.has(messageId) ||
          (messageSenderId === currentUserId && !isServerCreated)
        ) {
          Logger.info(`📩 Skipping own/duplicate message: ${messageId}`);
          return;
        }
        handleNewMessage(data);
      } else if (event === 'message-reaction' && data.matchId === match.matchId) {
        handleMessageReaction(data);
      } else if (
        event === 'user-typing' &&
        data.matchId === match.matchId &&
        isFocusedRef.current
      ) {
        handleUserTyping(data);
      } else if (
        event === 'messages-read' &&
        data.matchId === match.matchId &&
        isFocusedRef.current
      ) {
        handleMessagesRead(data);
      }
    });

    // Check online status — skip state updates when screen is not focused
    const unsubscribeOnline = SocketService.onUserStatus((userId, isOnline, timestamp) => {
      if (userId === match.otherUser.id && isFocusedRef.current) {
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
      // Game cards render from metadata — dropping it turns them into
      // plain text bubbles until the next full reload
      metadata: msg.metadata || null,
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
      }
    },
    [showScrollButton]
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

  // Note: Typing dots animation is now handled by AnimatedTypingIndicator component

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

  // Handle reactions press to show detail sheet
  const handleReactionsPress = useCallback(message => {
    setReactionsDetailMessageId(message.id);
    reactionsSheetRef.current?.expand();
  }, []);

  // Render message item using ChatMessageBubble component with entry animation
  const renderMessage = useCallback(
    ({ item, index }) => {
      const isOwnMessage = item.senderId === user.uid;
      // Grouping (avatar + timestamp on the newest message of a same-sender
      // run) must skip GAME messages: they render as centered sender-neutral
      // cards, and letting one sit as "newest of the group" swallowed the
      // group's avatar — incoming bubbles then looked indented for no reason
      let newerIndex = index - 1;
      while (newerIndex >= 0 && reversedMessages[newerIndex]?.messageType === 'GAME') {
        newerIndex--;
      }
      const newerMessage = newerIndex >= 0 ? reversedMessages[newerIndex] : null;
      const isLastInGroup = !newerMessage || newerMessage.senderId !== item.senderId;
      const showAvatar = isLastInGroup;
      const isTapped = tappedMessageId === item.id;
      // Only animate temp messages (optimistically added) - they're new messages being sent
      const shouldAnimate = item.isTemp === true;

      // Game cards render as centered interactive cards, not bubbles
      if (item.messageType === 'GAME') {
        let gameMetadata = null;
        try {
          gameMetadata = item.metadata ? JSON.parse(item.metadata) : null;
        } catch (parseError) {
          gameMetadata = null;
        }
        if (gameMetadata?.kind) {
          return <GameMessageCard metadata={gameMetadata} onOpenDetails={handleOpenGameDetails} />;
        }
      }

      return (
        <AnimatedMessageBubble isOwnMessage={isOwnMessage} shouldAnimate={shouldAnimate}>
          <ChatMessageBubble
            message={item}
            isOwnMessage={isOwnMessage}
            showAvatar={showAvatar}
            isLastInGroup={isLastInGroup}
            isTapped={isTapped}
            otherUser={match.otherUser}
            currentUser={user}
            isPremium={isPremium}
            onTap={handleMessageTap}
            onLongPress={handleMessageLongPress}
            onSwipeToReply={handleSwipeToReply}
            onReactionsPress={handleReactionsPress}
            onQuotedReplyPress={scrollToMessage}
            onPhotoPress={openPhotoViewer}
            swipeableRef={ref => (swipeableRefs.current[item.id] = ref)}
          />
        </AnimatedMessageBubble>
      );
    },
    [
      user,
      reversedMessages,
      tappedMessageId,
      match.otherUser,
      isPremium,
      handleMessageTap,
      handleMessageLongPress,
      handleSwipeToReply,
      handleReactionsPress,
      scrollToMessage,
      openPhotoViewer,
      handleOpenGameDetails,
    ]
  );

  // Render typing indicator (premium only)
  const renderTypingIndicator = () => {
    return (
      <AnimatedTypingIndicator
        isVisible={otherUserTyping && isPremium}
        avatarUrl={getUserProfilePhoto(match.otherUser)}
      />
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
  const handleMenuAction = useCallback(action => {
    setShowMenu(false);
    switch (action) {
      case 'viewProfile':
        setIsProfileSheetOpen(true);
        profileSheetRef.current?.open();
        break;
      case 'search':
        setShowChatSearch(true);
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
  }, []);

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

  // Get the live message for reactions detail (derived from messages array)
  const reactionsDetailMessage = useMemo(() => {
    if (!reactionsDetailMessageId) return null;
    return messages.find(m => m.id === reactionsDetailMessageId) || null;
  }, [reactionsDetailMessageId, messages]);

  // Handle reactions sheet close
  const handleReactionsSheetClose = useCallback(() => {
    setReactionsDetailMessageId(null);
    setReactionsTab('all');
  }, []);

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
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.background.primary} />
      {Platform.OS === 'android' && (
        <View
          style={{
            height: StatusBar.currentHeight,
            backgroundColor: theme.colors.background.primary,
          }}
        />
      )}
      <WrapperComponent style={styles.wrapper}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : StatusBar.currentHeight}
        >
          {/* Header */}
          <ChatHeader
            otherUser={match.otherUser}
            matchId={match.matchId}
            isPremium={isPremium}
            onlineStatus={onlineStatus}
            lastSeen={lastSeen}
            isTyping={otherUserTyping}
            onBack={() => navigation.goBack()}
            onProfilePress={() => {
              setIsProfileSheetOpen(true);
              profileSheetRef.current?.open();
            }}
            onMenuPress={() => setShowMenu(true)}
            shockwaveScale={shockwaveScale}
            shockwaveOpacity={shockwaveOpacity}
          />

          {/* Messages */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
          ) : loadError ? (
            <View style={styles.loadingContainer}>
              <Ionicons
                name="alert-circle-outline"
                size={48}
                color={theme.colors.status.error}
                style={{ marginBottom: theme.spacing.md }}
              />
              <Text style={styles.errorStateText}>Couldn&apos;t load messages</Text>
              <TouchableOpacity style={styles.retryButton} onPress={loadMessages}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : !isFocused ? (
            // When the screen is in the background (user switched tabs), render a
            // lightweight placeholder instead of the inverted FlatList. The scaleY:-1
            // transform on inverted FlatLists causes GPU compositor interference with
            // scroll views on other tabs. Messages stay in state — the FlatList
            // re-renders instantly when the user returns.
            <View style={styles.chatContainer} />
          ) : messages.length === 0 ? (
            // Render empty state outside the inverted FlatList — RN's ListEmptyComponent
            // is inconsistently flipped across versions, which can leave the placeholder
            // text upside down. Sibling rendering sidesteps the inversion entirely.
            <View style={[styles.chatContainer, styles.emptyStateContainer]}>
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={48}
                color={theme.colors.text.muted}
              />
              <Text style={styles.emptyStateTitle}>Start the conversation!</Text>
              <Text style={styles.emptyStateSubtitle}>
                Say hi to {getUserDisplayName(match.otherUser)}
              </Text>
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
                // Performance optimization props
                initialNumToRender={15}
                maxToRenderPerBatch={10}
                windowSize={7}
                updateCellsBatchingPeriod={50}
                removeClippedSubviews={Platform.OS === 'android'}
              />

              {/* Scroll to bottom FAB - hidden when profile sheet or reactions panel is open */}
              {!isProfileSheetOpen && !reactionsDetailMessage && (
                <AnimatedScrollToBottom
                  visible={showScrollButton}
                  onPress={() => scrollToBottom(true)}
                />
              )}
            </>
          )}

          {/* Reply Preview */}
          <ChatReplyPreview
            replyTo={replyTo}
            currentUserId={user.uid}
            otherUserName={getUserDisplayName(match.otherUser)}
            onClear={() => setReplyTo(null)}
          />

          {/* Input */}
          <ActiveGameBar
            session={gameSession}
            myId={user.uid}
            expanded={gamePanelExpanded}
            onPress={() => setGamePanelExpanded(previous => !previous)}
          />
          {gamePanelExpanded && (
            <ActiveGamePanel
              session={gameSession}
              myId={user.uid}
              onMove={handleGameMove}
              onEnd={requestEndGame}
              onDismiss={handleEndActiveGame}
              onDetails={() => setRecapSession(gameSession)}
            />
          )}
          <ChatInput
            messageText={messageText}
            onTextChange={handleTypingChange}
            onSend={sendMessage}
            onGifPress={() => setShowGifPicker(true)}
            onGamesPress={gamesAvailable ? () => setShowGamePicker(true) : undefined}
            isRecording={isRecording}
            onRecordingStart={() => setIsRecording(true)}
            onRecordingComplete={(uri, duration, waveform) => {
              setIsRecording(false);
              sendAudio(uri, duration, waveform);
            }}
            onRecordingCancel={() => setIsRecording(false)}
            onRecordingError={error => {
              setIsRecording(false);
              showError('Recording failed', { error });
            }}
            isSending={isSending}
            isUploadingAudio={isUploadingAudio}
            inputRef={inputRef}
          />

          {/* Profile Bottom Sheet - Always rendered but hidden */}
          <ProfileBottomSheet
            ref={profileSheetRef}
            profile={match.otherUser}
            onClose={() => setIsProfileSheetOpen(false)}
          />

          {/* GIF Picker Modal */}
          <GamePickerSheet
            visible={showGamePicker}
            onClose={() => setShowGamePicker(false)}
            onPick={handlePickGame}
            activeSession={gameSession}
            myId={user.uid}
            onEndActive={requestEndGame}
          />

          <TwoTruthsComposer
            visible={showTwoTruthsComposer}
            onClose={() => setShowTwoTruthsComposer(false)}
            onSubmit={handleTwoTruthsSubmit}
          />

          <RouletteComposer
            visible={!!rouletteOffer}
            question={rouletteOffer?.question}
            onClose={() => setRouletteOffer(null)}
            onSubmit={handleRouletteSubmit}
          />

          <RiddlePickerSheet
            visible={!!riddleOffers}
            offers={riddleOffers || []}
            onClose={() => setRiddleOffers(null)}
            onSubmit={handleRiddleSubmit}
          />
          <GifPicker
            visible={showGifPicker}
            onClose={() => setShowGifPicker(false)}
            onSelectGif={sendGif}
          />
        </KeyboardAvoidingView>

        {/* Menu overlay */}
        <ChatMenu
          visible={showMenu}
          onClose={() => setShowMenu(false)}
          onAction={handleMenuAction}
          isMuted={isMuted}
        />

        {/* Reactions detail bottom sheet */}
        <ChatReactionsSheet
          sheetRef={reactionsSheetRef}
          message={reactionsDetailMessage}
          currentUser={user}
          otherUser={match.otherUser}
          activeTab={reactionsTab}
          onTabChange={setReactionsTab}
          onAddReaction={handleAddReactionFromSheet}
          onRemoveReaction={addReaction}
          onClose={handleReactionsSheetClose}
        />

        {/* Emoji Picker for reactions */}
        <EmojiPicker
          onEmojiSelected={handleEmojiSelected}
          open={showReactionPicker !== null}
          onClose={handleCloseEmojiPicker}
          theme={{
            backdrop: '#00000080',
            knob: theme.colors.primary,
            category: {
              icon: theme.colors.text.secondary,
              iconActive: theme.colors.primary,
              container: theme.colors.background.primary,
              containerActive: 'rgba(211, 47, 47, 0.15)',
            },
            search: {
              background: '#f5f5f5',
              placeholder: theme.colors.text.muted,
              text: theme.colors.text.primary,
            },
            header: theme.colors.text.muted,
            skinTonesContainer: theme.colors.background.primary,
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

        {/* End game confirmation */}
        <ConfirmationModal
          visible={showEndGameConfirm}
          title="Done with this game?"
          message="This ends the game for both of you."
          confirmText="I'm done"
          onConfirm={confirmEndGame}
          onCancel={() => setShowEndGameConfirm(false)}
        />

        {/* Game recap — live sessions stay live inside the modal */}
        <GameRecapModal
          visible={!!recapSession}
          session={recapSession && gameSession?.id === recapSession.id ? gameSession : recapSession}
          myId={user.uid}
          onClose={() => setRecapSession(null)}
        />

        {/* Conversation search */}
        <ChatSearchModal
          visible={showChatSearch}
          matchId={match.matchId}
          onClose={() => setShowChatSearch(false)}
          onJumpToMessage={message => {
            setShowChatSearch(false);
            if (reversedMessages.some(m => m.id === message.id)) {
              scrollToMessage(message.id);
            } else {
              showInfo('That message is further up the conversation');
            }
          }}
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
    backgroundColor: theme.colors.background.primary, // White background
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary, // White background for chat content
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
  // Note: Typing indicator and scroll-to-bottom styles now in dedicated components
  errorStateText: {
    fontSize: theme.typography.sizes.lg,
    color: theme.colors.text.secondary,
    fontWeight: theme.typography.weights.medium,
    fontFamily: theme.typography.fontFamily.medium,
    marginBottom: theme.spacing.lg,
  },
  retryButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.xxl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
  },
  retryButtonText: {
    color: theme.colors.text.white,
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.semibold,
    fontFamily: theme.typography.fontFamily.semibold,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.huge,
  },
  emptyStateTitle: {
    marginTop: theme.spacing.md,
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.semibold,
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs,
  },
  emptyStateSubtitle: {
    fontSize: theme.typography.sizes.md,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.muted,
  },
});

export default ChatScreen;
