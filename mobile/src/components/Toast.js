import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const Toast = ({
  message,
  type = 'info', // 'success', 'error', 'warning', 'info'
  visible,
  onHide,
  autoHide = true,
  duration = 4000,
  action = null, // { text: 'Retry', onPress: () => {} }
}) => {
  const insets = useSafeAreaInsets();
  const [slideAnim] = useState(new Animated.Value(-100));
  const onHideRef = useRef(onHide);
  const timerRef = useRef(null);
  const [expanded, setExpanded] = useState(false);

  // Keep onHide reference fresh
  useEffect(() => {
    onHideRef.current = onHide;
  }, [onHide]);

  const hideToast = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: -100,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      // Use ref to avoid stale closure
      onHideRef.current?.();
    });
  }, [slideAnim]);

  useEffect(() => {
    if (visible) {
      // Reset expanded state when new toast appears
      setExpanded(false);

      // Slide down
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Auto hide after duration only if autoHide is true and not expanded
      if (autoHide && !expanded) {
        timerRef.current = setTimeout(() => {
          hideToast();
        }, duration);
      }

      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      };
    }
  }, [visible, autoHide, duration, hideToast, slideAnim, expanded]);

  const getToastStyle = () => {
    switch (type) {
      case 'success':
        return {
          backgroundColor: '#4CAF50',
          iconName: 'checkmark-circle',
        };
      case 'error':
        return {
          backgroundColor: '#F44336',
          iconName: 'alert-circle',
        };
      case 'warning':
        return {
          backgroundColor: '#FF9800',
          iconName: 'warning',
        };
      default:
        return {
          backgroundColor: '#2196F3',
          iconName: 'information-circle',
        };
    }
  };

  if (!visible) return null;

  const toastStyle = getToastStyle();

  // Check if message is long enough to need expansion
  const isLongMessage = message && message.length > 60;

  const handleMessagePress = () => {
    if (isLongMessage) {
      setExpanded(!expanded);
      // Clear auto-hide timer when expanded
      if (!expanded && timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: toastStyle.backgroundColor,
          paddingTop: insets.top + 10,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.content}>
        <TouchableOpacity
          style={styles.messageContainer}
          onPress={handleMessagePress}
          activeOpacity={isLongMessage ? 0.7 : 1}
        >
          <Ionicons name={toastStyle.iconName} size={20} color="#fff" style={styles.icon} />
          <View style={styles.messageTextContainer}>
            <Text style={styles.message} numberOfLines={expanded ? undefined : 2}>
              {message}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.actions}>
          {action && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                action.onPress();
                hideToast();
              }}
            >
              <Text style={styles.actionText}>{action.text}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.closeButton} onPress={hideToast}>
            <Ionicons name="close" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingHorizontal: 15,
    paddingBottom: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  messageContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  messageTextContainer: {
    flex: 1,
  },
  icon: {
    marginRight: 10,
    marginTop: 2,
  },
  message: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
    marginRight: 8,
  },
  actionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
});

export default Toast;
