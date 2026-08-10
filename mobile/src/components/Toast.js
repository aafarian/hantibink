import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Pressable,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../styles/theme';
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
          backgroundColor: theme.colors.status.success,
          iconName: 'checkmark-circle',
          title: 'Success',
        };
      case 'error':
        return {
          backgroundColor: theme.colors.status.error,
          iconName: 'alert-circle',
          title: 'Error',
        };
      case 'warning':
        return {
          backgroundColor: theme.colors.status.warning,
          iconName: 'warning',
          title: 'Warning',
        };
      default:
        return {
          backgroundColor: theme.colors.text.primary,
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
            <Ionicons
              name={toastStyle.iconName}
              size={18}
              color={theme.colors.text.white}
              style={styles.icon}
            />
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
              <Ionicons name="close" size={16} color={theme.colors.text.white} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* Error Details Modal */}
      <Modal visible={showModal} transparent animationType="fade" onRequestClose={handleCloseModal}>
        <View style={styles.modalContainer}>
          {/* Backdrop - tap to close */}
          <Pressable style={styles.modalBackdrop} onPress={handleCloseModal} />
          {/* Modal content - not a child of Pressable so ScrollView works */}
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={[styles.modalHeader, { backgroundColor: toastStyle.backgroundColor }]}>
              <Ionicons name={toastStyle.iconName} size={24} color={theme.colors.text.white} />
              <Text style={styles.modalTitle}>{toastStyle.title}</Text>
              <TouchableOpacity onPress={handleCloseModal} style={styles.modalCloseButton}>
                <Ionicons name="close" size={24} color={theme.colors.text.white} />
              </TouchableOpacity>
            </View>

            {/* User-friendly message - fixed at top */}
            <View style={styles.modalBody}>
              <Text style={styles.modalMessage} selectable>
                {message}
              </Text>
            </View>

            {/* Scrollable technical details */}
            <ScrollView style={styles.detailsScroll}>
              {/* Timestamp */}
              {timestamp && (
                <View style={styles.detailItem}>
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
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Error Type</Text>
                      <Text style={styles.detailValue} selectable>
                        {errorDetails.name}
                      </Text>
                    </View>
                  )}

                  {/* Error Code/Status */}
                  {(errorDetails.code || errorDetails.status) && (
                    <View style={styles.detailItem}>
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
                    <View style={styles.detailItem}>
                      <Text style={styles.detailLabel}>Technical Details</Text>
                      <Text style={styles.detailValueMono} selectable>
                        {errorDetails.message}
                      </Text>
                    </View>
                  )}

                  {/* Stack Trace */}
                  {errorDetails.stack && (
                    <View style={styles.detailItem}>
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
                <View style={styles.detailItem}>
                  <Text style={styles.noDetailsText}>No additional error details available.</Text>
                </View>
              )}
            </ScrollView>

            {/* Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.reportButton]}
                onPress={handleReportError}
              >
                <Ionicons name="mail-outline" size={18} color={theme.colors.text.secondary} />
                <Text style={styles.reportButtonText}>Report</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.dismissButton]}
                onPress={handleCloseModal}
              >
                <Text style={styles.dismissButtonText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
    shadowColor: theme.colors.shadow,
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
    color: theme.colors.text.white,
    fontWeight: '500',
    lineHeight: 18,
  },
  tapHint: {
    fontSize: 11,
    color: `${theme.colors.text.white}B3`, // 70% opacity
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
    backgroundColor: `${theme.colors.text.white}33`, // 20% opacity
    borderRadius: 6,
    marginRight: 6,
  },
  actionText: {
    color: theme.colors.text.white,
    fontSize: 13,
    fontWeight: '600',
  },
  closeButton: {
    padding: 2,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.overlay.medium,
  },
  modalContent: {
    backgroundColor: theme.colors.background.primary,
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: '75%',
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
    color: theme.colors.text.white,
    marginLeft: 12,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  detailsScroll: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.light,
    paddingHorizontal: 20,
    maxHeight: 280,
  },
  detailItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.background.tertiary,
  },
  modalMessage: {
    fontSize: 15,
    color: theme.colors.text.primary,
    lineHeight: 22,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border.light,
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
    backgroundColor: theme.colors.background.secondary,
  },
  reportButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.colors.text.secondary,
  },
  dismissButton: {
    backgroundColor: theme.colors.text.primary,
  },
  dismissButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text.white,
  },
  // Error details styles
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    color: theme.colors.text.primary,
    lineHeight: 20,
  },
  detailValueMono: {
    fontSize: 13,
    color: theme.colors.text.primary,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  stackContainer: {
    backgroundColor: theme.colors.background.secondary,
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
  },
  stackTrace: {
    fontSize: 11,
    color: theme.colors.text.secondary,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  noDetailsText: {
    fontSize: 14,
    color: theme.colors.text.muted,
    fontStyle: 'italic',
  },
});

export default Toast;
