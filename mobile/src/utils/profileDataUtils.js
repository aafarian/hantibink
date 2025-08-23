/**
 * Utility functions for profile data processing
 */

/**
 * Parse relationshipType string into array format
 * @param {string|Array|null} relationshipType - The relationship type value
 * @returns {Array} Array of relationship types
 */
export const parseRelationshipType = relationshipType => {
  if (!relationshipType) return [];

  // If it's already an array, return it
  if (Array.isArray(relationshipType)) {
    return relationshipType;
  }

  // If it's a string with comma-separated values
  if (typeof relationshipType === 'string' && relationshipType.includes(',')) {
    return relationshipType.split(',').map(s => s.trim());
  }

  // Single string value
  if (typeof relationshipType === 'string') {
    return [relationshipType];
  }

  return [];
};

/**
 * Format relationshipType array into string format for API
 * @param {Array} relationshipTypeArray - Array of relationship types
 * @returns {string} Comma-separated string
 */
export const formatRelationshipType = relationshipTypeArray => {
  if (!relationshipTypeArray || !Array.isArray(relationshipTypeArray)) {
    return '';
  }
  return relationshipTypeArray.join(', ');
};

/**
 * Capitalize first letter of a string
 * @param {string} str - String to capitalize
 * @returns {string} Capitalized string
 */
export const capitalizeFirst = str => {
  if (!str || typeof str !== 'string') return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

/**
 * Format relationship types for display
 * @param {string|Array|null} relationshipType - The relationship type value
 * @returns {Array} Array of formatted relationship type strings
 */
export const formatRelationshipTypes = relationshipType => {
  if (!relationshipType) return [];

  // Parse into array first
  const types = parseRelationshipType(relationshipType);

  // Format each type for display
  return types.map(type =>
    type
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
  );
};
