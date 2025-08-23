import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import ProfileForm from '../components/profile/ProfileForm';
import PhotoManager from '../components/profile/PhotoManager';
import { transformProfileData } from '../components/profile/ProfileFieldsConfig';
import Logger from '../utils/logger';
import ApiDataService from '../services/ApiDataService';
import { theme } from '../styles/theme';

const ProfileEditScreen = ({ navigation }) => {
  const { user, userProfile, refreshUserProfile } = useAuth();
  const { showSuccess, showError } = useToast();

  const [photos, setPhotos] = useState([]);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [initialFormData, setInitialFormData] = useState(null);
  const [changedFields, setChangedFields] = useState(new Set());
  const [validationErrors, setValidationErrors] = useState({});

  // Refs for the form
  const profileFormRef = useRef(null);

  // Initialize photos from profile - always sync with userProfile
  useEffect(() => {
    if (userProfile?.photos) {
      // Always update photos when userProfile changes
      // This ensures photos stay in sync after API updates
      setPhotos(userProfile.photos);
    } else {
      setPhotos([]);
    }
  }, [userProfile?.photos]); // Only watch photos array to avoid unnecessary re-renders

  // Initialize form data and track when profile loads
  useEffect(() => {
    if (userProfile && !initialFormData) {
      // Transform the initial data the same way ProfileForm will
      // This ensures our comparison is apples-to-apples
      const transformed = transformProfileData.fromApi(userProfile);
      setInitialFormData(transformed);

      Logger.debug('🎯 Initial form data set (transformed):', transformed);
    }
  }, [userProfile, initialFormData]);

  // Handle form data changes - track individual field changes and validation
  const handleFormDataChange = (newFormData, fieldErrors = {}) => {
    if (!initialFormData) return;

    // Update validation errors with real-time validation
    const currentErrors = { ...fieldErrors };

    // Always validate required fields
    if (!newFormData.name || newFormData.name.trim() === '') {
      currentErrors.name = 'Name is required';
    } else if (currentErrors.name) {
      delete currentErrors.name;
    }

    setValidationErrors(currentErrors);

    // Track which specific fields have changed
    const newChangedFields = new Set();

    Object.keys(newFormData).forEach(key => {
      const initialValue = initialFormData[key];
      const currentValue = newFormData[key];

      // Compare values (handle arrays specially)
      let hasChanged = false;
      if (Array.isArray(initialValue) && Array.isArray(currentValue)) {
        hasChanged =
          JSON.stringify([...initialValue].sort()) !== JSON.stringify([...currentValue].sort());
      } else {
        hasChanged = JSON.stringify(initialValue) !== JSON.stringify(currentValue);
      }

      if (hasChanged) {
        newChangedFields.add(key);
      }
    });

    setChangedFields(newChangedFields);

    // Overall changes check - only show save button if there are changes AND no errors
    const hasFormChanges = newChangedFields.size > 0;
    const hasErrors = Object.keys(currentErrors).length > 0;

    if (hasFormChanges) {
      Logger.debug('📝 Changed fields:', Array.from(newChangedFields));
    }

    // Only enable save if there are changes and no validation errors
    setHasChanges(hasFormChanges && !hasErrors);
  };

  // Handle photo changes
  const handlePhotosChange = newPhotos => {
    setPhotos(newPhotos);
  };

  // Handle photo errors/success
  const handlePhotoError = message => {
    showError(message);
  };

  const handlePhotoSuccess = async message => {
    showSuccess(message);
    // Refresh profile to get updated photo data
    await refreshUserProfile();
  };

  // Discard changes and reset to initial state
  const discardChanges = () => {
    if (profileFormRef.current && initialFormData) {
      // Reset form to initial data
      profileFormRef.current.setFormData(initialFormData);

      // Clear change tracking
      setChangedFields(new Set());
      setHasChanges(false);
      setValidationErrors({});

      showSuccess('Changes discarded');
    }
  };

  // Save profile
  const saveProfile = async () => {
    try {
      setSaving(true);

      // Get form data from the ProfileForm component
      const currentFormData = profileFormRef.current?.getFormData();
      if (!currentFormData) {
        setSaving(false);
        return;
      }

      // Validate form
      const validation = profileFormRef.current?.validateForm();
      if (!validation?.isValid) {
        // Set validation errors to be displayed in the form
        setValidationErrors(validation.errors);
        setSaving(false);
        return;
      }

      // Clear any validation errors
      setValidationErrors({});

      // Send all current form data - let the API handle optimization
      // This is simpler and avoids complex diff tracking issues
      Logger.info('📝 Saving profile with current form data');

      // Update profile via API with all current data
      const success = await ApiDataService.updateUserProfile(currentFormData);

      if (success) {
        await refreshUserProfile();
        showSuccess('Profile updated successfully! ✨');

        // Reset initial form data to match what was just saved
        // This ensures the next comparison starts fresh
        setInitialFormData(null); // Force re-initialization on next load

        // Reset changes state since we've saved successfully
        setHasChanges(false);
        setChangedFields(new Set());

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
        {/* Status bar background */}
        <View style={styles.statusBarBackground} />
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerLeft}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <View style={styles.headerRight}>
            {hasChanges && (
              <View style={styles.headerButtons}>
                <TouchableOpacity onPress={discardChanges} style={styles.headerDiscardButton}>
                  <Text style={styles.headerDiscardText}>Discard</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={saveProfile}
                  disabled={saving}
                  style={styles.headerSaveButton}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.headerSaveText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* Profile Form */}
        <ProfileForm
          ref={profileFormRef}
          initialData={userProfile}
          onDataChange={handleFormDataChange}
          changedFields={changedFields}
          validationErrors={validationErrors}
          showPhotosSection={true}
          photosComponent={renderPhotosComponent()}
          mode="edit"
          style={styles.form}
        >
          {/* Bottom Action Buttons */}
          {hasChanges && (
            <View style={styles.bottomButtonsContainer}>
              <TouchableOpacity style={styles.discardButton} onPress={discardChanges}>
                <Text style={styles.discardButtonText}>Discard Changes</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={saveProfile} disabled={saving}>
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ProfileForm>
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
  statusBarBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 50, // Generous height to cover status bar area
    backgroundColor: theme.colors.primary,
    zIndex: -1, // Behind other content
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
  headerLeft: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  headerDiscardButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  headerDiscardText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  headerSaveButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    minWidth: 45,
    alignItems: 'center',
  },
  headerSaveText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },
  bottomButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  discardButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  discardButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  form: {
    flex: 1,
  },
});

export default ProfileEditScreen;
