# 🚀 Hantibink Development Guide

## 📋 Quick Start

### **Local Development (Recommended)**

```bash
# 1. Install all dependencies
npm run install:all

# 2a. Start both services together (no QR code)
npm run dev

# 2b. OR start services separately (shows QR code)
# Terminal 1: npm run api
# Terminal 2: npm run mobile
```

This will start:

- 📱 **Mobile app** on `http://localhost:19006` (Expo)
- 🚀 **API server** on `http://localhost:3000`

### **Individual Services (Recommended for QR Code)**

```bash
# Terminal 1 - API server
npm run api

# Terminal 2 - Mobile app (shows QR code clearly)
npm run mobile

# API in production mode
npm run api:start
```

### **Quick Development (No QR Code)**

```bash
# Both services together
npm run dev

# Then in the mobile terminal, press 'w' to open web browser
```

### **Web Browser Access**

```bash
# Start mobile app
npm run mobile

# Press 'w' in terminal to open web browser
# Expo will automatically open the correct URL
```

## 🛠️ Development Commands

### **Setup & Installation**

```bash
npm run install:all     # Install all dependencies
npm run clean:all       # Clean and reinstall everything
```

### **Development**

```bash
npm run dev            # Start both mobile + API
npm run mobile         # Mobile app only
npm run mobile:ios     # Mobile on iOS simulator
npm run mobile:android # Mobile on Android emulator
npm run api            # API server with hot reload
npm run api:start      # API server (production mode)
```

### **Code Quality**

```bash
npm run lint           # Lint all code
npm run lint:fix       # Fix linting issues
npm run format         # Format all code
npm run test:all       # Run all tests
```

### **Maintenance**

```bash
npm run deps:check     # Check for outdated dependencies
npm run deps:update    # Update dependencies
npm run security:audit # Security audit
npm run security:fix   # Fix security issues
npm run doctor         # Expo health check
```

## 🏭 Production Deployment

### **Option 1: Docker (Recommended)**

```bash
# Build and start all services
npm run docker:build
npm run docker:up

# View logs
npm run docker:logs

# Stop services
npm run docker:down
```

### **Option 2: Manual Deployment**

```bash
# API Server
cd api
NODE_ENV=production npm start

# Or with PM2 (recommended)
npm install -g pm2
pm2 start src/server.js --name "hantibink-api"
pm2 startup
pm2 save
```

### **Option 3: Cloud Deployment**

#### **Heroku**

```bash
# API deployment
cd api
heroku create hantibink-api
heroku addons:create heroku-postgresql:hobby-dev
heroku addons:create heroku-redis:hobby-dev
git push heroku main
```

#### **Vercel/Netlify**

```bash
# API deployment
cd api
vercel --prod

# Mobile app (web build)
cd mobile
npm run web
# Deploy dist/ folder to your hosting provider
```

## 🐳 Docker Setup

### **Development with Docker**

```bash
# Start all services (API, PostgreSQL, Redis)
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop all services
docker-compose down
```

### **Production Docker**

```bash
# Build production image
docker build -t hantibink-api ./api

# Run production container
docker run -p 3000:3000 \
  -e NODE_ENV=production \
  -e DATABASE_URL="your-db-url" \
  hantibink-api
```

## 📱 Mobile App Deployment

### **Development Testing**

```bash
cd mobile
npm start              # Start Expo dev server
npm run ios           # iOS simulator
npm run android       # Android emulator
```

### **Production Builds**

```bash
cd mobile
npm run build:android    # Android APK/AAB
npm run build:ios        # iOS IPA
npm run submit:android   # Submit to Google Play
npm run submit:ios       # Submit to App Store
```

## 🔧 Environment Configuration

### **Local Development**

1. Copy environment files:

```bash
cp mobile/.env.example mobile/.env
cp api/.env.example api/.env
```

2. Fill in your Firebase configuration in `mobile/.env`
3. Configure API settings in `api/.env`

### **Production Environment**

Set these environment variables:

#### **API Server**

```bash
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
DATABASE_URL="postgresql://user:pass@host:5432/db"
REDIS_URL="redis://host:6379"
JWT_SECRET="your-super-secure-secret"
FIREBASE_PROJECT_ID="your-firebase-project"
# ... other Firebase config
```

#### **Mobile App**

```bash
EXPO_PUBLIC_API_BASE_URL="https://your-api-domain.com"
EXPO_PUBLIC_FIREBASE_PROJECT_ID="your-firebase-project"
# ... other Firebase config
```

## 🚀 Deployment Checklist

### **Before Deploying**

- [ ] All tests passing (`npm run test:all`)
- [ ] Code linted and formatted (`npm run lint` & `npm run format`)
- [ ] Security audit clean (`npm run security:audit`)
- [ ] Environment variables configured
- [ ] Database migrations ready
- [ ] API health checks working (`curl your-api/health`)

### **Production Deployment**

- [ ] SSL certificates configured
- [ ] Database backups scheduled
- [ ] Monitoring and logging set up
- [ ] Error tracking configured (Sentry)
- [ ] Performance monitoring enabled
- [ ] Load balancing configured (if needed)

## 📊 Monitoring & Health Checks

### **API Health Endpoints**

```bash
curl https://your-api.com/health          # Basic health
curl https://your-api.com/health/detailed # Detailed status
curl https://your-api.com/health/ready    # Readiness probe
curl https://your-api.com/health/live     # Liveness probe
```

### **Logs**

```bash
# Docker logs
docker-compose logs -f api

# PM2 logs
pm2 logs hantibink-api

# File logs
tail -f api/logs/combined.log
```

## 🆘 Troubleshooting

### **Common Issues**

#### **Port Already in Use**

```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use different port
PORT=3001 npm run api
```

#### **Dependencies Issues**

```bash
# Clean install
npm run clean:all

# Clear npm cache
npm cache clean --force
```

#### **Database Connection**

```bash
# Check database connection
psql $DATABASE_URL

# Reset database (development only)
npm run db:reset
```

### **Getting Help**

- Check logs: `npm run docker:logs` or `pm2 logs`
- Health check: `curl localhost:3000/health`
- Run diagnostics: `npm run doctor`

---

## 🎯 Next Steps

1. **Set up your environment** using the commands above
2. **Start development** with `npm run dev`
3. **Test the API** at `http://localhost:3000/health`
4. **Test the mobile app** at `http://localhost:19006`
5. **Ready for PR #3: Database Setup!** 🚀
