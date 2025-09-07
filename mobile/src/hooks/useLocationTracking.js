import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import ApiDataService from '../services/ApiDataService';
import Logger from '../utils/logger';
import { useAuth } from '../contexts/AuthContext';

/**
 * Hook to track user location and update it automatically
 * Similar to how Bumble/Tinder update location in the background
 */
export const useLocationTracking = (enabled = true, intervalMinutes = 5) => {
  const { user } = useAuth();
  const intervalRef = useRef(null);
  const lastLocationRef = useRef(null);

  const updateLocation = async () => {
    try {
      // Check if we have permission
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        Logger.debug('📍 Location permission not granted, skipping update');
        return;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = location.coords;

      // Check if location has changed significantly
      if (lastLocationRef.current) {
        const latDiff = Math.abs(latitude - lastLocationRef.current.latitude);
        const lonDiff = Math.abs(longitude - lastLocationRef.current.longitude);
        // 0.001 degrees is ~111 meters at equator, varies by latitude
        // This is a simple approximation - for production, use Haversine formula
        const threshold = 0.001;

        if (latDiff < threshold && lonDiff < threshold) {
          Logger.debug('📍 Location unchanged, skipping update');
          return;
        }
      }

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

        // Update location in database
        await ApiDataService.updateUserProfile({
          location: locationString,
          latitude,
          longitude,
          locationEnabled: true,
        });

        lastLocationRef.current = { latitude, longitude };
        Logger.info('📍 Location auto-updated:', locationString);
      }
    } catch (error) {
      Logger.debug('📍 Location update error:', error);
    }
  };

  useEffect(() => {
    if (!enabled || !user) {
      return;
    }

    // Initial location update
    updateLocation();

    // Set up interval for periodic updates
    intervalRef.current = setInterval(
      () => {
        updateLocation();
      },
      intervalMinutes * 60 * 1000
    );

    // Also update when app comes to foreground
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        updateLocation();
      }
    });

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      subscription?.remove();
    };
  }, [enabled, user, intervalMinutes]);

  return { updateLocation };
};
