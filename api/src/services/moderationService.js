const logger = require('../utils/logger');
const { getPrismaClient } = require('../config/database');

const prisma = getPrismaClient();

/**
 * Mute notifications for a match
 * @param {string} userId - The user who is muting
 * @param {string} matchId - The match to mute
 */
const muteMatch = async (userId, matchId) => {
  // Verify user is part of this match
  const match = await prisma.match.findFirst({
    where: {
      id: matchId,
      OR: [{ user1Id: userId }, { user2Id: userId }],
      isActive: true,
    },
  });

  if (!match) {
    throw new Error('Match not found or you are not part of this match');
  }

  // Create muted match record
  const muted = await prisma.mutedMatch.upsert({
    where: {
      userId_matchId: { userId, matchId },
    },
    update: {},
    create: {
      userId,
      matchId,
    },
  });

  logger.info(`User ${userId} muted match ${matchId}`);
  return { matchId, mutedAt: muted.createdAt };
};

/**
 * Unmute notifications for a match
 * @param {string} userId - The user who is unmuting
 * @param {string} matchId - The match to unmute
 */
const unmuteMatch = async (userId, matchId) => {
  await prisma.mutedMatch.deleteMany({
    where: { userId, matchId },
  });

  logger.info(`User ${userId} unmuted match ${matchId}`);
  return { matchId };
};

/**
 * Check if a match is muted by a user
 * @param {string} userId - The user to check
 * @param {string} matchId - The match to check
 */
const isMatchMuted = async (userId, matchId) => {
  const muted = await prisma.mutedMatch.findUnique({
    where: {
      userId_matchId: { userId, matchId },
    },
  });

  return !!muted;
};

/**
 * Block a user
 * @param {string} blockerId - The user who is blocking
 * @param {string} blockedId - The user being blocked
 * @param {string} _matchId - Optional match ID for context (unused, all matches are deactivated)
 */
const blockUser = async (blockerId, blockedId, _matchId = null, io = null) => {
  if (blockerId === blockedId) {
    throw new Error('Cannot block yourself');
  }

  // Use transaction for atomicity
  const result = await prisma.$transaction(async (tx) => {
    // Create blocked user record
    const blocked = await tx.blockedUser.upsert({
      where: {
        blockerId_blockedId: { blockerId, blockedId },
      },
      update: {},
      create: {
        blockerId,
        blockedId,
      },
    });

    // Deactivate any matches between these users. Their IDs are collected
    // first so live socket rooms can be revoked after commit.
    const pairMatches = await tx.match.findMany({
      where: {
        OR: [
          { user1Id: blockerId, user2Id: blockedId },
          { user1Id: blockedId, user2Id: blockerId },
        ],
        isActive: true,
      },
      select: { id: true },
    });
    await tx.match.updateMany({
      where: { id: { in: pairMatches.map((m) => m.id) } },
      data: {
        isActive: false,
        unmatchedBy: blockerId,
        unmatchedAt: new Date(),
      },
    });

    // Action history between the pair is deliberately KEPT: discovery
    // excludes already-acted-on users, so deleting these rows used to make
    // blocked users reappear in each other's decks. Block enforcement itself
    // lives in the BlockedUser table checks (isUserBlocked/getBlockedUserIds).

    return { blocked, deactivatedMatchIds: pairMatches.map((m) => m.id) };
  });

  for (const matchId of result.deactivatedMatchIds) {
    io?.evictMatchRoom?.(matchId);
  }

  logger.info(`User ${blockerId} blocked user ${blockedId}`);
  return { blockedId, blockedAt: result.blocked.createdAt };
};

/**
 * Unblock a user
 * @param {string} blockerId - The user who is unblocking
 * @param {string} blockedId - The user being unblocked
 */
const unblockUser = async (blockerId, blockedId) => {
  await prisma.blockedUser.deleteMany({
    where: { blockerId, blockedId },
  });

  logger.info(`User ${blockerId} unblocked user ${blockedId}`);
  return { blockedId };
};

/**
 * Get list of blocked users for a user
 * @param {string} userId - The user to get blocked list for
 */
const getBlockedUsers = async (userId) => {
  const blocked = await prisma.blockedUser.findMany({
    where: { blockerId: userId },
    include: {
      blocked: {
        select: {
          id: true,
          name: true,
          mainPhotoUrl: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return blocked.map(b => ({
    id: b.blocked.id,
    name: b.blocked.name,
    photoUrl: b.blocked.mainPhotoUrl,
    blockedAt: b.createdAt,
  }));
};

/**
 * Check if a user is blocked (either direction)
 * @param {string} userId1 - First user
 * @param {string} userId2 - Second user
 */
const isUserBlocked = async (userId1, userId2) => {
  const blocked = await prisma.blockedUser.findFirst({
    where: {
      OR: [
        { blockerId: userId1, blockedId: userId2 },
        { blockerId: userId2, blockedId: userId1 },
      ],
    },
  });

  return !!blocked;
};

/**
 * Unmatch - soft delete a match
 * @param {string} userId - The user who is unmatching
 * @param {string} matchId - The match to remove
 */
const unmatch = async (userId, matchId, io = null) => {
  // Verify user is part of this match
  const match = await prisma.match.findFirst({
    where: {
      id: matchId,
      OR: [{ user1Id: userId }, { user2Id: userId }],
      isActive: true,
    },
  });

  if (!match) {
    throw new Error('Match not found or you are not part of this match');
  }

  // Soft delete the match
  await prisma.match.update({
    where: { id: matchId },
    data: {
      isActive: false,
      unmatchedBy: userId,
      unmatchedAt: new Date(),
    },
  });

  io?.evictMatchRoom?.(matchId);

  logger.info(`User ${userId} unmatched from match ${matchId}`);
  return { matchId };
};

/**
 * Report a user
 * @param {string} reporterId - The user filing the report
 * @param {string} reportedId - The user being reported
 * @param {string} reason - The reason for the report (enum value)
 * @param {string} description - Optional description
 */
const reportUser = async (reporterId, reportedId, reason, description = null) => {
  if (reporterId === reportedId) {
    throw new Error('Cannot report yourself');
  }

  const report = await prisma.report.create({
    data: {
      reporterId,
      reportedId,
      reason,
      description,
      status: 'PENDING',
    },
  });

  logger.info(`User ${reporterId} reported user ${reportedId} for ${reason}`);
  return { reportId: report.id };
};

/**
 * Get IDs of users who have blocked a user or whom the user has blocked
 * @param {string} userId - The user to check blocks for
 */
const getBlockedUserIds = async (userId) => {
  const blocks = await prisma.blockedUser.findMany({
    where: {
      OR: [{ blockerId: userId }, { blockedId: userId }],
    },
    select: {
      blockerId: true,
      blockedId: true,
    },
  });

  const blockedIds = new Set();
  blocks.forEach(block => {
    if (block.blockerId !== userId) {blockedIds.add(block.blockerId);}
    if (block.blockedId !== userId) {blockedIds.add(block.blockedId);}
  });

  return Array.from(blockedIds);
};

module.exports = {
  muteMatch,
  unmuteMatch,
  isMatchMuted,
  blockUser,
  unblockUser,
  getBlockedUsers,
  isUserBlocked,
  unmatch,
  reportUser,
  getBlockedUserIds,
};
