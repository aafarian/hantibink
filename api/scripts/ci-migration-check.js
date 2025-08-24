#!/usr/bin/env node

/**
 * CI/CD Migration checker
 * Returns status codes for GitHub Actions to determine if migrations are needed
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Migration definitions (same as in db-migrate.js)
const MIGRATIONS = [
  {
    id: '20240824_add_languages',
    name: 'Add languages field to users',
  }
  // Add future migrations here
];

async function checkMigrations() {
  let hasPending = false;
  let hasError = false;
  
  try {
    // Check if migration table exists
    const tableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = '_prisma_migrations_custom'
      );
    `;
    
    if (!tableExists[0].exists) {
      console.log("STATUS=NO_TABLE");
      console.log("⚠️ Migration table doesn't exist yet");
      console.log("PENDING_MIGRATIONS=" + MIGRATIONS.map(m => m.id).join(','));
      return;
    }
    
    // Check each migration
    const pendingMigrations = [];
    for (const migration of MIGRATIONS) {
      const result = await prisma.$queryRaw`
        SELECT id FROM "_prisma_migrations_custom" 
        WHERE id = ${migration.id} 
        AND rolled_back_at IS NULL
      `;
      
      if (result.length === 0) {
        pendingMigrations.push(migration.id);
        hasPending = true;
      }
    }
    
    if (hasPending) {
      console.log("STATUS=PENDING");
      console.log("PENDING_MIGRATIONS=" + pendingMigrations.join(','));
      console.log("");
      console.log("⚠️ WARNING: Pending migrations detected!");
      console.log("Migrations needed: " + pendingMigrations.join(', '));
      console.log("");
      console.log("To apply migrations, run:");
      console.log("  cd api && npm run migrate:prod");
      process.exit(0); // Don't fail the build
    } else {
      console.log("STATUS=UP_TO_DATE");
      console.log("✅ All migrations are up to date");
    }
    
  } catch (error) {
    console.log("STATUS=ERROR");
    console.error("Error checking migrations:", error.message);
    hasError = true;
  } finally {
    await prisma.$disconnect();
  }
  
  // Exit codes: 0 = success (even with pending), 1 = error
  process.exit(hasError ? 1 : 0);
}

checkMigrations();