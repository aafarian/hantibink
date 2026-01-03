import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, Image, ScrollView, Pressable } from 'react-native';
import Animated, { useAnimatedStyle, interpolate, Extrapolation } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getUserProfilePhoto } from '../utils/profileHelpers';
import { formatDistanceAway } from '../utils/distanceUtils';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const HERO_HEIGHT = SCREEN_HEIGHT * 0.55;

/**
 * Fullscreen swipeable card with clean layout
 * - Hero photo at top
 * - Photos distributed throughout content
 * - Clean label/value pairs for single fields
 * - Chips for multi-select fields (interests, languages)
 */
const FullscreenSwipeableCard = ({
  profile,
  translateX,
  isTop = false,
  onPhotoPress, // Callback to handle photo viewing at parent level
}) => {
  const insets = useSafeAreaInsets();
  const scrollViewRef = React.useRef(null);

  // Get all photo URLs
  const photos = useMemo(() => {
    if (!profile?.photos?.length) {
      const mainPhoto = getUserProfilePhoto(profile);
      return mainPhoto ? [mainPhoto] : [];
    }
    return profile.photos.map(p => (typeof p === 'string' ? p : p?.url)).filter(Boolean);
  }, [profile]);

  // Calculate age from birthDate
  const age = useMemo(() => {
    if (profile?.age) return profile.age;
    if (!profile?.birthDate) return null;
    const today = new Date();
    const birth = new Date(profile.birthDate);
    let calculatedAge = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      calculatedAge--;
    }
    return calculatedAge;
  }, [profile?.age, profile?.birthDate]);

  // Like/Nope label opacity based on swipe
  const likeOpacity = useAnimatedStyle(() => {
    return {
      opacity: interpolate(translateX.value, [0, SCREEN_WIDTH / 4], [0, 1], Extrapolation.CLAMP),
    };
  });

  const nopeOpacity = useAnimatedStyle(() => {
    return {
      opacity: interpolate(translateX.value, [-SCREEN_WIDTH / 4, 0], [1, 0], Extrapolation.CLAMP),
    };
  });

  // Helper to format relationship type
  const formatRelationshipType = relationshipType => {
    if (!relationshipType) return null;
    if (Array.isArray(relationshipType)) {
      if (relationshipType.length === 0) return null;
      return relationshipType
        .map(t => t.charAt(0).toUpperCase() + t.slice(1).replace('-', ' '))
        .join(', ');
    }
    return relationshipType;
  };

  // Helper to format lifestyle fields
  const formatSmoking = smoking => {
    if (!smoking) return null;
    const map = {
      never: 'Non-smoker',
      sometimes: 'Social smoker',
      regularly: 'Smoker',
    };
    return map[smoking] || smoking;
  };

  const formatDrinking = drinking => {
    if (!drinking) return null;
    const map = {
      never: 'Non-drinker',
      socially: 'Social drinker',
      regularly: 'Regular drinker',
    };
    return map[drinking] || drinking;
  };

  // Build profile sections with photos distributed throughout
  const buildProfileSections = useCallback(() => {
    if (!profile) return [];

    const sections = [];
    let photoIndex = 1; // Start from 1 since hero shows first photo

    // Track if last item was a photo (to add dividers between consecutive photos)
    let lastWasPhoto = true; // Hero is a photo

    // Helper to add photo with divider logic
    const addPhotoWithDivider = () => {
      if (photoIndex < photos.length) {
        // Add divider if last item was also a photo
        if (lastWasPhoto) {
          sections.push({
            type: 'photo-divider',
            key: `divider-${photoIndex}`,
          });
        }
        sections.push({
          type: 'photo',
          data: photos[photoIndex],
          photoIndex: photoIndex, // Track index for expansion
          key: `photo-${photoIndex}`,
        });
        photoIndex++;
        lastWasPhoto = true;
        return true;
      }
      return false;
    };

    // BLOCK 1: Bio (always show, with placeholder if empty)
    sections.push({
      type: 'bio',
      data: profile.bio || null,
      key: 'bio',
    });
    lastWasPhoto = false;

    // Photo break after bio
    addPhotoWithDivider();

    // BLOCK 2: Essentials - always show these core fields
    const essentialFields = [];

    // Location - always show
    essentialFields.push({
      label: 'Location',
      value: profile.location || null,
      icon: 'location-outline',
      placeholder: 'Not specified',
    });

    // Looking for - always show
    const relationshipText = formatRelationshipType(profile.relationshipType);
    essentialFields.push({
      label: 'Looking for',
      value: relationshipText,
      icon: 'heart-outline',
      placeholder: 'Not specified',
    });

    // Work - always show
    essentialFields.push({
      label: 'Work',
      value: profile.profession || null,
      icon: 'briefcase-outline',
      placeholder: 'Not specified',
    });

    // Education - always show
    essentialFields.push({
      label: 'Education',
      value: profile.education || null,
      icon: 'school-outline',
      placeholder: 'Not specified',
    });

    sections.push({
      type: 'essentials',
      data: essentialFields,
      key: 'essentials',
    });
    lastWasPhoto = false;

    // Photo break after essentials
    addPhotoWithDivider();

    // BLOCK 3: Details - only show fields that have values
    const detailFields = [];

    if (profile.height) {
      detailFields.push({
        label: 'Height',
        value: profile.height,
        icon: 'resize-outline',
      });
    }

    if (profile.religion) {
      detailFields.push({
        label: 'Religion',
        value: profile.religion,
        icon: 'sparkles-outline',
      });
    }

    const smokingText = formatSmoking(profile.smoking);
    if (smokingText) {
      detailFields.push({
        label: 'Smoking',
        value: smokingText,
        icon: 'flame-outline',
      });
    }

    const drinkingText = formatDrinking(profile.drinking);
    if (drinkingText) {
      detailFields.push({
        label: 'Drinking',
        value: drinkingText,
        icon: 'wine-outline',
      });
    }

    if (profile.pets) {
      detailFields.push({
        label: 'Pets',
        value: profile.pets,
        icon: 'paw-outline',
      });
    }

    if (profile.travel) {
      detailFields.push({
        label: 'Travel',
        value: profile.travel,
        icon: 'airplane-outline',
      });
    }

    if (detailFields.length > 0) {
      sections.push({
        type: 'details',
        data: detailFields,
        key: 'details',
      });
      lastWasPhoto = false;

      // Photo break after details
      addPhotoWithDivider();
    }

    // BLOCK 4: Languages (always show)
    const hasLanguages = profile.languages && profile.languages.length > 0;
    sections.push({
      type: 'languages',
      data: hasLanguages ? profile.languages : null,
      key: 'languages',
    });
    lastWasPhoto = false;

    // BLOCK 5: Interests (always show)
    const hasInterests = profile.interests && profile.interests.length > 0;
    sections.push({
      type: 'interests',
      data: hasInterests ? profile.interests : null,
      key: 'interests',
    });
    lastWasPhoto = false;

    // Add all remaining photos with dividers between them
    while (addPhotoWithDivider()) {}

    return sections;
  }, [profile, photos]);

  // Render a single info field with label and value (supports placeholders)
  const renderInfoField = (field, index, isLast) => {
    const hasValue = field.value !== null && field.value !== undefined && field.value !== '';
    const displayValue = hasValue ? field.value : field.placeholder || 'Not specified';

    return (
      <View key={index} style={[styles.infoField, !isLast && styles.infoFieldBorder]}>
        <Text style={styles.infoLabel}>{field.label}</Text>
        <View style={styles.infoValueRow}>
          <Ionicons
            name={field.icon}
            size={18}
            color={hasValue ? '#666' : '#ccc'}
            style={styles.infoIcon}
          />
          <Text style={[styles.infoValue, !hasValue && styles.placeholderValue]}>
            {displayValue}
          </Text>
        </View>
      </View>
    );
  };

  // Render chip for multi-select items
  const renderChip = (text, index) => (
    <View key={index} style={styles.chip}>
      <Text style={styles.chipText}>{text}</Text>
    </View>
  );

  const renderSection = section => {
    switch (section.type) {
      case 'photo':
        return (
          <Pressable
            style={styles.photoSection}
            key={section.key}
            onPress={() => handlePhotoPress(section.photoIndex)}
          >
            <Image source={{ uri: section.data }} style={styles.sectionPhoto} resizeMode="cover" />
            <View style={styles.photoExpandHint}>
              <Ionicons name="expand-outline" size={20} color="#fff" />
            </View>
          </Pressable>
        );

      case 'photo-divider':
        return (
          <View style={styles.photoDivider} key={section.key}>
            <View style={styles.photoDividerLine} />
          </View>
        );

      case 'bio':
        return (
          <View style={styles.section} key={section.key}>
            <Text style={styles.sectionTitle}>About me</Text>
            {section.data ? (
              <Text style={styles.bioText}>{section.data}</Text>
            ) : (
              <Text style={styles.placeholderText}>
                {profile?.name || 'This person'} hasn't written a bio yet
              </Text>
            )}
          </View>
        );

      case 'essentials':
        return (
          <View style={styles.section} key={section.key}>
            <Text style={styles.sectionTitle}>Essentials</Text>
            <View style={styles.infoFieldsContainer}>
              {section.data.map((field, index) =>
                renderInfoField(field, index, index === section.data.length - 1)
              )}
            </View>
          </View>
        );

      case 'details':
        return (
          <View style={styles.section} key={section.key}>
            <Text style={styles.sectionTitle}>More about me</Text>
            <View style={styles.infoFieldsContainer}>
              {section.data.map((field, index) =>
                renderInfoField(field, index, index === section.data.length - 1)
              )}
            </View>
          </View>
        );

      case 'languages':
        return (
          <View style={styles.section} key={section.key}>
            <Text style={styles.sectionTitle}>Languages</Text>
            {section.data ? (
              <View style={styles.chipContainer}>
                {section.data.map((lang, index) => renderChip(lang, index))}
              </View>
            ) : (
              <Text style={styles.placeholderText}>No languages specified</Text>
            )}
          </View>
        );

      case 'interests':
        return (
          <View style={styles.section} key={section.key}>
            <Text style={styles.sectionTitle}>Interests</Text>
            {section.data ? (
              <View style={styles.chipContainer}>
                {section.data.map((interest, index) => {
                  const interestName =
                    typeof interest === 'object'
                      ? interest.interest?.name || interest.name
                      : interest;
                  return renderChip(interestName, index);
                })}
              </View>
            ) : (
              <Text style={styles.placeholderText}>No interests specified</Text>
            )}
          </View>
        );

      default:
        return null;
    }
  };

  const profileSections = useMemo(() => buildProfileSections(), [buildProfileSections]);

  // Handle photo tap to expand - delegate to parent to avoid gesture conflicts
  const handlePhotoPress = useCallback(
    photoIndex => {
      onPhotoPress?.(photos, photoIndex);
    },
    [onPhotoPress, photos]
  );

  // Reset scroll when profile changes
  React.useEffect(() => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
  }, [profile?.id]);

  if (!profile) return null;

  return (
    <View style={styles.container}>
      {/* Scrollable content */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {/* Hero Photo Section */}
        <Pressable style={styles.heroContainer} onPress={() => handlePhotoPress(0)}>
          <Image
            source={{ uri: photos[0] || getUserProfilePhoto(profile) }}
            style={styles.heroImage}
            resizeMode="cover"
          />

          {/* Gradient overlay at bottom of hero */}
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={styles.heroGradient} />

          {/* Name overlay on hero */}
          <View style={styles.heroInfo}>
            <Text style={styles.heroName}>
              {profile.name}
              {age && <Text style={styles.heroAge}>, {age}</Text>}
            </Text>
            <View style={styles.heroDetails}>
              {profile.distance !== null && profile.distance !== undefined && (
                <View style={styles.heroDetailItem}>
                  <Ionicons name="location" size={14} color="#fff" />
                  <Text style={styles.heroDetailText}>
                    {formatDistanceAway(profile.distance, 'miles')}
                  </Text>
                </View>
              )}
              {profile.profession && (
                <View style={styles.heroDetailItem}>
                  <Ionicons name="briefcase" size={14} color="#fff" />
                  <Text style={styles.heroDetailText}>{profile.profession}</Text>
                </View>
              )}
            </View>
          </View>
        </Pressable>

        {/* Profile sections with distributed photos */}
        {profileSections.map(section => renderSection(section))}

        {/* Bottom spacer for floating buttons */}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Like/Nope labels - only show on top card */}
      {isTop && (
        <>
          <Animated.View style={[styles.likeLabel, likeOpacity]}>
            <Text style={styles.likeText}>LIKE</Text>
          </Animated.View>
          <Animated.View style={[styles.nopeLabel, nopeOpacity]}>
            <Text style={styles.nopeText}>NOPE</Text>
          </Animated.View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  // Hero photo styles
  heroContainer: {
    width: SCREEN_WIDTH,
    height: HERO_HEIGHT,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 180,
  },
  heroInfo: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
  },
  heroName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroAge: {
    fontWeight: '400',
  },
  heroDetails: {
    marginTop: 8,
    gap: 4,
  },
  heroDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroDetailText: {
    fontSize: 14,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  // Photo sections
  photoSection: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 1.25,
    position: 'relative',
  },
  sectionPhoto: {
    width: '100%',
    height: '100%',
  },
  photoExpandHint: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
  },
  photoDivider: {
    height: 50,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoDividerLine: {
    width: 60,
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
  },
  // Content sections
  section: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#fff',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  // Bio
  bioText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
  },
  // Placeholder text for empty fields
  placeholderText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#999',
    fontStyle: 'italic',
  },
  placeholderValue: {
    color: '#bbb',
    fontStyle: 'italic',
    fontWeight: '400',
  },
  // Info fields (label + value pairs)
  infoFieldsContainer: {
    backgroundColor: '#fff',
  },
  infoField: {
    paddingVertical: 16,
  },
  infoFieldBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  infoValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoIcon: {
    marginRight: 10,
  },
  infoValue: {
    fontSize: 16,
    color: '#222',
    fontWeight: '500',
    flex: 1,
  },
  // Chips for multi-select (languages, interests)
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  chipText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  bottomSpacer: {
    height: 200,
  },
  // Like/Nope labels
  likeLabel: {
    position: 'absolute',
    top: 100,
    left: 30,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderWidth: 4,
    borderColor: '#4CAF50',
    borderRadius: 10,
    transform: [{ rotate: '-25deg' }],
  },
  likeText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  nopeLabel: {
    position: 'absolute',
    top: 100,
    right: 30,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderWidth: 4,
    borderColor: '#FF5252',
    borderRadius: 10,
    transform: [{ rotate: '25deg' }],
  },
  nopeText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FF5252',
  },
});

export default FullscreenSwipeableCard;
