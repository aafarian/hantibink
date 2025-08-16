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

  // Refs for text inputs to enable auto-advance
  const scrollViewRef = useRef(null);
  const nameRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmPasswordRef = useRef(null);

  const { checkEmailExists } = useAuth();
  const { location } = useLocation();
  const { showError } = useToast();

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
    setShowDatePicker(false);
    if (selectedDate) {
      const age = calculateAge(selectedDate);
      updateField('birthDate', selectedDate.toISOString());
      updateField('age', age);
    }
  };

  const validateEmail = async email => {
    if (!email) {
      showError('Email is required');
      return false;
    }
    if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email)) {
      showError('Please enter a valid email address');
      return false;
    }

    // Check if email already exists
    const emailExists = await checkEmailExists(email);
    if (emailExists) {
      showError('An account with this email already exists. Please sign in instead.');
      return false;
    }

    return true;
  };

  const validateForm = async () => {
    // Email validation
    const emailValid = await validateEmail(formData.email);
    if (!emailValid) return false;

    // Password validation
    if (!formData.password) {
      showError('Password is required');
      return false;
    }
    if (formData.password.length < 6) {
      showError('Password must be at least 6 characters');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      showError('Passwords do not match');
      return false;
    }

    // Name validation
    if (!formData.name.trim()) {
      showError('Name is required');
      return false;
    }

    // Age validation
    if (!formData.age || formData.age < 18) {
      showError('You must be at least 18 years old');
      return false;
    }

    // Gender validation
    if (!formData.gender) {
      showError('Please select your gender');
      return false;
    }

    // Interested in validation
    if (!formData.interestedIn) {
      showError("Please select who you're interested in");
      return false;
    }

    // Location validation
    if (!selectedLocation) {
      showError('Please select your location');
      return false;
    }

    return true;
  };

  const handleNext = async () => {
    if (!(await validateForm())) return;

    setLoading(true);
    try {
      Logger.info('🔄 Step 1 complete - proceeding to photo selection');

      // Prepare data for next step
      const step1Data = {
        ...formData,
        location: location, // Full location object for coordinates/details
        locationText: selectedLocation, // Human-readable location text
        createdAt: new Date().toISOString(),
      };

      // Navigate to Step 2 with data
      navigation.navigate('PhotoSelection', { step1Data });
    } catch (error) {
      Logger.error('❌ Step 1 error:', error);
      showError('An unexpected error occurred. Please try again.');
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
                style={styles.input}
                placeholder="Enter your full name"
                value={formData.name}
                onChangeText={text => updateField('name', text)}
                autoCapitalize="words"
                returnKeyType="next"
                onSubmitEditing={() => focusField(emailRef)}
                blurOnSubmit={false}
              />
            </View>

            {/* Email */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Email Address *</Text>
              <TextInput
                ref={emailRef}
                style={styles.input}
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
            </View>

            {/* Password */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Password *</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  ref={passwordRef}
                  style={styles.passwordInput}
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
              {formData.age && <Text style={styles.ageText}>Age: {formData.age}</Text>}
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
              {/* Debug info */}
              {__DEV__ && (
                <Text style={[styles.selectedText, { fontSize: 10, color: '#999' }]}>
                  Debug: selectedLocation = "{selectedLocation}" | context location ={' '}
                  {location
                    ? JSON.stringify({
                        selected: location.selected,
                        primary: location.primary,
                      })
                    : 'null'}
                </Text>
              )}
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
        </ScrollView>

        {/* Sticky Next Button */}
        <View style={styles.stickyButtonContainer}>
          <TouchableOpacity
            style={[styles.registerButton, loading && styles.registerButtonDisabled]}
            onPress={handleNext}
            disabled={loading}
          >
            <Text style={styles.registerButtonText}>
              {loading ? 'Validating...' : 'Next: Add Photos'}
            </Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.footerLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Date Picker Modal */}
        {showDatePicker && (
          <DateTimePicker
            testID="dateTimePicker"
            value={formData.birthDate ? new Date(formData.birthDate) : new Date()}
            mode="date"
            is24Hour={true}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleDateChange}
            maximumDate={new Date()}
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
  stickyButtonContainer: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 20,
    paddingVertical: 15,
    paddingBottom: 30,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
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
  ageText: {
    marginTop: 8,
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
  },
  selectedText: {
    marginTop: 8,
    fontSize: 14,
    color: '#FF6B6B',
    fontWeight: '600',
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
});

export default SimpleRegisterScreen;
