# Prisma Migration Workflow (Automated)

> **Updated**: November 23, 2025
> **Status**: ✅ Fully Automated

## Overview

Database migrations are now **fully automated** using Prisma. When you merge to main, migrations automatically apply to production. No manual SQL scripts needed!

---

## Creating Migrations (Development)

### Step 1: Edit Schema

```bash
# Edit your Prisma schema file
code api/prisma/schema.prisma

# Example: Add a new field to User model
model User {
  // ... existing fields
  preferences  Json?  // New field
}
```

### Step 2: Create Migration

```bash
cd api

# Interactive migration creator (recommended)
npm run db:migrate:create

# You'll be prompted:
# > Enter migration name (e.g., "add user preferences"):

# This creates a timestamped migration folder:
# prisma/migrations/20251124120000_add_user_preferences/migration.sql
```

**Alternative commands**:

```bash
# Standard Prisma migrate dev
npm run db:migrate:dev

# Create migration without applying (advanced)
npm run migrate:create
```

### Step 3: Test Locally

```bash
# Start your local API
npm run dev

# Test that your changes work
# Check database in browser:
npm run db:studio
```

### Step 4: Commit Migration Files

```bash
# Add migration files to Git
git add prisma/migrations/
git add prisma/schema.prisma

# Commit with descriptive message
git commit -m "feat: add user preferences to profile"

# Push to your feature branch
git push origin feature/user-preferences
```

### Step 5: Merge to Main

```bash
# Create PR on GitHub
# Get approval from team
# Merge to main

# 🚀 GitHub Actions automatically:
#  1. Checks migration status
#  2. Deploys migrations to production database
#  3. Updates _prisma_migrations table
#  4. Builds and deploys updated API to Cloud Run
```

---

## What Happens Automatically

When you merge to main with new migrations:

```
Merge to Main
     ↓
GitHub Actions Triggered
     ↓
Checkout Code
     ↓
Set up Node.js 18
     ↓
Install Dependencies
     ↓
Generate Prisma Client
     ↓
Check Migration Status
     ↓
Deploy Migrations ← npx prisma migrate deploy
     ↓
Build Docker Image
     ↓
Deploy to Cloud Run
     ↓
✅ Done!
```

**Concurrency Protection**: If multiple PRs are merged quickly, migrations run sequentially (no conflicts).

**Failure Handling**: If migration fails, deployment is cancelled automatically.

---

## Checking Migration Status

```bash
cd api

# See what migrations are pending/applied
npm run db:migrate:status

# Example output:
# ✓ 20251124060948_baseline
# ✓ 20251124120000_add_user_preferences
# ⚠ 1 migration has not yet been applied:
#   20251124140000_add_messaging_reactions
```

---

## Available Commands

```bash
# Create migration (interactive CLI)
npm run db:migrate:create

# Standard Prisma commands
npm run db:migrate:dev      # Create + apply migration locally
npm run db:migrate:deploy   # Apply pending migrations (prod)
npm run db:migrate:status   # Check migration status

# Database utilities
npm run db:generate         # Regenerate Prisma Client
npm run db:studio          # Open Prisma Studio (database browser)
npm run db:seed            # Seed database with test data
```

---

## Migration Best Practices

### ✅ DO

- **Always use** `npm run db:migrate:create` for new migrations
- **Test locally** before pushing to main
- **Make migrations backward-compatible** when possible
- **Use descriptive names**: "add_user_preferences" not "update_schema"
- **Commit migration files** to Git immediately
- **Review generated SQL** in the migration.sql file

### ❌ DON'T

- ❌ Run manual SQL against production database
- ❌ Edit migration files after they're created
- ❌ Use `prisma db push` in production (dev only)
- ❌ Skip committing migration files
- ❌ Delete old migrations (breaks migration history)
- ❌ Make breaking changes without a plan

---

## Multi-Step Migrations (For Breaking Changes)

When making breaking changes (like renaming a column with data):

### Step 1: Add New Column

```prisma
model User {
  oldField String?  // Keep temporarily
  newField String?  // Add new column
}
```

```bash
npm run db:migrate:create
# Name: "add_new_field"
```

### Step 2: Backfill Data (Manual SQL)

```sql
-- In the migration file, add:
UPDATE users SET newField = oldField WHERE oldField IS NOT NULL;
```

### Step 3: Make Required & Remove Old

```prisma
model User {
  newField String  // Now required
  // oldField removed
}
```

```bash
npm run db:migrate:create
# Name: "remove_old_field"
```

---

## Emergency: Manual Migration

**⚠️ Only use if automated migration fails**

### If Migration Fails in GitHub Actions

1. **Check the error logs**:
   - Go to GitHub → Actions → deploy-api workflow
   - Check the "Deploy Database Migrations" step
   - Note the error message

2. **Fix the issue**:

   ```bash
   # Option 1: Fix the migration file locally
   # Edit the migration SQL, commit, and push

   # Option 2: Revert the migration
   # Delete the migration folder, commit, and push
   ```

3. **Manual deployment** (last resort):

   ```bash
   cd api
   # Use production env
   cp .env.production .env.temp
   cp .env.production .env

   # Deploy manually
   NODE_OPTIONS="--dns-result-order=ipv4first" npx prisma migrate deploy

   # Restore local env
   mv .env.temp .env
   ```

---

## Migration History

### Migration 0 (Baseline)

- **Date**: November 24, 2025
- **ID**: `20251124060948_baseline`
- **Purpose**: Established baseline schema as source of truth
- **Status**: ✅ Applied

All previous migrations were archived and a clean baseline was created. Future migrations build on this foundation.

---

## Troubleshooting

### "Migration has already been applied"

This is normal if the migration was already applied. GitHub Actions will skip it.

### "Migration failed to apply"

Check the migration SQL for syntax errors. Prisma generates the SQL, but you can edit it if needed.

### "Cannot reach database server"

Check that:

- SUPABASE_DATABASE_URL secret is correct in GitHub
- DIRECT_URL secret is correct
- Supabase database is running

### "Schema is not in sync"

Run:

```bash
npx prisma migrate status
# Follow the suggested commands to resolve
```

---

## Quick Reference

| Task             | Command                     |
| ---------------- | --------------------------- |
| Create migration | `npm run db:migrate:create` |
| Check status     | `npm run db:migrate:status` |
| View database    | `npm run db:studio`         |
| Deploy to prod   | Merge to main (automatic)   |
| Manual deploy    | `npm run db:migrate:deploy` |

---

## Resources

- **Comprehensive Plan**: `docs/UPDATED_COMPREHENSIVE_PLAN_2025.md`
- **Prisma Docs**: https://www.prisma.io/docs/orm/prisma-migrate
- **GitHub Workflow**: `.github/workflows/deploy-api.yml`

---

**🎉 No more manual SQL! Everything is automated and tracked properly.**
