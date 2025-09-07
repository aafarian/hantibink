const { getPrismaClient } = require('../config/database');
const logger = require('./logger');

const prisma = getPrismaClient();

/**
 * Check if a user meets all requirements to be discoverable
 * @param {Object} user - User object with required fields
 * @returns {boolean} - Whether user meets all discovery requirements
 */
const checkDiscoveryRequirements = (user) => {
  return !!(
    user.gender &&
    user.interestedIn && user.interestedIn.length > 0 &&
    user.photos && user.photos.length > 0 &&
    user.location && 
    user.latitude !== null && 
    user.longitude !== null
  );
};

/**
 * Update user's isDiscoverable status based on their profile completeness
 * @param {string} userId - User ID to update
 * @param {string} context - Context for logging (e.g., 'profile update', 'photo added')
 * @returns {Promise<boolean>} - Returns the new isDiscoverable status
 */
const updateDiscoverableStatus = async (userId, context = 'profile update') => {
  try {
    // Fetch user with required fields
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        gender: true,
        interestedIn: true,
        location: true,
        latitude: true,
        longitude: true,
        isDiscoverable: true,
        photos: {
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!user) {
      logger.error(`User ${userId} not found when updating discoverable status`);
      return false;
    }

    // Check if user meets all requirements
    const hasAllRequirements = checkDiscoveryRequirements(user);

    // Update isDiscoverable if status needs to change
    if (hasAllRequirements && !user.isDiscoverable) {
      await prisma.user.update({
        where: { id: userId },
        data: { isDiscoverable: true },
      });
      logger.info(`✅ User ${user.email} is now discoverable (${context})`);
      return true;
    } else if (!hasAllRequirements && user.isDiscoverable) {
      await prisma.user.update({
        where: { id: userId },
        data: { isDiscoverable: false },
      });
      logger.info(`⚠️ User ${user.email} is no longer discoverable (${context})`);
      return false;
    }

    // No change needed
    return user.isDiscoverable;
  } catch (error) {
    logger.error(`Failed to update discoverable status for user ${userId}:`, error);
    throw error;
  }
};

module.exports = {
  checkDiscoveryRequirements,
  updateDiscoverableStatus,
};