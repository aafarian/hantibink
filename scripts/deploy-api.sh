#!/bin/bash

# Hantibink API Deployment Script
# This script deploys the API to Google Cloud Run

set -e  # Exit on error

# Source gcloud if available
if [ -f /opt/homebrew/share/google-cloud-sdk/path.zsh.inc ]; then
  source /opt/homebrew/share/google-cloud-sdk/path.zsh.inc
fi

# Configuration
PROJECT_ID="hantibink"
SERVICE_NAME="hantibink-api"
REGION="us-west2"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Deploying Hantibink API to Google Cloud Run${NC}"
echo "================================================"

# Change to API directory
cd "$(dirname "$0")/../api"

# Generate Prisma client locally first (for development)
echo -e "${YELLOW}🔧 Generating Prisma client locally...${NC}"
npx prisma generate

# Setup buildx with cloud-native builder
echo -e "${YELLOW}🔧 Setting up Docker buildx...${NC}"
docker buildx create --name cloud-builder --driver docker-container --use 2>/dev/null || docker buildx use cloud-builder

# Build and push Docker image with buildx (single command for efficiency)
echo -e "${YELLOW}📦 Building and pushing Docker image with buildx...${NC}"
docker buildx build \
  --platform linux/amd64 \
  --tag ${IMAGE_NAME}:latest \
  --push \
  --cache-from type=registry,ref=${IMAGE_NAME}:buildcache \
  --cache-to type=registry,ref=${IMAGE_NAME}:buildcache,mode=max \
  .

# Deploy to Cloud Run
echo -e "${YELLOW}🚀 Deploying to Cloud Run...${NC}"
gcloud run deploy ${SERVICE_NAME} \
  --image ${IMAGE_NAME}:latest \
  --platform managed \
  --region ${REGION} \
  --allow-unauthenticated \
  --min-instances 1 \
  --max-instances 100 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300 \
  --port 8080

# Get the service URL
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format 'value(status.url)')

echo -e "${GREEN}✅ Deployment complete!${NC}"
echo -e "Service URL: ${SERVICE_URL}"
echo ""
echo "To view logs:"
echo "  gcloud run services logs read ${SERVICE_NAME} --region ${REGION}"
echo ""
echo "To set environment variables:"
echo "  gcloud run services update ${SERVICE_NAME} --region ${REGION} --set-env-vars KEY=VALUE"