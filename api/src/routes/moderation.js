const express = require('express');
const { authenticateJWT } = require('../middleware/auth');
const { moderationValidation } = require('../middleware/validation');
const { catchAsync } = require('../middleware/errorHandler');
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

// These routes use catchAsync + typed AppErrors from the service layer —
// the exemplar for error handling in this codebase. The global errorHandler
// maps AppError status codes and keeps the {success, error, message} shape.

/**
 * @route   POST /api/moderation/mute/:matchId
 * @desc    Mute notifications for a match
 * @access  Private
 */
router.post(
  '/mute/:matchId',
  authenticateJWT,
  moderationValidation.matchIdParam,
  catchAsync(async (req, res) => {
    const result = await muteMatch(req.user.id, req.params.matchId);
    res.json({
      success: true,
      message: 'Match notifications muted',
      data: result,
    });
  }),
);

/**
 * @route   DELETE /api/moderation/mute/:matchId
 * @desc    Unmute notifications for a match
 * @access  Private
 */
router.delete(
  '/mute/:matchId',
  authenticateJWT,
  moderationValidation.matchIdParam,
  catchAsync(async (req, res) => {
    const result = await unmuteMatch(req.user.id, req.params.matchId);
    res.json({
      success: true,
      message: 'Match notifications unmuted',
      data: result,
    });
  }),
);

/**
 * @route   GET /api/moderation/mute/:matchId/status
 * @desc    Check if a match is muted
 * @access  Private
 */
router.get(
  '/mute/:matchId/status',
  authenticateJWT,
  moderationValidation.matchIdParam,
  catchAsync(async (req, res) => {
    const isMuted = await isMatchMuted(req.user.id, req.params.matchId);
    res.json({
      success: true,
      data: { isMuted },
    });
  }),
);

/**
 * @route   POST /api/moderation/block/:userId
 * @desc    Block a user
 * @access  Private
 */
router.post(
  '/block/:userId',
  authenticateJWT,
  moderationValidation.userIdParam,
  catchAsync(async (req, res) => {
    const result = await blockUser(req.user.id, req.params.userId, req.body.matchId);
    res.json({
      success: true,
      message: 'User blocked successfully',
      data: result,
    });
  }),
);

/**
 * @route   DELETE /api/moderation/block/:userId
 * @desc    Unblock a user
 * @access  Private
 */
router.delete(
  '/block/:userId',
  authenticateJWT,
  moderationValidation.userIdParam,
  catchAsync(async (req, res) => {
    const result = await unblockUser(req.user.id, req.params.userId);
    res.json({
      success: true,
      message: 'User unblocked successfully',
      data: result,
    });
  }),
);

/**
 * @route   GET /api/moderation/blocked
 * @desc    Get list of blocked users
 * @access  Private
 */
router.get(
  '/blocked',
  authenticateJWT,
  catchAsync(async (req, res) => {
    const blockedUsers = await getBlockedUsers(req.user.id);
    res.json({
      success: true,
      data: blockedUsers,
    });
  }),
);

/**
 * @route   POST /api/moderation/unmatch/:matchId
 * @desc    Unmatch from a match
 * @access  Private
 */
router.post(
  '/unmatch/:matchId',
  authenticateJWT,
  moderationValidation.matchIdParam,
  catchAsync(async (req, res) => {
    const result = await unmatch(req.user.id, req.params.matchId);
    res.json({
      success: true,
      message: 'Unmatched successfully',
      data: result,
    });
  }),
);

/**
 * @route   POST /api/moderation/report
 * @desc    Report a user (reason enum enforced by moderationValidation.report)
 * @access  Private
 */
router.post(
  '/report',
  authenticateJWT,
  moderationValidation.report,
  catchAsync(async (req, res) => {
    const { reportedId, reason, description } = req.body;
    const result = await reportUser(req.user.id, reportedId, reason, description);
    res.json({
      success: true,
      message: 'Report submitted successfully',
      data: result,
    });
  }),
);

module.exports = router;
