import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Modal,
  ScrollView,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Logger from '../utils/logger';

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
  const [showModal, setShowModal] = useState(false);

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
      onHideRef.current?.();
    });
  }, [slideAnim]);

  useEffect(() => {
    if (visible) {
      setShowModal(false);

      // Slide down
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Auto hide after duration
      if (autoHide) {
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
  }, [visible, autoHide, duration, hideToast, slideAnim]);

  const getToastStyle = () => {
    switch (type) {
      case 'success':
        return {
          backgroundColor: '#4CAF50',
          iconName: 'checkmark-circle',
          title: 'Success',
        };
      case 'error':
        return {
          backgroundColor: '#F44336',
          iconName: 'alert-circle',
          title: 'Error',
        };
      case 'warning':
        return {
          backgroundColor: '#FF9800',
          iconName: 'warning',
          title: 'Warning',
        };
      default:
        return {
          backgroundColor: '#2196F3',
          iconName: 'information-circle',
          title: 'Info',
        };
    }
  };

  const handleToastPress = () => {
    // Clear auto-hide timer when opening modal
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setShowModal(true);
  };

  const handleReportError = () => {
    // TODO: Implement error reporting (email, API, etc.)
    Logger.info('Error report requested:', message);
    handleCloseModal();
  };

  const handleCloseModal = () => {
    setShowModal(false);
    hideToast();
  };

  if (!visible) return null;

  const toastStyle = getToastStyle();

  return (
    <>
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
        <TouchableOpacity style={styles.content} onPress={handleToastPress} activeOpacity={0.8}>
          <View style={styles.messageContainer}>
            <Ionicons name={toastStyle.iconName} size={20} color="#fff" style={styles.icon} />
            <View style={styles.messageTextContainer}>
              <Text style={styles.message} numberOfLines={2}>
                {message}
              </Text>
              <Text style={styles.tapHint}>Tap for details</Text>
            </View>
          </View>

          <View style={styles.actions}>
            {action && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={e => {
                  e.stopPropagation();
                  action.onPress();
                  hideToast();
                }}
              >
                <Text style={styles.actionText}>{action.text}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.closeButton}
              onPress={e => {
                e.stopPropagation();
                hideToast();
              }}
            >
              <Ionicons name="close" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* Error Details Modal */}
      <Modal visible={showModal} transparent animationType="fade" onRequestClose={handleCloseModal}>
        <Pressable style={styles.modalOverlay} onPress={handleCloseModal}>
          <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
            <View style={[styles.modalHeader, { backgroundColor: toastStyle.backgroundColor }]}>
              <Ionicons name={toastStyle.iconName} size={24} color="#fff" />
              <Text style={styles.modalTitle}>{toastStyle.title}</Text>
              <TouchableOpacity onPress={handleCloseModal} style={styles.modalCloseButton}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.modalMessage} selectable>
                {message}
              </Text>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.reportButton]}
                onPress={handleReportError}
              >
                <Ionicons name="mail-outline" size={18} color="#555" />
                <Text style={styles.reportButtonText}>Report</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.dismissButton]}
                onPress={handleCloseModal}
              >
                <Text style={styles.dismissButtonText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
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
    shadowOffset: { width: 0, height: 2 },
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
    fontSize: 15,
    color: '#fff',
    fontWeight: '500',
    lineHeight: 20,
  },
  tapHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: '70%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  modalTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 12,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    padding: 20,
    maxHeight: 300,
  },
  modalMessage: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  reportButton: {
    backgroundColor: '#f5f5f5',
  },
  reportButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#555',
  },
  dismissButton: {
    backgroundColor: '#333',
  },
  dismissButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});

export default Toast;
