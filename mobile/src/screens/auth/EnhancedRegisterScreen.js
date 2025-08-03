import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SelectionPanel from '../../components/SelectionPanel';
import { useAuth } from '../../contexts/AuthContext';

const EnhancedRegisterScreen = ({ navigation }) => {
  const { register } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showInterestedInPanel, setShowInterestedInPanel] = useState(false);
  const [showEducationPanel, setShowEducationPanel] = useState(false);
  const [showReligionPanel, setShowReligionPanel] = useState(false);
  const [showHeightPanel, setShowHeightPanel] = useState(false);
  const [showLanguagesPanel, setShowLanguagesPanel] = useState(false);
  const [showRelationshipPanel, setShowRelationshipPanel] = useState(false);

  // Remove old state - everything is now handled by react-hook-form
  // No more formData, updateFormData, showEducationDropdown, etc.
  const insets = useSafeAreaInsets();

  const {
    control,
    formState: { errors },
    watch,
    setValue,
    trigger,
  } = useForm({
    mode: 'onBlur', // Validate on blur, but we'll clear errors onChange
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      birthDate: '',
      gender: '',
      interestedIn: '',
      bio: '',
      profession: '',
      education: '',
      religion: '',
      height: '',
      smoking: '',
      drinking: '',
      pets: '',
      travel: '',
      interests: '',
      languages: [],
      relationshipType: [],

      photos: [],
    },
  });

  // Watch specific fields individually to prevent re-render loops
  const photos = watch('photos') || [];
  const languages = watch('languages') || [];
  const relationshipType = watch('relationshipType') || [];

  // Watch other common fields
  const name = watch('name') || '';
  const email = watch('email') || '';
  const bio = watch('bio') || '';
  const profession = watch('profession') || '';
  const interests = watch('interests') || '';
  const smoking = watch('smoking') || '';
  const drinking = watch('drinking') || '';
  const travel = watch('travel') || '';
  const pets = watch('pets') || '';
  const gender = watch('gender') || '';
  const interestedIn = watch('interestedIn') || '';
  const education = watch('education') || '';
  const religion = watch('religion') || '';
  const height = watch('height') || '';

  const nextStep = async () => {
    if (await validateCurrentStep()) {
      setCurrentStep(prev => Math.min(prev + 1, 3));
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const validateCurrentStep = async () => {
    const fieldsToValidate = {
      1: ['name', 'email', 'password', 'confirmPassword', 'birthDate', 'gender', 'interestedIn'],
      2: ['photos'],
      3: [
        'bio',
        'profession',
        'education',
        'religion',
        'height',
        'smoking',
        'drinking',
        'travel',
        'location',
      ],
    };

    const fields = fieldsToValidate[currentStep];
    const result = await trigger(fields);

    if (!result) {
      // Scroll to first error
      const firstErrorField = fields.find(field => errors[field]);
      if (firstErrorField) {
        // We'll implement scrolling to error later
        Alert.alert('Validation Error', 'Please fix the errors before continuing.');
      }
      return false;
    }

    return true;
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      const currentPhotos = photos;
      setValue('photos', [...currentPhotos, result.assets[0].uri]);
      trigger('photos'); // Clear validation error when photo is added
    }
  };

  const removePhoto = index => {
    const currentPhotos = photos;
    const newPhotos = currentPhotos.filter((_, i) => i !== index);
    setValue('photos', newPhotos);
    trigger('photos'); // Re-validate when photo is removed
  };

  const handleRegister = async () => {
    const isValid = await validateCurrentStep();
    if (!isValid) {
      return;
    }

    setLoading(true);
    try {
      const data = {
        name: name,
        email: email,
        bio: bio,
        profession: profession,
        interests: interests,
        smoking: smoking,
        drinking: drinking,
        travel: travel,
        pets: pets,
        gender: gender,
        interestedIn: interestedIn,
        education: education,
        religion: religion,
        height: height,
        photos: photos,
        languages: languages,
        relationshipType: relationshipType,
        password: watch('password'),
        confirmPassword: watch('confirmPassword'),
        birthDate: watch('birthDate'),
      };
      // Calculate age from birthDate
      const birthDate = new Date(data.birthDate);
      const age = new Date().getFullYear() - birthDate.getFullYear();

      const userData = {
        name: data.name,
        email: data.email,
        password: data.password,
        age,
        birthDate: birthDate.toISOString(),
        gender: data.gender,
        bio: data.bio,
        photos: data.photos || [],
        mainPhoto: data.photos && data.photos[0] ? data.photos[0] : null,

        languages: data.languages || [],
        profession: data.profession,
        education: data.education,
        religion: data.religion,
        height: data.height, // Keep as string, or extract number if needed: data.height.match(/\d+/)?.[0]
        smoking: data.smoking,
        drinking: data.drinking,
        pets: data.pets,
        travel: data.travel,
        interests: data.interests
          ? data.interests
              .split(',')
              .map(i => i.trim())
              .filter(i => i)
          : [],
        preferences: {
          ageRange: {
            min: 18,
            max: 50,
          },
          maxDistance: 50,
          genderPreference: data.interestedIn,
          relationshipType: data.relationshipType || [],
        },
        settings: {
          notifications: {
            matches: true,
            messages: true,
            likes: true,
          },
          privacy: {
            showOnline: true,
            showLastSeen: true,
            showDistance: true,
          },
          language: 'en',
          theme: 'light',
        },
        isActive: true,
        isPremium: false,
        profileViews: 0,
        totalLikes: 0,
        totalMatches: 0,
      };

      await register(userData);
      // User will be automatically logged in and redirected to main app
      // Location prompt will be shown as modal in main app
    } catch (error) {
      Alert.alert('Registration Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderProgressBar = () => (
    <View style={[styles.progressContainer, { paddingTop: insets.top + 10 }]}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressTitle}>Create Your Profile</Text>
        <Text style={styles.progressSubtitle}>Step {currentStep} of 3</Text>
      </View>
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${(currentStep / 3) * 100}%` }]} />
        </View>
      </View>
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Basic Information</Text>

      <Controller
        control={control}
        name="name"
        rules={{ required: 'Name is required' }}
        render={({ field: { onChange, value }, fieldState: { error } }) => (
          <View style={styles.fieldContainer}>
            {error && <Text style={styles.errorText}>{error.message}</Text>}
            <TextInput
              style={[styles.input, error && styles.inputError]}
              placeholder="Name *"
              value={value}
              onChangeText={text => {
                onChange(text);
                if (error) {
                  trigger('name');
                } // Clear error immediately when user starts typing
              }}
            />
          </View>
        )}
      />

      <Controller
        control={control}
        name="email"
        rules={{
          required: 'Email is required',
          pattern: {
            value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
            message: 'Please enter a valid email address',
          },
        }}
        render={({ field: { onChange, value }, fieldState: { error } }) => (
          <View style={styles.fieldContainer}>
            {error && <Text style={styles.errorText}>{error.message}</Text>}
            <TextInput
              style={[styles.input, error && styles.inputError]}
              placeholder="Email *"
              value={value}
              onChangeText={text => {
                onChange(text);
                if (error) {
                  trigger('email');
                } // Clear error immediately when user starts typing
              }}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        )}
      />

      <Controller
        control={control}
        name="password"
        rules={{
          required: 'Password is required',
          minLength: { value: 6, message: 'Password must be at least 6 characters' },
        }}
        render={({ field: { onChange, value }, fieldState: { error } }) => (
          <View style={styles.fieldContainer}>
            {error && <Text style={styles.errorText}>{error.message}</Text>}
            <View style={[styles.passwordContainer, error && styles.inputError]}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Password *"
                value={value}
                onChangeText={text => {
                  onChange(text);
                  if (error) {
                    trigger('password');
                  } // Clear error immediately
                }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <MaterialIcons
                  name={showPassword ? 'visibility' : 'visibility-off'}
                  size={20}
                  color="#666"
                />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <Controller
        control={control}
        name="confirmPassword"
        rules={{
          required: 'Please confirm your password',
          validate: value => {
            const password = watch('password');
            if (!password || !value) {
              return true;
            } // Don't validate if either is empty
            return value === password || 'Passwords do not match';
          },
        }}
        render={({ field: { onChange, value }, fieldState: { error } }) => (
          <View style={styles.fieldContainer}>
            {error && <Text style={styles.errorText}>{error.message}</Text>}
            <View style={[styles.passwordContainer, error && styles.inputError]}>
              <TextInput
                style={styles.passwordInput}
                placeholder="Confirm Password *"
                value={value}
                onChangeText={text => {
                  onChange(text);
                  if (error) {
                    trigger('confirmPassword');
                  } // Clear error immediately
                }}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                <MaterialIcons
                  name={showConfirmPassword ? 'visibility' : 'visibility-off'}
                  size={20}
                  color="#666"
                />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <Controller
        control={control}
        name="birthDate"
        rules={{ required: 'Birth date is required' }}
        render={({ field: { onChange, value }, fieldState: { error } }) => (
          <View style={styles.fieldContainer}>
            {error && <Text style={styles.errorText}>{error.message}</Text>}
            <TouchableOpacity
              style={[styles.dateInput, error && styles.inputError]}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={value ? styles.dateText : styles.datePlaceholder}>
                {value || 'Select Birth Date *'}
              </Text>
              <MaterialIcons name="calendar-today" size={20} color="#666" />
            </TouchableOpacity>
          </View>
        )}
      />

      <Controller
        control={control}
        name="gender"
        rules={{ required: 'Gender is required' }}
        render={({ field: { onChange, value }, fieldState: { error } }) => (
          <View style={styles.fieldContainer}>
            <View style={styles.genderContainer}>
              <Text style={styles.label}>Gender *</Text>
              {error && <Text style={styles.errorText}>{error.message}</Text>}
              <View style={styles.genderButtons}>
                {['male', 'female', 'other'].map(genderOption => (
                  <TouchableOpacity
                    key={genderOption}
                    style={[
                      styles.genderButton,
                      value === genderOption && styles.genderButtonActive,
                    ]}
                    onPress={() => onChange(genderOption)}
                  >
                    <Text
                      style={[
                        styles.genderButtonText,
                        value === genderOption && styles.genderButtonTextActive,
                      ]}
                    >
                      {genderOption.charAt(0).toUpperCase() + genderOption.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}
      />

      <Controller
        control={control}
        name="interestedIn"
        rules={{ required: 'Please select your preference' }}
        render={({ field: { onChange, value }, fieldState: { error } }) => (
          <View style={styles.fieldContainer}>
            {error && <Text style={styles.errorText}>{error.message}</Text>}
            <View style={styles.pickerContainer}>
              <Text style={styles.label}>I am interested in *</Text>
              <TouchableOpacity
                style={[styles.dropdownButton, error && styles.inputError]}
                onPress={() => setShowInterestedInPanel(true)}
              >
                <Text style={value ? styles.dropdownButtonText : styles.dropdownButtonPlaceholder}>
                  {value ? value.charAt(0).toUpperCase() + value.slice(1) : 'Select preference'}
                </Text>
                <MaterialIcons name="keyboard-arrow-down" size={24} color="#666" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Add Photos</Text>
      <Text style={styles.stepSubtitle}>Upload at least one photo of yourself</Text>

      <Controller
        control={control}
        name="photos"
        rules={{
          validate: value => {
            if (!value || value.length === 0) {
              return 'Please upload at least one photo';
            }
            return true;
          },
        }}
        render={({ fieldState: { error } }) => (
          <View style={styles.fieldContainer}>
            {error && <Text style={styles.errorText}>{error.message}</Text>}
          </View>
        )}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosContainer}>
        {photos.map((photo, index) => (
          <View key={index} style={styles.photoContainer}>
            <Image source={{ uri: photo }} style={styles.photo} />
            <TouchableOpacity style={styles.removePhotoButton} onPress={() => removePhoto(index)}>
              <MaterialIcons name="close" size={20} color="white" />
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity style={styles.addPhotoButton} onPress={pickImage}>
          <MaterialIcons name="add-a-photo" size={40} color="#666" />
          <Text style={styles.addPhotoText}>Add Photo</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Profile Details (Optional)</Text>

      <Controller
        control={control}
        name="bio"
        rules={{}}
        render={({ field: { onChange, value }, fieldState: { error } }) => (
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Bio</Text>
            {error && <Text style={styles.errorText}>{error.message}</Text>}
            <TextInput
              style={[styles.input, styles.textArea, error && styles.inputError]}
              placeholder="Tell us about yourself"
              value={value}
              onChangeText={text => {
                onChange(text);
                if (error) {
                  trigger('bio');
                } // Clear error immediately
              }}
              multiline
              numberOfLines={4}
            />
          </View>
        )}
      />

      <Controller
        control={control}
        name="profession"
        rules={{}}
        render={({ field: { onChange, value }, fieldState: { error } }) => (
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Profession</Text>
            {error && <Text style={styles.errorText}>{error.message}</Text>}
            <TextInput
              style={[styles.input, error && styles.inputError]}
              placeholder="Profession"
              value={value}
              onChangeText={text => {
                onChange(text);
                if (error) {
                  trigger('profession');
                } // Clear error immediately
              }}
            />
          </View>
        )}
      />

      <View style={styles.pickerContainer}>
        <Text style={styles.label}>Education Level</Text>
        <TouchableOpacity style={styles.dropdownButton} onPress={() => setShowEducationPanel(true)}>
          <Text style={education ? styles.dropdownButtonText : styles.dropdownButtonPlaceholder}>
            {education || 'Select education level'}
          </Text>
          <MaterialIcons name="keyboard-arrow-down" size={24} color="#666" />
        </TouchableOpacity>

        {false && (
          <View style={styles.dropdownOptions}>
            {[
              'High School',
              'Some College',
              "Bachelor's Degree",
              "Master's Degree",
              'PhD',
              'Other',
            ].map(option => (
              <TouchableOpacity
                key={option}
                style={styles.dropdownOption}
                onPress={() => {
                  setValue('education', option);
                  // Removed old dropdown
                }}
              >
                <Text style={styles.dropdownOptionText}>{option}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View style={styles.pickerContainer}>
        <Text style={styles.label}>Religion</Text>
        <TouchableOpacity style={styles.dropdownButton} onPress={() => setShowReligionPanel(true)}>
          <Text style={religion ? styles.dropdownButtonText : styles.dropdownButtonPlaceholder}>
            {religion || 'Select religion'}
          </Text>
          <MaterialIcons name="keyboard-arrow-down" size={24} color="#666" />
        </TouchableOpacity>

        {false && (
          <View style={styles.dropdownOptions}>
            {[
              'Christian',
              'Muslim',
              'Jewish',
              'Hindu',
              'Buddhist',
              'Atheist',
              'Agnostic',
              'Other',
            ].map(option => (
              <TouchableOpacity
                key={option}
                style={styles.dropdownOption}
                onPress={() => {
                  setValue('religion', option);
                  // Removed old dropdown
                }}
              >
                <Text style={styles.dropdownOptionText}>{option}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View style={styles.pickerContainer}>
        <Text style={styles.label}>Height</Text>
        <TouchableOpacity style={styles.dropdownButton} onPress={() => setShowHeightPanel(true)}>
          <Text style={height ? styles.dropdownButtonText : styles.dropdownButtonPlaceholder}>
            {height || 'Select height'}
          </Text>
          <MaterialIcons name="keyboard-arrow-down" size={24} color="#666" />
        </TouchableOpacity>

        {false && (
          <View style={styles.dropdownOptions}>
            {[
              '4\'8" (142 cm)',
              '4\'9" (145 cm)',
              '4\'10" (147 cm)',
              '4\'11" (150 cm)',
              '5\'0" (152 cm)',
              '5\'1" (155 cm)',
              '5\'2" (157 cm)',
              '5\'3" (160 cm)',
              '5\'4" (163 cm)',
              '5\'5" (165 cm)',
              '5\'6" (168 cm)',
              '5\'7" (170 cm)',
              '5\'8" (173 cm)',
              '5\'9" (175 cm)',
              '5\'10" (178 cm)',
              '5\'11" (180 cm)',
              '6\'0" (183 cm)',
              '6\'1" (185 cm)',
              '6\'2" (188 cm)',
              '6\'3" (191 cm)',
              '6\'4" (193 cm)',
              '6\'5" (196 cm)',
              '6\'6" (198 cm)',
              '6\'7" (201 cm)',
              '6\'8" (203 cm)',
              '6\'9" (206 cm)',
              '6\'10" (208 cm)',
              '6\'11" (211 cm)',
              '7\'0" (213 cm)',
            ].map(option => (
              <TouchableOpacity
                key={option}
                style={styles.dropdownOption}
                onPress={() => {
                  setValue('height', option);
                  // Removed old dropdown
                }}
              >
                <Text style={styles.dropdownOptionText}>{option}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <Controller
        control={control}
        name="smoking"
        rules={{}}
        render={({ fieldState: { error } }) => (
          <View style={styles.fieldContainer}>
            {error && <Text style={styles.errorText}>{error.message}</Text>}
            <View style={styles.pickerContainer}>
              <Text style={styles.label}>Smoking</Text>
              <View style={styles.pickerButtons}>
                {['Yes', 'No', 'Occasionally', 'Trying to Quit'].map(option => (
                  <TouchableOpacity
                    key={option}
                    style={[styles.pickerButton, smoking === option && styles.pickerButtonActive]}
                    onPress={() => {
                      setValue('smoking', option);
                      trigger('smoking');
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerButtonText,
                        smoking === option && styles.pickerButtonTextActive,
                      ]}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}
      />

      <Controller
        control={control}
        name="drinking"
        rules={{}}
        render={({ fieldState: { error } }) => (
          <View style={styles.fieldContainer}>
            {error && <Text style={styles.errorText}>{error.message}</Text>}
            <View style={styles.pickerContainer}>
              <Text style={styles.label}>Drinking</Text>
              <View style={styles.pickerButtons}>
                {['Yes', 'No', 'Occasionally', 'Socially'].map(option => (
                  <TouchableOpacity
                    key={option}
                    style={[styles.pickerButton, drinking === option && styles.pickerButtonActive]}
                    onPress={() => {
                      setValue('drinking', option);
                      trigger('drinking');
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerButtonText,
                        drinking === option && styles.pickerButtonTextActive,
                      ]}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}
      />

      <View style={styles.fieldContainer}>
        <Text style={styles.label}>Pets</Text>
        <TextInput
          style={styles.input}
          placeholder="Do you have any pets?"
          value={pets}
          onChangeText={text => setValue('pets', text)}
        />
      </View>

      <Controller
        control={control}
        name="travel"
        rules={{}}
        render={({ fieldState: { error } }) => (
          <View style={styles.fieldContainer}>
            {error && <Text style={styles.errorText}>{error.message}</Text>}
            <View style={styles.pickerContainer}>
              <Text style={styles.label}>Travel Frequency</Text>
              <View style={styles.pickerButtons}>
                {['Frequent', 'Occasional', 'Rarely', 'Never'].map(option => (
                  <TouchableOpacity
                    key={option}
                    style={[styles.pickerButton, travel === option && styles.pickerButtonActive]}
                    onPress={() => {
                      setValue('travel', option);
                      trigger('travel');
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerButtonText,
                        travel === option && styles.pickerButtonTextActive,
                      ]}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}
      />

      <View style={styles.fieldContainer}>
        <Text style={styles.label}>Interests and Hobbies</Text>
        <TextInput
          style={styles.input}
          placeholder="What do you enjoy doing?"
          value={interests}
          onChangeText={text => setValue('interests', text)}
        />
      </View>

      <Text style={styles.label}>Languages I speak</Text>
      <TouchableOpacity style={styles.dropdownButton} onPress={() => setShowLanguagesPanel(true)}>
        <Text
          style={
            languages.length > 0 ? styles.dropdownButtonText : styles.dropdownButtonPlaceholder
          }
        >
          {languages.length > 0 ? `${languages.length} languages selected` : 'Select languages'}
        </Text>
        <MaterialIcons name="keyboard-arrow-down" size={24} color="#666" />
      </TouchableOpacity>

      {/* Selected Languages Bubbles */}
      {languages.length > 0 && (
        <View style={styles.selectedLanguagesContainer}>
          <Text style={styles.label}>Selected Languages:</Text>
          <View style={styles.languageBubbles}>
            {languages.map(language => (
              <View key={language} style={styles.languageBubble}>
                <Text style={styles.languageBubbleText}>{language}</Text>
                <TouchableOpacity
                  onPress={() => {
                    const currentLanguages = languages;
                    const newLanguages = currentLanguages.filter(l => l !== language);
                    setValue('languages', newLanguages);
                  }}
                >
                  <Text style={styles.languageBubbleRemove}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={styles.pickerContainer}>
        <Text style={styles.label}>Looking for</Text>
        <View style={styles.pickerButtons}>
          {['Casual', 'Serious', 'Friendship', 'Marriage'].map(option => (
            <TouchableOpacity
              key={option}
              style={[
                styles.pickerButton,
                relationshipType.includes(option) && styles.pickerButtonActive,
              ]}
              onPress={() => {
                const currentTypes = relationshipType;
                const newTypes = currentTypes.includes(option)
                  ? currentTypes.filter(t => t !== option)
                  : [...currentTypes, option];
                setValue('relationshipType', newTypes);
              }}
            >
              <Text
                style={[
                  styles.pickerButtonText,
                  relationshipType.includes(option) && styles.pickerButtonTextActive,
                ]}
              >
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      default:
        return renderStep1();
    }
  };

  return (
    <View style={styles.container}>
      {renderProgressBar()}

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderCurrentStep()}
      </ScrollView>

      <View style={[styles.navigation, { paddingBottom: insets.bottom + 20 }]}>
        {currentStep > 1 && (
          <TouchableOpacity style={styles.navButton} onPress={prevStep}>
            <Text style={styles.navButtonText}>Back</Text>
          </TouchableOpacity>
        )}

        {currentStep < 3 ? (
          <TouchableOpacity style={styles.navButton} onPress={nextStep}>
            <Text style={styles.navButtonText}>Next</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.navButton, styles.registerButton]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.registerButtonText}>Create Account</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={watch('birthDate') ? new Date(watch('birthDate')) : new Date()}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) {
              const formattedDate = selectedDate.toISOString().split('T')[0];
              setValue('birthDate', formattedDate);
              trigger('birthDate'); // Clear validation error immediately
            }
          }}
          maximumDate={new Date()}
          minimumDate={new Date(1900, 0, 1)}
        />
      )}

      <SelectionPanel
        visible={showInterestedInPanel}
        onClose={() => setShowInterestedInPanel(false)}
        title="I am interested in"
        options={['Men', 'Women', 'Everyone']}
        selectedValues={
          interestedIn ? [interestedIn.charAt(0).toUpperCase() + interestedIn.slice(1)] : []
        }
        onSelect={selected => {
          setValue('interestedIn', selected.toLowerCase());
          trigger('interestedIn'); // Clear validation error
        }}
        multiSelect={false}
      />

      <SelectionPanel
        visible={showEducationPanel}
        onClose={() => setShowEducationPanel(false)}
        title="Education Level"
        options={[
          'High School',
          'Some College',
          "Bachelor's Degree",
          "Master's Degree",
          'PhD',
          'Other',
        ]}
        selectedValues={education ? [education] : []}
        onSelect={selected => {
          setValue('education', selected);
          trigger('education'); // Clear validation error
          setShowEducationPanel(false);
        }}
        multiSelect={false}
      />

      <SelectionPanel
        visible={showReligionPanel}
        onClose={() => setShowReligionPanel(false)}
        title="Religion"
        options={[
          'Christian',
          'Muslim',
          'Jewish',
          'Hindu',
          'Buddhist',
          'Atheist',
          'Agnostic',
          'Other',
        ]}
        selectedValues={religion ? [religion] : []}
        onSelect={selected => {
          setValue('religion', selected);
          trigger('religion'); // Clear validation error
          setShowReligionPanel(false);
        }}
        multiSelect={false}
      />

      <SelectionPanel
        visible={showHeightPanel}
        onClose={() => setShowHeightPanel(false)}
        title="Height"
        options={[
          '4\'8" (142 cm)',
          '4\'9" (145 cm)',
          '4\'10" (147 cm)',
          '4\'11" (150 cm)',
          '5\'0" (152 cm)',
          '5\'1" (155 cm)',
          '5\'2" (157 cm)',
          '5\'3" (160 cm)',
          '5\'4" (163 cm)',
          '5\'5" (165 cm)',
          '5\'6" (168 cm)',
          '5\'7" (170 cm)',
          '5\'8" (173 cm)',
          '5\'9" (175 cm)',
          '5\'10" (178 cm)',
          '5\'11" (180 cm)',
          '6\'0" (183 cm)',
          '6\'1" (185 cm)',
          '6\'2" (188 cm)',
          '6\'3" (191 cm)',
          '6\'4" (193 cm)',
          '6\'5" (196 cm)',
          '6\'6" (198 cm)',
          '6\'7" (201 cm)',
        ]}
        selectedValues={height ? [height] : []}
        onSelect={selected => {
          setValue('height', selected);
          trigger('height'); // Clear validation error
          setShowHeightPanel(false);
        }}
        multiSelect={false}
      />

      <SelectionPanel
        visible={showLanguagesPanel}
        onClose={() => setShowLanguagesPanel(false)}
        title="Languages I speak"
        options={[
          'English',
          'Armenian (Western)',
          'Armenian (Eastern)',
          'Arabic',
          'French',
          'Spanish',
          'German',
          'Russian',
          'Italian',
          'Other',
        ]}
        selectedValues={languages}
        onSelect={selectedLanguages => {
          setValue('languages', selectedLanguages);
          trigger('languages'); // Clear validation error
        }}
        multiSelect={true}
      />

      <SelectionPanel
        visible={showRelationshipPanel}
        onClose={() => setShowRelationshipPanel(false)}
        title="Relationship Goals"
        options={['Casual Dating', 'Serious Relationship', 'Marriage', 'Friendship', 'Networking']}
        selectedValues={relationshipType}
        onSelect={selected => {
          const currentTypes = relationshipType;
          const newTypes = currentTypes.includes(selected)
            ? currentTypes.filter(t => t !== selected)
            : [...currentTypes, selected];
          setValue('relationshipType', newTypes);
          trigger('relationshipType'); // Clear validation error
        }}
        multiSelect={true}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  progressContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  progressHeader: {
    marginBottom: 15,
  },
  progressTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  progressSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 5,
  },
  progressBarContainer: {
    marginTop: 10,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#E5E5EA',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 3,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  stepContainer: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  stepSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
  },
  inputError: {
    borderColor: '#ff0000',
  },
  fieldContainer: {
    marginBottom: 15,
  },
  errorText: {
    color: '#ff0000',
    fontSize: 12,
    marginBottom: 5,
    marginLeft: 5,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 16,
    color: '#333',
  },
  datePlaceholder: {
    fontSize: 16,
    color: '#999',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  passwordInput: {
    flex: 1,
    padding: 15,
    fontSize: 16,
  },
  eyeButton: {
    padding: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  genderContainer: {
    marginBottom: 20,
  },
  genderButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  genderButton: {
    flex: 1,
    padding: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  genderButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  genderButtonText: {
    fontSize: 16,
    color: '#666',
  },
  genderButtonTextActive: {
    color: '#fff',
  },
  photosContainer: {
    marginBottom: 20,
  },
  photoContainer: {
    marginRight: 10,
    position: 'relative',
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  removePhotoButton: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoButton: {
    width: 100,
    height: 100,
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoText: {
    marginTop: 5,
    color: '#666',
    fontSize: 12,
  },
  pickerContainer: {
    marginBottom: 20,
  },
  pickerButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  pickerButton: {
    flex: 1,
    minWidth: '48%',
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  pickerButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  pickerButtonText: {
    fontSize: 14,
    color: '#666',
  },
  pickerButtonTextActive: {
    color: '#fff',
  },
  selectedLanguagesContainer: {
    marginTop: 20,
  },
  languageBubbles: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  languageBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  languageBubbleText: {
    color: '#fff',
    fontSize: 14,
    marginRight: 5,
  },
  languageBubbleRemove: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  navButton: {
    flex: 1,
    padding: 15,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  registerButton: {
    backgroundColor: '#34C759',
  },
  navButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    backgroundColor: '#fff',
    marginBottom: 5,
  },
  dropdownButtonText: {
    fontSize: 16,
    color: '#333',
  },
  dropdownButtonPlaceholder: {
    fontSize: 16,
    color: '#999',
  },
  dropdownOptions: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
    maxHeight: 200,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dropdownOption: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownOptionText: {
    fontSize: 16,
    color: '#333',
  },
});

export default EnhancedRegisterScreen;
