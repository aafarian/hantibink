import React from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, Platform, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';
import Logger from '../utils/logger';

const ForceUpdateModal = ({
  visible,
  latestVersion,
  currentVersion,
  updateMessage,
  storeUrls,
  isRequired = true, // If true, user can't dismiss
  onDismiss,
}) => {
  const handleUpdate = () => {
    const storeUrl = Platform.OS === 'ios' ? storeUrls?.ios : storeUrls?.android;
    if (storeUrl) {
      Linking.openURL(storeUrl).catch(error => {
        Logger.error('Failed to open store URL, trying fallback:', error);
        // Fallback - try to open app store directly
        if (Platform.OS === 'ios') {
          Linking.openURL('itms-apps://apps.apple.com').catch(err =>
            Logger.error('Fallback URL also failed:', err)
          );
        } else {
          Linking.openURL('market://details?id=com.antoafarian.hantibink').catch(err =>
            Logger.error('Fallback URL also failed:', err)
          );
        }
      });
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={isRequired ? undefined : onDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <Ionicons name="arrow-up-circle" size={60} color={theme.colors.primary} />
          </View>

          {/* Title */}
          <Text style={styles.title}>{isRequired ? 'Update Required' : 'Update Available'}</Text>

          {/* Message */}
          <Text style={styles.message}>
            {updateMessage ||
              (isRequired
                ? 'A new version of Hantibink is available. Please update to continue using the app.'
                : `A new version (${latestVersion}) is available. Update now for the best experience!`)}
          </Text>

          {/* Version info */}
          <View style={styles.versionInfo}>
            <Text style={styles.versionText}>
              Current: {currentVersion} → New: {latestVersion}
            </Text>
          </View>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.updateButton} onPress={handleUpdate}>
              <Ionicons
                name="download-outline"
                size={theme.icons.sm}
                color={theme.colors.text.white}
              />
              <Text style={styles.updateButtonText}>Update Now</Text>
            </TouchableOpacity>

            {!isRequired && onDismiss && (
              <TouchableOpacity style={styles.laterButton} onPress={onDismiss}>
                <Text style={styles.laterButtonText}>Maybe Later</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xxl,
  },
  container: {
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.borderRadius.xxl,
    padding: theme.spacing.xxxl,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: theme.spacing.xl,
  },
  title: {
    fontSize: 22,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: theme.spacing.lg,
  },
  versionInfo: {
    backgroundColor: theme.colors.gray[100],
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.xxl,
  },
  versionText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.gray[500],
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  buttonContainer: {
    width: '100%',
    gap: theme.spacing.md,
  },
  updateButton: {
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    gap: theme.spacing.sm,
  },
  updateButtonText: {
    color: theme.colors.text.white,
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
  },
  laterButton: {
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  laterButtonText: {
    color: theme.colors.gray[500],
    fontSize: 15,
  },
});

export default ForceUpdateModal;
