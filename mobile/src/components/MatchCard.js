import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';
import {
  getUserProfilePhoto,
  getUserDisplayName,
  getUserAge,
  getUserLocation,
} from '../utils/profileHelpers';
import ClickablePhoto from './shared/ClickablePhoto';
import { usePhotoViewer } from '../contexts/PhotoViewerContext';

export const MatchCard = ({
  match,
  onPress,
  onMessagePress,
  showMessageButton = true,
  style = {},
  unreadCount = 0,
  showLastMessage = false,
}) => {
  const user = match.otherUser || match;
  const profilePhotoUrl = getUserProfilePhoto(user);
  const { openProfileSheet } = usePhotoViewer();

  const profileActionButtons = onMessagePress
    ? [
        {
          icon: 'chatbubble',
          label: 'Message',
          onPress: onMessagePress,
          style: { backgroundColor: '#FF6B6B' },
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
        <Text style={styles.name}>
          {getUserDisplayName(user)}
          {getUserAge(user) ? `, ${getUserAge(user)}` : ''}
        </Text>
        {showLastMessage ? (
          <>
            {/* Show latest message and timestamp for conversation list */}
            <Text style={styles.lastMessage} numberOfLines={1}>
              {match.lastMessage || 'Start a conversation...'}
            </Text>
            <Text style={styles.lastMessageTime} numberOfLines={1}>
              {match.lastMessageTime
                ? new Date(match.lastMessageTime).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Recently matched'}
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

      <View style={styles.matchBadge}>
        <Text style={styles.matchBadgeText}>💕</Text>
      </View>
    </TouchableOpacity>
  );
};

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
  name: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.xs,
  },
  location: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.xs,
  },
  bio: {
    fontSize: theme.typography.sizes.sm,
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
  },
  matchBadge: {
    backgroundColor: '#FFE4E1',
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  matchBadgeText: {
    fontSize: theme.typography.sizes.sm,
  },
  unreadBadge: {
    backgroundColor: '#FF6B6B',
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
  },
  lastMessage: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.xs,
  },
  lastMessageTime: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text.muted,
  },
};
