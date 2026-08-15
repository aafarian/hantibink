/**
 * Premium features service
 * Handles premium gating and daily quota management
 */

const { getPrismaClient } = require('../config/database');
const logger = require('../utils/logger');

const prisma = getPrismaClient();

// Premium limits configuration
const LIMITS = {
  FREE: {
    // Likes arrive as a conveyor: a fresh batch every half day (00:00 and
    // 12:00 UTC), use-it-or-lose-it — no banking. 25/window (50/day) is the
    // launch-liquidity setting; tune live via the AppConfig `quotas` key.
    dailyLikes: 25,
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

/**
 * Effective premium: a paid flag OR an active launch-promo trial.
 * Callers must select both `isPremium` and `trialEndsAt`.
 */
const hasPremiumAccess = (user) =>
  !!user?.isPremium || (!!user?.trialEndsAt && new Date(user.trialEndsAt) > new Date());

/**
 * Free-tier quota overrides, tunable from the admin panel without a deploy
 * (AppConfig key `quotas`, e.g. { "freeLikesPerWindow": 25 }). Cached
 * in-process for 60s; code defaults serve when unset or on read failure.
 */
const QUOTA_CACHE_TTL_MS = 60 * 1000;
let quotaCache = { value: null, fetchedAt: 0 };

const getFreeLikesPerWindow = async () => {
  const now = Date.now();
  if (!quotaCache.value || now - quotaCache.fetchedAt > QUOTA_CACHE_TTL_MS) {
    let value = {};
    try {
      const row = await prisma.appConfig.findUnique({ where: { key: 'quotas' } });
      if (row?.value && typeof row.value === 'object') {
        value = row.value;
      }
    } catch (error) {
      // Fail open on code defaults — quota reads must never break liking
    }
    quotaCache = { value, fetchedAt: now };
  }
  const configured = Number(quotaCache.value.freeLikesPerWindow);
  return Number.isFinite(configured) && configured > 0 ? configured : LIMITS.FREE.dailyLikes;
};

/**
 * Launch-promo config (AppConfig key `launch_promo`), cached 60s:
 * { "enabled": true, "trialDays": 3, "waitlistOnly": false }
 */
const PROMO_CACHE_TTL_MS = 60 * 1000;
let promoCache = { value: null, fetchedAt: 0 };

const getLaunchPromoConfig = async () => {
  const now = Date.now();
  if (!promoCache.value || now - promoCache.fetchedAt > PROMO_CACHE_TTL_MS) {
    let value = {};
    try {
      const row = await prisma.appConfig.findUnique({ where: { key: 'launch_promo' } });
      if (row?.value && typeof row.value === 'object') {
        value = row.value;
      }
    } catch (error) {
      // Fail closed (no promo) — a config read must never break signup
    }
    promoCache = { value, fetchedAt: now };
  }
  return promoCache.value;
};

/**
 * Grant the launch-promo premium trial to a newly created account.
 * No-op unless the promo is enabled; optionally restricted to emails on
 * the waitlist. Returns the trial end date, or null when nothing applied.
 * Never throws — the promo must not be able to break registration.
 */
const grantLaunchTrial = async (userId, email) => {
  try {
    const promo = await getLaunchPromoConfig();
    if (!promo.enabled) {
      return null;
    }
    if (promo.waitlistOnly) {
      const onList = await prisma.waitlist.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: { id: true },
      });
      if (!onList) {
        return null;
      }
    }
    const days = Number(promo.trialDays);
    const trialDays = Number.isFinite(days) && days > 0 ? Math.min(days, 30) : 3;
    const trialEndsAt = new Date(Date.now() + trialDays * 86400000);
    await prisma.user.update({ where: { id: userId }, data: { trialEndsAt } });
    return trialEndsAt;
  } catch (error) {
    logger.warn('Launch trial grant failed (signup unaffected):', error.message);
    return null;
  }
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
      trialEndsAt: true,
      dailyLikesUsed: true,
      dailyLikesResetAt: true,
      superLikeBalance: true,
      superLikeAccruedAt: true,
    },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const premium = hasPremiumAccess(user);
  const limits = premium ? LIMITS.PREMIUM : LIMITS.FREE;
  const freeLikesLimit = premium ? Infinity : await getFreeLikesPerWindow();
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
    } else {
      // Lost the reset race to a concurrent request — re-read so we report
      // the winner's fresh window instead of stale pre-reset usage
      const fresh = await prisma.user.findUnique({
        where: { id: userId },
        select: { dailyLikesUsed: true },
      });
      likesUsed = fresh?.dailyLikesUsed ?? likesUsed;
    }
  }

  // Super Likes accrue daily into a bank (premium only). accruedAt always
  // advances even when the bank is full, so idle days never pile up into an
  // instant refill after a spend. Using increment (not an absolute write)
  // means a concurrent spend can't be resurrected by a stale read here.
  if (premium && limits.superLikeAccrualPerDay > 0) {
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
      } else {
        // Lost the accrual race — the winner already granted; re-read
        const fresh = await prisma.user.findUnique({
          where: { id: userId },
          select: { superLikeBalance: true },
        });
        superLikeBalance = fresh?.superLikeBalance ?? superLikeBalance;
      }
    }
  }

  return {
    isPremium: premium,
    likes: {
      used: likesUsed,
      limit: freeLikesLimit,
      remaining: freeLikesLimit === Infinity ? Infinity : Math.max(0, freeLikesLimit - likesUsed),
      refillAt: freeLikesLimit === Infinity ? null : nextLikesRefillAt(),
    },
    superLikes: {
      remaining: premium ? superLikeBalance : 0,
      limit: limits.superLikeBankCap,
      accrualPerDay: limits.superLikeAccrualPerDay,
    },
    canUndo: limits.canUndo,
    whoLikedMeLimit: limits.whoLikedMeLimit,
  };
};

/**
 * The one true way to make a user premium (admin toggle today, the billing
 * webhook later). Flag, accrual clock, and day-one bank land in ONE
 * statement: a concurrent quota read can never pair premium=true with
 * free-era days, and a concurrent spend can never be restored by the seed.
 * GREATEST keeps a balance that survived a downgrade (raw SQL because the
 * Prisma update API cannot express a field-relative floor atomically).
 *
 * eventAt/eventId/expiresAt (RevenueCat event timestamp, unique event id,
 * and the entitlement's expiration) make the grant conditional:
 * - refused when the entitlement window is already over (expiresAt in the
 *   past) — a stale redelivered grant can never re-open unpaid access
 * - otherwise applies when newer than the last recorded event, or when it
 *   shares that timestamp but is a DIFFERENT event (grants win equal-
 *   timestamp ties — the renewal-boundary shape — while a matching id is
 *   a true duplicate and a no-op)
 * The outcome is therefore delivery-order-independent: premium ends up set
 * iff the entitlement window is genuinely open. Omit all three (admin
 * grants) to apply always. Returns true when the update applied.
 */
const activatePremium = async (userId, eventAt = null, eventId = null, expiresAt = null) => {
  // Prisma sends Date params as timestamptz while the column is a naive
  // UTC timestamp; AT TIME ZONE 'UTC' pins the comparison and the stored
  // value to UTC regardless of the server's session timezone.
  const updated = await prisma.$executeRaw`
    UPDATE "users"
    SET "isPremium" = true,
        "superLikeAccruedAt" = (NOW() AT TIME ZONE 'utc'),
        "superLikeBalance" = GREATEST("superLikeBalance", 2),
        "rcLastEventAt" = COALESCE(${eventAt} AT TIME ZONE 'UTC', "rcLastEventAt"),
        "rcLastEventId" = CASE
          WHEN ${eventAt}::timestamptz IS NULL THEN "rcLastEventId"
          ELSE ${eventId}
        END
    WHERE "id" = ${userId}
      AND (${expiresAt}::timestamptz IS NULL
        OR (${expiresAt} AT TIME ZONE 'UTC') > (NOW() AT TIME ZONE 'utc'))
      AND (${eventAt}::timestamptz IS NULL
        OR "rcLastEventAt" IS NULL
        OR "rcLastEventAt" < (${eventAt} AT TIME ZONE 'UTC')
        OR ("rcLastEventAt" = (${eventAt} AT TIME ZONE 'UTC')
          AND ${eventId}::text IS NOT NULL
          AND "rcLastEventId" IS NOT NULL
          AND "rcLastEventId" <> ${eventId}))
  `;
  return updated > 0;
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
    select: { isPremium: true, trialEndsAt: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  const premium = hasPremiumAccess(user);
  const limits = premium ? LIMITS.PREMIUM : LIMITS.FREE;
  return {
    isPremium: premium,
    limit: limits.whoLikedMeLimit,
  };
};

/**
 * Check if a feature requires premium
 */
const requiresPremium = async (userId, feature) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isPremium: true, trialEndsAt: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  if (hasPremiumAccess(user)) {
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
  hasPremiumAccess,
  grantLaunchTrial,
  getUserQuotas,
  activatePremium,
  canLike,
  canSuperLike,
  canUndo,
  getWhoLikedMeLimit,
  requiresPremium,
};
