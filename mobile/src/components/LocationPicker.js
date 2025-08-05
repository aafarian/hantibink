import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocation } from '../contexts/LocationContext';
import Logger from '../utils/logger';

/**
 * Reusable location picker component that can be used in registration or anywhere
 * Uses the existing location system but with custom callbacks
 */
const LocationPicker = ({
  onLocationSelected,
  currentLocation = '',
  placeholder = 'Select Location',
  required = false,
  error = null,
  style = {},
}) => {
  const insets = useSafeAreaInsets();
  const { location, status, fetchLocation, updateSelectedLocation } = useLocation();

  const [showModal, setShowModal] = useState(false);
  const [localLocation, setLocalLocation] = useState(null);

  // Update local location when context location changes
  useEffect(() => {
    if (location) {
      setLocalLocation(location);
    }
  }, [location]);

  // Auto-close modal and return location when successfully fetched
  useEffect(() => {
    if (showModal && status === 'success' && localLocation) {
      if (!localLocation.hasMultipleOptions) {
        // Auto-select single option
        const timeoutId = setTimeout(() => {
          handleLocationConfirm();
        }, 1500);

        return () => clearTimeout(timeoutId);
      }
    }
  }, [showModal, status, localLocation, handleLocationConfirm]);
  const handleOpenLocationPicker = () => {
    setShowModal(true);
    fetchLocation(); // Start fetching location when modal opens
  };

  const handleLocationConfirm = useCallback(async () => {
    if (localLocation) {
      const locationName = localLocation.cityName;
      Logger.location('Location selected in picker:', locationName);

      // Update the location context (saves to profile if user is logged in)
      if (updateSelectedLocation) {
        await updateSelectedLocation(locationName);
      }

      // Notify parent component
      if (onLocationSelected) {
        onLocationSelected(locationName, localLocation);
      }

      setShowModal(false);
    }
  }, [localLocation, updateSelectedLocation, onLocationSelected]);

  const handleCancel = () => {
    setShowModal(false);
  };

  const renderLocationStatus = () => {
    switch (status) {
      case 'fetching':
        return (
          <View style={styles.statusContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.statusText}>Getting your location...</Text>
          </View>
        );

      case 'success':
        return (
          <View style={styles.statusContainer}>
            <MaterialIcons name="check-circle" size={48} color="#4CAF50" />
            <Text style={styles.statusText}>Location found!</Text>
            <Text style={styles.locationText}>{localLocation?.cityName}</Text>
            {localLocation?.hasMultipleOptions && (
              <View style={styles.locationOptionsContainer}>
                <Text style={styles.optionsTitle}>Choose your preferred location:</Text>
                {localLocation.locationOptions?.map((option, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.locationOption,
                      option.primary === localLocation.cityName && styles.selectedLocationOption,
                    ]}
                    onPress={() => {
                      setLocalLocation({
                        ...localLocation,
                        cityName: option.primary,
                      });
                    }}
                  >
                    <Text
                      style={[
                        styles.locationOptionText,
                        option.primary === localLocation.cityName &&
                          styles.selectedLocationOptionText,
                      ]}
                    >
                      {option.primary}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <Text style={styles.subtitle}>Perfect! We'll show you people nearby.</Text>
          </View>
        );

      case 'permission_denied':
        return (
          <View style={styles.statusContainer}>
            <MaterialIcons name="location-off" size={48} color="#FF6B6B" />
            <Text style={styles.statusText}>Location access denied</Text>
            <Text style={styles.subtitle}>
              Please enable location access in your device settings to continue.
            </Text>
          </View>
        );

      case 'error':
        return (
          <View style={styles.statusContainer}>
            <MaterialIcons name="error" size={48} color="#FF6B6B" />
            <Text style={styles.statusText}>Unable to get location</Text>
            <Text style={styles.subtitle}>
              Please check your internet connection and try again.
            </Text>
          </View>
        );

      default:
        return (
          <View style={styles.statusContainer}>
            <MaterialIcons name="location-on" size={48} color="#007AFF" />
            <Text style={styles.statusText}>Find your location</Text>
            <Text style={styles.subtitle}>
              We'll use your location to show you people nearby and enhance your experience.
            </Text>
          </View>
        );
    }
  };

  const renderActions = () => {
    if (status === 'success') {
      return (
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.secondaryButton} onPress={handleCancel}>
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryButton} onPress={handleLocationConfirm}>
            <Text style={styles.primaryButtonText}>Use This Location</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (status === 'fetching') {
      return null; // No actions while loading
    }

    return (
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.secondaryButton} onPress={handleCancel}>
          <Text style={styles.secondaryButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={fetchLocation}
          disabled={status === 'fetching'}
        >
          <Text style={styles.primaryButtonText}>
            {status === 'permission_denied' || status === 'error' ? 'Try Again' : 'Get Location'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <>
      {/* Location Input Button */}
      <TouchableOpacity
        style={[styles.locationButton, error && styles.locationButtonError, style]}
        onPress={handleOpenLocationPicker}
      >
        <MaterialIcons name="location-on" size={20} color="#666" />
        <Text
          style={currentLocation ? styles.locationButtonText : styles.locationButtonPlaceholder}
        >
          {currentLocation || placeholder}
          {required ? ' *' : ''}
        </Text>
        <MaterialIcons name="keyboard-arrow-down" size={24} color="#666" />
      </TouchableOpacity>

      {/* Location Selection Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCancel}
      >
        <View style={[styles.container, { paddingTop: insets.top }]}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Select Location</Text>
          </View>

          <View style={styles.content}>{renderLocationStatus()}</View>

          <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
            {renderActions()}
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  // Button styles
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
  },
  locationButtonError: {
    borderColor: '#FF6B6B',
  },
  locationButtonText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#333',
  },
  locationButtonPlaceholder: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#999',
  },

  // Modal styles
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  // Status styles
  statusContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  locationText: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 8,
    color: '#333',
  },

  // Location options
  locationOptionsContainer: {
    marginTop: 20,
    width: '100%',
  },
  optionsTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 10,
    textAlign: 'center',
  },
  locationOption: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginVertical: 4,
  },
  selectedLocationOption: {
    backgroundColor: '#007AFF',
  },
  locationOptionText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#333',
  },
  selectedLocationOptionText: {
    color: 'white',
    fontWeight: '500',
  },

  // Buttons
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default LocationPicker;
