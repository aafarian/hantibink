#!/usr/bin/env node

/**
 * Test that MigrationSQL properly validates and prevents SQL injection
 */

const MigrationSQL = require('./migrations/MigrationSQL');
const logger = require('../src/utils/logger');

function testValidation() {
  logger.info('Testing MigrationSQL validation...\n');
  
  const tests = [
    {
      name: 'Valid table and column names',
      test: () => MigrationSQL.addColumn('users', 'new_field', 'TEXT'),
      shouldPass: true
    },
    {
      name: 'Table name with SQL injection attempt',
      test: () => MigrationSQL.addColumn('users"; DROP TABLE users; --', 'field', 'TEXT'),
      shouldPass: false
    },
    {
      name: 'Column name with semicolon',
      test: () => MigrationSQL.addColumn('users', 'field; DELETE FROM users', 'TEXT'),
      shouldPass: false
    },
    {
      name: 'Table name with quotes',
      test: () => MigrationSQL.addColumn('users"', 'field', 'TEXT'),
      shouldPass: false
    },
    {
      name: 'Reserved SQL keyword as table name',
      test: () => MigrationSQL.addColumn('SELECT', 'field', 'TEXT'),
      shouldPass: false
    },
    {
      name: 'Empty table name',
      test: () => MigrationSQL.addColumn('', 'field', 'TEXT'),
      shouldPass: false
    },
    {
      name: 'Null column name',
      test: () => MigrationSQL.addColumn('users', null, 'TEXT'),
      shouldPass: false
    },
    {
      name: 'Valid underscore and dollar sign',
      test: () => MigrationSQL.addColumn('user_profiles$1', 'field_name$2', 'TEXT'),
      shouldPass: true
    },
    {
      name: 'Special characters in table name',
      test: () => MigrationSQL.addColumn('users!@#', 'field', 'TEXT'),
      shouldPass: false
    },
    {
      name: 'Command injection in column name',
      test: () => MigrationSQL.addColumn('users', '`rm -rf /`', 'TEXT'),
      shouldPass: false
    }
  ];
  
  let passed = 0;
  let failed = 0;
  
  tests.forEach(({ name, test, shouldPass }) => {
    try {
      const result = test();
      if (shouldPass) {
        logger.info(`✅ PASS: ${name}`);
        passed++;
      } else {
        logger.error(`❌ FAIL: ${name} - Should have thrown an error but didn't`);
        failed++;
      }
    } catch (error) {
      if (!shouldPass) {
        logger.info(`✅ PASS: ${name} - Correctly rejected: ${error.message}`);
        passed++;
      } else {
        logger.error(`❌ FAIL: ${name} - Unexpected error: ${error.message}`);
        failed++;
      }
    }
  });
  
  logger.info(`\n📊 Results: ${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    logger.error('❌ Some tests failed!');
    process.exit(1);
  } else {
    logger.info('✅ All tests passed! MigrationSQL is secure.');
  }
}

// Run tests
testValidation();