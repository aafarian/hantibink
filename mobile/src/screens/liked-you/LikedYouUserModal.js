import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';

/**
 * LikedYouUserModal - Displays full user profile details in a bottom sheet modal
 *
 * @param {Object} props
 * @param {Object} props.user - The selected user to display
 * @param {boolean} props.visible - Whether the modal is visible
 * @param {Function} props.onClose - Callback when modal is closed
 * @param {Function} props.onLike - Callback when like button is pressed
 * @param {Function} props.onPass - Callback when pass button is pressed
 * @param {Function} props.onReport - Callback when Report is chosen from the overflow menu
 * @param {Function} props.onBlock - Callback when Block is chosen from the overflow menu
 * @param {Object} props.loadingAction - Loading state { userId, type: 'like' | 'pass' }
 */
const LikedYouUserModal = ({
  user,
  visible,
  onClose,
  onLike,
  onPass,
  onReport,
  onBlock,
  loadingAction,
}) => {
  const isLoading = loadingAction?.userId === user?.id;
  const isLoadingPass = isLoading && loadingAction?.type === 'pass';
  const isLoadingLike = isLoading && loadingAction?.type === 'like';

  const handleOverflowPress = () => {
    Alert.alert(user?.name || 'Options', undefined, [
      { text: 'Report', onPress: () => onReport?.(user) },
      { text: 'Block', style: 'destructive', onPress: () => onBlock?.(user) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      {user && (
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.modalClose} onPress={onClose}>
              <Ionicons name="close" size={28} color={theme.colors.text.primary} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.modalOverflow} onPress={handleOverflowPress}>
              <Ionicons name="ellipsis-horizontal" size={24} color={theme.colors.text.primary} />
            </TouchableOpacity>

            <Image source={{ uri: user.mainPhoto }} style={styles.modalImage} />

            <View style={styles.modalInfo}>
              <View style={styles.modalNameRow}>
                <Text style={styles.modalName}>
                  {user.name}, {user.age}
                </Text>
                {user.isVerified && (
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={theme.colors.secondaryLight}
                    style={styles.verifiedBadge}
                  />
                )}
              </View>
              <Text style={styles.modalLocation}>
                <Ionicons name="location" size={16} color={theme.colors.text.secondary} />{' '}
                {user.location}
              </Text>
              <Text style={styles.modalBio}>{user.bio}</Text>

              {user.isSuperLike && (
                <View style={styles.superLikeInfo}>
                  <Ionicons name="star" size={20} color={theme.colors.premium} />
                  <Text style={styles.superLikeText}>They Super Liked You!</Text>
                </View>
              )}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.passButton]}
                onPress={() => onPass(user)}
                disabled={isLoading}
              >
                {isLoadingPass ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                ) : (
                  <>
                    <Ionicons name="close" size={24} color={theme.colors.primary} />
                    <Text style={styles.passButtonText}>Pass</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.likeButton]}
                onPress={() => onLike(user)}
                disabled={isLoading}
              >
                {isLoadingLike ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <Ionicons name="heart" size={24} color="white" />
                    <Text style={styles.likeButtonText}>Like Back</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    maxHeight: '80%',
  },
  modalClose: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 1,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 5,
  },
  modalImage: {
    width: '100%',
    height: 300,
  },
  modalOverflow: {
    position: 'absolute',
    top: 20,
    left: 20,
    zIndex: 1,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 7,
  },
  modalInfo: {
    padding: 20,
  },
  modalNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  modalName: {
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.text.primary,
  },
  verifiedBadge: {
    marginLeft: 6,
  },
  modalLocation: {
    fontSize: 16,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.regular,
    marginBottom: 15,
  },
  modalBio: {
    fontSize: 16,
    color: theme.colors.text.primary,
    lineHeight: 24,
    fontFamily: theme.typography.fontFamily.regular,
  },
  superLikeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.accentTint,
    padding: 10,
    borderRadius: 10,
    marginTop: 15,
  },
  superLikeText: {
    marginLeft: 8,
    color: theme.colors.premium,
    fontWeight: 'bold',
    fontFamily: theme.typography.fontFamily.bold,
  },
  modalActions: {
    flexDirection: 'row',
    padding: 20,
    gap: 15,
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 25,
  },
  passButton: {
    backgroundColor: theme.colors.primaryTint,
  },
  passButtonText: {
    color: theme.colors.primary,
    fontWeight: 'bold',
    fontFamily: theme.typography.fontFamily.bold,
    marginLeft: 8,
  },
  likeButton: {
    backgroundColor: theme.colors.secondary,
  },
  likeButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontFamily: theme.typography.fontFamily.bold,
    marginLeft: 8,
  },
});

export default LikedYouUserModal;
