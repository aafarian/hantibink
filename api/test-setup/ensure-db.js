#!/usr/bin/env node

/**
 * Ensures the test database is running before tests
 * Supports both local PostgreSQL and Docker
 */

const { execSync } = require('child_process');
const logger = require('../src/utils/logger');

// Load environment variables for test database URL
require('dotenv').config();

function isLocalDbAvailable() {
  const testDbUrl = process.env.TEST_DATABASE_URL;
  if (!testDbUrl) {
    return false;
  }

  try {
    // Extract connection details from URL
    const url = new URL(testDbUrl);
    const host = url.hostname || 'localhost';
    const port = url.port || '5432';

    // Check if PostgreSQL is accepting connections
    execSync(`pg_isready -h ${host} -p ${port}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function isDockerDbRunning() {
  try {
    execSync('docker ps --format "{{.Names}}" | grep -q hantibink-test-db', {
      stdio: 'pipe',
    });
    return true;
  } catch {
    return false;
  }
}

function startDockerDb() {
  logger.info('🚀 Starting test database via Docker...');
  try {
    execSync('docker-compose -f docker-compose.test.yml up -d', {
      stdio: 'inherit',
    });

    // Wait for database to be ready
    logger.info('⏳ Waiting for database to be ready...');
    let retries = 0;
    const maxRetries = 30;

    while (retries < maxRetries) {
      try {
        execSync('docker exec hantibink-test-db pg_isready -U test -d hantibink_test', {
          stdio: 'pipe',
        });
        logger.info('✅ Test database is ready!');
        return;
      } catch {
        retries++;
        if (retries < maxRetries) {
          process.stdout.write('.');
          execSync('node -e "setTimeout(() => {}, 1000)"');
        }
      }
    }

    throw new Error('Database failed to start within 30 seconds');
  } catch (error) {
    logger.error('❌ Failed to start test database:', error.message);
    process.exit(1);
  }
}

// Main execution
const testDbUrl = process.env.TEST_DATABASE_URL;

if (!testDbUrl) {
  logger.error('❌ TEST_DATABASE_URL is not set.');
  logger.error('   Set it in api/.env to a separate test database.');
  logger.error('   Example: TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/hantibink_test');
  process.exit(1);
}

// Try local PostgreSQL first
if (isLocalDbAvailable()) {
  logger.info('✅ Local test database is available');
  logger.info(`   Using: ${testDbUrl.replace(/:[^:@]+@/, ':****@')}`);
  process.exit(0);
}

// Fall back to Docker
if (isDockerDbRunning()) {
  logger.info('✅ Docker test database is already running');
  process.exit(0);
}

// Try to start Docker database
try {
  execSync('which docker-compose', { stdio: 'pipe' });
  startDockerDb();
} catch {
  logger.error('❌ No test database available.');
  logger.error('   Option 1: Start local PostgreSQL and create hantibink_test database');
  logger.error('             Run: ./scripts/setup-local-dbs.sh');
  logger.error('   Option 2: Install docker-compose and run: docker-compose -f docker-compose.test.yml up -d');
  process.exit(1);
}