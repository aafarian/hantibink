import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import ProfileForm from '../components/profile/ProfileForm';
import PhotoManager from '../components/profile/PhotoManager';
import Logger from '../utils/logger';
import ApiDataService from '../services/ApiDataService';

const ProfileEditScreen = ({ navigation }) => {
  const { user, userProfile, refreshUserProfile } = useAuth();
  const { showSuccess, showError } = useToast();

  const [photos, setPhotos] = useState([]);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [initialFormData, setInitialFormData] = useState(null);

  // Refs for the form
  const profileFormRef = useRef(null);

  // Initialize photos from profile
  useEffect(() => {
    if (userProfile?.photos) {
      setPhotos(userProfile.photos);
    }
  }, [userProfile]);

  // Initialize form data and track when profile loads
  useEffect(() => {
    if (userProfile && !initialFormData) {
      // Store the initial state of the profile for comparison
      const initial = {
        name: userProfile.name || '',
        bio: userProfile.bio || '',
        education: userProfile.education || '',
        profession: userProfile.profession || '',
        height: userProfile.height?.toString() || '',
        relationshipType: userProfile.relationshipType || '',
        smoking: userProfile.smoking || '',
        drinking: userProfile.drinking || '',
        travel: userProfile.travel || '',
        pets: userProfile.pets || '',
        interests: userProfile.interests || [],
      };
      setInitialFormData(initial);
    }
  }, [userProfile, initialFormData]);

  // Handle form data changes
  const handleFormDataChange = newFormData => {
    if (!initialFormData) return;

    // Check if current form data differs from initial state
    const hasFormChanges = Object.keys(initialFormData).some(key => {
      const initial = initialFormData[key];
      const current = newFormData[key];

      // Handle arrays (like interests)
      if (Array.isArray(initial) && Array.isArray(current)) {
        return JSON.stringify(initial.sort()) !== JSON.stringify(current.sort());
      }

      // Handle regular values - normalize empty strings and null/undefined
      const normalizedInitial = initial || '';
      const normalizedCurrent = current || '';

      return normalizedInitial !== normalizedCurrent;
    });

    setHasChanges(hasFormChanges);
  };

  // Handle photo changes
  const handlePhotosChange = newPhotos => {
    setPhotos(newPhotos);
  };

  // Handle photo errors/success
  const handlePhotoError = message => {
    showError(message);
  };

  const handlePhotoSuccess = message => {
    showSuccess(message);
    // Refresh profile to get updated photo data
    refreshUserProfile();
  };

  // Save profile
  const saveProfile = async () => {
    try {
      setSaving(true);

      // Get form data from the ProfileForm component
      const currentFormData = profileFormRef.current?.getFormData();
      if (!currentFormData) {
        showError('Please fill in the form');
        return;
      }

      // Validate form
      const validation = profileFormRef.current?.validateForm();
      if (!validation?.isValid) {
        const firstError = Object.values(validation.errors)[0];
        showError(firstError || 'Please check your input');
        return;
      }

      // Update profile via API
      const success = await ApiDataService.updateUserProfile(currentFormData);

      if (success) {
        await refreshUserProfile();
        showSuccess('Profile updated successfully! ✨');

        // Reset changes state since we've saved successfully
        setHasChanges(false);

        navigation.goBack();
      } else {
        showError('Failed to update profile');
      }
    } catch (error) {
      Logger.error('❌ Error saving profile:', error);
      showError(error.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  // Handle scroll control from PhotoManager
  const handleScrollControl = enabled => {
    if (profileFormRef.current) {
      profileFormRef.current.setScrollEnabled(enabled);
    }
  };

  // Render photos component for ProfileForm
  const renderPhotosComponent = () => (
    <PhotoManager
      photos={photos}
      onPhotosChange={handlePhotosChange}
      userId={user?.uid}
      maxPhotos={6}
      showTitle={true}
      showAddButton={true}
      mode="edit"
      onError={handlePhotoError}
      onSuccess={handlePhotoSuccess}
      onScrollControl={handleScrollControl}
    />
  );

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <View style={styles.headerPlaceholder} />
        </View>

        {/* Profile Form */}
        <ProfileForm
          ref={profileFormRef}
          initialData={userProfile}
          onDataChange={handleFormDataChange}
          showPhotosSection={true}
          photosComponent={renderPhotosComponent()}
          mode="edit"
          style={styles.form}
        />

        {/* Floating Save Button */}
        {hasChanges && (
          <View style={styles.floatingSaveContainer}>
            <TouchableOpacity
              style={styles.floatingSaveButton}
              onPress={saveProfile}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.floatingSaveText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  headerPlaceholder: {
    width: 24, // Same width as back button for symmetry
  },
  floatingSaveContainer: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  floatingSaveButton: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 25,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  floatingSaveText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  form: {
    flex: 1,
  },
});

export default ProfileEditScreen;
