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
    
    // Check for metric notation (cm or m)
    if (height.toLowerCase().includes('cm') || height.toLowerCase().includes('m')) {
      return height; // Keep metric as-is
    }
    
    // Check if it's a plain number string
    const numValue = parseFloat(height);
    if (!isNaN(numValue)) {
      // If value is > 100, likely centimeters
      if (numValue > 100) {
        return `${numValue}cm`;
      }
      // If value is between 1-3, could be meters
      if (numValue >= 1 && numValue <= 3) {
        // Check if there's a decimal (likely meters)
        if (height.includes('.')) {
          return `${numValue}m`;
        }
        // Otherwise assume feet for values 4-9
        if (numValue >= 4 && numValue < 10) {
          return `${numValue}'`;
        }
      }
      // Values 4-9 without context, assume feet
      if (numValue >= 4 && numValue < 10) {
        return `${numValue}'`;
      }
    }
    return height;
  }
  
  // If it's a number
  if (typeof height === 'number') {
    // If value is > 100, likely centimeters
    if (height > 100) {
      return `${height}cm`;
    }
    // If value is between 4-9, assume feet
    if (height >= 4 && height < 10) {
      return `${height}'`;
    }
    // If value is between 1-3 with decimals, assume meters
    if (height >= 1 && height < 3) {
      return `${height}m`;
    }
  }
  
  return null;
};

module.exports = {
  parseRelationshipType,
  formatHeight,
};