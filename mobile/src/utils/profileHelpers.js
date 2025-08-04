// Profile helper utilities

// Placeholder for users with no uploaded photos
const NO_PHOTO_PLACEHOLDER =
  'https://images.unsplash.com/photo-1511367461989-f85a21fda167?w=400&h=400&fit=crop&crop=center'; // Simple gray placeholder

/**
 * Get the best available profile photo for a user
 * @param {Object} user - User object with photos array and/or mainPhoto
 * @returns {string} URL of the best available photo
 */
export const getUserProfilePhoto = user => {
  // Priority 1: mainPhoto (if user has specifically selected one)
  if (user?.mainPhoto && user.mainPhoto.trim()) {
    return user.mainPhoto;
  }

  // Priority 2: First photo in photos array (their actual uploaded photos)
  if (user?.photos && Array.isArray(user.photos) && user.photos.length > 0) {
    // Filter out empty/null photos and return first valid one
    const validPhotos = user.photos.filter(photo => photo && photo.trim());
    if (validPhotos.length > 0) {
      return validPhotos[0];
    }
  }

  // Priority 3: Single photo field (for backward compatibility)
  if (user?.photo && user.photo.trim()) {
    return user.photo;
  }

  // Priority 4: "No photo" placeholder (for grandfathered users without photos)
  return NO_PHOTO_PLACEHOLDER;
};

/**
 * Check if user has any uploaded photos
 * @param {Object} user - User object
 * @returns {boolean} True if user has uploaded photos
 */
export const userHasPhotos = user => {
  if (user?.mainPhoto && user.mainPhoto.trim()) return true;
  if (user?.photo && user.photo.trim()) return true;
  if (user?.photos && Array.isArray(user.photos)) {
    return user.photos.some(photo => photo && photo.trim());
  }
  return false;
};

/**
 * Get user's display name (with fallback)
 * @param {Object} user - User object
 * @returns {string} Display name
 */
export const getUserDisplayName = user => {
  return user?.name || user?.displayName || 'Anonymous';
};

/**
 * Get user's age display
 * @param {Object} user - User object
 * @returns {string} Age display
 */
export const getUserAge = user => {
  if (user?.age) return user.age.toString();
  if (user?.birthDate) {
    const birthDate = new Date(user.birthDate);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      return (age - 1).toString();
    }
    return age.toString();
  }
  return '';
};

/**
 * Get formatted location string
 * @param {Object} user - User object
 * @returns {string} Location display
 */
export const getUserLocation = user => {
  return user?.location || user?.city || 'Location unknown';
};
