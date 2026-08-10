const express = require('express');
const logger = require('../utils/logger');
const { authenticateJWT } = require('../middleware/auth');
const { actionValidation } = require('../middleware/validation');
const { writeBurstLimiter } = require('../middleware/rateLimiters');
const {
  likeUser,
  passUser,
  getUserActions,
  undoLastAction,
  getWhoLikedMe,
} = require('../services/actionsService');
const { getUserQuotas } = require('../services/premiumService');

const router = express.Router();

/**
 * Helper to handle premium-related errors
 */
const handlePremiumError = (error, res) => {
  if (error.code === 'PREMIUM_REQUIRED' || error.code === 'DAILY_LIMIT_REACHED') {
    // Expected outcome, not an incident: warn (logger.error would forward
    // to Sentry via its wrapper and page for every free user out of likes)
    logger.warn(`Quota/premium gate: ${error.code} — ${error.message}`);
    return res.status(403).json({
      success: false,
      error: error.code,
      code: error.code,
      message: error.message,
      quotas: error.quotas,
    });
  }
  return null;
};

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
      'POST /super-like - Super like a user (Premium)',
      'POST /undo - Undo last action (Premium)',
      'GET /history - Get user action history',
      'GET /quotas - Get daily quotas and limits',
    ],
  });
});

/**
 * @route   GET /api/actions/quotas
 * @desc    Get user's current daily quotas and premium status
 * @access  Private
 */
router.get('/quotas', authenticateJWT, async (req, res) => {
  try {
    const quotas = await getUserQuotas(req.user.id);

    res.json({
      success: true,
      message: 'Quotas retrieved successfully',
      data: quotas,
    });
  } catch (error) {
    logger.error('❌ Get quotas error:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to get quotas',
      message: error.message,
    });
  }
});

/**
 * @route   POST /api/actions/like
 * @desc    Like a user
 * @access  Private
 */
router.post('/like', authenticateJWT, writeBurstLimiter, actionValidation.like, async (req, res) => {
  try {
    const { targetUserId } = req.body;

    // Get Socket.IO instance from app
    const io = req.app.get('io');

    const result = await likeUser(req.user.id, targetUserId, 'LIKE', io);

    res.json({
      success: true,
      message: result.isMatch ? "It's a match! 🎉" : 'Like sent successfully',
      data: result,
    });
  } catch (error) {
    // Handle premium-related errors with 403
    const premiumResponse = handlePremiumError(error, res);
    if (premiumResponse) {
      return;
    }

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
router.post('/pass', authenticateJWT, writeBurstLimiter, actionValidation.pass, async (req, res) => {
  try {
    const { targetUserId } = req.body;

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
router.post('/super-like', authenticateJWT, writeBurstLimiter, actionValidation.superLike, async (req, res) => {
  try {
    const { targetUserId } = req.body;

    // Get Socket.IO instance from app
    const io = req.app.get('io');

    const result = await likeUser(req.user.id, targetUserId, 'SUPER_LIKE', io);

    res.json({
      success: true,
      message: result.isMatch
        ? 'Super match! 💫'
        : 'Super like sent successfully',
      data: result,
    });
  } catch (error) {
    // Handle premium-related errors with 403
    const premiumResponse = handlePremiumError(error, res);
    if (premiumResponse) {
      return;
    }

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
router.post('/undo', authenticateJWT, writeBurstLimiter, async (req, res) => {
  try {
    const result = await undoLastAction(req.user.id, req.app.get('io'));

    res.json({
      success: true,
      message: 'Action undone successfully',
      data: result,
    });
  } catch (error) {
    // Handle premium-related errors with 403
    const premiumResponse = handlePremiumError(error, res);
    if (premiumResponse) {
      return;
    }

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
router.get('/history', authenticateJWT, actionValidation.getHistory, async (req, res) => {
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
router.get('/who-liked-me', authenticateJWT, actionValidation.getWhoLikedMe, async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const result = await getWhoLikedMe(req.user.id, {
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });

    res.json({
      success: true,
      message: 'Retrieved users who liked you',
      data: result.users,
      totalCount: result.totalCount,
      totalLikesCount: result.totalLikesCount,
      isPremium: result.isPremium,
      premiumRequired: result.premiumRequired,
      hiddenCount: result.hiddenCount,
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
