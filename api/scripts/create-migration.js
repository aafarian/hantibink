#!/usr/bin/env node

/**
 * Interactive migration creation script
 * Similar to the company workflow - prompts for migration name and creates migration
 */

const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n🔄 Prisma Migration Creator\n');

rl.question('Enter migration name (e.g., "add user preferences"): ', (answer) => {
  if (!answer || answer.trim() === '') {
    console.error('❌ Migration name cannot be empty!');
    rl.close();
    process.exit(1);
  }

  // Format the migration name
  // Replace spaces with underscores, lowercase, remove special characters
  const formattedName = answer
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars except spaces and hyphens
    .replace(/\s+/g, '_')         // Replace spaces with underscores
    .replace(/-+/g, '_')          // Replace hyphens with underscores
    .replace(/_+/g, '_');         // Remove duplicate underscores

  console.log(`\n📝 Creating migration: ${formattedName}\n`);

  try {
    // Run prisma migrate dev with the formatted name
    execSync(`npx prisma migrate dev --name ${formattedName}`, {
      stdio: 'inherit',
      cwd: __dirname + '/..',
      env: {
        ...process.env,
        NODE_OPTIONS: '--dns-result-order=ipv4first'
      }
    });

    console.log('\n✅ Migration created successfully!');
    console.log('📁 Migration files are in: prisma/migrations/');
    console.log('💡 Next steps:');
    console.log('   1. Review the generated SQL in the migration file');
    console.log('   2. Test your changes locally');
    console.log('   3. Commit the migration files to Git');
    console.log('   4. Push and merge to main to apply to production\n');
  } catch (error) {
    console.error('\n❌ Failed to create migration:', error.message);
    process.exit(1);
  }

  rl.close();
});
