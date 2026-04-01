import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';

/**
 * ChatReplyPreview - Shows a preview of the message being replied to
 * @param {Object} props
 * @param {Object} props.replyTo - The message being replied to
 * @param {string} props.currentUserId - Current user's ID to determine "You" vs other user name
 * @param {string} props.otherUserName - Display name of the other user in the chat
 * @param {Function} props.onClear - Callback to clear the reply
 */
const ChatReplyPreview = ({ replyTo, currentUserId, otherUserName, onClear }) => {
  if (!replyTo) {
    return null;
  }

  const senderName = replyTo.senderId === currentUserId ? 'You' : otherUserName;

  const messagePreview =
    replyTo.messageType === 'GIF'
      ? 'GIF'
      : replyTo.messageType === 'AUDIO'
        ? 'Voice message'
        : replyTo.content || replyTo.text;

  return (
    <View style={styles.replyPreview}>
      <View style={styles.replyPreviewContent}>
        <View style={styles.replyPreviewBar} />
        <View style={styles.replyPreviewText}>
          <Text style={styles.replyPreviewName}>{senderName}</Text>
          <Text style={styles.replyPreviewMessage} numberOfLines={1}>
            {messagePreview}
          </Text>
        </View>
      </View>
      <TouchableOpacity onPress={onClear} style={styles.replyPreviewClose}>
        <Ionicons name="close" size={20} color="#666" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
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
});

export default ChatReplyPreview;
