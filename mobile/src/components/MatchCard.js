import React, { memo, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';
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
    const shockwaveScale = useRef(new Animated.Value(1)).current;
    const shockwaveOpacity = useRef(new Animated.Value(0.6)).current;

    // Shockwave animation for online dot
    useEffect(() => {
      let shockwaveAnimation;
      if (isOnline) {
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
    }, [isOnline, shockwaveScale, shockwaveOpacity]);

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
            {isOnline && (
              <View style={styles.onlineContainer}>
                <Animated.View
                  style={[
                    styles.onlineShockwave,
                    { transform: [{ scale: shockwaveScale }], opacity: shockwaveOpacity },
                  ]}
                />
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
                    ? 'Sent a GIF 🎬'
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

        <View style={styles.matchBadge}>
          <Text style={styles.matchBadgeText}>💕</Text>
        </View>
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
    color: theme.colors.text.primary,
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
    backgroundColor: '#4CAF50',
    position: 'absolute',
  },
  onlineShockwave: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4CAF50',
    position: 'absolute',
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
    backgroundColor: 'rgba(211, 47, 47, 0.1)',
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  matchBadgeText: {
    fontSize: theme.typography.sizes.sm,
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
  },
  lastMessage: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing.xs,
  },
  unreadLastMessage: {
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text.primary,
  },
  typingText: {
    fontStyle: 'italic',
    color: theme.colors.primary,
  },
  lastMessageTime: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text.muted,
  },
};
