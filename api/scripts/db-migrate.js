#!/usr/bin/env node

/**
 * Database migration runner with up/down support
 * Usage:
 *   npm run migrate:up       - Apply migrations
 *   npm run migrate:down     - Rollback migrations
 *   npm run migrate:status   - Check migration status
 */

const { PrismaClient } = require('@prisma/client');
const logger = require('../src/utils/logger');
const MigrationSQL = require('./migrations/MigrationSQL');

const prisma = new PrismaClient();

// Migration definitions using MigrationSQL helper
const MIGRATIONS = [
  {
    id: '20240824_add_languages',
    name: 'Add languages field to users',
    up: MigrationSQL.addColumn('users', 'languages', 'TEXT[]', 'ARRAY[]::TEXT[]'),
    down: MigrationSQL.dropColumn('users', 'languages'),
    verify: async () => {
      const result = await prisma.$queryRaw`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'languages'
      `;
      return result.length > 0;
    }
  },
  {
    id: '20241224_update_gender_enum',
    name: 'Update Gender enum values to MALE/FEMALE/OTHER/EVERYONE',
    up: {
      execute: async (prisma) => {
        // Execute each statement separately
        await prisma.$executeRawUnsafe(`UPDATE users SET gender = 'OTHER' WHERE gender = 'NON_BINARY'`);
        await prisma.$executeRawUnsafe(`UPDATE users SET "interestedIn" = array_replace("interestedIn", 'NON_BINARY', 'OTHER')`);
        await prisma.$executeRawUnsafe(`ALTER TYPE "Gender" RENAME TO "Gender_old"`);
        await prisma.$executeRawUnsafe(`CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'EVERYONE')`);
        await prisma.$executeRawUnsafe(`ALTER TABLE users ALTER COLUMN gender TYPE "Gender" USING gender::text::"Gender"`);
        await prisma.$executeRawUnsafe(`ALTER TABLE users ALTER COLUMN "interestedIn" TYPE "Gender"[] USING "interestedIn"::text[]::"Gender"[]`);
        await prisma.$executeRawUnsafe(`DROP TYPE "Gender_old"`);
      }
    },
    down: {
      execute: async (prisma) => {
        // Execute each statement separately for rollback
        await prisma.$executeRawUnsafe(`ALTER TYPE "Gender" RENAME TO "Gender_new"`);
        await prisma.$executeRawUnsafe(`CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'NON_BINARY', 'OTHER')`);
        await prisma.$executeRawUnsafe(`
          ALTER TABLE users ALTER COLUMN gender TYPE "Gender" USING 
            CASE gender::text
              WHEN 'EVERYONE' THEN 'OTHER'::"Gender"
              ELSE gender::text::"Gender"
            END
        `);
        await prisma.$executeRawUnsafe(`UPDATE users SET "interestedIn" = array_replace("interestedIn"::text[], 'EVERYONE', 'OTHER')::"Gender"[]`);
        await prisma.$executeRawUnsafe(`ALTER TABLE users ALTER COLUMN "interestedIn" TYPE "Gender"[] USING "interestedIn"`);
        await prisma.$executeRawUnsafe(`DROP TYPE "Gender_new"`);
      }
    },
    verify: async () => {
      const result = await prisma.$queryRaw`
        SELECT enumlabel 
        FROM pg_enum 
        WHERE enumtypid = (
          SELECT oid FROM pg_type WHERE typname = 'Gender'
        )
      `;
      const values = result.map(r => r.enumlabel);
      return values.includes('MALE') && values.includes('FEMALE') && 
             values.includes('OTHER') && values.includes('EVERYONE');
    }
  }
  // Future migrations will follow this same pattern
];

// Migration table setup
async function ensureMigrationTable() {
  try {
    await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS "app_migrations" (
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
    SELECT id FROM "app_migrations" 
    WHERE id = ${migrationId} 
    AND rolled_back_at IS NULL
  `;
  return result.length > 0;
}

// Record migration
async function recordMigration(migrationId, name) {
  await prisma.$executeRaw`
    INSERT INTO "app_migrations" (id, name) 
    VALUES (${migrationId}, ${name})
    ON CONFLICT (id) DO UPDATE 
    SET rolled_back_at = NULL,
        applied_at = CURRENT_TIMESTAMP
  `;
}

// Record rollback
async function recordRollback(migrationId) {
  await prisma.$executeRaw`
    UPDATE "app_migrations" 
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
      
      // Run the migration using MigrationSQL helper
      await migration.up.execute(prisma);
      
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
      
      // Run the rollback using MigrationSQL helper
      await migration.down.execute(prisma);
      
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
    FROM "app_migrations" 
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