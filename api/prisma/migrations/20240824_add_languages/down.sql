-- Rollback: Remove languages column from users table
ALTER TABLE "users" DROP COLUMN IF EXISTS "languages";