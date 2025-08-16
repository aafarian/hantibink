import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { KeyboardAvoidingView } from 'react-native';

import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { uploadImageToFirebase } from '../../utils/imageUpload';
import SelectionPanel from '../../components/SelectionPanel';
import Logger from '../../utils/logger';

const ProfileDetailsScreen = ({ navigation, route }) => {
  const [formData, setFormData] = useState({
    bio: '',
    interests: [],
    education: '',
    profession: '',
    height: '',
    relationshipType: [],
    religion: '',
    smoking: '',
    drinking: '',
    travel: '',
    pets: '',
  });
  const [showEducationPicker, setShowEducationPicker] = useState(false);
  const [showHeightPicker, setShowHeightPicker] = useState(false);

  const [showSmokingPicker, setShowSmokingPicker] = useState(false);
  const [showDrinkingPicker, setShowDrinkingPicker] = useState(false);
  const [showReligionPicker, setShowReligionPicker] = useState(false);

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');

  // Refs for text inputs to enable auto-advance
  const scrollViewRef = useRef(null);
  const bioRef = useRef(null);
  const professionRef = useRef(null);
  const travelRef = useRef(null);
  const petsRef = useRef(null);

  const { register, refreshUserProfileWithId } = useAuth();
  const { showError } = useToast();

  // Helper function to focus next field
  const focusField = fieldRef => {
    setTimeout(() => {
      if (fieldRef.current) {
        fieldRef.current.focus();
      }
    }, 100);
  };

  // Get data from previous steps - step2Data contains all step1 data + photos
  const step2Data = route?.params?.step2Data || {};
  const photos = step2Data.photos || [];

  // Extract step1 data (everything except photos)
  const { photos: _photos, ...step1Data } = step2Data;

  // All selection options
  const relationshipOptions = [
    { id: 'serious', label: 'Serious relationship' },
    { id: 'casual', label: 'Casual dating' },
    { id: 'friendship', label: 'Friendship' },
    { id: 'hookups', label: 'Hookups' },
    { id: 'marriage', label: 'Marriage' },
    { id: 'not-sure', label: 'Not sure yet' },
  ];

  const educationOptions = [
    { id: 'high-school', label: 'High School' },
    { id: 'some-college', label: 'Some College' },
    { id: 'bachelors', label: "Bachelor's Degree" },
    { id: 'masters', label: "Master's Degree" },
    { id: 'phd', label: 'PhD' },
    { id: 'trade-school', label: 'Trade School' },
    { id: 'other', label: 'Other' },
  ];

  // Create height options with cm conversion in proper order
  const heightOptions = Array.from({ length: 36 }, (_, i) => {
    const inches = i + 48; // 4'0" to 9'11"
    const feet = Math.floor(inches / 12);
    const remainingInches = inches % 12;
    const cm = Math.round(inches * 2.54); // Convert to cm
    return {
      id: `${feet}-${remainingInches}`,
      label: `${feet}'${remainingInches}" (${cm}cm)`,
      inches: inches,
    };
  });

  const smokingOptions = [
    { id: 'never', label: 'Never' },
    { id: 'socially', label: 'Socially' },
    { id: 'regularly', label: 'Regularly' },
  ];

  const drinkingOptions = [
    { id: 'never', label: 'Never' },
    { id: 'socially', label: 'Socially' },
    { id: 'regularly', label: 'Regularly' },
  ];

  const religionOptions = [
    { id: 'christian', label: 'Christian' },
    { id: 'catholic', label: 'Catholic' },
    { id: 'jewish', label: 'Jewish' },
    { id: 'muslim', label: 'Muslim' },
    { id: 'hindu', label: 'Hindu' },
    { id: 'buddhist', label: 'Buddhist' },
    { id: 'spiritual', label: 'Spiritual' },
    { id: 'agnostic', label: 'Agnostic' },
    { id: 'atheist', label: 'Atheist' },
    { id: 'other', label: 'Other' },
    { id: 'prefer-not-to-say', label: 'Prefer not to say' },
  ];

  // Temporary interests options (we'll expand this later)
  const interestOptions = [
    { id: 'music', label: 'Music' },
    { id: 'movies', label: 'Movies' },
    { id: 'travel', label: 'Travel' },
    { id: 'sports', label: 'Sports' },
    { id: 'fitness', label: 'Fitness' },
    { id: 'cooking', label: 'Cooking' },
    { id: 'reading', label: 'Reading' },
    { id: 'gaming', label: 'Gaming' },
    { id: 'photography', label: 'Photography' },
    { id: 'art', label: 'Art' },
    { id: 'nature', label: 'Nature' },
    { id: 'food', label: 'Food' },
    { id: 'dancing', label: 'Dancing' },
    { id: 'technology', label: 'Technology' },
    { id: 'fashion', label: 'Fashion' },
    { id: 'animals', label: 'Animals' },
  ];

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Handle multi-select toggle for arrays (relationshipType, interests)
  const toggleArrayField = (field, value) => {
    setFormData(prev => {
      const currentArray = prev[field] || [];
      const isSelected = currentArray.includes(value);

      if (isSelected) {
        // Remove from array
        return {
          ...prev,
          [field]: currentArray.filter(item => item !== value),
        };
      } else {
        // Add to array
        return {
          ...prev,
          [field]: [...currentArray, value],
        };
      }
    });
  };

  const _uploadPhotos = async _userId => {
    const uploadedUrls = [];

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      setProgress(`Uploading photo ${i + 1} of ${photos.length}...`);

      try {
        const downloadURL = await uploadImageToFirebase(photo.uri, _userId, 'profile-photos');
        uploadedUrls.push(downloadURL);
        Logger.success(`✅ Uploaded photo ${i + 1}: ${downloadURL}`);
      } catch (error) {
        Logger.error(`❌ Failed to upload photo ${i + 1}:`, error);
        throw error;
      }
    }

    return uploadedUrls;
  };

  const handleCreateAccount = async () => {
    setLoading(true);

    try {
      setProgress('Creating account...');
      Logger.info('🔐 Starting account creation with all collected data');

      // First, create the Firebase Auth account without photos
      const accountData = {
        email: step1Data.email,
        password: step1Data.password,
        name: step1Data.name,
        age: step1Data.age,
        birthDate: step1Data.birthDate,
        gender: step1Data.gender,
        interestedIn: step1Data.interestedIn,
        location: step1Data.locationText,
        coordinates: step1Data.location,
        bio: formData.bio,
        interests: formData.interests,
        education: formData.education,
        profession: formData.profession,
        height: formData.height,
        relationshipType: formData.relationshipType,
        religion: formData.religion,
        smoking: formData.smoking,
        drinking: formData.drinking,
        travel: formData.travel,
        pets: formData.pets,
        photos: photos, // Pass actual photos array for upload
        mainPhoto: null,
        hasCompletedOnboarding: true,
        isActive: true, // Make user discoverable in People tab
        isPremium: false,
        profileViews: 0,
        totalLikes: 0,
        totalMatches: 0,
        createdAt: new Date().toISOString(),
      };

      const result = await register(accountData);

      if (!result.success) {
        if (result.errorCode === 'auth/email-already-in-use') {
          showError('An account with this email already exists. Please sign in instead.');
        } else {
          showError(result.error || 'Failed to create account');
        }
        return;
      }

      const userId = result.user.uid;
      Logger.success('✅ Account created successfully:', userId);

      // Photo upload is now handled inside the register() function
      // Refresh the profile to ensure photos are loaded
      try {
        setProgress('Loading profile...');
        await refreshUserProfileWithId(userId);
        Logger.info('✅ Profile refreshed after registration');
      } catch (error) {
        Logger.error('❌ Failed to refresh profile:', error);
        // Not critical - user can still proceed
      }

      setProgress('Completing setup...');
      Logger.success('🎉 Registration complete! User signed in and ready to use app');

      // Navigation will be handled by AppNavigator detecting the signed-in user
    } catch (error) {
      Logger.error('❌ Account creation failed:', error);

      if (error.message.includes('storage')) {
        showError('Failed to upload photos. Please check your internet connection and try again.');
      } else {
        showError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
      setProgress('');
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
            <Text style={styles.title}>Step 3: Complete Profile</Text>
            <View style={styles.placeholder} />
          </View>

          <View style={styles.content}>
            <Text style={styles.subtitle}>
              Tell us more about yourself (these details help us find better matches)
            </Text>

            {/* Bio */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>About Me</Text>
              <TextInput
                ref={bioRef}
                style={[styles.input, styles.bioInput]}
                placeholder="Tell people a little about yourself..."
                value={formData.bio}
                onChangeText={text => updateField('bio', text)}
                multiline={true}
                numberOfLines={4}
                maxLength={500}
                textAlignVertical="top"
                returnKeyType="next"
                onSubmitEditing={() => focusField(professionRef)}
                blurOnSubmit={false}
                onBlur={() => {
                  // Auto-advance logic could go here if needed
                }}
              />
              <Text style={styles.charCount}>{formData.bio.length}/500</Text>
            </View>

            {/* Profession */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Profession</Text>
              <TextInput
                ref={professionRef}
                style={styles.input}
                placeholder="What do you do for work?"
                value={formData.profession}
                onChangeText={text => updateField('profession', text)}
                autoCapitalize="words"
                returnKeyType="next"
                onSubmitEditing={() => focusField(travelRef)}
                blurOnSubmit={false}
              />
            </View>

            {/* Education */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Education</Text>
              <TouchableOpacity
                style={styles.selectionButton}
                onPress={() => setShowEducationPicker(true)}
              >
                <Text style={[styles.selectionText, !formData.education && styles.placeholderText]}>
                  {formData.education
                    ? educationOptions.find(opt => opt.id === formData.education)?.label ||
                      formData.education
                    : 'Select your education level'}
                </Text>
                <MaterialIcons name="keyboard-arrow-down" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Height */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Height</Text>
              <TouchableOpacity
                style={styles.selectionButton}
                onPress={() => setShowHeightPicker(true)}
              >
                <Text style={[styles.selectionText, !formData.height && styles.placeholderText]}>
                  {formData.height
                    ? heightOptions.find(opt => opt.id === formData.height)?.label ||
                      formData.height
                    : 'Select your height'}
                </Text>
                <MaterialIcons name="keyboard-arrow-down" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Looking For */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Looking For</Text>
              <View style={styles.bubblesContainer}>
                {relationshipOptions.map(option => {
                  const isSelected = formData.relationshipType.includes(option.id);
                  return (
                    <TouchableOpacity
                      key={option.id}
                      style={[styles.bubble, isSelected && styles.bubbleSelected]}
                      onPress={() => toggleArrayField('relationshipType', option.id)}
                    >
                      <Text style={[styles.bubbleText, isSelected && styles.bubbleTextSelected]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Interests */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Interests</Text>
              <View style={styles.bubblesContainer}>
                {interestOptions.map(option => {
                  const isSelected = formData.interests.includes(option.id);
                  return (
                    <TouchableOpacity
                      key={option.id}
                      style={[styles.bubble, isSelected && styles.bubbleSelected]}
                      onPress={() => toggleArrayField('interests', option.id)}
                    >
                      <Text style={[styles.bubbleText, isSelected && styles.bubbleTextSelected]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Religion */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Religion</Text>
              <TouchableOpacity
                style={styles.selectionButton}
                onPress={() => setShowReligionPicker(true)}
              >
                <Text style={[styles.selectionText, !formData.religion && styles.placeholderText]}>
                  {formData.religion
                    ? religionOptions.find(opt => opt.id === formData.religion)?.label ||
                      formData.religion
                    : 'Select your religion (optional)'}
                </Text>
                <MaterialIcons name="keyboard-arrow-down" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Smoking */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Smoking</Text>
              <TouchableOpacity
                style={styles.selectionButton}
                onPress={() => setShowSmokingPicker(true)}
              >
                <Text style={[styles.selectionText, !formData.smoking && styles.placeholderText]}>
                  {formData.smoking
                    ? smokingOptions.find(opt => opt.id === formData.smoking)?.label ||
                      formData.smoking
                    : 'Do you smoke?'}
                </Text>
                <MaterialIcons name="keyboard-arrow-down" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Drinking */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Drinking</Text>
              <TouchableOpacity
                style={styles.selectionButton}
                onPress={() => setShowDrinkingPicker(true)}
              >
                <Text style={[styles.selectionText, !formData.drinking && styles.placeholderText]}>
                  {formData.drinking
                    ? drinkingOptions.find(opt => opt.id === formData.drinking)?.label ||
                      formData.drinking
                    : 'Do you drink?'}
                </Text>
                <MaterialIcons name="keyboard-arrow-down" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* Love to Travel */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Love to Travel</Text>
              <TextInput
                ref={travelRef}
                style={styles.textInput}
                placeholder="Tell us about your travel experiences or preferences"
                placeholderTextColor="#999"
                value={formData.travel}
                onChangeText={value => updateField('travel', value)}
                multiline={true}
                numberOfLines={3}
                textAlignVertical="top"
                maxLength={200}
                returnKeyType="next"
                onSubmitEditing={() => focusField(petsRef)}
                blurOnSubmit={false}
                onBlur={() => {
                  // Could add auto-scroll logic here
                }}
              />
              <Text style={styles.characterCount}>{formData.travel?.length || 0}/200</Text>
            </View>

            {/* Have Pets */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Have Pets</Text>
              <TextInput
                ref={petsRef}
                style={styles.textInput}
                placeholder="Tell us about your pets or thoughts on pets"
                placeholderTextColor="#999"
                value={formData.pets}
                onChangeText={value => updateField('pets', value)}
                multiline={true}
                numberOfLines={3}
                textAlignVertical="top"
                maxLength={200}
                returnKeyType="done"
                blurOnSubmit={true}
                onBlur={() => {
                  // Could add auto-scroll logic here
                }}
              />
              <Text style={styles.characterCount}>{formData.pets?.length || 0}/200</Text>
            </View>
          </View>
        </ScrollView>

        {/* Sticky Create Account Button */}
        <View style={styles.stickyButtonContainer}>
          <TouchableOpacity
            style={[styles.createButton, loading && styles.createButtonDisabled]}
            onPress={handleCreateAccount}
            disabled={loading}
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.createButtonText}>{progress}</Text>
              </View>
            ) : (
              <Text style={styles.createButtonText}>Create Account & Start Matching!</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.footerText}>
            You can always update these details later in your profile settings.
          </Text>
        </View>

        {/* All Selection Modals */}
        <SelectionPanel
          visible={showEducationPicker}
          onClose={() => setShowEducationPicker(false)}
          title="Education Level"
          options={educationOptions}
          selectedValue={formData.education}
          onSelect={value => updateField('education', value)}
          placeholder="Select your education level"
        />

        <SelectionPanel
          visible={showHeightPicker}
          onClose={() => setShowHeightPicker(false)}
          title="Height"
          options={heightOptions}
          selectedValue={formData.height}
          onSelect={value => updateField('height', value)}
          placeholder="Select your height"
          scrollable={true}
          initialScrollIndex={16} // Start at 5'4" (64 inches)
        />

        <SelectionPanel
          visible={showSmokingPicker}
          onClose={() => setShowSmokingPicker(false)}
          title="Smoking"
          options={smokingOptions}
          selectedValue={formData.smoking}
          onSelect={value => updateField('smoking', value)}
          placeholder="Do you smoke?"
        />

        <SelectionPanel
          visible={showDrinkingPicker}
          onClose={() => setShowDrinkingPicker(false)}
          title="Drinking"
          options={drinkingOptions}
          selectedValue={formData.drinking}
          onSelect={value => updateField('drinking', value)}
          placeholder="Do you drink?"
        />

        <SelectionPanel
          visible={showReligionPicker}
          onClose={() => setShowReligionPicker(false)}
          title="Religion"
          options={religionOptions}
          selectedValue={formData.religion}
          onSelect={value => updateField('religion', value)}
          placeholder="Select your religion (optional)"
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
    marginBottom: 30,
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
  content: {
    flex: 1,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
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
  textInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    minHeight: 80,
  },
  characterCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
  },
  bubblesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  bubbleSelected: {
    backgroundColor: '#FF6B6B',
    borderColor: '#FF6B6B',
  },
  bubbleText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  bubbleTextSelected: {
    color: '#fff',
  },
  bioInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
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
  placeholderText: {
    color: '#999',
  },

  stickyButtonContainer: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 20,
    paddingVertical: 15,
    paddingBottom: 30,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  createButton: {
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  createButtonDisabled: {
    backgroundColor: '#FFB6B6',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default ProfileDetailsScreen;
