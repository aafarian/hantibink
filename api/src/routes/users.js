const express = require('express');
const logger = require('../utils/logger');
const { authenticateJWT } = require('../middleware/auth');
const { profileValidation } = require('../middleware/validation');
// Removed caching from profile endpoint as it changes frequently
const { 
  getUserProfile, 
  updateUserProfile, 
  addUserPhoto, 
  deleteUserPhoto, 
  reorderUserPhotos, 
  setMainPhoto 
} = require('../services/authService');

const router = express.Router();

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
    const updatedProfile = await updateUserProfile(req.user.id, req.body);
    
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
router.post('/profile/complete-setup', authenticateJWT, async (req, res) => {
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
        // If it's a URL string, add it as a new photo
        if (typeof photo === 'string' && photo.startsWith('http')) {
          try {
            updatedProfile = await addUserPhoto(req.user.id, photo, i === 0); // First photo is main
          } catch (photoError) {
            logger.warn(`Failed to add photo ${i + 1}:`, photoError);
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
router.post('/photos', authenticateJWT, async (req, res) => {
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
router.put('/preferences', authenticateJWT, async (req, res) => {
  res.json({
    message: 'Update preferences endpoint',
    endpoint: 'PUT /api/users/preferences',
    status: 'Coming soon - will implement preference updates',
  });
});

/**
 * @route   DELETE /api/users/account
 * @desc    Delete user account
 * @access  Private
 */
router.delete('/account', authenticateJWT, async (req, res) => {
  res.json({
    message: 'Delete user account endpoint',
    endpoint: 'DELETE /api/users/account',
    status: 'Coming soon - will implement account deletion with data cleanup',
  });
});

module.exports = router;