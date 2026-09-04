# API Configuration for Android App

## Backend URL Configuration

Your app needs to know where to send API requests.

### Current Backend
- **Production URL**: https://going-that-way--annasuarez2.replit.app/app/browse

## How to Configure

### Option 1: Environment Variables (Recommended)
Create a `.env` file in the root directory:

```env
VITE_API_URL=https://going-that-way--annasuarez2.replit.app/app/browse
VITE_API_BASE=https://going-that-way--annasuarez2.replit.app
```

Then in your code:
```typescript
const API_URL = import.meta.env.VITE_API_URL;
```

### Option 2: Hard-coded (Temporary)
Find where API calls are made and update:

Look for files that might have `axios`, `fetch`, or `api` in the name:
- `web/src/services/api.ts`
- `web/src/lib/api.ts`
- `web/src/utils/fetch.ts`
- `web/src/main.tsx`

Update URLs from `localhost` to your backend:
```typescript
// Before
const BASE_URL = "http://localhost:5000";

// After
const BASE_URL = "https://going-that-way--annasuarez2.replit.app";
```

## CORS Configuration

If your backend doesn't accept requests from the Android app:

In your Express server (`server/index.ts`), ensure CORS is enabled:

```typescript
import cors from 'cors';

app.use(cors({
  origin: "*", // Allow all origins during development
  credentials: true
}));
```

Or be more specific:
```typescript
app.use(cors({
  origin: ["https://going-that-way--annasuarez2.replit.app", "capacitor://localhost"],
  credentials: true
}));
```

## Testing API Connectivity

### From Device/Emulator
1. Open Android Studio Logcat (bottom of editor)
2. Filter by your package name: `com.gtw.irgadgets`
3. Look for network errors
4. Check response codes (200 = OK, 4xx = client error, 5xx = server error)

### Manual Test
```bash
# Test backend is accessible
curl https://going-that-way--annasuarez2.replit.app/api/health

# Should return some response
```

## Common Issues

### Issue: "net::ERR_CLEARTEXT_NOT_PERMITTED"
- Android requires HTTPS for non-local addresses
- Use HTTPS URL (you are already using it)
- If testing locally, use `http://192.168.x.x:PORT` and add to Android config

### Issue: "net::ERR_INTERNET_DISCONNECTED"
- Emulator can't reach network
- Use actual device or configure emulator network

### Issue: CORS Errors
- Backend doesn't allow requests from your app
- Configure CORS on backend (see above)
- Add `capacitor://localhost` to allowed origins

### Issue: "Connection Refused"
- Backend server not running
- Ensure backend is deployed and accessible
- Test URL in browser first

## Rebuild After Changes

After changing API configuration:

```bash
# Rebuild web app
npm run web:build

# Sync changes to Android
npx cap sync

# In Android Studio: Build → Clean Build Folder then Run
```

## Environment-Specific URLs

For flexibility, use environment-based URLs:

```typescript
const CONFIG = {
  development: {
    API_URL: "http://192.168.1.100:5000",
  },
  production: {
    API_URL: "https://going-that-way--annasuarez2.replit.app",
  },
};

const API_URL = import.meta.env.PROD 
  ? CONFIG.production.API_URL 
  : CONFIG.development.API_URL;
```

---

**Summary**: Update `VITE_API_URL` or your API client to use the backend URL, rebuild the web app, sync to Android, and test!
