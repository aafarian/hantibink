import React, { useState, useRef, useImperativeHandle, forwardRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import SelectionPanel from '../SelectionPanel';
import { profileFieldsConfig, transformProfileData } from './ProfileFieldsConfig';

/**
 * Reusable ProfileForm component
 * Used for both registration and profile editing
 */
const ProfileForm = forwardRef(
  (
    {
      initialData = {},
      onDataChange,
      showPhotosSection = false,
      photosComponent = null,
      excludeFields = [], // Fields to exclude from rendering
      style,
      children, // Additional custom content
    },
    ref
  ) => {
    const [formData, setFormData] = useState(() => ({
      name: '',
      bio: '',
      education: '',
      profession: '',
      height: '',
      relationshipType: [],
      religion: '',
      smoking: '',
      drinking: '',
      travel: '',
      pets: '',
      interests: [],
      ...transformProfileData.fromApi(initialData),
    }));

    // Selection panel states
    const [selectionPanels, setSelectionPanels] = useState({});

    // Scroll control state
    const [scrollEnabled, setScrollEnabled] = useState(true);

    // Text input refs for auto-advance
    const textRefs = useRef({});
    const scrollViewRef = useRef(null);

    // Expose methods to parent component
    useImperativeHandle(ref, () => ({
      getFormData: () => transformProfileData.toApi(formData),
      setFormData: data => setFormData(transformProfileData.fromApi(data)),
      validateForm: () => validateForm(),
      scrollToTop: () => scrollViewRef.current?.scrollTo({ y: 0, animated: true }),
      setScrollEnabled: enabled => setScrollEnabled(enabled),
    }));

    // Update form data and notify parent
    const updateFormData = updates => {
      const newData = { ...formData, ...updates };
      setFormData(newData);
      onDataChange?.(transformProfileData.toApi(newData));
    };

    // Helper functions
    const updateField = (field, value) => {
      updateFormData({ [field]: value });
    };

    const toggleArrayField = (field, value) => {
      const currentArray = formData[field] || [];
      const newArray = currentArray.includes(value)
        ? currentArray.filter(item => item !== value)
        : [...currentArray, value];
      updateField(field, newArray);
    };

    const focusField = fieldKey => {
      setTimeout(() => {
        if (textRefs.current[fieldKey]) {
          textRefs.current[fieldKey].focus();
        }
      }, 100);
    };

    const showSelectionPanel = fieldKey => {
      setSelectionPanels(prev => ({ ...prev, [fieldKey]: true }));
    };

    const hideSelectionPanel = fieldKey => {
      setSelectionPanels(prev => ({ ...prev, [fieldKey]: false }));
    };

    // Validation
    const validateForm = () => {
      const errors = {};

      // Check required fields
      if (!formData.name?.trim()) {
        errors.name = 'Name is required';
      }

      // Check length limits
      Object.entries(formData).forEach(([key, value]) => {
        if (typeof value === 'string' && value.length > 0) {
          const config = profileFieldsConfig.textFields.find(f => f.key === key);
          if (config?.maxLength && value.length > config.maxLength) {
            errors[key] = `${config.label} cannot exceed ${config.maxLength} characters`;
          }
        }
      });

      return {
        isValid: Object.keys(errors).length === 0,
        errors,
      };
    };

    // Get next field for auto-advance
    const getNextField = currentField => {
      const textFields = profileFieldsConfig.textFields.filter(f => !excludeFields.includes(f.key));
      const currentIndex = textFields.findIndex(f => f.key === currentField);
      return currentIndex >= 0 && currentIndex < textFields.length - 1
        ? textFields[currentIndex + 1].key
        : null;
    };

    // Render methods
    const renderTextFields = () => {
      return profileFieldsConfig.textFields
        .filter(field => !excludeFields.includes(field.key))
        .map(field => (
          <View key={field.key} style={styles.inputContainer}>
            <Text style={styles.label}>
              {field.label}
              {field.required && <Text style={styles.required}> *</Text>}
              {field.showCounter && (
                <Text style={styles.counter}>
                  ({formData[field.key]?.length || 0}/{field.maxLength})
                </Text>
              )}
            </Text>
            <TextInput
              ref={textRef => {
                textRefs.current[field.key] = textRef;
              }}
              style={[styles.textInput, field.multiline && styles.textArea]}
              value={formData[field.key]}
              onChangeText={value => {
                const trimmedValue = field.maxLength ? value.slice(0, field.maxLength) : value;
                updateField(field.key, trimmedValue);
              }}
              placeholder={field.placeholder}
              multiline={field.multiline}
              numberOfLines={field.numberOfLines}
              textAlignVertical={field.multiline ? 'top' : 'center'}
              returnKeyType={field.returnKeyType}
              onSubmitEditing={() => {
                const nextField = getNextField(field.key);
                if (nextField) {
                  focusField(nextField);
                }
              }}
              blurOnSubmit={!field.multiline}
            />
          </View>
        ));
    };

    const renderSelectionFields = () => {
      return profileFieldsConfig.selectionFields
        .filter(field => !excludeFields.includes(field.key))
        .map(field => (
          <TouchableOpacity
            key={field.key}
            style={styles.selectorButton}
            onPress={() => showSelectionPanel(field.key)}
          >
            <Text style={styles.label}>{field.label}</Text>
            <View style={styles.selectorRow}>
              <Text style={styles.selectorText}>{formData[field.key] || field.placeholder}</Text>
              <Ionicons name="chevron-forward" size={20} color="#666" />
            </View>
          </TouchableOpacity>
        ));
    };

    const renderBubbleFields = () => {
      return profileFieldsConfig.bubbleFields
        .filter(field => !excludeFields.includes(field.key))
        .map(field => (
          <View key={field.key} style={styles.section}>
            <Text style={styles.sectionTitle}>{field.label}</Text>
            <View style={styles.bubblesContainer}>
              {field.options.map(option => {
                const isSelected = (formData[field.key] || []).includes(option);
                const displayText = field.displayTransform
                  ? field.displayTransform(option)
                  : option;

                return (
                  <TouchableOpacity
                    key={option}
                    style={[styles.bubble, isSelected && styles.bubbleSelected]}
                    onPress={() => toggleArrayField(field.key, option)}
                  >
                    <Text style={[styles.bubbleText, isSelected && styles.bubbleTextSelected]}>
                      {displayText}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ));
    };

    const renderSelectionPanels = () => {
      return profileFieldsConfig.selectionFields
        .filter(field => !excludeFields.includes(field.key))
        .map(field => (
          <SelectionPanel
            key={`panel-${field.key}`}
            visible={selectionPanels[field.key] || false}
            title={field.label}
            options={field.options}
            selectedOption={formData[field.key]}
            onSelect={option => {
              updateField(field.key, option);
              hideSelectionPanel(field.key);
            }}
            onClose={() => hideSelectionPanel(field.key)}
            initialScrollIndex={field.initialScrollIndex}
          />
        ));
    };

    return (
      <KeyboardAvoidingView
        style={[styles.container, style]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled={true}
          scrollEnabled={scrollEnabled}
        >
          {/* Photos Section */}
          {showPhotosSection && photosComponent && (
            <View style={styles.section}>{photosComponent}</View>
          )}

          {/* Basic Info Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Basic Info</Text>
            {renderTextFields()}
            {renderSelectionFields()}
          </View>

          {/* Bubble Fields Sections */}
          {renderBubbleFields()}

          {/* Custom Content */}
          {children}

          {/* Bottom padding */}
          <View style={styles.bottomPadding} />
        </ScrollView>

        {/* Selection Panels */}
        {renderSelectionPanels()}
      </KeyboardAvoidingView>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  section: {
    backgroundColor: '#fff',
    marginVertical: 5,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  required: {
    color: '#FF6B6B',
  },
  counter: {
    fontSize: 12,
    fontWeight: 'normal',
    color: '#666',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    height: 100,
  },
  selectorButton: {
    marginBottom: 20,
  },
  selectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  selectorText: {
    fontSize: 16,
    color: '#333',
  },
  bubblesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  bubbleSelected: {
    backgroundColor: '#FF6B6B',
    borderColor: '#FF6B6B',
  },
  bubbleText: {
    fontSize: 14,
    color: '#333',
  },
  bubbleTextSelected: {
    color: '#fff',
  },
  bottomPadding: {
    height: 50,
  },
});

ProfileForm.displayName = 'ProfileForm';

export default ProfileForm;
