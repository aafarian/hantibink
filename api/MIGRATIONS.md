# Database Migrations Guide

## Overview

This guide explains how to manage database migrations for HantieBink API, including handling Supabase IPv6 connectivity issues.

## Quick Commands

### Local Development

```bash
# Check migration status
npm run migrate:check

# Create a new migration (development only)
npm run db:migrate

# Apply pending migrations to local DB
npm run migrate:deploy

# Reset database (WARNING: destroys all data)
npm run db:reset
```

### Production

```bash
# Check production migration status
npm run migrate:status

# Deploy migrations with retry logic (recommended)
npm run migrate:deploy:safe

# Deploy migrations (simple, no retry)
npm run migrate:deploy
```

## Migration Workflow

### 1. Local Development

When you make schema changes:

```bash
# 1. Edit prisma/schema.prisma

# 2. Create a migration
npx prisma migrate dev --name describe_your_changes

# 3. Test locally
npm run dev

# 4. Commit the migration files
git add prisma/migrations/
git commit -m "feat: add migration for X"
```

### 2. Production Deployment

#### Option A: Automatic (via GitHub Actions)

1. **Enable AUTO_MIGRATE in GitHub**:
   - Go to Settings → Secrets and variables → Actions → Variables
   - Add `AUTO_MIGRATE = true`

2. **Merge to main**:
   - Migrations run automatically before deployment
   - Check GitHub Actions for status

#### Option B: Manual Trigger (via GitHub Actions)

1. Go to Actions → Deploy Database Migrations
2. Click "Run workflow"
3. Select options:
   - Environment: production/staging
   - Dry run: true (to preview) or false (to apply)

#### Option C: Manual via CLI

```bash
# From your local machine with production DATABASE_URL
cd api
DATABASE_URL="your-prod-db-url" npm run migrate:deploy:safe
```

## Handling Supabase IPv6 Issues

Our setup includes automatic IPv4 forcing to handle Supabase connectivity issues:

1. **All migration scripts use**: `NODE_OPTIONS='--dns-result-order=ipv4first'`
2. **Retry logic**: Automatic 3 retries with 30-second delays
3. **GitHub Actions**: Configured for IPv4 preference

If you still encounter issues:

```bash
# Force IPv4 manually
export NODE_OPTIONS="--dns-result-order=ipv4first"

# Then run your migration
npm run migrate:deploy
```

## Migration Files Structure

```
api/
├── prisma/
│   ├── schema.prisma           # Database schema
│   ├── migrations/              # Migration history
│   │   ├── 20250906_init/
│   │   ├── 20250907_add_email_verification/
│   │   └── migration_lock.toml
│   └── seed.ts                  # Seed data
├── scripts/
│   ├── deploy-migrations.sh    # Deployment script with retry
│   └── check-migrations.js     # Status checker
└── MIGRATIONS.md               # This file
```

## Troubleshooting

### Common Issues

#### 1. "P1001: Can't reach database server"

```bash
# Use the safe deployment script
npm run migrate:deploy:safe

# Or set IPv4 preference manually
export NODE_OPTIONS="--dns-result-order=ipv4first"
npm run migrate:deploy
```

#### 2. "Database schema is not up to date"

```bash
# Check what's pending
npm run migrate:status

# Apply migrations
npm run migrate:deploy:safe
```

#### 3. "Migration already applied"

This is not an error - Prisma tracks applied migrations and skips them.

#### 4. Connection timeouts

The retry scripts will automatically retry 3 times. If it still fails:

1. Check your DATABASE_URL is correct
2. Verify Supabase service is running
3. Try again in a few minutes

### Emergency Rollback

**WARNING**: Only do this if absolutely necessary!

```bash
# Connect to production database
psql $DATABASE_URL

# Check migration history
SELECT * FROM _prisma_migrations ORDER BY started_at DESC;

# Mark a migration as rolled back (replace with actual ID)
UPDATE _prisma_migrations
SET rolled_back_at = NOW()
WHERE id = 'migration_id_here';
```

## Best Practices

1. **Always test migrations locally first**
2. **Use descriptive migration names**: `add_user_verification`, not `update_schema`
3. **Keep migrations small and focused**
4. **Never edit existing migrations** - create new ones
5. **Back up production data before major migrations**
6. **Use the retry scripts for production** (`migrate:deploy:safe`)

## CI/CD Integration

### GitHub Actions Workflows

1. **deploy-api.yml**:
   - Runs migrations automatically on main branch pushes (only if AUTO_MIGRATE=true)
   - Checks the AUTO_MIGRATE repository variable before running
   - Includes retry logic and IPv4 forcing

2. **deploy-migrations.yml**:
   - Manual trigger only (no automatic triggers)
   - Useful for running migrations independently of deployment
   - Includes dry-run option to preview changes

### Setting up AUTO_MIGRATE

To enable automatic migrations on deployment:

1. Go to your GitHub repository
2. Settings → Secrets and variables → Actions
3. Click on "Variables" tab
4. Add new repository variable:
   - Name: `AUTO_MIGRATE`
   - Value: `true` (to enable) or `false` (to disable)

Required secrets (in "Secrets" tab):

- `SUPABASE_DATABASE_URL`: Your Supabase connection string
- `SUPABASE_DIRECT_URL`: Your Supabase direct connection string

**Important**:

- When AUTO_MIGRATE=true, migrations run automatically on every API deployment
- When AUTO_MIGRATE=false, you must run migrations manually via the GitHub Actions UI
- The manual workflow (deploy-migrations.yml) works regardless of AUTO_MIGRATE setting

## Questions?

- Check migration status: `npm run migrate:check`
- View pending migrations: `npm run migrate:status`
- See all commands: `npm run` (in api directory)
