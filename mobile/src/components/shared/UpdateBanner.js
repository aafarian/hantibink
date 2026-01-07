import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useUpdate } from '../../contexts/UpdateContext';
import { theme } from '../../styles/theme';

const UpdateBanner = () => {
  const { isUpdateAvailable, isDownloading, isReadyToInstall, applyUpdate, dismissUpdate } =
    useUpdate();

  // Don't show if no update available
  if (!isUpdateAvailable) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {isDownloading ? (
          <>
            <ActivityIndicator size="small" color="#fff" style={styles.icon} />
            <Text style={styles.text}>Downloading update...</Text>
          </>
        ) : isReadyToInstall ? (
          <>
            <MaterialIcons name="system-update" size={18} color="#fff" style={styles.icon} />
            <Text style={styles.text}>New version ready</Text>
            <TouchableOpacity style={styles.updateButton} onPress={applyUpdate}>
              <Text style={styles.updateButtonText}>Restart</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <MaterialIcons name="cloud-download" size={18} color="#fff" style={styles.icon} />
            <Text style={styles.text}>Update available</Text>
          </>
        )}
      </View>
      {isReadyToInstall && (
        <TouchableOpacity style={styles.dismissButton} onPress={dismissUpdate}>
          <MaterialIcons name="close" size={18} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    marginRight: 10,
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  updateButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    marginLeft: 10,
  },
  updateButtonText: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  dismissButton: {
    padding: 4,
    marginLeft: 8,
  },
});

export default UpdateBanner;
