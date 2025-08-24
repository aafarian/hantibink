#!/usr/bin/env node

/**
 * Production database migration script
 * Run this after deploying to apply schema changes
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const logger = require('../src/utils/logger');

const prisma = new PrismaClient();

async function runMigration() {
  logger.info('🚀 Starting production database migration...');
  
  try {
    // Check current schema
    const checkColumn = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name = 'languages';
    `;
    
    if (checkColumn.length > 0) {
      logger.info('✅ Languages column already exists, skipping migration');
      return;
    }
    
    logger.info('📝 Adding languages column to users table...');
    
    // Run migration
    await prisma.$executeRaw`
      ALTER TABLE "users" 
      ADD COLUMN "languages" TEXT[] DEFAULT ARRAY[]::TEXT[];
    `;
    
    logger.info('✅ Migration completed successfully!');
    
    // Verify the column was added
    const verify = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name = 'languages';
    `;
    
    logger.info('📊 Verification:', verify);
    
  } catch (error) {
    logger.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  runMigration();
}

module.exports = { runMigration };