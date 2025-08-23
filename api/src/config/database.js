/**
 * Database configuration and Prisma client initialization
 */

let PrismaClient;
try {
  PrismaClient = require('@prisma/client').PrismaClient;
} catch (error) {
  console.error('CRITICAL: Failed to load Prisma Client - did you run prisma generate?', error);
  process.exit(1);
}
const logger = require('../utils/logger');

// Global Prisma client instance
let prisma;

/**
 * Initialize Prisma client with proper configuration
 */
function initializePrisma() {
  if (prisma) {
    return prisma;
  }

  const isDevelopment = process.env.NODE_ENV === 'development';

  prisma = new PrismaClient({
    log: isDevelopment
      ? [
          { level: 'query', emit: 'event' },
          { level: 'error', emit: 'stdout' },
          { level: 'info', emit: 'stdout' },
          { level: 'warn', emit: 'stdout' },
        ]
      : [
          { level: 'error', emit: 'stdout' },
          { level: 'warn', emit: 'stdout' },
        ],
  });

  // Log database queries in development
  if (isDevelopment) {
    prisma.$on('query', (e) => {
      logger.logDatabase(`Query: ${e.query}`, e.duration, {
        params: e.params,
        target: e.target,
      });
    });
  }

  // Handle connection errors
  prisma.$on('error', (e) => {
    logger.error('Database error:', e);
  });

  logger.info('✅ Prisma client initialized');
  return prisma;
}

/**
 * Connect to the database
 */
async function connectDatabase() {
  try {
    if (!prisma) {
      initializePrisma();
    }

    await prisma.$connect();
    logger.info('🗄️ Database connected successfully');

    // Test the connection
    await prisma.$queryRaw`SELECT 1`;
    logger.info('✅ Database connection verified');

    // Register shutdown listeners only for long-running processes
    if (process.env.NODE_ENV !== 'test') {
      registerShutdownListeners();
    }

    return true;
  } catch (error) {
    logger.error('❌ Failed to connect to database:', error);
    throw error;
  }
}

/**
 * Disconnect from the database
 */
async function disconnectDatabase() {
  try {
    if (prisma) {
      await prisma.$disconnect();
      logger.info('🗄️ Database disconnected');
    }
  } catch (error) {
    logger.error('Error disconnecting from database:', error);
    throw error;
  }
}

/**
 * Get the Prisma client instance
 */
function getPrismaClient() {
  if (!prisma) {
    initializePrisma();
  }
  return prisma;
}

/**
 * Health check for database connection
 */
async function checkDatabaseHealth() {
  try {
    if (!prisma) {
      throw new Error('Database not initialized');
    }

    // Simple query to test connection
    await prisma.$queryRaw`SELECT 1`;

    return {
      status: 'healthy',
      message: 'Database connection successful',
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: 'Database connection failed',
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Graceful shutdown handler
 */
let isShuttingDown = false;

async function gracefulShutdown() {
  if (isShuttingDown) {
    return; // Prevent multiple shutdown calls
  }

  isShuttingDown = true;
  logger.info('🔄 Gracefully shutting down database connection...');

  try {
    await disconnectDatabase();
    logger.info('✅ Database shutdown complete');
  } catch (error) {
    logger.error('❌ Error during database shutdown:', error);
  }

  // Exit the process after a short delay
  setTimeout(() => {
    process.exit(0);
  }, 100);
}

// Handle process termination (only register once)
let listenersRegistered = false;

function registerShutdownListeners() {
  if (!listenersRegistered) {
    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);
    process.on('beforeExit', gracefulShutdown);
    listenersRegistered = true;
    logger.info('🔧 Database shutdown listeners registered');
  }
}

module.exports = {
  initializePrisma,
  connectDatabase,
  disconnectDatabase,
  getPrismaClient,
  checkDatabaseHealth,
  gracefulShutdown,
  registerShutdownListeners,
};
