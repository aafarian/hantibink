import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocation } from '../contexts/LocationContext';
import Logger from '../utils/logger';

const LocationPromptModal = () => {
  const insets = useSafeAreaInsets();
  const {
    location,
    status,
    fetchLocation,
    showLocationPrompt,
    handleLocationPromptComplete,
    updateSelectedLocation,
  } = useLocation();

  const [localLocation, setLocalLocation] = React.useState(location);

  const handleEnableLocation = async () => {
    await fetchLocation();
  };

  // Update local location when context location changes
  React.useEffect(() => {
    setLocalLocation(location);
  }, [location]);

  // Auto-close on successful location fetch (only if no multiple options)
  React.useEffect(() => {
    if (status === 'success' && localLocation && !localLocation.hasMultipleOptions) {
      // Small delay to show success state
      setTimeout(() => {
        handleLocationPromptComplete();
      }, 1500);
    }
  }, [status, localLocation, handleLocationPromptComplete]);

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
                      // Update selected location
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
            <MaterialIcons name="location-off" size={48} color="#FF9800" />
            <Text style={styles.statusText}>Location permission denied</Text>
            <Text style={styles.subtitle}>
              Location is required to use the app. Please enable location permissions to continue.
            </Text>
          </View>
        );

      case 'error':
        return (
          <View style={styles.statusContainer}>
            <MaterialIcons name="error" size={48} color="#F44336" />
            <Text style={styles.statusText}>Couldn't get location</Text>
            <Text style={styles.subtitle}>
              Location is required to use the app. Please check your connection and try again.
            </Text>
          </View>
        );

      default:
        return (
          <View style={styles.statusContainer}>
            <MaterialIcons name="location-on" size={64} color="#007AFF" />
            <Text style={styles.title}>Find people near you</Text>
            <Text style={styles.subtitle}>
              Location is required to show you potential matches in your area. Your exact location
              is never shared - only your general city/region.
            </Text>
          </View>
        );
    }
  };

  const renderActions = () => {
    if (status === 'success') {
      return (
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={async () => {
            // Save the final selected location to context if user made changes
            if (localLocation && localLocation.cityName !== location?.cityName) {
              Logger.location('Saving user-selected location:', localLocation.cityName);
              await updateSelectedLocation(localLocation.cityName);
            }
            handleLocationPromptComplete();
          }}
        >
          <Text style={styles.primaryButtonText}>Continue</Text>
        </TouchableOpacity>
      );
    }

    if (status === 'fetching') {
      return null; // No actions while loading
    }

    return (
      <TouchableOpacity
        style={styles.primaryButton}
        onPress={handleEnableLocation}
        disabled={status === 'fetching'}
      >
        <Text style={styles.primaryButtonText}>
          {status === 'permission_denied' || status === 'error' ? 'Try Again' : 'Enable Location'}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={showLocationPrompt} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.content}>{renderLocationStatus()}</View>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
          {renderActions()}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  statusContainer: {
    alignItems: 'center',
    maxWidth: 300,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 10,
  },
  statusText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  locationText: {
    fontSize: 18,
    color: '#007AFF',
    fontWeight: '500',
    marginBottom: 8,
  },
  footer: {
    paddingHorizontal: 30,
  },

  primaryButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  locationOptionsContainer: {
    marginTop: 16,
    width: '100%',
    maxWidth: 300,
  },
  optionsTitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 12,
  },
  locationOption: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e1e5e9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedLocationOption: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  locationOptionText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  selectedLocationOptionText: {
    color: '#fff',
  },
});

export default LocationPromptModal;
