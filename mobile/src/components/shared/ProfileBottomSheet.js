import React, {
  useRef,
  useMemo,
  forwardRef,
  useImperativeHandle,
  useEffect,
  useCallback,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Platform,
  BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { theme } from '../../styles/theme';
import AnimatedInterestTags from './AnimatedInterestTags';

const { height: screenHeight, width: screenWidth } = Dimensions.get('window');
const statusBarHeight = Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 44;
const availableHeight = screenHeight - statusBarHeight;
const PHOTO_HEIGHT = screenWidth * 1.2;

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
 * Extract photo URL from photo object or string (pure utility function)
 */
const getPhotoUrl = photo => {
  if (typeof photo === 'string') return photo;
  if (photo?.url) return photo.url;
  return null;
};

/**
 * Photo with parallax scroll effect
 */
const ParallaxPhoto = ({ uri, index, scrollY }) => {
  // Calculate the approximate Y position of this photo in the scroll view
  // Each photo section is PHOTO_HEIGHT, content sections are ~100-200px
  const estimatedOffset = index * (PHOTO_HEIGHT + 150);

  const animatedStyle = useAnimatedStyle(() => {
    // Parallax: photo moves slower than scroll (0.3x speed)
    const translateY = interpolate(
      scrollY.value,
      [estimatedOffset - screenHeight, estimatedOffset, estimatedOffset + PHOTO_HEIGHT],
      [30, 0, -30],
      Extrapolation.CLAMP
    );

    // Subtle scale effect as photo comes into view
    const scale = interpolate(
      scrollY.value,
      [estimatedOffset - screenHeight, estimatedOffset, estimatedOffset + PHOTO_HEIGHT],
      [1.05, 1, 1.05],
      Extrapolation.CLAMP
    );

    return {
      transform: [{ translateY }, { scale }],
    };
  });

  return (
    <View style={styles.photoSection}>
      <Animated.Image
        source={{ uri }}
        style={[styles.fullPhoto, animatedStyle]}
        resizeMode="cover"
      />
    </View>
  );
};

/**
 * Bottom sheet for viewing other users' full profiles
 * Bumble-style layout with interspersed photos and information
 */
const ProfileBottomSheet = forwardRef(
  ({ profile, showActions = true, actionButtons = [], onClose }, ref) => {
    const bottomSheetRef = useRef(null);
    const snapPoints = useMemo(() => ['50%', availableHeight * 0.9], []);
    const isOpenRef = useRef(false);

    // Scroll position for parallax effect. Written from the JS-thread
    // onScroll below — gorhom funnels the user onScroll through runOnJS, so
    // a useAnimatedScrollHandler result is NOT callable here (calling it
    // threw every frame and tore down the whole surface in release builds)
    const scrollY = useSharedValue(0);

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
      open: () => {
        bottomSheetRef.current?.expand();
        isOpenRef.current = true;
      },
      close: () => {
        bottomSheetRef.current?.close();
        isOpenRef.current = false;
      },
    }));

    const handleClose = useCallback(() => {
      bottomSheetRef.current?.close();
      isOpenRef.current = false;
      onClose?.();
    }, [onClose]);

    // Handle Android back button
    useEffect(() => {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        if (isOpenRef.current) {
          handleClose();
          return true; // Prevent default back behavior
        }
        return false;
      });

      return () => backHandler.remove();
    }, [handleClose]);

    // Single JS-thread scroll callback: feeds the parallax shared value
    // (cross-thread .value writes are legal). Sheet-vs-scroll arbitration is
    // handled by gorhom's own scroll handlers — toggling
    // enableContentPanningGesture per frame re-built the gesture mid-touch
    const handleScroll = useCallback(
      event => {
        scrollY.value = event.nativeEvent.contentOffset.y;
      },
      [scrollY]
    );

    // Build the interspersed content sections - memoized to prevent recalculation
    const profileSections = useMemo(() => {
      if (!profile) return [];

      const sections = [];
      const photos = profile.photos || [];
      const age = calculateAge(profile.birthDate);

      // Helper to add a photo section if available
      let photoIndex = 0;
      let photoSectionIndex = 0;
      const addPhotoSection = () => {
        while (photoIndex < photos.length) {
          const photoUrl = getPhotoUrl(photos[photoIndex]);
          photoIndex++;
          if (photoUrl) {
            sections.push({
              type: 'photo',
              data: photoUrl,
              key: `photo-${photoIndex - 1}`,
              photoSectionIndex: photoSectionIndex++,
            });
            return true;
          }
        }
        return false;
      };

      // Section 1: First photo (if available)
      addPhotoSection();

      // Section 2: Name, age, and location
      sections.push({
        type: 'header',
        data: {
          name: profile.name || 'Anonymous',
          age: age,
          location: profile.location || 'Location not provided',
        },
        key: 'header',
      });

      // Section 3: Second photo (if available)
      addPhotoSection();

      // Section 4: Bio
      sections.push({
        type: 'bio',
        data: profile.bio || "They haven't written anything about themselves yet",
        key: 'bio',
      });

      // Section 5: Third photo (if available)
      addPhotoSection();

      // Section 6: Work & Education
      const hasWorkEducation = profile.profession || profile.education;
      sections.push({
        type: 'work-education',
        data: {
          profession: profile.profession,
          education: profile.education,
        },
        hasData: hasWorkEducation,
        key: 'work-education',
      });

      // Section 7: Fourth photo (if available)
      addPhotoSection();

      // Section 8: Basic Info (height, relationship type, religion)
      const hasBasicInfo = profile.height || profile.relationshipType || profile.religion;
      sections.push({
        type: 'basic-info',
        data: {
          height: profile.height,
          relationshipType: profile.relationshipType,
          religion: profile.religion,
        },
        hasData: hasBasicInfo,
        key: 'basic-info',
      });

      // Section 9: Fifth photo (if available)
      addPhotoSection();

      // Section 10: Lifestyle
      const hasLifestyle = profile.smoking || profile.drinking || profile.pets || profile.travel;
      sections.push({
        type: 'lifestyle',
        data: {
          smoking: profile.smoking,
          drinking: profile.drinking,
          pets: profile.pets,
          travel: profile.travel,
        },
        hasData: hasLifestyle,
        key: 'lifestyle',
      });

      // Add remaining photos
      while (addPhotoSection()) {
        // Keep adding photos until we run out
      }

      // Section Last: Interests (always at the end)
      if (profile.interests && profile.interests.length > 0) {
        // Extract interest names
        const interestNames = profile.interests.map(interest =>
          typeof interest === 'object' ? interest.interest?.name || interest.name : interest
        );
        sections.push({
          type: 'interests',
          data: interestNames,
          key: 'interests',
        });
      }

      return sections;
    }, [profile]);

    // Memoized render function for sections
    const renderSection = useCallback(
      section => {
        switch (section.type) {
          case 'photo':
            return (
              <ParallaxPhoto
                key={section.key}
                uri={section.data}
                index={section.photoSectionIndex}
                scrollY={scrollY}
              />
            );

          case 'header':
            return (
              <View style={styles.contentSection} key={section.key}>
                <Text style={styles.nameText}>
                  {section.data.name}
                  {section.data.age && <Text style={styles.ageText}>, {section.data.age}</Text>}
                </Text>
                <View style={styles.locationRow}>
                  <Ionicons name="location-outline" size={18} color={theme.colors.text.secondary} />
                  <Text style={styles.locationText}>{section.data.location}</Text>
                </View>
              </View>
            );

          case 'bio':
            return (
              <View style={styles.contentSection} key={section.key}>
                <Text style={styles.sectionTitle}>About me</Text>
                <Text style={styles.bioText}>{section.data}</Text>
              </View>
            );

          case 'work-education':
            if (!section.hasData) {
              return (
                <View style={styles.contentSection} key={section.key}>
                  <Text style={styles.sectionTitle}>Work & Education</Text>
                  <Text style={styles.notProvidedText}>Not provided</Text>
                </View>
              );
            }
            return (
              <View style={styles.contentSection} key={section.key}>
                <Text style={styles.sectionTitle}>Work & Education</Text>
                {section.data.profession && (
                  <View style={styles.infoRow}>
                    <Ionicons
                      name="briefcase-outline"
                      size={18}
                      color={theme.colors.text.secondary}
                    />
                    <Text style={styles.infoText}>{section.data.profession}</Text>
                  </View>
                )}
                {section.data.education && (
                  <View style={styles.infoRow}>
                    <Ionicons name="school-outline" size={18} color={theme.colors.text.secondary} />
                    <Text style={styles.infoText}>{section.data.education}</Text>
                  </View>
                )}
              </View>
            );

          case 'basic-info':
            if (!section.hasData) {
              return null;
            }
            return (
              <View style={styles.contentSection} key={section.key}>
                <Text style={styles.sectionTitle}>Basic Info</Text>
                {section.data.height && (
                  <View style={styles.infoRow}>
                    <Ionicons name="resize-outline" size={18} color={theme.colors.text.secondary} />
                    <Text style={styles.infoText}>{section.data.height}</Text>
                  </View>
                )}
                {section.data.relationshipType && (
                  <View style={styles.infoRow}>
                    <Ionicons name="heart-outline" size={18} color={theme.colors.text.secondary} />
                    <Text style={styles.infoText}>
                      {Array.isArray(section.data.relationshipType)
                        ? section.data.relationshipType.join(', ')
                        : section.data.relationshipType}
                    </Text>
                  </View>
                )}
                {section.data.religion && (
                  <View style={styles.infoRow}>
                    <Ionicons
                      name="library-outline"
                      size={18}
                      color={theme.colors.text.secondary}
                    />
                    <Text style={styles.infoText}>{section.data.religion}</Text>
                  </View>
                )}
              </View>
            );

          case 'lifestyle':
            if (!section.hasData) {
              return null;
            }
            return (
              <View style={styles.contentSection} key={section.key}>
                <Text style={styles.sectionTitle}>Lifestyle</Text>
                {section.data.smoking && (
                  <View style={styles.infoRow}>
                    <Ionicons name="ban-outline" size={18} color={theme.colors.text.secondary} />
                    <Text style={styles.infoText}>{section.data.smoking}</Text>
                  </View>
                )}
                {section.data.drinking && (
                  <View style={styles.infoRow}>
                    <Ionicons name="wine-outline" size={18} color={theme.colors.text.secondary} />
                    <Text style={styles.infoText}>{section.data.drinking}</Text>
                  </View>
                )}
                {section.data.pets && (
                  <View style={styles.infoRow}>
                    <Ionicons name="paw-outline" size={18} color={theme.colors.text.secondary} />
                    <Text style={styles.infoText}>{section.data.pets}</Text>
                  </View>
                )}
                {section.data.travel && (
                  <View style={styles.infoRow}>
                    <Ionicons
                      name="airplane-outline"
                      size={18}
                      color={theme.colors.text.secondary}
                    />
                    <Text style={styles.infoText}>{section.data.travel}</Text>
                  </View>
                )}
              </View>
            );

          case 'interests':
            return (
              <View style={styles.contentSection} key={section.key}>
                <Text style={styles.sectionTitle}>Interests</Text>
                <AnimatedInterestTags
                  items={section.data}
                  maxItems={12}
                  tagStyle={styles.interestBubble}
                  textStyle={styles.interestText}
                />
              </View>
            );

          default:
            return null;
        }
      },
      [scrollY]
    );

    if (!profile) return null;

    return (
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose={true}
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={styles.bottomSheetIndicator}
        enableContentPanningGesture={true}
        enableHandlePanningGesture={true}
        topInset={statusBarHeight}
        onChange={index => {
          if (index === -1) {
            isOpenRef.current = false;
            onClose?.();
          } else {
            isOpenRef.current = true;
          }
        }}
      >
        {/* Header with close button - fixed position */}
        <View style={styles.header}>
          <View style={styles.headerLeft} />
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={theme.colors.text.primary} />
          </TouchableOpacity>
        </View>

        {/* Scrollable Content with parallax */}
        <BottomSheetScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={true}
          contentContainerStyle={styles.scrollContent}
          bounces={true}
          overScrollMode="always"
          onScroll={handleScroll}
          scrollEventThrottle={16}
        >
          {profileSections.map(section => renderSection(section))}

          {/* Action Buttons */}
          {showActions && actionButtons.length > 0 && (
            <View style={styles.actionSection}>
              <View style={styles.actionButtons}>
                {actionButtons.map((button, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[styles.actionButton, button.style]}
                    onPress={button.onPress}
                  >
                    {button.icon && (
                      <Ionicons
                        name={button.icon}
                        size={20}
                        color={button.color || theme.colors.text.white}
                      />
                    )}
                    <Text
                      style={[
                        styles.actionButtonText,
                        { color: button.textColor || theme.colors.text.white },
                      ]}
                    >
                      {button.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Bottom padding */}
          <View style={styles.bottomPadding} />
        </BottomSheetScrollView>
      </BottomSheet>
    );
  }
);

const styles = StyleSheet.create({
  bottomSheetBackground: {
    backgroundColor: theme.colors.background.primary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  bottomSheetIndicator: {
    backgroundColor: theme.colors.border.light,
    width: 36,
    height: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.light,
  },
  headerLeft: {
    width: 32,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.text.primary,
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
    marginTop: -1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  photoSection: {
    width: screenWidth,
    height: PHOTO_HEIGHT,
    backgroundColor: theme.colors.background.secondary,
    overflow: 'hidden',
  },
  fullPhoto: {
    width: '100%',
    height: '110%', // Slightly larger for parallax movement
    marginTop: -20, // Center the extra height
  },
  contentSection: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    backgroundColor: theme.colors.background.primary,
  },
  nameText: {
    fontSize: 32,
    fontWeight: 'bold',
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.text.primary,
    marginBottom: 8,
  },
  ageText: {
    fontSize: 28,
    fontWeight: 'normal',
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.secondary,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  locationText: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.secondary,
    marginLeft: 6,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: theme.typography.fontFamily.heading,
    marginBottom: 12,
    color: theme.colors.text.primary,
  },
  bioText: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.regular,
    lineHeight: 24,
    color: theme.colors.text.secondary,
  },
  notProvidedText: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.muted,
    fontStyle: 'italic',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.secondary,
    marginLeft: 10,
    flex: 1,
  },
  interestBubble: {
    backgroundColor: 'rgba(211, 47, 47, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  interestText: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '500',
    fontFamily: theme.typography.fontFamily.medium,
  },
  actionSection: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: theme.colors.background.primary,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 28,
    minWidth: 140,
    justifyContent: 'center',
  },
  actionButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.text.white,
  },
  bottomPadding: {
    height: 40,
  },
});

ProfileBottomSheet.displayName = 'ProfileBottomSheet';

export default ProfileBottomSheet;
