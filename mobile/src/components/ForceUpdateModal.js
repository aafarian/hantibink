import React from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, Platform, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../styles/theme';

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
      Linking.openURL(storeUrl).catch(() => {
        // Fallback - try to open app store directly
        if (Platform.OS === 'ios') {
          Linking.openURL('itms-apps://apps.apple.com');
        } else {
          Linking.openURL('market://details?id=com.antoafarian.hantibink');
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
              <Ionicons name="download-outline" size={20} color="#fff" />
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
    padding: 24,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 32,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
  },
  versionInfo: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 24,
  },
  versionText: {
    fontSize: 13,
    color: '#888',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  updateButton: {
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  updateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  laterButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  laterButtonText: {
    color: '#888',
    fontSize: 15,
  },
});

export default ForceUpdateModal;
