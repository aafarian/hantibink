import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  AppState,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Application from 'expo-application';
import * as Updates from 'expo-updates';
import { useAuth } from '../contexts/AuthContext';
import Logger from '../utils/logger';
import { useToast } from '../contexts/ToastContext';
import { LoadingScreen } from '../components/LoadingScreen';
import { ErrorScreen } from '../components/ErrorScreen';
import { capitalizeFirst, formatRelationshipTypes } from '../utils/profileDataUtils';
import { shouldShowDeveloperOptions, getBuildEnvironment } from '../utils/buildConfig';
import ProfileSetupModal from '../components/modals/ProfileSetupModal';

import { theme } from '../styles/theme';
// import { commonStyles } from '../styles/commonStyles';
// Removed Firebase dependencies - now using API-based AuthContext

const ProfileScreen = ({ navigation }) => {
  const { user, userProfile: authUserProfile, refreshUserProfile, updateUserProfile } = useAuth();
  const { showSuccess, showError } = useToast();
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [devPremium, setDevPremium] = useState(false);
  const [showSetupModal, setShowSetupModal] = useState(false);

  // Check if user is missing required fields for matching
  const needsRequiredFields =
    userProfile &&
    (!userProfile.birthDate ||
      !userProfile.gender ||
      !userProfile.interestedIn?.length ||
      !userProfile.photos?.length ||
      !userProfile.location);

  useEffect(() => {
    if (authUserProfile) {
      // Use the profile from AuthContext (API-based)
      Logger.info(
        '📊 ProfileScreen got authUserProfile with',
        authUserProfile.photos?.length || 0,
        'photos'
      );
      setUserProfile(authUserProfile);
      setDevPremium(authUserProfile.isPremium || false);
      setLoading(false);
    } else {
      setLoading(false);
    }
  }, [authUserProfile]);

  // Refresh profile when app comes to foreground (to get location updates)
  useEffect(() => {
    const handleAppStateChange = nextAppState => {
      if (nextAppState === 'active' && user?.uid) {
        // Refresh profile when app becomes active
        refreshUserProfile();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [user, refreshUserProfile]);

  // Remove the focus effect - it's causing infinite loops when modal is visible
  // Profile will be refreshed when:
  // 1. App comes to foreground (AppState change)
  // 2. After modal completion (handled in AppNavigator)
  // 3. After editing profile (handled in ProfileEditScreen)

  // Removed old Firebase-based profile loading and editing functions
  // Now using API-based AuthContext and ProfileEditScreen

  // Profile editing is now handled by ProfileEditScreen

  const handleTogglePremium = async () => {
    try {
      const newPremiumStatus = !devPremium;
      setDevPremium(newPremiumStatus);

      // Update the profile in the API
      await updateUserProfile({ isPremium: newPremiumStatus });

      showSuccess(`Premium ${newPremiumStatus ? 'enabled' : 'disabled'} (dev mode)`);
    } catch (error) {
      Logger.error('Failed to toggle premium:', error);
      showError('Failed to update premium status');
      // Revert the change
      setDevPremium(!devPremium);
    }
  };

  // Photo management is now handled by ProfileEditScreen
  // Account management (logout, delete) is now in AccountSettingsScreen

  if (loading) {
    return <LoadingScreen message="Loading profile..." />;
  }

  if (!userProfile) {
    return <ErrorScreen message="Failed to load profile" onRetry={refreshUserProfile} />;
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Main Profile Photo */}
        <View style={styles.mainPhotoSection}>
          {userProfile.photos && userProfile.photos.length > 0 ? (
            <TouchableOpacity
              style={styles.mainPhotoContainer}
              onPress={() => navigation.navigate('ProfileEdit')}
              activeOpacity={0.8}
            >
              {/* Blurred Background */}
              <Image
                source={{ uri: userProfile.photos[0].url || userProfile.photos[0] }}
                style={styles.blurredBackground}
                blurRadius={20}
              />
              {/* Dark Overlay for better contrast */}
              <View style={styles.backgroundOverlay} />

              {/* Main Photo */}
              <Image
                source={{ uri: userProfile.photos[0].url || userProfile.photos[0] }}
                style={styles.mainPhoto}
              />
              <View style={styles.editPill}>
                <Text style={styles.editPillText}>Edit Photos</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.emptyPhotoContainer}
              onPress={() => navigation.navigate('ProfileEdit')}
              activeOpacity={0.8}
            >
              <Ionicons name="camera-outline" size={60} color={theme.colors.border.medium} />
              <Text style={styles.emptyPhotoText}>Add Photos</Text>
              <View style={styles.editPill}>
                <Text style={styles.editPillText}>Edit Profile</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Required Fields Guidance - Shows when missing required fields for matching */}
        {needsRequiredFields && (
          <View style={styles.guidanceContainer}>
            <Ionicons name="alert-circle" size={24} color={theme.colors.primary} />
            <View style={styles.guidanceTextContainer}>
              <Text style={styles.guidanceTitle}>Complete your profile to start matching</Text>
              <Text style={styles.guidanceSubtitle}>
                Add your details to discover and be discovered by others
              </Text>
            </View>
            <TouchableOpacity style={styles.guidanceButton} onPress={() => setShowSetupModal(true)}>
              <Text style={styles.guidanceButtonText}>Complete</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Profile Info */}
        <View style={styles.infoSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>About</Text>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => navigation.navigate('ProfileEdit')}
            >
              <Ionicons name="pencil" size={16} color={theme.colors.primary} />
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.infoGrid}>
            <View style={styles.infoCard}>
              <View style={styles.infoIconWrapper}>
                <Ionicons name="person" size={18} color={theme.colors.primary} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Name & Age</Text>
                <Text style={styles.infoValue}>
                  {userProfile.name}
                  {userProfile.age ? `, ${userProfile.age}` : ''}
                </Text>
              </View>
            </View>

            <View style={styles.infoCard}>
              <View style={styles.infoIconWrapper}>
                <Ionicons name="location" size={18} color={theme.colors.primary} />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Location</Text>
                <Text style={styles.infoValue}>{userProfile.location || 'Not set'}</Text>
              </View>
            </View>

            {userProfile.profession && (
              <View style={styles.infoCard}>
                <View style={styles.infoIconWrapper}>
                  <Ionicons name="briefcase" size={18} color={theme.colors.primary} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Work</Text>
                  <Text style={styles.infoValue}>{userProfile.profession}</Text>
                </View>
              </View>
            )}

            {userProfile.education && (
              <View style={styles.infoCard}>
                <View style={styles.infoIconWrapper}>
                  <Ionicons name="school" size={18} color={theme.colors.primary} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Education</Text>
                  <Text style={styles.infoValue}>{userProfile.education}</Text>
                </View>
              </View>
            )}

            {userProfile.height && (
              <View style={styles.infoCard}>
                <View style={styles.infoIconWrapper}>
                  <Ionicons name="resize" size={18} color={theme.colors.primary} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Height</Text>
                  <Text style={styles.infoValue}>{userProfile.height}</Text>
                </View>
              </View>
            )}
          </View>

          <View style={styles.bioSection}>
            <Text style={styles.bioTitle}>About Me</Text>
            {userProfile.bio ? (
              <Text style={styles.bioText}>{userProfile.bio}</Text>
            ) : (
              <TouchableOpacity
                style={styles.emptyStateContainer}
                onPress={() => navigation.navigate('ProfileEdit')}
              >
                <Ionicons name="add-circle-outline" size={20} color={theme.colors.text.muted} />
                <Text style={styles.emptyStateText}>Add a bio to tell others about yourself</Text>
              </TouchableOpacity>
            )}
          </View>

          {userProfile.relationshipType &&
            (Array.isArray(userProfile.relationshipType)
              ? userProfile.relationshipType.length > 0
              : true) && (
              <View style={styles.lookingForSection}>
                <Text style={styles.bioTitle}>Looking For</Text>
                <View style={styles.lookingForContainer}>
                  {formatRelationshipTypes(userProfile.relationshipType).map((type, index) => (
                    <View key={index} style={styles.lookingForTag}>
                      <Ionicons name="heart-outline" size={16} color={theme.colors.primary} />
                      <Text style={styles.lookingForText}>{type}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

          <View style={styles.interestsSection}>
            <Text style={styles.interestsTitle}>Interests</Text>
            <View style={styles.interestsContainer}>
              {userProfile.interests && userProfile.interests.length > 0 ? (
                Array.isArray(userProfile.interests) ? (
                  userProfile.interests.map((interest, index) => {
                    const interestName =
                      typeof interest === 'object'
                        ? interest.interest?.name || interest.name
                        : interest;
                    return (
                      <View key={index} style={styles.interestTag}>
                        <Text style={styles.interestText}>{interestName}</Text>
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.bioText}>{userProfile.interests}</Text>
                )
              ) : (
                <TouchableOpacity
                  style={styles.emptyStateContainer}
                  onPress={() => navigation.navigate('ProfileEdit')}
                >
                  <Ionicons name="add-circle-outline" size={20} color={theme.colors.text.muted} />
                  <Text style={styles.emptyStateText}>Add interests to find better matches</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Languages Section */}
          {userProfile.languages && userProfile.languages.length > 0 && (
            <View style={styles.languagesSection}>
              <Text style={styles.languagesTitle}>Languages</Text>
              <View style={styles.languagesContainer}>
                {userProfile.languages.map((language, index) => (
                  <View key={index} style={styles.languageTag}>
                    <Ionicons name="globe-outline" size={14} color={theme.colors.text.secondary} />
                    <Text style={styles.languageText}>{language}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Lifestyle Section */}
        {(userProfile.religion ||
          userProfile.smoking ||
          userProfile.drinking ||
          userProfile.travel ||
          userProfile.pets) && (
          <View style={styles.infoSection}>
            <Text style={styles.sectionTitle}>Lifestyle</Text>
            <View style={styles.lifestyleList}>
              {userProfile.religion && (
                <View style={styles.lifestyleRow}>
                  <View style={styles.lifestyleIcon}>
                    <Ionicons name="star" size={20} color={theme.colors.primary} />
                  </View>
                  <View style={styles.lifestyleContent}>
                    <Text style={styles.lifestyleLabel}>Religion</Text>
                    <Text style={styles.lifestyleText}>{userProfile.religion}</Text>
                  </View>
                </View>
              )}

              {userProfile.smoking && (
                <View style={styles.lifestyleRow}>
                  <View style={styles.lifestyleIcon}>
                    <Ionicons name="ban" size={20} color={theme.colors.primary} />
                  </View>
                  <View style={styles.lifestyleContent}>
                    <Text style={styles.lifestyleLabel}>Smoking</Text>
                    <Text style={styles.lifestyleText}>
                      {capitalizeFirst(userProfile.smoking) || 'Not specified'}
                    </Text>
                  </View>
                </View>
              )}

              {userProfile.drinking && (
                <View style={styles.lifestyleRow}>
                  <View style={styles.lifestyleIcon}>
                    <Ionicons name="wine" size={20} color={theme.colors.primary} />
                  </View>
                  <View style={styles.lifestyleContent}>
                    <Text style={styles.lifestyleLabel}>Drinking</Text>
                    <Text style={styles.lifestyleText}>
                      {capitalizeFirst(userProfile.drinking) || 'Not specified'}
                    </Text>
                  </View>
                </View>
              )}

              {userProfile.travel && (
                <View style={styles.lifestyleRow}>
                  <View style={styles.lifestyleIcon}>
                    <Ionicons name="airplane" size={20} color={theme.colors.primary} />
                  </View>
                  <View style={styles.lifestyleContent}>
                    <Text style={styles.lifestyleLabel}>Travel</Text>
                    <Text style={styles.lifestyleText}>{userProfile.travel}</Text>
                  </View>
                </View>
              )}

              {userProfile.pets && (
                <View style={styles.lifestyleRow}>
                  <View style={styles.lifestyleIcon}>
                    <Ionicons name="paw" size={20} color={theme.colors.primary} />
                  </View>
                  <View style={styles.lifestyleContent}>
                    <Text style={styles.lifestyleLabel}>Pets</Text>
                    <Text style={styles.lifestyleText}>{userProfile.pets}</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Settings */}
        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>Settings</Text>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => navigation.navigate('ProfileEdit')}
          >
            <Ionicons name="settings" size={20} color={theme.colors.primary} />
            <Text style={styles.settingText}>Edit Profile</Text>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.border.medium} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => navigation.navigate('Preferences')}
          >
            <Ionicons name="filter" size={20} color={theme.colors.primary} />
            <Text style={styles.settingText}>Preferences</Text>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.border.medium} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => navigation.navigate('NotificationSettings')}
          >
            <Ionicons name="notifications" size={20} color={theme.colors.primary} />
            <Text style={styles.settingText}>Notifications</Text>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.border.medium} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => navigation.navigate('AccountSettings')}
          >
            <Ionicons name="person-circle" size={20} color={theme.colors.primary} />
            <Text style={styles.settingText}>Account</Text>
            <Ionicons name="chevron-forward" size={20} color={theme.colors.border.medium} />
          </TouchableOpacity>
        </View>

        {/* Developer Settings - Only in Dev/Preview Mode */}
        {shouldShowDeveloperOptions() && (
          <View style={styles.settingsSection}>
            <Text style={[styles.sectionTitle, { color: theme.colors.accent }]}>
              Developer Settings
            </Text>

            <TouchableOpacity style={styles.settingItem} onPress={handleTogglePremium}>
              <Ionicons
                name={devPremium ? 'star' : 'star-outline'}
                size={20}
                color={theme.colors.accent}
              />
              <Text style={styles.settingText}>Premium Status</Text>
              <View style={[styles.toggleSwitch, devPremium && styles.toggleSwitchActive]}>
                <View style={[styles.toggleThumb, devPremium && styles.toggleThumbActive]} />
              </View>
            </TouchableOpacity>

            <View style={styles.devInfo}>
              <View style={styles.devModeRow}>
                <Ionicons name="build-outline" size={14} color={theme.colors.text.secondary} />
                <Text style={styles.devInfoText}>
                  {getBuildEnvironment() === 'development' ? 'Development' : 'Preview'} Mode
                </Text>
              </View>
              <Text style={styles.devInfoSubtext}>
                Premium features {devPremium ? 'enabled' : 'disabled'}
              </Text>
            </View>
          </View>
        )}

        {/* Build Info - Always visible */}
        <View style={styles.buildInfoSection}>
          <Text style={styles.buildInfoTitle}>Build Info</Text>
          <View style={styles.buildInfoRow}>
            <Text style={styles.buildInfoLabel}>Version</Text>
            <Text style={styles.buildInfoValue}>
              {Application.nativeApplicationVersion || '1.0.0'}
            </Text>
          </View>
          <View style={styles.buildInfoRow}>
            <Text style={styles.buildInfoLabel}>Build</Text>
            <Text style={styles.buildInfoValue}>{Application.nativeBuildVersion || 'dev'}</Text>
          </View>
          <View style={styles.buildInfoRow}>
            <Text style={styles.buildInfoLabel}>Channel</Text>
            <Text style={styles.buildInfoValue}>{Updates.channel || 'N/A'}</Text>
          </View>
          {Updates.updateId &&
            Updates.updateId !== 'null' &&
            typeof Updates.updateId === 'string' && (
              <View style={styles.buildInfoRow}>
                <Text style={styles.buildInfoLabel}>Update</Text>
                <Text style={styles.buildInfoValue}>{Updates.updateId.slice(0, 8)}</Text>
              </View>
            )}
        </View>

        {/* Edit functionality moved to ProfileEditScreen */}
      </ScrollView>

      {/* Profile Setup Modal - Opens when user clicks "Complete" button */}
      <ProfileSetupModal
        visible={showSetupModal}
        onClose={() => setShowSetupModal(false)}
        onComplete={async () => {
          setShowSetupModal(false);
          // Refresh profile after completing setup
          if (refreshUserProfile) {
            setTimeout(() => {
              refreshUserProfile();
            }, 500);
          }
        }}
        userProfile={userProfile}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.secondary,
  },
  scrollView: {
    flex: 1,
  },

  mainPhotoSection: {
    backgroundColor: theme.colors.background.primary,
    marginBottom: 10,
    alignItems: 'center',
    overflow: 'hidden',
  },
  mainPhotoContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 350,
  },
  blurredBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  backgroundOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  mainPhoto: {
    width: 260,
    height: 350,
    borderRadius: 0,
    zIndex: 2,
  },
  editPill: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: theme.colors.overlay.heavy,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 3,
  },
  editPillText: {
    color: theme.colors.text.white,
    fontSize: 12,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamily.semibold,
  },
  emptyPhotoContainer: {
    width: 200,
    height: 250,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background.secondary,
    position: 'relative',
  },
  emptyPhotoText: {
    fontSize: 16,
    color: theme.colors.text.muted,
    marginTop: 10,
    fontFamily: theme.typography.fontFamily.regular,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.bold,
  },
  infoSection: {
    padding: 20,
    backgroundColor: theme.colors.background.primary,
    marginBottom: 10,
  },
  bioSection: {
    marginTop: 20,
  },
  bioTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.bold,
  },
  bioText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    lineHeight: 20,
    fontFamily: theme.typography.fontFamily.regular,
  },
  interestsSection: {
    marginTop: 20,
  },
  interestsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.bold,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  interestTag: {
    backgroundColor: 'rgba(211, 47, 47, 0.08)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
  },
  interestText: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: '500',
    fontFamily: theme.typography.fontFamily.medium,
  },
  languagesSection: {
    marginTop: 20,
    width: '100%',
  },
  languagesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.bold,
  },
  languagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    marginRight: -8, // Compensate for tag margin
  },
  languageTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(211, 47, 47, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(211, 47, 47, 0.12)',
  },
  languageText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginLeft: 4,
    fontFamily: theme.typography.fontFamily.regular,
  },
  settingsSection: {
    padding: 20,
    backgroundColor: theme.colors.background.primary,
    marginBottom: 20,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.background.tertiary,
  },
  settingText: {
    flex: 1,
    fontSize: 16,
    marginLeft: 15,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.regular,
  },
  // Guidance styles
  guidanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(211, 47, 47, 0.08)',
    margin: 20,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
  guidanceTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  guidanceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primary,
    marginBottom: 4,
    fontFamily: theme.typography.fontFamily.semibold,
  },
  guidanceSubtitle: {
    fontSize: 14,
    color: 'rgba(211, 47, 47, 0.7)',
    lineHeight: 20,
    fontFamily: theme.typography.fontFamily.regular,
  },
  guidanceButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 12,
  },
  guidanceButtonText: {
    color: theme.colors.text.white,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamily.semibold,
  },
  // Looking For section styles
  lookingForSection: {
    marginTop: 20,
  },
  lookingForContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  lookingForTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(211, 47, 47, 0.08)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: theme.colors.border.primary,
    marginRight: 8,
    marginBottom: 8,
  },
  lookingForText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
    fontFamily: theme.typography.fontFamily.semibold,
  },

  // Modern Info Section styles
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(211, 47, 47, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  editButtonText: {
    marginLeft: 4,
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamily.semibold,
  },
  infoGrid: {
    marginBottom: 10,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.background.tertiary,
  },
  infoIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(211, 47, 47, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    color: theme.colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamily.semibold,
  },
  infoValue: {
    fontSize: 15,
    color: theme.colors.text.primary,
    fontWeight: '500',
    fontFamily: theme.typography.fontFamily.medium,
  },

  // Lifestyle List styles
  lifestyleList: {
    marginTop: 10,
  },
  lifestyleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.background.tertiary,
  },
  lifestyleIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(211, 47, 47, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  lifestyleContent: {
    flex: 1,
  },
  lifestyleLabel: {
    fontSize: 11,
    color: theme.colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamily.semibold,
  },
  lifestyleText: {
    fontSize: 15,
    color: theme.colors.text.primary,
    fontWeight: '400',
    fontFamily: theme.typography.fontFamily.regular,
  },
  toggleSwitch: {
    width: 50,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.colors.border.light,
    padding: 2,
    justifyContent: 'center',
  },
  toggleSwitchActive: {
    backgroundColor: theme.colors.accent,
  },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.colors.background.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleThumbActive: {
    transform: [{ translateX: 24 }],
  },
  devInfo: {
    marginTop: 15,
    padding: 12,
    backgroundColor: 'rgba(245, 124, 0, 0.08)',
    borderRadius: 8,
  },
  devModeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  devInfoText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.accent,
    fontFamily: theme.typography.fontFamily.semibold,
  },
  devInfoSubtext: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.regular,
  },
  buildInfoSection: {
    marginTop: 24,
    marginHorizontal: 20,
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    marginBottom: 30,
  },
  buildInfoTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text.muted,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: theme.typography.fontFamily.semibold,
  },
  buildInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  buildInfoLabel: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamily.regular,
  },
  buildInfoValue: {
    fontSize: 13,
    color: theme.colors.text.primary,
    fontFamily: 'monospace',
  },
  emptyStateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    borderStyle: 'dashed',
  },
  emptyStateText: {
    marginLeft: 10,
    fontSize: 14,
    color: theme.colors.text.muted,
    fontStyle: 'italic',
    fontFamily: theme.typography.fontFamily.regular,
  },
});

export default ProfileScreen;
