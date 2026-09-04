# Subscription & Monetization System Implementation

## Overview
A comprehensive subscription and monetization system has been implemented for the ParcelPeer application, enabling tiered pricing with automatic platform fee collection.

## Changes Made

### 1. Database Schema Updates (`/app/shared/schema.ts`)

#### New Enums Added:
- `subscriptionTierEnum`: "free", "premium", "business"
- `subscriptionStatusEnum`: "active", "cancelled", "expired", "past_due"

#### Users Table Updates:
Added the following fields to track subscription status:
- `subscriptionTier` - Current subscription tier (default: "free")
- `subscriptionStatus` - Current subscription status (default: "active")
- `subscriptionStartDate` - When subscription started
- `subscriptionEndDate` - When subscription expires
- `paystackCustomerCode` - Paystack customer identifier
- `paystackSubscriptionCode` - Paystack subscription identifier
- `monthlyParcelCount` - Track parcels created this month
- `lastParcelResetDate` - Last time parcel count was reset

#### Payments Table Updates:
Added platform fee tracking:
- `carrierAmount` - Amount carrier receives after platform fee
- `platformFee` - Platform fee amount in kobo
- `platformFeePercentage` - Platform fee percentage applied

#### New Subscriptions Table:
Complete subscription history and management:
- `userId` - Reference to user
- `tier` - Subscription tier
- `status` - Subscription status
- `amount` - Subscription price
- `paystackPlanCode` - Paystack plan identifier
- `paystackSubscriptionCode` - Paystack subscription identifier
- `startDate`, `endDate`, `nextBillingDate`
- `cancelledAt`, `cancellationReason`

### 2. Subscription Utilities (`/app/server/subscription-utils.ts`)

#### Subscription Plans Configuration:
```typescript
SUBSCRIPTION_PLANS = {
  free: {
    price: 0,
    monthlyParcelLimit: 5,
    platformFeePercentage: 10,
  },
  premium: {
    price: 999 NGN (~$0.60),
    monthlyParcelLimit: 20,
    platformFeePercentage: 5,
  },
  business: {
    price: 2999 NGN (~$1.80),
    monthlyParcelLimit: null (unlimited),
    platformFeePercentage: 3,
  }
}
```

#### Helper Functions:
- `canCreateParcel(user)` - Check if user can create more parcels
- `calculatePlatformFee(amount, tier)` - Calculate platform fees
- `shouldResetParcelCount(user)` - Check if monthly reset needed
- `getSubscriptionStatus(user)` - Get user's subscription info

### 3. Backend Storage Updates (`/app/server/storage.ts`)

New methods added:
- `getUserSubscription(userId)` - Get active subscription
- `getSubscription(id)` - Get subscription by ID
- `getSubscriptionByPaystackCode(code)` - Find subscription by Paystack code
- `createSubscription(data)` - Create new subscription
- `updateSubscription(id, updates)` - Update subscription
- `updateUser(id, updates)` - Update user details
- `resetMonthlyParcelCount(userId)` - Reset parcel count
- `incrementParcelCount(userId)` - Increment parcel count

### 4. API Routes (`/app/server/routes.ts`)

#### Updated Endpoints:

**POST /api/parcels** - Now checks subscription limits before creating parcel
- Validates user's subscription status
- Checks monthly parcel limits
- Resets count if needed
- Increments parcel count after creation

**POST /api/payments/initialize** - Now includes platform fees
- Calculates platform fee based on user's tier
- Splits payment between carrier and platform
- Stores fee information in payment record

#### New Subscription Endpoints:

**GET /api/subscriptions/plans**
- Returns all available subscription plans
- Public endpoint, no authentication required

**GET /api/subscriptions/me**
- Returns current user's subscription details
- Includes subscription status, parcels remaining, renewal date
- Requires authentication

**POST /api/subscriptions/subscribe**
- Initialize new subscription purchase
- Creates Paystack transaction
- Creates subscription record
- Body: `{ tier: "premium" | "business" }`

**POST /api/subscriptions/verify/:reference**
- Verify subscription payment
- Updates user's subscription tier
- Activates subscription features

**POST /api/subscriptions/cancel**
- Cancel active subscription
- Disables Paystack recurring billing
- Marks subscription as cancelled
- User keeps access until end of billing period

**POST /api/subscriptions/webhook**
- Handles Paystack webhook events
- Processes subscription renewals
- Handles payment failures
- Updates subscription status automatically

### 5. Platform Fee Implementation

When a payment is initialized:
1. User's subscription tier is retrieved
2. Platform fee is calculated based on tier (10%, 5%, or 3%)
3. Payment is split:
   - `amount` = Total compensation
   - `carrierAmount` = Amount carrier receives
   - `platformFee` = Platform's commission
4. All amounts stored in payment record

### 6. Subscription Enforcement

**Parcel Creation Limits:**
- Free: Maximum 5 parcels per month
- Premium: Maximum 20 parcels per month
- Business: Unlimited parcels

**Monthly Reset:**
- Automatically resets every 30 days
- Tracked per user with `lastParcelResetDate`
- Reset happens on next parcel creation attempt

**Subscription Status Checks:**
- Active subscription required
- Checks expiration date
- Blocks creation if subscription expired or past_due

## Integration Requirements

### Paystack Configuration
You need to configure Paystack plans in your Paystack dashboard:

1. **Premium Plan:**
   - Plan Code: `PLN_premium_monthly`
   - Amount: ₦999 (99,900 kobo)
   - Interval: Monthly

2. **Business Plan:**
   - Plan Code: `PLN_business_monthly`
   - Amount: ₦2,999 (299,900 kobo)
   - Interval: Monthly

### Environment Variables Required
- `PAYSTACK_SECRET_KEY` - Your Paystack secret key
- `DATABASE_URL` - PostgreSQL connection string

### Webhook Configuration
Configure Paystack webhook URL to: `https://your-domain.com/api/subscriptions/webhook`

Events to listen for:
- `subscription.create`
- `charge.success`
- `subscription.disable`
- `invoice.payment_failed`

## Database Migration

To apply the schema changes to your database:

```bash
cd /app
DATABASE_URL="your_database_url" yarn drizzle-kit push
```

Or use the npm script:
```bash
npm run db:push
```

## Testing the Implementation

### 1. Check Available Plans
```bash
curl http://localhost:5000/api/subscriptions/plans
```

### 2. Get User Subscription Status
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/subscriptions/me
```

### 3. Subscribe to Premium
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tier": "premium"}' \
  http://localhost:5000/api/subscriptions/subscribe
```

### 4. Test Parcel Limit
Create parcels as a free user and verify that after 5 parcels, you get:
```json
{
  "error": "You've reached your monthly limit of 5 parcels. Upgrade to Premium or Business for more parcels."
}
```

### 5. Test Platform Fees
Verify payment initialization includes platform fees:
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"parcelId": "xxx", "carrierId": "yyy"}' \
  http://localhost:5000/api/payments/initialize
```

Response should include `platformFee` and `carrierAmount`.

## Next Steps

1. **Database Migration**: Run the migration to apply schema changes
2. **Paystack Setup**: Configure subscription plans in Paystack dashboard
3. **Environment Variables**: Ensure PAYSTACK_SECRET_KEY is set
4. **Webhook Configuration**: Set up webhook URL in Paystack
5. **Frontend Integration**: Create subscription UI screens
6. **Testing**: Test full subscription flow end-to-end
7. **Admin Panel**: Add subscription management to admin panel

## Revenue Model

With this implementation, the platform generates revenue through:

1. **Platform Fees on Transactions:**
   - Free users: 10% of every delivery
   - Premium users: 5% of every delivery
   - Business users: 3% of every delivery

2. **Subscription Revenue:**
   - Premium: ₦999/month per user
   - Business: ₦2,999/month per user

Example monthly revenue with 100 users:
- 60 free users × 10 deliveries × ₦500 avg × 10% = ₦30,000
- 30 premium users × (₦999 + 20 deliveries × ₦500 × 5%) = ₦44,970
- 10 business users × (₦2,999 + 50 deliveries × ₦500 × 3%) = ₦37,490

**Total Monthly Revenue: ₦112,460 (~$67)**

## Files Modified

1. `/app/shared/schema.ts` - Database schema
2. `/app/server/storage.ts` - Storage layer
3. `/app/server/routes.ts` - API routes
4. `/app/server/subscription-utils.ts` - New utility file

## Files Created

1. `/app/server/subscription-utils.ts` - Subscription business logic
2. `/app/SUBSCRIPTION_IMPLEMENTATION.md` - This documentation

---

**Implementation Status:** ✅ Backend Complete
**Database Migration:** ⏳ Pending
**Frontend UI:** ⏳ To be implemented
**Testing:** ⏳ Pending
