import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  AppState,
  Alert,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import Logger from '../utils/logger';
import { useToast } from '../contexts/ToastContext';
import { LoadingScreen } from '../components/LoadingScreen';
import { capitalizeFirst, formatRelationshipTypes } from '../utils/profileDataUtils';

// import { theme } from '../styles/theme';
// import { commonStyles } from '../styles/commonStyles';
// Removed Firebase dependencies - now using API-based AuthContext

const ProfileScreen = ({ navigation }) => {
  const {
    logout,
    user,
    userProfile: authUserProfile,
    refreshUserProfile,
    updateUserProfile,
  } = useAuth();
  const { showSuccess, showError } = useToast();
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [devPremium, setDevPremium] = useState(false);

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

  const handleLogout = async () => {
    // Show proper confirmation dialog for destructive action
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: performLogout,
      },
    ]);
  };

  const performLogout = async () => {
    try {
      Logger.info('🚪 User confirmed logout...');

      // Logout via API-based AuthContext

      const result = await logout();

      if (result.success) {
        showSuccess('Logged out successfully! 👋');
        Logger.success('✅ User logged out successfully');
      } else {
        Logger.error('❌ Logout failed:', result.error);
        showError(result.error || 'Failed to logout', {
          action: { text: 'Try Again', onPress: performLogout },
        });
      }
    } catch (error) {
      Logger.error('❌ Logout error:', error);
      showError(error.message || 'Failed to logout', {
        action: { text: 'Try Again', onPress: performLogout },
      });
    }
  };

  // Photo management is now handled by ProfileEditScreen

  if (loading) {
    return <LoadingScreen message="Loading profile..." />;
  }

  if (!userProfile) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>Failed to load profile</Text>
        <TouchableOpacity style={styles.retryButton} onPress={refreshUserProfile}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
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
              <Ionicons name="camera-outline" size={60} color="#ccc" />
              <Text style={styles.emptyPhotoText}>Add Photos</Text>
              <View style={styles.editPill}>
                <Text style={styles.editPillText}>Edit Profile</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Profile Completion Guidance */}
        {(!userProfile.photos || userProfile.photos.length === 0 || !userProfile.bio) && (
          <View style={styles.guidanceContainer}>
            <Ionicons name="sparkles" size={24} color="#FF6B6B" />
            <View style={styles.guidanceTextContainer}>
              <Text style={styles.guidanceTitle}>Complete your profile!</Text>
              <Text style={styles.guidanceSubtitle}>
                {!userProfile.photos || userProfile.photos.length === 0
                  ? 'Add photos and details to start matching with others'
                  : 'Add bio and details to attract better matches'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.guidanceButton}
              onPress={() => navigation.navigate('ProfileEdit')}
            >
              <Text style={styles.guidanceButtonText}>Edit Profile</Text>
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
              <Ionicons name="pencil" size={16} color="#FF6B6B" />
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.infoGrid}>
            <View style={styles.infoCard}>
              <View style={styles.infoIconWrapper}>
                <Ionicons name="person" size={18} color="#FF6B6B" />
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
                <Ionicons name="location" size={18} color="#FF6B6B" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Location</Text>
                <Text style={styles.infoValue}>{userProfile.location || 'Not set'}</Text>
              </View>
            </View>

            {userProfile.profession && (
              <View style={styles.infoCard}>
                <View style={styles.infoIconWrapper}>
                  <Ionicons name="briefcase" size={18} color="#FF6B6B" />
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
                  <Ionicons name="school" size={18} color="#FF6B6B" />
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
                  <Ionicons name="resize" size={18} color="#FF6B6B" />
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
                <Ionicons name="add-circle-outline" size={20} color="#999" />
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
                      <Ionicons name="heart-outline" size={16} color="#FF6B6B" />
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
                  <Ionicons name="add-circle-outline" size={20} color="#999" />
                  <Text style={styles.emptyStateText}>Add interests to find better matches</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
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
                    <Ionicons name="star" size={20} color="#FF6B6B" />
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
                    <Ionicons name="ban" size={20} color="#FF6B6B" />
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
                    <Ionicons name="wine" size={20} color="#FF6B6B" />
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
                    <Ionicons name="airplane" size={20} color="#FF6B6B" />
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
                    <Ionicons name="paw" size={20} color="#FF6B6B" />
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
            <Ionicons name="settings" size={20} color="#FF6B6B" />
            <Text style={styles.settingText}>Edit Profile</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem}>
            <Ionicons name="filter" size={20} color="#FF6B6B" />
            <Text style={styles.settingText}>Preferences</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem}>
            <Ionicons name="notifications" size={20} color="#FF6B6B" />
            <Text style={styles.settingText}>Notifications</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#FF6B6B" />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Developer Settings - Only in Dev Mode */}
        {__DEV__ && (
          <View style={styles.settingsSection}>
            <Text style={[styles.sectionTitle, { color: '#9b59b6' }]}>Developer Settings</Text>

            <TouchableOpacity style={styles.settingItem} onPress={handleTogglePremium}>
              <Ionicons name={devPremium ? 'star' : 'star-outline'} size={20} color="#9b59b6" />
              <Text style={styles.settingText}>Premium Status</Text>
              <View style={[styles.toggleSwitch, devPremium && styles.toggleSwitchActive]}>
                <View style={[styles.toggleThumb, devPremium && styles.toggleThumbActive]} />
              </View>
            </TouchableOpacity>

            <View style={styles.devInfo}>
              <Text style={styles.devInfoText}>🛠️ Development Mode</Text>
              <Text style={styles.devInfoSubtext}>
                Premium features {devPremium ? 'enabled' : 'disabled'}
              </Text>
            </View>
          </View>
        )}

        {/* Edit functionality moved to ProfileEditScreen */}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },

  mainPhotoSection: {
    backgroundColor: '#fff',
    marginBottom: 10,
    alignItems: 'center',
    overflow: 'hidden',
  },
  mainPhotoContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 300,
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
    width: 200,
    height: 250,
    borderRadius: 12,
    zIndex: 2,
  },
  editPill: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 3,
  },
  editPillText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
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
    backgroundColor: '#f8f9fa',
    position: 'relative',
  },
  emptyPhotoText: {
    fontSize: 16,
    color: '#999',
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  infoSection: {
    padding: 20,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  bioSection: {
    marginTop: 20,
  },
  bioTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  bioText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  interestsSection: {
    marginTop: 20,
  },
  interestsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  interestTag: {
    backgroundColor: '#FFF0F5',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FFE0E6',
  },
  interestText: {
    color: '#FF6B6B',
    fontSize: 13,
    fontWeight: '500',
  },
  settingsSection: {
    padding: 20,
    backgroundColor: '#fff',
    marginBottom: 20,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingText: {
    flex: 1,
    fontSize: 16,
    marginLeft: 15,
    color: '#333',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    marginTop: 10,
  },
  logoutText: {
    flex: 1,
    fontSize: 16,
    marginLeft: 15,
    color: '#FF6B6B',
    fontWeight: '500',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  errorText: {
    fontSize: 16,
    color: '#FF6B6B',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  // Guidance styles
  guidanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF0F5',
    margin: 20,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B6B',
  },
  guidanceTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  guidanceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF6B6B',
    marginBottom: 4,
  },
  guidanceSubtitle: {
    fontSize: 14,
    color: '#FF8A95',
    lineHeight: 20,
  },
  guidanceButton: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 12,
  },
  guidanceButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
    backgroundColor: '#FFF0F5',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#FFE0E6',
    marginRight: 8,
    marginBottom: 8,
  },
  lookingForText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#FF6B6B',
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
    backgroundColor: '#FFF0F5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  editButtonText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#FF6B6B',
    fontWeight: '600',
  },
  infoGrid: {
    marginBottom: 10,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  infoIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF0F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
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
    borderBottomColor: '#F0F0F0',
  },
  lifestyleIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF0F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  lifestyleContent: {
    flex: 1,
  },
  lifestyleLabel: {
    fontSize: 11,
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
    fontWeight: '600',
  },
  lifestyleText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '400',
  },
  toggleSwitch: {
    width: 50,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#e0e0e0',
    padding: 2,
    justifyContent: 'center',
  },
  toggleSwitchActive: {
    backgroundColor: '#9b59b6',
  },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
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
    backgroundColor: '#f8f4ff',
    borderRadius: 8,
  },
  devInfoText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9b59b6',
    marginBottom: 4,
  },
  devInfoSubtext: {
    fontSize: 12,
    color: '#666',
  },
  emptyStateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
  },
  emptyStateText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
});

export default ProfileScreen;
