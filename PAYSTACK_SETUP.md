# Paystack Payment Integration - Setup Complete

## Changes Made

### 1. Environment Configuration
Created `/app/.env` with:
- `PAYSTACK_SECRET_KEY`: Your test secret key
- `PAYSTACK_PUBLIC_KEY`: Your test public key  
- `EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY`: Public key accessible in React Native
- `EXPO_PUBLIC_DOMAIN`: App domain for API calls
- Database and Firebase configuration

### 2. Frontend Fixes (`/app/client/screens/CheckoutScreen.tsx`)

**Issues Fixed:**
- ❌ Was using `process.env.EXPO_PUBLIC_DOMAIN` directly (doesn't work in React Native)
- ❌ Was passing `user.uid` as Bearer token instead of Firebase ID token
- ❌ Missing proper error handling

**Changes:**
- ✅ Now uses `getApiUrl()` helper from query-client for consistent API URL
- ✅ Gets Firebase auth token properly with `await user.getIdToken()`
- ✅ Added proper error logging with `console.error`
- ✅ Better error messages for debugging

### 3. Backend Fixes (`/app/server/routes.ts`)

**Issues Fixed:**
- ❌ `PAYSTACK_SECRET_KEY` accessed without validation
- ❌ Callback URL was using wrong environment variable
- ❌ No proper error handling for missing config

**Changes:**
- ✅ Added validation for `PAYSTACK_SECRET_KEY` before use
- ✅ Callback URL now dynamically constructed from request headers
- ✅ Proper error responses when configuration is missing
- ✅ Better logging for debugging

## Payment Flow

1. **User initiates payment** in CheckoutScreen
2. **Frontend calls** `/api/payments/initialize` with:
   - Amount (parcel compensation)
   - User email
   - Metadata (parcelId, userId)
   - Firebase auth token in Authorization header

3. **Backend validates** Firebase token and initializes Paystack transaction
4. **Paystack returns** authorization URL
5. **Frontend opens** browser with Paystack payment page
6. **User completes** payment on Paystack
7. **Browser redirects** to callback URL
8. **Frontend verifies** payment with `/api/payments/verify/:reference`
9. **Backend updates** parcel status to "Paid"

## Testing the Integration

### Prerequisites
1. Ensure server is running: `npm run server:dev`
2. Ensure you have a test parcel created in the app
3. User must be authenticated with Firebase

### Test Payment
1. Navigate to a parcel in the Browse screen
2. Tap on the parcel to view details
3. Tap "Checkout" or "Pay Now" button
4. Select "Card Payment" (Paystack)
5. Tap "Proceed to Payment"
6. Browser opens with Paystack payment page
7. Use Paystack test cards:
   - **Success**: 4084084084084081 (CVV: 408, Expiry: any future date)
   - **Insufficient funds**: 4084084084084081 (PIN: 0000)
   - **Failed**: 5060666666666666666

### Verify Payment
After payment, check:
- Payment record created in database
- Parcel status updated to "Paid"
- Payment history accessible via `/api/payments/history`
- Receipt available via `/api/payments/:paymentId/receipt`

## Environment Variables Required

```bash
# Required for Paystack
PAYSTACK_SECRET_KEY=sk_test_xxxxx  # ✅ Set
PAYSTACK_PUBLIC_KEY=pk_test_xxxxx  # ✅ Set

# Required for database
DATABASE_URL=postgresql://...       # ⚠️ Needs valid PostgreSQL connection

# Auto-configured
EXPO_PUBLIC_DOMAIN=...              # ✅ Set
EXPO_PUBLIC_FIREBASE_API_KEY=...   # ✅ Set (from .replit)
```

## API Endpoints

### POST `/api/payments/initialize`
Initialize a Paystack payment transaction

**Headers:**
- `Authorization: Bearer <firebase-id-token>`
- `Content-Type: application/json`

**Body:**
```json
{
  "amount": 5000,
  "email": "user@example.com",
  "metadata": {
    "parcelId": "parcel-uuid",
    "userId": "user-uid"
  }
}
```

**Response:**
```json
{
  "authorization_url": "https://checkout.paystack.com/...",
  "access_code": "...",
  "reference": "..."
}
```

### GET `/api/payments/verify/:reference`
Verify a payment transaction

**Headers:**
- `Authorization: Bearer <firebase-id-token>`

**Response:**
```json
{
  "status": true,
  "data": {
    "status": "success",
    "reference": "...",
    "amount": 500000,
    "metadata": { ... }
  }
}
```

### POST `/api/payments/webhook`
Paystack webhook for payment notifications (called by Paystack)

**Headers:**
- `x-paystack-signature`: HMAC SHA512 signature

### GET `/api/payments/history`
Get payment history for authenticated user

### GET `/api/payments/:paymentId/receipt`
Generate HTML receipt for a payment

## Troubleshooting

### Payment initialization fails
- ✅ Check PAYSTACK_SECRET_KEY is set in environment
- ✅ Verify Firebase auth token is valid
- ✅ Check network connectivity to Paystack API
- ✅ Review server logs for detailed errors

### Payment verification fails
- ✅ Ensure user completes payment in browser
- ✅ Check Paystack dashboard for transaction status
- ✅ Verify callback URL is accessible
- ✅ Check webhook endpoint is properly configured

### Database errors
- ⚠️ Ensure DATABASE_URL is valid
- ⚠️ Run migrations: `npm run db:push`
- ⚠️ Check PostgreSQL is running

## Next Steps

1. **Test with real money**: Update to live keys when ready
   - Replace `sk_test_*` with `sk_live_*`
   - Replace `pk_test_*` with `pk_live_*`
   - Configure webhook URL in Paystack dashboard

2. **Set up webhooks**: Configure in Paystack dashboard
   - Webhook URL: `https://your-domain.com/api/payments/webhook`
   - Events: `charge.success`

3. **Database setup**: Ensure PostgreSQL is properly configured
   - Get valid DATABASE_URL from Replit or external provider
   - Run migrations to create tables

## Security Notes

- ✅ Secret key is never exposed to frontend
- ✅ All payment endpoints require Firebase authentication
- ✅ Webhook signatures are verified
- ⚠️ Ensure HTTPS is used in production
- ⚠️ Store environment variables securely
