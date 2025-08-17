const express = require('express');
const logger = require('../utils/logger');
const { authenticateJWT } = require('../middleware/auth');
const { 
  getUserMatches, 
  getMatchDetails,
  deactivateMatch 
} = require('../services/matchesService');

const router = express.Router();

/**
 * @route   GET /api/matches
 * @desc    Get available match endpoints
 * @access  Public
 */
router.get('/', (req, res) => {
  res.json({
    message: 'Matches API',
    availableEndpoints: [
      'GET /list - Get user matches',
      'GET /:matchId - Get match details',
      'DELETE /:matchId - Deactivate/unmatch',
    ],
  });
});

/**
 * @route   GET /api/matches/list
 * @desc    Get user matches
 * @access  Private
 */
router.get('/list', authenticateJWT, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    const matches = await getUserMatches(req.user.id, {
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
    
    res.json({
      success: true,
      message: 'Matches retrieved successfully',
      data: matches,
    });
  } catch (error) {
    logger.error('❌ Get user matches error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to get matches',
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/matches/:matchId
 * @desc    Get match details with other user profile
 * @access  Private
 */
router.get('/:matchId', authenticateJWT, async (req, res) => {
  try {
    const { matchId } = req.params;
    
    const match = await getMatchDetails(matchId, req.user.id);
    
    if (!match) {
      return res.status(404).json({
        success: false,
        error: 'Match not found',
        message: 'Match not found or you don\'t have access to it',
      });
    }
    
    res.json({
      success: true,
      message: 'Match details retrieved successfully',
      data: match,
    });
  } catch (error) {
    logger.error('❌ Get match details error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to get match details',
      message: error.message,
    });
  }
});

/**
 * @route   DELETE /api/matches/:matchId
 * @desc    Deactivate a match (unmatch)
 * @access  Private
 */
router.delete('/:matchId', authenticateJWT, async (req, res) => {
  try {
    const { matchId } = req.params;
    
    const result = await deactivateMatch(matchId, req.user.id);
    
    res.json({
      success: true,
      message: 'Match deactivated successfully',
      data: result,
    });
  } catch (error) {
    logger.error('❌ Deactivate match error:', error);
    
    res.status(400).json({
      success: false,
      error: 'Failed to deactivate match',
      message: error.message,
    });
  }
});

module.exports = router;
