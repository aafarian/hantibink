import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import ApiClient from '../../services/ApiClient';
import Logger from '../../utils/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';

const OAuthCompleteScreen = ({ route }) => {
  const { user: _routeUser, missingFields: _missingFields = [] } = route.params || {};

  const [birthDate, setBirthDate] = useState(new Date(2000, 0, 1)); // Default to Jan 1, 2000
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const { setUser, refreshUserProfile } = useAuth();
  const { showSuccess, showError } = useToast();
  const apiClient = new ApiClient();

  // Calculate age from birthdate
  const calculateAge = date => {
    const today = new Date();
    const birth = new Date(date);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }

    return age;
  };

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setBirthDate(selectedDate);
    }
  };

  const handleComplete = async () => {
    try {
      // Validate age
      const age = calculateAge(birthDate);
      if (age < 18) {
        showError('You must be at least 18 years old to use this app');
        return;
      }

      if (age > 100) {
        showError('Please enter a valid birth date');
        return;
      }

      setLoading(true);

      // Complete OAuth profile
      const response = await apiClient.post('/auth/oauth/complete-profile', {
        birthDate: birthDate.toISOString(),
      });

      if (response.success && response.data) {
        Logger.info('OAuth profile completed successfully');

        // Update user in context
        await setUser(response.data.data);

        // Set flag to show onboarding
        await AsyncStorage.setItem('@HantibinkShowOnboarding', 'true');

        showSuccess("Profile completed! Let's set up your preferences");

        // Navigation will be handled by AppNavigator based on onboarding stage
        await refreshUserProfile();
      } else {
        throw new Error(response.message || 'Failed to complete profile');
      }
    } catch (error) {
      Logger.error('Failed to complete OAuth profile:', error);
      showError(error.message || 'Failed to complete profile');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = date => {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString(undefined, options);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAwareScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Almost there!</Text>
          <Text style={styles.subtitle}>We just need your birthday to complete your profile</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={24} color="#FF6B6B" />
            <Text style={styles.infoText}>
              Your age will be shown on your profile. You must be 18 or older to use this app.
            </Text>
          </View>

          <View style={styles.dateSection}>
            <Text style={styles.label}>Date of Birth</Text>
            <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
              <Ionicons name="calendar" size={20} color="#666" />
              <Text style={styles.dateText}>{formatDate(birthDate)}</Text>
              <Text style={styles.ageText}>Age: {calculateAge(birthDate)}</Text>
            </TouchableOpacity>
          </View>

          {showDatePicker && (
            <DateTimePicker
              value={birthDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChange}
              maximumDate={new Date()}
              minimumDate={new Date(1920, 0, 1)}
            />
          )}

          <TouchableOpacity
            style={[styles.continueButton, loading && styles.continueButtonDisabled]}
            onPress={handleComplete}
            disabled={loading || calculateAge(birthDate) < 18}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.continueButtonText}>Continue</Text>
            )}
          </TouchableOpacity>

          {calculateAge(birthDate) < 18 && (
            <Text style={styles.errorText}>You must be at least 18 years old</Text>
          )}
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  content: {
    flex: 1,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF5F5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 30,
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  dateSection: {
    marginBottom: 30,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  dateText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#333',
  },
  ageText: {
    fontSize: 14,
    color: '#666',
  },
  continueButton: {
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  continueButtonDisabled: {
    opacity: 0.6,
  },
  continueButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
  },
});

export default OAuthCompleteScreen;
