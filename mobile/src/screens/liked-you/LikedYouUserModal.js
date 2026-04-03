import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Image,
  TouchableOpacity,
  ActivityIndicator,
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
 * @param {Object} props.loadingAction - Loading state { userId, type: 'like' | 'pass' }
 */
const LikedYouUserModal = ({ user, visible, onClose, onLike, onPass, loadingAction }) => {
  const isLoading = loadingAction?.userId === user?.id;
  const isLoadingPass = isLoading && loadingAction?.type === 'pass';
  const isLoadingLike = isLoading && loadingAction?.type === 'like';

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      {user && (
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <TouchableOpacity style={styles.modalClose} onPress={onClose}>
              <Ionicons name="close" size={28} color={theme.colors.text.primary} />
            </TouchableOpacity>

            <Image source={{ uri: user.mainPhoto }} style={styles.modalImage} />

            <View style={styles.modalInfo}>
              <Text style={styles.modalName}>
                {user.name}, {user.age}
              </Text>
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
  modalInfo: {
    padding: 20,
  },
  modalName: {
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.text.primary,
    marginBottom: 5,
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
    backgroundColor: '#FFF8DC',
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
    backgroundColor: '#FFE5E5',
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
