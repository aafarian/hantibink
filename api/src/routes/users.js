const express = require('express');
const logger = require('../utils/logger');
const { authenticateJWT } = require('../middleware/auth');
const { validate } = require('../utils/validation');
const { profileUpdateSchema } = require('../utils/validation');
const { getUserProfile, updateUserProfile } = require('../services/authService');

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
      'POST /upload-photo - Upload profile photo',
      'DELETE /photo/:id - Delete profile photo',
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
router.get('/profile', authenticateJWT, async (req, res) => {
  try {
    const profile = await getUserProfile(req.user.id);
    
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
router.put('/profile', authenticateJWT, validate(profileUpdateSchema), async (req, res) => {
  try {
    const updatedProfile = await updateUserProfile(req.user.id, req.body);
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedProfile,
    });
  } catch (error) {
    logger.error('❌ Update profile error:', error);
    
    res.status(400).json({
      success: false,
      error: 'Profile update failed',
      message: error.message,
    });
  }
});

/**
 * @route   POST /api/users/upload-photo
 * @desc    Upload profile photo
 * @access  Private
 */
router.post('/upload-photo', authenticateJWT, async (req, res) => {
  res.json({
    message: 'Upload photo endpoint',
    endpoint: 'POST /api/users/upload-photo',
    status: 'Coming soon - will integrate with Firebase Storage',
  });
});

/**
 * @route   DELETE /api/users/photo/:id
 * @desc    Delete profile photo
 * @access  Private
 */
router.delete('/photo/:id', authenticateJWT, async (req, res) => {
  res.json({
    message: 'Delete photo endpoint',
    endpoint: 'DELETE /api/users/photo/:id',
    status: 'Coming soon - will integrate with Firebase Storage',
  });
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
    
    res.status(404).json({
      success: false,
      error: 'Preferences not found',
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