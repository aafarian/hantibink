import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocation } from '../contexts/LocationContext';
import Logger from '../utils/logger';
import { theme } from '../styles/theme';

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
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.statusText}>Getting your location...</Text>
          </View>
        );

      case 'success':
        return (
          <View style={styles.statusContainer}>
            <MaterialIcons
              name="check-circle"
              size={theme.icons.xl}
              color={theme.colors.status.success}
            />
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
            <MaterialIcons
              name="location-off"
              size={theme.icons.xl}
              color={theme.colors.status.warning}
            />
            <Text style={styles.statusText}>Location permission denied</Text>
            <Text style={styles.subtitle}>
              Location is required to use the app. Please enable location permissions to continue.
            </Text>
          </View>
        );

      case 'error':
        return (
          <View style={styles.statusContainer}>
            <MaterialIcons name="error" size={theme.icons.xl} color={theme.colors.status.error} />
            <Text style={styles.statusText}>Couldn't get location</Text>
            <Text style={styles.subtitle}>
              Location is required to use the app. Please check your connection and try again.
            </Text>
          </View>
        );

      default:
        return (
          <View style={styles.statusContainer}>
            <MaterialIcons name="location-on" size={theme.icons.xxl} color={theme.colors.primary} />
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
    backgroundColor: theme.colors.background.primary,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xxxl,
  },
  statusContainer: {
    alignItems: 'center',
    maxWidth: 300,
  },
  title: {
    fontSize: theme.typography.sizes.xxxl,
    fontWeight: theme.typography.weights.bold,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.text.primary,
    textAlign: 'center',
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.typography.sizes.lg,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: theme.spacing.sm,
  },
  statusText: {
    fontSize: theme.typography.sizes.xxl,
    fontWeight: theme.typography.weights.semibold,
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.text.primary,
    textAlign: 'center',
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  locationText: {
    fontSize: theme.typography.sizes.xl,
    color: theme.colors.secondary,
    fontWeight: theme.typography.weights.medium,
    fontFamily: theme.typography.fontFamily.medium,
    marginBottom: theme.spacing.sm,
  },
  footer: {
    paddingHorizontal: theme.spacing.xxxl,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: theme.colors.text.white,
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    fontFamily: theme.typography.fontFamily.semibold,
  },
  locationOptionsContainer: {
    marginTop: theme.spacing.lg,
    width: '100%',
    maxWidth: 300,
  },
  optionsTitle: {
    fontSize: theme.typography.sizes.md,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  locationOption: {
    backgroundColor: theme.colors.background.secondary,
    borderWidth: 1,
    borderColor: theme.colors.border.light,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedLocationOption: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  locationOptionText: {
    fontSize: theme.typography.sizes.lg,
    color: theme.colors.text.primary,
    fontWeight: theme.typography.weights.medium,
    fontFamily: theme.typography.fontFamily.medium,
  },
  selectedLocationOptionText: {
    color: theme.colors.text.white,
  },
});

export default LocationPromptModal;
