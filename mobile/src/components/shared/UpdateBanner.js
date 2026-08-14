import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import Reanimated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUpdate } from '../../contexts/UpdateContext';
import { theme } from '../../styles/theme';

// Clearance for the floating card above the bottom tab bar
const TAB_BAR_CLEARANCE = 76;

/**
 * OTA update nudge as a floating snackbar above the tab bar. A top banner
 * displaced every screen header (headers pad for the translucent status
 * bar themselves, so an in-flow banner doubled that spacing); down here it
 * overlays dead space instead of shifting content.
 */
const UpdateBanner = () => {
  const { isUpdateAvailable, isDownloading, isReadyToInstall, applyUpdate, dismissUpdate } =
    useUpdate();
  const insets = useSafeAreaInsets();

  // Don't show if no update available
  if (!isUpdateAvailable) {
    return null;
  }

  return (
    <Reanimated.View
      entering={FadeInDown.duration(300)}
      exiting={FadeOutDown.duration(200)}
      style={[styles.wrap, { bottom: insets.bottom + TAB_BAR_CLEARANCE }]}
    >
      <View style={styles.card}>
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
              <TouchableOpacity
                style={styles.updateButton}
                onPress={applyUpdate}
                hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
              >
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
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={dismissUpdate}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <MaterialIcons name="close" size={theme.icons.xs} color={theme.colors.text.white} />
          </TouchableOpacity>
        )}
      </View>
    </Reanimated.View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    zIndex: 100,
    elevation: 10,
  },
  card: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.xl,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...theme.shadows.medium,
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
    fontFamily: theme.typography.fontFamily.medium,
    flex: 1,
  },
  updateButton: {
    backgroundColor: theme.colors.background.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.xl,
    marginLeft: 10,
  },
  updateButtonText: {
    color: theme.colors.primary,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    fontFamily: theme.typography.fontFamily.semibold,
  },
  dismissButton: {
    padding: theme.spacing.xs,
    marginLeft: theme.spacing.sm,
  },
});

export default UpdateBanner;
