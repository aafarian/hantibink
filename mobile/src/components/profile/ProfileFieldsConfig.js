/**
 * Centralized configuration for all profile fields
 * Used across registration, profile editing, and validation
 */

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

  // Selection Panel Fields
  selectionFields: [
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
  // Transform for API submission
  toApi: formData => ({
    ...formData,
    relationshipType: Array.isArray(formData.relationshipType)
      ? formData.relationshipType[0] || null
      : formData.relationshipType,
    interests: Array.isArray(formData.interests) ? formData.interests : [],
  }),

  // Transform from API response
  fromApi: apiData => ({
    name: apiData.name || '',
    bio: apiData.bio || '',
    education: apiData.education || '',
    profession: apiData.profession || '',
    height: apiData.height || '',
    relationshipType: Array.isArray(apiData.relationshipType)
      ? apiData.relationshipType
      : apiData.relationshipType
        ? [apiData.relationshipType]
        : [],
    religion: apiData.religion || '',
    smoking: apiData.smoking || '',
    drinking: apiData.drinking || '',
    travel: apiData.travel || '',
    pets: apiData.pets || '',
    interests: Array.isArray(apiData.interests)
      ? apiData.interests.map(i => (typeof i === 'object' ? i.interest?.name || i.name : i))
      : [],
  }),
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
