# Database Migration Guide

## Overview

We use Prisma's built-in migration system to manage database schema changes. This provides automatic migration generation, version control, and deployment tracking.

## Migration Workflow

### 1. Making Schema Changes

Edit the Prisma schema file:

```
api/prisma/schema.prisma
```

### 2. Create a Migration

After modifying the schema, generate a migration:

```bash
cd api
npx prisma migrate dev --name descriptive_migration_name
```

This will:

- Generate SQL migration files in `prisma/migrations/`
- Apply the migration to your local database
- Regenerate the Prisma Client

### 3. Test the Migration

The migration is automatically applied to your local database. Test your changes:

```bash
# Check migration status
npx prisma migrate status

# View the database in Prisma Studio
npx prisma studio
```

### 4. Commit Migration Files

Always commit the generated migration files:

```bash
git add prisma/migrations/
git add prisma/schema.prisma
git commit -m "feat: add [feature] to database schema"
```

## Production Deployment

Migrations are automatically applied during deployment via GitHub Actions:

1. Push to main branch
2. GitHub Actions workflow runs
3. Migration is applied before building Docker image
4. New API deployment uses updated schema

Manual production migration (if needed):

```bash
# Check production migration status
npx prisma migrate status

# Apply pending migrations
npx prisma migrate deploy
```

## Common Commands

### Development

```bash
# Create a new migration
npx prisma migrate dev --name add_user_preferences

# Reset database and apply all migrations
npx prisma migrate reset

# Apply migrations without creating new ones
npx prisma migrate deploy
```

### Introspection

```bash
# Pull schema from existing database
npx prisma db pull

# Push schema to database without migrations (dev only!)
npx prisma db push
```

### Status and Debugging

```bash
# Check migration status
npx prisma migrate status

# View database in browser
npx prisma studio

# Generate Prisma Client
npx prisma generate
```

## Migration Best Practices

### DO ✅

- Create small, focused migrations
- Name migrations descriptively (e.g., `add_premium_features`, `create_messages_table`)
- Test migrations locally before pushing
- Include both schema changes and migrations in the same PR
- Review generated SQL before committing

### DON'T ❌

- Edit or delete existing migrations that have been deployed
- Use `db push` in production (it bypasses migrations)
- Make breaking changes without coordination
- Forget to commit migration files
- Mix multiple features in one migration

## Handling Special Cases

### Adding a Column with Default Value

```prisma
model User {
  // New field with default
  isVerified Boolean @default(false)
}
```

### Creating Indexes

```prisma
model User {
  email String @unique

  // Composite index
  @@index([latitude, longitude])
}
```

### Renaming Fields

```prisma
model User {
  // Use @map to keep database column name
  firstName String @map("first_name")
}
```

### Adding Relations

```prisma
model Message {
  id       String @id
  senderId String
  sender   User   @relation(fields: [senderId], references: [id])
}
```

## Rollback Strategy

Prisma doesn't have automatic rollback, so:

1. **Before deployment**: Test thoroughly locally
2. **For rollback**: Create a new forward migration that undoes changes
3. **Emergency**: Restore database backup and redeploy previous code version

## Troubleshooting

### "Database schema is not in sync"

```bash
# Check what's different
npx prisma migrate diff

# Create migration for the differences
npx prisma migrate dev
```

### "Migration already applied"

```bash
# Check migration history
npx prisma migrate status

# If needed, mark as applied (use carefully!)
npx prisma migrate resolve --applied "20240825_migration_name"
```

### "Shadow database required"

For cloud databases that don't allow CREATE DATABASE:

```bash
# Use a different shadow database URL
DATABASE_URL="..." SHADOW_DATABASE_URL="..." npx prisma migrate dev
```

## Migration History

Prisma tracks migrations in the `_prisma_migrations` table:

| Column              | Description                         |
| ------------------- | ----------------------------------- |
| id                  | Unique identifier                   |
| checksum            | Migration file checksum             |
| finished_at         | When migration completed            |
| migration_name      | Name from filename                  |
| logs                | Error logs if failed                |
| rolled_back_at      | Always null (no automatic rollback) |
| applied_steps_count | Number of SQL statements applied    |

## CI/CD Integration

Our GitHub Actions workflow (`deploy-api.yml`) automatically:

1. Checks for schema changes in PRs
2. Applies migrations before deployment
3. Rebuilds Docker image with new Prisma Client
4. Deploys updated API to Cloud Run

## Resources

- [Prisma Migrate Documentation](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Migration Troubleshooting](https://www.prisma.io/docs/guides/database/troubleshooting-orm/migration-troubleshooting)
- [Production Deployment](https://www.prisma.io/docs/guides/deployment/deployment)
