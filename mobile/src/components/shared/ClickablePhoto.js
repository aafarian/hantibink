import React from 'react';
import { TouchableOpacity, Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePhotoViewer } from '../../contexts/PhotoViewerContext';

/**
 * Clickable photo component that opens PhotoViewer bottom sheet
 * Can be used for profile photos, thumbnails, etc.
 */
const ClickablePhoto = ({
  photo, // Single photo URL or object
  photos = [], // Array of photos (for gallery view)
  photoIndex = 0, // Index of this photo in the photos array
  style,
  imageStyle,
  size = 100,
  borderRadius = 8,
  showExpandIcon = true,
  showActions = false,
  onSetMain,
  onDelete,
  actionButtons = [],
  title = 'Photo',
  children, // Custom content for PhotoViewer
  onLongPress, // For drag functionality
  delayLongPress = 300,
  ...touchableProps
}) => {
  const { openPhotoViewer } = usePhotoViewer();

  // Normalize photos array
  const allPhotos = photos.length > 0 ? photos : [photo].filter(Boolean);
  const currentPhotoIndex = photos.length > 0 ? photoIndex : 0;

  const handlePress = () => {
    openPhotoViewer({
      photos: allPhotos,
      initialIndex: currentPhotoIndex,
      showActions,
      title,
      onSetMain,
      onDelete,
      actionButtons,
    });
  };

  const photoUrl = typeof photo === 'string' ? photo : photo?.url;

  if (!photoUrl) return null;

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius,
        },
        style,
      ]}
      onPress={handlePress}
      onLongPress={onLongPress}
      delayLongPress={delayLongPress}
      activeOpacity={0.8}
      {...touchableProps}
    >
      <Image
        source={{ uri: photoUrl }}
        style={[
          styles.image,
          {
            width: size,
            height: size,
            borderRadius,
          },
          imageStyle,
        ]}
      />

      {showExpandIcon && (
        <View style={styles.expandIcon}>
          <Ionicons name="expand-outline" size={16} color="#fff" />
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  expandIcon: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ClickablePhoto;
