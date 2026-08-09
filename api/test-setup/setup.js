// Global test setup - runs once before all tests
import { beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import Logger from '../src/utils/logger.js';

// Set test environment - use environment variables with defaults for local dev
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-testing';
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';

// CRITICAL: Require separate test database to prevent wiping dev/prod data
// Only validate on first run (before we override DATABASE_URL)
const testDbUrl = process.env.TEST_DATABASE_URL;

if (!testDbUrl) {
  throw new Error(
    'TEST_DATABASE_URL is required to run tests. ' +
    'Set it to a separate test database to prevent data loss. ' +
    'Example: TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/myapp_test'
  );
}

// Only check if DATABASE_URL hasn't been overridden yet
// (i.e., this is the first time setup is running)
if (!global.__TEST_DB_VALIDATED__) {
  const devDbUrl = process.env.DATABASE_URL;

  if (testDbUrl === devDbUrl) {
    throw new Error(
      'TEST_DATABASE_URL must be different from DATABASE_URL to prevent data loss.'
    );
  }

  // Mark as validated so subsequent runs don't fail
  global.__TEST_DB_VALIDATED__ = true;
}

process.env.DATABASE_URL = testDbUrl;
process.env.DIRECT_URL = process.env.TEST_DIRECT_URL || testDbUrl;

// Suppress logs during tests (except errors)
if (process.env.NODE_ENV === 'test') {
  global.console = {
    ...console,
    log: () => {},
    info: () => {},
    warn: () => {},
    debug: () => {},
    error: Logger.error.bind(Logger), // Keep error logs for debugging
  };
  
  // Suppress Winston logger
  Logger.transports.forEach(transport => {
    if (transport.name !== 'error') {
      transport.silent = true;
    }
  });
}

// Create a global Prisma client for tests
global.prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

// Run migrations before all tests with increased timeout
beforeAll(async () => {
  try {
    // Push schema to test database (for tests we use db push, not migrations)
    execSync('npx prisma db push --accept-data-loss', {
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL,
      },
      stdio: 'pipe', // Suppress output
    });
    
    // Connect to database
    await global.prisma.$connect();
  } catch (error) {
    Logger.error('Failed to setup test database:', error);
    throw error;
  }
}, 30000); // 30 second timeout for database setup

// Clear database before each test suite
beforeEach(async () => {
  // Clear data in the correct order to respect foreign key constraints
  await global.prisma.messageReaction.deleteMany();
  await global.prisma.message.deleteMany();
  await global.prisma.mutedMatch.deleteMany();
  await global.prisma.match.deleteMany();
  await global.prisma.blockedUser.deleteMany();
  await global.prisma.userAction.deleteMany();
  await global.prisma.userInterest.deleteMany();
  await global.prisma.interest.deleteMany();
  await global.prisma.notification.deleteMany();
  await global.prisma.photo.deleteMany();
  await global.prisma.report.deleteMany();
  await global.prisma.user.deleteMany();
  await global.prisma.waitlist.deleteMany();
  await global.prisma.appConfig.deleteMany();
  await global.prisma.adminAuditLog.deleteMany();
});

// Cleanup after all tests
afterAll(async () => {
  await global.prisma.$disconnect();
});