# Hantibink

A modern dating app connecting the Armenian community worldwide.

## 🏗️ Monorepo Structure

```
hantibink/
├── mobile/          # React Native app (iOS & Android)
├── api/             # Backend API (Node.js/Express) [Coming Soon]
├── shared/          # Shared types, utilities, and constants
├── docs/            # Documentation and guides
└── README.md        # You are here
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI (`npm install -g @expo/cli`)
- iOS Simulator (Mac) or Android Studio

### Mobile App Development

```bash
# Navigate to mobile app
cd mobile

# Install dependencies
npm install

# Start development server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android
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

### Backend (Planned)

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL + Redis
- **Authentication**: JWT + Firebase Admin
- **Real-time**: Socket.io
- **File Storage**: Firebase Storage
- **Deployment**: Docker + AWS/GCP

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

### 🔄 In Development

- **Matching Algorithm**: Smart compatibility scoring
- **Real-time Chat**: Secure messaging system
- **Discovery Feed**: Swipe-based matching interface
- **Premium Features**: Advanced filters and boosts

### 📋 Planned

- **Video Profiles**: Short introduction videos
- **Events Integration**: Community gatherings
- **Cultural Features**: Armenian holidays and traditions
- **Family Connections**: Introduce family friends feature

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
- [API Documentation](./docs/api.md) (Coming Soon)
- [Deployment Guide](./docs/deployment.md) (Coming Soon)
- [Contributing Guidelines](./docs/contributing.md) (Coming Soon)

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
