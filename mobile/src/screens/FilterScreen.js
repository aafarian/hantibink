import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useToast } from '../contexts/ToastContext';
import Logger from '../utils/logger';

const FilterScreen = ({ navigation, route }) => {
  const { showSuccess } = useToast();

  // Get user preferences from route params or default values
  const userPreferences = route?.params?.userPreferences || {
    ageRange: { min: 18, max: 50 },
    maxDistance: 50,
    genderPreference: ['men', 'women'],
  };

  const [filters, setFilters] = useState({
    // Age Range - start with user's preferences
    ageMin: userPreferences.ageRange?.min || 18,
    ageMax: userPreferences.ageRange?.max || 50,

    // Distance - start with user's preferences
    maxDistance: userPreferences.maxDistance || 50,

    // Gender - start with user's preferences
    showMen: userPreferences.genderPreference?.includes('men') || true,
    showWomen: userPreferences.genderPreference?.includes('women') || true,

    // Languages
    languages: [],

    // Lifestyle
    religion: [],
    education: [],
    smoking: [],
    drinking: [],
    pets: [],
    travel: [],

    // Relationship Goals
    relationshipType: [],

    // Advanced
    heightMin: 150,
    heightMax: 200,
  });

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

  const applyFilters = () => {
    // Here you would apply the filters to your matching algorithm
    Logger.debug('Applying filters:', filters);
    showSuccess('Your filters have been updated!');
    navigation.goBack();
  };

  const resetFilters = () => {
    setFilters({
      ageMin: 18,
      ageMax: 50,
      maxDistance: 50,
      showMen: userPreferences.genderPreference?.includes('men') || true,
      showWomen: userPreferences.genderPreference?.includes('women') || true,
      languages: [],
      religion: [],
      education: [],
      smoking: [],
      drinking: [],
      pets: [],
      travel: [],
      relationshipType: [],
      heightMin: 150,
      heightMax: 200,
    });
  };

  const renderSection = (title, children) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );

  const renderToggle = (label, key, value) => (
    <View style={styles.toggleContainer}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={newValue => updateFilter(key, newValue)}
        trackColor={{ false: '#E5E5EA', true: '#007AFF' }}
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

  const renderRangeDisplay = (label, min, max, unit = '') => (
    <View style={styles.rangeContainer}>
      <Text style={styles.rangeLabel}>{label}</Text>
      <Text style={styles.rangeValue}>
        {min} - {max} {unit}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Filters</Text>
        <TouchableOpacity onPress={resetFilters} style={styles.resetButton}>
          <Text style={styles.resetButtonText}>Reset</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Age Range */}
        {renderSection(
          'Age Range',
          renderRangeDisplay('Age', filters.ageMin, filters.ageMax, 'years')
        )}

        {/* Distance */}
        {renderSection(
          'Distance',
          renderRangeDisplay('Maximum Distance', filters.maxDistance, '', 'km')
        )}

        {/* Gender */}
        {renderSection(
          'Gender',
          <View>
            {renderToggle('Show Men', 'showMen', filters.showMen)}
            {renderToggle('Show Women', 'showWomen', filters.showWomen)}
          </View>
        )}

        {/* Languages */}
        {renderSection(
          'Languages',
          renderMultiSelect('Languages', 'languages', [
            'English',
            'Armenian (Western)',
            'Armenian (Eastern)',
            'Arabic',
            'French',
            'German',
            'Spanish',
            'Russian',
            'Turkish',
            'Persian',
            'Italian',
            'Portuguese',
            'Chinese',
            'Japanese',
            'Korean',
            'Hindi',
            'Urdu',
            'Hebrew',
            'Greek',
            'Other',
          ])
        )}

        {/* Religion */}
        {renderSection(
          'Religion',
          renderMultiSelect('Religion', 'religion', [
            'Christian',
            'Muslim',
            'Jewish',
            'Hindu',
            'Buddhist',
            'Atheist',
            'Agnostic',
            'Other',
          ])
        )}

        {/* Education */}
        {renderSection(
          'Education',
          renderMultiSelect('Education Level', 'education', [
            'High School',
            'Some College',
            "Bachelor's Degree",
            "Master's Degree",
            'PhD',
            'Other',
          ])
        )}

        {/* Smoking */}
        {renderSection(
          'Smoking',
          renderMultiSelect('Smoking', 'smoking', ['Yes', 'No', 'Occasionally', 'Trying to Quit'])
        )}

        {/* Drinking */}
        {renderSection(
          'Drinking',
          renderMultiSelect('Drinking', 'drinking', ['Yes', 'No', 'Occasionally', 'Socially'])
        )}

        {/* Pets */}
        {renderSection('Pets', renderMultiSelect('Pets', 'pets', ['Dog', 'Cat', 'Other', 'None']))}

        {/* Travel */}
        {renderSection(
          'Travel',
          renderMultiSelect('Travel Frequency', 'travel', [
            'Frequent',
            'Occasional',
            'Rarely',
            'Never',
          ])
        )}

        {/* Relationship Goals */}
        {renderSection(
          'Relationship Goals',
          renderMultiSelect('Looking For', 'relationshipType', [
            'Casual',
            'Serious',
            'Friendship',
            'Marriage',
          ])
        )}

        {/* Height */}
        {renderSection(
          'Height',
          renderRangeDisplay('Height Range', filters.heightMin, filters.heightMax, 'cm')
        )}
      </ScrollView>

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
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  resetButton: {
    padding: 5,
  },
  resetButtonText: {
    color: '#FF3B30',
    fontSize: 16,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    color: '#333',
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  toggleLabel: {
    fontSize: 16,
    color: '#333',
  },
  multiSelectContainer: {
    marginBottom: 10,
  },
  multiSelectLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 10,
    color: '#333',
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    backgroundColor: '#fff',
  },
  optionButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  optionText: {
    fontSize: 14,
    color: '#666',
  },
  optionTextActive: {
    color: '#fff',
  },
  rangeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F2F7',
  },
  rangeLabel: {
    fontSize: 16,
    color: '#333',
  },
  rangeValue: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  applyButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default FilterScreen;
