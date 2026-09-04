# Firebase Authentication & FCM Setup Guide

## Overview
This application now uses Firebase Authentication with email verification and Firebase Cloud Messaging (FCM) for push notifications.

## Firebase Project Setup

### 1. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name and follow the setup wizard
4. Once created, go to Project Settings

### 2. Enable Authentication
1. In Firebase Console, go to "Authentication" > "Sign-in method"
2. Enable "Email/Password" provider
3. Enable "Google" provider (optional, for Google Sign-In)
   - Add your OAuth 2.0 client IDs for Android and iOS

### 3. Get Web App Credentials
1. In Project Settings, scroll to "Your apps"
2. Click "Add app" and select "Web" (</>) icon
3. Register your app
4. Copy the Firebase configuration object

### 4. Get Service Account Key (for Backend)
1. In Project Settings, go to "Service Accounts" tab
2. Click "Generate new private key"
3. Save the JSON file securely
4. **IMPORTANT:** Never commit this file to version control

### 5. Setup Cloud Messaging
1. In Firebase Console, go to "Cloud Messaging"
2. Note your Sender ID and Server Key
3. For iOS: Upload APNs certificate or key
4. For Android: Configuration is automatic with google-services.json

## Environment Variables

### Backend (.env or production environment)
```bash
# Firebase Admin SDK
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account","project_id":"your-project-id","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n","client_email":"firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com","client_id":"...","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"..."}'

# Note: For service account, either:
# 1. Set FIREBASE_SERVICE_ACCOUNT as single-line JSON string (as shown above)
# 2. Or place firebase-admin.json file in /app/secrets/ and update firebase-admin.ts to read from file
```

### Client (.env or app.json extra)
```bash
EXPO_PUBLIC_FIREBASE_API_KEY=AIzaSy...your-api-key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef...
```

### For EAS Build (app.json)
Add to `app.json` under `expo.extra`:
```json
{
  "expo": {
    "extra": {
      "eas": {
        "projectId": "your-eas-project-id"
      },
      "firebaseApiKey": "AIzaSy...your-api-key",
      "firebaseAuthDomain": "your-project.firebaseapp.com",
      "firebaseProjectId": "your-project-id",
      "firebaseStorageBucket": "your-project.appspot.com",
      "firebaseMessagingSenderId": "123456789012",
      "firebaseAppId": "1:123456789012:web:abcdef..."
    }
  }
}
```

## Database Migration

Run the migration to add FCM token field:
```bash
psql $DATABASE_URL -f /app/migrations/004_add_fcm_token.sql
```

Or if using Drizzle Kit:
```bash
npm run db:push
```

## Testing Authentication Flow

### 1. Sign Up with Email
```bash
# Example: Create new user
POST /api/firebase/sync-user
Headers: Authorization: Bearer <firebase-id-token>
Body: { "name": "John Doe", "phone": "+1234567890" }
```

### 2. Email Verification
- User receives email from Firebase
- Click verification link
- Call `refreshUser()` in client to update emailVerified status

### 3. Sign In
- Client calls Firebase `signInWithEmailAndPassword()`
- Gets ID token
- Backend verifies token with Firebase Admin SDK
- Returns user profile from database

### 4. Push Notifications
```bash
# Register FCM token
POST /api/firebase/fcm-token
Headers: Authorization: Bearer <firebase-id-token>
Body: { "fcmToken": "ExponentPushToken[...]" }

# Test notification
POST /api/firebase/test-notification
Headers: Authorization: Bearer <firebase-id-token>
```

## Client Usage Examples

### Sign Up
```typescript
import { useAuth } from './contexts/AuthContext';

const { signUp } = useAuth();
await signUp('user@example.com', 'password123', 'John Doe', '+1234567890');
```

### Sign In
```typescript
const { signIn } = useAuth();
await signIn('user@example.com', 'password123');
```

### Send Email Verification
```typescript
const { sendEmailVerification } = useAuth();
await sendEmailVerification();
```

### Check Email Verified Status
```typescript
const { user, refreshUser } = useAuth();

// After user clicks verification link
await refreshUser();

if (user?.emailVerified) {
  console.log('Email is verified!');
}
```

### Sign Out
```typescript
const { signOut } = useAuth();
await signOut();
```

## Backend API Endpoints

### Firebase Auth Routes
- `POST /api/firebase/sync-user` - Sync Firebase user with database
- `GET /api/firebase/me` - Get current user profile
- `PUT /api/firebase/profile` - Update user profile
- `POST /api/firebase/fcm-token` - Register FCM token
- `DELETE /api/firebase/fcm-token` - Remove FCM token
- `POST /api/firebase/test-notification` - Send test notification

### Legacy Auth Routes (still available)
- The old JWT-based auth routes are still available for backward compatibility
- Located in `/app/server/auth-routes.ts`

## Security Considerations

1. **Never expose service account keys**
   - Add `firebase-admin.json` to `.gitignore`
   - Use environment variables in production

2. **Token expiration**
   - Firebase ID tokens expire after 1 hour
   - Client should handle token refresh automatically
   - Backend verifies token on each request

3. **Email verification**
   - Use `requireEmailVerified` middleware for sensitive operations
   - Show verification reminder in UI for unverified users

4. **FCM tokens**
   - Tokens are device-specific
   - Update token on app launch
   - Remove token on sign out

## Troubleshooting

### Firebase Admin not initializing
- Check FIREBASE_PROJECT_ID environment variable
- Verify FIREBASE_SERVICE_ACCOUNT JSON format
- Check logs for initialization errors

### Push notifications not working
- Verify device is physical (not emulator)
- Check notification permissions
- Verify FCM token is registered with backend
- Check Firebase Cloud Messaging is enabled

### Email verification not sending
- Verify Firebase Authentication is enabled
- Check email templates in Firebase Console
- Check spam folder

### Google Sign-In issues
- Verify OAuth credentials are configured
- Check SHA-1/SHA-256 fingerprints for Android
- Verify bundle ID for iOS

## Production Deployment

1. Set all environment variables in production
2. Run database migrations
3. Verify Firebase project is in production mode
4. Test authentication flow end-to-end
5. Monitor Firebase Console for usage and errors

## Support

For issues with:
- Firebase setup: Check [Firebase Documentation](https://firebase.google.com/docs)
- Expo notifications: Check [Expo Notifications Docs](https://docs.expo.dev/versions/latest/sdk/notifications/)
- App-specific issues: Check application logs
