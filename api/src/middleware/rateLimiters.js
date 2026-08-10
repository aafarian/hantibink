/**
 * Per-route rate limiters (all keyed by IP; `trust proxy` is set in server.js).
 *
 * Every limiter is skipped when ENABLE_RATE_LIMITING=false or in the test
 * environment, mirroring the global limiter's escape hatch so integration
 * tests stay deterministic.
 */

const rateLimit = require('express-rate-limit');

const isDevelopment = process.env.NODE_ENV === 'development';

const skipLimiting = () =>
  process.env.ENABLE_RATE_LIMITING === 'false' || process.env.NODE_ENV === 'test';

const makeLimiter = ({ windowMs, max, devMax, message, skipSuccessfulRequests = false }) =>
  rateLimit({
    windowMs,
    max: isDevelopment && devMax ? devMax : max,
    message: {
      error: message,
      retryAfter: Math.ceil(windowMs / 1000),
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    skip: skipLimiting,
  });

/**
 * Login/register/OAuth attempts. Successful requests don't count.
 */
const authLimiter = makeLimiter({
  windowMs: isDevelopment ? 1 * 60 * 1000 : 5 * 60 * 1000,
  max: 10,
  devMax: 50,
  message: 'Too many authentication attempts, please try again later',
  skipSuccessfulRequests: true,
});

/**
 * Password-reset and email-verification flows: strict, success counts too
 * (these endpoints are abuse targets even when requests succeed).
 */
const sensitiveAuthLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  devMax: 50,
  message: 'Too many attempts, please try again later',
});

/**
 * Token refresh: generous (legit clients refresh often) but bounded.
 */
const refreshLimiter = makeLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  devMax: 200,
  message: 'Too many token refresh attempts, please try again later',
});

/**
 * Account-existence probes (check-email, oauth/check-user): these endpoints
 * necessarily reveal whether an email is registered, so they get the
 * tightest budget of all.
 */
const enumerationLimiter = makeLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  devMax: 100,
  message: 'Too many requests, please try again later',
});

/**
 * High-frequency authenticated writes (messages, reactions, swipes).
 */
const writeBurstLimiter = makeLimiter({
  windowMs: 60 * 1000,
  max: 60,
  devMax: 300,
  message: 'Slow down a little — too many requests',
});

/**
 * Public waitlist signups (unauthenticated write endpoint).
 */
const waitlistLimiter = makeLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  devMax: 50,
  message: 'Too many signups from this address, please try again later',
});

module.exports = {
  authLimiter,
  sensitiveAuthLimiter,
  refreshLimiter,
  enumerationLimiter,
  writeBurstLimiter,
  waitlistLimiter,
};
