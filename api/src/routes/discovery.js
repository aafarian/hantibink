const express = require('express');
const logger = require('../utils/logger');
const { authenticateJWT } = require('../middleware/auth');
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
router.get('/users', authenticateJWT, async (req, res) => {
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
router.post('/users/filters', authenticateJWT, async (req, res) => {
  try {
    const { 
      filters = {}, 
      limit = 20, 
      excludeIds = [] 
    } = req.body;
    
    // Validate filter values
    if (filters.ageRange) {
      const { min, max } = filters.ageRange;
      if (min < 18) {filters.ageRange.min = 18;}
      if (max > 100) {filters.ageRange.max = 100;}
      if (min > max) {
        return res.status(400).json({
          success: false,
          error: 'Invalid age range',
          message: 'Minimum age cannot be greater than maximum age',
        });
      }
    }
    
    if (filters.maxDistance && filters.maxDistance < 1) {
      filters.maxDistance = 1;
    }
    
    const users = await getUsersForDiscovery(req.user.id, {
      limit,
      excludeIds,
      filters,
    });
    
    res.json({
      success: true,
      message: 'Filtered discovery users retrieved successfully',
      data: users,
      meta: {
        count: users.length,
        appliedFilters: filters,
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
