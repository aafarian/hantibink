const express = require('express');
const logger = require('../utils/logger');
const { validate } = require('../utils/validation');
const {
  registerSchema,
  loginSchema,
  firebaseTokenSchema,
  refreshTokenSchema,
} = require('../utils/validation');
const {
  registerUser,
  loginUser,
  loginWithFirebase,
  refreshTokens,
} = require('../services/authService');

const router = express.Router();

/**
 * @route   GET /api/auth
 * @desc    Get available authentication endpoints
 * @access  Public
 */
router.get('/', (req, res) => {
  res.json({
    message: 'Authentication API',
    availableEndpoints: [
      'POST /register - User registration',
      'POST /login - User login',
      'POST /firebase-login - Firebase login',
      'POST /logout - User logout',
      'POST /refresh - Refresh token',
      'POST /forgot-password - Password reset request',
      'POST /reset-password - Password reset',
      'POST /verify-email - Email verification',
    ],
  });
});

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', validate(registerSchema), async (req, res) => {
  try {

    
    const result = await registerUser(req.body);
    
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: result,
    });
  } catch (error) {
    logger.error('❌ Registration error:', error);
    
    res.status(400).json({
      success: false,
      error: 'Registration failed',
      message: error.message,
    });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Login user with email and password
 * @access  Public
 */
router.post('/login', validate(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await loginUser(email, password);
    
    res.json({
      success: true,
      message: 'Login successful',
      data: result,
    });
  } catch (error) {
    logger.error('❌ Login error:', error);
    
    res.status(401).json({
      success: false,
      error: 'Login failed',
      message: error.message,
    });
  }
});

/**
 * @route   POST /api/auth/firebase-login
 * @desc    Login user with Firebase ID token
 * @access  Public
 */
router.post('/firebase-login', validate(firebaseTokenSchema), async (req, res) => {
  try {
    const { idToken } = req.body;
    const result = await loginWithFirebase(idToken);
    
    res.json({
      success: true,
      message: 'Firebase login successful',
      data: result,
    });
  } catch (error) {
    logger.error('❌ Firebase login error:', error);
    
    res.status(401).json({
      success: false,
      error: 'Firebase login failed',
      message: error.message,
    });
  }
});

/**
 * @route   POST /api/auth/refresh
 * @desc    Refresh access token
 * @access  Public
 */
router.post('/refresh', validate(refreshTokenSchema), async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const tokens = await refreshTokens(refreshToken);
    
    res.json({
      success: true,
      message: 'Tokens refreshed successfully',
      data: tokens,
    });
  } catch (error) {
    logger.error('❌ Token refresh error:', error);
    
    res.status(401).json({
      success: false,
      error: 'Token refresh failed',
      message: error.message,
    });
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Logout user (client-side token removal)
 * @access  Private
 */
router.post('/logout', (req, res) => {
  // For JWT tokens, logout is handled client-side by removing the token
  // In the future, you might want to implement token blacklisting
  res.json({
    success: true,
    message: 'Logout successful',
  });
});

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
router.post('/forgot-password', (req, res) => {
  res.json({
    message: 'Password reset request endpoint',
    endpoint: 'POST /api/auth/forgot-password',
    status: 'Coming soon - will integrate with email service',
  });
});

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password
 * @access  Public
 */
router.post('/reset-password', (req, res) => {
  res.json({
    message: 'Password reset endpoint',
    endpoint: 'POST /api/auth/reset-password',
    status: 'Coming soon - will integrate with email service',
  });
});

/**
 * @route   POST /api/auth/verify-email
 * @desc    Verify email address
 * @access  Public
 */
router.post('/verify-email', (req, res) => {
  res.json({
    message: 'Email verification endpoint',
    endpoint: 'POST /api/auth/verify-email',
    status: 'Coming soon - will integrate with Firebase Auth',
  });
});

module.exports = router;