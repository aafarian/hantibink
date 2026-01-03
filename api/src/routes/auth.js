const express = require('express');
const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');
const { authValidation } = require('../middleware/validation');
const { authenticateJWT, optionalAuth } = require('../middleware/auth');
const { getPrismaClient } = require('../config/database');

const prisma = getPrismaClient();
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
 * @desc    Logout user and clear push token
 * @access  Private (optional - still succeeds if token invalid)
 */
router.post('/logout', optionalAuth, async (req, res) => {
  try {
    // If user is authenticated, clear their push token
    if (req.user?.id) {
      await prisma.user.update({
        where: { id: req.user.id },
        data: { pushToken: null },
      });
      logger.info(`🔔 Cleared push token for user ${req.user.id} on logout`);
    }

    res.json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    logger.error('Error during logout:', error);
    // Still return success - logout should always succeed from client perspective
    res.json({
      success: true,
      message: 'Logout successful',
    });
  }
});

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Request password reset
 * @access  Public
 */
router.post('/forgot-password', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
      });
    }

    const { requestPasswordReset } = require('../services/authService');
    const { sendPasswordResetEmail } = require('../services/emailService');

    const result = await requestPasswordReset(email);

    // If we have internal data, send the email
    if (result._internal) {
      const { userName, email: userEmail, resetCode } = result._internal;
      await sendPasswordResetEmail(userEmail, userName, resetCode);
    }

    // Always return success to prevent email enumeration
    res.json({
      success: true,
      message: 'If this email exists, a reset code has been sent',
    });
  } catch (error) {
    logger.error('Forgot password error:', error);
    // Still return success to prevent enumeration
    res.json({
      success: true,
      message: 'If this email exists, a reset code has been sent',
    });
  }
});

/**
 * @route   POST /api/auth/verify-reset-code
 * @desc    Verify password reset code
 * @access  Public
 */
router.post('/verify-reset-code', authLimiter, async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        error: 'Email and code are required',
      });
    }

    const { verifyPasswordResetCode } = require('../services/authService');
    const result = await verifyPasswordResetCode(email, code);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }

    res.json({
      success: true,
      resetToken: result.resetToken,
    });
  } catch (error) {
    logger.error('Verify reset code error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify code',
    });
  }
});

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset password with verified token
 * @access  Public
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Token and new password are required',
      });
    }

    // Validate password strength
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters',
      });
    }

    const { resetPassword } = require('../services/authService');
    const result = await resetPassword(token, newPassword);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
      });
    }

    res.json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (error) {
    logger.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset password',
    });
  }
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
router.post('/oauth/google', authLimiter, async (req, res) => {
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
router.post('/oauth/complete-profile', authLimiter, authenticateJWT, async (req, res) => {
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
router.get('/oauth/check-user', authLimiter, async (req, res) => {
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