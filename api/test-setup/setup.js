// Global test setup - runs once before all tests
import { beforeAll, afterAll, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import Logger from '../src/utils/logger.js';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5433/hantibink_test';
process.env.DIRECT_URL = 'postgresql://test:test@localhost:5433/hantibink_test';
process.env.ADMIN_EMAIL = 'admin@example.com';

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
  await global.prisma.userInterest.deleteMany();
  await global.prisma.interest.deleteMany();
  await global.prisma.message.deleteMany();
  await global.prisma.match.deleteMany();
  await global.prisma.userAction.deleteMany();
  await global.prisma.notification.deleteMany();
  await global.prisma.photo.deleteMany();
  await global.prisma.report.deleteMany();
  await global.prisma.user.deleteMany();
});

// Cleanup after all tests
afterAll(async () => {
  await global.prisma.$disconnect();
});