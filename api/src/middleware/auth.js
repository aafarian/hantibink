const { verifyToken, extractTokenFromHeader } = require('../utils/jwt');
const { verifyIdToken } = require('../config/firebase');
const logger = require('../utils/logger');
const { getPrismaClient } = require('../config/database');

const prisma = getPrismaClient();

/**
 * JWT Authentication Middleware
 */
const authenticateJWT = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'No token provided',
      });
    }

    // Verify JWT token
    const decoded = verifyToken(token);
    
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        firebaseUid: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'User not found',
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'User account is inactive',
      });
    }

    // Attach user to request
    req.user = user;
    req.token = token;
    
    next();
  } catch (error) {
    logger.error('❌ JWT authentication failed:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Invalid token',
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'Token expired',
      });
    }

    return res.status(500).json({
      error: 'Internal server error',
      message: 'Authentication service unavailable',
    });
  }
};

/**
 * Firebase Authentication Middleware
 */
const authenticateFirebase = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'No Firebase ID token provided',
      });
    }

    // Verify Firebase ID token
    const decodedToken = await verifyIdToken(token);
    
    // Get user from database using Firebase UID
    const user = await prisma.user.findUnique({
      where: { firebaseUid: decodedToken.uid },
      select: {
        id: true,
        email: true,
        name: true,
        firebaseUid: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'User not found',
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'User account is inactive',
      });
    }

    // Attach user and Firebase token to request
    req.user = user;
    req.firebaseToken = decodedToken;
    req.token = token;
    
    next();
  } catch (error) {
    logger.error('❌ Firebase authentication failed:', error);
    
    return res.status(401).json({
      error: 'Authentication failed',
      message: 'Invalid Firebase ID token',
    });
  }
};

/**
 * Optional Authentication Middleware
 * Authenticates if token is provided, but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      // No token provided, continue without authentication
      req.user = null;
      return next();
    }

    // Try to authenticate
    const decoded = verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        firebaseUid: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (user && user.isActive) {
      req.user = user;
      req.token = token;
    } else {
      req.user = null;
    }

    next();
  } catch (error) {
    // If authentication fails, continue without user
    logger.warn('⚠️ Optional authentication failed:', error.message);
    req.user = null;
    next();
  }
};

/**
 * Admin Role Middleware
 * Requires authentication and admin role
 */
const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please authenticate first',
      });
    }

    // Check if user has admin role (you can extend this based on your role system)
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@hantibink.com';
    if (req.user.email !== adminEmail) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Admin privileges required',
      });
    }

    next();
  } catch (error) {
    logger.error('❌ Admin authorization failed:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Authorization service unavailable',
    });
  }
};

module.exports = {
  authenticateJWT,
  authenticateFirebase,
  optionalAuth,
  requireAdmin,
};
