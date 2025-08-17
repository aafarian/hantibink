const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

/**
 * Get user matches
 */
const getUserMatches = async (userId, options = {}) => {
  try {
    const { limit = 50, offset = 0 } = options;

    const matches = await prisma.match.findMany({
      where: {
        OR: [{ user1Id: userId }, { user2Id: userId }],
        isActive: true,
      },
      include: {
        user1: {
          select: {
            id: true,
            name: true,
            bio: true,
            birthDate: true,
            location: true,
            photos: {
              select: { url: true, isMain: true },
              orderBy: { isMain: 'desc' }, // Main photos first
            },
          },
        },
        user2: {
          select: {
            id: true,
            name: true,
            bio: true,
            birthDate: true,
            location: true,
            photos: {
              select: { url: true, isMain: true },
              orderBy: { isMain: 'desc' }, // Main photos first
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            content: true,
            createdAt: true,
            senderId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    // Transform matches to include other user info and last message
    const transformedMatches = matches.map((match) => {
      const otherUser = match.user1Id === userId ? match.user2 : match.user1;
      const lastMessage = match.messages[0] || null;

      // Calculate age
      const age = calculateAge(otherUser.birthDate);

      return {
        id: match.id,
        matchedAt: match.createdAt,
        otherUser: {
          id: otherUser.id,
          name: otherUser.name,
          bio: otherUser.bio,
          location: otherUser.location,
          age,
          photos: otherUser.photos || [],
        },
        lastMessage: lastMessage
          ? {
              content: lastMessage.content,
              timestamp: lastMessage.createdAt,
              senderId: lastMessage.senderId,
              isFromMe: lastMessage.senderId === userId,
            }
          : null,
        // Add unread count (simplified for now)
        unreadCount: 0, // TODO: Implement proper unread count
      };
    });

    logger.info(
      `Retrieved ${transformedMatches.length} matches for user ${userId}`,
    );
    return transformedMatches;
  } catch (error) {
    logger.error('❌ Error getting user matches:', error);
    throw error;
  }
};

/**
 * Get detailed match information
 */
const getMatchDetails = async (matchId, currentUserId) => {
  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        user1: {
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
        },
        user2: {
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
        },
      },
    });

    if (!match) {
      throw new Error('Match not found');
    }

    // Verify user has access to this match
    if (match.user1Id !== currentUserId && match.user2Id !== currentUserId) {
      throw new Error('Unauthorized access to match');
    }

    if (!match.isActive) {
      throw new Error('Match is no longer active');
    }

    // Get the other user's info
    const otherUser =
      match.user1Id === currentUserId ? match.user2 : match.user1;

    // Calculate age
    const age = calculateAge(otherUser.birthDate);

    // Clean up sensitive data
    const { ...otherUserClean } = otherUser;

    const matchDetails = {
      id: match.id,
      matchedAt: match.createdAt,
      otherUser: {
        ...otherUserClean,
        age,
      },
    };

    logger.info(`Retrieved match details for match ${matchId}`);
    return matchDetails;
  } catch (error) {
    logger.error('❌ Error getting match details:', error);
    throw error;
  }
};

/**
 * Deactivate a match (unmatch)
 */
const deactivateMatch = async (matchId, userId) => {
  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      throw new Error('Match not found');
    }

    // Verify user has access to this match
    if (match.user1Id !== userId && match.user2Id !== userId) {
      throw new Error('Unauthorized access to match');
    }

    // Deactivate the match
    const updatedMatch = await prisma.match.update({
      where: { id: matchId },
      data: { isActive: false },
    });

    logger.info(`Match ${matchId} deactivated by user ${userId}`);

    return {
      success: true,
      match: updatedMatch,
    };
  } catch (error) {
    logger.error('❌ Error deactivating match:', error);
    throw error;
  }
};

/**
 * Calculate age from birth date
 */
const calculateAge = (birthDate) => {
  if (!birthDate) {return null;}

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
  getUserMatches,
  getMatchDetails,
  deactivateMatch,
};
