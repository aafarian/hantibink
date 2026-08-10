/**
 * Premium features service
 * Handles premium gating and daily quota management
 */

const { getPrismaClient } = require('../config/database');

const prisma = getPrismaClient();

// Premium limits configuration
const LIMITS = {
  FREE: {
    // Likes arrive as a conveyor: a fresh batch every half day (00:00 and
    // 12:00 UTC), use-it-or-lose-it — no banking
    dailyLikes: 5,
    superLikeAccrualPerDay: 0,
    superLikeBankCap: 0,
    canUndo: false,
    // Free users get the teaser count only — liker entries are premium
    whoLikedMeLimit: 0,
  },
  PREMIUM: {
    dailyLikes: Infinity,
    // Super Likes accrue daily into a bank so they can be saved up
    superLikeAccrualPerDay: 2,
    superLikeBankCap: 5,
    canUndo: true,
    whoLikedMeLimit: Infinity, // Unlimited
  },
};

/** Start of the current likes window (half-day boundaries at UTC 00/12). */
const likesWindowStart = (now = new Date()) => {
  const start = new Date(now);
  start.setUTCHours(start.getUTCHours() >= 12 ? 12 : 0, 0, 0, 0);
  return start;
};

/** When the next batch of likes arrives. */
const nextLikesRefillAt = (now = new Date()) => {
  const next = likesWindowStart(now);
  next.setUTCHours(next.getUTCHours() + 12);
  return next;
};

const shouldResetLikes = (resetAt) => !resetAt || new Date(resetAt) < likesWindowStart();

/** Whole UTC days elapsed since a date (for Super Like accrual). */
const utcDaysSince = (from, to = new Date()) =>
  Math.floor(new Date(to).getTime() / 86400000) - Math.floor(new Date(from).getTime() / 86400000);

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
      superLikeBalance: true,
      superLikeAccruedAt: true,
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const limits = user.isPremium ? LIMITS.PREMIUM : LIMITS.FREE;
  let likesUsed = user.dailyLikesUsed;
  let superLikeBalance = user.superLikeBalance;

  // Reset the likes window when a half-day boundary has passed. The WHERE
  // clause on the old timestamp makes concurrent resets race-safe: only one
  // request wins.
  if (shouldResetLikes(user.dailyLikesResetAt)) {
    const result = await prisma.user.updateMany({
      where: {
        id: userId,
        dailyLikesResetAt: user.dailyLikesResetAt, // Only update if timestamp hasn't changed
      },
      data: {
        dailyLikesUsed: 0,
        dailyLikesResetAt: new Date(),
      },
    });
    if (result.count > 0) {
      likesUsed = 0;
    }
  }

  // Super Likes accrue daily into a bank (premium only). accruedAt always
  // advances even when the bank is full, so idle days never pile up into an
  // instant refill after a spend. Using increment (not an absolute write)
  // means a concurrent spend can't be resurrected by a stale read here.
  if (user.isPremium && limits.superLikeAccrualPerDay > 0) {
    const days = utcDaysSince(user.superLikeAccruedAt);
    if (days >= 1) {
      const grant = Math.max(
        0,
        Math.min(limits.superLikeBankCap - superLikeBalance, days * limits.superLikeAccrualPerDay),
      );
      const result = await prisma.user.updateMany({
        where: { id: userId, superLikeAccruedAt: user.superLikeAccruedAt },
        data: {
          superLikeBalance: { increment: grant },
          superLikeAccruedAt: new Date(),
        },
      });
      if (result.count > 0) {
        superLikeBalance += grant;
      }
    }
  }

  return {
    isPremium: user.isPremium,
    likes: {
      used: likesUsed,
      limit: limits.dailyLikes,
      remaining: limits.dailyLikes === Infinity ? Infinity : Math.max(0, limits.dailyLikes - likesUsed),
      refillAt: limits.dailyLikes === Infinity ? null : nextLikesRefillAt(),
    },
    superLikes: {
      remaining: user.isPremium ? superLikeBalance : 0,
      limit: limits.superLikeBankCap,
      accrualPerDay: limits.superLikeAccrualPerDay,
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
      message: 'You\'re out of likes for now. A fresh batch of 5 arrives soon, or go unlimited with Premium!',
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
      message: 'You\'re out of Super Likes. You bank 2 more each day, up to 5.',
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
  getWhoLikedMeLimit,
  requiresPremium,
};
