/**
 * Centralized configuration for all profile fields
 * Used across registration, profile editing, and validation
 */

import { parseRelationshipType } from '../../utils/profileDataUtils';

// Education options
export const educationOptions = [
  'High School',
  'Some College',
  'Associate Degree',
  "Bachelor's Degree",
  "Master's Degree",
  'PhD',
  'Professional Degree',
  'Trade School',
  'Other',
];

// Height options (4'6" to 7'2" with CM conversions)
export const heightOptions = (() => {
  const options = [];
  for (let feet = 4; feet <= 7; feet++) {
    for (let inches = 0; inches <= 11; inches++) {
      if (feet === 4 && inches < 6) continue; // Start from 4'6"
      if (feet === 7 && inches > 2) break; // End at 7'2"

      const totalInches = feet * 12 + inches;
      const cm = Math.round(totalInches * 2.54);
      options.push(`${feet}'${inches}" (${cm}cm)`);
    }
  }
  return options;
})();

// Relationship options
export const relationshipOptions = [
  'casual',
  'serious',
  'friendship',
  'marriage',
  'hookups',
  'not-sure',
];

// Religion options
export const religionOptions = [
  'Christianity',
  'Islam',
  'Judaism',
  'Hinduism',
  'Buddhism',
  'Sikhism',
  'Atheist',
  'Agnostic',
  'Spiritual',
  'Other',
  'Prefer not to say',
];

// Smoking options
export const smokingOptions = ['Never', 'Sometimes', 'Regularly'];

// Drinking options
export const drinkingOptions = ['Never', 'Socially', 'Regularly'];

// Interest options
export const interestOptions = [
  'Travel',
  'Music',
  'Movies',
  'Books',
  'Fitness',
  'Cooking',
  'Art',
  'Photography',
  'Sports',
  'Gaming',
  'Technology',
  'Nature',
  'Dancing',
  'Fashion',
  'Food',
  'Animals',
  'Volunteering',
  'Learning',
];

// Language options
export const languageOptions = [
  'Armenian (Western)',
  'Armenian (Eastern)',
  'English',
  'Spanish',
  'French',
  'Mandarin',
  'Arabic',
  'Hindi',
  'Portuguese',
  'Russian',
  'Japanese',
  'German',
  'Korean',
  'Italian',
];

// Gender options (matching backend enum)
export const genderOptions = [
  { id: 'MALE', label: 'Man' },
  { id: 'FEMALE', label: 'Woman' },
  { id: 'OTHER', label: 'Other' },
];

// Interested in options (matching backend enum)
export const interestedInOptions = [
  { id: 'MALE', label: 'Men' },
  { id: 'FEMALE', label: 'Women' },
  { id: 'EVERYONE', label: 'Everyone' },
];

// Field configurations for forms
export const profileFieldsConfig = {
  // Text Input Fields
  textFields: [
    {
      key: 'name',
      label: 'Name',
      placeholder: 'Your name',
      maxLength: 50,
      required: true,
      returnKeyType: 'next',
    },
    {
      key: 'bio',
      label: 'Bio',
      placeholder: 'Tell us about yourself...',
      maxLength: 500,
      multiline: true,
      numberOfLines: 4,
      returnKeyType: 'next',
      showCounter: true,
    },
    {
      key: 'profession',
      label: 'Profession',
      placeholder: 'Your profession',
      maxLength: 100,
      returnKeyType: 'done',
    },
    {
      key: 'travel',
      label: 'Travel',
      placeholder: 'Tell us about your travel preferences',
      maxLength: 200,
      returnKeyType: 'next',
    },
    {
      key: 'pets',
      label: 'Pets',
      placeholder: 'Tell us about your pets',
      maxLength: 200,
      returnKeyType: 'done',
    },
  ],

  // Selection Panel Fields (single select)
  selectionFields: [
    {
      key: 'gender',
      label: 'Gender',
      placeholder: 'Select gender',
      options: genderOptions.map(g => g.label),
      singleSelect: true,
      valueMap: genderOptions.reduce((acc, g) => ({ ...acc, [g.label]: g.id }), {}),
      displayMap: genderOptions.reduce((acc, g) => ({ ...acc, [g.id]: g.label }), {}),
    },
    {
      key: 'interestedIn',
      label: 'Interested In',
      placeholder: "Select who you're interested in",
      options: interestedInOptions.map(i => i.label),
      singleSelect: true,
      valueMap: interestedInOptions.reduce((acc, i) => ({ ...acc, [i.label]: i.id }), {}),
      displayMap: interestedInOptions.reduce((acc, i) => ({ ...acc, [i.id]: i.label }), {}),
    },
    {
      key: 'education',
      label: 'Education',
      placeholder: 'Select education level',
      options: educationOptions,
      singleSelect: true,
    },
    {
      key: 'height',
      label: 'Height',
      placeholder: 'Select height',
      options: heightOptions,
      singleSelect: true,
      initialScrollIndex: Math.max(0, heightOptions.length / 2 - 3), // Start at average height
    },
    {
      key: 'religion',
      label: 'Religion',
      placeholder: 'Select religion (optional)',
      options: religionOptions,
      singleSelect: true,
    },
    {
      key: 'smoking',
      label: 'Smoking',
      placeholder: 'Do you smoke?',
      options: smokingOptions,
      singleSelect: true,
    },
    {
      key: 'drinking',
      label: 'Drinking',
      placeholder: 'Do you drink?',
      options: drinkingOptions,
      singleSelect: true,
    },
  ],

  // Multi-select dropdown fields (with checkboxes)
  multiSelectFields: [
    {
      key: 'languages',
      label: 'Languages Spoken',
      placeholder: 'Select languages',
      options: languageOptions,
      multiSelect: true,
      maxSelections: 10, // Allow many languages
    },
  ],

  // Multi-Select Bubble Fields
  bubbleFields: [
    {
      key: 'relationshipType',
      label: 'Looking For',
      options: relationshipOptions,
      multiSelect: true,
      displayTransform: value => value.charAt(0).toUpperCase() + value.slice(1).replace('-', ' '),
    },
    {
      key: 'interests',
      label: 'Interests',
      options: interestOptions,
      multiSelect: true,
      maxSelections: 10,
    },
  ],
};

// Helper functions for data transformation
export const transformProfileData = {
  // Transform for API submission - filter out empty values
  toApi: formData => {
    const cleaned = {};

    Object.entries(formData).forEach(([key, value]) => {
      // Skip empty strings, null, undefined
      if (value === '' || value === null || value === undefined) {
        return; // Don't include in the cleaned object
      }

      // For height, keep it as a string (e.g., "5'5\" (165cm)")
      if (key === 'height') {
        if (value && value.trim().length > 0) {
          cleaned[key] = value.trim();
        }
        return;
      }

      // Handle arrays
      if (Array.isArray(value)) {
        if (value.length > 0) {
          cleaned[key] = value;
        }
        return;
      }

      // For strings, only include if they have actual content
      if (typeof value === 'string' && value.trim().length > 0) {
        cleaned[key] = value.trim();
      } else if (typeof value !== 'string') {
        // Include non-string values (numbers, booleans, etc)
        cleaned[key] = value;
      }
    });

    // Keep relationshipType as an array for multi-select
    // The API will handle it as needed

    // Ensure interests is always an array if present
    if (cleaned.interests && !Array.isArray(cleaned.interests)) {
      cleaned.interests = [];
    }

    return cleaned;
  },

  // Transform from API response
  fromApi: apiData => {
    // Helper to capitalize dropdown values that may have been stored as lowercase
    const capitalizeDropdownValue = (value, options) => {
      if (!value) return '';
      // Find the matching option (case-insensitive) and return the properly cased version
      const match = options.find(opt => opt.toLowerCase() === value.toLowerCase());
      return match || value;
    };

    return {
      name: apiData.name || '',
      bio: apiData.bio || '',
      education: apiData.education || '',
      profession: apiData.profession || '',
      height: apiData.height || '',
      // Handle relationshipType - can be string with commas or array
      relationshipType: parseRelationshipType(apiData.relationshipType),
      religion: apiData.religion || '',
      smoking: capitalizeDropdownValue(apiData.smoking, smokingOptions),
      drinking: capitalizeDropdownValue(apiData.drinking, drinkingOptions),
      travel: apiData.travel || '',
      pets: apiData.pets || '',
      interests: Array.isArray(apiData.interests)
        ? apiData.interests.map(i => (typeof i === 'object' ? i.interest?.name || i.name : i))
        : [],
      languages: Array.isArray(apiData.languages) ? apiData.languages : [],
    };
  },
};

// Validation rules (client-side)
export const validationRules = {
  name: { required: true, minLength: 2, maxLength: 50 },
  bio: { maxLength: 500 },
  profession: { maxLength: 100 },
  travel: { maxLength: 200 },
  pets: { maxLength: 200 },
  interests: { maxSelections: 10 },
};
