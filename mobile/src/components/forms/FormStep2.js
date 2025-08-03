import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Controller } from 'react-hook-form';
import { HelperText } from 'react-native-paper';
import SelectionPanel from '../SelectionPanel';

const FormStep2 = ({ control, errors, setValue, trigger, watch, styles: parentStyles }) => {
  const [showEducationPanel, setShowEducationPanel] = useState(false);
  const [showReligionPanel, setShowReligionPanel] = useState(false);
  const [showHeightPanel, setShowHeightPanel] = useState(false);

  const education = watch('education') || '';
  const religion = watch('religion') || '';
  const height = watch('height') || '';

  const educationOptions = [
    'High School',
    'Some College',
    "Bachelor's Degree",
    "Master's Degree",
    'PhD',
    'Trade School',
    'Other',
  ];

  const religionOptions = [
    'Armenian Apostolic',
    'Armenian Catholic',
    'Armenian Protestant',
    'Other Christian',
    'Muslim',
    'Jewish',
    'Buddhist',
    'Hindu',
    'Agnostic',
    'Atheist',
    'Spiritual',
    'Other',
    'Prefer not to say',
  ];

  const heightOptions = [];
  for (let feet = 4; feet <= 7; feet++) {
    for (let inches = 0; inches < 12; inches++) {
      if (feet === 4 && inches < 6) {
        continue;
      }
      if (feet === 7 && inches > 6) {
        continue;
      }
      const totalInches = feet * 12 + inches;
      const cm = Math.round(totalInches * 2.54);
      heightOptions.push(`${feet}'${inches}" (${cm} cm)`);
    }
  }

  return (
    <View style={parentStyles.stepContainer}>
      <Text style={parentStyles.stepTitle}>Tell us more about yourself</Text>

      {/* Bio Field */}
      <View style={parentStyles.fieldContainer}>
        <Text style={parentStyles.label}>Bio</Text>
        <Controller
          control={control}
          name="bio"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={[
                parentStyles.input,
                parentStyles.textArea,
                errors.bio && parentStyles.inputError,
              ]}
              placeholder="Tell us about yourself..."
              value={value}
              onBlur={onBlur}
              onChangeText={text => {
                onChange(text);
                if (errors.bio) {
                  trigger('bio');
                }
              }}
              multiline={true}
              numberOfLines={4}
              textAlignVertical="top"
            />
          )}
        />
        {errors.bio && <HelperText type="error">{errors.bio.message}</HelperText>}
      </View>

      {/* Profession Field */}
      <View style={parentStyles.fieldContainer}>
        <Text style={parentStyles.label}>Profession</Text>
        <Controller
          control={control}
          name="profession"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={[parentStyles.input, errors.profession && parentStyles.inputError]}
              placeholder="What do you do for work?"
              value={value}
              onBlur={onBlur}
              onChangeText={text => {
                onChange(text);
                if (errors.profession) {
                  trigger('profession');
                }
              }}
            />
          )}
        />
        {errors.profession && <HelperText type="error">{errors.profession.message}</HelperText>}
      </View>

      {/* Education Field */}
      <View style={parentStyles.fieldContainer}>
        <Text style={parentStyles.label}>Education Level</Text>
        <TouchableOpacity
          style={[
            parentStyles.input,
            parentStyles.dateButton,
            errors.education && parentStyles.inputError,
          ]}
          onPress={() => setShowEducationPanel(true)}
        >
          <Text style={[parentStyles.dateText, !education && parentStyles.placeholderText]}>
            {education || 'Select your education level'}
          </Text>
          <MaterialIcons name="arrow-drop-down" size={20} color="#666" />
        </TouchableOpacity>
        {errors.education && <HelperText type="error">{errors.education.message}</HelperText>}
      </View>

      {/* Height Field */}
      <View style={parentStyles.fieldContainer}>
        <Text style={parentStyles.label}>Height</Text>
        <TouchableOpacity
          style={[
            parentStyles.input,
            parentStyles.dateButton,
            errors.height && parentStyles.inputError,
          ]}
          onPress={() => setShowHeightPanel(true)}
        >
          <Text style={[parentStyles.dateText, !height && parentStyles.placeholderText]}>
            {height || 'Select your height'}
          </Text>
          <MaterialIcons name="arrow-drop-down" size={20} color="#666" />
        </TouchableOpacity>
        {errors.height && <HelperText type="error">{errors.height.message}</HelperText>}
      </View>

      {/* Religion Field */}
      <View style={parentStyles.fieldContainer}>
        <Text style={parentStyles.label}>Religion</Text>
        <TouchableOpacity
          style={[
            parentStyles.input,
            parentStyles.dateButton,
            errors.religion && parentStyles.inputError,
          ]}
          onPress={() => setShowReligionPanel(true)}
        >
          <Text style={[parentStyles.dateText, !religion && parentStyles.placeholderText]}>
            {religion || 'Select your religion'}
          </Text>
          <MaterialIcons name="arrow-drop-down" size={20} color="#666" />
        </TouchableOpacity>
        {errors.religion && <HelperText type="error">{errors.religion.message}</HelperText>}
      </View>

      {/* Selection Modals */}
      <Modal
        visible={showEducationPanel}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEducationPanel(false)}
      >
        <SelectionPanel
          title="Education Level"
          options={educationOptions}
          selectedOptions={education ? [education] : []}
          onSelect={selectedOptions => {
            setValue('education', selectedOptions[0] || '');
            if (errors.education) {
              trigger('education');
            }
          }}
          onClose={() => setShowEducationPanel(false)}
          multiSelect={false}
        />
      </Modal>

      <Modal
        visible={showHeightPanel}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowHeightPanel(false)}
      >
        <SelectionPanel
          title="Height"
          options={heightOptions}
          selectedOptions={height ? [height] : []}
          onSelect={selectedOptions => {
            setValue('height', selectedOptions[0] || '');
            if (errors.height) {
              trigger('height');
            }
          }}
          onClose={() => setShowHeightPanel(false)}
          multiSelect={false}
        />
      </Modal>

      <Modal
        visible={showReligionPanel}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowReligionPanel(false)}
      >
        <SelectionPanel
          title="Religion"
          options={religionOptions}
          selectedOptions={religion ? [religion] : []}
          onSelect={selectedOptions => {
            setValue('religion', selectedOptions[0] || '');
            if (errors.religion) {
              trigger('religion');
            }
          }}
          onClose={() => setShowReligionPanel(false)}
          multiSelect={false}
        />
      </Modal>
    </View>
  );
};

export default FormStep2;
