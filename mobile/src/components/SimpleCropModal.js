import React, { useState } from 'react';
import { View, Modal, Image, TouchableOpacity, Text, StyleSheet, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useToast } from '../contexts/ToastContext';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const SimpleCropModal = ({ visible, imageUri, onCropComplete, onCancel }) => {
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const { showError } = useToast();

  const handleImageLoad = event => {
    const { width, height } = event.nativeEvent.source;
    setImageSize({ width, height });
  };

  const handleCrop = () => {
    if (!imageSize.width || !imageSize.height) {
      showError('Image not loaded properly. Please try again.');
      return;
    }

    // Simple center crop to square
    const cropSize = Math.min(imageSize.width, imageSize.height);
    const offsetX = (imageSize.width - cropSize) / 2;
    const offsetY = (imageSize.height - cropSize) / 2;

    const cropData = {
      originX: offsetX,
      originY: offsetY,
      width: cropSize,
      height: cropSize,
    };

    onCropComplete(cropData);
  };

  const handleSkip = () => {
    // Return original image dimensions (no crop)
    const cropData = {
      originX: 0,
      originY: 0,
      width: imageSize.width,
      height: imageSize.height,
    };
    onCropComplete(cropData);
  };

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} style={styles.headerButton}>
            <MaterialIcons name="close" size={24} color="#fff" />
            <Text style={styles.headerButtonText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Crop Photo</Text>
          <TouchableOpacity onPress={handleCrop} style={styles.headerButton}>
            <Text style={styles.headerButtonText}>Crop</Text>
            <MaterialIcons name="crop" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.imageContainer}>
          <Image
            source={{ uri: imageUri }}
            style={styles.image}
            onLoad={handleImageLoad}
            resizeMode="contain"
          />

          {/* Crop overlay indicator */}
          <View style={styles.overlay}>
            <View style={styles.cropIndicator}>
              <View style={styles.cropCorner} />
              <View style={[styles.cropCorner, styles.topRight]} />
              <View style={[styles.cropCorner, styles.bottomLeft]} />
              <View style={[styles.cropCorner, styles.bottomRight]} />
            </View>
          </View>
        </View>

        <View style={styles.controls}>
          <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
            <Text style={styles.skipButtonText}>Skip Crop</Text>
          </TouchableOpacity>
          <Text style={styles.instructionText}>Will crop to center square</Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: '#000',
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  imageContainer: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: screenWidth - 40,
    height: screenHeight - 300,
  },
  overlay: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
  },
  cropIndicator: {
    width: 200,
    height: 200,
    position: 'relative',
    borderWidth: 2,
    borderColor: '#fff',
    borderStyle: 'dashed',
  },
  cropCorner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#ff6b6b',
    borderWidth: 3,
    top: -3,
    left: -3,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: -3,
    right: -3,
    left: 'auto',
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderRightWidth: 3,
  },
  bottomLeft: {
    bottom: -3,
    left: -3,
    top: 'auto',
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomWidth: 3,
  },
  bottomRight: {
    bottom: -3,
    right: -3,
    top: 'auto',
    left: 'auto',
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderRightWidth: 3,
    borderBottomWidth: 3,
  },
  controls: {
    padding: 20,
    backgroundColor: '#000',
    alignItems: 'center',
  },
  skipButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#333',
    borderRadius: 8,
    marginBottom: 10,
  },
  skipButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  instructionText: {
    color: '#ccc',
    textAlign: 'center',
    fontSize: 14,
  },
});

export default SimpleCropModal;
