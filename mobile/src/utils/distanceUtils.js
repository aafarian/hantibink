/**
 * Distance conversion utilities
 */

// Conversion constants
export const KM_TO_MILES = 0.621371;
export const MILES_TO_KM = 1.60934;

/**
 * Convert kilometers to miles
 * @param {number} km - Distance in kilometers
 * @returns {number} Distance in miles
 */
export const kmToMiles = km => {
  if (typeof km !== 'number' || isNaN(km)) return 0;
  return Math.round(km * KM_TO_MILES);
};

/**
 * Convert miles to kilometers
 * @param {number} miles - Distance in miles
 * @returns {number} Distance in kilometers
 */
export const milesToKm = miles => {
  if (typeof miles !== 'number' || isNaN(miles)) return 0;
  return Math.round(miles * MILES_TO_KM);
};

/**
 * Format distance for display based on user preference
 * @param {number} distanceInKm - Distance in kilometers (from API)
 * @param {string} preference - User preference: 'miles', 'km', 'both'
 * @returns {string} Formatted distance string
 */
export const formatDistance = (distanceInKm, preference = 'both') => {
  if (!distanceInKm || distanceInKm < 0) return 'Unknown distance';

  const miles = kmToMiles(distanceInKm);
  const km = Math.round(distanceInKm);

  switch (preference) {
    case 'miles':
      return `${miles} miles`;
    case 'km':
      return `${km} km`;
    case 'both':
    default:
      return `${miles} miles (${km} km)`;
  }
};

/**
 * Format distance with "away" suffix
 * @param {number} distanceInKm - Distance in kilometers
 * @param {string} preference - User preference: 'miles', 'km', 'both'
 * @returns {string} Formatted distance string with "away"
 */
export const formatDistanceAway = (distanceInKm, preference = 'both') => {
  const distance = formatDistance(distanceInKm, preference);
  return distance === 'Unknown distance' ? distance : `${distance} away`;
};
