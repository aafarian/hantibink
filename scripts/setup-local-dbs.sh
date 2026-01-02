#!/bin/bash

# Script to set up local development, test, and shadow databases
# Run this once when setting up the project locally

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🗄️  Setting up local databases for Hantibink${NC}"
echo "================================================"
echo ""
echo "This script will create three PostgreSQL databases:"
echo "  1. hantibink_dev    - Development database"
echo "  2. hantibink_test   - Test database (for running tests)"
echo "  3. hantibink_shadow - Shadow database (for Prisma migrations)"
echo ""

# Check if PostgreSQL is available
if ! command -v psql &> /dev/null; then
    echo -e "${RED}❌ PostgreSQL (psql) not found. Please install PostgreSQL first.${NC}"
    echo "   On macOS: brew install postgresql@15"
    echo "   On Ubuntu: sudo apt install postgresql"
    exit 1
fi

# Check if PostgreSQL is running
if ! pg_isready -q 2>/dev/null; then
    echo -e "${YELLOW}⚠️  PostgreSQL doesn't seem to be running.${NC}"
    echo "   On macOS: brew services start postgresql@15"
    echo "   On Ubuntu: sudo service postgresql start"
    echo ""
    echo "Attempting to continue anyway..."
fi

# Get PostgreSQL user (default to current user)
PG_USER="${PGUSER:-$(whoami)}"
echo -e "${YELLOW}Using PostgreSQL user: ${PG_USER}${NC}"
echo ""

# Create databases
for DB_NAME in hantibink_dev hantibink_test hantibink_shadow; do
    echo -n "Creating ${DB_NAME}... "

    if psql -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
        echo -e "${YELLOW}already exists${NC}"
    else
        if createdb "$DB_NAME" 2>/dev/null; then
            echo -e "${GREEN}created${NC}"
        else
            echo -e "${RED}failed${NC}"
            echo "   Try running: createdb ${DB_NAME}"
        fi
    fi
done

echo ""
echo -e "${GREEN}✅ Database setup complete!${NC}"
echo ""
echo "Add these to your api/.env file:"
echo "================================="
echo ""
echo "DATABASE_URL=\"postgresql://${PG_USER}@localhost:5432/hantibink_dev\""
echo "DIRECT_URL=\"postgresql://${PG_USER}@localhost:5432/hantibink_dev\""
echo ""
echo "TEST_DATABASE_URL=\"postgresql://${PG_USER}@localhost:5432/hantibink_test\""
echo "TEST_DIRECT_URL=\"postgresql://${PG_USER}@localhost:5432/hantibink_test\""
echo ""
echo "SHADOW_DATABASE_URL=\"postgresql://${PG_USER}@localhost:5432/hantibink_shadow\""
echo ""
echo "================================="
echo ""
echo "Next steps:"
echo "  1. Copy the above into api/.env"
echo "  2. Run: cd api && npx prisma migrate dev"
echo "  3. Run: cd api && NODE_ENV=development node src/scripts/seed.js"
