#!/bin/bash

# Script to run Prisma migrations on production database
# This connects to the production database and applies pending migrations

set -e  # Exit on any error

echo "🔄 Running production database migrations..."

# Load production environment variables
if [ ! -f api/.env.production ]; then
  echo "❌ Error: api/.env.production not found"
  exit 1
fi
export $(cat api/.env.production | grep DATABASE_URL | xargs)

# Navigate to API directory
cd api || { echo "❌ Failed to navigate to api directory"; exit 1; }

# Generate Prisma client
echo "📦 Generating Prisma client..."
npx prisma generate || { echo "❌ Failed to generate Prisma client"; exit 1; }

# Deploy migrations to production
echo "🚀 Deploying migrations to production database..."
npx prisma migrate deploy || { echo "❌ Failed to deploy migrations"; exit 1; }

echo "✅ Production migrations completed!"

# Show current migration status
echo "📊 Current migration status:"
npx prisma migrate status

echo "Done!"
