#!/bin/bash

# Script to deploy the current branch to production
# This will trigger the GitHub Actions workflow to deploy and run migrations

echo "🚀 Deploying current branch to production..."
echo "⚠️  This will deploy the CURRENT branch code to production!"
echo ""

# Check current branch
CURRENT_BRANCH=$(git branch --show-current)
echo "📍 Current branch: $CURRENT_BRANCH"
echo ""

# Confirm deployment
read -p "Are you sure you want to deploy '$CURRENT_BRANCH' to production? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "❌ Deployment cancelled"
    exit 1
fi

echo ""
echo "🔄 Pushing current branch to trigger deployment..."
git push origin $CURRENT_BRANCH

echo ""
echo "✅ Branch pushed! GitHub Actions will now:"
echo "  1. Build the Docker image"
echo "  2. Run database migrations"
echo "  3. Deploy to Cloud Run"
echo ""
echo "📊 View deployment progress at:"
echo "https://github.com/antoafarian/hantibink/actions"
echo ""
echo "🔍 View production logs:"
echo "gcloud run services logs read hantibink-api --region=us-west2"