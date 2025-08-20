import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Image, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

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

  // Handle send message with proper modal closing
  const handleSendMessage = () => {
    if (onClose) onClose();
    if (onSendMessage) {
      // Small delay to ensure modal animates out
      setTimeout(() => {
        onSendMessage();
      }, 100);
    }
  };

  // Handle keep swiping
  const handleKeepSwiping = () => {
    if (onClose) onClose();
    if (onKeepSwiping) onKeepSwiping();
  };

  return (
    <Modal animationType="fade" transparent={true} visible={visible} onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.content}>
          <LinearGradient
            colors={['#FF6B6B', '#FF8E53']}
            style={styles.header}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.title}>It's a Match! 🎉</Text>
            <Text style={styles.subtitle}>You and {matchedUserName} liked each other!</Text>
          </LinearGradient>

          <View style={styles.photosContainer}>
            <View style={styles.photoWrapper}>
              <Image source={{ uri: safeCurrentPhoto }} style={styles.photo} />
              <Text style={styles.photoName}>{currentUserName || 'You'}</Text>
            </View>

            <View style={styles.heartContainer}>
              <Ionicons name="heart" size={40} color="#FF6B6B" />
            </View>

            <View style={styles.photoWrapper}>
              <Image source={{ uri: safeMatchedPhoto }} style={styles.photo} />
              <Text style={styles.photoName}>{matchedUserName}</Text>
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleKeepSwiping}>
              <Text style={styles.secondaryButtonText}>Keep Swiping</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.primaryButton} onPress={handleSendMessage}>
              <LinearGradient
                colors={['#4ECDC4', '#44A08D']}
                style={styles.primaryButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons name="chatbubble-ellipses" size={20} color="white" />
                <Text style={styles.primaryButtonText}>Send Message</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    backgroundColor: 'white',
    borderRadius: 25,
    width: screenWidth * 0.85,
    maxWidth: 350,
    overflow: 'hidden',
  },
  header: {
    padding: 25,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'white',
    textAlign: 'center',
  },
  photosContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    gap: 15,
  },
  photoWrapper: {
    alignItems: 'center',
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#FF6B6B',
  },
  photoName: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  heartContainer: {
    marginHorizontal: 10,
  },
  actions: {
    padding: 20,
    gap: 12,
  },
  primaryButton: {
    width: '100%',
  },
  primaryButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 25,
    gap: 8,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    paddingVertical: 14,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default MatchModal;
