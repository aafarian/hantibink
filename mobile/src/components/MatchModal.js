import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../styles/theme';

const { width: screenWidth } = Dimensions.get('window');

const MatchModal = ({
  visible,
  onClose,
  currentUserPhoto,
  currentUserName,
  matchedUserPhoto,
  matchedUserName,
  onSendMessage,
  onKeepSwiping,
}) => {
  // Ensure we have valid photo URLs or use placeholders
  const safeCurrentPhoto = currentUserPhoto || 'https://via.placeholder.com/150';
  const safeMatchedPhoto = matchedUserPhoto || 'https://via.placeholder.com/150';

  // Handle send message - parent handles modal closing and navigation
  const handleSendMessage = () => {
    if (onSendMessage) {
      onSendMessage();
    }
  };

  // Handle keep swiping - parent handles modal closing
  const handleKeepSwiping = () => {
    if (onKeepSwiping) {
      onKeepSwiping();
    }
  };

  return (
    <Modal animationType="fade" transparent={true} visible={visible} onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* Tappable background to dismiss */}
        <Pressable style={styles.dismissArea} onPress={onClose} />

        <View style={styles.container}>
          {/* Close button */}
          <TouchableOpacity style={styles.closeIcon} onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.colors.text.secondary} />
          </TouchableOpacity>

          {/* Header with gradient */}
          <LinearGradient
            colors={[theme.colors.primary, '#FF8E53']}
            style={styles.header}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.title}>It's a Match!</Text>
            <Text style={styles.subtitle}>You and {matchedUserName} liked each other</Text>
          </LinearGradient>

          {/* Photos section */}
          <View style={styles.photosContainer}>
            <View style={styles.photoWrapper}>
              <Image source={{ uri: safeCurrentPhoto }} style={styles.photo} />
              <Text style={styles.photoName}>{currentUserName || 'You'}</Text>
            </View>

            <View style={styles.heartContainer}>
              <View style={styles.heartBadge}>
                <Ionicons name="heart" size={28} color={theme.colors.primary} />
              </View>
            </View>

            <View style={styles.photoWrapper}>
              <Image source={{ uri: safeMatchedPhoto }} style={styles.photo} />
              <Text style={styles.photoName}>{matchedUserName}</Text>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleSendMessage}
              activeOpacity={0.8}
            >
              <Ionicons name="chatbubble-ellipses" size={20} color={theme.colors.text.white} />
              <Text style={styles.primaryButtonText}>Send Message</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={handleKeepSwiping}>
              <Text style={styles.secondaryButtonText}>Keep Swiping</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: theme.colors.background.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dismissArea: {
    ...StyleSheet.absoluteFillObject,
  },
  container: {
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.borderRadius.xxl,
    width: screenWidth * 0.88,
    maxWidth: 380,
    overflow: 'hidden',
    ...theme.shadows.large,
  },
  closeIcon: {
    position: 'absolute',
    top: theme.spacing.md,
    right: theme.spacing.md,
    padding: theme.spacing.xs,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: theme.borderRadius.round,
  },
  header: {
    paddingVertical: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.xl,
    alignItems: 'center',
  },
  title: {
    fontSize: theme.typography.sizes.xxxl,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text.white,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.text.white,
    textAlign: 'center',
    opacity: 0.9,
  },
  photosContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  photoWrapper: {
    alignItems: 'center',
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: theme.colors.primary,
  },
  photoName: {
    marginTop: theme.spacing.sm,
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text.primary,
  },
  heartContainer: {
    marginHorizontal: theme.spacing.sm,
  },
  heartBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: `${theme.colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.secondary,
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.borderRadius.round,
    gap: theme.spacing.sm,
    ...theme.shadows.medium,
  },
  primaryButtonText: {
    color: theme.colors.text.white,
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
  },
  secondaryButton: {
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.round,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: theme.colors.text.muted,
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.medium,
  },
});

export default MatchModal;
