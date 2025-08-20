const express = require('express');
const logger = require('../utils/logger');
const { authenticateJWT } = require('../middleware/auth');
const {
  likeUser,
  passUser,
  getUserActions,
  undoLastAction,
} = require('../services/actionsService');

const router = express.Router();

/**
 * @route   GET /api/actions
 * @desc    Get available action endpoints
 * @access  Public
 */
router.get('/', (req, res) => {
  res.json({
    message: 'User Actions API',
    availableEndpoints: [
      'POST /like - Like a user',
      'POST /pass - Pass on a user',
      'POST /super-like - Super like a user',
      'POST /undo - Undo last action',
      'GET /history - Get user action history',
    ],
  });
});

/**
 * @route   POST /api/actions/like
 * @desc    Like a user
 * @access  Private
 */
router.post('/like', authenticateJWT, async (req, res) => {
  try {
    const { targetUserId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: 'Target user ID is required',
      });
    }

    // Get Socket.IO instance from app
    const io = req.app.get('io');

    const result = await likeUser(req.user.id, targetUserId, 'LIKE', io);

    res.json({
      success: true,
      message: result.isMatch ? "It's a match! 🎉" : 'Like sent successfully',
      data: result,
    });
  } catch (error) {
    logger.error('❌ Like user error:', error);

    res.status(400).json({
      success: false,
      error: 'Like action failed',
      message: error.message,
    });
  }
});

/**
 * @route   POST /api/actions/pass
 * @desc    Pass on a user
 * @access  Private
 */
router.post('/pass', authenticateJWT, async (req, res) => {
  try {
    const { targetUserId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: 'Target user ID is required',
      });
    }

    // Get Socket.IO instance from app
    const io = req.app.get('io');

    const result = await passUser(req.user.id, targetUserId, io);

    res.json({
      success: true,
      message: 'Pass action saved successfully',
      data: result,
    });
  } catch (error) {
    logger.error('❌ Pass user error:', error);

    res.status(400).json({
      success: false,
      error: 'Pass action failed',
      message: error.message,
    });
  }
});

/**
 * @route   POST /api/actions/super-like
 * @desc    Super like a user (premium feature)
 * @access  Private
 */
router.post('/super-like', authenticateJWT, async (req, res) => {
  try {
    const { targetUserId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: 'Target user ID is required',
      });
    }

    // TODO: Check if user has super likes available (premium feature)
    const result = await likeUser(req.user.id, targetUserId, 'SUPER_LIKE');

    res.json({
      success: true,
      message: result.isMatch
        ? 'Super match! 💫'
        : 'Super like sent successfully',
      data: result,
    });
  } catch (error) {
    logger.error('❌ Super like user error:', error);

    res.status(400).json({
      success: false,
      error: 'Super like action failed',
      message: error.message,
    });
  }
});

/**
 * @route   POST /api/actions/undo
 * @desc    Undo last action (premium feature)
 * @access  Private
 */
router.post('/undo', authenticateJWT, async (req, res) => {
  try {
    // TODO: Check if user has undo available (premium feature)
    const result = await undoLastAction(req.user.id);

    res.json({
      success: true,
      message: 'Action undone successfully',
      data: result,
    });
  } catch (error) {
    logger.error('❌ Undo action error:', error);

    res.status(400).json({
      success: false,
      error: 'Undo action failed',
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/actions/history
 * @desc    Get user action history
 * @access  Private
 */
router.get('/history', authenticateJWT, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const actions = await getUserActions(req.user.id, {
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.json({
      success: true,
      message: 'Action history retrieved successfully',
      data: actions,
    });
  } catch (error) {
    logger.error('❌ Get action history error:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to get action history',
      message: error.message,
    });
  }
});

/**
 * @route   GET /api/actions/who-liked-me
 * @desc    Get users who liked the current user
 * @access  Private
 */
router.get('/who-liked-me', authenticateJWT, async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const { getWhoLikedMe } = require('../services/actionsService');
    
    const likers = await getWhoLikedMe(req.user.id, {
      limit: parseInt(limit) || 20,
      offset: parseInt(offset) || 0,
    });

    res.json({
      success: true,
      message: 'Retrieved users who liked you',
      data: likers,
    });
  } catch (error) {
    logger.error('❌ Get who liked me error:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to get who liked you',
      message: error.message,
    });
  }
});

module.exports = router;
