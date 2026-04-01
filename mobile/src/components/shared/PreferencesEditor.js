import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import MultiSlider from '@ptomasroos/react-native-multi-slider';
import { kmToMiles } from '../../utils/distanceUtils';
import { theme } from '../../styles/theme';

const GENDER_OPTIONS = [
  { value: 'MAN', label: 'Men' },
  { value: 'WOMAN', label: 'Women' },
  { value: 'OTHER', label: 'Other' },
];

/**
 * Shared preferences editor component
 * Used in PreferencesScreen and Discovery filter modal
 */
const PreferencesEditor = ({
  preferences,
  onChange,
  sliderWidth = 280,
  showGenderSection = true,
}) => {
  const toggleGender = gender => {
    const currentGenders = preferences.interestedIn || [];
    const newGenders = currentGenders.includes(gender)
      ? currentGenders.filter(g => g !== gender)
      : [...currentGenders, gender];
    onChange({ ...preferences, interestedIn: newGenders });
  };

  const updateAgeRange = values => {
    onChange({
      ...preferences,
      ageRange: { min: values[0], max: values[1] },
    });
  };

  const updateDistance = values => {
    onChange({
      ...preferences,
      distance: values[0],
    });
  };

  const sliderStyles = {
    selectedStyle: {
      backgroundColor: theme.colors.primary,
      height: 4,
    },
    unselectedStyle: {
      backgroundColor: theme.colors.gray[300],
      height: 4,
    },
    markerStyle: {
      backgroundColor: theme.colors.background.primary,
      height: 28,
      width: 28,
      borderRadius: 14,
      shadowColor: theme.colors.gray[900],
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
      borderRadius: theme.borderRadius.xs,
    },
  };

  return (
    <View style={styles.container}>
      {/* Gender Selection */}
      {showGenderSection && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Show Me</Text>
          <View style={styles.optionsContainer}>
            {GENDER_OPTIONS.map(option => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionButton,
                  (preferences.interestedIn || []).includes(option.value) &&
                    styles.optionButtonActive,
                ]}
                onPress={() => toggleGender(option.value)}
              >
                <Text
                  style={[
                    styles.optionText,
                    (preferences.interestedIn || []).includes(option.value) &&
                      styles.optionTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Age Range */}
      <View style={styles.section}>
        <View style={styles.rangeHeader}>
          <Text style={styles.sectionTitle}>Age Range</Text>
          <View style={styles.rangeValues}>
            <Text style={styles.rangeValue}>{preferences.ageRange?.min || 18}</Text>
            <Text style={styles.rangeSeparator}>-</Text>
            <Text style={styles.rangeValue}>{preferences.ageRange?.max || 99}</Text>
            <Text style={styles.rangeUnit}>years</Text>
          </View>
        </View>
        <View style={styles.sliderContainer}>
          <MultiSlider
            values={[preferences.ageRange?.min || 18, preferences.ageRange?.max || 99]}
            min={18}
            max={100}
            step={1}
            sliderLength={sliderWidth}
            onValuesChange={updateAgeRange}
            {...sliderStyles}
          />
          <View style={[styles.sliderLabels, { width: sliderWidth }]}>
            <Text style={styles.sliderLabel}>18</Text>
            <Text style={styles.sliderLabel}>100</Text>
          </View>
        </View>
      </View>

      {/* Distance */}
      <View style={styles.section}>
        <View style={styles.rangeHeader}>
          <Text style={styles.sectionTitle}>Maximum Distance</Text>
          <View style={styles.rangeValues}>
            <Text style={styles.rangeValue}>{kmToMiles(preferences.distance || 50)}</Text>
            <Text style={styles.rangeUnit}>mi</Text>
            <Text style={styles.rangeSeparator}>({preferences.distance || 50} km)</Text>
          </View>
        </View>
        <View style={styles.sliderContainer}>
          <MultiSlider
            values={[preferences.distance || 50]}
            min={1}
            max={500}
            step={1}
            sliderLength={sliderWidth}
            onValuesChange={updateDistance}
            enableOne={true}
            {...sliderStyles}
          />
          <View style={[styles.sliderLabels, { width: sliderWidth }]}>
            <Text style={styles.sliderLabel}>1 mi</Text>
            <Text style={styles.sliderLabel}>310 mi</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray[200],
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing.lg,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  optionButton: {
    paddingHorizontal: theme.spacing.xxl,
    paddingVertical: theme.spacing.md,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: theme.colors.gray[300],
    backgroundColor: theme.colors.background.primary,
    margin: theme.spacing.xs,
  },
  optionButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  optionText: {
    fontSize: theme.typography.sizes.lg,
    color: theme.colors.gray[600],
  },
  optionTextActive: {
    color: theme.colors.text.white,
    fontWeight: theme.typography.weights.medium,
  },
  rangeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  rangeValues: {
    flexDirection: 'row',
    alignItems: 'baseline',
    backgroundColor: theme.colors.gray[100],
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  rangeValue: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.primary,
  },
  rangeSeparator: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.gray[500],
    marginHorizontal: theme.spacing.xs,
  },
  rangeUnit: {
    fontSize: theme.typography.sizes.md,
    color: theme.colors.gray[600],
    marginLeft: theme.spacing.xs,
  },
  sliderContainer: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    marginBottom: theme.spacing.md,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: theme.spacing.sm,
  },
  sliderLabel: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.gray[500],
  },
});

export default PreferencesEditor;
