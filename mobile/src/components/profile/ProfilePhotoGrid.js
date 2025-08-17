import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ClickablePhoto from '../shared/ClickablePhoto';

/**
 * Read-only photo grid for viewing profile photos
 * Used in ProfileScreen and other places where photos are displayed but not edited
 */
const ProfilePhotoGrid = ({
  photos = [],
  title = 'Photos',
  showTitle = true,
  photoSize = 100,
  spacing = 10,
  style,
  emptyMessage = 'No photos yet',
  emptyIcon = 'camera-outline',
}) => {
  // Normalize photos to ensure they have proper structure
  const normalizedPhotos = photos.map((photo, index) => ({
    id: photo.id || photo.url || `photo_${index}`,
    url: typeof photo === 'string' ? photo : photo.url,
    isMain: photo.isMain || index === 0,
    order: photo.order ?? index,
  }));

  return (
    <View style={[styles.container, style]}>
      {showTitle && (
        <Text style={styles.title}>
          {title} {normalizedPhotos.length > 0 && `(${normalizedPhotos.length})`}
        </Text>
      )}

      {normalizedPhotos.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.photosContainer}
        >
          {normalizedPhotos.map((photo, index) => (
            <View
              key={photo.id}
              style={[
                styles.photoWrapper,
                { marginRight: index < normalizedPhotos.length - 1 ? spacing : 0 },
              ]}
            >
              <ClickablePhoto
                photo={photo}
                photos={normalizedPhotos}
                photoIndex={index}
                size={photoSize}
                title={`${title} ${index + 1}`}
                style={[styles.photo, index === 0 && styles.mainPhoto]}
              />

              {index === 0 && (
                <View style={styles.mainBadge}>
                  <Text style={styles.mainBadgeText}>MAIN</Text>
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={[styles.emptyContainer, { height: photoSize }]}>
          <Ionicons name={emptyIcon} size={40} color="#ccc" />
          <Text style={styles.emptyText}>{emptyMessage}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    // Container styles will be inherited from parent
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  photosContainer: {
    paddingHorizontal: 5,
  },
  photoWrapper: {
    position: 'relative',
  },
  photo: {
    // Base photo styles
  },
  mainPhoto: {
    borderWidth: 2,
    borderColor: '#FF6B6B',
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
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
});

export default ProfilePhotoGrid;
