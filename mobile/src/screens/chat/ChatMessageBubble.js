import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Animated, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import AudioMessage from '../../components/AudioMessage';
import { getUserProfilePhoto, getUserDisplayName } from '../../utils/profileHelpers';
import { theme } from '../../styles/theme';

/**
 * ChatMessageBubble - Renders an individual chat message with swipe-to-reply,
 * reactions, quoted replies, and read receipts.
 */
const ChatMessageBubble = ({
  message,
  isOwnMessage,
  showAvatar,
  isLastInGroup,
  isTapped,
  otherUser,
  currentUser,
  isPremium,
  onTap,
  onLongPress,
  onSwipeToReply,
  onReactionsPress,
  onQuotedReplyPress,
  onPhotoPress,
  swipeableRef,
}) => {
  const isHighlighted = isTapped;
  // Show timestamp for last in group OR when tapped (iMessage-style tap to reveal)
  const showTimestamp = isLastInGroup || isTapped;

  // Determine if we're quoting ourselves or the other person
  const isQuotingSelf = message.replyTo?.senderId === currentUser.uid;

  // Render swipe action for own messages (swipe left to reveal on right)
  const renderRightActions = (progress, dragX) => {
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
  };

  // Render swipe action for other's messages (swipe right to reveal on left)
  const renderLeftActions = (progress, dragX) => {
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
  };

  // Render reactions display
  const renderReactions = () => {
    if (!message.reactions || Object.keys(message.reactions).length === 0) {
      return null;
    }

    const reactionEntries = Object.entries(message.reactions).filter(
      ([, users]) => users.length > 0
    );

    const MAX_VISIBLE = 3;

    // Prioritize showing at least one reaction from each person
    // First, find reactions unique to each person
    const myReactions = reactionEntries.filter(
      ([, users]) => users.includes(currentUser.uid) && users.length === 1
    );
    const theirReactions = reactionEntries.filter(([, users]) => !users.includes(currentUser.uid));
    const sharedReactions = reactionEntries.filter(
      ([, users]) => users.includes(currentUser.uid) && users.length > 1
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
      2: '\u00B2',
      3: '\u00B3',
      4: '\u2074',
      5: '\u2075',
      6: '\u2076',
      7: '\u2077',
      8: '\u2078',
      9: '\u2079',
    };
    const getSuperscript = count => (count > 1 ? superscripts[count] || `\u207A${count}` : '');

    return (
      <TouchableOpacity
        style={[
          styles.reactionsContainer,
          isOwnMessage ? styles.ownReactionsContainer : styles.otherReactionsContainer,
        ]}
        onPress={() => onReactionsPress(message)}
        activeOpacity={0.8}
      >
        {visibleReactions.map(([emoji, users]) => (
          <Text key={emoji} style={styles.reactionEmoji}>
            {emoji}
            {users.length > 1 && (
              <Text style={styles.reactionSuperscript}>{getSuperscript(users.length)}</Text>
            )}
          </Text>
        ))}
        {hiddenCount > 0 && <Text style={styles.reactionOverflow}>+{hiddenCount}</Text>}
      </TouchableOpacity>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={isOwnMessage ? renderRightActions : undefined}
      renderLeftActions={isOwnMessage ? undefined : renderLeftActions}
      onSwipeableOpen={direction => {
        if ((isOwnMessage && direction === 'right') || (!isOwnMessage && direction === 'left')) {
          onSwipeToReply(message);
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
            <Image source={{ uri: getUserProfilePhoto(otherUser) }} style={styles.messageAvatar} />
          )}
          {!isOwnMessage && !showAvatar && <View style={styles.avatarPlaceholder} />}

          <View style={[styles.messageBubbleContainer, isOwnMessage && styles.ownBubbleContainer]}>
            {/* Quoted Reply - Separate element above the message bubble */}
            {message.replyTo && (
              <TouchableOpacity
                style={[
                  styles.quotedReplyStandalone,
                  isOwnMessage
                    ? styles.ownQuotedReplyStandalone
                    : styles.otherQuotedReplyStandalone,
                  isQuotingSelf ? styles.quotingSelfStandalone : styles.quotingOtherStandalone,
                ]}
                onPress={() => onQuotedReplyPress(message.replyTo.id)}
                activeOpacity={0.7}
              >
                <Image
                  source={{
                    uri: isQuotingSelf
                      ? getUserProfilePhoto(currentUser)
                      : getUserProfilePhoto(otherUser),
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
                    {message.replyTo.senderId === currentUser.uid
                      ? 'You'
                      : message.replyTo.senderName || getUserDisplayName(otherUser)}
                  </Text>
                  <Text
                    style={[
                      styles.quotedReplyText,
                      isQuotingSelf ? styles.quotingSelfText : styles.quotingOtherText,
                    ]}
                    numberOfLines={2}
                  >
                    {message.replyTo.messageType === 'GIF'
                      ? '\uD83D\uDCF7 GIF'
                      : message.replyTo.messageType === 'AUDIO'
                        ? '\uD83C\uDFA4 Voice message'
                        : message.replyTo.content || message.replyTo.text}
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            <Pressable
              onPress={() => onTap(message)}
              onLongPress={() => onLongPress(message)}
              delayLongPress={500}
              style={({ pressed }) => [
                styles.messageBubble,
                isOwnMessage ? styles.ownMessageBubble : styles.otherMessageBubble,
                message.messageType === 'AUDIO' && styles.audioBubble,
                message.isTemp && styles.tempMessage,
                pressed && styles.messageBubblePressed,
                isHighlighted && styles.highlightedMessage,
              ]}
            >
              {message.messageType === 'GIF' ? (
                <TouchableOpacity
                  onPress={() => onPhotoPress([message.mediaUrl || message.content], 0)}
                  onLongPress={() => onLongPress(message)}
                  delayLongPress={500}
                  activeOpacity={0.9}
                >
                  <Image
                    source={{ uri: message.mediaUrl || message.content }}
                    style={styles.gifMessage}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ) : message.messageType === 'AUDIO' ? (
                <AudioMessage
                  messageId={message.id}
                  audioUrl={message.mediaUrl}
                  isOwnMessage={isOwnMessage}
                  duration={message.duration}
                  metadata={message.metadata}
                />
              ) : (
                <Text style={[styles.messageText, isOwnMessage && styles.ownMessageText]}>
                  {message.text || message.content || ''}
                </Text>
              )}
            </Pressable>

            {/* Reactions - Android Messages style, overlapping the bubble */}
            {renderReactions()}

            {/* Timestamp for all messages, read receipts only for own messages */}
            {showTimestamp && (
              <View style={[styles.messageStatus, !isOwnMessage && styles.otherMessageStatus]}>
                <Text style={styles.messageTime}>
                  {message.createdAt
                    ? new Date(message.createdAt).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })
                    : ''}
                </Text>
                {/* Read receipts only for own messages */}
                {isOwnMessage &&
                  (isPremium ? (
                    message.isRead ? (
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

const styles = StyleSheet.create({
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
});

export default ChatMessageBubble;
