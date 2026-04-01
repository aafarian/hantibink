import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * ChatMenu - Dropdown menu overlay for chat actions
 *
 * @param {Object} props
 * @param {boolean} props.visible - Whether the menu is visible
 * @param {function} props.onClose - Callback when menu should close
 * @param {function} props.onAction - Callback when a menu item is selected, receives action id
 * @param {boolean} props.isMuted - Whether notifications are currently muted (for dynamic label)
 */
const ChatMenu = ({ visible, onClose, onAction, isMuted }) => {
  if (!visible) return null;

  const menuItems = [
    { id: 'search', icon: 'search', label: 'Search in conversation', color: '#333' },
    { id: 'viewProfile', icon: 'person', label: 'View profile', color: '#333' },
    {
      id: 'mute',
      icon: isMuted ? 'notifications' : 'notifications-off',
      label: isMuted ? 'Unmute notifications' : 'Mute notifications',
      color: '#333',
    },
    { id: 'block', icon: 'ban', label: 'Block user', color: '#FF9800' },
    { id: 'unmatch', icon: 'heart-dislike', label: 'Unmatch', color: '#F44336' },
    { id: 'report', icon: 'flag', label: 'Report user', color: '#F44336' },
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

export default ChatMenu;
