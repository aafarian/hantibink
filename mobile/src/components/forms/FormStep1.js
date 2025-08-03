import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Image,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Controller } from 'react-hook-form';
import { HelperText } from 'react-native-paper';
import SelectionPanel from '../SelectionPanel';

const FormStep1 = ({ control, errors, setValue, trigger, watch, styles: parentStyles, width }) => {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showInterestedInPanel, setShowInterestedInPanel] = useState(false);

  const photos = watch('photos') || [];
  const birthDate = watch('birthDate');
  const interestedIn = watch('interestedIn') || [];

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert('Sorry, we need camera roll permissions to make this work!');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const newPhotos = [...photos, result.assets[0].uri];
      setValue('photos', newPhotos);
      trigger('photos');
    }
  };

  const removePhoto = index => {
    const newPhotos = photos.filter((_, i) => i !== index);
    setValue('photos', newPhotos);
    trigger('photos');
  };

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setValue('birthDate', selectedDate);
      trigger('birthDate');
    }
  };

  const formatDate = date => {
    if (!date) {
      return 'Select your birthday';
    }
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <View style={parentStyles.stepContainer}>
      <Text style={parentStyles.stepTitle}>Let's start with the basics</Text>

      {/* Name Field */}
      <View style={parentStyles.fieldContainer}>
        <Text style={parentStyles.label}>Name *</Text>
        <Controller
          control={control}
          name="name"
          rules={{ required: 'Name is required' }}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={[parentStyles.input, errors.name && parentStyles.inputError]}
              placeholder="Enter your name"
              value={value}
              onBlur={onBlur}
              onChangeText={text => {
                onChange(text);
                if (errors.name) {
                  trigger('name');
                }
              }}
            />
          )}
        />
        {errors.name && <HelperText type="error">{errors.name.message}</HelperText>}
      </View>

      {/* Email Field */}
      <View style={parentStyles.fieldContainer}>
        <Text style={parentStyles.label}>Email *</Text>
        <Controller
          control={control}
          name="email"
          rules={{
            required: 'Email is required',
            pattern: {
              value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
              message: 'Invalid email address',
            },
          }}
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={[parentStyles.input, errors.email && parentStyles.inputError]}
              placeholder="Enter your email"
              value={value}
              onBlur={onBlur}
              onChangeText={text => {
                onChange(text);
                if (errors.email) {
                  trigger('email');
                }
              }}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          )}
        />
        {errors.email && <HelperText type="error">{errors.email.message}</HelperText>}
      </View>

      {/* Password Field */}
      <View style={parentStyles.fieldContainer}>
        <Text style={parentStyles.label}>Password *</Text>
        <View style={parentStyles.passwordContainer}>
          <Controller
            control={control}
            name="password"
            rules={{
              required: 'Password is required',
              minLength: {
                value: 6,
                message: 'Password must be at least 6 characters',
              },
            }}
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[parentStyles.passwordInput, errors.password && parentStyles.inputError]}
                placeholder="Enter your password"
                value={value}
                onBlur={onBlur}
                onChangeText={text => {
                  onChange(text);
                  if (errors.password) {
                    trigger('password');
                  }
                }}
                secureTextEntry={!showPassword}
              />
            )}
          />
          <TouchableOpacity
            style={parentStyles.eyeButton}
            onPress={() => setShowPassword(!showPassword)}
          >
            <MaterialIcons
              name={showPassword ? 'visibility' : 'visibility-off'}
              size={20}
              color="#666"
            />
          </TouchableOpacity>
        </View>
        {errors.password && <HelperText type="error">{errors.password.message}</HelperText>}
      </View>

      {/* Confirm Password Field */}
      <View style={parentStyles.fieldContainer}>
        <Text style={parentStyles.label}>Confirm Password *</Text>
        <View style={parentStyles.passwordContainer}>
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
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[
                  parentStyles.passwordInput,
                  errors.confirmPassword && parentStyles.inputError,
                ]}
                placeholder="Confirm your password"
                value={value}
                onBlur={onBlur}
                onChangeText={text => {
                  onChange(text);
                  if (errors.confirmPassword) {
                    trigger('confirmPassword');
                  }
                }}
                secureTextEntry={!showConfirmPassword}
              />
            )}
          />
          <TouchableOpacity
            style={parentStyles.eyeButton}
            onPress={() => setShowConfirmPassword(!showConfirmPassword)}
          >
            <MaterialIcons
              name={showConfirmPassword ? 'visibility' : 'visibility-off'}
              size={20}
              color="#666"
            />
          </TouchableOpacity>
        </View>
        {errors.confirmPassword && (
          <HelperText type="error">{errors.confirmPassword.message}</HelperText>
        )}
      </View>

      {/* Birthday Field */}
      <View style={parentStyles.fieldContainer}>
        <Text style={parentStyles.label}>Birthday *</Text>
        <TouchableOpacity
          style={[
            parentStyles.input,
            parentStyles.dateButton,
            errors.birthDate && parentStyles.inputError,
          ]}
          onPress={() => setShowDatePicker(true)}
        >
          <Text style={[parentStyles.dateText, !birthDate && parentStyles.placeholderText]}>
            {formatDate(birthDate)}
          </Text>
          <MaterialIcons name="event" size={20} color="#666" />
        </TouchableOpacity>
        {errors.birthDate && <HelperText type="error">{errors.birthDate.message}</HelperText>}
      </View>

      {/* Gender Selection */}
      <View style={parentStyles.fieldContainer}>
        <Text style={parentStyles.label}>I am *</Text>
        <Controller
          control={control}
          name="gender"
          rules={{ required: 'Please select your gender' }}
          render={({ field: { onChange, value } }) => (
            <View style={parentStyles.bubbleContainer}>
              {['male', 'female', 'non-binary'].map(option => (
                <TouchableOpacity
                  key={option}
                  style={[parentStyles.bubble, value === option && parentStyles.selectedBubble]}
                  onPress={() => {
                    onChange(option);
                    if (errors.gender) {
                      trigger('gender');
                    }
                  }}
                >
                  <Text
                    style={[
                      parentStyles.bubbleText,
                      value === option && parentStyles.selectedBubbleText,
                    ]}
                  >
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        />
        {errors.gender && <HelperText type="error">{errors.gender.message}</HelperText>}
      </View>

      {/* Interested In Selection */}
      <View style={parentStyles.fieldContainer}>
        <Text style={parentStyles.label}>Interested in *</Text>
        <TouchableOpacity
          style={[
            parentStyles.input,
            parentStyles.dateButton,
            errors.interestedIn && parentStyles.inputError,
          ]}
          onPress={() => setShowInterestedInPanel(true)}
        >
          <Text
            style={[
              parentStyles.dateText,
              interestedIn.length === 0 && parentStyles.placeholderText,
            ]}
          >
            {interestedIn.length > 0 ? interestedIn.join(', ') : "Select who you're interested in"}
          </Text>
          <MaterialIcons name="arrow-drop-down" size={20} color="#666" />
        </TouchableOpacity>
        {errors.interestedIn && <HelperText type="error">{errors.interestedIn.message}</HelperText>}
      </View>

      {/* Photo Upload */}
      <View style={parentStyles.fieldContainer}>
        <Text style={parentStyles.label}>Add Photos *</Text>
        <View style={parentStyles.photoGrid}>
          {photos.map((photo, index) => (
            <View key={index} style={parentStyles.photoContainer}>
              <Image source={{ uri: photo }} style={parentStyles.photoThumbnail} />
              <TouchableOpacity
                style={parentStyles.removePhotoButton}
                onPress={() => removePhoto(index)}
              >
                <MaterialIcons name="close" size={16} color="white" />
              </TouchableOpacity>
            </View>
          ))}
          {photos.length < 6 && (
            <TouchableOpacity style={parentStyles.addPhotoButton} onPress={pickImage}>
              <MaterialIcons name="add" size={30} color="#666" />
              <Text style={parentStyles.addPhotoText}>Add Photo</Text>
            </TouchableOpacity>
          )}
        </View>
        {errors.photos && <HelperText type="error">{errors.photos.message}</HelperText>}
      </View>

      {/* Date Picker Modal */}
      {showDatePicker && (
        <DateTimePicker
          value={birthDate || new Date(2000, 0, 1)}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={onDateChange}
          maximumDate={new Date(2006, 11, 31)}
          minimumDate={new Date(1940, 0, 1)}
        />
      )}

      {/* Interested In Selection Modal */}
      <Modal
        visible={showInterestedInPanel}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowInterestedInPanel(false)}
      >
        <SelectionPanel
          title="Interested in"
          options={['Men', 'Women', 'Non-binary']}
          selectedOptions={interestedIn}
          onSelect={selectedOptions => {
            setValue('interestedIn', selectedOptions);
            if (errors.interestedIn) {
              trigger('interestedIn');
            }
          }}
          onClose={() => setShowInterestedInPanel(false)}
          multiSelect={true}
        />
      </Modal>
    </View>
  );
};

export default FormStep1;
