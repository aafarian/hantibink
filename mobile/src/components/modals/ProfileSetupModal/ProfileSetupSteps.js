import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../../styles/theme';

/**
 * BirthDateStep - Collects user's birth date for age verification
 */
export const BirthDateStep = ({
  birthDate,
  showDatePicker,
  setShowDatePicker,
  onBirthDateChange,
}) => {
  // Default date for picker (25 years ago)
  const defaultDate = new Date();
  defaultDate.setFullYear(defaultDate.getFullYear() - 25);

  // Min date (100 years ago)
  const minDate = new Date();
  minDate.setFullYear(minDate.getFullYear() - 100);

  // Max date (18 years ago)
  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() - 18);

  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>When's your birthday?</Text>
      <Text style={styles.helperText}>You must be at least 18 years old</Text>

      {Platform.OS === 'android' && !showDatePicker && (
        <TouchableOpacity style={styles.datePickerButton} onPress={() => setShowDatePicker(true)}>
          <Ionicons name="calendar" size={24} color={theme.colors.primary} />
          <Text style={styles.datePickerButtonText}>
            {birthDate
              ? birthDate.toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })
              : 'Select your birthday'}
          </Text>
        </TouchableOpacity>
      )}

      {(Platform.OS === 'ios' || showDatePicker) && (
        <View style={styles.datePickerContainer}>
          <DateTimePicker
            value={birthDate || defaultDate}
            mode="date"
            display="spinner"
            onChange={onBirthDateChange}
            minimumDate={minDate}
            maximumDate={maxDate}
            style={styles.datePicker}
          />
        </View>
      )}
    </View>
  );
};

/**
 * GenderStep - Collects user's gender selection
 */
export const GenderStep = ({ gender, onGenderSelect }) => {
  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>What's your gender?</Text>
      <View style={styles.optionsContainer}>
        {['MAN', 'WOMAN', 'OTHER'].map(option => (
          <TouchableOpacity
            key={option}
            style={[styles.optionButton, gender === option && styles.optionButtonSelected]}
            onPress={() => onGenderSelect(option)}
          >
            <Text style={[styles.optionText, gender === option && styles.optionTextSelected]}>
              {option.charAt(0) + option.slice(1).toLowerCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

/**
 * InterestedInStep - Collects user's dating preferences
 */
export const InterestedInStep = ({ interestedIn, onInterestedInToggle }) => {
  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Who are you interested in?</Text>
      <View style={styles.optionsContainer}>
        {['MAN', 'WOMAN'].map(option => (
          <TouchableOpacity
            key={option}
            style={[
              styles.optionButton,
              interestedIn.includes(option) && styles.optionButtonSelected,
            ]}
            onPress={() => onInterestedInToggle(option)}
          >
            <Text
              style={[
                styles.optionText,
                interestedIn.includes(option) && styles.optionTextSelected,
              ]}
            >
              {option === 'MAN' ? 'Men' : 'Women'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.helperText}>Select all that apply</Text>
    </View>
  );
};

/**
 * PhotosStep - Handles photo selection and display
 */
export const PhotosStep = ({ photos, onPhotoSelect, onPhotoRemove, uploadingPhotos }) => {
  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Add your photos</Text>
      <Text style={styles.helperText}>Add at least 1 photo to continue</Text>

      <View style={styles.photosGrid}>
        {photos.map((photo, index) => (
          <View key={index} style={styles.photoContainer}>
            <Image source={{ uri: photo.uri || photo.url || photo }} style={styles.photo} />
            <TouchableOpacity style={styles.removePhotoButton} onPress={() => onPhotoRemove(index)}>
              <Ionicons name="close-circle" size={24} color="#FF3B30" />
            </TouchableOpacity>
          </View>
        ))}

        {photos.length < 6 && (
          <TouchableOpacity
            style={styles.addPhotoButton}
            onPress={onPhotoSelect}
            disabled={uploadingPhotos}
          >
            <Ionicons name="add" size={40} color={theme.colors.primary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

/**
 * LocationStep - Displays location detection status
 */
export const LocationStep = ({ location }) => {
  return (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>
        {location ? 'Location detected!' : 'Finding your location'}
      </Text>
      <Text style={styles.helperText}>
        {location
          ? "We'll use this to show you matches nearby"
          : 'We need your location to show you potential matches nearby'}
      </Text>

      {location ? (
        <>
          <View style={styles.locationContainer}>
            <Ionicons name="location" size={24} color={theme.colors.primary} />
            <Text style={styles.locationText}>{location}</Text>
          </View>
          <Text style={styles.locationAutoProgressText}>Continuing automatically...</Text>
        </>
      ) : (
        <View style={styles.locationLoadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.locationLoadingText}>Detecting your location...</Text>
        </View>
      )}
    </View>
  );
};

/**
 * LoadingStep - Shown when step data is undefined (during state transitions)
 */
export const LoadingStep = () => {
  return (
    <View style={styles.stepContent}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
    </View>
  );
};

const styles = StyleSheet.create({
  stepContent: {
    paddingTop: 10,
  },
  stepTitle: {
    fontSize: 32,
    fontWeight: '800',
    fontFamily: theme.typography.fontFamily.bold,
    marginBottom: 8,
    textAlign: 'center',
    color: '#1A1A1A',
  },
  helperText: {
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.regular,
    color: '#777',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 35,
    padding: 18,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#F0F0F0',
    backgroundColor: '#FAFAFA',
    gap: 12,
  },
  datePickerButtonText: {
    fontSize: 17,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamily.semibold,
    color: '#444',
  },
  datePickerContainer: {
    marginTop: 25,
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    padding: 10,
  },
  datePicker: {
    width: '100%',
    height: 180,
  },
  optionsContainer: {
    marginTop: 35,
    gap: 12,
  },
  optionButton: {
    padding: 18,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#F0F0F0',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  optionButtonSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: '#FFF5F5',
  },
  optionText: {
    fontSize: 17,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamily.semibold,
    color: '#444',
  },
  optionTextSelected: {
    color: theme.colors.primary,
    fontWeight: '700',
    fontFamily: theme.typography.fontFamily.bold,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 35,
    justifyContent: 'center',
  },
  photoContainer: {
    width: 100,
    height: 133,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  removePhotoButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
  },
  addPhotoButton: {
    width: 100,
    height: 133,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.colors.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF5F5',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
    padding: 20,
    backgroundColor: '#FFF5F5',
    borderRadius: 16,
    gap: 10,
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  locationText: {
    fontSize: 17,
    fontWeight: '600',
    fontFamily: theme.typography.fontFamily.semibold,
    color: theme.colors.primary,
  },
  locationLoadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
    padding: 30,
  },
  locationLoadingText: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.secondary,
    marginTop: 15,
  },
  locationAutoProgressText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.muted,
    marginTop: 15,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
