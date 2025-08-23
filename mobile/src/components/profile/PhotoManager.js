import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { uploadImageToFirebase } from '../../utils/imageUpload';
import ApiDataService from '../../services/ApiDataService';
import Logger from '../../utils/logger';
import { usePhotoViewer } from '../../contexts/PhotoViewerContext';
import { DraggableGrid } from 'react-native-draggable-grid';

/**
 * Reusable PhotoManager component
 * Handles photo upload, reorder, delete, set main, and full-screen viewing
 */
const PhotoManager = ({
  photos = [],
  onPhotosChange,
  userId,
  maxPhotos = 6,
  showTitle = true,
  showAddButton = true,
  mode = 'edit', // 'edit' | 'view'
  onError,
  onSuccess,
  onScrollControl, // Function to control parent scroll
}) => {
  const [loading, setLoading] = useState(false);
  const [currentOrder, setCurrentOrder] = useState([]);
  const [draggingItem, setDraggingItem] = useState(null);
  const [lastDragTime, setLastDragTime] = useState(0);

  const { openPhotoViewer } = usePhotoViewer();

  // Transform photos to ensure they have proper structure for draggable-grid
  const normalizePhotos = photoArray => {
    if (!Array.isArray(photoArray)) {
      return [];
    }
    return photoArray.map((photo, index) => ({
      key: photo.id || photo.url || `temp_${index}`, // draggable-grid requires 'key' property
      id: photo.id || photo.url || `temp_${index}`,
      url: typeof photo === 'string' ? photo : photo.url,
      isMain: photo.isMain || index === 0, // First photo is main if no main set
      order: photo.order ?? index,
    }));
  };

  const normalizedPhotos = React.useMemo(() => normalizePhotos(photos || []), [photos]);

  // Initialize current order when photos change
  React.useEffect(() => {
    const newOrder = normalizedPhotos.map(photo => photo.id);
    setCurrentOrder(newOrder);
  }, [normalizedPhotos]);

  // Helper function to check if order actually changed
  const hasOrderChanged = (newData, originalOrder) => {
    const newOrder = newData.map(photo => photo.id);
    if (newOrder.length !== originalOrder.length) return true;
    return !newOrder.every((id, index) => id === originalOrder[index]);
  };

  // Add new photo
  const addPhoto = async () => {
    try {
      if (normalizedPhotos.length >= maxPhotos) {
        onError?.(`Maximum ${maxPhotos} photos allowed`);
        return;
      }

      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        onError?.('Camera roll permission is required');
        return;
      }

      setLoading(true);

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 5],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const tempUserId = userId || `temp_${Date.now()}`;
        const photoUrl = await uploadImageToFirebase(result.assets[0].uri, tempUserId);

        if (mode === 'edit') {
          // Add to API and let the refresh handle the state update
          await ApiDataService.addUserPhoto(photoUrl, normalizedPhotos.length === 0);
          // Don't update local state - let the profile refresh handle it
          onSuccess?.('Photo added successfully!');
        } else {
          // Only update local state in registration mode
          const newPhoto = {
            id: Date.now().toString(),
            url: photoUrl,
            isMain: normalizedPhotos.length === 0,
            order: normalizedPhotos.length,
          };

          const updatedPhotos = [...normalizedPhotos, newPhoto];
          onPhotosChange?.(updatedPhotos);
          onSuccess?.('Photo added successfully!');
        }
      }
    } catch (error) {
      Logger.error('❌ Error adding photo:', error);
      onError?.('Failed to add photo');
    } finally {
      setLoading(false);
    }
  };

  // Delete photo
  const _deletePhoto = async photoIndex => {
    try {
      const photo = normalizedPhotos[photoIndex];
      if (!photo) return;

      setLoading(true);

      if (mode === 'edit' && photo.id && !photo.id.toString().startsWith('temp_')) {
        await ApiDataService.deleteUserPhoto(photo.id);
        // Don't update local state - let the profile refresh handle it
        onSuccess?.('Photo deleted successfully!');
      } else {
        // Only update local state in registration mode or for temp photos
        const updatedPhotos = normalizedPhotos
          .filter((_, index) => index !== photoIndex)
          .map((item, index) => ({
            ...item,
            isMain: index === 0, // First photo becomes main
            order: index,
          }));

        onPhotosChange?.(updatedPhotos);
        if (mode !== 'edit') {
          onSuccess?.('Photo deleted successfully!');
        }
      }
    } catch (error) {
      Logger.error('❌ Error deleting photo:', error);
      onError?.('Failed to delete photo');
    } finally {
      setLoading(false);
    }
  };

  // Set main photo (unused but kept for potential future use)
  const _setMainPhoto = async photoIndex => {
    try {
      if (photoIndex === 0) {
        onError?.('This photo is already your main photo');
        return;
      }

      setLoading(true);

      // Reorder array to move selected photo to first position
      const photo = normalizedPhotos[photoIndex];
      const otherPhotos = normalizedPhotos.filter((_, index) => index !== photoIndex);
      const reorderedPhotos = [photo, ...otherPhotos].map((p, index) => ({
        ...p,
        isMain: index === 0,
        order: index,
      }));

      if (mode === 'edit') {
        // Update API with new order
        const photoIds = reorderedPhotos
          .map(p => p.id)
          .filter(id => !id.toString().startsWith('temp_'));
        if (photoIds.length > 0) {
          await ApiDataService.reorderUserPhotos(photoIds);
        }
      }

      onPhotosChange?.(reorderedPhotos);
      onSuccess?.('Main photo updated!');
    } catch (error) {
      Logger.error('❌ Error setting main photo:', error);
      onError?.('Failed to set main photo');
    } finally {
      setLoading(false);
    }
  };

  // Handle drag and drop reorder
  const _handleReorder = async ({ data }) => {
    try {
      setLoading(true);

      // Update order and main photo (first is always main)
      const reorderedPhotos = data.map((photo, index) => ({
        ...photo,
        isMain: index === 0,
        order: index,
      }));

      if (mode === 'edit') {
        // Update API with new order
        const photoIds = reorderedPhotos.map(p => p.id).filter(id => !id.startsWith('temp_'));
        if (photoIds.length > 0) {
          await ApiDataService.reorderUserPhotos(photoIds);
        }
      }

      onPhotosChange?.(reorderedPhotos);
      onSuccess?.('Photos reordered!');
    } catch (error) {
      Logger.error('❌ Error reordering photos:', error);
      onError?.('Failed to reorder photos');
    } finally {
      setLoading(false);
    }
  };

  // Handle reorder from draggable-grid library
  const handleDragRelease = async data => {
    try {
      // Throttle rapid consecutive drags to prevent conflicts
      const now = Date.now();
      if (now - lastDragTime < 300) {
        Logger.warn('⚠️ Drag too rapid, throttling');
        return;
      }
      setLastDragTime(now);

      // Defensive check: ensure we have valid data
      if (!Array.isArray(data) || data.length === 0) {
        Logger.warn('⚠️ Invalid drag data received, ignoring');
        return;
      }

      // Defensive check: ensure data length matches expected photo count
      if (data.length !== normalizedPhotos.length) {
        Logger.warn('⚠️ Drag data length mismatch, ignoring');
        return;
      }

      // Check if order actually changed (prevent micro-drag false positives)
      if (!hasOrderChanged(data, currentOrder)) {
        Logger.info('📍 Drag released but no order change detected, ignoring');
        return;
      }

      Logger.info(
        '🏁 Drag released, new order:',
        data.map(p => p.key || p.id)
      );

      // data is the new array with updated order
      const updatedPhotos = data.map((photo, index) => ({
        ...photo,
        order: index,
        isMain: index === 0, // First photo is main
      }));

      // Update local state immediately for instant UI feedback
      // Use setTimeout to avoid useInsertionEffect scheduling issues
      setTimeout(() => {
        setCurrentOrder(data.map(photo => photo.id));
        onPhotosChange?.(updatedPhotos);
      }, 0);

      // Save new order to API
      if (mode === 'edit') {
        setLoading(true);
        const photoIds = data.map(photo => photo.id);
        Logger.info('💾 Saving photo order to API:', photoIds);

        await ApiDataService.reorderUserPhotos(photoIds);
        onSuccess?.('Photos reordered!');
      }
    } catch (error) {
      Logger.error('❌ Error reordering photos:', error);
      onError?.('Failed to reorder photos');
    } finally {
      setLoading(false);
      // Use setTimeout to avoid state update conflicts
      setTimeout(() => {
        setDraggingItem(null);
      }, 0);
    }
  };

  // Handle photo drag start (just logging, scroll control handled by touch)
  const handlePhotoDragStart = startDragItem => {
    try {
      Logger.info('🚀 Drag started:', startDragItem);
      // Use setTimeout to avoid state update conflicts during rapid drags
      setTimeout(() => {
        setDraggingItem(startDragItem?.id || startDragItem?.key);
      }, 0);
    } catch (error) {
      Logger.warn('⚠️ Error in drag start:', error);
    }
  };

  // Render function for draggable-grid library
  const renderPhotoItem = (item, _order) => {
    if (!item || !item.id) {
      return null;
    }

    const currentPosition = currentOrder.indexOf(item.id);
    const isMain = currentPosition === 0;
    const photoUrl = typeof item === 'string' ? item : item?.url;
    const isDragging = draggingItem === item.id;

    return (
      <View style={[styles.photoWrapper, isDragging && styles.photoWrapperDragging]}>
        <Image
          source={{ uri: photoUrl }}
          style={[styles.gridPhoto, isDragging && styles.gridPhotoDragging]}
        />
        {isMain && !isDragging && (
          <View style={styles.mainBadge}>
            <Text style={styles.mainBadgeText}>MAIN</Text>
          </View>
        )}
        {isDragging && (
          <View style={styles.dragIndicator}>
            <Ionicons name="move" size={20} color="#fff" />
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {showTitle && (
        <Text style={styles.title}>
          Photos ({normalizedPhotos.length}/{maxPhotos})
        </Text>
      )}

      {normalizedPhotos && normalizedPhotos.length > 0 ? (
        <>
          <View
            onTouchStart={() => onScrollControl?.(false)}
            onTouchEnd={() => onScrollControl?.(true)}
            onTouchCancel={() => onScrollControl?.(true)}
            style={styles.draggableGridContainer}
          >
            <DraggableGrid
              numColumns={3}
              data={normalizedPhotos}
              renderItem={renderPhotoItem}
              onDragRelease={handleDragRelease}
              onDragStart={handlePhotoDragStart}
              style={styles.draggableGrid}
              delayLongPress={100}
              dragStartAnimation={{}}
              onItemPress={item => {
                Logger.info('📸 Photo pressed (quick tap):', item);
                // Open photo viewer on quick tap
                if (item && normalizedPhotos.length > 0) {
                  const photoIndex = normalizedPhotos.findIndex(p => p.id === item.id);
                  if (photoIndex >= 0) {
                    Logger.info('📸 Opening photo viewer for index:', photoIndex);
                    openPhotoViewer({
                      photos: normalizedPhotos,
                      initialIndex: photoIndex,
                      showActions: mode === 'edit',
                      title: 'Photo',
                    });
                  }
                }
              }}
            />
          </View>
          {mode === 'edit' && <Text style={styles.dragHint}>Touch and drag photos to reorder</Text>}
        </>
      ) : (
        <View style={styles.noPhotosContainer}>
          <Ionicons name="camera-outline" size={40} color="#ccc" />
          <Text style={styles.noPhotosText}>No photos yet</Text>
          {mode === 'edit' && <Text style={styles.noPhotosSubtext}>Tap + to add photos</Text>}
        </View>
      )}

      {/* Add Photo Button - Full Width Rectangle */}
      {showAddButton && mode === 'edit' && normalizedPhotos.length < maxPhotos && (
        <TouchableOpacity onPress={addPhoto} style={styles.addPhotoButtonWide} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color="#FF6B6B" />
          ) : (
            <>
              <Ionicons name="add" size={24} color="#FF6B6B" />
              <Text style={styles.addPhotoText}>
                Add Photo ({normalizedPhotos.length}/{maxPhotos})
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  photoWrapper: {
    width: 110,
    height: 110,
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    backgroundColor: 'transparent',
  },
  gridPhoto: {
    width: 110,
    height: 110,
    borderRadius: 8,
  },

  mainBadge: {
    position: 'absolute',
    top: 5,
    left: 5,
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  mainBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },

  draggableGridContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  draggableGrid: {
    flex: 1,
    backgroundColor: 'transparent',
  },

  addPhotoButtonWide: {
    width: '100%',
    height: 50,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FF6B6B',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    marginTop: 15,
    flexDirection: 'row',
  },
  addPhotoText: {
    color: '#FF6B6B',
    fontSize: 14,
    marginLeft: 8,
    textAlign: 'center',
    fontWeight: '600',
  },
  dragHint: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
  },

  // Drag animation styles
  photoWrapperDragging: {
    transform: [{ scale: 1.1 }],
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 1000,
  },
  gridPhotoDragging: {
    opacity: 0.9,
  },
  dragIndicator: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -10 }, { translateY: -10 }],
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noPhotosContainer: {
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    marginHorizontal: 10,
  },
  noPhotosText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
  noPhotosSubtext: {
    fontSize: 12,
    color: '#ccc',
    textAlign: 'center',
  },
});

export default PhotoManager;
