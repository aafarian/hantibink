import * as Location from 'expo-location';
import { useState } from 'react';
import Logger from '../utils/logger';

const useUserLocation = () => {
  const [location, setLocation] = useState(null);
  const [status, setStatus] = useState('idle');

  const requestPermission = async () => {
    const { status: permissionStatus } = await Location.requestForegroundPermissionsAsync();
    return permissionStatus === 'granted';
  };

  // Simplified reverse geocoding - Expo only, no Google fallback
  const reverseGeocode = async (latitude, longitude) => {
    Logger.location('Starting reverse geocoding for:', latitude, longitude);

    // Try Expo's built-in reverse geocoding first (more reliable)
    try {
      const address = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      // Log only city/region info for privacy, not full address
      const safeLog = address[0]
        ? {
            city: address[0].city,
            region: address[0].region,
            subregion: address[0].subregion,
            country: address[0].country,
          }
        : null;
      Logger.location('Expo reverse geocode result:', safeLog);

      if (address && address.length > 0) {
        const result = address[0];

        // Build location options from Expo result
        const locationOptions = [];

        if (result.city && result.region) {
          locationOptions.push({
            primary: `${result.city}, ${result.region}`,
            type: 'city',
            city: result.city,
            region: result.region,
          });
        }

        if (result.subregion && result.region && result.subregion !== result.city) {
          locationOptions.push({
            primary: `${result.subregion}, ${result.region}`,
            type: 'subregion',
            subregion: result.subregion,
            region: result.region,
          });
        }

        if (
          result.district &&
          result.region &&
          result.district !== result.city &&
          result.district !== result.subregion
        ) {
          locationOptions.push({
            primary: `${result.district}, ${result.region}`,
            type: 'district',
            district: result.district,
            region: result.region,
          });
        }

        // Return location options if available
        if (locationOptions.length > 0) {
          return {
            selected: locationOptions[0].primary,
            options: locationOptions,
            hasMultipleOptions: locationOptions.length > 1,
          };
        }
      }
    } catch (error) {
      Logger.warn('Expo reverse geocoding failed:', error);
    }

    // Simple fallback - just return coordinates
    return `Location: ${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
  };

  const fetchLocation = async () => {
    setStatus('fetching');

    try {
      const hasPermission = await requestPermission();
      if (!hasPermission) {
        setStatus('permission_denied');
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        maximumAge: 300000, // Use cached location if recent (5 minutes)
      });

      const { latitude, longitude } = position.coords;

      // Round coordinates for privacy (to ~1km accuracy)
      const roundedLat = Math.round(latitude * 100) / 100;
      const roundedLng = Math.round(longitude * 100) / 100;

      // Get location information from coordinates
      const locationInfo = await reverseGeocode(roundedLat, roundedLng);

      // Handle both simple string and object responses
      const cityName = typeof locationInfo === 'string' ? locationInfo : locationInfo.selected;
      const hasOptions = typeof locationInfo === 'object' && locationInfo.hasMultipleOptions;

      setLocation({
        latitude: roundedLat,
        longitude: roundedLng,
        cityName,
        locationOptions: typeof locationInfo === 'object' ? locationInfo.options : null,
        hasMultipleOptions: hasOptions,
        timestamp: Date.now(),
        source: 'device',
      });
      setStatus('success');
    } catch (error) {
      Logger.error('Location error:', error);
      setStatus('error');
    }
  };

  return {
    location,
    status,
    fetchLocation, // Call this on discovery open or post-onboarding
  };
};

export default useUserLocation;
