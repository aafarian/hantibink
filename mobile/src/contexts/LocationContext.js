import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '../config/firebase';
import { useAuth } from './AuthContext';
import useUserLocation from '../hooks/useUserLocation';
import Logger from '../utils/logger';

const LocationContext = createContext();

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};

export const LocationProvider = ({ children }) => {
  const { user, userProfile, refreshUserProfile } = useAuth();
  const { location, status, fetchLocation } = useUserLocation();
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [hasAskedForLocation] = useState(false);

  // DISABLED: Location now required in onboarding - no automatic prompting
  // Check if we should show location prompt
  /* MOVED TO ONBOARDING STEP 1
  useEffect(() => {
    if (user && userProfile) {
      const hasLocation = userProfile.location || userProfile.coordinates;

      Logger.location('Checking location prompt conditions:', {
        hasLocation,
        userProfileLocation: userProfile.location,
        userProfileCoordinates: userProfile.coordinates,
        hasAskedForLocation,
      });

      // ONLY show location prompt if:
      // 1. User has NO location data at all
      // 2. We haven't asked them in this session
      // 3. This should mainly be for brand new users who skipped location during onboarding
      const shouldPrompt = !hasLocation && !hasAskedForLocation;

      if (shouldPrompt) {
        Logger.location('User has no location data - showing prompt');
        setTimeout(() => {
          setShowLocationPrompt(true);
          setHasAskedForLocation(true);
        }, 1000);
      } else if (hasLocation) {
        Logger.location('User already has location data - no prompt needed');
      }
    }
  }, [user, userProfile, hasAskedForLocation]);
  */

  // DISABLED: Auto-save location (causes infinite loops)
  // Location is saved during registration and can be updated manually
  // useEffect(() => {
  //   if (location && user && userProfile) {
  //     saveLocationToProfile(location);
  //   }
  // }, [location, user, userProfile, saveLocationToProfile]);

  const saveLocationToProfile = useCallback(
    async locationData => {
      try {
        // Get user ID from AuthContext or Firebase Auth (for registration flow)
        const userId = user?.uid || getAuth().currentUser?.uid;

        if (!userId) {
          Logger.location('No authenticated user found - skipping location save');
          return;
        }

        await updateDoc(doc(db, 'users', userId), {
          location: locationData.cityName,
          coordinates: {
            latitude: locationData.latitude,
            longitude: locationData.longitude,
          },
          locationTimestamp: locationData.timestamp,
          locationSource: locationData.source,
        });
        Logger.location('Location saved to profile:', locationData.cityName);

        // Refresh the user profile in AuthContext to show the updated location
        if (refreshUserProfile) {
          await refreshUserProfile();
        }
      } catch (error) {
        Logger.error('Error saving location to profile:', error);
      }
    },
    [user, refreshUserProfile]
  );

  const updateSelectedLocation = async newLocationName => {
    // Only save when user is fully logged in (in AuthContext)
    // During registration, location is saved as part of profile creation
    if (location && user && userProfile) {
      const updatedLocation = {
        ...location,
        cityName: newLocationName,
      };

      // Save immediately to Firestore
      await saveLocationToProfile(updatedLocation);

      Logger.location('Location updated to:', newLocationName);
    } else {
      // During registration, just log - location will be saved with profile
      Logger.location('Location selected during registration:', newLocationName);
    }
  };

  const handleLocationPromptComplete = () => {
    setShowLocationPrompt(false);
  };

  const requestLocationAgain = () => {
    setShowLocationPrompt(true);
  };

  const value = {
    location,
    status,
    fetchLocation,
    showLocationPrompt,
    handleLocationPromptComplete,
    requestLocationAgain,
    updateSelectedLocation,
    hasAskedForLocation,
  };

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
};

export default LocationContext;
