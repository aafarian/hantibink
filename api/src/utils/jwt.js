const jwt = require('jsonwebtoken');
const logger = require('./logger');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_change_in_production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

/**
 * Generate JWT access token
 */
const generateAccessToken = (payload) => {
  try {
    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'hantibink-api',
      audience: 'hantibink-app',
    });
    
    logger.info(`✅ Access token generated for user: ${payload.userId}`);
    return token;
  } catch (error) {
    logger.error('❌ Failed to generate access token:', error);
    throw error;
  }
};

/**
 * Generate JWT refresh token
 */
const generateRefreshToken = (payload) => {
  try {
    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_REFRESH_EXPIRES_IN,
      issuer: 'hantibink-api',
      audience: 'hantibink-app',
    });
    
    logger.info(`✅ Refresh token generated for user: ${payload.userId}`);
    return token;
  } catch (error) {
    logger.error('❌ Failed to generate refresh token:', error);
    throw error;
  }
};

/**
 * Verify JWT token
 */
const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'hantibink-api',
      audience: 'hantibink-app',
    });
    
    return decoded;
  } catch (error) {
    logger.error('❌ Failed to verify token:', error);
    throw error;
  }
};

/**
 * Decode JWT token without verification (for debugging)
 */
const decodeToken = (token) => {
  try {
    return jwt.decode(token, { complete: true });
  } catch (error) {
    logger.error('❌ Failed to decode token:', error);
    throw error;
  }
};

/**
 * Generate token pair (access + refresh)
 */
const generateTokenPair = (payload) => {
  try {
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken({ 
      userId: payload.userId,
      type: 'refresh'
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: JWT_EXPIRES_IN,
    };
  } catch (error) {
    logger.error('❌ Failed to generate token pair:', error);
    throw error;
  }
};

/**
 * Extract token from Authorization header
 */
const extractTokenFromHeader = (authHeader) => {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
  decodeToken,
  generateTokenPair,
  extractTokenFromHeader,
};
