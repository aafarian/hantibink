import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';

/**
 * ChatMenu - Dropdown menu overlay for chat actions
 *
 * @param {Object} props
 * @param {boolean} props.visible - Whether the menu is visible
 * @param {function} props.onClose - Callback when menu should close
 * @param {function} props.onAction - Callback when a menu item is selected, receives action id
 * @param {boolean} props.isMuted - Whether notifications are currently muted (for dynamic label)
 */
const ChatMenu = ({ visible, onClose, onAction, isMuted, gamesInfo }) => {
  if (!visible) return null;

  const menuItems = [
    {
      id: 'search',
      icon: 'search',
      label: 'Search in conversation',
      color: theme.colors.text.primary,
    },
    { id: 'viewProfile', icon: 'person', label: 'View profile', color: theme.colors.text.primary },
    {
      id: 'mute',
      icon: isMuted ? 'notifications' : 'notifications-off',
      label: isMuted ? 'Unmute notifications' : 'Mute notifications',
      color: theme.colors.text.primary,
    },
    {
      id: 'toggleChatGames',
      icon: 'game-controller',
      label: gamesInfo?.mutedByMe ? 'Allow games in this chat' : 'Turn off games in this chat',
      color: theme.colors.text.primary,
    },
    {
      id: 'toggleAllGames',
      icon: 'game-controller-outline',
      label: gamesInfo?.myGlobalEnabled
        ? 'Turn off games in all chats'
        : 'Turn on games in all chats',
      color: theme.colors.text.primary,
    },
    { id: 'block', icon: 'ban', label: 'Block user', color: theme.colors.status.warning },
    { id: 'unmatch', icon: 'heart-dislike', label: 'Unmatch', color: theme.colors.status.error },
    { id: 'report', icon: 'flag', label: 'Report user', color: theme.colors.status.error },
  ];

  return (
    <View style={styles.menuOverlay}>
      <Pressable style={styles.menuBackdrop} onPress={onClose} />
      <View style={styles.menuContainer}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.menuItem, index === menuItems.length - 1 && styles.menuItemLast]}
            onPress={() => onAction(item.id)}
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

const styles = StyleSheet.create({
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
    backgroundColor: theme.colors.background.primary,
    borderRadius: 12,
    paddingVertical: 8,
    minWidth: 220,
    shadowColor: theme.colors.shadow,
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
    borderBottomColor: theme.colors.background.tertiary,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuItemText: {
    fontSize: 15,
    marginLeft: 12,
    fontWeight: '400',
    fontFamily: theme.typography.fontFamily.regular,
  },
});

export default ChatMenu;
