#!/usr/bin/env node

/**
 * Ensures the test database is running before tests
 */

const { execSync } = require('child_process');
const logger = require('../src/utils/logger');

function isDbRunning() {
  try {
    execSync('docker ps --format "{{.Names}}" | grep -q hantibink-test-db', {
      stdio: 'pipe',
    });
    return true;
  } catch {
    return false;
  }
}

function startDb() {
  logger.info('🚀 Starting test database...');
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
          // Cross-platform sleep using Node.js built-in setTimeout
          require('child_process').execSync('node -e "setTimeout(() => {}, 1000)"');
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
if (isDbRunning()) {
  logger.info('✅ Test database is already running');
} else {
  startDb();
}