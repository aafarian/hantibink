const { getPrismaClient } = require('../config/database');
const logger = require('../utils/logger');

const prisma = getPrismaClient();

/**
 * Middleware to check if user is eligible for discovery
 * Requirements:
 * - Must have gender set
 * - Must have interestedIn preferences
 * - Must have at least one photo
 * - Must have location set
 */
const checkDiscoveryEligibility = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Get user's profile with necessary fields
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        gender: true,
        interestedIn: true,
        location: true,
        latitude: true,
        longitude: true,
        isDiscoverable: true,
        photos: {
          select: { id: true },
          take: 1, // Just check if they have at least one
        },
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    // Build list of missing requirements
    const missingRequirements = [];
    
    if (!user.gender) {
      missingRequirements.push('gender');
    }
    
    if (!user.interestedIn || user.interestedIn.length === 0) {
      missingRequirements.push('interestedIn');
    }
    
    if (!user.photos || user.photos.length === 0) {
      missingRequirements.push('photos');
    }
    
    if (!user.location || !user.latitude || !user.longitude) {
      missingRequirements.push('location');
    }

    // If any requirements are missing, return appropriate error
    if (missingRequirements.length > 0) {
      logger.info(`User ${userId} missing discovery requirements:`, missingRequirements);
      
      return res.status(403).json({
        success: false,
        error: 'PROFILE_INCOMPLETE',
        message: 'Please complete your profile to use discovery',
        missingRequirements,
        details: {
          gender: !user.gender ? 'Please select your gender' : null,
          interestedIn: (!user.interestedIn || user.interestedIn.length === 0) 
            ? 'Please select who you are interested in' : null,
          photos: (!user.photos || user.photos.length === 0) 
            ? 'Please add at least one photo' : null,
          location: (!user.location || !user.latitude || !user.longitude) 
            ? 'Please enable location to find matches near you' : null,
        },
      });
    }

    // Check if user is discoverable (additional business logic check)
    if (!user.isDiscoverable) {
      logger.info(`User ${userId} is not discoverable`);
      
      return res.status(403).json({
        success: false,
        error: 'NOT_DISCOVERABLE',
        message: 'Your profile is not set to discoverable',
        details: 'Please complete your profile setup or verify your email to become discoverable',
      });
    }

    // User is eligible, attach to request for use in route handlers
    req.discoveryUser = user;
    next();
  } catch (error) {
    logger.error('Discovery eligibility check error:', error);
    
    return res.status(500).json({
      success: false,
      error: 'DISCOVERY_CHECK_FAILED',
      message: 'Failed to verify discovery eligibility',
    });
  }
};

/**
 * Middleware to track discovery activity
 */
const trackDiscoveryActivity = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Update last activity timestamp
    await prisma.user.update({
      where: { id: userId },
      data: {
        lastActiveAt: new Date(),
      },
    });
    
    next();
  } catch (error) {
    // Don't block the request if tracking fails
    logger.warn('Failed to track discovery activity:', error);
    next();
  }
};

module.exports = {
  checkDiscoveryEligibility,
  trackDiscoveryActivity,
};