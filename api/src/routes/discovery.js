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
 * @desc    Get users for discovery/swiping
 * @access  Private
 */
router.get('/users', authenticateJWT, async (req, res) => {
  try {
    const { limit = 20, excludeIds = [] } = req.query;
    
    // Parse excludeIds if it's a string (comma-separated)
    const excludeUserIds = Array.isArray(excludeIds) 
      ? excludeIds 
      : (excludeIds ? excludeIds.split(',') : []);
    
    const users = await getUsersForDiscovery(req.user.id, {
      limit: parseInt(limit),
      excludeIds: excludeUserIds,
    });
    
    res.json({
      success: true,
      message: 'Discovery users retrieved successfully',
      data: users,
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
 * @desc    Get filtered users for discovery
 * @access  Private
 */
router.post('/users/filters', authenticateJWT, async (req, res) => {
  try {
    const { filters = {}, limit = 20, excludeIds = [] } = req.body;
    
    const users = await getUsersForDiscovery(req.user.id, {
      limit,
      excludeIds,
      filters,
    });
    
    res.json({
      success: true,
      message: 'Filtered discovery users retrieved successfully',
      data: users,
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
