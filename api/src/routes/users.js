/**
 * User management routes
 * TODO: Implement
 */

const express = require('express');
const router = express.Router();

// Placeholder routes
router.get('/', (req, res) => {
  res.json({
    message: 'User routes',
    availableEndpoints: [
      'GET /profile - Get user profile',
      'PUT /profile - Update user profile',
      'POST /upload-photo - Upload profile photo',
      'DELETE /photo/:id - Delete profile photo',
      'GET /preferences - Get user preferences',
      'PUT /preferences - Update user preferences',
      'DELETE /account - Delete user account',
    ],
  });
});

module.exports = router;