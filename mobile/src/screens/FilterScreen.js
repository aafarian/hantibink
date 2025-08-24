import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import Slider from '@react-native-community/slider';
import MultiSlider from '@ptomasroos/react-native-multi-slider';
import { MaterialIcons } from '@expo/vector-icons';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Logger from '../utils/logger';

const FilterScreen = ({ navigation, route }) => {
  const { showSuccess } = useToast();
  const { userProfile: _userProfile } = useAuth();

  // Get current filters from route params or use defaults
  const currentFilters = route?.params?.userPreferences || {};
  const onSaveCallback = route?.params?.onSavePreferences;

  const [filters, setFilters] = useState({
    // Age Range
    minAge: currentFilters.minAge || 18,
    maxAge: currentFilters.maxAge || 50,
    strictAge: currentFilters.strictAge || false,

    // Distance
    maxDistance: currentFilters.maxDistance || 100,
    strictDistance: currentFilters.strictDistance || false,

    // Only show users with photos
    onlyWithPhotos: currentFilters.onlyWithPhotos !== false, // Default true

    // Advanced filters
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

    // Height range (in cm)
    heightMin: currentFilters.heightMin || null,
    heightMax: currentFilters.heightMax || null,
  });

  // Load saved filters on mount
  useEffect(() => {
    loadSavedFilters();
  }, []);

  const loadSavedFilters = async () => {
    try {
      const savedFilters = await AsyncStorage.getItem('@HantibinkFilters');
      if (savedFilters) {
        const parsed = JSON.parse(savedFilters);
        setFilters(prev => ({ ...prev, ...parsed }));
        Logger.info('Loaded saved filters:', parsed);
      }
    } catch (error) {
      Logger.error('Failed to load saved filters:', error);
    }
  };

  const saveFilters = async filtersToSave => {
    try {
      await AsyncStorage.setItem('@HantibinkFilters', JSON.stringify(filtersToSave));
      Logger.info('Filters saved to storage');
    } catch (error) {
      Logger.error('Failed to save filters:', error);
    }
  };

  const updateFilter = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const toggleArrayFilter = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: prev[key].includes(value)
        ? prev[key].filter(item => item !== value)
        : [...prev[key], value],
    }));
  };

  const applyFilters = async () => {
    // Save filters to storage
    await saveFilters(filters);

    // Log the applied filters
    Logger.info('Applying filters:', filters);

    // Call the callback if provided (for PeopleScreen)
    if (onSaveCallback) {
      onSaveCallback(filters);
    }

    showSuccess('Filters updated successfully!');
    navigation.goBack();
  };

  const resetFilters = () => {
    const defaultFilters = {
      minAge: 18,
      maxAge: 50,
      strictAge: false,
      maxDistance: 100,
      strictDistance: false,
      onlyWithPhotos: true,
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
    };
    setFilters(defaultFilters);
  };

  const renderSection = (title, children) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );

  const renderToggle = (label, description, key, value) => (
    <View style={styles.toggleContainer}>
      <View style={styles.toggleTextContainer}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {description && <Text style={styles.toggleDescription}>{description}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={newValue => updateFilter(key, newValue)}
        trackColor={{ false: '#E5E5EA', true: '#FF6B6B' }}
        thumbColor={value ? '#fff' : '#f4f3f4'}
      />
    </View>
  );

  const _renderSlider = (_label, _minKey, _maxKey, _min, _max, _unit = '') => (
    <View style={styles.sliderContainer}>
      <Text style={styles.sliderLabel}>{_label}</Text>
      <View style={styles.sliderRow}>
        <Text style={styles.sliderValue}>{filters[_minKey]}</Text>
        <View style={styles.sliderTrack}>
          <Slider
            style={styles.slider}
            minimumValue={_min}
            maximumValue={_max}
            value={filters[_minKey]}
            onValueChange={value => updateFilter(_minKey, Math.round(value))}
            minimumTrackTintColor="#FF6B6B"
            maximumTrackTintColor="#E5E5EA"
            thumbTintColor="#FF6B6B"
          />
        </View>
        <Text style={styles.sliderValue}>{filters[_maxKey]}</Text>
      </View>
      <View style={styles.sliderRow}>
        <Text style={styles.sliderHint}>Min</Text>
        <Slider
          style={styles.slider}
          minimumValue={filters[_minKey]}
          maximumValue={_max}
          value={filters[_maxKey]}
          onValueChange={value => updateFilter(_maxKey, Math.round(value))}
          minimumTrackTintColor="#FF6B6B"
          maximumTrackTintColor="#E5E5EA"
          thumbTintColor="#FF6B6B"
        />
        <Text style={styles.sliderHint}>Max</Text>
      </View>
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
              filters[key].includes(option) && styles.optionButtonActive,
            ]}
            onPress={() => toggleArrayFilter(key, option)}
          >
            <Text
              style={[styles.optionText, filters[key].includes(option) && styles.optionTextActive]}
            >
              {option}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Discovery Filters</Text>
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
                  <Text style={styles.rangeValue}>{filters.minAge}</Text>
                  <Text style={styles.rangeSeparator}>-</Text>
                  <Text style={styles.rangeValue}>{filters.maxAge}</Text>
                  <Text style={styles.rangeUnit}>years</Text>
                </View>
              </View>
              <View style={styles.multiSliderContainer}>
                <MultiSlider
                  values={[filters.minAge, filters.maxAge]}
                  min={18}
                  max={100}
                  step={1}
                  sliderLength={280}
                  onValuesChange={values => {
                    updateFilter('minAge', values[0]);
                    updateFilter('maxAge', values[1]);
                  }}
                  selectedStyle={{
                    backgroundColor: '#FF6B6B',
                    height: 4,
                  }}
                  unselectedStyle={{
                    backgroundColor: '#E5E5EA',
                    height: 4,
                  }}
                  markerStyle={{
                    backgroundColor: '#FFF',
                    height: 28,
                    width: 28,
                    borderRadius: 14,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.15,
                    shadowRadius: 4,
                    elevation: 4,
                  }}
                  pressedMarkerStyle={{
                    height: 32,
                    width: 32,
                    borderRadius: 16,
                  }}
                  containerStyle={{
                    height: 40,
                  }}
                  trackStyle={{
                    height: 4,
                    borderRadius: 2,
                  }}
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
                filters.strictAge
              )}
            </View>

            {/* Distance */}
            <View style={styles.rangeContainer}>
              <View style={styles.rangeHeader}>
                <Text style={styles.rangeLabel}>Maximum Distance</Text>
                <View style={styles.rangeValues}>
                  <Text style={styles.rangeValue}>
                    {Math.round(filters.maxDistance * 0.621371)}
                  </Text>
                  <Text style={styles.rangeUnit}>mi</Text>
                  <Text style={styles.rangeSeparator}>({filters.maxDistance} km)</Text>
                </View>
              </View>
              <View style={styles.multiSliderContainer}>
                <MultiSlider
                  values={[filters.maxDistance]}
                  min={1}
                  max={500}
                  step={1}
                  sliderLength={280}
                  onValuesChange={values => {
                    updateFilter('maxDistance', values[0]);
                  }}
                  selectedStyle={{
                    backgroundColor: '#FF6B6B',
                    height: 4,
                  }}
                  unselectedStyle={{
                    backgroundColor: '#E5E5EA',
                    height: 4,
                  }}
                  markerStyle={{
                    backgroundColor: '#FFF',
                    height: 28,
                    width: 28,
                    borderRadius: 14,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.15,
                    shadowRadius: 4,
                    elevation: 4,
                  }}
                  pressedMarkerStyle={{
                    height: 32,
                    width: 32,
                    borderRadius: 16,
                  }}
                  containerStyle={{
                    height: 40,
                  }}
                  trackStyle={{
                    height: 4,
                    borderRadius: 2,
                  }}
                  enableOne={true}
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
                filters.strictDistance
              )}
            </View>
          </>
        )}

        {/* Matching Preferences */}
        {renderSection(
          'Matching Preferences',
          renderToggle(
            'Only With Photos',
            'Only show profiles that have at least one photo',
            'onlyWithPhotos',
            filters.onlyWithPhotos
          )
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
              filters.strictRelationshipType
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
              filters.strictSmoking
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
              filters.strictDrinking
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
              filters.strictEducation
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
              filters.strictLanguages
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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  resetButton: {
    padding: 4,
  },
  resetText: {
    fontSize: 16,
    color: '#FF6B6B',
    fontWeight: '500',
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
    color: '#FF6B6B',
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
    backgroundColor: '#FF6B6B',
    borderColor: '#FF6B6B',
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
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  applyButton: {
    backgroundColor: '#FF6B6B',
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
