/**
 * Health check routes for monitoring and load balancers
 */

const express = require('express');
const router = express.Router();
const { checkDatabaseHealth } = require('../config/database');

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
 * Returns minimum required app version for force update functionality
 */
router.get('/app-version', (req, res) => {
  // These can be moved to environment variables or database for dynamic control
  const versionConfig = {
    // Minimum version required to use the app (force update if below this)
    minVersion: process.env.MIN_APP_VERSION || '1.0.0',
    // Latest available version (for "update available" prompts)
    latestVersion: process.env.LATEST_APP_VERSION || '1.0.0',
    // Whether to force update (can be used as kill switch)
    forceUpdate: process.env.FORCE_APP_UPDATE === 'true',
    // Optional message to show users
    updateMessage: process.env.APP_UPDATE_MESSAGE || null,
    // Store URLs for convenience
    storeUrls: {
      ios: 'https://apps.apple.com/app/hantibink/id000000000', // Replace with real ID
      android: 'https://play.google.com/store/apps/details?id=com.antoafarian.hantibink',
    },
  };

  res.status(200).json({
    success: true,
    data: versionConfig,
  });
});

module.exports = router;
