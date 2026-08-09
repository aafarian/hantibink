import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Pressable,
} from 'react-native';
import * as Application from 'expo-application';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import Logger from '../../utils/logger';
import { notesForVersion } from '../../data/patchNotes';
import { theme } from '../../styles/theme';

const LAST_SEEN_VERSION_KEY = '@hantibink/lastSeenVersion';

/**
 * "What's New" modal, shown at most once per app version.
 *
 * Fresh installs stay silent: with no stored lastSeenVersion the current
 * version is recorded without showing the modal (nothing is "new" to a
 * brand-new user). Versions without patch notes are also silent.
 */
const WhatsNewModal = () => {
  const [visible, setVisible] = useState(false);
  const [entry, setEntry] = useState(null);

  useEffect(() => {
    const checkWhatsNew = async () => {
      try {
        const currentVersion = Application.nativeApplicationVersion || '1.0.0';
        const lastSeen = await AsyncStorage.getItem(LAST_SEEN_VERSION_KEY);

        if (lastSeen === currentVersion) {
          return;
        }

        const notes = notesForVersion(currentVersion);

        // Fresh install or a version without notes: record silently
        if (!lastSeen || !notes) {
          await AsyncStorage.setItem(LAST_SEEN_VERSION_KEY, currentVersion);
          return;
        }

        setEntry(notes);
        setVisible(true);
      } catch (error) {
        Logger.warn("What's New check failed:", error);
      }
    };
    checkWhatsNew();
  }, []);

  const dismiss = useCallback(async () => {
    setVisible(false);
    try {
      const currentVersion = Application.nativeApplicationVersion || '1.0.0';
      await AsyncStorage.setItem(LAST_SEEN_VERSION_KEY, currentVersion);
    } catch (error) {
      Logger.warn("Could not persist What's New dismissal:", error);
    }
  }, []);

  if (!entry) {
    return null;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.container}>
        <Pressable style={styles.backdrop} onPress={dismiss} />
        <View style={styles.content}>
          {/* Everything except the dismiss button scrolls, so no amount of
              accessibility text scaling can push "Nice!" off-screen
              (see ScrollView-in-Modal pattern) */}
          <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
            <View style={styles.iconCircle}>
              <Ionicons name="sparkles" size={28} color={theme.colors.primary} />
            </View>
            <Text style={styles.headline}>{entry.headline}</Text>
            <Text style={styles.version}>Version {entry.version}</Text>
            <View style={styles.notes}>
              {entry.notes.map(note => (
                <View key={note} style={styles.noteRow}>
                  <Ionicons
                    name="checkmark-circle"
                    size={theme.icons.xs}
                    color={theme.colors.status.success}
                    style={styles.noteIcon}
                  />
                  <Text style={styles.noteText}>{note}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
          <TouchableOpacity style={styles.button} onPress={dismiss}>
            <Text style={styles.buttonText}>Nice!</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.overlay.medium,
  },
  content: {
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xxl,
    marginHorizontal: theme.spacing.xxl,
    maxWidth: 360,
    width: '85%',
    // Bounding the whole card (not just the notes list) keeps the dismiss
    // button on-screen on small viewports with accessibility-scaled text
    maxHeight: '85%',
    alignItems: 'center',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primaryTint,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  headline: {
    fontSize: theme.typography.sizes.xxl,
    fontFamily: theme.typography.fontFamily.heading,
    color: theme.colors.text.primary,
    textAlign: 'center',
  },
  version: {
    fontSize: theme.typography.sizes.sm,
    fontFamily: theme.typography.fontFamily.body,
    color: theme.colors.text.muted,
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.lg,
  },
  scrollArea: {
    alignSelf: 'stretch',
    flexShrink: 1,
    marginBottom: theme.spacing.xl,
  },
  scrollContent: {
    alignItems: 'center',
  },
  notes: {
    alignSelf: 'stretch',
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  noteIcon: {
    marginRight: theme.spacing.sm,
    marginTop: 2,
  },
  noteText: {
    flex: 1,
    fontSize: theme.typography.sizes.md,
    fontFamily: theme.typography.fontFamily.body,
    color: theme.colors.text.secondary,
    lineHeight: 20,
  },
  button: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.round,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.huge,
  },
  buttonText: {
    color: theme.colors.text.white,
    fontSize: theme.typography.sizes.lg,
    fontFamily: theme.typography.fontFamily.label,
  },
});

export default WhatsNewModal;
