# ParcelPeer Driver App — Full Specification

> **Document version:** 1.0  
> **Date:** March 2026  
> **Status:** Draft  
> **Related project:** ParcelPeer (The GTW) — Main Sender/Receiver App

---

## Table of Contents

1. [Overview](#1-overview)
2. [Relationship to the Main App](#2-relationship-to-the-main-app)
3. [Integration Architecture](#3-integration-architecture)
4. [Authentication & Identity](#4-authentication--identity)
5. [Shared Backend API](#5-shared-backend-api)
6. [Driver App Feature Specification](#6-driver-app-feature-specification)
7. [Screen-by-Screen Specification](#7-screen-by-screen-specification)
8. [Real-Time Systems](#8-real-time-systems)
9. [Notifications](#9-notifications)
10. [Wallet & Earnings](#10-wallet--earnings)
11. [Verification & Trust](#11-verification--trust)
12. [Offline & Background Behaviour](#12-offline--background-behaviour)
13. [Tech Stack](#13-tech-stack)
14. [Navigation Structure](#14-navigation-structure)
15. [Data Models Used](#15-data-models-used)
16. [Environment & Configuration](#16-environment--configuration)
17. [Development Roadmap](#17-development-roadmap)

---

## 1. Overview

The **ParcelPeer Driver App** is a standalone mobile application built exclusively for **Carriers** — individuals who travel between cities or towns and earn money by transporting parcels for senders along their routes.

The Driver App is the **counterpart** to the existing ParcelPeer (The GTW) app, which serves Senders and Receivers. While the main app allows users to post parcels and find carriers, the Driver App provides a focused, purpose-built interface for drivers to manage their trips, discover matching parcels, track deliveries, and get paid — all without the noise of sender-facing features.

### Core Value Propositions

| Value | Description |
|---|---|
| **Earn on every trip** | Drivers post their travel routes and the system surfaces parcels that fit, turning any journey into income. |
| **No detours needed** | Intelligent matching only shows parcels that align with the driver's existing travel plan. |
| **Simple delivery flow** | Guided pickup → transit → proof of delivery workflow keeps drivers on track. |
| **Instant wallet payouts** | Compensation is released to the driver's in-app wallet upon successful delivery confirmation. |
| **Build trust over time** | Ratings, verified status, and delivery history increase visibility to senders. |

---

## 2. Relationship to the Main App

The Driver App and the Main App (ParcelPeer / The GTW) are **two separate mobile applications** sharing one unified backend.

```
┌─────────────────────────────┐     ┌─────────────────────────────┐
│   ParcelPeer (The GTW)      │     │   ParcelPeer Driver App      │
│   (Sender / Receiver)       │     │   (Carrier only)             │
│                             │     │                              │
│  • Post parcels             │     │  • Create routes             │
│  • Find carriers            │     │  • Find matching parcels     │
│  • Track live deliveries    │     │  • Accept & deliver parcels  │
│  • Pay for deliveries       │     │  • Broadcast live location   │
│  • Review carriers          │     │  • Earn & withdraw           │
└──────────────┬──────────────┘     └──────────────┬──────────────┘
               │                                    │
               └──────────────┬─────────────────────┘
                              │
               ┌──────────────▼──────────────┐
               │    Shared REST API           │
               │    (Express / Node.js)       │
               │                             │
               │  • /api/parcels             │
               │  • /api/routes              │
               │  • /api/wallet              │
               │  • /api/conversations       │
               │  • /api/carrier-location    │
               │  • /api/reviews             │
               └──────────────┬──────────────┘
                              │
               ┌──────────────▼──────────────┐
               │    PostgreSQL Database       │
               │    (Drizzle ORM)             │
               └─────────────────────────────┘
```

### Key Integration Points

| Concern | How Apps Connect |
|---|---|
| **User accounts** | A single user account works in both apps. A driver may also be a sender. The same Firebase UID + backend user record is used. |
| **Parcels** | Senders create parcels in the Main App. Drivers see those exact same parcel records in the Driver App via shared API endpoints. |
| **Routes** | Drivers create routes in the Driver App. Senders in the Main App can browse these routes to find available carriers. |
| **Messaging** | Conversations exist in both apps. A driver and sender can message each other regardless of which app they use. |
| **Live tracking** | Drivers broadcast GPS in the Driver App. Senders watch it in real time in the Main App. |
| **Reviews** | A sender submits a review in the Main App that is visible on the driver's profile in the Driver App. |
| **Wallet** | One shared wallet balance. Top-ups and earnings from either app appear in both. |

---

## 3. Integration Architecture

### 3.1 API Base URL

The Driver App points to the same Express API server as the Main App:

```
Production:  https://api.parcelpeer.com
Development: http://localhost:5000
```

All requests use the same `Authorization: Bearer <token>` header scheme.

### 3.2 Authentication Tokens

Tokens issued by the Main App backend are **fully valid** in the Driver App and vice versa. There is no separate token system. Both apps call `POST /api/firebase/sync-user` after Firebase login to receive a backend JWT, which is then stored securely on-device and sent with every request.

### 3.3 Role Indication

The backend `users` table contains a `role` field and a `isCarrier` boolean flag. When a user signs up or updates their profile in the Driver App, the following fields are set:

```json
{
  "isCarrier": true,
  "role": "carrier"
}
```

The main app also reads this flag to show "carrier" badge treatments on driver profiles. A user can be both a sender and a carrier — the apps handle both states.

### 3.4 Push Notification Integration

Both apps register for Firebase Cloud Messaging (FCM) using the same project credentials. The backend's `NotificationService` targets push tokens stored in the `users` table. The Driver App registers its own device token on login via `PATCH /api/users/me` with the field `fcmToken`.

Notification types relevant to drivers are sent to the Driver App's registered token:

| Event | Notification |
|---|---|
| New parcel posted on a matching route | "New parcel available: Lagos → Abuja" |
| Parcel accepted by system on their behalf | "A parcel has been assigned to your route" |
| Sender messages the driver | "New message from [Sender Name]" |
| Delivery dispute opened | "A dispute has been opened on delivery #XYZ" |
| Wallet top-up completed | "R150 added to your wallet" |
| Route about to depart | "Reminder: Your route departs in 2 hours" |

---

## 4. Authentication & Identity

### 4.1 Sign Up Flow (Driver App)

1. User opens Driver App for the first time.
2. **Onboarding** screens explain the earning opportunity (3 slides).
3. User taps **"Start Earning"** → taken to Sign Up screen.
4. Input: Full Name, Email, Password (min 6 chars), or **Continue with Google**.
5. On successful Firebase account creation, the app calls `POST /api/firebase/sync-user` with `{ isCarrier: true }`.
6. Backend creates the user record with `role: "carrier"`, `isCarrier: true`.
7. User is directed to **Driver Verification** flow (see §11).

### 4.2 Sign In Flow

1. Email + password or Google OAuth via Firebase.
2. After Firebase auth, `POST /api/firebase/sync-user` is called.
3. Backend returns a JWT + user profile.
4. If `isCarrier === false`, the app prompts: _"Switch to carrier mode?"_ and updates the flag via `PATCH /api/users/me`.
5. JWT and user profile stored in `SecureStore`.

### 4.3 Cross-App Account Detection

If a driver already has an account from the Main App:
- Signing in with the same credentials works instantly.
- The app detects `isCarrier: false` and offers to upgrade their profile to carrier mode (non-destructive — they can still use the main app as a sender).

### 4.4 Shared API Endpoints Used for Auth

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/firebase/sync-user` | Sync Firebase user, get backend JWT |
| `GET` | `/api/auth/me` | Fetch current user profile |
| `PATCH` | `/api/users/me` | Update carrier flag, FCM token, profile info |
| `POST` | `/api/auth/signout` | Invalidate session |

---

## 5. Shared Backend API

All of these endpoints already exist in the backend. The Driver App consumes them directly — no new backend routes are required for MVP.

### 5.1 Routes (Driver-created travel plans)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/routes` | Get all of the current driver's routes |
| `POST` | `/api/routes` | Create a new route |
| `GET` | `/api/routes/:id` | Get a single route detail |
| `PATCH` | `/api/routes/:id` | Update a route |
| `DELETE` | `/api/routes/:id` | Delete a route |
| `PATCH` | `/api/routes/:id/cancel` | Cancel an active route |
| `GET` | `/api/routes/:id/matching-parcels` | Get scored list of parcels matching this route |

### 5.2 Parcels (Sender-created delivery requests)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/parcels` | List all available (Pending) parcels |
| `GET` | `/api/parcels/:id` | Get a single parcel |
| `PATCH` | `/api/parcels/:id/accept` | Driver accepts a parcel (changes status to Accepted) |
| `PATCH` | `/api/parcels/:id/pickup` | Driver confirms physical pickup |
| `PATCH` | `/api/parcels/:id/status` | Update delivery status |
| `POST` | `/api/parcels/:id/delivery-proof` | Upload delivery photo, mark Delivered |
| `GET` | `/api/parcels/:id/eta` | Get calculated ETA for a delivery |

### 5.3 Location Tracking

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/parcels/:id/carrier-location` | Push driver GPS coordinates |
| `GET` | `/api/parcels/:id/carrier-location` | Get latest driver location (used by sender) |

### 5.4 Messaging

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/conversations` | List all conversations |
| `GET` | `/api/conversations/:id/messages` | Get messages in a conversation |
| `POST` | `/api/conversations/:id/messages` | Send a message |

### 5.5 Wallet & Payments

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/wallet/balance` | Get current wallet balance |
| `GET` | `/api/wallet/transactions` | Get transaction history |
| `POST` | `/api/wallet/topup/initialize` | Start a Paystack top-up |
| `GET` | `/api/wallet/topup/verify/:reference` | Confirm top-up |
| `POST` | `/api/wallet/withdraw` | Request a withdrawal |

### 5.6 Reviews & Profile

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/reviews` | Get reviews for current user |
| `GET` | `/api/users/:id` | Get a user profile (sender info) |
| `PATCH` | `/api/users/me` | Update driver profile |

---

## 6. Driver App Feature Specification

### 6.1 Dashboard (Home)

The home screen surfaces everything the driver needs at a glance:

- **Earnings Summary Card**: Current wallet balance, total earned this week, total deliveries.
- **Active Delivery Banner**: If the driver has an accepted parcel currently in transit, a prominent live-tracking banner appears at the top with the parcel destination and current status.
- **Matched Parcels Feed**: A prioritised list of parcels that match any of the driver's active routes, sorted by match score. Each card shows origin → destination, size, compensation amount, and pickup date.
- **My Routes Status**: Compact strip showing active routes with departure dates and parcel counts.
- **Quick Actions**: Create Route, Browse All Parcels, View Earnings, Support.

### 6.2 Route Management

Drivers are the primary creators of routes. The Route Management section gives them full control:

- **Create Route**: Step-by-step form:
  1. Origin & Destination (map picker + geocoding)
  2. Intermediate Stops (optional, drag-to-reorder)
  3. Departure Date & Time
  4. Frequency: One-time / Daily / Weekly / Monthly
  5. Capacity: Max parcel size, max weight (kg), number of available spots
  6. Pricing: Price per kg
  7. Map Preview with the calculated route path
  8. Confirm & Publish

- **My Routes List**: Active and past routes in tabbed view. Each route card shows status, departure, destination, and matched parcel count.

- **Route Detail**:
  - Full route info
  - Matching parcels section with match scores
  - Accept individual parcels directly from this screen
  - Edit / Cancel / Delete actions

### 6.3 Parcel Discovery

- **Browse Parcels**: A searchable and filterable list of all Pending parcels.
  - Filters: Size, date range, compensation range, distance from driver's current location.
  - Sort: Compensation (high to low), pickup date (soonest first), distance.
- **Parcel Card**: Origin → Destination, compensation, size, pickup date, sender name + rating, fragile flag.
- **Parcel Detail**: Full parcel info, sender profile, map view of origin/destination, Accept button.
- **Accept Flow**:
  1. Driver taps Accept.
  2. Confirmation modal: shows parcel details, compensation, and estimated time.
  3. Driver confirms → `PATCH /api/parcels/:id/accept` called.
  4. Parcel status changes to `Accepted`. Sender is notified.
  5. Driver is taken to the Active Delivery screen.

### 6.4 Active Delivery Workflow

Once a parcel is accepted, the driver follows a structured flow:

#### Step 1 — Navigate to Pickup
- Map view showing sender's origin location.
- Driving directions (links out to Google Maps / Apple Maps / Waze with coordinates).
- Message Sender button.
- "I've Arrived" confirmation.

#### Step 2 — Pickup Confirmation
- Screen: `PickupVerificationScreen`
- Driver takes a photo of the parcel at pickup (or uploads from gallery).
- Optional: QR/barcode scan (future feature).
- Driver confirms pickup → `PATCH /api/parcels/:id/status` sets status to `Picked Up`.
- Live tracking automatically starts — GPS coordinates are pushed every 10 seconds via `POST /api/parcels/:id/carrier-location`.
- Sender is notified: "Your parcel has been picked up and is on its way."

#### Step 3 — In Transit
- Active Delivery screen shows:
  - Destination address and map.
  - Elapsed time and estimated distance remaining.
  - Live ETA calculated from driver's current speed/position (via `/api/parcels/:id/eta`).
  - Stop Tracking / Resume Tracking toggle (for breaks).
  - Emergency contact button.

#### Step 4 — Delivery Proof
- Screen: `DeliveryVerificationScreen`
- Driver takes a photo at the delivery location.
- Optional: Receiver signature (future feature).
- Taps "Mark as Delivered" → `POST /api/parcels/:id/delivery-proof`.
- Backend:
  - Changes parcel status to `Delivered`.
  - Credits compensation to driver's wallet.
  - Sends notification to sender/receiver.
  - Creates a review prompt for the sender.

#### Step 5 — Completion Summary
- Delivery summary screen showing:
  - Route completed (origin → destination).
  - Compensation earned and new wallet balance.
  - Sender's rating prompt (driver can rate the sender).
  - "Find more parcels" CTA.

### 6.5 Earnings & Wallet

- **Earnings Dashboard**:
  - Current balance (live).
  - This week / This month / All time earnings.
  - Chart: Daily earnings over the last 30 days.
  - Transaction list: each entry shows parcel reference, amount, date, and type (earnings, withdrawal, refund).

- **Withdrawal**:
  - Driver selects amount to withdraw.
  - Linked bank account (SA bank account number + branch code).
  - Payout confirmation and estimated transfer time.
  - `POST /api/wallet/withdraw` is called.

- **Top-Up** (optional):
  - Drivers can also top up their wallets (e.g., to pay platform fees on free tier).
  - Uses the same Paystack flow as the Main App.

### 6.6 Messaging

- List of all active conversations with senders.
- Each conversation is tied to a specific parcel delivery.
- Real-time chat UI with message bubbles, timestamps, and read receipts.
- "Parcel context" banner at the top of each conversation showing the delivery status.

### 6.7 Driver Profile & Settings

- **Profile View**:
  - Avatar, name, rating, verification badges.
  - Total deliveries, success rate, member since.
  - Bio / vehicle type.
  - My Reviews section.

- **Edit Profile**:
  - Name, bio, profile photo.
  - Vehicle type: Motorcycle / Car / Van / Truck.
  - Service areas (cities/regions served).

- **Verification Status**: Shows which verifications are complete (ID, driver's licence, vehicle registration — see §11).

- **Settings**:
  - Notifications preferences.
  - Language / currency.
  - Linked bank account.
  - Privacy.
  - Help & Support.
  - Sign out.

---

## 7. Screen-by-Screen Specification

### Auth Screens

| Screen | Route | Description |
|---|---|---|
| `DriverOnboardingScreen` | `/onboarding` | 3-slide intro with earn-focused messaging |
| `DriverLoginScreen` | `/login` | Email/password + Google login |
| `DriverSignUpScreen` | `/signup` | Account creation with carrier flag |
| `ForgotPasswordScreen` | `/forgot-password` | Firebase password reset |
| `EmailVerificationScreen` | `/verify-email` | Email confirmation prompt |

### Main App Screens (Tab Navigator)

| Screen | Tab | Route | Description |
|---|---|---|---|
| `DashboardScreen` | Home | `/` | Overview, matched parcels, earnings summary |
| `DiscoverScreen` | Discover | `/discover` | Browse all parcels with filters |
| `MyRoutesScreen` | Routes | `/routes` | Driver's route management |
| `EarningsScreen` | Earnings | `/earnings` | Wallet, earnings history, withdrawal |
| `ProfileScreen` | Profile | `/profile` | Driver profile and settings |

### Stack Screens (navigated to from tabs)

| Screen | Description |
|---|---|
| `CreateRouteScreen` | New route form |
| `RouteDetailScreen` | Single route with matched parcels |
| `ParcelDetailScreen` | Parcel info + Accept button |
| `ActiveDeliveryScreen` | Live delivery status hub |
| `PickupVerificationScreen` | Photo capture at pickup |
| `InTransitScreen` | Live tracking view during delivery |
| `DeliveryVerificationScreen` | Photo capture at drop-off |
| `DeliverySummaryScreen` | Post-delivery summary + earnings |
| `ConversationScreen` | Individual chat |
| `EditProfileScreen` | Edit driver profile |
| `VerificationScreen` | Document upload hub |
| `WalletScreen` | Full wallet and transaction history |
| `WithdrawScreen` | Withdrawal form |
| `ReviewsScreen` | All reviews received |
| `SettingsScreen` | App settings |
| `HelpScreen` | Support and FAQ |
| `NotificationsScreen` | All past notifications |

---

## 8. Real-Time Systems

### 8.1 Live Location Tracking

The Driver App uses `expo-location` to track the driver's GPS position during an active delivery.

**Trigger**: Tracking starts automatically after the driver confirms pickup (`Step 2`).  
**Interval**: Position is posted every 10 seconds **or** every 50 metres — whichever comes first.  
**Endpoint**: `POST /api/parcels/:id/carrier-location`

**Payload**:
```json
{
  "lat": -26.2041,
  "lng": 28.0473,
  "heading": 270,
  "speed": 60.5,
  "accuracy": 5.2,
  "timestamp": "2026-03-26T10:45:00Z"
}
```

**Background mode**: The app requests background location permission. If denied, tracking pauses when the app goes to the background and a notification reminds the driver to return.

**Battery optimisation**: Tracking interval increases to 30 seconds when speed drops below 5 km/h (driver is stationary).

**Stop conditions**:
- Driver taps "Stop Tracking" manually.
- Delivery is marked as Delivered.
- App detects no movement for 60 minutes.

### 8.2 ETA Calculation

The backend calculates ETA from the driver's latest posted coordinates using:
- Haversine formula for straight-line distance to destination.
- Current speed (from GPS payload) for time estimate.
- A road-distance multiplier (1.35×) to account for non-straight routes.

The Driver App displays this ETA on the `InTransitScreen`.

**Endpoint**: `GET /api/parcels/:id/eta`

**Response**:
```json
{
  "etaMinutes": 42,
  "etaFormatted": "42 min",
  "distanceKm": 38.5,
  "lastUpdated": "2026-03-26T10:45:10Z"
}
```

---

## 9. Notifications

The Driver App registers with Firebase Cloud Messaging on login and stores the device token via `PATCH /api/users/me { fcmToken: "..." }`.

### 9.1 Driver-Specific Notification Types

| Type | When | Action on Tap |
|---|---|---|
| `PARCEL_MATCH` | A new parcel matches one of the driver's active routes | Open `ParcelDetailScreen` |
| `PARCEL_ASSIGNED` | Sender manually selects this driver | Open `ParcelDetailScreen` |
| `MESSAGE_RECEIVED` | New message from a sender | Open `ConversationScreen` |
| `DELIVERY_REMINDER` | 2 hours before route departure time | Open `ActiveDeliveryScreen` |
| `WALLET_CREDIT` | Delivery payment credited to wallet | Open `EarningsScreen` |
| `DISPUTE_OPENED` | Sender opened a dispute on a delivery | Open `DisputeDetailScreen` |
| `REVIEW_RECEIVED` | Sender left a rating after delivery | Open `ReviewsScreen` |
| `ROUTE_EXPIRY_WARNING` | Route expires in 24 hours | Open `RouteDetailScreen` |
| `VERIFICATION_APPROVED` | Document verification approved | Open `VerificationScreen` |

### 9.2 In-App Notification Centre

All notifications are stored and displayed in `NotificationsScreen`, grouped by date (Today, Yesterday, This Week).

---

## 10. Wallet & Earnings

### 10.1 How Earnings Work

1. Sender posts a parcel with a **compensation amount** (e.g., R120).
2. The compensation is **reserved** (held) in the sender's wallet when the driver accepts.
3. When delivery proof is uploaded and delivery is confirmed, the amount is **released** from escrow and **credited** to the driver's wallet.
4. If the delivery fails or is cancelled by the driver, the amount is returned to the sender.

### 10.2 Platform Fee

The platform deducts a percentage fee from the driver's earnings:

| Subscription Tier | Platform Fee |
|---|---|
| Free | 15% |
| Premium | 10% |
| Business | 5% |

This is handled server-side at the point of wallet credit.

### 10.3 Withdrawal

Drivers can withdraw their balance to a South African bank account:

- Minimum withdrawal: R50
- Transfer time: 1–3 business days
- Provider: Paystack Transfers API (already integrated)

**Endpoint**: `POST /api/wallet/withdraw`  
**Payload**:
```json
{
  "amount": 500,
  "bankCode": "058",
  "accountNumber": "0123456789",
  "accountName": "John Doe"
}
```

### 10.4 Earnings Display

- All amounts displayed in the driver's selected currency (default: ZAR).
- Wallet balance updates in real time after each delivery.
- Transaction history shows: parcel reference, delivery route, gross earnings, platform fee, net credited amount.

---

## 11. Verification & Trust

The Driver App implements a tiered verification system to build trust with senders.

### 11.1 Verification Levels

| Level | Requirements | Badge |
|---|---|---|
| **Basic** | Email verified | ✓ Email Verified |
| **Verified Driver** | SA ID document uploaded + selfie | ✓ ID Verified |
| **Trusted Carrier** | Driver's licence uploaded, 5+ deliveries, 4.0+ rating | ✓ Trusted Carrier |
| **Pro Carrier** | Vehicle registration uploaded, Premium subscription, 20+ deliveries | ✓ Pro Carrier |

### 11.2 Document Upload

Documents are uploaded via the existing `POST /api/users/me/documents` endpoint (to be added to backend if not present). Files are stored securely and reviewed by admin.

Documents required:
- South African ID / Passport (front + back photo)
- Selfie with ID
- Driver's licence (front + back)
- Vehicle registration certificate

### 11.3 Verification Status Screen

Shows each verification item as a checklist card with status: `Not Started`, `Pending Review`, `Approved`, `Rejected` (with rejection reason and re-upload option).

### 11.4 Effect on Parcel Visibility

- Unverified drivers: Can browse parcels, cannot accept high-value (>R500 compensation) parcels.
- Verified Driver: Can accept all parcel sizes.
- Trusted Carrier: Appears higher in sender's recommended carriers list.
- Pro Carrier: Access to business parcels and premium route matching.

---

## 12. Offline & Background Behaviour

### 12.1 Offline Mode

The Driver App caches the following data locally using AsyncStorage / SQLite for offline access:

| Data | Cache Duration |
|---|---|
| Driver's own routes | 24 hours |
| Accepted parcel details | Until delivered |
| Wallet balance | Until next sync |
| Active conversation messages | 7 days |
| User profile | Until changed |

When offline, the app shows a subtle banner: _"You're offline. Some features may be unavailable."_

Queued actions (e.g., location updates) are stored locally and flushed when connectivity resumes.

### 12.2 Background Location

Background location tracking during active delivery uses `expo-location`'s `startLocationUpdatesAsync` with a background task registered via `expo-task-manager`. This works even when the screen is off.

**Required permissions**:
- `android.permission.ACCESS_FINE_LOCATION`
- `android.permission.ACCESS_BACKGROUND_LOCATION`
- iOS: Always-on location permission

### 12.3 Background Sync

The app uses a background fetch task (via `expo-background-fetch`) to:
- Check for new matched parcels every 15 minutes.
- Sync pending location updates.
- Refresh wallet balance.

---

## 13. Tech Stack

The Driver App is built with the exact same stack as the Main App to share code, libraries, and developer knowledge.

| Layer | Technology |
|---|---|
| **Framework** | React Native with Expo (managed workflow) |
| **Language** | TypeScript |
| **Navigation** | React Navigation v6 (Native Stack + Bottom Tabs) |
| **State / Server State** | TanStack Query (React Query) |
| **Authentication** | Firebase Auth (same project as main app) |
| **Local Storage** | AsyncStorage, Expo SecureStore |
| **Location** | expo-location, expo-task-manager |
| **Background Fetch** | expo-background-fetch |
| **Notifications** | expo-notifications (FCM) |
| **Camera** | expo-image-picker, expo-camera |
| **Maps** | react-native-webview + Leaflet.js (OpenStreetMap) |
| **Animations** | react-native-reanimated, expo-haptics |
| **Icons** | @expo/vector-icons (Feather set) |
| **HTTP Client** | fetch (wrapped in shared query client utility) |
| **UI Theme** | Shared design tokens from `@/constants/theme` |

### 13.1 Shared Code

The Driver App should live in a separate repository **or** in a `/driver` directory within the existing monorepo. The following can be shared:

```
shared/
  schema.ts          ← All data types (Route, Parcel, User, etc.)
  
client/              ← Main app (existing)
driver/              ← New Driver App
  App.tsx
  navigation/
  screens/
  components/
  hooks/
  constants/         ← Can symlink to shared theme tokens
```

Hooks that can be directly reused (copy + adapt):
- `useAuth` — identical auth flow
- `useTheme` — identical theming
- `useCurrency` — identical currency formatting
- `useConversations` / conversation screens — near-identical messaging UI
- `ParcelCard` component — same data shape, same visuals
- `OSMMapView` component — same map implementation

---

## 14. Navigation Structure

```
RootNavigator
├── AuthStack (if not logged in)
│   ├── DriverOnboardingScreen
│   ├── DriverLoginScreen
│   ├── DriverSignUpScreen
│   ├── ForgotPasswordScreen
│   └── EmailVerificationScreen
│
└── MainTabNavigator (if logged in)
    ├── HomeTab
    │   └── DashboardScreen
    │       ├── ParcelDetailScreen
    │       ├── ActiveDeliveryScreen
    │       │   ├── PickupVerificationScreen
    │       │   ├── InTransitScreen
    │       │   ├── DeliveryVerificationScreen
    │       │   └── DeliverySummaryScreen
    │       └── NotificationsScreen
    │
    ├── DiscoverTab
    │   └── DiscoverScreen
    │       ├── ParcelDetailScreen
    │       └── RouteFilterScreen
    │
    ├── RoutesTab
    │   └── MyRoutesScreen
    │       ├── CreateRouteScreen
    │       └── RouteDetailScreen
    │           └── ParcelDetailScreen
    │
    ├── EarningsTab
    │   └── EarningsScreen
    │       ├── WalletScreen
    │       ├── WithdrawScreen
    │       └── TransactionDetailScreen
    │
    └── ProfileTab
        └── ProfileScreen
            ├── EditProfileScreen
            ├── VerificationScreen
            ├── ReviewsScreen
            ├── SettingsScreen
            ├── ConversationListScreen
            │   └── ConversationScreen
            └── HelpScreen
```

---

## 15. Data Models Used

The Driver App reads and writes the following models defined in `shared/schema.ts`. No new tables are required for MVP.

### User (driver context)

```typescript
{
  id: string
  firebaseUid: string
  name: string
  email: string
  photoUrl?: string
  role: "carrier"
  isCarrier: true
  rating: number          // aggregate from reviews
  totalDeliveries: number
  successRate: number     // % of accepted parcels delivered
  walletBalance: number   // in cents (ZAR)
  isVerified: boolean
  subscriptionTier: "free" | "premium" | "business"
  bio?: string
  fcmToken?: string
  vehicleType?: "motorcycle" | "car" | "van" | "truck"
  serviceAreas?: string[]
  createdAt: Date
}
```

### Route

```typescript
{
  id: string
  carrierId: string
  origin: string
  destination: string
  originLat: number
  originLng: number
  destinationLat: number
  destinationLng: number
  intermediateStops: string[]
  departureDate: Date
  frequency: "one_time" | "daily" | "weekly" | "monthly"
  maxParcelSize: "small" | "medium" | "large"
  maxWeight: number       // kg
  availableCapacity: number
  pricePerKg: number      // in cents
  status: "Active" | "Completed" | "Expired" | "Cancelled"
  createdAt: Date
}
```

### Parcel (driver's view — accepted or in-transit)

```typescript
{
  id: string
  senderId: string
  carrierId?: string       // set to driver's ID when accepted
  senderName: string
  senderRating: number
  origin: string
  destination: string
  originLat?: number
  originLng?: number
  destinationLat?: number
  destinationLng?: number
  size: "small" | "medium" | "large" | "extra_large"
  weight?: number
  compensation: number     // in cents
  description?: string
  fragile: boolean
  pickupDate: Date
  status: "Pending" | "Accepted" | "Picked Up" | "In Transit" | "Delivered" | "Cancelled"
  deliveryProofUrl?: string
  createdAt: Date
}
```

### Carrier Location (live tracking)

```typescript
{
  parcelId: string
  lat: number
  lng: number
  heading?: number
  speed?: number           // km/h
  accuracy?: number        // metres
  timestamp: Date
}
```

---

## 16. Environment & Configuration

The Driver App uses the same `.env` variables as the main app, sourced from Replit Secrets / EAS environment:

```env
# API
EXPO_PUBLIC_API_URL=https://api.parcelpeer.com

# Firebase (same project as main app)
EXPO_PUBLIC_FIREBASE_API_KEY=...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
EXPO_PUBLIC_FIREBASE_APP_ID=...

# Paystack (same keys — shared wallet system)
EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY=...

# App-specific
EXPO_PUBLIC_APP_NAME=ParcelPeer Driver
EXPO_PUBLIC_APP_SLUG=parcelpeer-driver
EXPO_PUBLIC_APP_VERSION=1.0.0
```

### app.json / app.config.js (Driver App)

```json
{
  "expo": {
    "name": "ParcelPeer Driver",
    "slug": "parcelpeer-driver",
    "version": "1.0.0",
    "icon": "./assets/icon-driver.png",
    "splash": {
      "image": "./assets/splash-driver.png",
      "backgroundColor": "#0F172A"
    },
    "android": {
      "package": "com.parcelpeer.driver",
      "permissions": [
        "ACCESS_FINE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "CAMERA",
        "READ_EXTERNAL_STORAGE"
      ]
    },
    "ios": {
      "bundleIdentifier": "com.parcelpeer.driver",
      "infoPlist": {
        "NSLocationAlwaysAndWhenInUseUsageDescription": "ParcelPeer Driver needs your location to track deliveries in real time.",
        "NSCameraUsageDescription": "Used to capture delivery proof photos."
      }
    }
  }
}
```

---

## 17. Development Roadmap

### Phase 1 — MVP (Weeks 1–6)

Essential features to launch and validate with real drivers.

- [ ] Auth screens (Login, Sign Up, Onboarding — 3 slides)
- [ ] Dashboard screen with earnings summary and matched parcel feed
- [ ] Create Route screen (full form, map preview)
- [ ] My Routes screen (active + past tabs)
- [ ] Route Detail screen with matching parcels
- [ ] Parcel Detail screen with Accept flow
- [ ] Active Delivery workflow (Pickup → In Transit → Proof → Summary)
- [ ] Live GPS tracking (foreground only for MVP)
- [ ] Messaging (conversation list + chat screen)
- [ ] Earnings screen (balance + transaction history)
- [ ] Basic Profile screen with edit functionality
- [ ] Push notifications (parcel match, messages, wallet credit)
- [ ] Reuse `shared/schema.ts` types from main app

### Phase 2 — V1.1 (Weeks 7–10)

Trust, retention, and monetisation features.

- [ ] Driver Verification flow (ID upload, selfie, licence)
- [ ] Background location tracking during deliveries
- [ ] Withdrawal screen (bank account linking + payout)
- [ ] Reviews screen (received reviews, rate senders)
- [ ] Notification Centre screen
- [ ] Subscription plan screen (Free / Premium / Business)
- [ ] Offline mode with local data caching
- [ ] Vehicle type and service area on profile

### Phase 3 — V1.2 (Weeks 11–14)

Advanced features and growth.

- [ ] Route templates (save frequently used routes)
- [ ] Multi-parcel trips (accept multiple parcels per route)
- [ ] In-app navigation (integrated turn-by-turn, not just linking to external maps)
- [ ] QR code scan at pickup
- [ ] Receiver digital signature at delivery
- [ ] Driver leaderboard and achievement badges
- [ ] Referral programme for new drivers
- [ ] Analytics dashboard (earnings trends, best routes, peak times)
- [ ] Dark mode (shared theme already supports it)

### Phase 4 — V2.0 (Future)

Platform expansion.

- [ ] Fleet management (business accounts with multiple drivers)
- [ ] Scheduled route templates with auto-publishing
- [ ] API webhook for enterprise senders
- [ ] Cross-border delivery support
- [ ] Insurance integration per delivery
- [ ] Driver community forum / in-app announcements

---

## Appendix A — Differences from Main App

| Feature | Main App (Sender) | Driver App |
|---|---|---|
| Primary action | Post a parcel | Create a route |
| Discovery | Find carriers for a parcel | Find parcels for a route |
| Payments | Pay compensation for delivery | Earn compensation per delivery |
| Tracking | Watch driver's live location | Broadcast own location |
| Profile emphasis | Trust as a sender (reliable payer) | Trust as a carrier (reliable deliverer) |
| Verification | Basic email verification | Full document + vehicle verification |
| Onboarding message | "Send anything anywhere" | "Turn your trip into income" |

## Appendix B — API Error Handling

All API calls in the Driver App follow the same error handling pattern:

```
4xx errors → User-facing alert with specific message
401 Unauthorized → Force sign out, redirect to login
429 Too Many Requests → Show retry prompt with countdown
5xx errors → Generic "Something went wrong, please try again" alert
Network error → Show offline banner, queue retry
```

## Appendix C — Design System

The Driver App uses the **same design tokens** as the Main App:

- **Primary colour**: `#F97316` (orange) — same brand identity
- **Navy accent**: `#0F172A` — header backgrounds, dark text
- **Typography**: System font stack (SF Pro on iOS, Roboto on Android)
- **Border radius**: xs=6, sm=10, md=14, lg=20, xl=28, full=9999
- **Spacing scale**: xs=4, sm=8, md=12, lg=16, xl=20, 2xl=24, 3xl=32
- **Shadows**: Same `Shadows.sm/md/lg/orange` tokens

The Driver App can have a distinct **accent colour variation** for differentiating the two apps at a glance. Suggested: keep orange primary, but use a **darker navy/slate header** in the Driver App vs. the lighter treatment in the Main App.

---

*Document maintained by the ParcelPeer engineering team. For questions, contact the lead architect.*
