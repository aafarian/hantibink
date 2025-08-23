const { getPrismaClient } = require('../config/database');
const logger = require('../utils/logger');

const prisma = getPrismaClient();

/**
 * Calculate distance between two coordinates using Haversine formula
 * @returns Distance in kilometers
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
};

const toRad = (deg) => {
  return deg * (Math.PI / 180);
};

/**
 * Get users for discovery/swiping
 */
const getUsersForDiscovery = async (currentUserId, options = {}) => {
  try {
    const { 
      limit = 20, 
      excludeIds = [], 
      filters = {} 
    } = options;

    // Default filter values
    const defaultFilters = {
      ageRange: { min: 18, max: 100 },
      maxDistance: 100, // km
      ...filters
    };

    // Get user's already processed user IDs (liked/passed)
    const userActions = await prisma.userAction.findMany({
      where: { senderId: currentUserId },
      select: { receiverId: true },
    });

    const processedUserIds = userActions.map((action) => action.receiverId);

    // Also exclude users we've matched with
    const userMatches = await prisma.match.findMany({
      where: {
        OR: [
          { user1Id: currentUserId },
          { user2Id: currentUserId },
        ],
        isActive: true,
      },
      select: {
        user1Id: true,
        user2Id: true,
      },
    });

    // Extract matched user IDs (the other person in each match)
    const matchedUserIds = userMatches.map(match => 
      match.user1Id === currentUserId ? match.user2Id : match.user1Id
    );

    // Combine with explicitly excluded IDs (including matched users)
    const allExcludedIds = [
      ...new Set([...processedUserIds, ...matchedUserIds, ...excludeIds, currentUserId]),
    ];

    logger.debug(
      `User ${currentUserId} has acted on ${processedUserIds.length} users, matched with ${matchedUserIds.length} users`
    );
    logger.debug(`Total excluded IDs: ${allExcludedIds.length}`);

    // Get current user's preferences for filtering
    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: {
        interestedIn: true,
        latitude: true,
        longitude: true,
        birthDate: true,
        isPremium: true,
        gender: true,
        interests: {
          include: {
            interest: true,
          },
        },
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
      // Also filter by those interested in current user's gender
      interestedIn: { hasSome: [currentUser.gender] },
    };

    // Apply age filter
    if (defaultFilters.ageRange) {
      const { min, max } = defaultFilters.ageRange;
      const maxDate = new Date();
      maxDate.setFullYear(maxDate.getFullYear() - min);
      const minDate = new Date();
      minDate.setFullYear(minDate.getFullYear() - max);

      whereClause.birthDate = {
        gte: minDate,
        lte: maxDate,
      };
    }

    // For distance filtering, we need location data
    if (defaultFilters.maxDistance && currentUser.latitude && currentUser.longitude) {
      whereClause.latitude = { not: null };
      whereClause.longitude = { not: null };
    }

    // Get potential users
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
      take: Math.min(limit * 3, 1000), // Get more initially to filter by distance (max 1000)
      orderBy: [
        // Premium users boost (if current user is also premium)
        ...(currentUser.isPremium ? [{ isPremium: 'desc' }] : []),
        { lastActive: 'desc' }, // Recently active users first
        { createdAt: 'desc' },  // Then newer users
      ],
    });

    // Calculate distance and age for each user
    let processedUsers = users
      .filter((user) => user.photos && user.photos.length > 0) // Only users with photos
      .map((user) => {
        const age = calculateAge(user.birthDate);
        
        // Calculate distance if both users have location
        let distance = null;
        if (
          currentUser.latitude && 
          currentUser.longitude && 
          user.latitude && 
          user.longitude
        ) {
          distance = calculateDistance(
            currentUser.latitude,
            currentUser.longitude,
            user.latitude,
            user.longitude
          );
        }

        // Calculate compatibility score based on shared interests
        const sharedInterests = calculateSharedInterests(
          currentUser.interests || [],
          user.interests || []
        );

        // Remove sensitive data
        // eslint-disable-next-line no-unused-vars
        const { password, email, ...userWithoutSensitive } = user;

        return {
          ...userWithoutSensitive,
          age,
          distance: distance ? Math.round(distance) : null,
          sharedInterestsCount: sharedInterests,
          interests: user.interests.map(ui => ui.interest.name),
          // Convert relationshipType string back to array if needed
          relationshipType: user.relationshipType 
            ? (user.relationshipType.includes(',') 
              ? user.relationshipType.split(',').map(s => s.trim())
              : [user.relationshipType])
            : [],
        };
      });

    // Apply distance filter if specified
    if (defaultFilters.maxDistance && currentUser.latitude && currentUser.longitude) {
      processedUsers = processedUsers.filter(user => {
        return !user.distance || user.distance <= defaultFilters.maxDistance;
      });
    }

    // Sort by relevance (distance, shared interests, etc.)
    processedUsers.sort((a, b) => {
      // Priority 1: Users with photos come first
      if (!a.photos?.length && b.photos?.length) {return 1;}
      if (a.photos?.length && !b.photos?.length) {return -1;}

      // Priority 2: Closer users (if distance available)
      if (a.distance !== null && b.distance !== null) {
        if (a.distance < b.distance) {return -1;}
        if (a.distance > b.distance) {return 1;}
      }

      // Priority 3: More shared interests
      if (a.sharedInterestsCount !== b.sharedInterestsCount) {
        return b.sharedInterestsCount - a.sharedInterestsCount;
      }

      // Priority 4: Recently active
      return new Date(b.lastActive) - new Date(a.lastActive);
    });

    // Limit to requested number
    const finalUsers = processedUsers.slice(0, limit);

    logger.info(
      `Found ${finalUsers.length} users for discovery for user ${currentUserId}`,
      {
        ageRange: defaultFilters.ageRange,
        maxDistance: defaultFilters.maxDistance,
        totalFiltered: processedUsers.length,
      }
    );
    
    return finalUsers;
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

/**
 * Get user's gender for matching
 */
const getUserGender = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { gender: true },
  });
  
  return user ? [user.gender] : [];
};

/**
 * Calculate number of shared interests between users
 */
const calculateSharedInterests = (currentUserInterests, otherUserInterests) => {
  if (!currentUserInterests.length || !otherUserInterests.length) {
    return 0;
  }
  
  const currentInterestIds = new Set(
    currentUserInterests.map(ui => ui.interestId || ui.interest?.id)
  );
  
  const sharedCount = otherUserInterests.filter(ui => 
    currentInterestIds.has(ui.interestId || ui.interest?.id)
  ).length;
  
  return sharedCount;
};

module.exports = {
  getUsersForDiscovery,
};
