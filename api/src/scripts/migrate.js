/**
 * Database migration script
 * Run with: node src/scripts/migrate.js
 */

const { execSync } = require('child_process');
const logger = require('../utils/logger');

async function runMigrations() {
  try {
    logger.info('🔄 Starting database migrations...');

    // Generate Prisma client
    logger.info('📦 Generating Prisma client...');
    execSync('npx prisma generate', { stdio: 'inherit' });

    // Push schema to database (for development)
    if (process.env.NODE_ENV === 'development') {
      logger.info('🚀 Pushing schema to development database...');
      execSync('npx prisma db push', { stdio: 'inherit' });
    } else {
      // Deploy migrations (for production)
      logger.info('🚀 Deploying migrations to production database...');
      execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    }

    logger.info('✅ Database migrations completed successfully');
  } catch (error) {
    logger.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runMigrations().catch((error) => {
    logger.error('Migration failed:', error);
    process.exit(1);
  });
}

module.exports = { runMigrations };
