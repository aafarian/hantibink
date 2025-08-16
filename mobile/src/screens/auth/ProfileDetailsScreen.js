import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import ProfileForm from '../../components/profile/ProfileForm';
import Logger from '../../utils/logger';

const ProfileDetailsScreen = ({ navigation, route }) => {
  const { register, refreshUserProfileWithId } = useAuth();
  const { showError } = useToast();

  const [loading, setLoading] = useState(false);
  const [, _setFormData] = useState({});

  // Refs for the form
  const profileFormRef = useRef(null);

  // Get data from previous steps
  const step2Data = route?.params?.step2Data || {};
  const photos = step2Data.photos || [];

  // Handle form data changes
  const handleFormDataChange = newFormData => {
    _setFormData(newFormData);
  };

  // Create account
  const createAccount = async () => {
    try {
      setLoading(true);
      Logger.info('🔐 Starting account creation with all collected data');

      // Get form data from the ProfileForm component
      const currentFormData = profileFormRef.current?.getFormData();
      if (!currentFormData) {
        showError('Please fill in the form');
        return;
      }

      // Validate form
      const validation = profileFormRef.current?.validateForm();
      if (!validation?.isValid) {
        const firstError = Object.values(validation.errors)[0];
        showError(firstError || 'Please check your input');
        return;
      }

      // Combine all registration data
      const allUserData = {
        ...step2Data, // Contains name, email, password, birthDate, gender, interestedIn, location, photos
        ...currentFormData, // Contains bio, education, profession, etc.
        photos, // Photos from step 2
      };

      // Register user
      const result = await register(allUserData);

      if (result.success) {
        // Refresh profile to ensure all data is loaded
        await refreshUserProfileWithId(result.user.uid);
        Logger.success('🎉 Registration complete! User signed in and ready to use app');
      } else {
        showError(result.error || 'Registration failed');
      }
    } catch (error) {
      Logger.error('❌ Account creation failed:', error);
      showError(error.message || 'Account creation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile Details</Text>
        <View style={styles.headerRight}>
          <Text style={styles.stepText}>Step 3 of 3</Text>
        </View>
      </View>

      {/* Profile Form */}
      <ProfileForm
        ref={profileFormRef}
        initialData={{}}
        onDataChange={handleFormDataChange}
        showPhotosSection={false} // Photos handled in previous step
        mode="registration"
        excludeFields={['name']} // Name is collected in step 1
        style={styles.form}
      />

      {/* Create Account Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.createButton, loading && styles.createButtonDisabled]}
          onPress={createAccount}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.createButtonText}>Create Account</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  stepText: {
    fontSize: 12,
    color: '#666',
  },
  form: {
    flex: 1,
  },
  buttonContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  createButton: {
    backgroundColor: '#FF6B6B',
    paddingVertical: 16,
    borderRadius: 25,
    alignItems: 'center',
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ProfileDetailsScreen;
