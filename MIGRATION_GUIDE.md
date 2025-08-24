# Migration System Guide

## Overview

Our migration system uses a custom, lightweight approach with the official `MigrationSQL` helper class to provide clean, safe database migrations.

## Architecture

```
api/scripts/
├── db-migrate.js           # Main migration runner
├── migrations/
│   └── MigrationSQL.js     # Official SQL helper class
└── migrate-prod.js         # Legacy migration script (deprecated)
```

## MigrationSQL Helper

The `MigrationSQL` class provides a clean API for DDL operations:

```javascript
// Instead of raw SQL strings:
upSQL: `ALTER TABLE "users" ADD COLUMN "languages" TEXT[]`;

// We use the helper:
up: MigrationSQL.addColumn("users", "languages", "TEXT[]", "ARRAY[]::TEXT[]");
```

### Available Methods

- `MigrationSQL.addColumn(table, column, type, defaultValue)`
- `MigrationSQL.dropColumn(table, column)`
- `MigrationSQL.createTable(table, definition)`
- `MigrationSQL.ddl(statement)` - For custom DDL statements

## Creating a New Migration

### 1. Add to MIGRATIONS array in `db-migrate.js`:

```javascript
{
  id: '20240825_add_user_settings',
  name: 'Add user settings table',
  up: MigrationSQL.createTable('user_settings', `
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    theme TEXT DEFAULT 'light',
    notifications BOOLEAN DEFAULT true
  `),
  down: MigrationSQL.ddl('DROP TABLE IF EXISTS "user_settings"'),
  verify: async () => {
    const result = await prisma.$queryRaw`
      SELECT table_name FROM information_schema.tables
      WHERE table_name = 'user_settings'
    `;
    return result.length > 0;
  }
}
```

### 2. Update Prisma Schema

Don't forget to update `prisma/schema.prisma` to match:

```prisma
model UserSettings {
  id            String  @id @default(cuid())
  userId        String  @unique
  theme         String  @default("light")
  notifications Boolean @default(true)
  user          User    @relation(fields: [userId], references: [id])

  @@map("user_settings")
}
```

### 3. Test Locally

```bash
# Check status
npm run migrate:status

# Apply migration
npm run migrate:up

# Test rollback
npm run migrate:down
```

### 4. Deploy to Production

```bash
# After code deployment
npm run migrate:prod:status
npm run migrate:prod
```

## Migration Tracking

Migrations are tracked in the `app_migrations` table:

| Column           | Description                                                  |
| ---------------- | ------------------------------------------------------------ |
| `id`             | Unique migration identifier (e.g., '20240824_add_languages') |
| `name`           | Human-readable description                                   |
| `applied_at`     | When the migration was applied                               |
| `rolled_back_at` | When rolled back (NULL if active)                            |

## Safety Features

### Why Raw SQL is Safe Here

1. **Hardcoded Templates**: All SQL is built from hardcoded strings, never user input
2. **DDL Requirements**: DDL operations (ALTER TABLE, etc.) can't use parameterized queries
3. **Admin Only**: Migration scripts are only run by administrators via CLI
4. **Validation**: MigrationSQL validates that operations are actually DDL

### Built-in Protections

- **Idempotent**: Uses `IF EXISTS` / `IF NOT EXISTS` clauses
- **Verified**: Each migration has a `verify()` function
- **Tracked**: Won't re-run already applied migrations
- **Reversible**: Every migration has up/down methods

## Common Patterns

### Adding a Column

```javascript
{
  id: '20240825_add_bio_length',
  name: 'Add bio_length column',
  up: MigrationSQL.addColumn('users', 'bio_length', 'INTEGER', '0'),
  down: MigrationSQL.dropColumn('users', 'bio_length'),
  verify: async () => {
    const result = await prisma.$queryRaw`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'bio_length'
    `;
    return result.length > 0;
  }
}
```

### Creating an Index

```javascript
{
  id: '20240825_add_email_index',
  name: 'Add index on email',
  up: MigrationSQL.ddl('CREATE INDEX idx_users_email ON users(email)'),
  down: MigrationSQL.ddl('DROP INDEX IF EXISTS idx_users_email'),
  verify: async () => {
    const result = await prisma.$queryRaw`
      SELECT indexname FROM pg_indexes
      WHERE indexname = 'idx_users_email'
    `;
    return result.length > 0;
  }
}
```

### Complex Migration

```javascript
{
  id: '20240825_normalize_interests',
  name: 'Normalize interests to separate table',
  up: MigrationSQL.ddl(`
    -- Create interests table
    CREATE TABLE IF NOT EXISTS interests (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL
    );

    -- Migrate data
    INSERT INTO interests (id, name)
    SELECT DISTINCT unnest(interests) as name,
           md5(unnest(interests)) as id
    FROM users
    WHERE interests IS NOT NULL;
  `),
  down: MigrationSQL.ddl(`
    DROP TABLE IF EXISTS interests;
  `),
  verify: async () => {
    const result = await prisma.$queryRaw`
      SELECT table_name FROM information_schema.tables
      WHERE table_name = 'interests'
    `;
    return result.length > 0;
  }
}
```

## CI/CD Integration

The deployment pipeline automatically:

1. Checks for pending migrations after deployment
2. Shows warnings if migrations are needed
3. Can auto-apply if `AUTO_MIGRATE=true` is set

## Troubleshooting

### Migration Failed

1. Check the error message: `npm run migrate:status`
2. Fix the issue in the migration definition
3. If partially applied, may need manual cleanup
4. Retry: `npm run migrate:up`

### Need to Rollback

```bash
# Rollback last migration
npm run migrate:down

# Check what was rolled back
npm run migrate:status
```

### Reset Migration Tracking

If you need to reset (use with caution):

```sql
-- Clear migration history (doesn't change schema)
TRUNCATE TABLE app_migrations;

-- Or drop the table entirely
DROP TABLE app_migrations;
```

## Best Practices

1. **Always test locally first**
2. **Include verification logic**
3. **Make migrations idempotent** (can run multiple times safely)
4. **Keep migrations small and focused**
5. **Document breaking changes**
6. **Update Prisma schema to match**

## FAQ

### Q: Why not use Prisma Migrate?

A: Prisma Migrate requires a shadow database and has less flexibility for custom migration logic. Our system gives us full control while remaining simple.

### Q: Is using $executeRawUnsafe safe?

A: Yes, in this context. The SQL is hardcoded in our migration definitions, never from user input. DDL operations require raw SQL and can't use parameterized queries.

### Q: Can I edit old migrations?

A: No, never edit migrations that have been applied to production. Create a new migration to make changes.

### Q: How do I handle data migrations?

A: Use `MigrationSQL.ddl()` with custom SQL for data transformations. Always test thoroughly with production-like data.
