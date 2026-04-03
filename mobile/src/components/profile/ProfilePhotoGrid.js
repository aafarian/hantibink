import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ClickablePhoto from '../shared/ClickablePhoto';
import { theme } from '../../styles/theme';

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
          <Ionicons name={emptyIcon} size={40} color={theme.colors.gray[300]} />
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
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.bold,
    fontFamily: theme.typography.fontFamily.bold,
    marginBottom: theme.spacing.lg,
    color: theme.colors.text.primary,
  },
  photosContainer: {
    paddingHorizontal: theme.spacing.xs,
  },
  photoWrapper: {
    position: 'relative',
  },
  photo: {
    // Base photo styles
  },
  mainPhoto: {
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  mainBadge: {
    position: 'absolute',
    top: 5,
    left: 5,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  mainBadgeText: {
    color: theme.colors.text.white,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.bold,
    fontFamily: theme.typography.fontFamily.bold,
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.gray[100],
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.gray[300],
    borderStyle: 'dashed',
  },
  emptyText: {
    fontSize: theme.typography.sizes.md,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.gray[500],
    marginTop: theme.spacing.sm,
    textAlign: 'center',
  },
});

export default ProfilePhotoGrid;
