/**
 * Health check routes for monitoring and load balancers
 */

const express = require('express');
const router = express.Router();
const { checkDatabaseHealth, getPrismaClient } = require('../config/database');
const logger = require('../utils/logger');

// Basic health check
router.get('/', (req, res) => {
  const healthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    memory: {
      used:
        Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
      total:
        Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) / 100,
      external:
        Math.round((process.memoryUsage().external / 1024 / 1024) * 100) / 100,
    },
    cpu: process.cpuUsage(),
  };

  res.status(200).json(healthCheck);
});

// Detailed health check with dependencies
router.get('/detailed', async (req, res) => {
  const checks = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      server: {
        status: 'healthy',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
      },
    },
  };

  // Check database connection
  try {
    const dbCheck = await checkDatabaseHealth();
    checks.checks.database = dbCheck;

    if (dbCheck.status !== 'healthy') {
      checks.status = 'degraded';
    }
  } catch (error) {
    checks.checks.database = {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString(),
    };
    checks.status = 'degraded';
  }


  const statusCode = checks.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(checks);
});

// Readiness probe (for Kubernetes)
router.get('/ready', (req, res) => {
  // Check if the application is ready to serve traffic
  const ready = {
    status: 'ready',
    timestamp: new Date().toISOString(),
    message: 'Application is ready to serve traffic',
  };

  res.status(200).json(ready);
});

// Liveness probe (for Kubernetes)
router.get('/live', (req, res) => {
  // Check if the application is alive
  const alive = {
    status: 'alive',
    timestamp: new Date().toISOString(),
    message: 'Application is alive',
    uptime: process.uptime(),
  };

  res.status(200).json(alive);
});

// Metrics endpoint (basic)
router.get('/metrics', (req, res) => {
  const metrics = {
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
  };

  res.status(200).json(metrics);
});

/**
 * App version check endpoint
 * Returns minimum required app version for force update functionality.
 *
 * Source of truth is the AppConfig row `app_version` (writable from the
 * admin dashboard, no redeploy needed), with env vars as fallback and safe
 * defaults last. Cached in-process for 60s.
 */
const APP_VERSION_CACHE_TTL_MS = 60 * 1000;
let appVersionCache = { value: null, fetchedAt: 0 };

const defaultVersionConfig = () => ({
  minVersion: process.env.MIN_APP_VERSION || '1.0.0',
  latestVersion: process.env.LATEST_APP_VERSION || '1.0.0',
  forceUpdate: process.env.FORCE_APP_UPDATE === 'true',
  updateMessage: process.env.APP_UPDATE_MESSAGE || null,
  storeUrls: {
    ios: 'https://apps.apple.com/app/id6799826153',
    android: 'https://play.google.com/store/apps/details?id=com.antoafarian.hantibink',
  },
});

router.get('/app-version', async (req, res) => {
  const now = Date.now();
  if (!appVersionCache.value || now - appVersionCache.fetchedAt > APP_VERSION_CACHE_TTL_MS) {
    let config = defaultVersionConfig();
    try {
      const prisma = getPrismaClient();
      const row = await prisma.appConfig.findUnique({ where: { key: 'app_version' } });
      if (row?.value && typeof row.value === 'object') {
        // DB values win over env/defaults, field by field
        config = { ...config, ...row.value };
      }
    } catch (error) {
      // Fail open on defaults — a config read must never break the app boot
      logger.warn(
        'app-version: AppConfig read failed, serving env/default config:',
        error.message,
      );
    }
    appVersionCache = { value: config, fetchedAt: now };
  }

  res.status(200).json({
    success: true,
    data: appVersionCache.value,
  });
});

module.exports = router;
