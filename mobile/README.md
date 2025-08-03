# Hantibink Mobile App

React Native mobile application for iOS and Android.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start Expo development server
npm start

# Run on specific platforms
npm run ios        # iOS Simulator
npm run android    # Android Emulator
npm run web        # Web browser (for testing)
```

## 📱 Development

### Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g @expo/cli`)
- iOS Simulator (macOS) or Android Studio

### Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required variables:

- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- And other Firebase config values

### Available Scripts

```bash
npm start          # Start Expo development server
npm run ios        # Open iOS Simulator
npm run android    # Open Android Emulator
npm run web        # Open in web browser
npm run lint       # Run ESLint
npm run lint:fix   # Fix ESLint issues
npm run prettier   # Check Prettier formatting
npm run format     # Format code with Prettier + ESLint
```

### Code Quality

- **Auto-formatting on save** (configured in `.vscode/settings.json`)
- **Pre-commit hooks** with Husky and lint-staged
- **ESLint + Prettier** for consistent code style
- **Error boundaries** for graceful error handling

## 🏗️ Project Structure

```
mobile/
├── App.js                 # Root component
├── app.json              # Expo configuration
├── assets/               # Images, fonts, etc.
├── src/
│   ├── components/       # Reusable UI components
│   │   ├── forms/       # Form step components
│   │   └── ...
│   ├── contexts/        # React Context providers
│   ├── hooks/           # Custom React hooks
│   ├── navigation/      # Navigation configuration
│   ├── screens/         # Screen components
│   │   ├── auth/       # Authentication screens
│   │   └── ...
│   ├── services/        # API and external services
│   ├── utils/           # Utility functions
│   └── config/          # Configuration files
├── .env.example         # Environment variables template
├── .eslintrc.js        # ESLint configuration
├── .prettierrc.js      # Prettier configuration
└── package.json        # Dependencies and scripts
```

## 🔧 Key Features

### Authentication

- Multi-step registration process
- Firebase Authentication integration
- Profile photo upload
- Form validation with React Hook Form

### Location Services

- Privacy-focused GPS location
- Automatic reverse geocoding
- City-level location display
- Multiple location options

### Code Quality

- Centralized logging system
- Error boundaries
- Type safety with prop validation
- Consistent code formatting

## 🐛 Debugging

### Common Issues

1. **Metro bundler issues**:

   ```bash
   npx expo start --clear
   ```

2. **iOS Simulator not opening**:

   ```bash
   npx expo run:ios
   ```

3. **Environment variables not loading**:
   - Restart Expo dev server after changing .env
   - Ensure variables start with `EXPO_PUBLIC_`

### Logs

- Development logs are automatically handled by Logger utility
- Production errors are caught by Error Boundaries
- Location logs show city-level info only (privacy-focused)

## 📝 Development Notes

- Uses Expo managed workflow for easier development
- Location services require device permissions
- Photos are stored locally during development
- Firebase configuration required for authentication and storage

## 🔗 Related

- [Root README](../README.md) - Monorepo overview
- [API Documentation](../docs/api.md) - Backend API (coming soon)
