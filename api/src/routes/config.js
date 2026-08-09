const express = require('express');
const { getPrismaClient } = require('../config/database');
const { catchAsync } = require('../middleware/errorHandler');

const router = express.Router();

const FLAGS_CACHE_TTL_MS = 60 * 1000;
let flagsCache = { value: null, fetchedAt: 0 };

/**
 * @route   GET /api/config/flags
 * @desc    Public feature flags (read-only, 60s in-process cache).
 *          Written by the admin dashboard; consumed by the mobile
 *          FeatureFlagsContext with safe defaults on failure.
 * @access  Public
 */
router.get(
  '/flags',
  catchAsync(async (req, res) => {
    const now = Date.now();
    if (!flagsCache.value || now - flagsCache.fetchedAt > FLAGS_CACHE_TTL_MS) {
      let flags = {};
      try {
        const prisma = getPrismaClient();
        const row = await prisma.appConfig.findUnique({ where: { key: 'feature_flags' } });
        if (row?.value && typeof row.value === 'object') {
          flags = row.value;
        }
      } catch (error) {
        // Fail open with the empty set — clients keep their baked-in defaults
      }
      flagsCache = { value: flags, fetchedAt: now };
    }
    res.json({ success: true, data: flagsCache.value });
  }),
);

module.exports = router;
