import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Linking } from 'react-native';
import Reanimated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import Logger from '../../utils/logger';
import { theme } from '../../styles/theme';

/**
 * Dismissible "new version available" banner (store update, not OTA).
 * Dismissal is persisted per version by useForceUpdate, so a newer release
 * re-nags exactly once. The non-dismissible path is ForceUpdateModal.
 */
const SoftUpdateBanner = ({ visible, versionConfig, onDismiss }) => {
  if (!visible || !versionConfig) {
    return null;
  }

  const openStore = () => {
    const storeUrl =
      Platform.OS === 'ios' ? versionConfig.storeUrls?.ios : versionConfig.storeUrls?.android;
    if (storeUrl) {
      Linking.openURL(storeUrl).catch(error => Logger.error('Could not open store:', error));
    }
  };

  return (
    <Reanimated.View entering={FadeInDown.duration(300)} exiting={FadeOutUp.duration(200)}>
      <View style={styles.container}>
        <MaterialIcons
          name="system-update"
          size={theme.icons.sm}
          color={theme.colors.text.white}
          style={styles.icon}
        />
        <View style={styles.textWrap}>
          <Text style={styles.title}>Update available</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {versionConfig.updateMessage ||
              `Version ${versionConfig.latestVersion} is ready for you`}
          </Text>
        </View>
        <TouchableOpacity style={styles.updateButton} onPress={openStore}>
          <Text style={styles.updateButtonText}>Update</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.dismissButton}
          onPress={onDismiss}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialIcons name="close" size={theme.icons.xs} color={theme.colors.text.white} />
        </TouchableOpacity>
      </View>
    </Reanimated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.secondary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  icon: {
    marginRight: theme.spacing.md,
  },
  textWrap: {
    flex: 1,
  },
  title: {
    color: theme.colors.text.white,
    fontSize: theme.typography.sizes.md,
    fontFamily: theme.typography.fontFamily.label,
  },
  subtitle: {
    color: theme.colors.text.white,
    fontSize: theme.typography.sizes.sm,
    fontFamily: theme.typography.fontFamily.body,
    opacity: 0.85,
    marginTop: 1,
  },
  updateButton: {
    backgroundColor: theme.colors.overlay.light,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    marginLeft: theme.spacing.md,
  },
  updateButtonText: {
    color: theme.colors.text.white,
    fontSize: theme.typography.sizes.sm,
    fontFamily: theme.typography.fontFamily.label,
  },
  dismissButton: {
    marginLeft: theme.spacing.md,
    padding: theme.spacing.xs,
  },
});

export default SoftUpdateBanner;
