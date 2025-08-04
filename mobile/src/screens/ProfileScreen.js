import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  TextInput,
  AppState,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../contexts/AuthContext';
import Logger from '../utils/logger';
import { useToast } from '../contexts/ToastContext';
import { LoadingScreen } from '../components/LoadingScreen';
// import { theme } from '../styles/theme';
// import { commonStyles } from '../styles/commonStyles';
import DataService from '../services/DataService';
import { handleError } from '../utils/errorHandler';
import { uploadImageToFirebase } from '../utils/imageUpload';

const ProfileScreen = () => {
  const { logout, user, userProfile: authUserProfile, refreshUserProfile } = useAuth();
  const { showSuccess, showError } = useToast();
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    if (authUserProfile) {
      // Use the profile from AuthContext (which includes location updates)
      Logger.info(
        '📊 ProfileScreen got authUserProfile with',
        authUserProfile.photos?.length || 0,
        'photos'
      );
      setUserProfile(authUserProfile);
      setLoading(false);
    } else if (user?.uid) {
      // Fallback to loading from DataService if AuthContext doesn't have profile
      loadUserProfile();
    }
  }, [user, authUserProfile, loadUserProfile]);

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

  const loadUserProfile = useCallback(async () => {
    try {
      setLoading(true);
      if (user?.uid) {
        const profile = await DataService.getUserProfile(user.uid);
        if (profile) {
          setUserProfile(profile);
        } else {
          // Fallback to default profile if none exists
          setUserProfile({
            name: user.displayName || 'User',
            age: null,
            bio: 'Tell us about yourself...',
            photos: [],
            location: 'Location not set',
            interests: [],
          });
        }
      }
    } catch (error) {
      const errorInfo = handleError(error, 'Failed to load profile');
      showError(errorInfo.message, {
        action: { text: 'Retry', onPress: loadUserProfile },
      });
    } finally {
      setLoading(false);
    }
  }, [user, showError]);

  const saveUserProfile = async updatedProfile => {
    try {
      setSaving(true);
      if (user?.uid) {
        const success = await DataService.updateUserProfile(user.uid, updatedProfile);
        if (success) {
          setUserProfile(updatedProfile);
          showSuccess('Profile updated successfully! ✨');
          Logger.success('Profile updated successfully');
        } else {
          const errorInfo = handleError(new Error('Save failed'), 'Failed to save profile');
          showError(errorInfo.message, {
            action: { text: 'Retry', onPress: () => saveUserProfile(updatedProfile) },
          });
        }
      }
    } catch (error) {
      const errorInfo = handleError(error, 'Failed to save profile');
      showError(errorInfo.message, {
        action: { text: 'Retry', onPress: () => saveProfileEdits() },
      });
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = () => {
    setEditForm({
      name: userProfile?.name || '',
      bio: userProfile?.bio || '',
      location: userProfile?.location || '',
    });
    setEditModalVisible(true);
  };

  const closeEditModal = () => {
    setEditModalVisible(false);
    setEditForm({});
  };

  const saveProfileEdits = async () => {
    try {
      setSaving(true);
      const updatedProfile = { ...userProfile, ...editForm };
      await saveUserProfile(updatedProfile);
      closeEditModal();
    } catch (error) {
      Logger.error('Error saving profile edits:', error);
      showError('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
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

      // Show loading state briefly
      setSaving(true);

      const result = await logout();

      if (result.success) {
        showSuccess('Logged out successfully! 👋');
        Logger.success('✅ User logged out successfully');
      } else {
        Logger.error('❌ Logout failed:', result.error);
        const errorInfo = handleError(
          new Error(result.error || 'Logout failed'),
          'Failed to logout'
        );
        showError(errorInfo.message, {
          action: { text: 'Try Again', onPress: performLogout },
        });
      }
    } catch (error) {
      Logger.error('❌ Logout error:', error);
      const errorInfo = handleError(error, 'Failed to logout');
      showError(errorInfo.message, {
        action: { text: 'Try Again', onPress: performLogout },
      });
    } finally {
      setSaving(false);
    }
  };

  const pickImage = async () => {
    if (saving) return; // Prevent multiple uploads

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (status !== 'granted') {
      showError('Please grant permission to access your photo library');
      return;
    }

    try {
      setSaving(true);
      Logger.info('📸 Opening image picker from profile...');

      const currentPhotos = userProfile?.photos || [];
      const remainingSlots = 6 - currentPhotos.length;

      if (remainingSlots <= 0) {
        showError('You can upload up to 6 photos');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: remainingSlots,
        allowsEditing: false, // Disable editing for multi-select
        quality: 0.8,
        exif: false,
      });

      Logger.info('📸 Profile image picker result:', result);

      if (!result.canceled && result.assets && result.assets.length > 0 && userProfile) {
        Logger.info(`📸 Uploading ${result.assets.length} images...`);

        // Upload all selected images
        const uploadPromises = result.assets.map(asset =>
          uploadImageToFirebase(asset.uri, user.uid)
        );

        const cloudUrls = await Promise.all(uploadPromises);

        const newPhotos = [...currentPhotos, ...cloudUrls];
        const updatedProfile = {
          ...userProfile,
          photos: newPhotos,
          mainPhoto: userProfile.mainPhoto || cloudUrls[0], // Set first photo as main if no main photo
        };

        await saveUserProfile(updatedProfile);

        showSuccess(`${result.assets.length} image(s) uploaded successfully!`);
      }
    } catch (error) {
      Logger.error('Error uploading images:', error);
      showError('Failed to upload images. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingScreen message="Loading profile..." />;
  }

  if (!userProfile) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.errorText}>Failed to load profile</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadUserProfile}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {saving && <ActivityIndicator size="small" color="#fff" style={styles.savingIndicator} />}

      {/* Profile Photos */}
      <View style={styles.photoSection}>
        <Text style={styles.sectionTitle}>Photos</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {(userProfile.photos || []).map((photo, index) => (
            <Image key={index} source={{ uri: photo }} style={styles.profilePhoto} />
          ))}
          <TouchableOpacity style={styles.addPhotoButton} onPress={pickImage} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color="#FF6B6B" />
            ) : (
              <>
                <Ionicons name="add" size={30} color="#FF6B6B" />
                <Text style={styles.addPhotoText}>
                  {userProfile?.photos?.length === 0
                    ? 'Add Photos'
                    : `Add More (${6 - (userProfile?.photos?.length || 0)} left)`}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
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

        <View style={styles.bioSection}>
          <Text style={styles.bioTitle}>About Me</Text>
          <Text style={styles.bioText}>{userProfile.bio}</Text>
        </View>

        <View style={styles.interestsSection}>
          <Text style={styles.interestsTitle}>Interests</Text>
          <View style={styles.interestsContainer}>
            {userProfile.interests ? (
              Array.isArray(userProfile.interests) ? (
                // Handle array format (old format)
                userProfile.interests.map((interest, index) => (
                  <View key={index} style={styles.interestTag}>
                    <Text style={styles.interestText}>{interest}</Text>
                  </View>
                ))
              ) : (
                // Handle string format (new format)
                <Text style={styles.bioText}>{userProfile.interests}</Text>
              )
            ) : (
              <Text style={styles.emptyText}>No interests added yet</Text>
            )}
          </View>
        </View>
      </View>

      {/* Settings */}
      <View style={styles.settingsSection}>
        <Text style={styles.sectionTitle}>Settings</Text>

        <TouchableOpacity style={styles.settingItem} onPress={openEditModal}>
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

      {/* Edit Profile Modal */}
      <Modal visible={editModalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeEditModal}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <TouchableOpacity onPress={saveProfileEdits} disabled={saving}>
              <Text style={[styles.modalSaveText, saving && styles.disabledText]}>
                {saving ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>Name</Text>
              <TextInput
                style={styles.textInput}
                value={editForm.name}
                onChangeText={text => setEditForm(prev => ({ ...prev, name: text }))}
                placeholder="Enter your name"
              />
            </View>

            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>Bio</Text>
              <TextInput
                style={[styles.textInput, styles.textAreaInput]}
                value={editForm.bio}
                onChangeText={text => setEditForm(prev => ({ ...prev, bio: text }))}
                placeholder="Tell us about yourself..."
                multiline
                numberOfLines={4}
              />
            </View>

            <View style={styles.formField}>
              <Text style={styles.fieldLabel}>Location</Text>
              <TextInput
                style={styles.textInput}
                value={editForm.location}
                onChangeText={text => setEditForm(prev => ({ ...prev, location: text }))}
                placeholder="Enter your location"
              />
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    padding: 20,
    backgroundColor: '#FF6B6B',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  photoSection: {
    padding: 20,
    backgroundColor: '#fff',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  profilePhoto: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginRight: 10,
  },
  addPhotoButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#FF6B6B',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  addPhotoText: {
    color: '#FF6B6B',
    fontSize: 12,
    marginTop: 5,
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
  savingIndicator: {
    marginLeft: 10,
  },
  emptyText: {
    color: '#999',
    fontSize: 14,
    fontStyle: 'italic',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#666',
  },
  modalSaveText: {
    fontSize: 16,
    color: '#FF6B6B',
    fontWeight: '600',
  },
  disabledText: {
    opacity: 0.5,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  formField: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textAreaInput: {
    height: 100,
    textAlignVertical: 'top',
  },
});

export default ProfileScreen;
