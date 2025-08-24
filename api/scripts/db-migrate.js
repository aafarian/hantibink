#!/usr/bin/env node

/**
 * Database migration runner with up/down support
 * Usage:
 *   npm run migrate:up       - Apply migrations
 *   npm run migrate:down     - Rollback migrations
 *   npm run migrate:status   - Check migration status
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../src/utils/logger');

const prisma = new PrismaClient();

// Migration definitions
const MIGRATIONS = [
  {
    id: '20240824_add_languages',
    name: 'Add languages field to users',
    checkSQL: `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name = 'languages'
    `,
    upSQL: `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "languages" TEXT[] DEFAULT ARRAY[]::TEXT[]`,
    downSQL: `ALTER TABLE "users" DROP COLUMN IF EXISTS "languages"`,
    verify: async () => {
      const result = await prisma.$queryRaw`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'languages'
      `;
      return result.length > 0;
    }
  }
];

// Migration table setup
async function ensureMigrationTable() {
  try {
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "_prisma_migrations_custom" (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        rolled_back_at TIMESTAMP
      )
    `;
    logger.info('Migration table ready');
  } catch (error) {
    logger.error('Failed to create migration table:', error);
    throw error;
  }
}

// Check if migration is applied
async function isMigrationApplied(migrationId) {
  const result = await prisma.$queryRaw`
    SELECT id FROM "_prisma_migrations_custom" 
    WHERE id = ${migrationId} 
    AND rolled_back_at IS NULL
  `;
  return result.length > 0;
}

// Record migration
async function recordMigration(migrationId, name) {
  await prisma.$executeRaw`
    INSERT INTO "_prisma_migrations_custom" (id, name) 
    VALUES (${migrationId}, ${name})
    ON CONFLICT (id) DO UPDATE 
    SET rolled_back_at = NULL,
        applied_at = CURRENT_TIMESTAMP
  `;
}

// Record rollback
async function recordRollback(migrationId) {
  await prisma.$executeRaw`
    UPDATE "_prisma_migrations_custom" 
    SET rolled_back_at = CURRENT_TIMESTAMP 
    WHERE id = ${migrationId}
  `;
}

// Apply migrations
async function up() {
  logger.info('🚀 Running migrations UP...');
  
  await ensureMigrationTable();
  
  for (const migration of MIGRATIONS) {
    try {
      const isApplied = await isMigrationApplied(migration.id);
      
      if (isApplied) {
        logger.info(`✓ Migration ${migration.id} already applied`);
        continue;
      }
      
      logger.info(`📝 Applying migration: ${migration.name}`);
      
      // Run the migration
      await prisma.$executeRawUnsafe(migration.upSQL);
      
      // Verify it worked
      const verified = await migration.verify();
      if (!verified) {
        throw new Error(`Migration ${migration.id} verification failed`);
      }
      
      // Record success
      await recordMigration(migration.id, migration.name);
      
      logger.info(`✅ Migration ${migration.id} applied successfully`);
      
    } catch (error) {
      logger.error(`❌ Migration ${migration.id} failed:`, error.message);
      throw error;
    }
  }
  
  logger.info('✅ All migrations completed');
}

// Rollback migrations
async function down() {
  logger.info('🔄 Rolling back migrations...');
  
  await ensureMigrationTable();
  
  // Process migrations in reverse order
  const reversedMigrations = [...MIGRATIONS].reverse();
  
  for (const migration of reversedMigrations) {
    try {
      const isApplied = await isMigrationApplied(migration.id);
      
      if (!isApplied) {
        logger.info(`✓ Migration ${migration.id} not applied, skipping rollback`);
        continue;
      }
      
      logger.info(`📝 Rolling back migration: ${migration.name}`);
      
      // Run the rollback
      await prisma.$executeRawUnsafe(migration.downSQL);
      
      // Verify rollback worked
      const stillExists = await migration.verify();
      if (stillExists) {
        throw new Error(`Migration ${migration.id} rollback verification failed`);
      }
      
      // Record rollback
      await recordRollback(migration.id);
      
      logger.info(`✅ Migration ${migration.id} rolled back successfully`);
      
    } catch (error) {
      logger.error(`❌ Rollback ${migration.id} failed:`, error.message);
      throw error;
    }
  }
  
  logger.info('✅ All rollbacks completed');
}

// Check migration status
async function status() {
  logger.info('📊 Checking migration status...');
  
  await ensureMigrationTable();
  
  const applied = await prisma.$queryRaw`
    SELECT id, name, applied_at, rolled_back_at 
    FROM "_prisma_migrations_custom" 
    ORDER BY applied_at DESC
  `;
  
  logger.info('\nMigration History:');
  if (applied.length === 0) {
    logger.info('No migrations have been applied');
  } else {
    for (const migration of applied) {
      const status = migration.rolled_back_at 
        ? `🔄 Rolled back at ${migration.rolled_back_at}`
        : '✅ Applied';
      logger.info(`${migration.id}: ${status}`);
    }
  }
  
  logger.info('\nPending Migrations:');
  let hasPending = false;
  for (const migration of MIGRATIONS) {
    const isApplied = await isMigrationApplied(migration.id);
    if (!isApplied) {
      logger.info(`⏳ ${migration.id}: ${migration.name}`);
      hasPending = true;
    }
  }
  
  if (!hasPending) {
    logger.info('All migrations are up to date');
  }
}

// Main execution
async function main() {
  const command = process.argv[2] || 'up';
  
  try {
    switch (command) {
      case 'up':
        await up();
        break;
      case 'down':
        await down();
        break;
      case 'status':
        await status();
        break;
      default:
        logger.error(`Unknown command: ${command}`);
        logger.info('Usage: npm run migrate:[up|down|status]');
        process.exit(1);
    }
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { up, down, status };