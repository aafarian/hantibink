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
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import ApiDataService from '../../services/ApiDataService';
import Logger from '../../utils/logger';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { uploadImageToFirebase } from '../../utils/imageUpload';

const ProfileSetupModal = ({ visible, onClose, onComplete, userProfile }) => {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [hasDetectedLocation, setHasDetectedLocation] = useState(false);
  const autoProgressionTimerRef = useRef(null);
  const [steps, setSteps] = useState([]); // Move this up before useEffects that depend on it
  const [setupData, setSetupData] = useState({
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

  // Build steps when modal becomes visible
  useEffect(() => {
    // Only recalculate steps when modal becomes visible
    if (visible && userProfile) {
      const buildSteps = async () => {
        const missingSteps = [];

        // Check what's missing and add only those steps
        if (!userProfile.gender) {
          missingSteps.push({ title: 'Your Gender', key: 'gender' });
        }

        if (!userProfile.interestedIn || userProfile.interestedIn.length === 0) {
          missingSteps.push({ title: 'Interested In', key: 'interestedIn' });
        }

        if (!userProfile.photos || userProfile.photos.length === 0) {
          missingSteps.push({ title: 'Add Photos', key: 'photos' });
        }

        // Check if we need location step - based on permissions, not stored location
        // This handles the case where user revokes permissions later
        try {
          const { status } = await Location.getForegroundPermissionsAsync();
          if (status !== 'granted') {
            // Permissions not granted, need to show location step
            Logger.info('📍 Location permissions not granted, adding location step');
            missingSteps.push({ title: 'Your Location', key: 'location' });
          } else if (!userProfile.location || !userProfile.latitude || !userProfile.longitude) {
            // Permissions granted but no location stored - try to get it silently
            Logger.info(
              '📍 Location permissions granted but no location stored, getting location silently...'
            );

            try {
              const location = await Location.getCurrentPositionAsync({});
              const { latitude, longitude } = location.coords;

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

                // Update both location states
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
                  Logger.success('📍 Location obtained and saved silently:', locationString);
                } catch (error) {
                  Logger.error('Failed to update location:', error);
                }
              } else {
                // Couldn't get location details, add the step
                Logger.warn('📍 Could not reverse geocode location');
                missingSteps.push({ title: 'Your Location', key: 'location' });
              }
            } catch (error) {
              Logger.warn('📍 Could not get current position:', error);
              // Add location step as fallback
              missingSteps.push({ title: 'Your Location', key: 'location' });
            }
          }
          // If permissions are granted AND location is stored, we don't need the step
        } catch (error) {
          Logger.warn('Could not check location permissions:', error);
          // Add location step as fallback
          missingSteps.push({ title: 'Your Location', key: 'location' });
        }

        setSteps(missingSteps);
        setCurrentStep(0); // Reset to first step when modal opens
      };

      buildSteps();
    }
  }, [visible, userProfile]); // Include userProfile in dependencies

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
                        user?.uid || 'temp',
                        `photo_${Date.now()}_${i}`
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

                // Also save to API immediately
                Logger.info('💾 Saving uploaded photos to API...');
                for (let i = 0; i < uploadedPhotos.length; i++) {
                  const photo = uploadedPhotos[i];
                  if (photo.url) {
                    try {
                      await ApiDataService.addUserPhoto(photo.url, i === 0);
                      Logger.success(`✅ Photo ${i + 1} saved to API`);
                    } catch (error) {
                      Logger.error(`Failed to save photo ${i + 1} to API:`, error);
                    }
                  }
                }

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
    [setupData, user, showToast]
  );

  const handleCompleteWithPhotos = useCallback(
    async uploadedPhotos => {
      try {
        setLoading(true);

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
          photosCount: finalSetupData.photos.length,
          location: finalSetupData.location,
          latitude: finalSetupData.latitude,
          longitude: finalSetupData.longitude,
        });

        // Final save with all data to ensure completeness
        const completeData = {
          gender: finalSetupData.gender,
          interestedIn: finalSetupData.interestedIn,
          photos: finalSetupData.photos.map(p => p.id || p.url || p),
          location: finalSetupData.location,
          latitude: finalSetupData.latitude,
          longitude: finalSetupData.longitude,
        };

        Logger.info('📤 Sending to complete-setup endpoint:', completeData);
        const response = await ApiDataService.completeProfileSetup(completeData);

        if (response.success) {
          showToast('Profile setup complete!', 'success');
          // Don't refresh immediately - let the ProfileScreen handle it on focus
          // This avoids rate limiting issues
          onComplete(response.data);
        } else {
          throw new Error(response.message || 'Setup failed');
        }
      } catch (error) {
        Logger.error('Profile setup error:', error);
        showToast('Failed to complete setup', 'error');
      } finally {
        setLoading(false);
      }
    },
    [setupData, locationData, showToast, onComplete]
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
        const hasUnuploadedPhotos = finalSetupData.photos.some(photo => photo.uri && !photo.url);
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
          ? finalSetupData.photos.length
          : 'N/A (user already has photos)',
        photos: photosStepIncluded ? finalSetupData.photos : 'N/A (user already has photos)',
        location: finalSetupData.location,
        latitude: finalSetupData.latitude,
        longitude: finalSetupData.longitude,
      });

      // Final save with all data to ensure completeness
      // Only include photos if the photos step was part of this setup
      const completeData = {
        gender: finalSetupData.gender,
        interestedIn: finalSetupData.interestedIn,
        ...(photosStepIncluded && finalSetupData.photos.length > 0
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

      Logger.info('📍 API response:', response);

      if (response.success) {
        showToast('Profile setup complete!', 'success');
        // Don't refresh immediately - let the ProfileScreen handle it on focus
        // This avoids rate limiting issues
        Logger.info('📍 Calling onComplete to close modal...');
        onComplete(response.data);
        Logger.info('📍 onComplete called successfully');
      } else {
        throw new Error(response.message || 'Setup failed');
      }
    } catch (error) {
      Logger.error('Profile setup error:', error);
      showToast('Failed to complete setup', 'error');
    } finally {
      setLoading(false);
    }
  }, [setupData, locationData, showToast, onComplete, steps]);

  const handleNext = useCallback(async () => {
    const currentStepKey = steps[currentStep].key;

    // Validate current step (skip validation if already filled from profile)
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
  ]);

  const renderStepContent = () => {
    const step = steps[currentStep];

    switch (step.key) {
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
              {['MAN', 'WOMAN'].map(option => (
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
                    <Ionicons name="close-circle" size={24} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              ))}

              {setupData.photos.length < 6 && (
                <TouchableOpacity
                  style={styles.addPhotoButton}
                  onPress={handlePhotoSelect}
                  disabled={uploadingPhotos}
                >
                  <Ionicons name="add" size={40} color="#FF6B6B" />
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
                  <Ionicons name="location" size={24} color="#FF6B6B" />
                  <Text style={styles.locationText}>{setupData.location}</Text>
                </View>
                <Text style={styles.locationAutoProgressText}>Continuing automatically...</Text>
              </>
            ) : (
              <View style={styles.locationLoadingContainer}>
                <ActivityIndicator size="large" color="#FF6B6B" />
                <Text style={styles.locationLoadingText}>Detecting your location...</Text>
              </View>
            )}
          </View>
        );

      default:
        return null;
    }
  };

  // Don't render modal if there are no missing steps
  if (steps.length === 0) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#666" />
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

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {renderStepContent()}
        </ScrollView>

        <View style={styles.footer}>
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
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.nextButtonText}>
                {currentStep === steps.length - 1 ? 'Finish Setup' : 'Next'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 15,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 20,
    marginTop: -10,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    gap: 10,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E5E5',
  },
  progressDotActive: {
    backgroundColor: '#FF6B6B',
    width: 28,
  },
  content: {
    flex: 1,
    paddingHorizontal: 25,
    paddingTop: 10,
  },
  stepContent: {
    paddingTop: 10,
  },
  stepTitle: {
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
    color: '#1A1A1A',
  },
  helperText: {
    fontSize: 15,
    color: '#777',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  optionsContainer: {
    marginTop: 35,
    gap: 12,
  },
  optionButton: {
    padding: 18,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#F0F0F0',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  optionButtonSelected: {
    borderColor: '#FF6B6B',
    backgroundColor: '#FFF5F5',
  },
  optionText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#444',
  },
  optionTextSelected: {
    color: '#FF6B6B',
    fontWeight: '700',
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 35,
    justifyContent: 'center',
  },
  photoContainer: {
    width: 100,
    height: 133,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
    borderRadius: 12,
  },
  addPhotoButton: {
    width: 100,
    height: 133,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FF6B6B',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF5F5',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
    padding: 20,
    backgroundColor: '#FFF5F5',
    borderRadius: 16,
    gap: 10,
    borderWidth: 2,
    borderColor: '#FF6B6B',
  },
  locationText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FF6B6B',
  },
  locationLoadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
    padding: 30,
  },
  locationLoadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 15,
  },
  locationAutoProgressText: {
    fontSize: 14,
    color: '#999',
    marginTop: 15,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    backgroundColor: '#FFF',
  },
  footerLeft: {
    flex: 1,
  },
  backButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  skipButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  skipButtonText: {
    fontSize: 16,
    color: '#999',
    fontWeight: '500',
  },
  nextButton: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 50,
    paddingVertical: 15,
    borderRadius: 30,
    minWidth: 140,
    alignItems: 'center',
    shadowColor: '#FF6B6B',
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
    color: '#FFF',
    fontSize: 17,
    fontWeight: '700',
  },
});

export default ProfileSetupModal;
