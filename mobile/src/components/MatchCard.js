import React, { memo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';
import OnlineShockwave from './shared/OnlineShockwave';
import VerifiedBadge from './shared/VerifiedBadge';
import {
  getUserProfilePhoto,
  getUserDisplayName,
  getUserAge,
  getUserLocation,
} from '../utils/profileHelpers';
import { isUserOnline } from '../utils/userHelpers';
import { formatRelativeTime } from '../utils/timeHelpers';
import ClickablePhoto from './shared/ClickablePhoto';
import { usePhotoViewer } from '../contexts/PhotoViewerContext';
import { useIsPremium } from '../contexts/FeatureFlagsContext';

export const MatchCard = memo(
  ({
    match,
    onPress,
    onMessagePress,
    showMessageButton = true,
    style = {},
    unreadCount = 0,
    showLastMessage = false,
  }) => {
    const isPremium = useIsPremium();
    const user = match.otherUser || match;
    const profilePhotoUrl = getUserProfilePhoto(user);
    const { openProfileSheet } = usePhotoViewer();

    // Online status (premium only)
    const isOnline = isPremium && isUserOnline(user.lastActive);
    // Normalize lastMessage to always be a string
    const lastMessageText =
      typeof match.lastMessage === 'string' ? match.lastMessage : match.lastMessage?.content || '';

    const profileActionButtons = onMessagePress
      ? [
          {
            icon: 'chatbubble',
            label: 'Message',
            onPress: onMessagePress,
            style: { backgroundColor: theme.colors.primary },
          },
        ]
      : [];

    const handlePhotoPress = () => {
      openProfileSheet({
        profile: user,
        actionButtons: profileActionButtons,
      });
    };

    const handleCardPress = () => {
      if (onPress) {
        onPress();
      } else {
        // If no onPress provided, show profile by default
        openProfileSheet({
          profile: user,
          actionButtons: profileActionButtons,
        });
      }
    };

    return (
      <TouchableOpacity
        style={[styles.container, style]}
        onPress={handleCardPress}
        activeOpacity={0.7}
      >
        <ClickablePhoto
          photo={profilePhotoUrl}
          photos={user.photos || [profilePhotoUrl]}
          size={60}
          borderRadius={30}
          showExpandIcon={false}
          onPress={handlePhotoPress}
          style={styles.photo}
        />

        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>
              {getUserDisplayName(user)}
              {getUserAge(user) ? `, ${getUserAge(user)}` : ''}
            </Text>
            {user.isVerified && <VerifiedBadge size={14} style={styles.verifiedBadge} />}
            {isOnline && (
              <View style={styles.onlineContainer}>
                <OnlineShockwave size={10} />
                <View style={styles.onlineDot} />
              </View>
            )}
          </View>
          {showLastMessage ? (
            <>
              {/* Show latest message and timestamp for conversation list */}
              <Text
                style={[
                  styles.lastMessage,
                  isPremium && match.isTyping && styles.typingText,
                  unreadCount > 0 && !(isPremium && match.isTyping) && styles.unreadLastMessage,
                ]}
                numberOfLines={1}
              >
                {isPremium && match.isTyping
                  ? `${match.typingUser || 'Someone'} is typing...`
                  : lastMessageText.includes('giphy.com') ||
                      lastMessageText.includes('media.giphy') ||
                      lastMessageText === '[GIF]'
                    ? 'Sent a GIF'
                    : lastMessageText || 'Start a conversation...'}
              </Text>
              <Text style={styles.lastMessageTime} numberOfLines={1}>
                {formatRelativeTime(match.lastMessageTime || match.matchedAt) || 'New match'}
              </Text>
            </>
          ) : (
            <>
              {/* Show location and bio for regular match cards */}
              <Text style={styles.location} numberOfLines={1}>
                {getUserLocation(user)}
              </Text>
              <Text style={styles.bio} numberOfLines={2}>
                {user.bio || 'No bio available'}
              </Text>
            </>
          )}
        </View>

        {showMessageButton && (
          <TouchableOpacity
            style={styles.messageButton}
            onPress={e => {
              e.stopPropagation();
              onMessagePress?.();
            }}
          >
            <Ionicons name="chatbubble" size={16} color={theme.colors.text.white} />
            <Text style={styles.messageButtonText}>Message</Text>
          </TouchableOpacity>
        )}

        {/* Unread count badge */}
        {unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  }
);

const styles = {
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadows.small,
  },
  photo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: theme.spacing.lg,
  },
  info: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  name: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.text.primary,
  },
  verifiedBadge: {
    marginLeft: theme.spacing.xs,
  },
  onlineContainer: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: theme.spacing.xs,
  },
  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.status.success,
    position: 'absolute',
  },
  location: {
    fontSize: theme.typography.sizes.md,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.xs,
  },
  bio: {
    fontSize: theme.typography.sizes.sm,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.muted,
  },
  messageButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: theme.spacing.sm,
  },
  messageButtonText: {
    color: theme.colors.text.white,
    fontSize: theme.typography.sizes.sm,
    marginLeft: theme.spacing.xs,
    fontWeight: theme.typography.weights.medium,
    fontFamily: theme.typography.fontFamily.medium,
  },
  unreadBadge: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.sm,
  },
  unreadText: {
    color: theme.colors.text.white,
    fontSize: 12,
    fontWeight: theme.typography.weights.bold,
    fontFamily: theme.typography.fontFamily.bold,
  },
  lastMessage: {
    fontSize: theme.typography.sizes.md,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.xs,
  },
  unreadLastMessage: {
    fontWeight: theme.typography.weights.semibold,
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.text.primary,
  },
  typingText: {
    fontStyle: 'italic',
    color: theme.colors.primary,
  },
  lastMessageTime: {
    fontSize: theme.typography.sizes.sm,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.muted,
  },
};
