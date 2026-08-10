import React, { useState, useEffect, useCallback } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useToast } from '../../contexts/ToastContext';
import apiClient from '../../services/ApiClient';
import Logger from '../../utils/logger';
import { ErrorScreen } from '../ErrorScreen';
import { kmToMiles } from '../../utils/distanceUtils';
import { theme } from '../../styles/theme';
import ScreenWrapper from './ScreenWrapper';

// Filter option constants
const FILTER_OPTIONS = {
  // Server-canonical ids with display labels — the API only accepts
  // MAN/WOMAN/OTHER, and loaded preferences come back in that form too
  genders: [
    { id: 'MAN', label: 'Men' },
    { id: 'WOMAN', label: 'Women' },
    { id: 'OTHER', label: 'Other' },
  ],
  relationshipTypes: [
    'Long-term',
    'Short-term',
    'Casual',
    'Marriage',
    'Friendship',
    'Not sure yet',
  ],
  smokingOptions: ['Non-smoker', 'Social smoker', 'Regular smoker', "Doesn't matter"],
  drinkingOptions: ['Never', 'Socially', 'Regularly', "Doesn't matter"],
  educationOptions: [
    'High School',
    'Some College',
    "Bachelor's",
    "Master's",
    'PhD',
    "Doesn't matter",
  ],
  languageOptions: [
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
  ],
};

const DEFAULT_CORE_PREFERENCES = {
  interestedIn: [],
  minAge: 18,
  maxAge: 99,
  maxDistance: 50,
};

const DEFAULT_ADVANCED_FILTERS = {
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
};

// Allowlist of keys that legitimately belong in the "advanced filters"
// bucket. Used by `pickAdvancedFilters` below to sanitize objects that
// arrived from outside (parent-passed `initialFilters`, AsyncStorage)
// before mixing them into `advancedFilters` state.
const ADVANCED_FILTER_KEYS = Object.keys(DEFAULT_ADVANCED_FILTERS);

/**
 * Return a shallow copy of `obj` containing only the keys that belong to
 * `advancedFilters`. Prevents `core` keys (minAge, maxAge, maxDistance,
 * interestedIn) from leaking into advanced state and then being mistakenly
 * spread back over fresh core values at save time.
 *
 * Exported because the discovery screen's filter-loading path needs the
 * same sanitization when it reads `@HantibinkAdvancedFilters` from
 * AsyncStorage.
 */
export const pickAdvancedFilters = obj => {
  if (!obj || typeof obj !== 'object') {
    return {};
  }
  const result = {};
  for (const key of ADVANCED_FILTER_KEYS) {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  }
  return result;
};

const FilterPreferencesForm = ({
  navigation,
  headerTitle = 'Filters',
  buttonText = 'Apply Filters',
  showReset = false,
  onSave,
  initialFilters = {},
}) => {
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);

  // Core preferences (synced with database via API)
  const [corePreferences, setCorePreferences] = useState({
    ...DEFAULT_CORE_PREFERENCES,
    interestedIn: initialFilters.interestedIn || [],
    minAge: initialFilters.minAge || 18,
    maxAge: initialFilters.maxAge || 99,
    maxDistance: initialFilters.maxDistance || 50,
  });

  // Advanced filters (stored in AsyncStorage only). `initialFilters` is the
  // parent's combined-shape object and contains both core and advanced keys —
  // sanitize so only advanced keys end up here, otherwise stale core values
  // leak in and later override fresh corePreferences at save time.
  const [advancedFilters, setAdvancedFilters] = useState({
    ...DEFAULT_ADVANCED_FILTERS,
    ...pickAdvancedFilters(initialFilters),
  });

  const loadPreferences = useCallback(async () => {
    try {
      setLoading(true);
      setError(false);

      // Load core preferences from API
      const response = await apiClient.getUserPreferences();
      if (response.success && response.data) {
        const data = response.data;
        setCorePreferences({
          interestedIn: data.interestedIn || [],
          minAge: data.ageRange?.min || 18,
          maxAge: data.ageRange?.max || 99,
          maxDistance: data.distance || 50,
        });
      }

      // Load advanced filters from AsyncStorage. Sanitize too — stored data
      // from older sessions can carry leaked core keys, and we don't want them
      // poisoning advancedFilters state.
      const savedFilters = await AsyncStorage.getItem('@HantibinkAdvancedFilters');
      if (savedFilters) {
        const parsed = JSON.parse(savedFilters);
        setAdvancedFilters(prev => ({ ...prev, ...pickAdvancedFilters(parsed) }));
      }
    } catch (err) {
      Logger.error('Failed to load preferences:', err);
      showError('Failed to load preferences');
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  const updateCorePreference = useCallback((key, value) => {
    setCorePreferences(prev => ({ ...prev, [key]: value }));
  }, []);

  const updateAdvancedFilter = useCallback((key, value) => {
    setAdvancedFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const toggleArrayFilter = useCallback((key, value) => {
    setAdvancedFilters(prev => ({
      ...prev,
      [key]: prev[key].includes(value)
        ? prev[key].filter(item => item !== value)
        : [...prev[key], value],
    }));
  }, []);

  const toggleCoreArrayFilter = useCallback((key, value) => {
    setCorePreferences(prev => ({
      ...prev,
      [key]: prev[key].includes(value)
        ? prev[key].filter(item => item !== value)
        : [...prev[key], value],
    }));
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);

      // Save core preferences to API
      const apiPayload = {
        interestedIn: corePreferences.interestedIn,
        ageRange: { min: corePreferences.minAge, max: corePreferences.maxAge },
        distance: corePreferences.maxDistance,
      };
      const response = await apiClient.updateUserPreferences(apiPayload);

      if (!response.success) {
        showError(response.message || 'Failed to save preferences');
        return;
      }

      // Save advanced filters to AsyncStorage. Sanitize at the write boundary
      // too so any pre-existing leaked core keys get scrubbed out on the very
      // next save, even for users whose storage was corrupted by an older
      // build.
      await AsyncStorage.setItem(
        '@HantibinkAdvancedFilters',
        JSON.stringify(pickAdvancedFilters(advancedFilters))
      );

      // Combine all filters for the callback. corePreferences spreads last
      // as defense in depth — advancedFilters is sanitized everywhere it's
      // ingested, but a stale leak from an outside caller should not be able
      // to defeat fresh core values.
      const allFilters = { ...advancedFilters, ...corePreferences };

      Logger.info('Saving filters:', allFilters);

      // Call the optional callback
      if (onSave) {
        onSave(allFilters);
      }

      showSuccess('Preferences saved successfully!');
      navigation.goBack();
    } catch (err) {
      Logger.error('Failed to save preferences:', err);
      showError('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setCorePreferences({ ...DEFAULT_CORE_PREFERENCES });
    setAdvancedFilters({ ...DEFAULT_ADVANCED_FILTERS });
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
        onValueChange={newValue => updateAdvancedFilter(key, newValue)}
        trackColor={{ false: theme.colors.gray[300], true: theme.colors.primary }}
        thumbColor={value ? theme.colors.background.primary : theme.colors.gray[100]}
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

  if (loading) {
    return (
      <ScreenWrapper>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color={theme.colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{headerTitle}</Text>
          <View style={{ width: showReset ? 50 : 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </ScreenWrapper>
    );
  }

  if (error) {
    return (
      <ScreenWrapper>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color={theme.colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{headerTitle}</Text>
          <View style={{ width: showReset ? 50 : 40 }} />
        </View>
        <ErrorScreen message="Failed to load preferences" onRetry={loadPreferences} />
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{headerTitle}</Text>
        {showReset ? (
          <TouchableOpacity onPress={handleReset} style={styles.resetButton}>
            <Text style={styles.resetText}>Reset</Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Basic Preferences */}
        {renderSection(
          'Basic Preferences',
          <>
            {/* Show Me (Gender) */}
            <View style={styles.showMeContainer}>
              <Text style={styles.rangeLabel}>Show me</Text>
              <View style={styles.genderOptionsContainer}>
                {FILTER_OPTIONS.genders.map(gender => (
                  <TouchableOpacity
                    key={gender.id}
                    style={[
                      styles.genderOption,
                      corePreferences.interestedIn.includes(gender.id) && styles.genderOptionActive,
                    ]}
                    onPress={() => toggleCoreArrayFilter('interestedIn', gender.id)}
                  >
                    <Text
                      style={[
                        styles.genderOptionText,
                        corePreferences.interestedIn.includes(gender.id) &&
                          styles.genderOptionTextActive,
                      ]}
                    >
                      {gender.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

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
                advancedFilters.strictAge
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
                advancedFilters.strictDistance
              )}
            </View>
          </>
        )}

        {/* Relationship Type */}
        {renderSection(
          'Looking For',
          <>
            {renderMultiSelect(
              'Relationship Type',
              'relationshipType',
              FILTER_OPTIONS.relationshipTypes
            )}
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
            {renderMultiSelect('Smoking', 'smoking', FILTER_OPTIONS.smokingOptions)}
            {renderToggle(
              'Strict smoking preference',
              'Only show people with selected smoking habits',
              'strictSmoking',
              advancedFilters.strictSmoking
            )}
            {renderMultiSelect('Drinking', 'drinking', FILTER_OPTIONS.drinkingOptions)}
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
            {renderMultiSelect('Education Level', 'education', FILTER_OPTIONS.educationOptions)}
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
            {renderMultiSelect('Languages Spoken', 'languages', FILTER_OPTIONS.languageOptions)}
            {renderToggle(
              'Strict language preference',
              'Only show people who speak selected languages',
              'strictLanguages',
              advancedFilters.strictLanguages
            )}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Action Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.actionButton, saving && styles.actionButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={theme.colors.text.white} />
          ) : (
            <Text style={styles.actionButtonText}>{buttonText}</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScreenWrapper>
  );
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

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.lg,
    backgroundColor: theme.colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.light,
  },
  backButton: {
    padding: theme.spacing.xs,
  },
  headerTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.semibold,
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.text.primary,
  },
  resetButton: {
    padding: theme.spacing.xs,
  },
  resetText: {
    fontSize: theme.typography.sizes.lg,
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.medium,
    fontFamily: theme.typography.fontFamily.medium,
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
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray[200],
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.semibold,
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.gray[600],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: theme.spacing.lg,
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  toggleTextContainer: {
    flex: 1,
    marginRight: theme.spacing.lg,
  },
  toggleLabel: {
    fontSize: theme.typography.sizes.lg,
    color: theme.colors.text.primary,
    fontWeight: theme.typography.weights.medium,
    fontFamily: theme.typography.fontFamily.medium,
  },
  toggleDescription: {
    fontSize: theme.typography.sizes.sm,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.gray[600],
    marginTop: 2,
  },
  showMeContainer: {
    marginBottom: theme.spacing.xxl,
  },
  genderOptionsContainer: {
    flexDirection: 'row',
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  genderOption: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.gray[300],
    backgroundColor: theme.colors.background.primary,
    alignItems: 'center',
  },
  genderOptionActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  genderOptionText: {
    fontSize: 15,
    color: theme.colors.gray[600],
    fontWeight: theme.typography.weights.medium,
    fontFamily: theme.typography.fontFamily.medium,
  },
  genderOptionTextActive: {
    color: theme.colors.text.white,
  },
  rangeContainer: {
    marginBottom: theme.spacing.xl,
  },
  rangeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  rangeLabel: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.text.primary,
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
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.primary,
  },
  rangeSeparator: {
    fontSize: theme.typography.sizes.md,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.gray[500],
    marginHorizontal: theme.spacing.xs,
  },
  rangeUnit: {
    fontSize: theme.typography.sizes.md,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.gray[600],
    marginLeft: theme.spacing.xs,
  },
  multiSliderContainer: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    marginBottom: theme.spacing.md,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 280,
    marginTop: theme.spacing.sm,
  },
  sliderMinLabel: {
    fontSize: theme.typography.sizes.sm,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.gray[500],
  },
  sliderMaxLabel: {
    fontSize: theme.typography.sizes.sm,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.gray[500],
  },
  multiSelectContainer: {
    marginBottom: theme.spacing.xl,
  },
  multiSelectLabel: {
    fontSize: theme.typography.sizes.lg,
    color: theme.colors.text.primary,
    fontWeight: theme.typography.weights.medium,
    fontFamily: theme.typography.fontFamily.medium,
    marginBottom: theme.spacing.md,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  optionButton: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.xxl,
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
    fontSize: theme.typography.sizes.md,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.gray[600],
  },
  optionTextActive: {
    color: theme.colors.text.white,
    fontWeight: theme.typography.weights.medium,
    fontFamily: theme.typography.fontFamily.medium,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.background.primary,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.lg,
    // The footer renders inside the tab area, above the tab bar in normal
    // layout flow. A small visual gap reads better here than padding sized
    // for an iOS home indicator (which is the responsibility of whatever
    // renders at the actual bottom of the screen, not this footer).
    paddingBottom: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray[200],
  },
  actionButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
  },
  actionButtonDisabled: {
    opacity: 0.7,
  },
  actionButtonText: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.text.white,
  },
});

export default FilterPreferencesForm;
