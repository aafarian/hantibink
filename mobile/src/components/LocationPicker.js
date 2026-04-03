import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocation } from '../contexts/LocationContext';
import Logger from '../utils/logger';
import { theme } from '../styles/theme';

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
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.statusText}>Getting your location...</Text>
          </View>
        );

      case 'success':
        return (
          <View style={styles.statusContainer}>
            <MaterialIcons name="check-circle" size={48} color={theme.colors.status.success} />
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
            <MaterialIcons name="location-off" size={48} color={theme.colors.primary} />
            <Text style={styles.statusText}>Location access denied</Text>
            <Text style={styles.subtitle}>
              Please enable location access in your device settings to continue.
            </Text>
          </View>
        );

      case 'error':
        return (
          <View style={styles.statusContainer}>
            <MaterialIcons name="error" size={48} color={theme.colors.primary} />
            <Text style={styles.statusText}>Unable to get location</Text>
            <Text style={styles.subtitle}>
              Please check your internet connection and try again.
            </Text>
          </View>
        );

      default:
        return (
          <View style={styles.statusContainer}>
            <MaterialIcons name="location-on" size={48} color={theme.colors.primary} />
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
        <MaterialIcons name="location-on" size={20} color={theme.colors.gray[600]} />
        <Text
          style={currentLocation ? styles.locationButtonText : styles.locationButtonPlaceholder}
        >
          {currentLocation || placeholder}
          {required ? ' *' : ''}
        </Text>
        <MaterialIcons name="keyboard-arrow-down" size={24} color={theme.colors.gray[600]} />
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
    backgroundColor: theme.colors.background.primary,
    borderWidth: 1,
    borderColor: theme.colors.gray[300],
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    minHeight: 48,
  },
  locationButtonError: {
    borderColor: theme.colors.primary,
  },
  locationButtonText: {
    flex: 1,
    marginLeft: theme.spacing.sm,
    fontSize: theme.typography.sizes.lg,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.primary,
  },
  locationButtonPlaceholder: {
    flex: 1,
    marginLeft: theme.spacing.sm,
    fontSize: theme.typography.sizes.lg,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.gray[500],
  },

  // Modal styles
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  header: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray[200],
  },
  headerTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.semibold,
    fontFamily: theme.typography.fontFamily.semibold,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  footer: {
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xl,
  },

  // Status styles
  statusContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  statusText: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.semibold,
    fontFamily: theme.typography.fontFamily.semibold,
    marginTop: theme.spacing.lg,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: theme.typography.sizes.md,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.gray[600],
    marginTop: theme.spacing.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  locationText: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.medium,
    fontFamily: theme.typography.fontFamily.medium,
    marginTop: theme.spacing.sm,
    color: theme.colors.text.primary,
  },

  // Location options
  locationOptionsContainer: {
    marginTop: theme.spacing.xl,
    width: '100%',
  },
  optionsTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.medium,
    fontFamily: theme.typography.fontFamily.medium,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  locationOption: {
    backgroundColor: theme.colors.gray[100],
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginVertical: theme.spacing.xs,
  },
  selectedLocationOption: {
    backgroundColor: theme.colors.primary,
  },
  locationOptionText: {
    fontSize: theme.typography.sizes.lg,
    fontFamily: theme.typography.fontFamily.regular,
    textAlign: 'center',
    color: theme.colors.text.primary,
  },
  selectedLocationOptionText: {
    color: theme.colors.text.white,
    fontWeight: theme.typography.weights.medium,
    fontFamily: theme.typography.fontFamily.medium,
  },

  // Buttons
  buttonContainer: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: theme.colors.text.white,
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    fontFamily: theme.typography.fontFamily.semibold,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: theme.colors.gray[100],
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: theme.colors.text.primary,
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.medium,
    fontFamily: theme.typography.fontFamily.medium,
  },
});

export default LocationPicker;
