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

// import { theme } from '../styles/theme';
// import { commonStyles } from '../styles/commonStyles';
// Removed Firebase dependencies - now using API-based AuthContext

const ProfileScreen = ({ navigation }) => {
  const { logout, user, userProfile: authUserProfile, refreshUserProfile } = useAuth();
  const { showSuccess, showError } = useToast();
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authUserProfile) {
      // Use the profile from AuthContext (API-based)
      Logger.info(
        '📊 ProfileScreen got authUserProfile with',
        authUserProfile.photos?.length || 0,
        'photos'
      );
      setUserProfile(authUserProfile);
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
    <ScrollView style={styles.container}>
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

      {/* Profile Info */}
      <View style={styles.infoSection}>
        <Text style={styles.sectionTitle}>Basic Info</Text>

        <View style={styles.infoRow}>
          <Ionicons name="person" size={20} color="#FF6B6B" />
          <Text style={styles.infoText}>
            {userProfile.name}
            {userProfile.age ? `, ${userProfile.age}` : ''}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="location" size={20} color="#FF6B6B" />
          <Text style={styles.infoText}>{userProfile.location || 'Location not set'}</Text>
        </View>

        {userProfile.profession && (
          <View style={styles.infoRow}>
            <Ionicons name="briefcase" size={20} color="#FF6B6B" />
            <Text style={styles.infoText}>{userProfile.profession}</Text>
          </View>
        )}

        {userProfile.education && (
          <View style={styles.infoRow}>
            <Ionicons name="school" size={20} color="#FF6B6B" />
            <Text style={styles.infoText}>{userProfile.education}</Text>
          </View>
        )}

        {userProfile.height && (
          <View style={styles.infoRow}>
            <Ionicons name="resize" size={20} color="#FF6B6B" />
            <Text style={styles.infoText}>{userProfile.height}</Text>
          </View>
        )}

        {userProfile.bio && (
          <View style={styles.bioSection}>
            <Text style={styles.bioTitle}>About Me</Text>
            <Text style={styles.bioText}>{userProfile.bio}</Text>
          </View>
        )}

        {userProfile.relationshipType && (
          <View style={styles.infoSection}>
            <Text style={styles.bioTitle}>Looking For</Text>
            <Text style={styles.infoText}>
              {userProfile.relationshipType.charAt(0).toUpperCase() +
                userProfile.relationshipType.slice(1).replace(/([A-Z])/g, ' $1')}
            </Text>
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
              <Text style={styles.emptyText}>No interests added yet</Text>
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

          {userProfile.religion && (
            <View style={styles.infoRow}>
              <Ionicons name="star" size={20} color="#FF6B6B" />
              <Text style={styles.infoText}>{userProfile.religion}</Text>
            </View>
          )}

          {userProfile.smoking && (
            <View style={styles.infoRow}>
              <Ionicons name="ban" size={20} color="#FF6B6B" />
              <Text style={styles.infoText}>Smoking: {userProfile.smoking}</Text>
            </View>
          )}

          {userProfile.drinking && (
            <View style={styles.infoRow}>
              <Ionicons name="wine" size={20} color="#FF6B6B" />
              <Text style={styles.infoText}>Drinking: {userProfile.drinking}</Text>
            </View>
          )}

          {userProfile.travel && (
            <View style={styles.infoRow}>
              <Ionicons name="airplane" size={20} color="#FF6B6B" />
              <Text style={styles.infoText}>{userProfile.travel}</Text>
            </View>
          )}

          {userProfile.pets && (
            <View style={styles.infoRow}>
              <Ionicons name="paw" size={20} color="#FF6B6B" />
              <Text style={styles.infoText}>{userProfile.pets}</Text>
            </View>
          )}
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

      {/* Edit functionality moved to ProfileEditScreen */}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
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
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  infoText: {
    fontSize: 16,
    marginLeft: 10,
    color: '#333',
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
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 8,
  },
  interestText: {
    color: '#fff',
    fontSize: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
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
});

export default ProfileScreen;
