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
  errorDetails = null, // { name, message, stack, code, status }
  timestamp = null,
}) => {
  const insets = useSafeAreaInsets();
  // Start off-screen at top (negative value = above screen)
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
      toValue: -100, // Slide up off screen
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      onHideRef.current?.();
    });
  }, [slideAnim]);

  useEffect(() => {
    if (visible) {
      setShowModal(false);

      // Reset position before animating
      slideAnim.setValue(-100);

      // Slide down into view
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 80,
        friction: 10,
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
          backgroundColor: '#333',
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
    // Log the full error details for debugging
    Logger.info('Error report requested:', {
      message,
      errorDetails,
      timestamp,
    });
    // TODO: Could integrate with Sentry or email reporting here
    handleCloseModal();
  };

  const formatTimestamp = ts => {
    if (!ts) return null;
    try {
      const date = new Date(ts);
      return date.toLocaleString();
    } catch {
      return ts;
    }
  };

  const formatStack = stack => {
    if (!stack) return null;
    // Clean up the stack trace for readability
    return stack
      .split('\n')
      .slice(0, 10) // Limit to first 10 lines
      .join('\n');
  };

  const handleCloseModal = () => {
    setShowModal(false);
    hideToast();
  };

  if (!visible) return null;

  const toastStyle = getToastStyle();
  // Position below safe area at top, with extra padding to not cover back button
  const topOffset = insets.top + 8;

  return (
    <>
      <Animated.View
        style={[
          styles.container,
          {
            top: topOffset,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.toast, { backgroundColor: toastStyle.backgroundColor }]}
          onPress={type === 'error' ? handleToastPress : undefined}
          activeOpacity={type === 'error' ? 0.8 : 1}
          disabled={type !== 'error'}
        >
          <View style={styles.messageContainer}>
            <Ionicons name={toastStyle.iconName} size={18} color="#fff" style={styles.icon} />
            <View style={styles.messageTextContainer}>
              <Text style={styles.message} numberOfLines={2}>
                {message}
              </Text>
              {type === 'error' && <Text style={styles.tapHint}>Tap for details</Text>}
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
              <Ionicons name="close" size={16} color="#fff" />
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

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={true}>
              {/* User-friendly message */}
              <Text style={styles.modalMessage} selectable>
                {message}
              </Text>

              {/* Timestamp */}
              {timestamp && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>Time</Text>
                  <Text style={styles.detailValue} selectable>
                    {formatTimestamp(timestamp)}
                  </Text>
                </View>
              )}

              {/* Error Details */}
              {errorDetails && (
                <>
                  {/* Error Type */}
                  {errorDetails.name && errorDetails.name !== 'Error' && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>Error Type</Text>
                      <Text style={styles.detailValue} selectable>
                        {errorDetails.name}
                      </Text>
                    </View>
                  )}

                  {/* Error Code/Status */}
                  {(errorDetails.code || errorDetails.status) && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>
                        {errorDetails.code ? 'Error Code' : 'Status'}
                      </Text>
                      <Text style={styles.detailValue} selectable>
                        {errorDetails.code || errorDetails.status}
                      </Text>
                    </View>
                  )}

                  {/* Technical Error Message */}
                  {errorDetails.message && errorDetails.message !== message && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>Technical Details</Text>
                      <Text style={styles.detailValueMono} selectable>
                        {errorDetails.message}
                      </Text>
                    </View>
                  )}

                  {/* Stack Trace */}
                  {errorDetails.stack && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>Stack Trace</Text>
                      <View style={styles.stackContainer}>
                        <Text style={styles.stackTrace} selectable>
                          {formatStack(errorDetails.stack)}
                        </Text>
                      </View>
                    </View>
                  )}
                </>
              )}

              {/* No error details available */}
              {!errorDetails && (
                <View style={styles.detailSection}>
                  <Text style={styles.noDetailsText}>No additional error details available.</Text>
                </View>
              )}
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
    left: 16,
    right: 16,
    zIndex: 9999,
    alignItems: 'center', // Center the toast horizontally
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20, // More pill-shaped
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
    maxWidth: '100%', // Don't exceed container
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1, // Allow shrinking
  },
  messageTextContainer: {
    flexShrink: 1,
  },
  icon: {
    marginRight: 8,
  },
  message: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
    lineHeight: 18,
  },
  tapHint: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
  },
  actionButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 6,
    marginRight: 6,
  },
  actionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  closeButton: {
    padding: 2,
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
    flex: 1,
    padding: 20,
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
  // Error details styles
  detailSection: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  detailValueMono: {
    fontSize: 13,
    color: '#333',
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  stackContainer: {
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
  },
  stackTrace: {
    fontSize: 11,
    color: '#666',
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  noDetailsText: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
  },
});

export default Toast;
