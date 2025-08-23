# Hantibink

A modern dating app connecting the Armenian community worldwide.

## 🚀 Live Deployment

- **API**: https://hantibink-api-wxmdtvzfzq-uc.a.run.app
- **Database**: Supabase PostgreSQL
- **Storage**: Firebase Storage
- **Authentication**: Firebase Auth

## 🏗️ Monorepo Structure

```
hantibink/
├── mobile/          # React Native app (iOS & Android)
├── api/             # Backend API (Node.js/Express)
├── scripts/         # Deployment and utility scripts
├── docs/            # Documentation and guides
└── README.md        # You are here
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Docker (for testing and local development)
- Expo CLI (`npm install -g @expo/cli`)
- iOS Simulator (Mac) or Android Studio

### Development (from root directory)

```bash
# Install all dependencies
npm run install:all

# Run both API and Mobile app
npm run dev

# Run with tunnel (for device testing)
npm run dev:tunnel

# Run mobile with production API
npm run dev:prod-api
```

### Testing (from root directory)

```bash
# Run API tests (auto-starts test database)
npm test

# Run tests once
npm run test:run

# Run with coverage
npm run test:coverage

# Open test UI
npm run test:ui

# CI mode (full test suite)
npm run test:ci
```

## 📱 Tech Stack

### Mobile App

- **Framework**: React Native with Expo
- **Navigation**: React Navigation 7
- **State Management**: React Context + Hooks
- **Forms**: React Hook Form
- **Authentication**: Firebase Auth
- **Database**: Cloud Firestore
- **Storage**: Firebase Storage
- **Location**: Expo Location API
- **Code Quality**: ESLint + Prettier + Husky

### Backend API

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL (Supabase) with Prisma ORM
- **Authentication**: JWT + Firebase Admin
- **Real-time**: Socket.io
- **File Storage**: Firebase Storage
- **Deployment**: Google Cloud Run (Docker)

## 🎯 Core Features

### ✅ Implemented

- **User Registration & Authentication**
  - Multi-step profile creation
  - Photo upload with validation
  - Privacy-focused location detection
  - Form validation and error handling

- **Profile Management**
  - Comprehensive user profiles
  - Multiple photo support
  - Preference settings
  - Language selection (Western/Eastern Armenian)

- **Location Services**
  - GPS-based location detection
  - City-level privacy (no exact addresses)
  - Multiple location options selection
  - Automatic reverse geocoding

- **Code Quality & Development**
  - Production-ready error handling
  - Centralized logging system
  - Auto-formatting on save
  - Pre-commit hooks
  - Environment variable security

- **Backend API**
  - RESTful API with Express
  - Database with Prisma ORM
  - Real-time messaging with Socket.IO
  - Rate limiting and security middleware
  - Deployed to Google Cloud Run

- **Matching System**
  - Like/dislike functionality
  - Mutual match detection
  - Liked You page
  - Discovery feed with filters

- **Real-time Features**
  - Instant messaging
  - Online status indicators
  - Typing indicators
  - Match notifications

### 🔄 In Development

- **Push Notifications**: Firebase Cloud Messaging
- **Premium Features**: Advanced filters and boosts
- **Video Profiles**: Short introduction videos

### 📋 Planned

- **Events Integration**: Community gatherings
- **Cultural Features**: Armenian holidays and traditions
- **Family Connections**: Introduce family friends feature
- **Voice Notes**: Audio messages in chat

## 🔧 Development

### Environment Setup

1. **Clone and setup**:

   ```bash
   git clone <repo-url>
   cd hantibink
   cd mobile
   cp .env.example .env
   # Fill in your Firebase and API keys
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Start development**:
   ```bash
   npm start
   ```

### Code Quality

- **Linting**: ESLint with React Native rules
- **Formatting**: Prettier with consistent style
- **Pre-commit**: Automatic formatting and linting
- **Error Handling**: Error boundaries and graceful fallbacks

## 📚 Documentation

- [Mobile App Setup](./mobile/README.md)
- [Mobile App Installation](./docs/MOBILE_APP_INSTALL.md)
- [CI/CD Setup Guide](./docs/CI_CD_SETUP.md)
- [API Documentation](./api/README.md)
- [Database Schema](./api/prisma/schema.prisma)

## 🔐 Security & Privacy

- Environment variables for all sensitive data
- Privacy-focused location handling (city-level only)
- Secure authentication with Firebase
- No hardcoded API keys in repository

## 🤝 Contributing

This is currently a private repository. For contribution guidelines and development setup, see [CONTRIBUTING.md](./docs/contributing.md).

## 📄 License

Private - All rights reserved.

---

**Built with ❤️ for the Armenian community**
