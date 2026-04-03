import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import ReanimatedAnimated from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { getUserProfilePhoto, getUserDisplayName } from '../../utils/profileHelpers';
import { formatLastSeen } from '../../utils/timeHelpers';
import { theme } from '../../styles/theme';
import {
  createSharedTag,
  SharedTagPrefixes,
  TransitionPresets,
} from '../../utils/sharedElementTransition';

/**
 * Chat header component displaying user info, online status, and navigation controls
 * @param {Object} props
 * @param {Object} props.otherUser - The other user in the conversation
 * @param {string} props.matchId - The match ID for shared element transitions
 * @param {boolean} props.isPremium - Whether the current user has premium
 * @param {boolean} props.onlineStatus - Whether the other user is online
 * @param {Date|null} props.lastSeen - Last seen timestamp for the other user
 * @param {boolean} props.isTyping - Whether the other user is typing
 * @param {Function} props.onBack - Callback when back button is pressed
 * @param {Function} props.onProfilePress - Callback when profile area is pressed
 * @param {Function} props.onMenuPress - Callback when menu button is pressed
 * @param {Animated.Value} props.shockwaveScale - Animation value for shockwave scale
 * @param {Animated.Value} props.shockwaveOpacity - Animation value for shockwave opacity
 */
const ChatHeader = ({
  otherUser,
  matchId,
  isPremium,
  onlineStatus,
  lastSeen,
  isTyping,
  onBack,
  onProfilePress,
  onMenuPress,
  shockwaveScale,
  shockwaveOpacity,
}) => {
  // Generate shared transition tag for profile photo morphing between screens
  const sharedPhotoTag = matchId ? createSharedTag(SharedTagPrefixes.CHAT_AVATAR, matchId) : null;
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color={theme.colors.text.primary} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.headerProfile} onPress={onProfilePress}>
        <ReanimatedAnimated.Image
          source={{ uri: getUserProfilePhoto(otherUser) }}
          style={styles.headerAvatar}
          sharedTransitionTag={sharedPhotoTag}
          sharedTransitionStyle={sharedPhotoTag ? TransitionPresets.smooth : undefined}
        />
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{getUserDisplayName(otherUser)}</Text>
          <View style={styles.statusRow}>
            {isPremium && isTyping ? (
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

      <TouchableOpacity style={styles.menuButton} onPress={onMenuPress}>
        <Ionicons name="ellipsis-vertical" size={20} color={theme.colors.text.primary} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.background.tertiary,
    backgroundColor: theme.colors.background.primary,
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
    color: theme.colors.text.primary,
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
    color: theme.colors.text.secondary,
  },
  menuButton: {
    padding: 8,
  },
  premiumHint: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  premiumDiamond: {
    marginLeft: 2,
  },
});

export default ChatHeader;
