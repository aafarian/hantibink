const express = require('express');
const logger = require('../utils/logger');
const { authenticateJWT } = require('../middleware/auth');
const { discoveryValidation } = require('../middleware/validation');
const { getUsersForDiscovery } = require('../services/discoveryService');

const router = express.Router();

/**
 * @route   GET /api/discovery
 * @desc    Get available discovery endpoints
 * @access  Public
 */
router.get('/', (req, res) => {
  res.json({
    message: 'Discovery API',
    availableEndpoints: [
      'GET /users - Get users for discovery/swiping',
      'POST /users/filters - Get filtered users',
    ],
  });
});

/**
 * @route   GET /api/discovery/users
 * @desc    Get users for discovery/swiping with filters
 * @access  Private
 */
router.get('/users', authenticateJWT, discoveryValidation.getUsers, async (req, res) => {
  try {
    const { 
      limit = 20, 
      excludeIds = [],
      minAge,
      maxAge,
      maxDistance
    } = req.query;
    
    // Parse excludeIds if it's a string (comma-separated)
    const excludeUserIds = Array.isArray(excludeIds) 
      ? excludeIds 
      : (excludeIds ? excludeIds.split(',') : []);
    
    // Build filters object
    const filters = {};
    
    if (minAge || maxAge) {
      filters.ageRange = {
        min: parseInt(minAge) || 18,
        max: parseInt(maxAge) || 100,
      };
    }
    
    if (maxDistance) {
      filters.maxDistance = parseInt(maxDistance);
    }
    
    const users = await getUsersForDiscovery(req.user.id, {
      limit: parseInt(limit) || 20,
      excludeIds: excludeUserIds,
      filters,
    });
    
    res.json({
      success: true,
      message: 'Discovery users retrieved successfully',
      data: users,
      meta: {
        count: users.length,
        filters,
      },
    });
  } catch (error) {
    logger.error('❌ Get discovery users error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to get discovery users',
      message: error.message,
    });
  }
});

/**
 * @route   POST /api/discovery/users/filters
 * @desc    Get filtered users for discovery (advanced filtering)
 * @access  Private
 */
router.post('/users/filters', authenticateJWT, discoveryValidation.filterUsers, async (req, res) => {
  try {
    const { 
      filters = {}, 
      limit = 20, 
      excludeIds = [] 
    } = req.body;
    
    // Create a copy of filters to avoid mutation
    const validatedFilters = { ...filters };
    
    // Validate filter values
    if (validatedFilters.ageRange) {
      const { min, max } = validatedFilters.ageRange;
      validatedFilters.ageRange = { ...validatedFilters.ageRange };
      
      if (min < 18) {
        return res.status(400).json({
          success: false,
          error: 'Invalid age range',
          message: 'Minimum age must be at least 18',
        });
      }
      if (max > 100) {
        return res.status(400).json({
          success: false,
          error: 'Invalid age range',
          message: 'Maximum age cannot exceed 100',
        });
      }
      if (min > max) {
        return res.status(400).json({
          success: false,
          error: 'Invalid age range',
          message: 'Minimum age cannot be greater than maximum age',
        });
      }
    }
    
    if (validatedFilters.maxDistance && validatedFilters.maxDistance < 1) {
      return res.status(400).json({
        success: false,
        error: 'Invalid distance',
        message: 'Maximum distance must be at least 1',
      });
    }
    
    const users = await getUsersForDiscovery(req.user.id, {
      limit,
      excludeIds,
      filters: validatedFilters,
    });
    
    res.json({
      success: true,
      message: 'Filtered discovery users retrieved successfully',
      data: users,
      meta: {
        count: users.length,
        appliedFilters: validatedFilters,
      },
    });
  } catch (error) {
    logger.error('❌ Get filtered discovery users error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to get filtered discovery users',
      message: error.message,
    });
  }
});

module.exports = router;
