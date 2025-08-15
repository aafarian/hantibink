/**
 * Development setup script
 * Sets up local PostgreSQL database for development
 * Run with: node src/scripts/dev-setup.js
 */

const { execSync } = require('child_process');
const logger = require('../utils/logger');

async function setupDevelopment() {
  try {
    logger.info('🚀 Setting up development environment...');

    // Check if PostgreSQL is running
    logger.info('🔍 Checking PostgreSQL connection...');

    try {
      // Try to connect to PostgreSQL
      const { connectDatabase } = require('../config/database');
      await connectDatabase();
      logger.info('✅ PostgreSQL connection successful');
    } catch (error) {
      logger.error('❌ PostgreSQL connection failed:', error.message);
      logger.info('');
      logger.info('📋 To set up PostgreSQL locally:');
      logger.info('');
      logger.info('🍺 Using Homebrew (macOS):');
      logger.info('   brew install postgresql@15');
      logger.info('   brew services start postgresql@15');
      logger.info('   createdb hantibink_dev');
      logger.info('   createuser hantibink_user');
      logger.info(
        '   psql -d hantibink_dev -c "ALTER USER hantibink_user WITH PASSWORD \'hantibink_password\';"',
      );
      logger.info('');
      logger.info('🐳 Using Docker:');
      logger.info('   docker run --name hantibink-postgres \\');
      logger.info('     -e POSTGRES_DB=hantibink_dev \\');
      logger.info('     -e POSTGRES_USER=hantibink_user \\');
      logger.info('     -e POSTGRES_PASSWORD=hantibink_password \\');
      logger.info('     -p 5432:5432 -d postgres:15-alpine');
      logger.info('');
      logger.info('🔧 Or use Docker Compose:');
      logger.info('   cd .. && docker-compose up postgres -d');
      logger.info('');
      process.exit(1);
    }

    // Generate Prisma client
    logger.info('📦 Generating Prisma client...');
    execSync('npx prisma generate', { stdio: 'inherit' });

    // Push schema to database
    logger.info('🗄️ Setting up database schema...');
    execSync('npx prisma db push', { stdio: 'inherit' });

    // Seed database
    logger.info('🌱 Seeding database with initial data...');
    execSync('node src/scripts/seed.js', { stdio: 'inherit' });

    logger.info('');
    logger.info('🎉 Development environment setup complete!');
    logger.info('');
    logger.info('🚀 You can now start the server with:');
    logger.info('   npm run dev');
    logger.info('');
    logger.info('🔍 Explore your database with:');
    logger.info('   npm run db:studio');
    logger.info('');
  } catch (error) {
    logger.error('❌ Development setup failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  setupDevelopment();
}

module.exports = { setupDevelopment };
