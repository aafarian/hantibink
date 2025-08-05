import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { uploadImageToFirebase } from '../../utils/imageUpload';
import SelectionPanel from '../../components/SelectionPanel';
import Logger from '../../utils/logger';
import { db } from '../../config/firebase';

const ProfileDetailsScreen = ({ navigation, route }) => {
  const [formData, setFormData] = useState({
    bio: '',
    interests: '',
    education: '',
    profession: '',
    height: '',
    relationshipType: '',
    religion: '',
    smoking: '',
    drinking: '',
    travel: '',
    pets: '',
  });
  const [showEducationPicker, setShowEducationPicker] = useState(false);
  const [showHeightPicker, setShowHeightPicker] = useState(false);
  const [showRelationshipPicker, setShowRelationshipPicker] = useState(false);
  const [showSmokingPicker, setShowSmokingPicker] = useState(false);
  const [showDrinkingPicker, setShowDrinkingPicker] = useState(false);
  const [showTravelPicker, setShowTravelPicker] = useState(false);
  const [showPetsPicker, setShowPetsPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');

  const { register, refreshUserProfileWithId } = useAuth();
  const { showError } = useToast();

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

  const heightOptions = Array.from({ length: 24 }, (_, i) => {
    const inches = i + 48; // 4'0" to 7'11"
    const feet = Math.floor(inches / 12);
    const remainingInches = inches % 12;
    return {
      id: `${feet}-${remainingInches}`,
      label: `${feet}'${remainingInches}"`,
    };
  });

  const yesNoOptions = [
    { id: 'yes', label: 'Yes' },
    { id: 'no', label: 'No' },
  ];

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

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const uploadPhotos = async userId => {
    const uploadedUrls = [];

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      setProgress(`Uploading photo ${i + 1} of ${photos.length}...`);

      try {
        const downloadURL = await uploadImageToFirebase(photo.uri, userId, 'profile-photos');
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
        photos: [], // Start with empty array
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
      Logger.success('✅ Firebase Auth account created:', userId);

      // Upload photos to Firebase Storage and update profile
      if (photos.length > 0) {
        setProgress('Uploading photos...');
        const photoUrls = await uploadPhotos(userId);

        setProgress('Updating profile with photos...');
        // Update the user profile with photo URLs directly in Firestore
        // We can't use updateUserProfile because AuthContext user might not be ready yet
        try {
          await updateDoc(doc(db, 'users', userId), {
            photos: photoUrls,
            mainPhoto: photoUrls[0], // First photo as main photo
            updatedAt: new Date().toISOString(),
          });

          Logger.success('✅ Photos saved directly to Firestore:', photoUrls);

          // Refresh AuthContext to pick up the updated profile with photos
          // Use refreshUserProfileWithId since user might not be ready in AuthContext yet
          try {
            const refreshResult = await refreshUserProfileWithId(userId);
            Logger.info('✅ AuthContext refresh result:', {
              success: !!refreshResult,
              photosCount: refreshResult?.photos?.length || 0,
            });
          } catch (error) {
            Logger.error('❌ Failed to refresh AuthContext:', error);
          }
        } catch (error) {
          Logger.error('❌ Failed to save photos to profile:', error);
          throw error;
        }
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
      <KeyboardAwareScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        enableOnAndroid={true}
        extraScrollHeight={20}
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
              style={[styles.input, styles.bioInput]}
              placeholder="Tell people a little about yourself..."
              value={formData.bio}
              onChangeText={text => updateField('bio', text)}
              multiline={true}
              numberOfLines={4}
              maxLength={500}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{formData.bio.length}/500</Text>
          </View>

          {/* Profession */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Profession</Text>
            <TextInput
              style={styles.input}
              placeholder="What do you do for work?"
              value={formData.profession}
              onChangeText={text => updateField('profession', text)}
              autoCapitalize="words"
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
                  ? heightOptions.find(opt => opt.id === formData.height)?.label || formData.height
                  : 'Select your height'}
              </Text>
              <MaterialIcons name="keyboard-arrow-down" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Looking For */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Looking For</Text>
            <TouchableOpacity
              style={styles.selectionButton}
              onPress={() => setShowRelationshipPicker(true)}
            >
              <Text
                style={[styles.selectionText, !formData.relationshipType && styles.placeholderText]}
              >
                {formData.relationshipType
                  ? relationshipOptions.find(opt => opt.id === formData.relationshipType)?.label ||
                    formData.relationshipType
                  : 'What are you looking for?'}
              </Text>
              <MaterialIcons name="keyboard-arrow-down" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Interests */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Interests</Text>
            <TextInput
              style={styles.input}
              placeholder="What are you passionate about?"
              value={formData.interests}
              onChangeText={text => updateField('interests', text)}
              autoCapitalize="words"
            />
          </View>

          {/* Religion */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Religion</Text>
            <TextInput
              style={styles.input}
              placeholder="Your religion (optional)"
              value={formData.religion}
              onChangeText={text => updateField('religion', text)}
              autoCapitalize="words"
            />
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
            <TouchableOpacity
              style={styles.selectionButton}
              onPress={() => setShowTravelPicker(true)}
            >
              <Text style={[styles.selectionText, !formData.travel && styles.placeholderText]}>
                {formData.travel
                  ? yesNoOptions.find(opt => opt.id === formData.travel)?.label || formData.travel
                  : 'Do you love to travel?'}
              </Text>
              <MaterialIcons name="keyboard-arrow-down" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Have Pets */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Have Pets</Text>
            <TouchableOpacity
              style={styles.selectionButton}
              onPress={() => setShowPetsPicker(true)}
            >
              <Text style={[styles.selectionText, !formData.pets && styles.placeholderText]}>
                {formData.pets
                  ? yesNoOptions.find(opt => opt.id === formData.pets)?.label || formData.pets
                  : 'Do you have pets?'}
              </Text>
              <MaterialIcons name="keyboard-arrow-down" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Create Account Button */}
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
      </KeyboardAwareScrollView>

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
      />

      <SelectionPanel
        visible={showRelationshipPicker}
        onClose={() => setShowRelationshipPicker(false)}
        title="Looking For"
        options={relationshipOptions}
        selectedValue={formData.relationshipType}
        onSelect={value => updateField('relationshipType', value)}
        placeholder="What are you looking for?"
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
        visible={showTravelPicker}
        onClose={() => setShowTravelPicker(false)}
        title="Love to Travel"
        options={yesNoOptions}
        selectedValue={formData.travel}
        onSelect={value => updateField('travel', value)}
        placeholder="Do you love to travel?"
      />

      <SelectionPanel
        visible={showPetsPicker}
        onClose={() => setShowPetsPicker(false)}
        title="Have Pets"
        options={yesNoOptions}
        selectedValue={formData.pets}
        onSelect={value => updateField('pets', value)}
        placeholder="Do you have pets?"
      />
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

  createButton: {
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 20,
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
