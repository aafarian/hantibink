#!/bin/bash

# Deploy migrations with retry logic and IPv4 forcing for Supabase
# Usage: ./scripts/deploy-migrations.sh

set -e

echo "🚀 Starting database migration deployment..."

# Force IPv4 for Node.js to avoid Supabase IPv6 issues
export NODE_OPTIONS="--dns-result-order=ipv4first"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
MAX_RETRIES=3
RETRY_DELAY=30

# Function to run migration with retry
run_migration() {
    local attempt=1
    
    while [ $attempt -le $MAX_RETRIES ]; do
        echo -e "${YELLOW}Attempt $attempt of $MAX_RETRIES...${NC}"
        
        if npx prisma migrate deploy; then
            echo -e "${GREEN}✅ Migration successful on attempt $attempt${NC}"
            return 0
        else
            echo -e "${RED}❌ Migration failed on attempt $attempt${NC}"
            
            if [ $attempt -lt $MAX_RETRIES ]; then
                echo -e "${YELLOW}Retrying in ${RETRY_DELAY} seconds...${NC}"
                sleep $RETRY_DELAY
            fi
        fi
        
        attempt=$((attempt + 1))
    done
    
    echo -e "${RED}❌ Migration failed after $MAX_RETRIES attempts${NC}"
    return 1
}

# Check if we're in the api directory
if [ ! -f "package.json" ] || [ ! -d "prisma" ]; then
    echo -e "${RED}Error: Must be run from the api directory${NC}"
    exit 1
fi

# Check for required environment variables
if [ -z "$DATABASE_URL" ]; then
    echo -e "${YELLOW}Loading environment variables from .env...${NC}"
    if [ -f ".env" ]; then
        export $(cat .env | grep -v '^#' | xargs)
    else
        echo -e "${RED}Error: DATABASE_URL not set and no .env file found${NC}"
        exit 1
    fi
fi

# Show current migration status
echo "📊 Current migration status:"
npx prisma migrate status || true

echo ""
echo "🔄 Running migrations..."

# Run migration with retry logic
if run_migration; then
    echo ""
    echo -e "${GREEN}✅ All migrations deployed successfully!${NC}"
    
    # Show final status
    echo ""
    echo "📊 Final migration status:"
    npx prisma migrate status
    
    # Generate Prisma Client
    echo ""
    echo "🔧 Generating Prisma Client..."
    npx prisma generate
    
    echo -e "${GREEN}✅ Deployment complete!${NC}"
    exit 0
else
    echo -e "${RED}❌ Migration deployment failed!${NC}"
    exit 1
fi