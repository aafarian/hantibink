# OAuth Setup Guide

## Overview

This app uses Google OAuth for authentication. The OAuth Client IDs are stored in EAS Secrets for better team collaboration and security.

## Environment Variables

### Required OAuth Variables

- `EXPO_PUBLIC_GOOGLE_CLIENT_ID_DEV` - Google OAuth Client ID for development
- `EXPO_PUBLIC_GOOGLE_CLIENT_ID_PROD` - Google OAuth Client ID for production

### Where They're Stored

1. **EAS Secrets** (for builds) - Stored in the cloud, accessible to all team members
2. **Local `.env` files** (for local development) - Not committed to git

## Setting Up OAuth for New Developers

### 1. Local Development

Create a `.env` file in the `/mobile` directory with:

```
EXPO_PUBLIC_GOOGLE_CLIENT_ID_DEV="393816901275-0208rvd4b78rj7kupf4j4ol2m71a7nc9.apps.googleusercontent.com"
EXPO_PUBLIC_GOOGLE_CLIENT_ID_PROD="393816901275-0208rvd4b78rj7kupf4j4ol2m71a7nc9.apps.googleusercontent.com"
```

### 2. EAS Builds

The OAuth Client IDs are already configured in EAS Secrets. To view them:

```bash
eas secret:list
```

To update them (if needed):

```bash
eas secret:delete --id [secret-id]
eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_CLIENT_ID_DEV --value "your-client-id"
eas secret:create --scope project --name EXPO_PUBLIC_GOOGLE_CLIENT_ID_PROD --value "your-client-id"
```

## Important Security Notes

### Public vs Secret

- **OAuth Client IDs** (`EXPO_PUBLIC_*`) - These are PUBLIC and safe to expose
- **OAuth Client Secret** - NEVER put this in the mobile app, only on the backend

### Why Client IDs are Safe to Expose

1. They're designed to be public (that's why they're called "Client" not "Secret")
2. Google protects against misuse via:
   - Redirect URI validation
   - Domain verification
   - Rate limiting
3. Every website using Google OAuth exposes their Client ID in the browser

## Google Cloud Console Setup

### Creating OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to APIs & Services > Credentials
3. Create OAuth 2.0 Client ID
4. Configure:
   - **Application type**: Web application (for Expo)
   - **Authorized redirect URIs**:
     - For Expo Go: `https://auth.expo.io/@your-expo-username/your-app-slug`
     - For standalone: `your-app-scheme://` (your custom scheme)
     - For web: Your web app URL

   Note: Replace `@your-expo-username` with your Expo account username and `your-app-slug` with your app's slug from app.json

### Backend Configuration

The API needs both Client ID and Client Secret:

- Set in GitHub Secrets for deployment
- Set in `/api/.env` for local development:

```
GOOGLE_CLIENT_ID="your-client-id"
GOOGLE_CLIENT_SECRET="your-client-secret"
```

## Testing OAuth

### In Development

1. Run the app with `npm start`
2. OAuth will use the dev Client ID from `.env`

### In EAS Builds

1. Build with `eas build --profile development`
2. OAuth will use the Client IDs from EAS Secrets

## Troubleshooting

### "Missing OAuth Configuration" Error

- Check that `.env` file exists locally
- Verify EAS secrets are set: `eas secret:list`

### OAuth Login Fails

- Verify redirect URIs in Google Cloud Console
- Check that Client ID matches between mobile and API
- Ensure API has the Client Secret configured

## Additional Resources

- [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Expo AuthSession Docs](https://docs.expo.dev/versions/latest/sdk/auth-session/)
- [EAS Environment Variables](https://docs.expo.dev/build-reference/variables/)
