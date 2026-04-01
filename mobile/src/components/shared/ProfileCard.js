import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../styles/theme';

/**
 * Extract photo URL from photo object or string (pure utility function)
 */
const getPhotoUrl = photo => {
  if (typeof photo === 'string') return photo;
  if (photo?.url) return photo.url;
  return null;
};

/**
 * Calculate age from birth date (pure utility function)
 */
const calculateAge = birthDate => {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};

/**
 * Shared ProfileCard component used across the app
 * - PeopleScreen (swipe cards)
 * - LikedYouScreen
 * - ProfileBottomSheet (from chat)
 */
const ProfileCard = ({
  profile,
  style,
  imageStyle,
  showFullDetails = false,
  onPhotoTap,
  children,
}) => {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  // Memoize all derived values from profile
  const photos = useMemo(() => {
    if (!profile?.photos) return [];
    return profile.photos.map(getPhotoUrl).filter(Boolean);
  }, [profile?.photos]);

  const interests = useMemo(() => {
    if (!profile?.interests) return [];
    return profile.interests
      .map(interest => {
        if (typeof interest === 'object') {
          return interest.interest?.name || interest.name || '';
        }
        return interest;
      })
      .filter(Boolean);
  }, [profile?.interests]);

  const languages = useMemo(() => {
    if (!profile?.languages) return [];
    return Array.isArray(profile.languages) ? profile.languages : [];
  }, [profile?.languages]);

  const relationshipTypes = useMemo(() => {
    if (!profile?.relationshipType) return [];
    if (Array.isArray(profile.relationshipType)) {
      return profile.relationshipType.map(
        type => type.charAt(0).toUpperCase() + type.slice(1).replace('-', ' ')
      );
    }
    if (typeof profile.relationshipType === 'string') {
      return profile.relationshipType
        .split(',')
        .map(type => type.trim().charAt(0).toUpperCase() + type.trim().slice(1).replace('-', ' '));
    }
    return [];
  }, [profile?.relationshipType]);

  // Handle photo tap to cycle through photos - memoized (must be before early returns)
  const handlePhotoTap = useCallback(() => {
    if (onPhotoTap) {
      onPhotoTap();
      return;
    }
    if (photos.length > 1) {
      setCurrentPhotoIndex(prev => (prev + 1) % photos.length);
    }
  }, [onPhotoTap, photos.length]);

  // Render info row with icon - memoized (must be before early returns)
  const renderInfoRow = useCallback((icon, text, iconColor = theme.colors.text.white) => {
    if (!text) return null;
    return (
      <View style={styles.infoRow}>
        <Ionicons name={icon} size={16} color={iconColor} style={styles.infoIcon} />
        <Text style={styles.infoText}>{text}</Text>
      </View>
    );
  }, []);

  // Render tag pills - memoized (must be before early returns)
  const renderTags = useCallback((items, maxItems = 6) => {
    if (!items || items.length === 0) return null;
    return (
      <View style={styles.tagsContainer}>
        {items.slice(0, maxItems).map((item, index) => (
          <View key={index} style={styles.tag}>
            <Text style={styles.tagText}>{item}</Text>
          </View>
        ))}
        {items.length > maxItems && (
          <View style={styles.tag}>
            <Text style={styles.tagText}>+{items.length - maxItems}</Text>
          </View>
        )}
      </View>
    );
  }, []);

  // Early return for null profile
  if (!profile) return null;

  const currentPhoto = photos[currentPhotoIndex] || photos[0] || profile.mainPhoto || null;
  const age = profile.age || calculateAge(profile.birthDate);

  // If no photo available, show placeholder
  if (!currentPhoto) {
    return (
      <View style={[styles.card, styles.noPhotoCard, style]}>
        <View style={styles.noPhotoContent}>
          <Ionicons
            name="person-circle-outline"
            size={80}
            color={theme.colors.background.overlay}
          />
          <Text style={styles.cardName}>
            {profile.name}
            {age && `, ${age}`}
          </Text>
          {profile.location && <Text style={styles.noPhotoLocation}>{profile.location}</Text>}
        </View>
        {children}
      </View>
    );
  }

  return (
    <View style={[styles.card, style]}>
      {/* Photo */}
      <TouchableOpacity activeOpacity={0.95} onPress={handlePhotoTap} style={styles.imageContainer}>
        <Image
          source={{ uri: currentPhoto }}
          style={[styles.cardImage, imageStyle]}
          resizeMode="cover"
        />

        {/* Photo indicators */}
        {photos.length > 1 && (
          <View style={styles.photoIndicators}>
            {photos.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.photoIndicator,
                  index === currentPhotoIndex && styles.photoIndicatorActive,
                ]}
              />
            ))}
          </View>
        )}

        {/* Gradient overlay */}
        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.gradient}>
          <ScrollView
            style={styles.infoScroll}
            showsVerticalScrollIndicator={false}
            bounces={false}
            nestedScrollEnabled={true}
          >
            {/* Name and Age */}
            <Text style={styles.cardName}>
              {profile.name}
              {age && <Text>, {age}</Text>}
            </Text>

            {/* Location */}
            {profile.location && (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={14} color={theme.colors.text.white} />
                <Text style={styles.cardLocation}>{profile.location}</Text>
              </View>
            )}

            {/* Bio */}
            {profile.bio && (
              <Text style={styles.cardBio} numberOfLines={showFullDetails ? undefined : 3}>
                {profile.bio}
              </Text>
            )}

            {/* Extended details - shown when showFullDetails is true */}
            {showFullDetails && (
              <View style={styles.detailsSection}>
                {/* Work & Education */}
                {(profile.profession || profile.education) && (
                  <View style={styles.detailGroup}>
                    {renderInfoRow('briefcase-outline', profile.profession)}
                    {renderInfoRow('school-outline', profile.education)}
                  </View>
                )}

                {/* Basic Info */}
                {(profile.height || profile.religion) && (
                  <View style={styles.detailGroup}>
                    {renderInfoRow('resize-outline', profile.height)}
                    {renderInfoRow('sparkles-outline', profile.religion)}
                  </View>
                )}

                {/* Lifestyle */}
                {(profile.smoking || profile.drinking) && (
                  <View style={styles.detailGroup}>
                    {profile.smoking && renderInfoRow('ban-outline', `Smoking: ${profile.smoking}`)}
                    {profile.drinking &&
                      renderInfoRow('wine-outline', `Drinking: ${profile.drinking}`)}
                  </View>
                )}

                {/* Travel & Pets */}
                {(profile.travel || profile.pets) && (
                  <View style={styles.detailGroup}>
                    {renderInfoRow('airplane-outline', profile.travel)}
                    {renderInfoRow('paw-outline', profile.pets)}
                  </View>
                )}

                {/* Looking For */}
                {relationshipTypes.length > 0 && (
                  <View style={styles.detailGroup}>
                    <Text style={styles.sectionLabel}>Looking for</Text>
                    {renderTags(relationshipTypes, 4)}
                  </View>
                )}

                {/* Languages */}
                {languages.length > 0 && (
                  <View style={styles.detailGroup}>
                    <Text style={styles.sectionLabel}>Languages</Text>
                    {renderTags(languages, 4)}
                  </View>
                )}
              </View>
            )}

            {/* Interests - always shown */}
            {interests.length > 0 && (
              <View style={styles.interestsSection}>
                {renderTags(interests, showFullDetails ? 10 : 6)}
              </View>
            )}
          </ScrollView>
        </LinearGradient>
      </TouchableOpacity>

      {/* Optional children (action buttons, etc.) */}
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: theme.colors.text.primary,
    ...theme.shadows.medium,
  },
  imageContainer: {
    flex: 1,
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  photoIndicators: {
    position: 'absolute',
    top: 12,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  photoIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  photoIndicatorActive: {
    backgroundColor: theme.colors.text.white,
    width: 20,
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 60,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  infoScroll: {
    maxHeight: 280,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  cardName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text.white,
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardLocation: {
    fontSize: 14,
    color: theme.colors.text.white,
    marginLeft: 4,
  },
  cardBio: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 20,
    marginBottom: 12,
  },
  detailsSection: {
    marginTop: 8,
  },
  detailGroup: {
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  infoIcon: {
    marginRight: 8,
    opacity: 0.9,
  },
  infoText: {
    fontSize: 14,
    color: theme.colors.text.white,
    flex: 1,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  tagText: {
    color: theme.colors.text.white,
    fontSize: 12,
  },
  interestsSection: {
    marginTop: 8,
  },
  noPhotoCard: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  noPhotoContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noPhotoLocation: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
});

export default ProfileCard;
