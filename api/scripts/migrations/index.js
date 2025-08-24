/**
 * Central migration definitions
 * Single source of truth for all migrations
 */

const MigrationSQL = require('./MigrationSQL');

// Define all migrations here
const MIGRATIONS = [
  {
    id: '20240824_add_languages',
    name: 'Add languages field to users',
    up: MigrationSQL.addColumn('users', 'languages', 'TEXT[]', 'ARRAY[]::TEXT[]'),
    down: MigrationSQL.dropColumn('users', 'languages'),
    verify: async function(prisma) {
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
    verify: async function(prisma) {
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
  // Future migrations will be added here
];

// Export for use in both db-migrate.js and ci-migration-check.js
module.exports = {
  getMigrations: () => MIGRATIONS,
  MIGRATIONS
};