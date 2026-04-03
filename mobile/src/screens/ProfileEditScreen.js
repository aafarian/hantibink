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
import ProfileCompletionBar from '../components/profile/ProfileCompletionBar';
import Logger from '../utils/logger';
import ApiDataService from '../services/ApiDataService';
import { theme } from '../styles/theme';

const ProfileEditScreen = ({ navigation }) => {
  const { user, userProfile, refreshUserProfile } = useAuth();
  const { showSuccess, showError } = useToast();

  const [photos, setPhotos] = useState([]);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [hasFormChanges, setHasFormChanges] = useState(false); // Track form changes separately
  const [initialFormData, setInitialFormData] = useState(null);
  const [currentFormData, setCurrentFormData] = useState(null); // Track live form data for completion bar
  const [changedFields, setChangedFields] = useState(new Set());
  const [validationErrors, setValidationErrors] = useState({});

  // Refs for the form
  const profileFormRef = useRef(null);

  // Initialize photos from profile
  // PhotoManager handles its own local state for reordering, so we just pass initial data
  useEffect(() => {
    if (userProfile?.photos) {
      setPhotos(userProfile.photos);
    } else {
      setPhotos([]);
    }
  }, [userProfile?.photos]);

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

    // Store current form data for live completion calculation
    setCurrentFormData(newFormData);

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

    // Overall changes check - track form changes and validity separately
    const formHasChanges = newChangedFields.size > 0;
    const hasErrors = Object.keys(currentErrors).length > 0;

    if (formHasChanges) {
      Logger.debug('📝 Changed fields:', Array.from(newChangedFields));
    }

    // Track form changes (for discard button)
    setHasFormChanges(formHasChanges);

    // Only enable save if there are changes and no validation errors
    setHasChanges(formHasChanges && !hasErrors);
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
    // Show toast only if message provided
    if (message) {
      showSuccess(message);
    }
    // Always refresh profile to sync AuthContext with backend
    // PhotoManager won't re-sync from props unless photo count changes
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
      setHasFormChanges(false);
      setValidationErrors({});
      setCurrentFormData(initialFormData); // Reset completion bar

      showSuccess('Changes discarded');
    }
  };

  // Save profile
  const saveProfile = async () => {
    try {
      setSaving(true);

      // Get form data from the ProfileForm component
      const formDataToSave = profileFormRef.current?.getFormData();
      if (!formDataToSave) {
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

      // Transform the form data for API submission
      const apiData = transformProfileData.toApi(formDataToSave);

      // Update profile via API with transformed data
      const success = await ApiDataService.updateUserProfile(apiData);

      if (success) {
        await refreshUserProfile();
        showSuccess('Profile updated successfully!');

        // Reset initial form data to match what was just saved
        // This ensures the next comparison starts fresh
        setInitialFormData(null); // Force re-initialization on next load

        // Reset changes state since we've saved successfully
        setHasChanges(false);
        setHasFormChanges(false);
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
            <Ionicons name="arrow-back" size={24} color={theme.colors.text.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <View style={styles.headerRight}>
            {hasFormChanges && (
              <View style={styles.headerButtons}>
                <TouchableOpacity onPress={discardChanges} style={styles.headerDiscardButton}>
                  <Text style={styles.headerDiscardText}>Discard</Text>
                </TouchableOpacity>
                {hasChanges && (
                  <TouchableOpacity
                    onPress={saveProfile}
                    disabled={saving}
                    style={styles.headerSaveButton}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color={theme.colors.text.white} />
                    ) : (
                      <Text style={styles.headerSaveText}>Save</Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Profile Completion Bar - Compact sticky version */}
        <ProfileCompletionBar userProfile={userProfile} formData={currentFormData} compact />

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
          {hasFormChanges && (
            <View
              style={[styles.bottomButtonsContainer, !hasChanges && styles.singleButtonContainer]}
            >
              <TouchableOpacity
                style={[styles.discardButton, !hasChanges && styles.discardButtonFull]}
                onPress={discardChanges}
              >
                <Text style={styles.discardButtonText}>Discard Changes</Text>
              </TouchableOpacity>
              {hasChanges && (
                <TouchableOpacity style={styles.saveButton} onPress={saveProfile} disabled={saving}>
                  {saving ? (
                    <ActivityIndicator size="small" color={theme.colors.text.white} />
                  ) : (
                    <Text style={styles.saveButtonText}>Save Changes</Text>
                  )}
                </TouchableOpacity>
              )}
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
    backgroundColor: theme.colors.background.secondary,
  },
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background.secondary,
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
    backgroundColor: theme.colors.primary,
  },
  headerLeft: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.text.white,
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
    borderColor: 'rgba(255,255,255,0.5)',
  },
  headerDiscardText: {
    fontSize: 13,
    color: theme.colors.text.white,
    fontWeight: '500',
    fontFamily: theme.typography.fontFamily.medium,
  },
  headerSaveButton: {
    backgroundColor: theme.colors.background.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    minWidth: 45,
    alignItems: 'center',
  },
  headerSaveText: {
    fontSize: 13,
    color: theme.colors.primary,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamily.semibold,
  },
  bottomButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: theme.colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: theme.colors.background.tertiary,
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
    color: theme.colors.text.secondary,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamily.semibold,
  },
  saveButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    color: theme.colors.text.white,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamily.semibold,
  },
  singleButtonContainer: {
    justifyContent: 'center',
  },
  discardButtonFull: {
    flex: 0,
    width: '60%',
    alignSelf: 'center',
  },
  form: {
    flex: 1,
  },
});

export default ProfileEditScreen;
