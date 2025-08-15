/**
 * Authentication routes
 * TODO: Implement
 */

const express = require('express');
const router = express.Router();

// Placeholder routes
router.get('/', (req, res) => {
  res.json({
    message: 'Authentication routes',
    availableEndpoints: [
      'POST /register - User registration',
      'POST /login - User login',
      'POST /logout - User logout',
      'POST /refresh - Refresh token',
      'POST /forgot-password - Password reset request',
      'POST /reset-password - Password reset',
      'POST /verify-email - Email verification',
    ],
  });
});

module.exports = router;
