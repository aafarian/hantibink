import React, {
  useRef,
  useMemo,
  forwardRef,
  useImperativeHandle,
  useEffect,
  useCallback,
  useState,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Platform,
  Image,
  BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';

const { height: screenHeight, width: screenWidth } = Dimensions.get('window');
const statusBarHeight = Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 44;
const availableHeight = screenHeight - statusBarHeight;

/**
 * Bottom sheet for viewing other users' full profiles
 * Bumble-style layout with interspersed photos and information
 */
const ProfileBottomSheet = forwardRef(
  ({ profile, showActions = true, actionButtons = [], onClose }, ref) => {
    const bottomSheetRef = useRef(null);
    const snapPoints = useMemo(() => ['50%', availableHeight * 0.9], []);
    const isOpenRef = useRef(false);
    const [enableContentPanning, setEnableContentPanning] = useState(false);

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

    // Handle scroll to detect when at top
    const handleScroll = useCallback(event => {
      const { contentOffset } = event.nativeEvent;
      // Enable sheet dragging when scrolled to top
      const isAtTop = contentOffset.y <= 0;
      setEnableContentPanning(isAtTop);
    }, []);

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

    // Helper to get photo URL
    const getPhotoUrl = photo => {
      if (typeof photo === 'string') return photo;
      if (photo?.url) return photo.url;
      return null;
    };

    // Build the interspersed content sections
    const buildProfileSections = () => {
      if (!profile) return [];

      const sections = [];
      const photos = profile.photos || [];
      const age = calculateAge(profile.birthDate);

      // Helper to add a photo section if available
      let photoIndex = 0;
      const addPhotoSection = () => {
        while (photoIndex < photos.length) {
          const photoUrl = getPhotoUrl(photos[photoIndex]);
          photoIndex++; // Always increment to avoid infinite loop
          if (photoUrl) {
            sections.push({
              type: 'photo',
              data: photoUrl,
              key: `photo-${photoIndex - 1}`, // Use previous index since we already incremented
            });
            return true;
          }
          // Continue to next photo if URL is falsy
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
        sections.push({
          type: 'interests',
          data: profile.interests,
          key: 'interests',
        });
      }

      return sections;
    };

    const renderSection = section => {
      switch (section.type) {
        case 'photo':
          return (
            <View style={styles.photoSection} key={section.key}>
              <Image source={{ uri: section.data }} style={styles.fullPhoto} resizeMode="cover" />
            </View>
          );

        case 'header':
          return (
            <View style={styles.contentSection} key={section.key}>
              <Text style={styles.nameText}>
                {section.data.name}
                {section.data.age && <Text style={styles.ageText}>, {section.data.age}</Text>}
              </Text>
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={18} color="#666" />
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
                  <Ionicons name="briefcase-outline" size={18} color="#666" />
                  <Text style={styles.infoText}>{section.data.profession}</Text>
                </View>
              )}
              {section.data.education && (
                <View style={styles.infoRow}>
                  <Ionicons name="school-outline" size={18} color="#666" />
                  <Text style={styles.infoText}>{section.data.education}</Text>
                </View>
              )}
            </View>
          );

        case 'basic-info':
          if (!section.hasData) {
            return null; // Skip this section if no data
          }
          return (
            <View style={styles.contentSection} key={section.key}>
              <Text style={styles.sectionTitle}>Basic Info</Text>
              {section.data.height && (
                <View style={styles.infoRow}>
                  <Ionicons name="resize-outline" size={18} color="#666" />
                  <Text style={styles.infoText}>{section.data.height}</Text>
                </View>
              )}
              {section.data.relationshipType && (
                <View style={styles.infoRow}>
                  <Ionicons name="heart-outline" size={18} color="#666" />
                  <Text style={styles.infoText}>
                    {Array.isArray(section.data.relationshipType)
                      ? section.data.relationshipType.join(', ')
                      : section.data.relationshipType}
                  </Text>
                </View>
              )}
              {section.data.religion && (
                <View style={styles.infoRow}>
                  <Ionicons name="library-outline" size={18} color="#666" />
                  <Text style={styles.infoText}>{section.data.religion}</Text>
                </View>
              )}
            </View>
          );

        case 'lifestyle':
          if (!section.hasData) {
            return null; // Skip this section if no data
          }
          return (
            <View style={styles.contentSection} key={section.key}>
              <Text style={styles.sectionTitle}>Lifestyle</Text>
              {section.data.smoking && (
                <View style={styles.infoRow}>
                  <Ionicons name="ban-outline" size={18} color="#666" />
                  <Text style={styles.infoText}>{section.data.smoking}</Text>
                </View>
              )}
              {section.data.drinking && (
                <View style={styles.infoRow}>
                  <Ionicons name="wine-outline" size={18} color="#666" />
                  <Text style={styles.infoText}>{section.data.drinking}</Text>
                </View>
              )}
              {section.data.pets && (
                <View style={styles.infoRow}>
                  <Ionicons name="paw-outline" size={18} color="#666" />
                  <Text style={styles.infoText}>{section.data.pets}</Text>
                </View>
              )}
              {section.data.travel && (
                <View style={styles.infoRow}>
                  <Ionicons name="airplane-outline" size={18} color="#666" />
                  <Text style={styles.infoText}>{section.data.travel}</Text>
                </View>
              )}
            </View>
          );

        case 'interests':
          return (
            <View style={styles.contentSection} key={section.key}>
              <Text style={styles.sectionTitle}>Interests</Text>
              <View style={styles.interestsContainer}>
                {section.data.map((interest, index) => {
                  const interestName =
                    typeof interest === 'object'
                      ? interest.interest?.name || interest.name
                      : interest;

                  return (
                    <View key={index} style={styles.interestBubble}>
                      <Text style={styles.interestText}>{interestName}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          );

        default:
          return null;
      }
    };

    if (!profile) return null;

    const profileSections = buildProfileSections();

    return (
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose={true}
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={styles.bottomSheetIndicator}
        enableContentPanningGesture={enableContentPanning}
        enableHandlePanningGesture={true}
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
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
        </View>

        {/* Scrollable Content */}
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
                      <Ionicons name={button.icon} size={20} color={button.color || '#fff'} />
                    )}
                    <Text style={[styles.actionButtonText, { color: button.textColor || '#fff' }]}>
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
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  bottomSheetIndicator: {
    backgroundColor: '#ddd',
    width: 36,
    height: 4,
  },
  bottomSheetContent: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerLeft: {
    width: 32,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
    marginTop: -1, // Overlap the header border slightly
  },
  scrollContent: {
    paddingBottom: 40, // More padding for better scrolling
  },
  photoSection: {
    width: screenWidth,
    height: screenWidth * 1.2,
    backgroundColor: '#f8f9fa',
  },
  fullPhoto: {
    width: '100%',
    height: '100%',
  },
  contentSection: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    backgroundColor: '#fff',
  },
  nameText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  ageText: {
    fontSize: 28,
    fontWeight: 'normal',
    color: '#4a4a4a',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  locationText: {
    fontSize: 16,
    color: '#666',
    marginLeft: 6,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    color: '#1a1a1a',
  },
  bioText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#4a4a4a',
  },
  notProvidedText: {
    fontSize: 16,
    color: '#999',
    fontStyle: 'italic',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 16,
    color: '#4a4a4a',
    marginLeft: 10,
    flex: 1,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  interestBubble: {
    backgroundColor: '#FFE4E4',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  interestText: {
    fontSize: 14,
    color: '#E91E63',
    fontWeight: '500',
  },
  actionSection: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#fff',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B6B',
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
    color: '#fff',
  },
  bottomPadding: {
    height: 40,
  },
});

ProfileBottomSheet.displayName = 'ProfileBottomSheet';

export default ProfileBottomSheet;
