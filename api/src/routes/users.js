const express = require('express');
const logger = require('../utils/logger');
const { authenticateJWT } = require('../middleware/auth');
const { profileValidation, userValidation } = require('../middleware/validation');
const { getPrismaClient } = require('../config/database');
// Removed caching from profile endpoint as it changes frequently
const {
  getUserProfile,
  updateUserProfile,
  addUserPhoto,
  deleteUserPhoto,
  reorderUserPhotos,
  setMainPhoto
} = require('../services/authService');

const prisma = getPrismaClient();

const router = express.Router();

// Fields a user is allowed to set on their own profile via PUT /profile.
// Server-managed flags (isPremium, isVerified, role, counters, timestamps, etc.)
// are intentionally excluded to prevent mass-assignment attacks.
const ALLOWED_PROFILE_FIELDS = new Set([
  // Basic identity
  'name', 'bio', 'birthDate',
  // Demographics
  'gender', 'interestedIn',
  // Personal details
  'education', 'profession', 'height', 'relationshipType',
  'religion', 'smoking', 'drinking', 'travel', 'pets',
  // Location
  'location', 'latitude', 'longitude', 'locationEnabled',
  // Onboarding state (client signals completion of its own steps)
  'hasCompletedOnboarding', 'onboardingStage',
  // Discovery preferences
  'minAge', 'maxAge', 'maxDistance',
  // Collections (service handles photos/interests specially)
  'interests', 'languages', 'photos',
  // Photo references
  'mainPhotoUrl', 'mainPhotoId',
  // Notification preferences
  'notifyMessages', 'notifyMatches', 'notifyLikes',
  // Push token (device-registered)
  'pushToken',
]);

/**
 * @route   GET /api/users
 * @desc    Get available user endpoints
 * @access  Public
 */
router.get('/', (req, res) => {
  res.json({
    message: 'User Management API',
    availableEndpoints: [
      'GET /profile - Get user profile',
      'PUT /profile - Update user profile',
      'POST /profile/complete-setup - Complete profile setup',
      'POST /photos - Add profile photo',
      'DELETE /photos/:id - Delete profile photo',
      'PUT /photos/reorder - Reorder photos',
      'PUT /photos/:id/main - Set main photo',
      'GET /preferences - Get user preferences',
      'PUT /preferences - Update user preferences',
      'DELETE /account - Delete user account',
    ],
  });
});

/**
 * @route   GET /api/users/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile', authenticateJWT, profileValidation.getProfile, async (req, res) => {
  try {
    const profile = await getUserProfile(req.user.id);
    
    // Debug: Log profile retrieval (limited for privacy)
    logger.debug('📊 Profile API returning fields:', {
      hasLocation: !!profile.location,
      hasPhotos: profile.photos?.length > 0,
      profileCompletion: [profile.bio, profile.education, profile.profession].filter(Boolean).length,
    });
    
    res.json({
      success: true,
      message: 'Profile retrieved successfully',
      data: profile,
    });
  } catch (error) {
    logger.error('❌ Get profile error:', error);
    
    res.status(404).json({
      success: false,
      error: 'Profile not found',
      message: error.message,
    });
  }
});

/**
 * @route   PUT /api/users/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', authenticateJWT, profileValidation.updateProfile, async (req, res) => {
  try {
    const sanitized = {};
    const rejected = [];
    for (const [key, value] of Object.entries(req.body)) {
      if (ALLOWED_PROFILE_FIELDS.has(key)) {
        sanitized[key] = value;
      } else {
        rejected.push(key);
      }
    }
    if (rejected.length) {
      logger.warn(
        `Profile update for user ${req.user.id} ignored disallowed fields: ${rejected.join(', ')}`
      );
    }

    const updatedProfile = await updateUserProfile(req.user.id, sanitized);
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedProfile,
    });
  } catch (error) {
    logger.error('❌ Update profile error:', error);
    
    // Provide more specific error messages
    let statusCode = 400;
    let errorMessage = 'Profile update failed';
    let detailMessage = error.message;
    
    if (error.message.includes('not found')) {
      statusCode = 404;
      errorMessage = 'User not found';
    } else if (error.message.includes('validation')) {
      errorMessage = 'Validation error';
    } else if (error.message.includes('database')) {
      statusCode = 500;
      errorMessage = 'Database error';
      detailMessage = 'Unable to update profile at this time';
    }
    
    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      message: detailMessage,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

/**
 * @route   POST /api/users/profile/complete-setup
 * @desc    Complete initial profile setup
 * @access  Private
 */
router.post('/profile/complete-setup', authenticateJWT, profileValidation.completeSetup, async (req, res) => {
  try {
    const { gender, interestedIn, photos, location, latitude, longitude } = req.body;
    
    logger.info('📥 Complete-setup received data:', {
      gender,
      interestedIn,
      photosCount: photos?.length,
      location,
      latitude,
      longitude,
    });

    // SIMPLIFIED: This endpoint just marks the profile setup as complete
    // Each step already saves its own data, so we don't need to re-save everything
    // We only save data that was explicitly provided in this call
    
    const setupData = {
      hasCompletedOnboarding: true,
      onboardingStage: 'SETUP_COMPLETE',
      isDiscoverable: true,
    };
    
    // Only update fields that were explicitly provided
    // (Each step already saved its data, so these are just fallbacks)
    if (gender) {
      setupData.gender = gender;
    }
    if (interestedIn && interestedIn.length > 0) {
      setupData.interestedIn = interestedIn;
    }
    if (location) {
      setupData.location = location;
      setupData.locationEnabled = true;
    }
    if (latitude !== null && latitude !== undefined) {
      setupData.latitude = latitude;
    }
    if (longitude !== null && longitude !== undefined) {
      setupData.longitude = longitude;
    }
    
    logger.info('📝 Updating profile with setupData:', setupData);
    
    // First update the profile
    let updatedProfile = await updateUserProfile(req.user.id, setupData);

    // Then add photos if they're URLs (strings)
    if (photos && photos.length > 0) {
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        // Validate and add photo if it's a valid URL
        if (typeof photo === 'string') {
          try {
            const url = new URL(photo);
            // Only accept http/https URLs
            if (url.protocol !== 'http:' && url.protocol !== 'https:') {
              logger.warn(`Skipping invalid photo URL protocol: ${url.protocol}`);
              continue;
            }
            // URL is valid, try to add it
            try {
              updatedProfile = await addUserPhoto(req.user.id, photo, i === 0); // First photo is main
            } catch (photoError) {
              logger.warn(`Failed to add photo ${i + 1}:`, photoError);
            }
          } catch (urlError) {
            logger.warn(`Invalid photo URL format: ${photo}`);
            continue;
          }
        }
      }
    }

    logger.info('✅ Profile setup completed for user:', req.user.id);

    res.json({
      success: true,
      message: 'Profile setup completed successfully',
      data: updatedProfile,
    });
  } catch (error) {
    logger.error('❌ Profile setup error:', error);
    
    res.status(400).json({
      success: false,
      error: 'Profile setup failed',
      message: error.message,
    });
  }
});

/**
 * @route   POST /api/users/photos
 * @desc    Add profile photo
 * @access  Private
 */
router.post('/photos', authenticateJWT, userValidation.addPhoto, async (req, res) => {
  try {
    const { photoUrl, isMain } = req.body;

    if (!photoUrl) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: 'Photo URL is required',
      });
    }

    const updatedProfile = await addUserPhoto(req.user.id, photoUrl, isMain);

    res.json({
      success: true,
      message: 'Photo added successfully',
      data: updatedProfile,
    });
  } catch (error) {
    logger.error('❌ Add photo error:', error);
    
    res.status(400).json({
      success: false,
      error: 'Photo upload failed',
      message: error.message,
    });
  }
});

/**
 * @route   DELETE /api/users/photos/:id
 * @desc    Delete profile photo
 * @access  Private
 */
router.delete('/photos/:id', authenticateJWT, async (req, res) => {
  try {
    const { id: photoId } = req.params;

    const updatedProfile = await deleteUserPhoto(req.user.id, photoId);

    res.json({
      success: true,
      message: 'Photo deleted successfully',
      data: updatedProfile,
    });
  } catch (error) {
    logger.error('❌ Delete photo error:', error);
    
    res.status(400).json({
      success: false,
      error: 'Photo deletion failed',
      message: error.message,
    });
  }
});

/**
 * @route   PUT /api/users/photos/reorder
 * @desc    Reorder profile photos
 * @access  Private
 */
router.put('/photos/reorder', authenticateJWT, async (req, res) => {
  try {
    const { photoIds } = req.body;

    if (!Array.isArray(photoIds)) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: 'photoIds must be an array',
      });
    }

    const updatedProfile = await reorderUserPhotos(req.user.id, photoIds);

    res.json({
      success: true,
      message: 'Photos reordered successfully',
      data: updatedProfile,
    });
  } catch (error) {
    logger.error('❌ Reorder photos error:', error);
    
    res.status(400).json({
      success: false,
      error: 'Photo reordering failed',
      message: error.message,
    });
  }
});

/**
 * @route   PUT /api/users/photos/:id/main
 * @desc    Set photo as main profile photo
 * @access  Private
 */
router.put('/photos/:id/main', authenticateJWT, async (req, res) => {
  try {
    const { id: photoId } = req.params;

    const updatedProfile = await setMainPhoto(req.user.id, photoId);

    res.json({
      success: true,
      message: 'Main photo set successfully',
      data: updatedProfile,
    });
  } catch (error) {
    logger.error('❌ Set main photo error:', error);
    
    res.status(400).json({
      success: false,
      error: 'Set main photo failed',
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/users/preferences
 * @desc    Get user preferences
 * @access  Private
 */
router.get('/preferences', authenticateJWT, async (req, res) => {
  try {
    const profile = await getUserProfile(req.user.id);
    
    const preferences = {
      interestedIn: profile.interestedIn,
      ageRange: {
        min: profile.minAge || 18,
        max: profile.maxAge || 99,
      },
      distance: profile.maxDistance || 50,
      location: {
        latitude: profile.latitude,
        longitude: profile.longitude,
        city: profile.city,
        country: profile.country,
      },
    };
    
    res.json({
      success: true,
      message: 'Preferences retrieved successfully',
      data: preferences,
    });
  } catch (error) {
    logger.error('❌ Get preferences error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve preferences',
      message: error.message,
    });
  }
});

/**
 * @route   PUT /api/users/preferences
 * @desc    Update user preferences
 * @access  Private
 */
router.put('/preferences', authenticateJWT, userValidation.preferences, async (req, res) => {
  try {
    const { interestedIn, ageRange, distance } = req.body;

    const updateData = {};
    if (interestedIn && Array.isArray(interestedIn)) {
      updateData.interestedIn = interestedIn;
    }
    if (ageRange?.min !== undefined) {
      updateData.minAge = ageRange.min;
    }
    if (ageRange?.max !== undefined) {
      updateData.maxAge = ageRange.max;
    }
    if (distance !== undefined) {
      updateData.maxDistance = distance;
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      select: {
        interestedIn: true,
        minAge: true,
        maxAge: true,
        maxDistance: true,
      },
    });

    res.json({
      success: true,
      message: 'Preferences updated successfully',
      data: {
        interestedIn: updatedUser.interestedIn,
        ageRange: {
          min: updatedUser.minAge || 18,
          max: updatedUser.maxAge || 99,
        },
        distance: updatedUser.maxDistance || 50,
      },
    });
  } catch (error) {
    logger.error('❌ Update preferences error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update preferences',
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/users/notification-settings
 * @desc    Get user notification settings
 * @access  Private
 */
router.get('/notification-settings', authenticateJWT, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        notifyMessages: true,
        notifyMatches: true,
        notifyLikes: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    res.json({
      success: true,
      data: {
        messages: user.notifyMessages ?? true,
        matches: user.notifyMatches ?? true,
        likes: user.notifyLikes ?? true,
      },
    });
  } catch (error) {
    logger.error('❌ Get notification settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get notification settings',
      message: error.message,
    });
  }
});

/**
 * @route   PUT /api/users/notification-settings
 * @desc    Update user notification settings
 * @access  Private
 */
router.put('/notification-settings', authenticateJWT, userValidation.notificationSettings, async (req, res) => {
  try {
    const { messages, matches, likes } = req.body;

    const updateData = {};
    if (messages !== undefined) {updateData.notifyMessages = messages;}
    if (matches !== undefined) {updateData.notifyMatches = matches;}
    if (likes !== undefined) {updateData.notifyLikes = likes;}

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      select: {
        notifyMessages: true,
        notifyMatches: true,
        notifyLikes: true,
      },
    });

    res.json({
      success: true,
      message: 'Notification settings updated successfully',
      data: {
        messages: user.notifyMessages,
        matches: user.notifyMatches,
        likes: user.notifyLikes,
      },
    });
  } catch (error) {
    logger.error('❌ Update notification settings error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update notification settings',
      message: error.message,
    });
  }
});

/**
 * @route   DELETE /api/users/account
 * @desc    Delete user account and all associated data
 * @access  Private
 */
router.delete('/account', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.id;

    logger.info(`🗑️ Starting account deletion for user: ${userId}`);

    // Delete the user - cascade will handle all related data
    // (photos, matches, messages, actions, oauth accounts, etc.)
    await prisma.user.delete({
      where: { id: userId },
    });

    logger.info(`✅ Account deleted successfully for user: ${userId}`);

    res.json({
      success: true,
      message: 'Account deleted successfully. All your data has been removed.',
    });
  } catch (error) {
    logger.error('❌ Delete account error:', error);

    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: 'Account not found',
        message: 'This account may have already been deleted.',
      });
    }

    res.status(500).json({
      success: false,
      error: 'Account deletion failed',
      message: 'Unable to delete account at this time. Please try again later.',
    });
  }
});

/**
 * @route   POST /api/users/push-token
 * @desc    Save Expo push notification token
 * @access  Private
 */
router.post('/push-token', authenticateJWT, async (req, res) => {
  try {
    const { pushToken } = req.body;

    if (!pushToken) {
      return res.status(400).json({
        success: false,
        error: 'Push token is required',
      });
    }

    // Validate Expo push token format
    if (!pushToken.startsWith('ExponentPushToken[')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid push token format',
      });
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: { pushToken },
    });

    logger.info(`Push token saved for user ${req.user.id}`);
    res.json({
      success: true,
      message: 'Push token saved successfully',
    });
  } catch (error) {
    logger.error('Error saving push token:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save push token',
    });
  }
});

/**
 * @route   POST /api/users/push-token/clear
 * @desc    Clear push token from all users (used during logout)
 * @access  Private (clears by token value across accounts on this device)
 */
router.post('/push-token/clear', authenticateJWT, async (req, res) => {
  try {
    const { pushToken } = req.body;

    if (!pushToken) {
      return res.status(400).json({
        success: false,
        error: 'Push token is required',
      });
    }

    // Clear this push token from ALL users who have it
    // This handles the case where multiple accounts used the same device
    const result = await prisma.user.updateMany({
      where: { pushToken },
      data: { pushToken: null },
    });

    logger.info(`🔔 Cleared push token from ${result.count} user(s) on logout`);
    res.json({
      success: true,
      message: 'Push token cleared successfully',
      clearedCount: result.count,
    });
  } catch (error) {
    logger.error('Error clearing push token:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear push token',
    });
  }
});

/**
 * @route   PUT /api/users/profile/pause
 * @desc    Pause profile (hide from discovery)
 * @access  Private
 */
router.put('/profile/pause', authenticateJWT, async (req, res) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        isProfilePaused: true,
        pausedAt: new Date(),
      },
      select: {
        id: true,
        isProfilePaused: true,
        pausedAt: true,
      },
    });

    logger.info(`⏸️ User ${req.user.id} paused their profile`);
    res.json({
      success: true,
      message: 'Profile paused successfully. You will not appear in discovery.',
      data: user,
    });
  } catch (error) {
    logger.error('Error pausing profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to pause profile',
    });
  }
});

/**
 * @route   PUT /api/users/profile/resume
 * @desc    Resume profile (show in discovery again)
 * @access  Private
 */
router.put('/profile/resume', authenticateJWT, async (req, res) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        isProfilePaused: false,
        pausedAt: null,
      },
      select: {
        id: true,
        isProfilePaused: true,
        pausedAt: true,
      },
    });

    logger.info(`▶️ User ${req.user.id} resumed their profile`);
    res.json({
      success: true,
      message: 'Profile resumed. You are now visible in discovery.',
      data: user,
    });
  } catch (error) {
    logger.error('Error resuming profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to resume profile',
    });
  }
});

/**
 * @route   GET /api/users/profile/pause-status
 * @desc    Get current pause status
 * @access  Private
 */
router.get('/profile/pause-status', authenticateJWT, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        isProfilePaused: true,
        pausedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    logger.error('Error getting pause status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get pause status',
    });
  }
});

module.exports = router;