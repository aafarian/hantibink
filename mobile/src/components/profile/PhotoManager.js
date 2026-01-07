import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { uploadImageToFirebase, processMultipleImagesWithCrop } from '../../utils/imageUpload';
import ApiDataService from '../../services/ApiDataService';
import Logger from '../../utils/logger';
import { usePhotoViewer } from '../../contexts/PhotoViewerContext';
import { DraggableGrid } from 'react-native-draggable-grid';
import { theme } from '../../styles/theme';

const ASPECT_RATIO = 0.8; // 4:5 portrait ratio

// Debounce delay for API calls after drag ends (short - just to batch rapid drags)
const REORDER_DEBOUNCE_MS = 300;

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
  onPendingReorderChange: _onPendingReorderChange, // Callback when pending reorder state changes (unused but kept for API compatibility)
}) => {
  const [loading, setLoading] = useState(false);
  const [draggingItem, setDraggingItem] = useState(null);

  // LOCAL PHOTOS STATE - This is the source of truth for ordering
  // Only syncs from props on mount or when photos are added/deleted
  const [localPhotos, setLocalPhotos] = useState([]);

  const { openPhotoViewer } = usePhotoViewer();

  // Refs for debouncing
  const reorderDebounceRef = useRef(null);
  const isSavingRef = useRef(false);
  const lastPhotoCountRef = useRef(0);
  const latestPhotoOrderRef = useRef([]); // Stores latest order for debounced save

  // Transform photos to ensure they have proper structure for draggable-grid
  const normalizePhotos = useCallback(photoArray => {
    if (!Array.isArray(photoArray)) {
      return [];
    }
    return photoArray.map((photo, index) => ({
      key: photo.id || photo.url || `temp_${index}`,
      id: photo.id || photo.url || `temp_${index}`,
      url: typeof photo === 'string' ? photo : photo.url,
      isMain: index === 0, // First photo (top-left) is always main
      order: index,
    }));
  }, []);

  // Initialize local photos from props - only on mount or when photos added/deleted
  useEffect(() => {
    const currentCount = photos?.length || 0;
    const previousCount = lastPhotoCountRef.current;

    // Only sync from props when:
    // 1. First mount (localPhotos is empty)
    // 2. Photo count changed (added or deleted)
    if (localPhotos.length === 0 || currentCount !== previousCount) {
      Logger.debug(`🔄 Syncing localPhotos from props (count: ${previousCount} → ${currentCount})`);
      setLocalPhotos(normalizePhotos(photos));
      lastPhotoCountRef.current = currentCount;
    }
  }, [photos, localPhotos.length, normalizePhotos]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (reorderDebounceRef.current) {
        clearTimeout(reorderDebounceRef.current);
      }
    };
  }, []);

  // Helper function to check if order actually changed
  const hasOrderChanged = useCallback((newData, currentPhotos) => {
    const newOrder = newData.map(photo => photo.id);
    const currentOrder = currentPhotos.map(photo => photo.id);
    if (newOrder.length !== currentOrder.length) return true;
    return !newOrder.every((id, index) => id === currentOrder[index]);
  }, []);

  // Add new photo(s) - supports multi-select
  const addPhoto = async () => {
    try {
      const remainingSlots = maxPhotos - localPhotos.length;
      if (remainingSlots <= 0) {
        onError?.(`Maximum ${maxPhotos} photos allowed`);
        return;
      }

      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        onError?.('Camera roll permission is required');
        return;
      }

      Logger.info(`📸 Opening image picker (multi-select, limit: ${remainingSlots})`);

      // Multi-select picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: remainingSlots,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setLoading(true);
        const photoCount = result.assets.length;
        Logger.info(`📸 Selected ${photoCount} photos, processing...`);

        // Auto-crop all selected images to 4:5 portrait ratio
        const croppedImages = await processMultipleImagesWithCrop(result.assets, ASPECT_RATIO);

        const tempUserId = userId || `temp_${Date.now()}`;

        // Upload all photos to Firebase in parallel for speed
        Logger.info(`⬆️ Uploading ${photoCount} photos to Firebase in parallel...`);
        const uploadPromises = croppedImages.map(img => uploadImageToFirebase(img.uri, tempUserId));
        const uploadResults = await Promise.allSettled(uploadPromises);

        // Filter successful uploads
        const uploadedUrls = uploadResults
          .map((uploadResult, index) => ({ uploadResult, index }))
          .filter(({ uploadResult }) => uploadResult.status === 'fulfilled')
          .map(({ uploadResult, index }) => ({ url: uploadResult.value, index }));

        Logger.info(`✅ ${uploadedUrls.length}/${photoCount} photos uploaded to Firebase`);

        // Add to API or local state
        let addedCount = 0;
        for (const { url, index } of uploadedUrls) {
          try {
            if (mode === 'edit') {
              const isMain = localPhotos.length === 0 && index === 0;
              await ApiDataService.addUserPhoto(url, isMain);
              addedCount++;
            } else {
              const newPhoto = {
                id: `${Date.now()}-${index}`,
                key: `${Date.now()}-${index}`,
                url: url,
                isMain: localPhotos.length === 0 && index === 0,
                order: localPhotos.length + index,
              };
              setLocalPhotos(prev => [...prev, newPhoto]);
              onPhotosChange?.([...localPhotos, newPhoto]);
              addedCount++;
            }
          } catch (apiError) {
            Logger.error(`❌ Failed to add photo ${index + 1} to API:`, apiError);
          }
        }

        if (addedCount > 0) {
          onSuccess?.(
            addedCount === 1
              ? 'Photo added successfully!'
              : `${addedCount} photos added successfully!`
          );
        }
      }
    } catch (error) {
      Logger.error('❌ Error adding photos:', error);
      onError?.('Failed to add photos');
    } finally {
      setLoading(false);
    }
  };

  // Delete photo
  const deletePhoto = async photoIndex => {
    try {
      const photo = localPhotos[photoIndex];
      if (!photo) return;

      setLoading(true);

      if (mode === 'edit' && photo.id && !photo.id.toString().startsWith('temp_')) {
        await ApiDataService.deleteUserPhoto(photo.id);
        // Don't update local state - let the profile refresh handle it
        onSuccess?.('Photo deleted successfully!');
      } else {
        // Only update local state in registration mode or for temp photos
        const updatedPhotos = localPhotos
          .filter((_, index) => index !== photoIndex)
          .map((item, index) => ({
            ...item,
            isMain: index === 0, // First photo becomes main
            order: index,
          }));

        setLocalPhotos(updatedPhotos);
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

  // Set main photo - moves selected photo to first position
  const setMainPhoto = async photoIndex => {
    try {
      if (photoIndex === 0) {
        onError?.('This photo is already your main photo');
        return;
      }

      setLoading(true);

      // Reorder array to move selected photo to first position
      const photo = localPhotos[photoIndex];
      const otherPhotos = localPhotos.filter((_, index) => index !== photoIndex);
      const reorderedPhotos = [photo, ...otherPhotos].map((p, index) => ({
        ...p,
        isMain: index === 0,
        order: index,
      }));

      setLocalPhotos(reorderedPhotos);

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

  // Handle drag and drop reorder (legacy - unused)
  const _handleReorder = async ({ data }) => {
    try {
      setLoading(true);

      // Update order and main photo (first is always main)
      const reorderedPhotos = data.map((photo, index) => ({
        ...photo,
        isMain: index === 0,
        order: index,
      }));

      setLocalPhotos(reorderedPhotos);

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

  // Debounced API save function - just saves to backend, doesn't affect local state
  const saveReorderToApi = useCallback(
    async photoIds => {
      if (isSavingRef.current) {
        Logger.info('⏳ Already saving, skipping');
        return;
      }

      try {
        isSavingRef.current = true;
        Logger.info('💾 Saving photo order to API:', photoIds);

        await ApiDataService.reorderUserPhotos(photoIds);
        Logger.success('✅ Photo order saved to backend');
        // Silently refresh AuthContext profile (no toast needed for seamless reorder)
        onSuccess?.();
      } catch (error) {
        Logger.error('❌ Error saving photo order:', error);
        onError?.('Failed to save photo order');
      } finally {
        isSavingRef.current = false;
      }
    },
    [onError, onSuccess]
  );

  // Handle reorder from draggable-grid library
  // Frontend is source of truth - updates local state immediately, debounces API save
  const handleDragRelease = useCallback(
    data => {
      try {
        // Defensive check: ensure we have valid data
        if (!Array.isArray(data) || data.length === 0) {
          Logger.warn('⚠️ Invalid drag data received, ignoring');
          return;
        }

        // Defensive check: ensure data length matches expected photo count
        if (data.length !== localPhotos.length) {
          Logger.warn('⚠️ Drag data length mismatch, ignoring');
          return;
        }

        // Check if order actually changed
        if (!hasOrderChanged(data, localPhotos)) {
          Logger.debug('📍 No order change detected, ignoring');
          return;
        }

        Logger.info(
          '🏁 Photo reordered:',
          data.map(p => p.key || p.id)
        );

        // Update local state IMMEDIATELY (this is the source of truth)
        const updatedPhotos = data.map((photo, index) => ({
          ...photo,
          order: index,
          isMain: index === 0, // First photo (top-left) is always main
        }));

        setLocalPhotos(updatedPhotos);

        // Store latest order in ref for debounced save (avoids stale closure)
        latestPhotoOrderRef.current = updatedPhotos.map(photo => photo.id);

        // Clear dragging state
        setTimeout(() => setDraggingItem(null), 0);

        // DEBOUNCED API SAVE: Only save to API after user stops moving photos
        if (mode === 'edit') {
          // Clear any existing debounce timer
          if (reorderDebounceRef.current) {
            clearTimeout(reorderDebounceRef.current);
          }

          // Set new debounce timer - uses ref to always get latest order
          reorderDebounceRef.current = setTimeout(() => {
            Logger.info(
              '⏰ Debounce complete, saving to backend with order:',
              latestPhotoOrderRef.current
            );
            saveReorderToApi(latestPhotoOrderRef.current);
          }, REORDER_DEBOUNCE_MS);
        } else {
          // In non-edit mode (registration), also update parent
          onPhotosChange?.(updatedPhotos);
        }
      } catch (error) {
        Logger.error('❌ Error handling drag release:', error);
        onError?.('Failed to reorder photos');
        setTimeout(() => setDraggingItem(null), 0);
      }
    },
    [localPhotos, hasOrderChanged, mode, onPhotosChange, onError, saveReorderToApi]
  );

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

    // Find position in localPhotos - first position (index 0) is always main
    const currentPosition = localPhotos.findIndex(p => p.id === item.id);
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
          Photos ({localPhotos.length}/{maxPhotos})
        </Text>
      )}

      {localPhotos && localPhotos.length > 0 ? (
        <>
          <View
            onTouchStart={() => onScrollControl?.(false)}
            onTouchEnd={() => onScrollControl?.(true)}
            onTouchCancel={() => onScrollControl?.(true)}
            style={styles.draggableGridContainer}
          >
            <DraggableGrid
              numColumns={3}
              data={localPhotos}
              renderItem={renderPhotoItem}
              onDragRelease={handleDragRelease}
              onDragStart={handlePhotoDragStart}
              style={styles.draggableGrid}
              delayLongPress={100}
              dragStartAnimation={{}}
              onItemPress={item => {
                Logger.info('📸 Photo pressed (quick tap):', item);
                // Open photo viewer on quick tap
                if (item && localPhotos.length > 0) {
                  const photoIndex = localPhotos.findIndex(p => p.id === item.id);
                  if (photoIndex >= 0) {
                    Logger.info('📸 Opening photo viewer for index:', photoIndex);
                    openPhotoViewer({
                      photos: localPhotos,
                      initialIndex: photoIndex,
                      showActions: mode === 'edit',
                      title: 'Photo',
                      onDelete: mode === 'edit' ? deletePhoto : undefined,
                      onSetMain: mode === 'edit' ? setMainPhoto : undefined,
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
      {showAddButton && mode === 'edit' && localPhotos.length < maxPhotos && (
        <TouchableOpacity onPress={addPhoto} style={styles.addPhotoButtonWide} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <>
              <Ionicons name="add" size={24} color={theme.colors.primary} />
              <Text style={styles.addPhotoText}>
                Add Photo ({localPhotos.length}/{maxPhotos})
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
    backgroundColor: theme.colors.primary,
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
    borderColor: theme.colors.primary,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    marginTop: 15,
    flexDirection: 'row',
  },
  addPhotoText: {
    color: theme.colors.primary,
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
