import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import MultiSlider from '@ptomasroos/react-native-multi-slider';
import { MaterialIcons } from '@expo/vector-icons';
import { useToast } from '../contexts/ToastContext';
import apiClient from '../services/ApiClient';
import Logger from '../utils/logger';
import { kmToMiles } from '../utils/distanceUtils';
import { theme } from '../styles/theme';
import ScreenWrapper from '../components/shared/ScreenWrapper';

const PreferencesScreen = ({ navigation }) => {
  const { showSuccess, showError } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState({
    interestedIn: [],
    ageRange: { min: 18, max: 50 },
    distance: 50,
  });

  const loadPreferences = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.getUserPreferences();
      if (response.success && response.data) {
        const data = response.data;
        setPreferences({
          interestedIn: data.interestedIn || [],
          ageRange: data.ageRange || { min: 18, max: 50 },
          distance: data.distance || 50,
        });
      }
    } catch (error) {
      Logger.error('Failed to load preferences:', error);
      showError('Failed to load preferences');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  const savePreferences = async () => {
    try {
      setSaving(true);
      const response = await apiClient.updateUserPreferences(preferences);
      if (response.success) {
        showSuccess('Preferences saved successfully!');
        navigation.goBack();
      } else {
        showError(response.message || 'Failed to save preferences');
      }
    } catch (error) {
      Logger.error('Failed to save preferences:', error);
      showError('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const toggleGender = gender => {
    setPreferences(prev => ({
      ...prev,
      interestedIn: prev.interestedIn.includes(gender)
        ? prev.interestedIn.filter(g => g !== gender)
        : [...prev.interestedIn, gender],
    }));
  };

  const genderOptions = [
    { value: 'MAN', label: 'Men' },
    { value: 'WOMAN', label: 'Women' },
    { value: 'OTHER', label: 'Other' },
  ];

  if (loading) {
    return (
      <ScreenWrapper>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Preferences</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Preferences</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Interested In */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Show Me</Text>
          <View style={styles.optionsContainer}>
            {genderOptions.map(option => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.optionButton,
                  preferences.interestedIn.includes(option.value) && styles.optionButtonActive,
                ]}
                onPress={() => toggleGender(option.value)}
              >
                <Text
                  style={[
                    styles.optionText,
                    preferences.interestedIn.includes(option.value) && styles.optionTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Age Range */}
        <View style={styles.section}>
          <View style={styles.rangeHeader}>
            <Text style={styles.sectionTitle}>Age Range</Text>
            <View style={styles.rangeValues}>
              <Text style={styles.rangeValue}>{preferences.ageRange.min}</Text>
              <Text style={styles.rangeSeparator}>-</Text>
              <Text style={styles.rangeValue}>{preferences.ageRange.max}</Text>
              <Text style={styles.rangeUnit}>years</Text>
            </View>
          </View>
          <View style={styles.multiSliderContainer}>
            <MultiSlider
              values={[preferences.ageRange.min, preferences.ageRange.max]}
              min={18}
              max={100}
              step={1}
              sliderLength={280}
              onValuesChange={values => {
                setPreferences(prev => ({
                  ...prev,
                  ageRange: { min: values[0], max: values[1] },
                }));
              }}
              selectedStyle={{
                backgroundColor: theme.colors.primary,
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
        </View>

        {/* Distance */}
        <View style={styles.section}>
          <View style={styles.rangeHeader}>
            <Text style={styles.sectionTitle}>Maximum Distance</Text>
            <View style={styles.rangeValues}>
              <Text style={styles.rangeValue}>{kmToMiles(preferences.distance)}</Text>
              <Text style={styles.rangeUnit}>mi</Text>
              <Text style={styles.rangeSeparator}>({preferences.distance} km)</Text>
            </View>
          </View>
          <View style={styles.multiSliderContainer}>
            <MultiSlider
              values={[preferences.distance]}
              min={1}
              max={500}
              step={1}
              sliderLength={280}
              onValuesChange={values => {
                setPreferences(prev => ({
                  ...prev,
                  distance: values[0],
                }));
              }}
              selectedStyle={{
                backgroundColor: theme.colors.primary,
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
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Save Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={savePreferences}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save Preferences</Text>
          )}
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
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  optionButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
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
    fontSize: 16,
    color: '#666',
  },
  optionTextActive: {
    color: '#fff',
    fontWeight: '500',
  },
  rangeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
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
  saveButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default PreferencesScreen;
