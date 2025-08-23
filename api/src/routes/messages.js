const express = require('express');
const logger = require('../utils/logger');
const { authenticateJWT } = require('../middleware/auth');
const { messageValidation } = require('../middleware/validation');
const {
  getMessages,
  sendMessage,
  markMessagesAsRead,
  deleteMessage,
} = require('../services/messagesService');

const router = express.Router();

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

    const messages = await getMessages(matchId, req.user.id, {
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

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
router.post('/:matchId', authenticateJWT, messageValidation.sendMessage, async (req, res) => {
  try {
    const { matchId } = req.params;
    const { content, messageType = 'TEXT' } = req.body;

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

module.exports = router;
