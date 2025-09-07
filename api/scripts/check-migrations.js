#!/usr/bin/env node

/**
 * Check migration status and provide detailed information
 * Usage: node scripts/check-migrations.js
 */

const { execSync } = require('child_process');
const path = require('path');

// Force IPv4 for Supabase connections
process.env.NODE_OPTIONS = '--dns-result-order=ipv4first';

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function runCommand(command, silent = false) {
  try {
    const output = execSync(command, {
      encoding: 'utf8',
      stdio: silent ? 'pipe' : 'inherit',
    });
    return output;
  } catch (error) {
    if (!silent) {
      log(`Error running command: ${command}`, 'red');
      log(error.message, 'red');
    }
    throw error;
  }
}

async function checkMigrations() {
  log('\n🔍 Checking Database Migration Status\n', 'cyan');
  log('=' .repeat(50), 'cyan');

  try {
    // Check if we're in the right directory
    const cwd = process.cwd();
    if (!cwd.endsWith('/api')) {
      log('⚠️  Not in api directory, changing to api/', 'yellow');
      process.chdir(path.join(cwd, 'api'));
    }

    // Check environment
    const env = process.env.NODE_ENV || 'development';
    const dbUrl = process.env.DATABASE_URL;
    
    log(`\n📊 Environment: ${env}`, 'blue');
    if (dbUrl) {
      const dbHost = dbUrl.match(/@([^:\/]+)/)?.[1] || 'unknown';
      log(`🔗 Database Host: ${dbHost}`, 'blue');
    } else {
      log('⚠️  DATABASE_URL not set in environment', 'yellow');
    }

    // Check current migration status
    log('\n📋 Migration Status:', 'green');
    log('-'.repeat(30), 'green');
    
    try {
      const status = runCommand('npx prisma migrate status', true);
      
      if (status.includes('Database schema is up to date')) {
        log('✅ Database schema is up to date!', 'green');
      } else if (status.includes('Following migration')) {
        log('⚠️  There are pending migrations:', 'yellow');
        console.log(status);
      } else {
        console.log(status);
      }
    } catch (error) {
      // If status fails, show the error but continue
      log('❌ Could not check migration status', 'red');
      console.log(error.stdout || error.message);
    }

    // List available migrations
    log('\n📁 Available Migrations:', 'blue');
    log('-'.repeat(30), 'blue');
    
    try {
      const migrations = runCommand('ls -la prisma/migrations/', true);
      const migrationDirs = migrations
        .split('\n')
        .filter(line => line.includes('_'))
        .map(line => {
          const parts = line.split(/\s+/);
          const dirname = parts[parts.length - 1];
          const date = dirname.substring(0, 8);
          const name = dirname.substring(15);
          return `  ${date} - ${name}`;
        });
      
      if (migrationDirs.length > 0) {
        migrationDirs.forEach(m => console.log(m));
        log(`\nTotal: ${migrationDirs.length} migration(s)`, 'blue');
      } else {
        log('No migrations found', 'yellow');
      }
    } catch (error) {
      log('Could not list migrations', 'yellow');
    }

    // Check if we can connect to database
    log('\n🔌 Testing Database Connection:', 'cyan');
    log('-'.repeat(30), 'cyan');
    
    const testConnection = `
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      
      prisma.$connect()
        .then(async () => {
          console.log('✅ Database connection successful');
          const userCount = await prisma.user.count();
          console.log(\`📊 Total users in database: \${userCount}\`);
          await prisma.$disconnect();
        })
        .catch((err) => {
          console.error('❌ Database connection failed:', err.message);
          process.exit(1);
        });
    `;
    
    try {
      runCommand(`node -e "${testConnection.replace(/"/g, '\\"')}"`);
    } catch (error) {
      log('Database connection test failed', 'red');
    }

    // Show helpful commands
    log('\n📝 Useful Commands:', 'cyan');
    log('-'.repeat(30), 'cyan');
    console.log('  npm run migrate:status     - Check migration status');
    console.log('  npm run migrate:deploy     - Deploy pending migrations');
    console.log('  npm run migrate:deploy:safe - Deploy with retry logic');
    console.log('  npm run db:migrate         - Create new migration (dev)');
    console.log('  npx prisma studio          - Open database GUI');

    log('\n✅ Migration check complete!\n', 'green');

  } catch (error) {
    log('\n❌ Migration check failed!', 'red');
    log(error.message, 'red');
    process.exit(1);
  }
}

// Run the check
checkMigrations().catch(console.error);