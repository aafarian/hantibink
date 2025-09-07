const express = require('express');
const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');
const { authValidation } = require('../middleware/validation');
const { authenticateJWT } = require('../middleware/auth');
const {
  registerUser,
  loginUser,
  loginWithFirebase,
  refreshTokens,
  checkEmailExists,
} = require('../services/authService');
const {
  verifyEmailWithToken,
  resendVerificationEmail,
  sendWelcomeEmail,
} = require('../services/emailService');
const { googleAuth, completeOAuthProfile, checkUserExists } = require('../services/oauthService');

const router = express.Router();

// Create a more lenient rate limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: process.env.NODE_ENV === 'development' ? 1 * 60 * 1000 : 5 * 60 * 1000, // 1 min for dev, 5 min for prod
  max: process.env.NODE_ENV === 'development' ? 50 : 10, // 50 attempts in dev, 10 in prod
  message: {
    error: 'Too many authentication attempts, please try again later',
    retryAfter: process.env.NODE_ENV === 'development' ? 60 : 300,
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

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
      'POST /resend-verification - Resend verification email',
    ],
  });
});

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', authLimiter, authValidation.register, async (req, res) => {
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
 * @route   POST /api/auth/check-email
 * @desc    Check if email is already registered
 * @access  Public
 */
router.post('/check-email', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
      });
    }
    
    // Check if email exists
    const exists = await checkEmailExists(email);
    
    res.json({
      success: true,
      exists,
      available: !exists,
    });
  } catch (error) {
    logger.error('❌ Email check error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Failed to check email',
      message: error.message,
    });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Login user with email and password
 * @access  Public
 */
router.post('/login', authLimiter, authValidation.login, async (req, res) => {
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
router.post('/firebase-login', authLimiter, authValidation.firebaseLogin, async (req, res) => {
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
router.post('/refresh', authValidation.refreshToken, async (req, res) => {
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
    message: 'Password reset request endpoint!!',
    endpoint: 'POST /api/auth/forgot-password',
    status: 'Coming soon - will integrate with email service!!',
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
 * @desc    Verify email address with token
 * @access  Public
 */
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Verification token is required',
      });
    }
    
    const user = await verifyEmailWithToken(token);
    
    // Send welcome email
    await sendWelcomeEmail(user.email, user.name);
    
    res.json({
      success: true,
      message: 'Email verified successfully',
      data: {
        emailVerified: true,
        requiresSetup: user.onboardingStage === 'REGISTERED',
      },
    });
  } catch (error) {
    logger.error('❌ Email verification error:', error);
    
    res.status(400).json({
      success: false,
      error: 'Email verification failed',
      message: error.message,
    });
  }
});

/**
 * @route   POST /api/auth/resend-verification
 * @desc    Resend verification email
 * @access  Private (requires authentication)
 */
router.post('/resend-verification', authenticateJWT, async (req, res) => {
  try {
    // Get user ID from authenticated user
    const userId = req.user.id;
    
    await resendVerificationEmail(userId);
    
    res.json({
      success: true,
      message: 'Verification email sent successfully',
    });
  } catch (error) {
    logger.error('❌ Resend verification error:', error);
    
    const statusCode = error.message.includes('wait') ? 429 : 400;
    
    res.status(statusCode).json({
      success: false,
      error: 'Failed to resend verification email',
      message: error.message,
    });
  }
});

/**
 * @route   POST /api/auth/oauth/google
 * @desc    Authenticate with Google OAuth
 * @access  Public
 */
router.post('/oauth/google', async (req, res) => {
  try {
    const { idToken, accessToken } = req.body;
    
    if (!idToken && !accessToken) {
      return res.status(400).json({
        success: false,
        error: 'TOKEN_REQUIRED',
        message: 'Google authentication token is required',
      });
    }
    
    const result = await googleAuth(idToken, accessToken);
    
    res.json({
      success: true,
      message: result.isNewUser ? 'Registration successful' : 'Login successful',
      data: {
        user: result.user,
        token: result.token,
        refreshToken: result.refreshToken,
        isNewUser: result.isNewUser,
        requiresSetup: result.requiresSetup,
        missingFields: result.missingFields,
      },
    });
  } catch (error) {
    logger.error('Google OAuth error:', error);
    
    res.status(401).json({
      success: false,
      error: 'OAUTH_FAILED',
      message: error.message || 'Google authentication failed',
    });
  }
});

/**
 * @route   POST /api/auth/oauth/complete-profile
 * @desc    Complete OAuth profile with missing fields
 * @access  Private
 */
router.post('/oauth/complete-profile', authenticateJWT, async (req, res) => {
  try {
    const { birthDate, gender, interestedIn } = req.body;
    
    // Validate required fields
    if (!birthDate) {
      return res.status(400).json({
        success: false,
        error: 'BIRTHDATE_REQUIRED',
        message: 'Birth date is required',
      });
    }
    
    const result = await completeOAuthProfile(req.user.id, {
      birthDate,
      gender,
      interestedIn,
    });
    
    res.json({
      success: true,
      message: 'Profile completed successfully',
      data: result.user,
    });
  } catch (error) {
    logger.error('Complete OAuth profile error:', error);
    
    res.status(500).json({
      success: false,
      error: 'PROFILE_COMPLETION_FAILED',
      message: error.message || 'Failed to complete profile',
    });
  }
});

/**
 * @route   GET /api/auth/oauth/check-user
 * @desc    Check if user exists and their auth methods
 * @access  Public
 */
router.get('/oauth/check-user', async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'EMAIL_REQUIRED',
        message: 'Email is required',
      });
    }
    
    const result = await checkUserExists(email);
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Check user exists error:', error);
    
    res.status(500).json({
      success: false,
      error: 'CHECK_USER_FAILED',
      message: error.message || 'Failed to check user',
    });
  }
});

module.exports = router;