/**
 * Utility functions for profile data processing
 */

/**
 * Parse relationshipType string into array format
 * @param {string|null} relationshipType - The relationship type string
 * @returns {string[]} Array of relationship types
 */
const parseRelationshipType = (relationshipType) => {
  if (!relationshipType) {return [];}
  return relationshipType.includes(',') 
    ? relationshipType.split(',').map(s => s.trim())
    : [relationshipType];
};

/**
 * Format height value ensuring consistent string format
 * @param {string|number} height - The height value
 * @returns {string|null} Formatted height string
 */
const formatHeight = (height) => {
  if (!height) {return null;}
  
  // If it's already a string with proper formatting, return as is
  if (typeof height === 'string') {
    // Check if it already has feet/inches notation
    if (height.includes("'") || height.includes('"')) {
      return height;
    }
    // Check if it's a plain number string
    const numValue = parseFloat(height);
    if (!isNaN(numValue) && numValue > 0 && numValue < 10) {
      // Assume it's feet if it's a reasonable height value
      return `${numValue}'`;
    }
    return height;
  }
  
  // If it's a number, assume feet and convert to string
  if (typeof height === 'number' && height > 0 && height < 10) {
    return `${height}'`;
  }
  
  return null;
};

module.exports = {
  parseRelationshipType,
  formatHeight,
};