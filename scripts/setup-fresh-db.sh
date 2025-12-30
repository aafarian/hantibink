#!/bin/bash

# Script to set up a fresh database with the new schema
# This will drop the existing database and create a new one

set -e

echo "⚠️  WARNING: This will DELETE all existing data!"
echo "Are you sure you want to continue? (yes/no)"
read -r response

if [ "$response" != "yes" ]; then
  echo "Aborted."
  exit 1
fi

cd "$(dirname "$0")/../api"

echo "📦 Generating Prisma Client..."
npx prisma generate

echo "🗄️  Resetting database (this will drop all data)..."
npx prisma migrate reset --force

echo "🌱 Running migrations..."
npx prisma migrate deploy

echo "✅ Database setup complete!"
echo ""
echo "Next steps:"
echo "1. Run the deployment script: ./scripts/deploy-api.sh"
echo "2. Set environment variables: ./scripts/setup-env-vars.sh"