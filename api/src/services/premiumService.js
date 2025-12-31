/**
 * Premium features service
 * Handles premium gating and daily quota management
 */

const { getPrismaClient } = require('../config/database');

const prisma = getPrismaClient();

// Premium limits configuration
const LIMITS = {
  FREE: {
    dailyLikes: 10,
    dailySuperLikes: 0,
    canUndo: false,
    whoLikedMeLimit: 3, // Can only see 3 people who liked them
  },
  PREMIUM: {
    dailyLikes: Infinity,
    dailySuperLikes: 5,
    canUndo: true,
    whoLikedMeLimit: Infinity, // Unlimited
  },
};

/**
 * Check if daily quotas need to be reset (resets at midnight UTC)
 */
const shouldResetQuotas = (resetAt) => {
  if (!resetAt) {
    return true;
  }

  const now = new Date();
  const resetDate = new Date(resetAt);

  // Check if we're on a different UTC day
  return now.toISOString().slice(0, 10) !== resetDate.toISOString().slice(0, 10);
};

/**
 * Get user's current quota status and reset if needed
 */
const getUserQuotas = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isPremium: true,
      dailyLikesUsed: true,
      dailyLikesResetAt: true,
      dailySuperLikesUsed: true,
      dailySuperLikesResetAt: true,
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const limits = user.isPremium ? LIMITS.PREMIUM : LIMITS.FREE;
  let likesUsed = user.dailyLikesUsed;
  let superLikesUsed = user.dailySuperLikesUsed;

  // Reset quotas if needed
  const needsLikesReset = shouldResetQuotas(user.dailyLikesResetAt);
  const needsSuperLikesReset = shouldResetQuotas(user.dailySuperLikesResetAt);

  if (needsLikesReset || needsSuperLikesReset) {
    const updateData = {};

    if (needsLikesReset) {
      updateData.dailyLikesUsed = 0;
      updateData.dailyLikesResetAt = new Date();
      likesUsed = 0;
    }

    if (needsSuperLikesReset) {
      updateData.dailySuperLikesUsed = 0;
      updateData.dailySuperLikesResetAt = new Date();
      superLikesUsed = 0;
    }

    await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });
  }

  return {
    isPremium: user.isPremium,
    likes: {
      used: likesUsed,
      limit: limits.dailyLikes,
      remaining: limits.dailyLikes === Infinity ? Infinity : Math.max(0, limits.dailyLikes - likesUsed),
    },
    superLikes: {
      used: superLikesUsed,
      limit: limits.dailySuperLikes,
      remaining: Math.max(0, limits.dailySuperLikes - superLikesUsed),
    },
    canUndo: limits.canUndo,
    whoLikedMeLimit: limits.whoLikedMeLimit,
  };
};

/**
 * Check if user can perform a like action
 */
const canLike = async (userId) => {
  const quotas = await getUserQuotas(userId);

  if (quotas.isPremium) {
    return { allowed: true, quotas };
  }

  if (quotas.likes.remaining <= 0) {
    return {
      allowed: false,
      error: 'DAILY_LIMIT_REACHED',
      message: 'You\'ve used all your daily likes. Upgrade to Premium for unlimited likes!',
      quotas,
    };
  }

  return { allowed: true, quotas };
};

/**
 * Check if user can perform a super like action
 */
const canSuperLike = async (userId) => {
  const quotas = await getUserQuotas(userId);

  if (!quotas.isPremium) {
    return {
      allowed: false,
      error: 'PREMIUM_REQUIRED',
      message: 'Super Likes are a Premium feature. Upgrade to send Super Likes!',
      quotas,
    };
  }

  if (quotas.superLikes.remaining <= 0) {
    return {
      allowed: false,
      error: 'DAILY_LIMIT_REACHED',
      message: 'You\'ve used all your Super Likes for today. They reset at midnight UTC.',
      quotas,
    };
  }

  return { allowed: true, quotas };
};

/**
 * Check if user can undo their last action
 */
const canUndo = async (userId) => {
  const quotas = await getUserQuotas(userId);

  if (!quotas.canUndo) {
    return {
      allowed: false,
      error: 'PREMIUM_REQUIRED',
      message: 'Undo is a Premium feature. Upgrade to undo your actions!',
      quotas,
    };
  }

  return { allowed: true, quotas };
};

/**
 * Increment like count after successful like
 */
const incrementLikeCount = async (userId) => {
  await prisma.user.update({
    where: { id: userId },
    data: {
      dailyLikesUsed: { increment: 1 },
    },
  });
};

/**
 * Increment super like count after successful super like
 */
const incrementSuperLikeCount = async (userId) => {
  await prisma.user.update({
    where: { id: userId },
    data: {
      dailySuperLikesUsed: { increment: 1 },
    },
  });
};

/**
 * Get the limit for "who liked me" feature
 */
const getWhoLikedMeLimit = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isPremium: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const limits = user.isPremium ? LIMITS.PREMIUM : LIMITS.FREE;
  return {
    isPremium: user.isPremium,
    limit: limits.whoLikedMeLimit,
  };
};

/**
 * Check if a feature requires premium
 */
const requiresPremium = async (userId, feature) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isPremium: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  if (user.isPremium) {
    return { allowed: true };
  }

  const premiumFeatures = ['super_like', 'undo', 'unlimited_likes', 'see_all_likes', 'advanced_filters'];

  if (premiumFeatures.includes(feature)) {
    return {
      allowed: false,
      error: 'PREMIUM_REQUIRED',
      message: `This feature requires a Premium subscription.`,
      feature,
    };
  }

  return { allowed: true };
};

module.exports = {
  LIMITS,
  getUserQuotas,
  canLike,
  canSuperLike,
  canUndo,
  incrementLikeCount,
  incrementSuperLikeCount,
  getWhoLikedMeLimit,
  requiresPremium,
};
