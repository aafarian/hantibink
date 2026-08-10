import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import ApiDataService from '../../services/ApiDataService';
import Logger from '../../utils/logger';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { uploadImageToFirebase } from '../../utils/imageUpload';
import { theme } from '../../styles/theme';

const ProfileSetupModal = ({ visible, onClose, onComplete, userProfile }) => {
  const { showToast } = useToast();
  const { user, refreshUserProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [hasDetectedLocation, setHasDetectedLocation] = useState(false);
  const autoProgressionTimerRef = useRef(null);
  const [steps, setSteps] = useState([]); // Move this up before useEffects that depend on it
  const [stepsLoading, setStepsLoading] = useState(true); // Track if steps are being calculated
  const [showDatePicker, setShowDatePicker] = useState(Platform.OS === 'ios'); // Always show on iOS
  const [setupData, setSetupData] = useState({
    birthDate: userProfile?.birthDate ? new Date(userProfile.birthDate) : null,
    gender: userProfile?.gender || '',
    interestedIn: userProfile?.interestedIn || [],
    photos: userProfile?.photos || [],
    location: userProfile?.location || '',
    latitude: userProfile?.latitude || null,
    longitude: userProfile?.longitude || null,
  });

  // Store location data separately to ensure it's not lost
  const [locationData, setLocationData] = useState({
    location: '',
    latitude: null,
    longitude: null,
  });

  // Initialize setupData when modal opens (not on every userProfile change)
  useEffect(() => {
    if (visible && userProfile) {
      setSetupData(prev => {
        // Only reset if we're opening the modal fresh (no local changes yet)
        // Don't overwrite local photos if user has already selected some
        const hasLocalPhotos =
          prev.photos && prev.photos.length > 0 && prev.photos.some(p => p.isLocal || p.uri);

        Logger.info('🔄 SetupData update in useEffect:', {
          trigger: 'visible && userProfile',
          prevPhotosCount: prev.photos?.length,
          hasLocalPhotos,
          keepingPhotos: hasLocalPhotos,
          userProfilePhotos: userProfile.photos?.length || 0,
        });

        return {
          birthDate: userProfile.birthDate
            ? new Date(userProfile.birthDate)
            : prev.birthDate || null,
          gender: userProfile.gender || prev.gender || '',
          interestedIn: userProfile.interestedIn || prev.interestedIn || [],
          photos: hasLocalPhotos ? prev.photos : userProfile.photos || [],
          location: locationData.location || userProfile.location || prev.location || '',
          latitude: locationData.latitude || userProfile.latitude || prev.latitude || null,
          longitude: locationData.longitude || userProfile.longitude || prev.longitude || null,
        };
      });
    }
  }, [visible, userProfile, locationData.location, locationData.latitude, locationData.longitude]); // Include specific locationData fields

  // Separate effect for location updates
  useEffect(() => {
    if (locationData.location) {
      setSetupData(prev => {
        Logger.info('🔄 SetupData update for location:', {
          trigger: 'locationData change',
          prevPhotosCount: prev.photos?.length,
          photos: prev.photos,
          location: locationData.location,
        });
        return {
          ...prev,
          location: locationData.location,
          latitude: locationData.latitude,
          longitude: locationData.longitude,
        };
      });
    }
  }, [locationData]);

  // Auto-detect location when reaching the location step
  useEffect(() => {
    const currentStepKey = steps[currentStep]?.key;

    Logger.info('🔍 Current step check:', {
      currentStep,
      currentStepKey,
      hasLocation: !!setupData.location,
      visible,
      totalSteps: steps.length,
    });

    // If we're on the location step and don't have location yet, auto-detect it
    // This will only happen if permissions weren't already granted
    if (currentStepKey === 'location' && !setupData.location && visible) {
      Logger.info('📍 Triggering location request for location step');
      handleLocationRequest();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, steps, setupData.location, visible]);

  // Separate effect for auto-progression to avoid dependency issues
  useEffect(() => {
    const currentStepKey = steps[currentStep]?.key;

    // Auto-progress when location is detected on the location step
    if (currentStepKey === 'location' && locationData.location && visible && !hasDetectedLocation) {
      setHasDetectedLocation(true);
      Logger.info('📍 Location detected, setting up auto-progression...', {
        currentStep,
        totalSteps: steps.length,
        isLastStep: currentStep === steps.length - 1,
        locationData,
      });

      // Clear any existing timer
      if (autoProgressionTimerRef.current) {
        Logger.info('📍 Clearing existing auto-progression timer');
        clearTimeout(autoProgressionTimerRef.current);
      }

      // Short delay to show the location before auto-progressing
      autoProgressionTimerRef.current = setTimeout(async () => {
        Logger.info('📍 Timer executing for auto-progression', {
          currentStep,
          stepsLength: steps.length,
          isLastStep: currentStep === steps.length - 1,
        });

        // Move to next step or complete
        if (currentStep === steps.length - 1) {
          Logger.info('📍 Location was last step, calling handleComplete...');
          try {
            await handleComplete();
            Logger.info('📍 handleComplete executed successfully');
          } catch (error) {
            Logger.error('📍 Error in handleComplete during auto-progression:', error);
          }
        } else {
          Logger.info('📍 Moving to next step');
          setCurrentStep(currentStep + 1);
        }

        // Clear the ref after execution
        autoProgressionTimerRef.current = null;
      }, 2000); // 2 seconds to let user see their location
    }

    // Reset flag when leaving location step or modal closes
    if (currentStepKey !== 'location' || !visible) {
      setHasDetectedLocation(false);
      // Clear timer if modal closes or we leave location step
      if (autoProgressionTimerRef.current) {
        Logger.info('📍 Clearing timer due to step change or modal close');
        clearTimeout(autoProgressionTimerRef.current);
        autoProgressionTimerRef.current = null;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, steps, locationData, visible, hasDetectedLocation]);

  // Track if modal was previously visible to detect fresh opens
  const wasVisibleRef = useRef(false);

  // Build steps when modal becomes visible
  useEffect(() => {
    // Only recalculate steps when modal becomes visible
    if (visible && userProfile) {
      // Check if this is a fresh open (was closed, now open)
      const isFreshOpen = !wasVisibleRef.current;
      wasVisibleRef.current = true;

      const buildSteps = () => {
        const missingSteps = [];

        // Check what's missing and add only those steps
        // birthDate first - critical for age verification
        if (!userProfile.birthDate) {
          missingSteps.push({ title: 'Your Birthday', key: 'birthDate' });
        }

        if (!userProfile.gender) {
          missingSteps.push({ title: 'Your Gender', key: 'gender' });
        }

        if (!userProfile.interestedIn || userProfile.interestedIn.length === 0) {
          missingSteps.push({ title: 'Interested In', key: 'interestedIn' });
        }

        if (!userProfile.photos || userProfile.photos.length === 0) {
          missingSteps.push({ title: 'Add Photos', key: 'photos' });
        }

        // Check if we need location step - just check if location is stored
        // Location will be fetched when user reaches that step
        if (!userProfile.location || !userProfile.latitude || !userProfile.longitude) {
          missingSteps.push({ title: 'Your Location', key: 'location' });
        }

        setSteps(missingSteps);
        setStepsLoading(false); // Steps are now calculated

        // Handle step adjustments
        if (isFreshOpen) {
          Logger.info('📱 Fresh modal open, resetting to step 0');
          setCurrentStep(0);
        } else if (missingSteps.length === 0) {
          // All steps completed, close the modal
          Logger.info('📱 All steps completed, closing modal');
          onComplete && onComplete({});
        } else if (currentStep >= missingSteps.length) {
          // Current step is out of bounds, adjust to last step
          Logger.info(
            '📱 CurrentStep out of bounds, adjusting:',
            currentStep,
            '->',
            missingSteps.length - 1
          );
          setCurrentStep(missingSteps.length - 1);
        } else {
          Logger.info('📱 Profile updated while modal open, keeping current step:', currentStep);
        }
      };

      buildSteps();
    } else if (!visible) {
      // Reset the ref when modal closes
      wasVisibleRef.current = false;
      setStepsLoading(true); // Reset for next open
    }
  }, [visible, userProfile, currentStep, onComplete]); // Include currentStep for logging

  // Reset hasDetectedLocation when modal closes and cleanup timer
  useEffect(() => {
    if (!visible) {
      setHasDetectedLocation(false);
      // Clear any pending auto-progression timer
      if (autoProgressionTimerRef.current) {
        Logger.info('📍 Clearing timer on modal close');
        clearTimeout(autoProgressionTimerRef.current);
        autoProgressionTimerRef.current = null;
      }
    }
  }, [visible]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoProgressionTimerRef.current) {
        clearTimeout(autoProgressionTimerRef.current);
      }
    };
  }, []);

  const handleGenderSelect = useCallback(gender => {
    setSetupData(prev => ({ ...prev, gender }));
  }, []);

  const handleBirthDateChange = useCallback((event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setSetupData(prev => ({ ...prev, birthDate: selectedDate }));
    }
  }, []);

  // Calculate age from birthDate
  const getAge = useCallback(birthDate => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  }, []);

  // Validate age is 18-100
  const isValidAge = useCallback(
    birthDate => {
      const age = getAge(birthDate);
      return age !== null && age >= 18 && age <= 100;
    },
    [getAge]
  );

  const handleInterestedInToggle = useCallback(option => {
    setSetupData(prev => {
      const current = prev.interestedIn || [];
      if (current.includes(option)) {
        return { ...prev, interestedIn: current.filter(g => g !== option) };
      }
      return { ...prev, interestedIn: [...current, option] };
    });
  }, []);

  const handlePhotoSelect = useCallback(async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please allow access to your photos to continue.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const photoUri = result.assets[0].uri;

        // Just store the local URI for now - we'll upload when user clicks Next
        setSetupData(prev => {
          const newPhotos = [...prev.photos, { uri: photoUri, isLocal: true }];
          Logger.info('📸 Photo added to setupData:', {
            previousCount: prev.photos.length,
            newCount: newPhotos.length,
            newPhoto: { uri: photoUri, isLocal: true },
          });
          return {
            ...prev,
            photos: newPhotos,
          };
        });

        Logger.info('Photo selected, will upload on Next');
      }
    } catch (error) {
      Logger.error('Photo selection error:', error);
      showToast('Failed to select photo', 'error');
    }
  }, [showToast]);

  const handleLocationRequest = useCallback(async () => {
    try {
      // Double-check we're actually on the location step
      const currentStepKey = steps[currentStep]?.key;
      if (currentStepKey !== 'location') {
        Logger.warn('📍 Location request called but not on location step, ignoring');
        return;
      }

      setLoading(true);
      Logger.info('📍 Starting location request...');

      // Request permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      Logger.info('📍 Permission status:', status);

      if (status !== 'granted') {
        Alert.alert(
          'Location Required',
          'Location access is required to use the discovery feature. Please enable it in your settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Location.openSettings() },
          ]
        );
        setLoading(false);
        return;
      }

      // Get current location with timeout
      Logger.info('📍 Getting current position...');
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeout: 10000, // 10 second timeout
      });

      const { latitude, longitude } = location.coords;
      Logger.info('📍 Got coordinates:', { latitude, longitude });

      // Reverse geocode to get city name
      const reverseGeocode = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      if (reverseGeocode[0]) {
        const { city, region, country } = reverseGeocode[0];
        // Build location string with proper fallbacks
        const locationName = city || region || 'Unknown Location';
        const locationString = country ? `${locationName}, ${country}` : locationName;

        const locationInfo = {
          location: locationString,
          latitude,
          longitude,
        };

        setLocationData(locationInfo);
        setSetupData(prev => ({
          ...prev,
          ...locationInfo,
        }));

        // Immediately update the user's location in the database
        try {
          await ApiDataService.updateUserProfile({
            location: locationString,
            latitude,
            longitude,
            locationEnabled: true,
          });
          Logger.success('📍 Location updated in database:', locationString);
        } catch (error) {
          Logger.error('Failed to update location:', error);
        }

        Logger.success('📍 Location detected:', locationString);
      } else {
        Logger.warn('📍 No reverse geocode results');
        // Still save coordinates even if we can't get the city name
        setSetupData(prev => ({
          ...prev,
          location: 'Location detected',
          latitude,
          longitude,
        }));
      }
    } catch (error) {
      Logger.error('📍 Location error:', error);
      showToast('Failed to get location. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast, steps, currentStep]);

  // Save data progressively after each step
  const saveStepData = useCallback(
    async stepKey => {
      try {
        let updateData = {};

        switch (stepKey) {
          case 'birthDate':
            if (setupData.birthDate) {
              updateData = { birthDate: setupData.birthDate.toISOString() };
            }
            break;
          case 'gender':
            if (setupData.gender) {
              updateData = { gender: setupData.gender };
            }
            break;
          case 'interestedIn':
            if (setupData.interestedIn.length > 0) {
              updateData = { interestedIn: setupData.interestedIn };
            }
            break;
          case 'photos':
            // Upload all local photos to Firebase when user clicks Next
            Logger.info('📸 Photo step saveStepData called');
            if (setupData.photos.length > 0) {
              Logger.info('📸 Starting photo upload process...', {
                photosCount: setupData.photos.length,
                photos: setupData.photos,
                needsUpload: setupData.photos.filter(p => p.uri && !p.url).length,
              });
              setUploadingPhotos(true);
              const uploadedPhotos = [];

              try {
                for (let i = 0; i < setupData.photos.length; i++) {
                  const photo = setupData.photos[i];
                  Logger.info(`📸 Processing photo ${i + 1}:`, {
                    hasUri: !!photo.uri,
                    hasUrl: !!photo.url,
                    isLocal: photo.isLocal,
                    photo,
                  });

                  // Upload if it has a URI but no URL (not uploaded yet)
                  // Check both with and without isLocal flag
                  if (photo.uri && !photo.url) {
                    try {
                      Logger.info(`📸 Uploading photo ${i + 1} with URI:`, photo.uri);
                      showToast(
                        `Uploading photo ${i + 1} of ${setupData.photos.length}...`,
                        'info'
                      );
                      const downloadURL = await uploadImageToFirebase(
                        photo.uri,
                        userProfile?.id || user?.uid || 'temp',
                        'profile-photos'
                      );
                      uploadedPhotos.push({ url: downloadURL });
                      Logger.success(`✅ Uploaded photo ${i + 1}:`, downloadURL);
                    } catch (uploadError) {
                      Logger.error(`Failed to upload photo ${i + 1}:`, uploadError);
                      showToast(`Failed to upload photo ${i + 1}`, 'error');
                      throw uploadError;
                    }
                  } else if (photo.url) {
                    // Already uploaded
                    Logger.info(`📸 Photo ${i + 1} already has URL:`, photo.url);
                    uploadedPhotos.push(photo);
                  } else if (typeof photo === 'string' && photo.startsWith('http')) {
                    // Direct URL string
                    Logger.info(`📸 Photo ${i + 1} is direct URL:`, photo);
                    uploadedPhotos.push({ url: photo });
                  } else {
                    Logger.warn(`📸 Photo ${i + 1} has unknown format:`, photo);
                  }
                }

                // Update setupData with uploaded URLs
                setSetupData(prev => {
                  Logger.info('🔄 Updating setupData with uploaded photos:', {
                    prevPhotosCount: prev.photos?.length,
                    uploadedPhotosCount: uploadedPhotos.length,
                    uploadedPhotos,
                  });
                  return {
                    ...prev,
                    photos: uploadedPhotos,
                  };
                });

                // Photos will be saved to API in handleComplete via complete-setup endpoint
                // Don't save here to avoid duplicates

                // Return the uploaded photos so handleNext can pass them to handleComplete
                Logger.success('🎉 All photos uploaded and saved successfully:', uploadedPhotos);
                showToast('All photos uploaded successfully', 'success');
                return { photos: uploadedPhotos };
              } finally {
                setUploadingPhotos(false);
              }
            } else {
              Logger.warn('📸 No photos to upload');
            }
            return null; // Don't save to API yet, will be done in complete-setup
          case 'location':
            if (setupData.location && setupData.latitude && setupData.longitude) {
              updateData = {
                location: setupData.location,
                latitude: setupData.latitude,
                longitude: setupData.longitude,
                locationEnabled: true,
              };
            }
            break;
          default:
            return true;
        }

        if (Object.keys(updateData).length > 0) {
          Logger.info(`Saving ${stepKey} data:`, updateData);
          const result = await ApiDataService.updateUserProfile(updateData);

          // Don't refresh after each save - causes rate limiting
          // The profile will be refreshed when modal completes or screen focuses
          return result;
        }
        return true;
      } catch (error) {
        Logger.error(`Failed to save ${stepKey}:`, error);
        // Don't block progression, but log the error
        return false;
      }
    },
    [setupData, user, showToast, userProfile]
  );

  const handleCompleteWithPhotos = useCallback(
    async uploadedPhotos => {
      try {
        setLoading(true);

        // Ensure photos array is valid
        if (!uploadedPhotos || !Array.isArray(uploadedPhotos) || uploadedPhotos.length === 0) {
          Logger.error('❌ Invalid uploadedPhotos:', uploadedPhotos);
          showToast('No photos to save', 'error');
          setLoading(false);
          return;
        }

        // Ensure we have the latest location data and uploaded photos
        const finalSetupData = {
          ...setupData,
          photos: uploadedPhotos, // Use the just-uploaded photos
          ...(locationData.location ? locationData : {}),
        };

        // Log the data being sent for debugging
        Logger.info('📤 Completing profile setup with uploaded photos:', {
          gender: finalSetupData.gender,
          interestedIn: finalSetupData.interestedIn,
          photosCount: finalSetupData.photos?.length || 0,
          location: finalSetupData.location,
          latitude: finalSetupData.latitude,
          longitude: finalSetupData.longitude,
        });

        // Final save with all data to ensure completeness
        const completeData = {
          ...(finalSetupData.birthDate
            ? { birthDate: finalSetupData.birthDate.toISOString() }
            : {}),
          gender: finalSetupData.gender,
          interestedIn: finalSetupData.interestedIn,
          photos: finalSetupData.photos.map(p => p.id || p.url || p),
          location: finalSetupData.location,
          latitude: finalSetupData.latitude,
          longitude: finalSetupData.longitude,
        };

        Logger.info('📤 Sending to complete-setup endpoint:', completeData);
        const response = await ApiDataService.completeProfileSetup(completeData);
        Logger.info('📤 Complete-setup response:', response);

        // Handle both { success: true, data: ... } and direct data response
        const isSuccess = response?.success || (response && !response.error);
        const responseData = response?.data || response;

        if (isSuccess) {
          Logger.success('✅ Profile setup API call succeeded, closing modal');
          showToast('Profile setup complete!', 'success');

          // IMPORTANT: Close modal FIRST before any callbacks
          // This prevents the modal from staying open if onComplete has issues
          onClose();

          // Then trigger refresh and callback after modal animation completes
          setTimeout(() => {
            try {
              // Refresh user profile to get updated data
              if (refreshUserProfile) {
                refreshUserProfile();
              }
              // Call onComplete if provided
              if (onComplete) {
                onComplete(responseData);
              }
            } catch (callbackError) {
              // Don't show error - setup already succeeded and modal is closed
              Logger.warn('Post-completion callback error (setup succeeded):', callbackError);
            }
          }, 300); // 300ms to allow modal animation to complete
        } else {
          Logger.error('❌ Profile setup returned failure:', response);
          throw new Error(response?.message || 'Setup failed');
        }
      } catch (error) {
        Logger.error('Profile setup error:', error);
        const errorMessage = error?.message || 'Unknown error';
        showToast(`Setup failed: ${errorMessage}`, 'error');
      } finally {
        setLoading(false);
      }
    },
    [setupData, locationData, showToast, onComplete, onClose, refreshUserProfile]
  );

  const handleComplete = useCallback(async () => {
    Logger.info('📍 handleComplete called');
    try {
      setLoading(true);

      // Ensure we have the latest location data
      const finalSetupData = {
        ...setupData,
        ...(locationData.location ? locationData : {}),
      };

      Logger.info('📍 handleComplete - finalSetupData:', finalSetupData);

      // Check if photos step was part of this setup process
      const photosStepIncluded = steps.some(step => step.key === 'photos');

      // Only validate photos if the photos step was included
      if (photosStepIncluded) {
        const hasUnuploadedPhotos = finalSetupData.photos?.some(photo => photo.uri && !photo.url);
        if (hasUnuploadedPhotos) {
          Logger.error(
            '❌ CRITICAL: Found unuploaded photos at completion time. This should not happen!'
          );
          Logger.error('Photos state:', finalSetupData.photos);
          showToast(
            'Please go back to the photos step and click Next to upload your photos',
            'error'
          );
          setLoading(false);
          return;
        }
      }

      // Log the data being sent for debugging
      Logger.info('📤 Completing profile setup with data:', {
        gender: finalSetupData.gender,
        interestedIn: finalSetupData.interestedIn,
        photosStepIncluded,
        photosCount: photosStepIncluded
          ? finalSetupData.photos?.length || 0
          : 'N/A (user already has photos)',
        location: finalSetupData.location,
        latitude: finalSetupData.latitude,
        longitude: finalSetupData.longitude,
      });

      // Final save with all data to ensure completeness
      // Only include photos if the photos step was part of this setup
      const completeData = {
        ...(finalSetupData.birthDate ? { birthDate: finalSetupData.birthDate.toISOString() } : {}),
        gender: finalSetupData.gender,
        interestedIn: finalSetupData.interestedIn,
        ...(photosStepIncluded && finalSetupData.photos?.length > 0
          ? {
              photos: finalSetupData.photos.map(p => p.id || p.url || p),
            }
          : {}),
        location: finalSetupData.location,
        latitude: finalSetupData.latitude,
        longitude: finalSetupData.longitude,
      };

      Logger.info('📤 Sending to complete-setup endpoint:', completeData);
      const response = await ApiDataService.completeProfileSetup(completeData);
      Logger.info('📤 Complete-setup response:', response);

      // Handle both { success: true, data: ... } and direct data response
      const isSuccess = response?.success || (response && !response.error);
      const responseData = response?.data || response;

      if (isSuccess) {
        Logger.success('✅ Profile setup API call succeeded, closing modal');
        showToast('Profile setup complete!', 'success');

        // IMPORTANT: Close modal FIRST before any callbacks
        // This prevents the modal from staying open if onComplete has issues
        onClose();

        // Then trigger refresh and callback after modal animation completes
        setTimeout(() => {
          try {
            // Refresh user profile to get updated data
            if (refreshUserProfile) {
              refreshUserProfile();
            }
            // Call onComplete if provided
            if (onComplete) {
              onComplete(responseData);
            }
          } catch (callbackError) {
            // Don't show error - setup already succeeded and modal is closed
            Logger.warn('Post-completion callback error (setup succeeded):', callbackError);
          }
        }, 300); // 300ms to allow modal animation to complete
      } else {
        Logger.error('❌ Profile setup returned failure:', response);
        throw new Error(response?.message || 'Setup failed');
      }
    } catch (error) {
      Logger.error('Profile setup error:', error);
      const errorMessage = error?.message || 'Unknown error';
      showToast(`Setup failed: ${errorMessage}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [setupData, locationData, showToast, onComplete, onClose, refreshUserProfile, steps]);

  const handleNext = useCallback(async () => {
    const currentStepData = steps[currentStep];

    // Guard against undefined step
    if (!currentStepData) {
      Logger.warn('handleNext called with undefined step');
      return;
    }

    const currentStepKey = currentStepData.key;

    // Validate current step (skip validation if already filled from profile)
    if (currentStepKey === 'birthDate') {
      if (!setupData.birthDate) {
        showToast('Please select your birth date', 'error');
        return;
      }
      if (!isValidAge(setupData.birthDate)) {
        showToast('You must be between 18 and 100 years old', 'error');
        return;
      }
    }

    if (currentStepKey === 'gender' && !setupData.gender) {
      showToast('Please select your gender', 'error');
      return;
    }

    if (currentStepKey === 'interestedIn' && setupData.interestedIn.length === 0) {
      showToast("Please select who you're interested in", 'error');
      return;
    }

    if (currentStepKey === 'photos' && setupData.photos.length === 0) {
      showToast('Please add at least one photo', 'error');
      return;
    }

    if (currentStepKey === 'location' && !setupData.location) {
      // Location is still being detected, don't show error yet
      if (!loading) {
        showToast('Please allow location access', 'error');
      }
      return;
    }

    // Save current step data before moving to next
    Logger.info('💾 Saving step data for:', currentStepKey);
    Logger.info('Current setupData.photos:', setupData.photos);
    setLoading(true);
    const savedData = await saveStepData(currentStepKey);
    setLoading(false);
    Logger.info('💾 Step data saved:', {
      currentStepKey,
      savedData: !!savedData,
      savedPhotos: savedData?.photos,
    });

    // Update setupData with uploaded photos if we just uploaded them
    if (currentStepKey === 'photos' && savedData?.photos) {
      setSetupData(prev => ({
        ...prev,
        photos: savedData.photos,
      }));
    }

    if (currentStep < steps.length - 1) {
      // Simply move to the next step (all steps in the array are needed)
      Logger.info('📱 Moving to next step:', {
        fromStep: currentStepKey,
        toStep: steps[currentStep + 1]?.key,
        photosInSetupData: setupData.photos?.length || 0,
        photos: setupData.photos,
      });
      setCurrentStep(currentStep + 1);
    } else {
      // This was the last step, complete the setup
      // If we just uploaded photos, we need to use the updated data
      if (currentStepKey === 'photos' && savedData?.photos) {
        // Pass the uploaded photos directly to handleComplete
        handleCompleteWithPhotos(savedData.photos);
      } else {
        handleComplete();
      }
    }
  }, [
    currentStep,
    setupData,
    showToast,
    steps,
    handleComplete,
    handleCompleteWithPhotos,
    saveStepData,
    loading,
    isValidAge,
  ]);

  const renderStepContent = () => {
    const step = steps[currentStep];

    // Guard against undefined step (can happen during state transitions)
    if (!step) {
      return (
        <View style={styles.stepContent}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      );
    }

    // Default date for picker (18 years ago)
    const defaultDate = new Date();
    defaultDate.setFullYear(defaultDate.getFullYear() - 25);

    // Min date (100 years ago)
    const minDate = new Date();
    minDate.setFullYear(minDate.getFullYear() - 100);

    // Max date (18 years ago)
    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() - 18);

    switch (step.key) {
      case 'birthDate':
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>When's your birthday?</Text>
            <Text style={styles.helperText}>You must be at least 18 years old</Text>

            {Platform.OS === 'android' && !showDatePicker && (
              <TouchableOpacity
                style={styles.datePickerButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar" size={24} color={theme.colors.primary} />
                <Text style={styles.datePickerButtonText}>
                  {setupData.birthDate
                    ? setupData.birthDate.toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : 'Select your birthday'}
                </Text>
              </TouchableOpacity>
            )}

            {(Platform.OS === 'ios' || showDatePicker) && (
              <View style={styles.datePickerContainer}>
                <DateTimePicker
                  value={setupData.birthDate || defaultDate}
                  mode="date"
                  display="spinner"
                  onChange={handleBirthDateChange}
                  minimumDate={minDate}
                  maximumDate={maxDate}
                  style={styles.datePicker}
                />
              </View>
            )}
          </View>
        );

      case 'gender':
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>What's your gender?</Text>
            <View style={styles.optionsContainer}>
              {['MAN', 'WOMAN', 'OTHER'].map(option => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.optionButton,
                    setupData.gender === option && styles.optionButtonSelected,
                  ]}
                  onPress={() => handleGenderSelect(option)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      setupData.gender === option && styles.optionTextSelected,
                    ]}
                  >
                    {option.charAt(0) + option.slice(1).toLowerCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case 'interestedIn':
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Who are you interested in?</Text>
            <View style={styles.optionsContainer}>
              {['MAN', 'WOMAN', 'OTHER'].map(option => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.optionButton,
                    setupData.interestedIn.includes(option) && styles.optionButtonSelected,
                  ]}
                  onPress={() => handleInterestedInToggle(option)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      setupData.interestedIn.includes(option) && styles.optionTextSelected,
                    ]}
                  >
                    {option === 'MAN' ? 'Men' : 'Women'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.helperText}>Select all that apply</Text>
          </View>
        );

      case 'photos':
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Add your photos</Text>
            <Text style={styles.helperText}>Add at least 1 photo to continue</Text>

            <View style={styles.photosGrid}>
              {setupData.photos.map((photo, index) => (
                <View key={index} style={styles.photoContainer}>
                  <Image source={{ uri: photo.uri || photo.url || photo }} style={styles.photo} />
                  <TouchableOpacity
                    style={styles.removePhotoButton}
                    onPress={() => {
                      setSetupData(prev => ({
                        ...prev,
                        photos: prev.photos.filter((_, i) => i !== index),
                      }));
                    }}
                  >
                    <Ionicons
                      name="close-circle"
                      size={theme.icons.md}
                      color={theme.colors.status.error}
                    />
                  </TouchableOpacity>
                </View>
              ))}

              {setupData.photos.length < 6 && (
                <TouchableOpacity
                  style={styles.addPhotoButton}
                  onPress={handlePhotoSelect}
                  disabled={uploadingPhotos}
                >
                  <Ionicons name="add" size={40} color={theme.colors.primary} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        );

      case 'location':
        return (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>
              {setupData.location ? 'Location detected!' : 'Finding your location'}
            </Text>
            <Text style={styles.helperText}>
              {setupData.location
                ? "We'll use this to show you matches nearby"
                : 'We need your location to show you potential matches nearby'}
            </Text>

            {setupData.location ? (
              <>
                <View style={styles.locationContainer}>
                  <Ionicons name="location" size={24} color={theme.colors.primary} />
                  <Text style={styles.locationText}>{setupData.location}</Text>
                </View>
                <Text style={styles.locationAutoProgressText}>Continuing automatically...</Text>
              </>
            ) : (
              <View style={styles.locationLoadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.locationLoadingText}>Detecting your location...</Text>
              </View>
            )}
          </View>
        );

      default:
        return null;
    }
  };

  // Don't render modal if there are no missing steps (after steps are calculated)
  if (!stepsLoading && steps.length === 0) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        {/* Backdrop - tap to dismiss */}
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={theme.icons.md} color={theme.colors.text.secondary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Complete Your Profile</Text>
            <View style={{ width: 40 }} />
          </View>

          <Text style={styles.headerSubtitle}>Help others discover you better</Text>

          <View style={styles.progressContainer}>
            {steps.map((_, index) => (
              <View
                key={index}
                style={[styles.progressDot, index <= currentStep && styles.progressDotActive]}
              />
            ))}
          </View>

          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.scrollContentContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={true}
          >
            {stepsLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text style={styles.loadingText}>Loading...</Text>
              </View>
            ) : (
              renderStepContent()
            )}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <View style={styles.footerLeft}>
              {currentStep > 0 ? (
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => setCurrentStep(currentStep - 1)}
                >
                  <Text style={styles.backButtonText}>Back</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.skipButton} onPress={onClose}>
                  <Text style={styles.skipButtonText}>Skip for now</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={[styles.nextButton, (loading || uploadingPhotos) && styles.nextButtonDisabled]}
              onPress={handleNext}
              disabled={loading || uploadingPhotos}
            >
              {loading || uploadingPhotos ? (
                <ActivityIndicator color={theme.colors.text.white} />
              ) : (
                <Text style={styles.nextButtonText}>
                  {currentStep === steps.length - 1 ? 'Finish Setup' : 'Next'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.colors.overlay.medium,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  container: {
    backgroundColor: theme.colors.background.primary,
    borderTopLeftRadius: theme.borderRadius.xxl,
    borderTopRightRadius: theme.borderRadius.xxl,
    maxHeight: '92%',
    minHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.xl,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 15,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.xxl,
    backgroundColor: theme.colors.gray[100],
  },
  headerTitle: {
    fontSize: theme.typography.sizes.xxl,
    fontWeight: theme.typography.weights.bold,
    fontFamily: theme.typography.fontFamily.heading,
    color: theme.colors.text.primary,
  },
  headerSubtitle: {
    fontSize: theme.typography.sizes.md,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.xl,
    marginTop: -10,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: theme.spacing.xl,
    gap: 10,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.gray[300],
  },
  progressDotActive: {
    backgroundColor: theme.colors.primary,
    width: 28,
  },
  content: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingHorizontal: 25,
    paddingTop: 10,
    paddingBottom: theme.spacing.xl,
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  loadingText: {
    marginTop: 15,
    fontSize: theme.typography.sizes.lg,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.secondary,
  },
  stepContent: {
    paddingTop: 10,
  },
  stepTitle: {
    fontSize: theme.typography.sizes.huge,
    fontWeight: '800',
    fontFamily: theme.typography.fontFamily.display,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
    color: theme.colors.gray[900],
  },
  helperText: {
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.gray[600],
    textAlign: 'center',
    marginTop: theme.spacing.sm,
    lineHeight: 22,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 35,
    padding: 18,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 2,
    borderColor: theme.colors.gray[200],
    backgroundColor: theme.colors.gray[50],
    gap: theme.spacing.md,
  },
  datePickerButtonText: {
    fontSize: 17,
    fontWeight: theme.typography.weights.semibold,
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.gray[700],
  },
  datePickerContainer: {
    marginTop: 25,
    alignItems: 'center',
    backgroundColor: theme.colors.gray[50],
    borderRadius: theme.borderRadius.xl,
    padding: 10,
  },
  datePicker: {
    width: '100%',
    height: 180,
  },
  optionsContainer: {
    marginTop: 35,
    gap: theme.spacing.md,
  },
  optionButton: {
    padding: 18,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 2,
    borderColor: theme.colors.gray[200],
    alignItems: 'center',
    backgroundColor: theme.colors.gray[50],
  },
  optionButtonSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: `${theme.colors.primary}08`,
  },
  optionText: {
    fontSize: 17,
    fontWeight: theme.typography.weights.semibold,
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.gray[700],
  },
  optionTextSelected: {
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.bold,
    fontFamily: theme.typography.fontFamily.bold,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
    marginTop: 35,
    justifyContent: 'center',
  },
  photoContainer: {
    width: 100,
    height: 133,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    position: 'relative',
    ...theme.shadows.small,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  removePhotoButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: theme.borderRadius.lg,
  },
  addPhotoButton: {
    width: 100,
    height: 133,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${theme.colors.primary}08`,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.huge,
    padding: theme.spacing.xl,
    backgroundColor: `${theme.colors.primary}08`,
    borderRadius: theme.borderRadius.xl,
    gap: 10,
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  locationText: {
    fontSize: 17,
    fontWeight: theme.typography.weights.semibold,
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.primary,
  },
  locationLoadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.huge,
    padding: 30,
  },
  locationLoadingText: {
    fontSize: theme.typography.sizes.lg,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.secondary,
    marginTop: 15,
  },
  locationAutoProgressText: {
    fontSize: theme.typography.sizes.md,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.muted,
    marginTop: 15,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: 15,
    paddingBottom: Platform.OS === 'ios' ? 30 : theme.spacing.xl,
    backgroundColor: theme.colors.background.primary,
  },
  footerLeft: {
    flex: 1,
  },
  backButton: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
  },
  backButtonText: {
    fontSize: theme.typography.sizes.lg,
    color: theme.colors.text.secondary,
    fontWeight: theme.typography.weights.medium,
    fontFamily: theme.typography.fontFamily.medium,
  },
  skipButton: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
  },
  skipButtonText: {
    fontSize: theme.typography.sizes.lg,
    color: theme.colors.text.muted,
    fontWeight: theme.typography.weights.medium,
    fontFamily: theme.typography.fontFamily.medium,
  },
  nextButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 50,
    paddingVertical: 15,
    borderRadius: 30,
    minWidth: 140,
    alignItems: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  nextButtonDisabled: {
    opacity: 0.5,
    shadowOpacity: 0.1,
  },
  nextButtonText: {
    color: theme.colors.text.white,
    fontSize: 17,
    fontWeight: theme.typography.weights.bold,
    fontFamily: theme.typography.fontFamily.bold,
  },
});

export default ProfileSetupModal;
