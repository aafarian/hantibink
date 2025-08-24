-- Migration: Add languages column to users table
-- Up: Apply this migration
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "languages" TEXT[] DEFAULT ARRAY[]::TEXT[];
