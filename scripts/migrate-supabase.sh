#!/bin/bash

# Script to migrate Supabase database
# You need to provide your Supabase connection string

set -e  # Exit on any error

echo "🔄 Migrating Supabase database..."
echo ""
echo "⚠️  IMPORTANT: You need to provide your Supabase connection string"
echo "You can find this in:"
echo "1. Supabase Dashboard > Settings > Database"
echo "2. GitHub Secrets (SUPABASE_DATABASE_URL)"
echo ""
echo "Enter your Supabase DATABASE_URL:"
read -s DATABASE_URL

echo ""
echo "Enter your Supabase DIRECT_URL (or press Enter to use same as DATABASE_URL):"
read -s DIRECT_URL

if [ -z "$DIRECT_URL" ]; then
  DIRECT_URL=$DATABASE_URL
fi

# Export the variables
export DATABASE_URL
export DIRECT_URL

# Navigate to API directory
cd api || { echo "❌ Error: api directory not found"; exit 1; }

# Generate Prisma client
echo "📦 Generating Prisma client..."
npx prisma generate || { echo "❌ Failed to generate Prisma client"; exit 1; }

# Check migration status first
echo "📊 Checking migration status..."
npx prisma migrate status || { echo "❌ Failed to check migration status"; exit 1; }

echo ""
echo "Do you want to apply migrations? (y/n)"
read -r response

if [[ "$response" == "y" ]]; then
  echo "🚀 Deploying migrations to Supabase..."
  npx prisma migrate deploy || { echo "❌ Failed to deploy migrations"; exit 1; }

  echo ""
  echo "✅ Migration completed!"

  # Show final status
  echo "📊 Final migration status:"
  npx prisma migrate status
else
  echo "❌ Migration cancelled"
fi

echo "Done!"
