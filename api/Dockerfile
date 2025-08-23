# Production Dockerfile optimized for Google Cloud Run
# Build Prisma on native platform to avoid QEMU issues
FROM --platform=$BUILDPLATFORM node:18-slim AS prisma-builder

WORKDIR /app

# Copy package files and install Prisma
COPY package*.json ./
RUN npm install @prisma/client prisma

# Copy prisma schema
COPY prisma ./prisma

# Generate Prisma client for multiple targets
RUN npx prisma generate

# Main builder stage
FROM node:18-slim AS builder

# Install OpenSSL (required for Prisma)
RUN apt-get update -y && \
    apt-get install -y openssl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy everything for build
COPY . .

# Production stage
FROM node:18-slim

# Install OpenSSL for runtime
RUN apt-get update -y && \
    apt-get install -y openssl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# Copy application from builder
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src

# Copy generated Prisma client from native builder
COPY --from=prisma-builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=prisma-builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Create non-root user
RUN useradd -m -u 1001 nodejs && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 8080

CMD ["node", "src/server.js"]