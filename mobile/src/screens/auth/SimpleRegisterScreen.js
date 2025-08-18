import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from '../../contexts/LocationContext';
import { useToast } from '../../contexts/ToastContext';
import LocationPicker from '../../components/LocationPicker';
import SelectionPanel from '../../components/SelectionPanel';
import Logger from '../../utils/logger';

const SimpleRegisterScreen = ({ navigation }) => {
  const { register } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    birthDate: null,
    age: null,
    gender: '',
    interestedIn: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [showInterestedInPicker, setShowInterestedInPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({}); // Track field-specific errors

  // Refs for text inputs to enable auto-advance
  const scrollViewRef = useRef(null);
  const nameRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmPasswordRef = useRef(null);

  const { checkEmailExists } = useAuth();
  const { location } = useLocation();
  const { showError, showSuccess } = useToast();

  // Helper function to focus next field
  const focusField = fieldRef => {
    setTimeout(() => {
      if (fieldRef.current) {
        fieldRef.current.focus();
      }
    }, 100);
  };

  // Initialize selectedLocation if context already has a location
  useEffect(() => {
    if (location && !selectedLocation) {
      const locationText = location.selected || location.primary || '';
      if (locationText) {
        setSelectedLocation(locationText);
        Logger.info('📍 Initialized selected location from context:', locationText);
      }
    }
  }, [location, selectedLocation]);

  // Gender options
  const genderOptions = [
    { id: 'man', label: 'Man' },
    { id: 'woman', label: 'Woman' },
    { id: 'non-binary', label: 'Non-binary' },
    { id: 'other', label: 'Other' },
  ];

  // Interested in options
  const interestedInOptions = [
    { id: 'men', label: 'Men' },
    { id: 'women', label: 'Women' },
    { id: 'everyone', label: 'Everyone' },
  ];

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (fieldErrors[field]) {
      setFieldErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const calculateAge = birthDate => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }

    return age;
  };

  const handleDateChange = (event, selectedDate) => {
    // Don't close modal automatically - only update the value
    if (selectedDate) {
      const age = calculateAge(selectedDate);
      updateField('birthDate', selectedDate.toISOString());
      updateField('age', age);
    }
  };

  const validateEmail = async email => {
    if (!email) {
      setFieldErrors(prev => ({ ...prev, email: 'Email is required' }));
      showError('Email is required');
      return false;
    }
    if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email)) {
      setFieldErrors(prev => ({ ...prev, email: 'Please enter a valid email address' }));
      showError('Please enter a valid email address');
      return false;
    }

    // Check if email already exists
    const emailExists = await checkEmailExists(email);
    if (emailExists) {
      setFieldErrors(prev => ({ ...prev, email: 'An account with this email already exists' }));
      showError('An account with this email already exists. Please sign in instead.');
      return false;
    }

    return true;
  };

  const validateForm = async () => {
    let hasErrors = false;
    const errors = {};

    // Email validation
    const emailValid = await validateEmail(formData.email);
    if (!emailValid) hasErrors = true;

    // Password validation
    if (!formData.password) {
      errors.password = 'Password is required';
      showError('Password is required');
      hasErrors = true;
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
      showError('Password must be at least 6 characters');
      hasErrors = true;
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
      showError('Passwords do not match');
      hasErrors = true;
    }

    // Name validation
    if (!formData.name.trim()) {
      errors.name = 'Name is required';
      showError('Name is required');
      hasErrors = true;
    }

    // Age validation
    if (!formData.age || formData.age < 18) {
      errors.birthDate = 'You must be at least 18 years old';
      showError('You must be at least 18 years old');
      hasErrors = true;
    }

    // Gender validation
    if (!formData.gender) {
      errors.gender = 'Please select your gender';
      showError('Please select your gender');
      hasErrors = true;
    }

    // Interested in validation
    if (!formData.interestedIn) {
      errors.interestedIn = "Please select who you're interested in";
      showError("Please select who you're interested in");
      hasErrors = true;
    }

    // Location validation
    if (!selectedLocation) {
      errors.location = 'Please select your location';
      showError('Please select your location');
      hasErrors = true;
    }

    setFieldErrors(errors);
    return !hasErrors;
  };

  const handleNext = async () => {
    if (!(await validateForm())) return;

    setLoading(true);
    try {
      Logger.info('🔄 Creating account with basic info...');

      // Create account immediately with minimal required data
      const userData = {
        email: formData.email,
        password: formData.password,
        name: formData.name,
        birthDate: formData.birthDate,
        gender: formData.gender,
        interestedIn: formData.interestedIn,
        location: String(selectedLocation || 'Pasadena, California'),
        coordinates: {
          latitude: Number(location && location.latitude ? location.latitude : 34.16),
          longitude: Number(location && location.longitude ? location.longitude : -118.07),
          address: String(selectedLocation || 'Pasadena, California'),
        },
        bio: '', // Empty for now
        hasCompletedOnboarding: false, // Mark as incomplete
        onboardingStep: 2, // Next step is photos
      };

      // Debug log to see what we're sending
      Logger.info('🔍 Registration data being sent:', {
        location: userData.location,
        coordinates: userData.coordinates,
        selectedLocation,
        contextLocation: location,
      });

      // Register user via API (normal login flow)
      const result = await register(userData);

      if (result.success) {
        Logger.success('✅ Account created successfully');
        showSuccess("Welcome to Hantibink! Let's complete your profile");
        // Navigation to main app happens automatically via AuthContext
      } else {
        Logger.error('❌ Registration failed:', result.error);
        showError(result.error || 'Failed to create account. Please try again.');
      }
    } catch (error) {
      Logger.error('❌ Account creation error:', error);
      showError('Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.container}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <MaterialIcons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.title}>Step 1: Basic Info</Text>
            <View style={styles.placeholder} />
          </View>

          <View style={styles.form}>
            {/* Name */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Full Name *</Text>
              <TextInput
                ref={nameRef}
                style={[styles.input, fieldErrors.name && styles.inputError]}
                placeholder="Enter your full name"
                value={formData.name}
                onChangeText={text => updateField('name', text)}
                autoCapitalize="words"
                returnKeyType="next"
                onSubmitEditing={() => focusField(emailRef)}
                blurOnSubmit={false}
              />
              {fieldErrors.name && <Text style={styles.errorText}>{fieldErrors.name}</Text>}
            </View>

            {/* Email */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Email Address *</Text>
              <TextInput
                ref={emailRef}
                style={[styles.input, fieldErrors.email && styles.inputError]}
                placeholder="Enter your email"
                value={formData.email}
                onChangeText={text => updateField('email', text)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => focusField(passwordRef)}
                blurOnSubmit={false}
              />
              {fieldErrors.email && <Text style={styles.errorText}>{fieldErrors.email}</Text>}
            </View>

            {/* Password */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Password *</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  ref={passwordRef}
                  style={[styles.passwordInput, fieldErrors.password && styles.inputError]}
                  placeholder="Enter your password"
                  value={formData.password}
                  onChangeText={text => updateField('password', text)}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  returnKeyType="next"
                  onSubmitEditing={() => focusField(confirmPasswordRef)}
                  blurOnSubmit={false}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                >
                  <MaterialIcons
                    name={showPassword ? 'visibility' : 'visibility-off'}
                    size={24}
                    color="#666"
                  />
                </TouchableOpacity>
              </View>
              {fieldErrors.password && <Text style={styles.errorText}>{fieldErrors.password}</Text>}
            </View>

            {/* Confirm Password */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Confirm Password *</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  ref={confirmPasswordRef}
                  style={styles.passwordInput}
                  placeholder="Confirm your password"
                  value={formData.confirmPassword}
                  onChangeText={text => updateField('confirmPassword', text)}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={() => confirmPasswordRef.current?.blur()}
                  blurOnSubmit={true}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={styles.eyeButton}
                >
                  <MaterialIcons
                    name={showConfirmPassword ? 'visibility' : 'visibility-off'}
                    size={24}
                    color="#666"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Birth Date */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Birthday *</Text>
              <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
                <Text style={[styles.dateText, !formData.birthDate && styles.placeholderText]}>
                  {formData.birthDate
                    ? new Date(formData.birthDate).toLocaleDateString()
                    : 'Select your birthday'}
                </Text>
                <MaterialIcons name="calendar-today" size={20} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Location */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Location *</Text>
              <LocationPicker
                currentLocation={selectedLocation || ''}
                placeholder="Select your location"
                required={true}
                onLocationSelected={locationText => {
                  setSelectedLocation(locationText);
                  Logger.info('📍 Location selected in registration:', locationText);
                }}
              />
            </View>

            {/* Gender */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Gender *</Text>
              <TouchableOpacity
                style={styles.selectionButton}
                onPress={() => setShowGenderPicker(true)}
              >
                <Text style={[styles.selectionText, !formData.gender && styles.placeholderText]}>
                  {formData.gender
                    ? genderOptions.find(opt => opt.id === formData.gender)?.label ||
                      formData.gender
                    : 'Select your gender'}
                </Text>
                <MaterialIcons name="keyboard-arrow-down" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Interested In */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Interested In *</Text>
              <TouchableOpacity
                style={styles.selectionButton}
                onPress={() => setShowInterestedInPicker(true)}
              >
                <Text
                  style={[styles.selectionText, !formData.interestedIn && styles.placeholderText]}
                >
                  {formData.interestedIn
                    ? interestedInOptions.find(opt => opt.id === formData.interestedIn)?.label ||
                      formData.interestedIn
                    : "Select who you're interested in"}
                </Text>
                <MaterialIcons name="keyboard-arrow-down" size={24} color="#666" />
              </TouchableOpacity>
            </View>
          </View>
          {/* Register Button */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.registerButton, loading && styles.registerButtonDisabled]}
              onPress={handleNext}
              disabled={loading}
            >
              <Text style={styles.registerButtonText}>
                {loading ? 'Creating Account...' : 'Create Account & Continue'}
              </Text>
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.footerLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        {/* Date Picker Modal */}
        {showDatePicker && (
          <DateTimePicker
            testID="dateTimePicker"
            value={formData.birthDate ? new Date(formData.birthDate) : new Date()}
            mode="date"
            is24Hour={true}
            display="spinner"
            onChange={(event, selectedDate) => {
              setShowDatePicker(false);
              handleDateChange(event, selectedDate);
            }}
            maximumDate={new Date()}
            minimumDate={new Date(1940, 0, 1)}
          />
        )}

        {/* Gender Selection Modal */}
        <SelectionPanel
          visible={showGenderPicker}
          onClose={() => setShowGenderPicker(false)}
          title="Select Gender"
          options={genderOptions}
          selectedValue={formData.gender}
          onSelect={value => {
            updateField('gender', value);
            setShowGenderPicker(false);
          }}
          placeholder="Select your gender"
        />

        {/* Interested In Selection Modal */}
        <SelectionPanel
          visible={showInterestedInPicker}
          onClose={() => setShowInterestedInPicker(false)}
          title="Interested In"
          options={interestedInOptions}
          selectedValue={formData.interestedIn}
          onSelect={value => {
            updateField('interestedIn', value);
            setShowInterestedInPicker(false);
          }}
          placeholder="Select who you're interested in"
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 40,
  },
  form: {
    flex: 1,
  },
  fieldContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
  },
  eyeButton: {
    padding: 16,
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingBottom: 30,
  },

  registerButton: {
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  registerButtonDisabled: {
    backgroundColor: '#FFB6B6',
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  footerText: {
    color: '#666',
    fontSize: 14,
  },
  footerLink: {
    color: '#FF6B6B',
    fontSize: 14,
    fontWeight: 'bold',
  },
  dateButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 16,
    color: '#333',
  },
  placeholderText: {
    color: '#999',
  },

  selectionButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectionText: {
    fontSize: 16,
    color: '#333',
  },
  inputError: {
    borderColor: '#FF6B6B',
    backgroundColor: '#FFF5F5',
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 4,
  },
});

export default SimpleRegisterScreen;
