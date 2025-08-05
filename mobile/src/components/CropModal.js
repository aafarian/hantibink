import React, { useState, useRef } from 'react';
import { View, Modal, Image, TouchableOpacity, Text, StyleSheet, Dimensions } from 'react-native';
import { PinchGestureHandler, PanGestureHandler } from 'react-native-gesture-handler';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedGestureHandler,
  useAnimatedStyle,
} from 'react-native-reanimated';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const CropModal = ({ visible, imageUri, onCropComplete, onCancel }) => {
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [cropArea, setCropArea] = useState({
    x: 50,
    y: 100,
    width: screenWidth - 100,
    height: screenWidth - 100, // Square crop by default
  });

  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const panGestureHandler = useAnimatedGestureHandler({
    onStart: (_, context) => {
      context.startX = translateX.value;
      context.startY = translateY.value;
    },
    onActive: (event, context) => {
      translateX.value = context.startX + event.translationX;
      translateY.value = context.startY + event.translationY;
    },
  });

  const pinchGestureHandler = useAnimatedGestureHandler({
    onStart: (_, context) => {
      context.startScale = scale.value;
    },
    onActive: (event, context) => {
      scale.value = Math.max(0.5, Math.min(3, context.startScale * event.scale));
    },
  });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  const handleImageLoad = event => {
    const { width, height } = event.nativeEvent.source;
    setImageSize({ width, height });
  };

  const handleCrop = () => {
    // Calculate crop coordinates relative to the original image
    const imageAspectRatio = imageSize.width / imageSize.height;
    const containerAspectRatio = screenWidth / (screenHeight - 200);

    let displayWidth, displayHeight;
    if (imageAspectRatio > containerAspectRatio) {
      displayWidth = screenWidth;
      displayHeight = screenWidth / imageAspectRatio;
    } else {
      displayHeight = screenHeight - 200;
      displayWidth = (screenHeight - 200) * imageAspectRatio;
    }

    const scaleX = imageSize.width / displayWidth;
    const scaleY = imageSize.height / displayHeight;

    const cropData = {
      originX: Math.max(0, ((cropArea.x - translateX.value) * scaleX) / scale.value),
      originY: Math.max(0, ((cropArea.y - translateY.value) * scaleY) / scale.value),
      width: Math.min(imageSize.width, (cropArea.width * scaleX) / scale.value),
      height: Math.min(imageSize.height, (cropArea.height * scaleY) / scale.value),
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
          <Text style={styles.headerTitle}>Crop Image</Text>
          <TouchableOpacity onPress={handleCrop} style={styles.headerButton}>
            <Text style={styles.headerButtonText}>Done</Text>
            <MaterialIcons name="check" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.imageContainer}>
          <PinchGestureHandler onGestureEvent={pinchGestureHandler}>
            <Animated.View style={styles.imageWrapper}>
              <PanGestureHandler onGestureEvent={panGestureHandler}>
                <Animated.View style={animatedStyle}>
                  <Image
                    source={{ uri: imageUri }}
                    style={styles.image}
                    onLoad={handleImageLoad}
                    resizeMode="contain"
                  />
                </Animated.View>
              </PanGestureHandler>
            </Animated.View>
          </PinchGestureHandler>

          {/* Crop overlay */}
          <View style={styles.overlay}>
            <View style={[styles.cropArea, cropArea]} />
          </View>
        </View>

        <View style={styles.instructions}>
          <Text style={styles.instructionText}>
            📏 Pinch to zoom • 👆 Drag to move • Square crop area
          </Text>
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
    paddingBottom: 10,
    backgroundColor: '#000',
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
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
  },
  imageWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: screenWidth,
    height: screenHeight - 200,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  cropArea: {
    borderWidth: 2,
    borderColor: '#fff',
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  instructions: {
    padding: 20,
    backgroundColor: '#000',
  },
  instructionText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 14,
    opacity: 0.8,
  },
});

export default CropModal;
