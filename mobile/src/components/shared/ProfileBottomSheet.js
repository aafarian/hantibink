import React, { useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  StatusBar,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetView, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import ProfilePhotoGrid from '../profile/ProfilePhotoGrid';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const statusBarHeight = Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 44;
const availableHeight = screenHeight - statusBarHeight;

/**
 * Bottom sheet for viewing other users' full profiles
 * Used when tapping on profile photos in matches, messages, etc.
 */
const ProfileBottomSheet = forwardRef(
  ({ profile, showActions = true, actionButtons = [], onClose }, ref) => {
    const bottomSheetRef = useRef(null);
    const snapPoints = useMemo(() => ['50%', availableHeight * 0.9], []); // 50% or 90% of available height

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
      open: () => {
        bottomSheetRef.current?.expand();
      },
      close: () => {
        bottomSheetRef.current?.close();
      },
    }));

    const handleClose = () => {
      bottomSheetRef.current?.close();
      onClose?.();
    };

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

    if (!profile) return null;

    const age = calculateAge(profile.birthDate);

    return (
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose={true}
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={styles.bottomSheetIndicator}
      >
        <BottomSheetView style={styles.bottomSheetContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>{profile.name}</Text>
              {age && <Text style={styles.headerSubtitle}>Age {age}</Text>}
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Scrollable Content */}
          <BottomSheetScrollView style={styles.scrollView}>
            {/* Photos */}
            <View style={styles.section}>
              <ProfilePhotoGrid
                photos={profile.photos || []}
                title="Photos"
                photoSize={120}
                spacing={10}
              />
            </View>

            {/* Basic Info */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About</Text>

              {profile.bio && (
                <View style={styles.infoRow}>
                  <Text style={styles.bio}>{profile.bio}</Text>
                </View>
              )}

              <View style={styles.infoGrid}>
                {profile.profession && (
                  <View style={styles.infoItem}>
                    <Ionicons name="briefcase-outline" size={16} color="#666" />
                    <Text style={styles.infoText}>{profile.profession}</Text>
                  </View>
                )}

                {profile.education && (
                  <View style={styles.infoItem}>
                    <Ionicons name="school-outline" size={16} color="#666" />
                    <Text style={styles.infoText}>{profile.education}</Text>
                  </View>
                )}

                {profile.location && (
                  <View style={styles.infoItem}>
                    <Ionicons name="location-outline" size={16} color="#666" />
                    <Text style={styles.infoText}>{profile.location}</Text>
                  </View>
                )}

                {profile.height && (
                  <View style={styles.infoItem}>
                    <Ionicons name="resize-outline" size={16} color="#666" />
                    <Text style={styles.infoText}>{profile.height}</Text>
                  </View>
                )}

                {profile.relationshipType && (
                  <View style={styles.infoItem}>
                    <Ionicons name="heart-outline" size={16} color="#666" />
                    <Text style={styles.infoText}>{profile.relationshipType}</Text>
                  </View>
                )}

                {profile.religion && (
                  <View style={styles.infoItem}>
                    <Ionicons name="library-outline" size={16} color="#666" />
                    <Text style={styles.infoText}>{profile.religion}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Lifestyle */}
            {(profile.smoking || profile.drinking || profile.pets || profile.travel) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Lifestyle</Text>
                <View style={styles.infoGrid}>
                  {profile.smoking && (
                    <View style={styles.infoItem}>
                      <Ionicons name="ban-outline" size={16} color="#666" />
                      <Text style={styles.infoText}>Smoking: {profile.smoking}</Text>
                    </View>
                  )}

                  {profile.drinking && (
                    <View style={styles.infoItem}>
                      <Ionicons name="wine-outline" size={16} color="#666" />
                      <Text style={styles.infoText}>Drinking: {profile.drinking}</Text>
                    </View>
                  )}

                  {profile.pets && (
                    <View style={styles.infoItem}>
                      <Ionicons name="paw-outline" size={16} color="#666" />
                      <Text style={styles.infoText}>{profile.pets}</Text>
                    </View>
                  )}

                  {profile.travel && (
                    <View style={styles.infoItem}>
                      <Ionicons name="airplane-outline" size={16} color="#666" />
                      <Text style={styles.infoText}>{profile.travel}</Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Interests */}
            {profile.interests && profile.interests.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Interests</Text>
                <View style={styles.interestsContainer}>
                  {profile.interests.map((interest, index) => {
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
            )}

            {/* Action Buttons */}
            {showActions && actionButtons.length > 0 && (
              <View style={styles.section}>
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
                      <Text
                        style={[styles.actionButtonText, { color: button.textColor || '#fff' }]}
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
        </BottomSheetView>
      </BottomSheet>
    );
  }
);

const styles = StyleSheet.create({
  bottomSheetBackground: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  bottomSheetIndicator: {
    backgroundColor: '#ccc',
    width: 40,
  },
  bottomSheetContent: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 2,
  },
  closeButton: {
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    marginVertical: 5,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  bio: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
    marginBottom: 15,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '50%',
    marginBottom: 10,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  interestBubble: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  interestText: {
    fontSize: 14,
    color: '#333',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    minWidth: 120,
    justifyContent: 'center',
  },
  actionButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  bottomPadding: {
    height: 30,
  },
});

ProfileBottomSheet.displayName = 'ProfileBottomSheet';

export default ProfileBottomSheet;
