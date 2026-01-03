import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  ActivityIndicator,
} from 'react-native';
import MultiSlider from '@ptomasroos/react-native-multi-slider';
import { MaterialIcons } from '@expo/vector-icons';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../services/ApiClient';
import Logger from '../utils/logger';
import { kmToMiles } from '../utils/distanceUtils';
import { theme } from '../styles/theme';
import ScreenWrapper from '../components/shared/ScreenWrapper';

const FilterScreen = ({ navigation, route }) => {
  const { showSuccess, showError } = useToast();
  const { userProfile: _userProfile } = useAuth();
  const [loading, setLoading] = useState(true);

  // Get current filters from route params or use defaults
  const currentFilters = useMemo(
    () => route?.params?.userPreferences || {},
    [route?.params?.userPreferences]
  );
  const onSaveCallback = route?.params?.onSavePreferences;

  // Core preferences (synced with database via API)
  const [corePreferences, setCorePreferences] = useState({
    minAge: currentFilters.minAge || 18,
    maxAge: currentFilters.maxAge || 99,
    maxDistance: currentFilters.maxDistance || 50,
  });

  // Advanced filters (stored in AsyncStorage only)
  const [advancedFilters, setAdvancedFilters] = useState({
    strictAge: currentFilters.strictAge || false,
    strictDistance: currentFilters.strictDistance || false,
    relationshipType: currentFilters.relationshipType || [],
    strictRelationshipType: currentFilters.strictRelationshipType || false,
    education: currentFilters.education || [],
    strictEducation: currentFilters.strictEducation || false,
    smoking: currentFilters.smoking || [],
    strictSmoking: currentFilters.strictSmoking || false,
    drinking: currentFilters.drinking || [],
    strictDrinking: currentFilters.strictDrinking || false,
    languages: currentFilters.languages || [],
    strictLanguages: currentFilters.strictLanguages || false,
    hasKids: currentFilters.hasKids || null,
    wantsKids: currentFilters.wantsKids || null,
    heightMin: currentFilters.heightMin || null,
    heightMax: currentFilters.heightMax || null,
  });

  // Load preferences on mount
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        setLoading(true);

        // Load core preferences from API
        const response = await apiClient.getUserPreferences();
        if (response.success && response.data) {
          const data = response.data;
          setCorePreferences({
            minAge: data.ageRange?.min || 18,
            maxAge: data.ageRange?.max || 99,
            maxDistance: data.distance || 50,
          });
        }

        // Load advanced filters from AsyncStorage
        const savedFilters = await AsyncStorage.getItem('@HantibinkAdvancedFilters');
        if (savedFilters) {
          const parsed = JSON.parse(savedFilters);
          setAdvancedFilters(prev => ({ ...prev, ...parsed }));
        }
      } catch (error) {
        Logger.error('Failed to load preferences:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, []);

  const updateCorePreference = (key, value) => {
    setCorePreferences(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const updateAdvancedFilter = (key, value) => {
    setAdvancedFilters(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const toggleArrayFilter = (key, value) => {
    setAdvancedFilters(prev => ({
      ...prev,
      [key]: prev[key].includes(value)
        ? prev[key].filter(item => item !== value)
        : [...prev[key], value],
    }));
  };

  const applyFilters = async () => {
    try {
      // Save core preferences to API (syncs with PreferencesScreen)
      const apiPayload = {
        ageRange: { min: corePreferences.minAge, max: corePreferences.maxAge },
        distance: corePreferences.maxDistance,
      };
      const response = await apiClient.updateUserPreferences(apiPayload);
      if (!response.success) {
        showError('Failed to save preferences');
        return;
      }

      // Save advanced filters to AsyncStorage
      await AsyncStorage.setItem('@HantibinkAdvancedFilters', JSON.stringify(advancedFilters));

      // Combine all filters for the callback
      const allFilters = {
        ...corePreferences,
        ...advancedFilters,
      };

      Logger.info('Applying filters:', allFilters);

      // Call the callback if provided (for PeopleScreen)
      if (onSaveCallback) {
        onSaveCallback(allFilters);
      }

      showSuccess('Filters updated successfully!');
      navigation.goBack();
    } catch (error) {
      Logger.error('Failed to save filters:', error);
      showError('Failed to save filters');
    }
  };

  const resetFilters = async () => {
    // Reset core preferences to defaults
    setCorePreferences({
      minAge: 18,
      maxAge: 99,
      maxDistance: 50,
    });

    // Reset advanced filters to defaults
    setAdvancedFilters({
      strictAge: false,
      strictDistance: false,
      relationshipType: [],
      strictRelationshipType: false,
      education: [],
      strictEducation: false,
      smoking: [],
      strictSmoking: false,
      drinking: [],
      strictDrinking: false,
      languages: [],
      strictLanguages: false,
      hasKids: null,
      wantsKids: null,
      heightMin: null,
      heightMax: null,
    });
  };

  const renderSection = (title, children) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );

  const renderToggle = (label, description, key, value, isAdvanced = true) => (
    <View style={styles.toggleContainer}>
      <View style={styles.toggleTextContainer}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {description && <Text style={styles.toggleDescription}>{description}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={newValue =>
          isAdvanced ? updateAdvancedFilter(key, newValue) : updateCorePreference(key, newValue)
        }
        trackColor={{ false: '#E5E5EA', true: theme.colors.primary }}
        thumbColor={value ? '#fff' : '#f4f3f4'}
      />
    </View>
  );

  const renderMultiSelect = (label, key, options) => (
    <View style={styles.multiSelectContainer}>
      <Text style={styles.multiSelectLabel}>{label}</Text>
      <View style={styles.optionsContainer}>
        {options.map(option => (
          <TouchableOpacity
            key={option}
            style={[
              styles.optionButton,
              advancedFilters[key].includes(option) && styles.optionButtonActive,
            ]}
            onPress={() => toggleArrayFilter(key, option)}
          >
            <Text
              style={[
                styles.optionText,
                advancedFilters[key].includes(option) && styles.optionTextActive,
              ]}
            >
              {option}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const sliderStyles = {
    selectedStyle: {
      backgroundColor: theme.colors.primary,
      height: 4,
    },
    unselectedStyle: {
      backgroundColor: '#E5E5EA',
      height: 4,
    },
    markerStyle: {
      backgroundColor: '#FFF',
      height: 28,
      width: 28,
      borderRadius: 14,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 4,
    },
    pressedMarkerStyle: {
      height: 32,
      width: 32,
      borderRadius: 16,
    },
    containerStyle: {
      height: 40,
    },
    trackStyle: {
      height: 4,
      borderRadius: 2,
    },
  };

  if (loading) {
    return (
      <ScreenWrapper>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Filters</Text>
          <View style={{ width: 50 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Filters</Text>
        <TouchableOpacity onPress={resetFilters} style={styles.resetButton}>
          <Text style={styles.resetText}>Reset</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Basic Filters */}
        {renderSection(
          'Basic Preferences',
          <>
            {/* Age Range */}
            <View style={styles.rangeContainer}>
              <View style={styles.rangeHeader}>
                <Text style={styles.rangeLabel}>Age Range</Text>
                <View style={styles.rangeValues}>
                  <Text style={styles.rangeValue}>{corePreferences.minAge}</Text>
                  <Text style={styles.rangeSeparator}>-</Text>
                  <Text style={styles.rangeValue}>{corePreferences.maxAge}</Text>
                  <Text style={styles.rangeUnit}>years</Text>
                </View>
              </View>
              <View style={styles.multiSliderContainer}>
                <MultiSlider
                  values={[corePreferences.minAge, corePreferences.maxAge]}
                  min={18}
                  max={100}
                  step={1}
                  sliderLength={280}
                  onValuesChange={values => {
                    updateCorePreference('minAge', values[0]);
                    updateCorePreference('maxAge', values[1]);
                  }}
                  {...sliderStyles}
                />
                <View style={styles.sliderLabels}>
                  <Text style={styles.sliderMinLabel}>18</Text>
                  <Text style={styles.sliderMaxLabel}>100</Text>
                </View>
              </View>
              {renderToggle(
                'Strict age preference',
                'Only show people within this age range',
                'strictAge',
                advancedFilters.strictAge,
                true
              )}
            </View>

            {/* Distance */}
            <View style={styles.rangeContainer}>
              <View style={styles.rangeHeader}>
                <Text style={styles.rangeLabel}>Maximum Distance</Text>
                <View style={styles.rangeValues}>
                  <Text style={styles.rangeValue}>{kmToMiles(corePreferences.maxDistance)}</Text>
                  <Text style={styles.rangeUnit}>mi</Text>
                  <Text style={styles.rangeSeparator}>({corePreferences.maxDistance} km)</Text>
                </View>
              </View>
              <View style={styles.multiSliderContainer}>
                <MultiSlider
                  values={[corePreferences.maxDistance]}
                  min={1}
                  max={500}
                  step={1}
                  sliderLength={280}
                  onValuesChange={values => {
                    updateCorePreference('maxDistance', values[0]);
                  }}
                  enableOne={true}
                  {...sliderStyles}
                />
                <View style={styles.sliderLabels}>
                  <Text style={styles.sliderMinLabel}>1 mi</Text>
                  <Text style={styles.sliderMaxLabel}>310 mi</Text>
                </View>
              </View>
              {renderToggle(
                'Strict distance preference',
                'Only show people within this distance',
                'strictDistance',
                advancedFilters.strictDistance,
                true
              )}
            </View>
          </>
        )}

        {/* Relationship Type */}
        {renderSection(
          'Looking For',
          <>
            {renderMultiSelect('Relationship Type', 'relationshipType', [
              'Long-term',
              'Short-term',
              'Casual',
              'Marriage',
              'Friendship',
              'Not sure yet',
            ])}
            {renderToggle(
              'Strict relationship preference',
              'Only show people looking for the same type of relationship',
              'strictRelationshipType',
              advancedFilters.strictRelationshipType
            )}
          </>
        )}

        {/* Lifestyle */}
        {renderSection(
          'Lifestyle',
          <>
            {renderMultiSelect('Smoking', 'smoking', [
              'Non-smoker',
              'Social smoker',
              'Regular smoker',
              "Doesn't matter",
            ])}
            {renderToggle(
              'Strict smoking preference',
              'Only show people with selected smoking habits',
              'strictSmoking',
              advancedFilters.strictSmoking
            )}
            {renderMultiSelect('Drinking', 'drinking', [
              'Never',
              'Socially',
              'Regularly',
              "Doesn't matter",
            ])}
            {renderToggle(
              'Strict drinking preference',
              'Only show people with selected drinking habits',
              'strictDrinking',
              advancedFilters.strictDrinking
            )}
          </>
        )}

        {/* Education */}
        {renderSection(
          'Education',
          <>
            {renderMultiSelect('Education Level', 'education', [
              'High School',
              'Some College',
              "Bachelor's",
              "Master's",
              'PhD',
              "Doesn't matter",
            ])}
            {renderToggle(
              'Strict education preference',
              'Only show people with selected education levels',
              'strictEducation',
              advancedFilters.strictEducation
            )}
          </>
        )}

        {/* Languages */}
        {renderSection(
          'Languages',
          <>
            {renderMultiSelect('Languages Spoken', 'languages', [
              'Armenian (Western)',
              'Armenian (Eastern)',
              'English',
              'Spanish',
              'French',
              'Mandarin',
              'Arabic',
              'Hindi',
              'Portuguese',
              'Russian',
              'Japanese',
              'German',
              'Korean',
              'Italian',
              'Other',
            ])}
            {renderToggle(
              'Strict language preference',
              'Only show people who speak selected languages',
              'strictLanguages',
              advancedFilters.strictLanguages
            )}
          </>
        )}

        {/* Space at bottom */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Apply Button */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.applyButton} onPress={applyFilters}>
          <Text style={styles.applyButtonText}>Apply Filters</Text>
        </TouchableOpacity>
      </View>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: theme.colors.primary,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  resetButton: {
    padding: 4,
  },
  resetText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  toggleTextContainer: {
    flex: 1,
    marginRight: 16,
  },
  toggleLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  toggleDescription: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  rangeContainer: {
    marginBottom: 20,
  },
  rangeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  rangeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  rangeValues: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: '#F8F8F8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  rangeValue: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  rangeSeparator: {
    fontSize: 14,
    color: '#999',
    marginHorizontal: 4,
  },
  rangeUnit: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  multiSliderContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 280,
    marginTop: 8,
  },
  sliderMinLabel: {
    fontSize: 12,
    color: '#999',
  },
  sliderMaxLabel: {
    fontSize: 12,
    color: '#999',
  },
  multiSelectContainer: {
    marginBottom: 20,
  },
  multiSelectLabel: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    marginBottom: 12,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    backgroundColor: '#fff',
    margin: 4,
  },
  optionButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  optionText: {
    fontSize: 14,
    color: '#666',
  },
  optionTextActive: {
    color: '#fff',
    fontWeight: '500',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  applyButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default FilterScreen;
