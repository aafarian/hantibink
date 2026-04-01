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
            <ActivityIndicator size="small" color={theme.colors.text.white} style={styles.icon} />
            <Text style={styles.text}>Downloading update...</Text>
          </>
        ) : isReadyToInstall ? (
          <>
            <MaterialIcons
              name="system-update"
              size={theme.icons.xs}
              color={theme.colors.text.white}
              style={styles.icon}
            />
            <Text style={styles.text}>New version ready</Text>
            <TouchableOpacity style={styles.updateButton} onPress={applyUpdate}>
              <Text style={styles.updateButtonText}>Restart</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <MaterialIcons
              name="cloud-download"
              size={theme.icons.xs}
              color={theme.colors.text.white}
              style={styles.icon}
            />
            <Text style={styles.text}>Update available</Text>
          </>
        )}
      </View>
      {isReadyToInstall && (
        <TouchableOpacity style={styles.dismissButton} onPress={dismissUpdate}>
          <MaterialIcons name="close" size={theme.icons.xs} color={theme.colors.text.white} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 10,
    paddingHorizontal: theme.spacing.lg,
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
    color: theme.colors.text.white,
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.medium,
    flex: 1,
  },
  updateButton: {
    backgroundColor: theme.colors.background.primary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.xl,
    marginLeft: 10,
  },
  updateButtonText: {
    color: theme.colors.primary,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
  },
  dismissButton: {
    padding: theme.spacing.xs,
    marginLeft: theme.spacing.sm,
  },
});

export default UpdateBanner;
