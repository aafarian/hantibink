#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const logger = require('../src/utils/logger');

const prisma = new PrismaClient();

async function verify() {
  try {
    logger.info('Checking if languages column exists...');
    
    const result = await prisma.$queryRaw`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name = 'languages'
    `;
    
    if (result.length > 0) {
      logger.info('✅ Languages column exists!');
      logger.info('Column details:', result[0]);
      
      // Check if any users have languages set
      const usersWithLanguages = await prisma.$queryRaw`
        SELECT COUNT(*) as count 
        FROM users 
        WHERE languages IS NOT NULL 
        AND array_length(languages, 1) > 0
      `;
      
      logger.info(`Users with languages set: ${usersWithLanguages[0].count}`);
      
      // Get a sample user to see the column
      const sampleUser = await prisma.$queryRaw`
        SELECT id, name, languages 
        FROM users 
        LIMIT 1
      `;
      
      if (sampleUser.length > 0) {
        logger.info('Sample user:', {
          id: sampleUser[0].id,
          name: sampleUser[0].name,
          languages: sampleUser[0].languages || '(empty array)'
        });
      }
      
    } else {
      logger.error('❌ Languages column does NOT exist!');
      logger.info('You need to run the migration.');
    }
    
  } catch (error) {
    logger.error('Error checking migration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verify();