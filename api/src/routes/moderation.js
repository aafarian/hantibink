const express = require('express');
const logger = require('../utils/logger');
const { authenticateJWT } = require('../middleware/auth');
const { moderationValidation } = require('../middleware/validation');
const {
  muteMatch,
  unmuteMatch,
  isMatchMuted,
  blockUser,
  unblockUser,
  getBlockedUsers,
  unmatch,
  reportUser,
} = require('../services/moderationService');

const router = express.Router();

/**
 * @route   POST /api/moderation/mute/:matchId
 * @desc    Mute notifications for a match
 * @access  Private
 */
router.post('/mute/:matchId', authenticateJWT, moderationValidation.matchIdParam, async (req, res) => {
  try {
    const { matchId } = req.params;
    const result = await muteMatch(req.user.id, matchId);

    res.json({
      success: true,
      message: 'Match notifications muted',
      data: result,
    });
  } catch (error) {
    logger.error('Mute match error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to mute match',
    });
  }
});

/**
 * @route   DELETE /api/moderation/mute/:matchId
 * @desc    Unmute notifications for a match
 * @access  Private
 */
router.delete('/mute/:matchId', authenticateJWT, moderationValidation.matchIdParam, async (req, res) => {
  try {
    const { matchId } = req.params;
    const result = await unmuteMatch(req.user.id, matchId);

    res.json({
      success: true,
      message: 'Match notifications unmuted',
      data: result,
    });
  } catch (error) {
    logger.error('Unmute match error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to unmute match',
    });
  }
});

/**
 * @route   GET /api/moderation/mute/:matchId/status
 * @desc    Check if a match is muted
 * @access  Private
 */
router.get('/mute/:matchId/status', authenticateJWT, moderationValidation.matchIdParam, async (req, res) => {
  try {
    const { matchId } = req.params;
    const isMuted = await isMatchMuted(req.user.id, matchId);

    res.json({
      success: true,
      data: { isMuted },
    });
  } catch (error) {
    logger.error('Check mute status error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to check mute status',
    });
  }
});

/**
 * @route   POST /api/moderation/block/:userId
 * @desc    Block a user
 * @access  Private
 */
router.post('/block/:userId', authenticateJWT, moderationValidation.userIdParam, async (req, res) => {
  try {
    const { userId: blockedId } = req.params;
    const { matchId } = req.body;
    const result = await blockUser(req.user.id, blockedId, matchId);

    res.json({
      success: true,
      message: 'User blocked successfully',
      data: result,
    });
  } catch (error) {
    logger.error('Block user error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to block user',
    });
  }
});

/**
 * @route   DELETE /api/moderation/block/:userId
 * @desc    Unblock a user
 * @access  Private
 */
router.delete('/block/:userId', authenticateJWT, moderationValidation.userIdParam, async (req, res) => {
  try {
    const { userId: blockedId } = req.params;
    const result = await unblockUser(req.user.id, blockedId);

    res.json({
      success: true,
      message: 'User unblocked successfully',
      data: result,
    });
  } catch (error) {
    logger.error('Unblock user error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to unblock user',
    });
  }
});

/**
 * @route   GET /api/moderation/blocked
 * @desc    Get list of blocked users
 * @access  Private
 */
router.get('/blocked', authenticateJWT, async (req, res) => {
  try {
    const blockedUsers = await getBlockedUsers(req.user.id);

    res.json({
      success: true,
      data: blockedUsers,
    });
  } catch (error) {
    logger.error('Get blocked users error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get blocked users',
    });
  }
});

/**
 * @route   POST /api/moderation/unmatch/:matchId
 * @desc    Unmatch from a match
 * @access  Private
 */
router.post('/unmatch/:matchId', authenticateJWT, moderationValidation.matchIdParam, async (req, res) => {
  try {
    const { matchId } = req.params;
    const result = await unmatch(req.user.id, matchId);

    res.json({
      success: true,
      message: 'Unmatched successfully',
      data: result,
    });
  } catch (error) {
    logger.error('Unmatch error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to unmatch',
    });
  }
});

/**
 * @route   POST /api/moderation/report
 * @desc    Report a user
 * @access  Private
 */
router.post('/report', authenticateJWT, moderationValidation.report, async (req, res) => {
  try {
    const { reportedId, reason, description } = req.body;

    if (!reportedId || !reason) {
      return res.status(400).json({
        success: false,
        error: 'reportedId and reason are required',
      });
    }

    // Validate reason enum
    const validReasons = [
      'INAPPROPRIATE_PHOTOS',
      'HARASSMENT',
      'SPAM',
      'FAKE_PROFILE',
      'UNDERAGE',
      'OTHER',
    ];

    if (!validReasons.includes(reason)) {
      return res.status(400).json({
        success: false,
        error: `Invalid reason. Must be one of: ${validReasons.join(', ')}`,
      });
    }

    const result = await reportUser(req.user.id, reportedId, reason, description);

    res.json({
      success: true,
      message: 'Report submitted successfully',
      data: result,
    });
  } catch (error) {
    logger.error('Report user error:', error);
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to submit report',
    });
  }
});

module.exports = router;
