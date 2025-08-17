const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

/**
 * Get users for discovery/swiping
 */
const getUsersForDiscovery = async (currentUserId, options = {}) => {
  try {
    const { limit = 20, excludeIds = [], filters = {} } = options;

    // Get user's already processed user IDs (liked/passed)
    const userActions = await prisma.userAction.findMany({
      where: { senderId: currentUserId },
      select: { receiverId: true },
    });

    const processedUserIds = userActions.map((action) => action.receiverId);

    // Combine with explicitly excluded IDs
    const allExcludedIds = [
      ...new Set([...processedUserIds, ...excludeIds, currentUserId]),
    ];

    logger.info(
      `User ${currentUserId} has acted on ${processedUserIds.length} users:`,
      processedUserIds,
    );
    logger.info(`Total excluded IDs: ${allExcludedIds.length}`);

    // Get current user's preferences for filtering
    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: {
        interestedIn: true,
        latitude: true,
        longitude: true,
        birthDate: true,
      },
    });

    if (!currentUser) {
      throw new Error('Current user not found');
    }

    // Build where clause for filtering
    const whereClause = {
      id: { notIn: allExcludedIds },
      isActive: true,
      // Match user's interested in preferences
      gender: { in: currentUser.interestedIn },
    };

    // Apply additional filters if provided
    if (filters.ageRange) {
      const { min, max } = filters.ageRange;
      const maxDate = new Date();
      maxDate.setFullYear(maxDate.getFullYear() - min);
      const minDate = new Date();
      minDate.setFullYear(minDate.getFullYear() - max);

      whereClause.birthDate = {
        gte: minDate,
        lte: maxDate,
      };
    }

    if (filters.maxDistance && currentUser.latitude && currentUser.longitude) {
      // TODO: Implement distance-based filtering using PostGIS or similar
      // For now, we'll just include users with location data
      whereClause.latitude = { not: null };
      whereClause.longitude = { not: null };
    }

    // Get users for discovery
    const users = await prisma.user.findMany({
      where: whereClause,
      include: {
        photos: {
          orderBy: { order: 'asc' },
        },
        interests: {
          include: {
            interest: true,
          },
        },
      },
      take: limit,
      orderBy: { createdAt: 'desc' }, // Show newer users first
    });

    // Filter out users without photos and calculate age
    const usersWithAge = users
      .filter((user) => user.photos && user.photos.length > 0) // Only users with photos
      .map((user) => {
        const age = calculateAge(user.birthDate);

        // Don't expose sensitive data
        const { ...userWithoutSensitive } = user;

        return {
          ...userWithoutSensitive,
          age,
        };
      });

    logger.info(
      `Found ${usersWithAge.length} users for discovery for user ${currentUserId}`,
    );
    return usersWithAge;
  } catch (error) {
    logger.error('❌ Error getting users for discovery:', error);
    throw error;
  }
};

/**
 * Calculate age from birth date
 */
const calculateAge = (birthDate) => {
  if (!birthDate) {
    return null;
  }

  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age;
};

module.exports = {
  getUsersForDiscovery,
};
