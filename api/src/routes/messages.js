const express = require('express');
const logger = require('../utils/logger');
const { authenticateJWT } = require('../middleware/auth');
const { messageValidation } = require('../middleware/validation');
const { writeBurstLimiter } = require('../middleware/rateLimiters');
const {
  getMessages,
  sendMessage,
  markMessagesAsRead,
  deleteMessage,
} = require('../services/messagesService');
const { addReaction, removeReaction } = require('../services/reactionsService');
const { getPrismaClient } = require('../config/database');

const router = express.Router();
const prisma = getPrismaClient();

// Helper to update user's lastActive (fire and forget with logging)
const updateLastActive = (userId) => {
  prisma.user.update({
    where: { id: userId },
    data: { lastActive: new Date() },
  }).catch(error => {
    logger.warn(`Failed to update lastActive for user ${userId}:`, error.message);
  });
};

/**
 * @route   GET /api/messages
 * @desc    Get available message endpoints
 * @access  Public
 */
router.get('/', (req, res) => {
  res.json({
    message: 'Messages API',
    availableEndpoints: [
      'GET /:matchId - Get messages for a match',
      'POST /:matchId - Send a message',
      'PUT /:matchId/read - Mark messages as read',
      'DELETE /:messageId - Delete a message',
      'POST /:matchId/:messageId/reaction - Add reaction to a message',
      'DELETE /:matchId/:messageId/reaction - Remove reaction from a message',
    ],
  });
});

/**
 * @route   GET /api/messages/:matchId
 * @desc    Get messages for a match
 * @access  Private
 */
router.get('/:matchId', authenticateJWT, messageValidation.getMessages, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    // Update user's lastActive
    updateLastActive(req.user.id);

    const messages = await getMessages(matchId, req.user.id, {
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    // Disable caching for messages to always get fresh data
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');

    res.json({
      success: true,
      message: 'Messages retrieved successfully',
      data: messages,
    });
  } catch (error) {
    logger.error('❌ Get messages error:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to get messages',
      message: error.message,
    });
  }
});

/**
 * @route   POST /api/messages/:matchId
 * @desc    Send a message in a match
 * @access  Private
 */
router.post('/:matchId', authenticateJWT, writeBurstLimiter, messageValidation.sendMessage, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { content, messageType = 'TEXT', mediaUrl = null, metadata = null, replyToId = null } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: 'Message content is required',
      });
    }

    // Get Socket.IO instance from app
    const io = req.app.get('io');

    const message = await sendMessage(
      matchId,
      req.user.id,
      {
        content: content.trim(),
        messageType,
        mediaUrl,
        metadata,
        replyToId,
      },
      io,
    );

    res.json({
      success: true,
      message: 'Message sent successfully',
      data: message,
    });
  } catch (error) {
    logger.error('❌ Send message error:', error);

    res.status(400).json({
      success: false,
      error: 'Failed to send message',
      message: error.message,
    });
  }
});

/**
 * @route   PUT /api/messages/:matchId/read
 * @desc    Mark messages as read in a match
 * @access  Private
 */
router.put('/:matchId/read', authenticateJWT, messageValidation.markAsRead, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { messageIds = [] } = req.body;

    // Get Socket.IO instance from app
    const io = req.app.get('io');

    const result = await markMessagesAsRead(
      matchId,
      req.user.id,
      messageIds,
      io,
    );

    res.json({
      success: true,
      message: 'Messages marked as read successfully',
      data: result,
    });
  } catch (error) {
    logger.error('❌ Mark messages as read error:', error);

    res.status(400).json({
      success: false,
      error: 'Failed to mark messages as read',
      message: error.message,
    });
  }
});

/**
 * @route   DELETE /api/messages/:messageId
 * @desc    Delete a message
 * @access  Private
 */
router.delete('/:messageId', authenticateJWT, async (req, res) => {
  try {
    const { messageId } = req.params;

    const result = await deleteMessage(messageId, req.user.id);

    res.json({
      success: true,
      message: 'Message deleted successfully',
      data: result,
    });
  } catch (error) {
    logger.error('❌ Delete message error:', error);

    res.status(400).json({
      success: false,
      error: 'Failed to delete message',
      message: error.message,
    });
  }
});

/**
 * @route   POST /api/messages/:matchId/:messageId/reaction
 * @desc    Add or toggle a reaction on a message
 * @access  Private
 */
router.post('/:matchId/:messageId/reaction', authenticateJWT, writeBurstLimiter, messageValidation.addReaction, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;

    if (!emoji) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: 'Emoji is required',
      });
    }

    // Get Socket.IO instance from app
    const io = req.app.get('io');

    const result = await addReaction(messageId, req.user.id, emoji, io);

    res.json({
      success: true,
      message: `Reaction ${result.action} successfully`,
      data: result,
    });
  } catch (error) {
    logger.error('❌ Add reaction error:', error);

    res.status(400).json({
      success: false,
      error: 'Failed to add reaction',
      message: error.message,
    });
  }
});

/**
 * @route   DELETE /api/messages/:matchId/:messageId/reaction
 * @desc    Remove a reaction from a message
 * @access  Private
 */
router.delete('/:matchId/:messageId/reaction', authenticateJWT, writeBurstLimiter, messageValidation.removeReaction, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;

    if (!emoji) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        message: 'Emoji is required',
      });
    }

    // Get Socket.IO instance from app
    const io = req.app.get('io');

    const result = await removeReaction(messageId, req.user.id, emoji, io);

    res.json({
      success: true,
      message: 'Reaction removed successfully',
      data: result,
    });
  } catch (error) {
    logger.error('❌ Remove reaction error:', error);

    res.status(400).json({
      success: false,
      error: 'Failed to remove reaction',
      message: error.message,
    });
  }
});

module.exports = router;
