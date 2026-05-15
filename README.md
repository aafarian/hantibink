# Hantibink

A modern dating app connecting the Armenian community worldwide.

## Architecture

```
hantibink/
├── mobile/          # React Native app (Expo)
├── api/             # Node.js/Express backend
├── scripts/         # Dev and deployment scripts
└── CLAUDE.md        # AI assistant guidelines
```

| Layer        | Dev              | Production          |
| ------------ | ---------------- | ------------------- |
| **Mobile**   | Expo Dev Client  | EAS Build (APK/IPA) |
| **API**      | localhost:4242   | Google Cloud Run    |
| **Database** | Local PostgreSQL | Supabase            |
| **Storage**  | Firebase Storage | Firebase Storage    |

---

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL (local)
- Expo CLI: `npm install -g @expo/cli`
- EAS CLI: `npm install -g eas-cli`

### 1. Clone & Install

```bash
git clone <repo-url>
cd hantibink
npm run install:all
```

### 2. Set Up Local Database

```bash
# Create local databases
npm run setup:db

# Or manually:
createdb hantibink_dev
createdb hantibink_test
```

### 3. Configure Environment

```bash
# API environment
cp api/.env.example api/.env
# Edit api/.env with your local PostgreSQL credentials
```

### 4. Run Migrations

```bash
cd api
npx prisma migrate deploy
npx prisma generate
```

### 5. Start Development

```bash
# From root - starts both API and mobile
npm run dev
```

This will:

- Auto-detect your local IP
- Start API on port 4242
- Start Expo Metro bundler
- Show QR code to connect your phone

---

## Development Workflow

### Daily Development

```bash
# Start everything (API + Mobile)
npm run dev

# Or start separately:
npm run api          # API only
cd mobile && npm start  # Mobile only
```

### Running Tests

```bash
npm test             # Run all tests
npm run test:coverage # With coverage report
```

### Linting

```bash
npm run lint         # Check all
npm run lint:fix     # Auto-fix issues
```

---

## Building Apps

### Development Build (for testing new native features)

Development builds include the Expo dev client and connect to your local API.

```bash
# Android
npm run build:dev

# iOS
npm run build:dev:ios
```

After building:

1. Download the APK/IPA from EAS
2. Install on your device
3. Run `npm run dev` on your computer
4. Open the app - it will connect to your local API

### Production Build (for release)

Production builds connect to Cloud Run API and Supabase.

```bash
# Android
npm run build:prod

# iOS
npm run build:prod:ios
```

---

## Over-the-Air (OTA) Updates

For JS-only changes (no native code changes), use OTA updates instead of full builds:

```bash
cd mobile

# Preview channel (for testing)
npx eas update --branch preview --message "Description of changes"

# Production channel
npx eas update --branch production --message "Description of changes"
```

**When to use OTA vs Full Build:**

- **OTA Update**: JS/styling changes, bug fixes, new screens
- **Full Build**: New native packages, app.config.js changes, SDK upgrades

---

## Deployment

### API Deployment (Cloud Run)

```bash
cd api
./deploy.sh
```

Or manually:

```bash
gcloud run deploy hantibink-api \
  --source . \
  --region us-central1 \
  --allow-unauthenticated
```

### Database Migrations (Production)

```bash
cd api
# Set production DATABASE_URL temporarily
DATABASE_URL="<supabase-url>" npx prisma migrate deploy
```

---

## Environment Separation

| Environment     | Database                            | API            | Mobile Build Profile |
| --------------- | ----------------------------------- | -------------- | -------------------- |
| **Development** | Local PostgreSQL (`hantibink_dev`)  | localhost:4242 | `development`        |
| **Test**        | Local PostgreSQL (`hantibink_test`) | -              | -                    |
| **Production**  | Supabase                            | Cloud Run      | `production`         |

### Key Files

- `api/.env` - Local API config (gitignored)
- `api/.env.example` - Template for new devs
- `mobile/.env.development` - Mobile dev config
- `mobile/.env.production` - Mobile prod config
- `mobile/eas.json` - EAS build profiles

---

## Tech Stack

### Mobile

- React Native + Expo SDK 54
- React Navigation 7
- Socket.IO (real-time messaging)
- Firebase Storage (photos)

### API

- Node.js + Express
- Prisma ORM
- PostgreSQL
- Socket.IO
- JWT Authentication

### Infrastructure

- Google Cloud Run (API hosting)
- Supabase (Production database)
- Firebase (Storage, Push notifications)
- EAS (Mobile builds)

---

## Roadmap

### Completed

- [x] User registration & authentication
- [x] Profile management with photos
- [x] Discovery feed with filters
- [x] Like/dislike/match system
- [x] Real-time messaging
- [x] Online status indicators
- [x] Push notifications
- [x] Google OAuth (native)

### In Progress

- [ ] Registration flow simplification
- [ ] Photo upload improvements
- [ ] Onboarding UX fixes

### Planned

- [ ] Apple Sign-In
- [ ] Premium subscriptions (Stripe)
- [ ] Video profiles
- [ ] Voice messages
- [ ] Events integration
- [ ] Advanced matching algorithm

---

## Useful Commands

```bash
# Development
npm run dev              # Start all services
npm run dev:tunnel       # With ngrok tunnel
npm test                 # Run tests

# Building
npm run build:dev        # Dev APK
npm run build:prod       # Production APK

# Database
npm run setup:db         # Create local databases
npm run migrate:dev      # Run migrations
cd api && npx prisma studio  # Database GUI

# Deployment
cd api && ./deploy.sh    # Deploy API
cd mobile && npx eas update  # OTA update
```

---

## Troubleshooting

### "Database does not exist"

```bash
npm run setup:db
cd api && npx prisma migrate deploy
```

### "Cannot connect to API from phone"

- Ensure phone and computer are on same WiFi
- Check that `npm run dev` shows your correct local IP
- Try `npm run dev:tunnel` for network issues

### "Native module not found" (after adding new package)

```bash
npm run build:dev  # Need a new native build
```

### EAS Build fails with missing secrets

```bash
eas env:list --environment production  # Check what's configured
eas env:create --name VAR_NAME --value "value" --environment production
```

---

## Contributing

See [CLAUDE.md](./CLAUDE.md) for coding standards and guidelines.

---

**Built for the Armenian community**
