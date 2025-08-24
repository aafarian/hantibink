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
 * Calculate preference match score for a user
 * Higher score = better match
 */
const calculateMatchScore = (currentUser, otherUser, filters = {}) => {
  let score = 0;
  const scoreBreakdown = {};
  
  // 1. MUTUAL INTEREST (most important - 100 points)
  // Both users are interested in each other's gender
  // Handle EVERYONE preference (interested in all genders)
  const currentUserInterested = currentUser.interestedIn.includes('EVERYONE') || 
    currentUser.interestedIn.includes(otherUser.gender);
  const otherUserInterested = otherUser.interestedIn.includes('EVERYONE') || 
    otherUser.interestedIn.includes(currentUser.gender);
  const mutualInterest = currentUserInterested && otherUserInterested;
  
  if (mutualInterest) {
    score += 100;
    scoreBreakdown.mutualInterest = 100;
  } else {
    scoreBreakdown.mutualInterest = 0;
  }
  
  // 2. AGE PREFERENCE (50 points max)
  const currentAge = calculateAge(currentUser.birthDate);
  const otherAge = calculateAge(otherUser.birthDate);
  
  if (filters.ageRange && currentAge && otherAge) {
    const { min, max } = filters.ageRange;
    if (otherAge >= min && otherAge <= max) {
      score += 50;
      scoreBreakdown.ageMatch = 50;
    } else {
      // Partial score based on how close they are to range
      const distance = otherAge < min ? min - otherAge : otherAge - max;
      const partialScore = Math.max(0, 50 - (distance * 5));
      score += partialScore;
      scoreBreakdown.ageMatch = partialScore;
    }
  }
  
  // 3. DISTANCE (40 points max)
  if (currentUser.latitude && currentUser.longitude && 
      otherUser.latitude && otherUser.longitude) {
    const distance = calculateDistance(
      currentUser.latitude,
      currentUser.longitude,
      otherUser.latitude,
      otherUser.longitude
    );
    
    if (filters.maxDistance) {
      if (distance <= filters.maxDistance) {
        // Full points if within preferred distance
        const distanceScore = 40 * (1 - (distance / filters.maxDistance));
        score += distanceScore;
        scoreBreakdown.distance = distanceScore;
      } else {
        // Partial points if outside preferred distance
        const distanceScore = Math.max(0, 40 - ((distance - filters.maxDistance) / 10));
        score += distanceScore;
        scoreBreakdown.distance = distanceScore;
      }
    }
  }
  
  // 4. SHARED INTERESTS (30 points max)
  const sharedInterests = calculateSharedInterests(
    currentUser.interests || [],
    otherUser.interests || []
  );
  if (sharedInterests > 0) {
    const interestScore = Math.min(30, sharedInterests * 10);
    score += interestScore;
    scoreBreakdown.interests = interestScore;
  }
  
  // 5. RELATIONSHIP TYPE MATCH (20 points)
  if (currentUser.relationshipType && otherUser.relationshipType) {
    const currentTypes = Array.isArray(currentUser.relationshipType) 
      ? currentUser.relationshipType 
      : currentUser.relationshipType.split(',').map(s => s.trim());
    const otherTypes = Array.isArray(otherUser.relationshipType)
      ? otherUser.relationshipType
      : otherUser.relationshipType.split(',').map(s => s.trim());
    
    const hasMatch = currentTypes.some(type => otherTypes.includes(type));
    if (hasMatch) {
      score += 20;
      scoreBreakdown.relationshipType = 20;
    }
  }
  
  // 6. ACTIVITY LEVEL (10 points)
  const daysSinceActive = Math.floor(
    (new Date() - new Date(otherUser.lastActive)) / (1000 * 60 * 60 * 24)
  );
  if (daysSinceActive <= 7) {
    score += 10;
    scoreBreakdown.activity = 10;
  } else if (daysSinceActive <= 30) {
    score += 5;
    scoreBreakdown.activity = 5;
  }
  
  // 7. PROFILE COMPLETENESS (10 points)
  let completeness = 0;
  if (otherUser.bio) {completeness++;}
  if (otherUser.education) {completeness++;}
  if (otherUser.profession) {completeness++;}
  if (otherUser.height) {completeness++;}
  if (otherUser.photos?.length >= 3) {completeness++;}
  const completenessScore = completeness * 2;
  score += completenessScore;
  scoreBreakdown.completeness = completenessScore;
  
  // 8. PREMIUM BOOST (5 points if both are premium)
  if (currentUser.isPremium && otherUser.isPremium) {
    score += 5;
    scoreBreakdown.premium = 5;
  }
  
  return { score, breakdown: scoreBreakdown };
};

/**
 * Get users for discovery/swiping with flexible matching
 */
const getUsersForDiscovery = async (currentUserId, options = {}) => {
  try {
    const { 
      limit = 20, 
      excludeIds = [], 
      filters = {},
      strictMode = false // If true, only show perfect matches
    } = options;

    // Default filter values
    const defaultFilters = {
      ageRange: { min: 18, max: 100 },
      maxDistance: 100, // km
      onlyWithPhotos: true,
      strictAge: false,
      strictDistance: false,
      relationshipType: [],
      strictRelationshipType: false,
      education: [],
      strictEducation: false,
      smoking: [],
      strictSmoking: false,
      drinking: [],
      strictDrinking: false,
      languages: [],
      strictLanguages: false,
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

    // Extract matched user IDs
    const matchedUserIds = userMatches.map(match => 
      match.user1Id === currentUserId ? match.user2Id : match.user1Id
    );

    // Combine with explicitly excluded IDs
    const allExcludedIds = [
      ...new Set([...processedUserIds, ...matchedUserIds, ...excludeIds, currentUserId]),
    ];

    logger.debug(
      `User ${currentUserId} discovery: excluded ${allExcludedIds.length} users (${processedUserIds.length} acted on, ${matchedUserIds.length} matched)`
    );

    // Get current user's full profile
    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: {
        interestedIn: true,
        latitude: true,
        longitude: true,
        birthDate: true,
        isPremium: true,
        gender: true,
        relationshipType: true,
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

    // Build base where clause - get ALL active users except excluded
    const baseWhereClause = {
      id: { notIn: allExcludedIds },
      isActive: true,
    };

    // In strict mode, only get users matching preferences
    if (strictMode) {
      // If user is interested in EVERYONE, don't filter by gender
      if (!currentUser.interestedIn.includes('EVERYONE')) {
        baseWhereClause.gender = { in: currentUser.interestedIn };
      }
      // Check if other users would be interested in current user
      baseWhereClause.OR = [
        { interestedIn: { hasSome: [currentUser.gender] } },
        { interestedIn: { hasSome: ['EVERYONE'] } }
      ];
    }

    // Only include users with photos if filter is set
    if (defaultFilters.onlyWithPhotos) {
      baseWhereClause.photos = {
        some: {},
      };
    }

    // Get ALL potential users (we'll filter and sort later)
    const users = await prisma.user.findMany({
      where: baseWhereClause,
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
      take: 500, // Get more initially to have enough for filtering
    });

    // Calculate match scores for all users
    const scoredUsers = users.map((user) => {
      const age = calculateAge(user.birthDate);
      
      // Calculate distance
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

      // Calculate match score
      const { score, breakdown } = calculateMatchScore(
        currentUser, 
        user, 
        defaultFilters
      );

      // Remove sensitive data
      // eslint-disable-next-line no-unused-vars
      const { password, email, ...userWithoutSensitive } = user;

      return {
        ...userWithoutSensitive,
        age,
        distance: distance ? Math.round(distance) : null,
        matchScore: score,
        scoreBreakdown: breakdown,
        sharedInterestsCount: calculateSharedInterests(
          currentUser.interests || [],
          user.interests || []
        ),
        interests: user.interests.map(ui => ui.interest.name),
        // Convert relationshipType string to array
        relationshipType: user.relationshipType 
          ? (user.relationshipType.includes(',') 
            ? user.relationshipType.split(',').map(s => s.trim())
            : [user.relationshipType])
          : [],
        // Flag if this user matches preferences (handle EVERYONE)
        matchesPreferences: 
          (currentUser.interestedIn.includes('EVERYONE') || 
           currentUser.interestedIn.includes(user.gender)) &&
          (user.interestedIn.includes('EVERYONE') || 
           user.interestedIn.includes(currentUser.gender)),
      };
    });

    // Sort by match score (highest first)
    scoredUsers.sort((a, b) => {
      // First priority: Users who match preferences
      if (a.matchesPreferences && !b.matchesPreferences) {return -1;}
      if (!a.matchesPreferences && b.matchesPreferences) {return 1;}
      
      // Second priority: Match score
      if (a.matchScore !== b.matchScore) {
        return b.matchScore - a.matchScore;
      }
      
      // Third priority: Recently active
      return new Date(b.lastActive) - new Date(a.lastActive);
    });

    // Apply filters based on strict preferences
    let filteredUsers = scoredUsers;
    
    // Check if any strict filters are enabled
    const hasStrictFilters = defaultFilters.strictAge || defaultFilters.strictDistance || 
                            defaultFilters.strictRelationshipType || defaultFilters.strictEducation ||
                            defaultFilters.strictSmoking || defaultFilters.strictDrinking || 
                            defaultFilters.strictLanguages;
    
    if (hasStrictFilters) {
      const preferenceMatches = [];
      const nonPreferenceMatches = [];
      
      for (const user of scoredUsers) {
        let passesFilters = true;
        
        // Strict age filter
        if (defaultFilters.strictAge && defaultFilters.ageRange && user.age) {
          const { min, max } = defaultFilters.ageRange;
          if (user.age < min || user.age > max) {
            passesFilters = false;
          }
        }
        
        // Strict distance filter
        if (defaultFilters.strictDistance && defaultFilters.maxDistance && user.distance) {
          if (user.distance > defaultFilters.maxDistance) {
            passesFilters = false;
          }
        }
        
        // Strict relationship type filter
        if (defaultFilters.strictRelationshipType && defaultFilters.relationshipType.length > 0) {
          const userTypes = Array.isArray(user.relationshipType) 
            ? user.relationshipType 
            : (user.relationshipType ? [user.relationshipType] : []);
          const hasMatch = userTypes.some(type => defaultFilters.relationshipType.includes(type));
          if (!hasMatch && userTypes.length > 0) {
            passesFilters = false;
          }
        }
        
        // Strict education filter
        if (defaultFilters.strictEducation && defaultFilters.education.length > 0) {
          if (!defaultFilters.education.includes("Doesn't matter") && 
              user.education && !defaultFilters.education.includes(user.education)) {
            passesFilters = false;
          }
        }
        
        // Strict smoking filter
        if (defaultFilters.strictSmoking && defaultFilters.smoking.length > 0) {
          if (!defaultFilters.smoking.includes("Doesn't matter") && 
              user.smoking && !defaultFilters.smoking.includes(user.smoking)) {
            passesFilters = false;
          }
        }
        
        // Strict drinking filter
        if (defaultFilters.strictDrinking && defaultFilters.drinking.length > 0) {
          if (!defaultFilters.drinking.includes("Doesn't matter") && 
              user.drinking && !defaultFilters.drinking.includes(user.drinking)) {
            passesFilters = false;
          }
        }
        
        // Strict languages filter
        if (defaultFilters.strictLanguages && defaultFilters.languages.length > 0) {
          const userLanguages = user.languages || [];
          const hasLanguageMatch = userLanguages.some(lang => defaultFilters.languages.includes(lang));
          if (!hasLanguageMatch && userLanguages.length > 0) {
            passesFilters = false;
          }
        }
        
        if (passesFilters) {
          if (user.matchesPreferences) {
            preferenceMatches.push(user);
          } else {
            nonPreferenceMatches.push(user);
          }
        }
      }
      
      // Combine: preference matches first, then non-preference matches
      filteredUsers = [...preferenceMatches, ...nonPreferenceMatches];
    }

    // Limit to requested number
    const finalUsers = filteredUsers.slice(0, limit);

    logger.info(
      `Discovery for user ${currentUserId}: ${finalUsers.length} users found`,
      {
        filters: defaultFilters,
        totalUsers: users.length,
        afterFiltering: filteredUsers.length,
        preferenceMatches: finalUsers.filter(u => u.matchesPreferences).length,
        returned: finalUsers.length,
      }
    );
    
    return finalUsers;
  } catch (error) {
    logger.error('❌ Error getting users for discovery:', error);
    throw error;
  }
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