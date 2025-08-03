import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
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
  const { user, userProfile } = useAuth();
  const { location, status, fetchLocation } = useUserLocation();
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [hasAskedForLocation, setHasAskedForLocation] = useState(false);

  // Check if we should show location prompt
  useEffect(() => {
    if (user && userProfile) {
      // Show location prompt if:
      // 1. User doesn't have location set in their profile
      // 2. We haven't asked them before in this session
      // 3. Their account is new (optional - you can add a timestamp check)

      const hasLocation = userProfile.location || userProfile.coordinates;
      const shouldPrompt = !hasLocation && !hasAskedForLocation;

      if (shouldPrompt) {
        // Small delay to let the main app render first
        setTimeout(() => {
          setShowLocationPrompt(true);
          setHasAskedForLocation(true);
        }, 1000);
      }
    }
  }, [user, userProfile, hasAskedForLocation]);

  // Save location to user profile when obtained
  useEffect(() => {
    if (location && user) {
      saveLocationToProfile(location);
    }
  }, [location, user, saveLocationToProfile]);

  const saveLocationToProfile = useCallback(
    async locationData => {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          location: locationData.cityName,
          coordinates: {
            latitude: locationData.latitude,
            longitude: locationData.longitude,
          },
          locationTimestamp: locationData.timestamp,
          locationSource: locationData.source,
        });
        Logger.location('Location saved to profile:', locationData.cityName);
      } catch (error) {
        console.error('Error saving location to profile:', error);
      }
    },
    [user]
  );

  const updateSelectedLocation = async newLocationName => {
    if (location && user) {
      const updatedLocation = {
        ...location,
        cityName: newLocationName,
      };

      // Save immediately to Firestore
      await saveLocationToProfile(updatedLocation);

      // This will trigger the useEffect to save to profile
      Logger.location('Location updated to:', newLocationName);
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
