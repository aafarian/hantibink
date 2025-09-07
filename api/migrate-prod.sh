#!/bin/bash

# SIMPLE PRODUCTION MIGRATION SCRIPT
# No BS, just works

echo "🚀 Migrating Production Database"
echo "================================"
echo ""

# Check if we have a production URL
if [ -f .env.production ]; then
    echo "✅ Found .env.production"
    source .env.production
else
    echo "❌ No .env.production file found!"
    echo "Create one with your Supabase DATABASE_URL"
    exit 1
fi

# Test connection first
echo "🔍 Testing database connection..."
npx prisma db pull --force --schema=./prisma/test-connection.prisma 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✅ Connection successful!"
    rm -f ./prisma/test-connection.prisma
else
    echo "❌ Cannot connect to database!"
    echo ""
    echo "Your connection string might be wrong. Try:"
    echo "1. Go to Supabase Dashboard"
    echo "2. Settings → Database"
    echo "3. Copy the 'Connection string' (URI tab)"
    echo "4. Put it in .env.production as DATABASE_URL"
    exit 1
fi

# Show what we're about to do
echo ""
echo "📋 Migration Status:"
npx prisma migrate status

echo ""
echo "⚠️  THIS WILL MODIFY YOUR PRODUCTION DATABASE!"
echo "Continue? (yes/no)"
read answer

if [ "$answer" != "yes" ]; then
    echo "Cancelled."
    exit 0
fi

# Run the migration
echo ""
echo "🔄 Running migrations..."
npx prisma migrate deploy

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ MIGRATION SUCCESSFUL!"
    echo ""
    echo "Final status:"
    npx prisma migrate status
else
    echo ""
    echo "❌ MIGRATION FAILED!"
    echo "Check the error above"
fi