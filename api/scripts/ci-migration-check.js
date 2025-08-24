#!/usr/bin/env node

/**
 * CI/CD Migration checker
 * Returns status codes for GitHub Actions to determine if migrations are needed
 */

const { PrismaClient } = require('@prisma/client');
const { getMigrations } = require('./migrations');

const prisma = new PrismaClient();

// Get migrations from the shared source
const MIGRATIONS = getMigrations();

async function checkMigrations() {
  let hasPending = false;
  let hasError = false;
  
  try {
    // Check if migration table exists
    const tableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'app_migrations'
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
        SELECT id FROM "app_migrations" 
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
    console.log("Error checking migrations:", error.message);
    hasError = true;
  } finally {
    await prisma.$disconnect();
  }
  
  // Exit codes: 0 = success (even with pending), 1 = error
  process.exit(hasError ? 1 : 0);
}

checkMigrations();