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
import { theme } from '../../styles/theme';

/**
 * Reusable ProfileForm component
 * Used for both registration and profile editing
 */
const ProfileForm = forwardRef(
  (
    {
      initialData = {},
      onDataChange,
      changedFields = new Set(), // Fields that have been changed
      validationErrors = {}, // Validation errors for fields
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
      getFormData: () => formData, // Return raw form data, not transformed
      setFormData: data => setFormData(transformProfileData.fromApi(data)),
      validateForm: () => validateForm(),
      scrollToTop: () => scrollViewRef.current?.scrollTo({ y: 0, animated: true }),
      setScrollEnabled: enabled => setScrollEnabled(enabled),
    }));

    // Real-time validation for a specific field
    const validateField = (fieldKey, value) => {
      const config = profileFieldsConfig.textFields.find(f => f.key === fieldKey);

      // Check required fields
      if (fieldKey === 'name' && (!value || value.trim() === '')) {
        return 'Name is required';
      }

      // Check length limits
      if (config?.maxLength && value && value.length > config.maxLength) {
        return `${config.label} cannot exceed ${config.maxLength} characters`;
      }

      return null; // No error
    };

    // Update form data and notify parent
    const updateFormData = updates => {
      const newData = { ...formData, ...updates };
      setFormData(newData);

      // Validate changed fields in real-time
      const newErrors = {};
      Object.keys(updates).forEach(key => {
        const error = validateField(key, updates[key]);
        if (error) {
          newErrors[key] = error;
        }
      });

      // Update parent with raw data (not transformed) and validation state
      // This allows parent to properly track changes even when fields are empty
      onDataChange?.(newData, newErrors);
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
            <View style={styles.labelContainer}>
              <Text
                style={[
                  styles.label,
                  changedFields.has(field.key) && styles.labelChanged,
                  validationErrors[field.key] && styles.labelError,
                ]}
              >
                {field.label}
                {field.required && <Text style={styles.required}> *</Text>}
                {field.showCounter && (
                  <Text style={styles.counter}>
                    ({formData[field.key]?.length || 0}/{field.maxLength})
                  </Text>
                )}
              </Text>
              {changedFields.has(field.key) && !validationErrors[field.key] && (
                <View style={styles.changedIndicator}>
                  <Text style={styles.changedText}>Modified</Text>
                </View>
              )}
            </View>
            <TextInput
              ref={textRef => {
                textRefs.current[field.key] = textRef;
              }}
              style={[
                styles.textInput,
                field.multiline && styles.textArea,
                changedFields.has(field.key) &&
                  !validationErrors[field.key] &&
                  styles.textInputChanged,
                validationErrors[field.key] && styles.textInputError,
              ]}
              value={formData[field.key]}
              onChangeText={value => {
                const trimmedValue = field.maxLength ? value.slice(0, field.maxLength) : value;
                updateField(field.key, trimmedValue);
              }}
              placeholder={field.placeholder}
              placeholderTextColor={
                validationErrors[field.key]
                  ? theme.colors.feedback.errorBorder
                  : changedFields.has(field.key)
                    ? theme.colors.feedback.successBorder
                    : theme.colors.gray[500]
              }
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
            {validationErrors[field.key] && (
              <Text style={styles.errorText}>{validationErrors[field.key]}</Text>
            )}
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
            <View style={styles.labelContainer}>
              <Text style={[styles.label, changedFields.has(field.key) && styles.labelChanged]}>
                {field.label}
              </Text>
              {changedFields.has(field.key) && (
                <View style={styles.changedIndicator}>
                  <Text style={styles.changedText}>Modified</Text>
                </View>
              )}
            </View>
            <View
              style={[
                styles.selectorRow,
                changedFields.has(field.key) && styles.selectorRowChanged,
              ]}
            >
              <Text
                style={[
                  styles.selectorText,
                  changedFields.has(field.key) && styles.selectorTextChanged,
                ]}
              >
                {(() => {
                  const value = formData[field.key];
                  if (!value) return field.placeholder;

                  // Handle interestedIn array - take first value
                  const displayValue = Array.isArray(value) ? value[0] : value;

                  // Use displayMap if available
                  if (field.displayMap && field.displayMap[displayValue]) {
                    return field.displayMap[displayValue];
                  }

                  return displayValue || field.placeholder;
                })()}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={
                  changedFields.has(field.key)
                    ? theme.colors.status.success
                    : theme.colors.text.secondary
                }
              />
            </View>
          </TouchableOpacity>
        ));
    };

    const renderBubbleFields = () => {
      return profileFieldsConfig.bubbleFields
        .filter(field => !excludeFields.includes(field.key))
        .map(field => (
          <View key={field.key} style={styles.section}>
            <View style={styles.labelContainer}>
              <Text
                style={[styles.sectionTitle, changedFields.has(field.key) && styles.labelChanged]}
              >
                {field.label}
              </Text>
              {changedFields.has(field.key) && (
                <View style={styles.changedIndicator}>
                  <Text style={styles.changedText}>Modified</Text>
                </View>
              )}
            </View>
            <View style={styles.bubblesContainer}>
              {field.options.map(option => {
                const isSelected = (formData[field.key] || []).includes(option);
                const displayText = field.displayTransform
                  ? field.displayTransform(option)
                  : option;

                return (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.bubble,
                      isSelected && styles.bubbleSelected,
                      changedFields.has(field.key) && isSelected && styles.bubbleChangedSelected,
                    ]}
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

    const renderMultiSelectFields = () => {
      return (profileFieldsConfig.multiSelectFields || [])
        .filter(field => !excludeFields.includes(field.key))
        .map(field => (
          <View key={field.key} style={styles.multiSelectContainer}>
            <TouchableOpacity
              style={[
                styles.selectorButton,
                changedFields.has(field.key) && styles.selectorButtonChanged,
              ]}
              onPress={() => showSelectionPanel(field.key)}
            >
              <View style={styles.labelContainer}>
                <Text style={[styles.label, changedFields.has(field.key) && styles.labelChanged]}>
                  {field.label}
                </Text>
                {changedFields.has(field.key) && (
                  <View style={styles.changedIndicator}>
                    <Text style={styles.changedText}>Modified</Text>
                  </View>
                )}
              </View>
              <View style={styles.selectorRow}>
                <Text
                  style={[
                    styles.selectorText,
                    changedFields.has(field.key) && styles.selectorTextChanged,
                  ]}
                >
                  {formData[field.key] && formData[field.key].length > 0
                    ? `${formData[field.key].length} selected`
                    : field.placeholder}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={
                    changedFields.has(field.key)
                      ? theme.colors.status.success
                      : theme.colors.gray[600]
                  }
                />
              </View>
            </TouchableOpacity>

            {/* Display selected items as tags below */}
            {formData[field.key] && formData[field.key].length > 0 && (
              <View style={styles.selectedTagsContainer}>
                {formData[field.key].map(item => (
                  <View key={item} style={styles.selectedTag}>
                    <Text style={styles.selectedTagText}>{item}</Text>
                    <TouchableOpacity
                      onPress={() => {
                        const newValues = formData[field.key].filter(v => v !== item);
                        updateField(field.key, newValues);
                      }}
                      style={styles.removeTagButton}
                    >
                      <Ionicons name="close-circle" size={16} color={theme.colors.primary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        ));
    };

    const renderSelectionPanels = () => {
      const singleSelectPanels = profileFieldsConfig.selectionFields
        .filter(field => !excludeFields.includes(field.key))
        .map(field => {
          // Get the display value for fields with displayMap
          let selectedOption = formData[field.key];

          // Handle interestedIn array - take first value
          if (field.key === 'interestedIn' && Array.isArray(selectedOption)) {
            selectedOption = selectedOption[0];
          }

          // Convert from backend value to display value if displayMap exists
          if (field.displayMap && selectedOption) {
            selectedOption = field.displayMap[selectedOption] || selectedOption;
          }

          return (
            <SelectionPanel
              key={`panel-${field.key}`}
              visible={selectionPanels[field.key] || false}
              title={field.label}
              options={field.options}
              selectedOption={selectedOption}
              onSelect={option => {
                // Convert display value back to backend value if valueMap exists
                const value = field.valueMap ? field.valueMap[option] || option : option;
                updateField(field.key, value);
                hideSelectionPanel(field.key);
              }}
              onClose={() => hideSelectionPanel(field.key)}
              initialScrollIndex={field.initialScrollIndex}
            />
          );
        });

      const multiSelectPanels = (profileFieldsConfig.multiSelectFields || [])
        .filter(field => !excludeFields.includes(field.key))
        .map(field => (
          <SelectionPanel
            key={`panel-${field.key}`}
            visible={selectionPanels[field.key] || false}
            title={field.label}
            options={field.options}
            selectedValues={formData[field.key] || []}
            multiSelect={true}
            onSelect={values => {
              updateField(field.key, values);
            }}
            onClose={() => hideSelectionPanel(field.key)}
          />
        ));

      return [...singleSelectPanels, ...multiSelectPanels];
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
            {renderMultiSelectFields()}
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
    backgroundColor: theme.colors.background.primary,
    marginVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.bold,
    fontFamily: theme.typography.fontFamily.bold,
    marginBottom: theme.spacing.lg,
    color: theme.colors.text.primary,
  },
  inputContainer: {
    marginBottom: theme.spacing.xl,
  },
  label: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    fontFamily: theme.typography.fontFamily.semibold,
    marginBottom: theme.spacing.sm,
    color: theme.colors.text.primary,
  },
  required: {
    color: theme.colors.primary,
  },
  counter: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.regular,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.gray[600],
  },
  textInput: {
    borderWidth: 1,
    borderColor: theme.colors.gray[300],
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    fontSize: theme.typography.sizes.lg,
    fontFamily: theme.typography.fontFamily.regular,
    backgroundColor: theme.colors.background.primary,
  },
  textArea: {
    height: 100,
  },
  selectorButton: {
    marginBottom: theme.spacing.xl,
  },
  multiSelectContainer: {
    marginBottom: theme.spacing.xl,
  },
  selectedTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: theme.spacing.md,
    marginHorizontal: theme.spacing.xs,
  },
  selectedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.feedback.errorTint,
    borderWidth: 1,
    borderColor: theme.colors.feedback.errorBorder,
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    marginRight: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  selectedTagText: {
    fontSize: theme.typography.sizes.md,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.gray[600],
    marginRight: theme.spacing.xs,
  },
  removeTagButton: {
    marginLeft: theme.spacing.xs,
  },
  selectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.gray[300],
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.background.primary,
  },
  selectorText: {
    fontSize: theme.typography.sizes.lg,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.primary,
  },
  bubblesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  bubble: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.xxl,
    borderWidth: 1,
    borderColor: theme.colors.gray[300],
    marginRight: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.background.primary,
  },
  bubbleSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  bubbleText: {
    fontSize: theme.typography.sizes.md,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.text.primary,
  },
  bubbleTextSelected: {
    color: theme.colors.text.white,
  },
  bottomPadding: {
    height: 50,
  },

  // Changed field indicator styles
  labelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  labelChanged: {
    color: theme.colors.status.success,
  },
  changedIndicator: {
    backgroundColor: theme.colors.feedback.successTint,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.feedback.successBorder,
  },
  changedText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.status.success,
    fontWeight: theme.typography.weights.semibold,
    fontFamily: theme.typography.fontFamily.semibold,
  },
  textInputChanged: {
    borderColor: theme.colors.status.success,
    borderWidth: 1.5,
    backgroundColor: theme.colors.feedback.successTint,
  },
  selectorButtonChanged: {
    // Not used anymore - moved to selectorRowChanged
  },
  selectorRowChanged: {
    backgroundColor: theme.colors.feedback.successTint,
    borderColor: theme.colors.status.success,
    borderWidth: 1.5,
  },
  selectorTextChanged: {
    color: theme.colors.status.success,
    fontWeight: theme.typography.weights.medium,
    fontFamily: theme.typography.fontFamily.medium,
  },
  bubbleChangedSelected: {
    backgroundColor: theme.colors.status.success,
    borderColor: theme.colors.status.successDark,
  },

  // Validation error styles
  labelError: {
    color: theme.colors.status.error,
  },
  textInputError: {
    borderColor: theme.colors.status.error,
    borderWidth: 1.5,
    backgroundColor: theme.colors.feedback.errorTint,
  },
  errorText: {
    color: theme.colors.status.error,
    fontSize: theme.typography.sizes.sm,
    fontFamily: theme.typography.fontFamily.regular,
    marginTop: theme.spacing.xs,
    marginLeft: 2,
  },
});

ProfileForm.displayName = 'ProfileForm';

export default ProfileForm;
