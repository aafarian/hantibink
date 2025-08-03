import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Controller } from 'react-hook-form';
import { HelperText } from 'react-native-paper';
import SelectionPanel from '../SelectionPanel';

const FormStep3 = ({ control, errors, setValue, trigger, watch, styles: parentStyles }) => {
  const [showLanguagesPanel, setShowLanguagesPanel] = useState(false);

  const smoking = watch('smoking') || '';
  const drinking = watch('drinking') || '';
  const travel = watch('travel') || '';
  const languages = watch('languages') || [];
  const relationshipType = watch('relationshipType') || [];
  const pets = watch('pets') || '';
  const interests = watch('interests') || '';

  const languageOptions = [
    'Armenian',
    'English',
    'Spanish',
    'French',
    'Arabic',
    'Russian',
    'Persian',
    'Turkish',
    'German',
    'Italian',
    'Portuguese',
    'Other',
  ];

  return (
    <View style={parentStyles.stepContainer}>
      <Text style={parentStyles.stepTitle}>Profile Details (Optional)</Text>

      {/* Smoking */}
      <View style={parentStyles.fieldContainer}>
        <Text style={parentStyles.label}>Smoking</Text>
        <Controller
          control={control}
          name="smoking"
          render={({ field: { onChange, value } }) => (
            <View style={parentStyles.bubbleContainer}>
              {['No', 'Sometimes', 'Yes'].map(option => (
                <TouchableOpacity
                  key={option}
                  style={[parentStyles.bubble, value === option && parentStyles.selectedBubble]}
                  onPress={() => {
                    onChange(option);
                    if (errors.smoking) {
                      trigger('smoking');
                    }
                  }}
                >
                  <Text
                    style={[
                      parentStyles.bubbleText,
                      value === option && parentStyles.selectedBubbleText,
                    ]}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        />
        {errors.smoking && <HelperText type="error">{errors.smoking.message}</HelperText>}
      </View>

      {/* Drinking */}
      <View style={parentStyles.fieldContainer}>
        <Text style={parentStyles.label}>Drinking</Text>
        <Controller
          control={control}
          name="drinking"
          render={({ field: { onChange, value } }) => (
            <View style={parentStyles.bubbleContainer}>
              {['No', 'Sometimes', 'Yes'].map(option => (
                <TouchableOpacity
                  key={option}
                  style={[parentStyles.bubble, value === option && parentStyles.selectedBubble]}
                  onPress={() => {
                    onChange(option);
                    if (errors.drinking) {
                      trigger('drinking');
                    }
                  }}
                >
                  <Text
                    style={[
                      parentStyles.bubbleText,
                      value === option && parentStyles.selectedBubbleText,
                    ]}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        />
        {errors.drinking && <HelperText type="error">{errors.drinking.message}</HelperText>}
      </View>

      {/* Travel Frequency */}
      <View style={parentStyles.fieldContainer}>
        <Text style={parentStyles.label}>Travel Frequency</Text>
        <Controller
          control={control}
          name="travel"
          render={({ field: { onChange, value } }) => (
            <View style={parentStyles.bubbleContainer}>
              {['Rarely', 'Occasional', 'Frequent'].map(option => (
                <TouchableOpacity
                  key={option}
                  style={[parentStyles.bubble, value === option && parentStyles.selectedBubble]}
                  onPress={() => {
                    onChange(option);
                    if (errors.travel) {
                      trigger('travel');
                    }
                  }}
                >
                  <Text
                    style={[
                      parentStyles.bubbleText,
                      value === option && parentStyles.selectedBubbleText,
                    ]}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        />
        {errors.travel && <HelperText type="error">{errors.travel.message}</HelperText>}
      </View>

      {/* Pets */}
      <View style={parentStyles.fieldContainer}>
        <Text style={parentStyles.label}>Pets</Text>
        <Controller
          control={control}
          name="pets"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={[parentStyles.input, errors.pets && parentStyles.inputError]}
              placeholder="Do you have any pets?"
              value={value}
              onBlur={onBlur}
              onChangeText={text => {
                onChange(text);
                if (errors.pets) {
                  trigger('pets');
                }
              }}
            />
          )}
        />
        {errors.pets && <HelperText type="error">{errors.pets.message}</HelperText>}
      </View>

      {/* Interests and Hobbies */}
      <View style={parentStyles.fieldContainer}>
        <Text style={parentStyles.label}>Interests and Hobbies</Text>
        <Controller
          control={control}
          name="interests"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={[
                parentStyles.input,
                parentStyles.textArea,
                errors.interests && parentStyles.inputError,
              ]}
              placeholder="What do you enjoy doing?"
              value={value}
              onBlur={onBlur}
              onChangeText={text => {
                onChange(text);
                if (errors.interests) {
                  trigger('interests');
                }
              }}
              multiline={true}
              numberOfLines={3}
              textAlignVertical="top"
            />
          )}
        />
        {errors.interests && <HelperText type="error">{errors.interests.message}</HelperText>}
      </View>

      {/* Languages */}
      <View style={parentStyles.fieldContainer}>
        <Text style={parentStyles.label}>Languages I speak</Text>
        <TouchableOpacity
          style={[
            parentStyles.input,
            parentStyles.dateButton,
            errors.languages && parentStyles.inputError,
          ]}
          onPress={() => setShowLanguagesPanel(true)}
        >
          <Text
            style={[parentStyles.dateText, languages.length === 0 && parentStyles.placeholderText]}
          >
            {languages.length > 0 ? languages.join(', ') : 'Select languages you speak'}
          </Text>
          <MaterialIcons name="arrow-drop-down" size={20} color="#666" />
        </TouchableOpacity>
        {errors.languages && <HelperText type="error">{errors.languages.message}</HelperText>}
      </View>

      {/* Looking For */}
      <View style={parentStyles.fieldContainer}>
        <Text style={parentStyles.label}>Looking for</Text>
        <Controller
          control={control}
          name="relationshipType"
          render={({ field: { onChange, value } }) => (
            <View style={parentStyles.bubbleContainer}>
              {['Casual', 'Serious', 'Friends', 'Networking'].map(option => (
                <TouchableOpacity
                  key={option}
                  style={[
                    parentStyles.bubble,
                    (value || []).includes(option) && parentStyles.selectedBubble,
                  ]}
                  onPress={() => {
                    const currentValues = value || [];
                    const newValues = currentValues.includes(option)
                      ? currentValues.filter(v => v !== option)
                      : [...currentValues, option];
                    onChange(newValues);
                    if (errors.relationshipType) {
                      trigger('relationshipType');
                    }
                  }}
                >
                  <Text
                    style={[
                      parentStyles.bubbleText,
                      (value || []).includes(option) && parentStyles.selectedBubbleText,
                    ]}
                  >
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        />
        {errors.relationshipType && (
          <HelperText type="error">{errors.relationshipType.message}</HelperText>
        )}
      </View>

      {/* Languages Selection Modal */}
      <Modal
        visible={showLanguagesPanel}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowLanguagesPanel(false)}
      >
        <SelectionPanel
          title="Languages I speak"
          options={languageOptions}
          selectedOptions={languages}
          onSelect={selectedOptions => {
            setValue('languages', selectedOptions);
            if (errors.languages) {
              trigger('languages');
            }
          }}
          onClose={() => setShowLanguagesPanel(false)}
          multiSelect={true}
        />
      </Modal>
    </View>
  );
};

export default FormStep3;
