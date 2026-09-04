# ParcelPeer (The GTW) — Full Backend Specification

## Overview

ParcelPeer is a peer-to-peer parcel delivery marketplace that connects senders with travelers (carriers) who deliver parcels along their existing routes. The backend is a **Node.js / Express** REST API backed by **PostgreSQL** (via Drizzle ORM). Authentication uses **JWT tokens** (and optionally Firebase Auth for mobile). Payments are processed through **Paystack** with an internal wallet/ledger system.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (TypeScript) |
| Framework | Express.js |
| Database | PostgreSQL |
| ORM | Drizzle ORM |
| Auth | JWT (access + refresh tokens) + Firebase Auth (mobile sync) |
| Payments | Paystack |
| Push Notifications | Firebase Cloud Messaging (FCM) / Expo Push |
| Geocoding | OpenStreetMap Nominatim |
| Password Hashing | bcrypt |
| File Storage | (external — e.g., Cloudinary / S3 for proof-of-delivery photos) |

---

## Database Schema

### `users`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | Firebase UID or generated UUID |
| name | text | Display name |
| email | text (unique) | Login email |
| phone | text | Optional phone number |
| passwordHash | text | bcrypt hash (or "firebase-auth" for Firebase users) |
| role | enum | `user`, `carrier`, `support`, `admin` |
| rating | numeric | Average peer rating (1–5) |
| verified | boolean | Identity verified by admin/support |
| suspended | boolean | Account suspended flag |
| walletBalance | numeric | Current wallet balance in ZAR |
| subscriptionTier | enum | `starter`, `professional`, `business` |
| subscriptionStatus | enum | `active`, `cancelled`, `expired` |
| profilePhoto | text | URL to avatar image |
| bio | text | Short user bio |
| createdAt | timestamp | Account creation date |
| updatedAt | timestamp | Last update |

---

### `parcels`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| senderId | uuid (FK → users) | Parcel creator |
| transporterId | uuid (FK → users) | Assigned carrier (nullable) |
| receiverId | uuid (FK → users) | Recipient (nullable) |
| receiverName | text | Recipient's name |
| receiverPhone | text | Recipient's phone |
| receiverEmail | text | Recipient's email |
| origin | text | Pickup address |
| originLat | numeric | Geocoded latitude |
| originLng | numeric | Geocoded longitude |
| destination | text | Delivery address |
| destLat | numeric | Geocoded latitude |
| destLng | numeric | Geocoded longitude |
| description | text | What's in the parcel |
| size | enum | `small`, `medium`, `large`, `extra_large` |
| weight | numeric | In kilograms |
| compensation | numeric | Payment to carrier (ZAR) |
| status | enum | `Pending`, `Accepted`, `PickedUp`, `InTransit`, `Delivered`, `Cancelled`, `Disputed` |
| fragile | boolean | Is the parcel fragile? |
| pickupDate | timestamp | When the parcel can be picked up |
| pickupWindowEnd | timestamp | Latest acceptable pickup time |
| deliveryWindowStart | timestamp | Earliest acceptable delivery |
| deliveryWindowEnd | timestamp | Latest acceptable delivery |
| expiresAt | timestamp | When the listing expires |
| insuranceRequested | boolean | Sender wants insurance |
| insuranceFee | numeric | Insurance premium charged |
| platformFee | numeric | Fee taken by the platform |
| createdAt | timestamp | |
| updatedAt | timestamp | |

---

### `routes`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| carrierId | uuid (FK → users) | The carrier |
| origin | text | Departure location |
| originLat | numeric | |
| originLng | numeric | |
| destination | text | Arrival location |
| destLat | numeric | |
| destLng | numeric | |
| departureDate | timestamp | When the carrier departs |
| frequency | enum | `one-time`, `daily`, `weekly`, `monthly` |
| maxCapacity | numeric | Max weight the carrier can take (kg) |
| availableCapacity | numeric | Remaining capacity |
| status | enum | `Active`, `Completed`, `Cancelled` |
| intermediateStops | jsonb | Array of stop locations along the way |
| notes | text | Extra notes from the carrier |
| createdAt | timestamp | |
| updatedAt | timestamp | |

---

### `payments`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| parcelId | uuid (FK → parcels) | Related delivery |
| senderId | uuid (FK → users) | Who paid |
| carrierId | uuid (FK → users) | Who receives |
| amount | numeric | Total charged |
| platformFee | numeric | Platform's cut |
| currency | text | e.g. `ZAR` |
| status | enum | `pending`, `success`, `failed`, `refunded` |
| paystackReference | text | Paystack transaction reference |
| createdAt | timestamp | |

---

### `wallet_transactions`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| userId | uuid (FK → users) | |
| type | enum | `topup`, `payment`, `earning`, `refund`, `fee` |
| amount | numeric | Positive = credit, negative = debit |
| currency | text | e.g. `ZAR` |
| status | enum | `pending`, `completed`, `failed` |
| reference | text | Paystack or internal reference |
| description | text | Human-readable note |
| createdAt | timestamp | |

---

### `saved_payment_methods`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| userId | uuid (FK → users) | |
| paystackAuthCode | text | Reusable Paystack authorization |
| cardLast4 | text | Last 4 digits |
| cardBrand | text | e.g. `visa`, `mastercard` |
| isDefault | boolean | Primary method |
| createdAt | timestamp | |

---

### `auto_top_up_settings`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| userId | uuid (FK → users) | |
| enabled | boolean | |
| triggerAmount | numeric | Balance threshold that triggers auto top-up |
| topUpAmount | numeric | Amount to add when triggered |
| paymentMethodId | uuid (FK → saved_payment_methods) | |

---

### `subscriptions`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| userId | uuid (FK → users) | |
| tier | enum | `starter`, `professional`, `business` |
| status | enum | `active`, `cancelled`, `expired` |
| startDate | timestamp | |
| endDate | timestamp | |
| paystackSubscriptionCode | text | |
| monthlyParcelLimit | integer | |
| platformFeePercent | numeric | |

---

### `conversations`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| participant1Id | uuid (FK → users) | |
| participant2Id | uuid (FK → users) | |
| lastMessageAt | timestamp | |
| createdAt | timestamp | |

---

### `messages`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| conversationId | uuid (FK → conversations) | |
| senderId | uuid (FK → users) | |
| content | text | Message body |
| read | boolean | |
| createdAt | timestamp | |

---

### `parcel_messages`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| parcelId | uuid (FK → parcels) | |
| senderId | uuid (FK → users) | |
| content | text | |
| createdAt | timestamp | |

---

### `parcel_tracking_events`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| parcelId | uuid (FK → parcels) | |
| status | text | Event description |
| location | text | Where it happened |
| lat | numeric | |
| lng | numeric | |
| note | text | Extra info |
| createdBy | uuid (FK → users) | |
| createdAt | timestamp | |

---

### `carrier_locations`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| carrierId | uuid (FK → users) | |
| parcelId | uuid (FK → parcels) | |
| lat | numeric | |
| lng | numeric | |
| accuracy | numeric | GPS accuracy in meters |
| heading | numeric | Direction of travel |
| speed | numeric | m/s |
| createdAt | timestamp | |

---

### `receiver_locations`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| receiverId | uuid (FK → users) | |
| parcelId | uuid (FK → parcels) | |
| lat | numeric | |
| lng | numeric | |
| createdAt | timestamp | |

---

### `reviews`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| parcelId | uuid (FK → parcels) | |
| reviewerId | uuid (FK → users) | Who wrote the review |
| revieweeId | uuid (FK → users) | Who is being reviewed |
| rating | integer | 1–5 |
| comment | text | |
| createdAt | timestamp | |

---

### `disputes`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| parcelId | uuid (FK → parcels) | |
| complainantId | uuid (FK → users) | Who raised the dispute |
| respondentId | uuid (FK → users) | Other party |
| subject | text | Short title |
| description | text | Full description |
| status | enum | `open`, `under_review`, `resolved`, `closed` |
| resolution | text | Admin's final resolution notes |
| adminId | uuid (FK → users) | Admin who handled it |
| resolvedAt | timestamp | |
| createdAt | timestamp | |

---

### `dispute_messages`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| disputeId | uuid (FK → disputes) | |
| senderId | uuid (FK → users) | |
| content | text | |
| createdAt | timestamp | |

---

### `delivery_proofs`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| parcelId | uuid (FK → parcels) | |
| uploadedBy | uuid (FK → users) | |
| type | enum | `pickup`, `delivery` |
| photoUrl | text | URL to photo |
| notes | text | |
| createdAt | timestamp | |

---

### `receiver_confirmations`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| parcelId | uuid (FK → parcels) | |
| token | text (unique) | One-time confirmation token |
| confirmed | boolean | |
| confirmedAt | timestamp | |
| expiresAt | timestamp | |

---

### `connections`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| userId | uuid (FK → users) | Owner |
| connectedUserId | uuid (FK → users) | Connected user |
| createdAt | timestamp | |

---

### `blocked_users`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| userId | uuid (FK → users) | The blocker |
| blockedUserId | uuid (FK → users) | The blocked |
| createdAt | timestamp | |

---

### `push_tokens`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| userId | uuid (FK → users) | |
| token | text | FCM or Expo push token |
| platform | enum | `ios`, `android`, `web` |
| createdAt | timestamp | |

---

### `notification_queue`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| userId | uuid (FK → users) | Recipient |
| title | text | Notification title |
| body | text | Notification body |
| data | jsonb | Extra payload |
| sent | boolean | |
| sentAt | timestamp | |
| createdAt | timestamp | |

---

## Role-Based Access Control (RBAC)

### Roles

| Role | Description |
|---|---|
| `user` | Regular sender/receiver of parcels |
| `carrier` | Traveler who delivers parcels |
| `support` | Internal staff — limited management access |
| `admin` | Full system access |

### Permission Matrix

| Permission | user | carrier | support | admin |
|---|---|---|---|---|
| view_dashboard | ✅ | ✅ | ✅ | ✅ |
| manage_users | | | | ✅ |
| view_users | | | ✅ | ✅ |
| verify_users | | | ✅ | ✅ |
| delete_users | | | | ✅ |
| manage_parcels | | | | ✅ |
| view_parcels | | | ✅ | ✅ |
| update_parcel_status | | | ✅ | ✅ |
| delete_parcels | | | | ✅ |
| manage_routes | | ✅ | | ✅ |
| view_routes | | | ✅ | ✅ |
| update_routes | | | | ✅ |
| delete_routes | | | | ✅ |
| manage_payments | | | | ✅ |
| view_payments | | | ✅ | ✅ |
| process_refunds | | | | ✅ |
| manage_disputes | | | | ✅ |
| view_disputes | | | ✅ | ✅ |
| comment_disputes | | | ✅ | ✅ |
| resolve_disputes | | | | ✅ |
| manage_subscriptions | | | | ✅ |
| view_subscriptions | | | ✅ | ✅ |
| cancel_subscriptions | | | | ✅ |
| view_reviews | | | ✅ | ✅ |
| moderate_reviews | | | ✅ | ✅ |
| delete_reviews | | | ✅ | ✅ |
| view_wallet | | | ✅ | ✅ |
| adjust_wallets | | | | ✅ |
| view_analytics | | | ✅ | ✅ |
| view_reports | | | ✅ | ✅ |
| access_settings | | | | ✅ |

---

## Authentication

### Flow
1. User registers or logs in via email/password.
2. Server returns a **JWT access token** (short-lived, e.g., 15 minutes) and a **refresh token** (long-lived, e.g., 7 days).
3. Mobile clients may also sync via **Firebase Auth** — the Firebase UID becomes the user's `id` in the DB.
4. Access token is sent in the `Authorization: Bearer <token>` header for all protected routes.

### Endpoints

#### `POST /api/auth/signup`
**Auth:** None  
**Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "Jane Doe",
  "phone": "+27820000000"
}
```
**Response:** `201` — User object + `accessToken` + `refreshToken` + `expiresIn`

---

#### `POST /api/auth/signin`
**Auth:** None  
**Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```
**Response:** `200` — User object + tokens  
**Errors:** `401` (invalid credentials), `403` (account suspended)

---

#### `POST /api/auth/refresh`
**Auth:** None  
**Body:** `{ "refreshToken": "..." }`  
**Response:** New `accessToken` + `refreshToken`

---

#### `POST /api/auth/signout`
**Auth:** Bearer token  
**Response:** `200` — Confirmation message

---

#### `POST /api/auth/change-password`
**Auth:** Bearer token  
**Body:** `{ "currentPassword": "...", "newPassword": "..." }`  
**Response:** `200` — Success

---

#### `POST /api/auth/request-password-reset`
**Auth:** None  
**Body:** `{ "email": "user@example.com" }`  
**Response:** `200` — Always returns generic message (doesn't reveal if email exists)

---

#### `GET /api/auth/me`
**Auth:** Bearer token  
**Response:** Current user profile (id, email, name, phone, rating, verified, role, subscriptionTier, etc.)

---

#### `POST /api/auth/sync` *(Firebase mobile sync)*
**Auth:** Firebase ID token  
**Body:** `{ "name": "...", "phone": "..." }`  
**Response:** User record (creates if new, returns existing if already in DB)

---

## User Endpoints

#### `GET /api/users/search?q=<term>`
**Auth:** Optional  
**Response:** Array of up to 10 matching users (by name or email)

---

#### `GET /api/users/:id`
**Auth:** None  
**Response:** User profile + stats (totalDeliveries, connectionsCount, reviewsCount, successRate)

---

#### `PATCH /api/users/:id`
**Auth:** Bearer token (own account or admin)  
**Body:** Any subset of updatable user fields (name, phone, bio, profilePhoto, etc.)  
**Response:** Updated user object

---

## Parcel Endpoints (Sender / User)

#### `GET /api/parcels`
**Auth:** None  
**Response:** All parcels with sender name and rating joined

---

#### `GET /api/parcels/:id`
**Auth:** None  
**Response:** Single parcel with full sender info

---

#### `POST /api/parcels`
**Auth:** Bearer token  
**Body:**
```json
{
  "origin": "Cape Town, South Africa",
  "destination": "Johannesburg, South Africa",
  "description": "Small electronics",
  "size": "small",
  "weight": 0.5,
  "compensation": 150,
  "fragile": true,
  "pickupDate": "2026-04-01T08:00:00Z",
  "receiverName": "John Smith",
  "receiverPhone": "+27830000000",
  "receiverEmail": "john@example.com"
}
```
**Response:** `201` — Created parcel (geocoordinates auto-resolved via Nominatim)

---

#### `PATCH /api/parcels/:id`
**Auth:** Bearer token (sender only)  
**Body:** Fields to update  
**Response:** Updated parcel

---

#### `DELETE /api/parcels/:id`
**Auth:** Bearer token (sender only, status must be Pending)  
**Response:** `204`

---

#### `PATCH /api/parcels/:id/accept`
**Auth:** Bearer token (carrier)  
**Body:** `{ "transporterId": "carrier-uuid" }`  
**Response:** Updated parcel with status `Accepted`

---

#### `PATCH /api/parcels/:id/status`
**Auth:** Bearer token (transporter or admin/support)  
**Body:** `{ "status": "PickedUp" | "InTransit" | "Delivered" | "Cancelled" }`  
**Response:** Updated parcel + tracking event created

---

#### `GET /api/parcels/:id/matching-routes`
**Auth:** Bearer token  
**Response:** Array of routes that are compatible with this parcel (origin/destination proximity + capacity)

---

#### `GET /api/parcels/:id/tracking`
**Auth:** Bearer token  
**Response:** Array of tracking events for the parcel in chronological order

---

#### `POST /api/parcels/:id/tracking`
**Auth:** Bearer token (transporter or admin/support)  
**Body:** `{ "status": "...", "location": "...", "lat": 0, "lng": 0, "note": "..." }`  
**Response:** Created tracking event

---

#### `GET /api/parcels/:id/messages`
**Auth:** Bearer token  
**Response:** All parcel-specific messages

---

#### `POST /api/parcels/:id/messages`
**Auth:** Bearer token  
**Body:** `{ "content": "I'm on my way" }`  
**Response:** Created message

---

## Route Endpoints (Service Provider / Carrier)

#### `GET /api/routes`
**Auth:** None  
**Response:** All active routes with carrier info

---

#### `GET /api/routes/:id`
**Auth:** None  
**Response:** Single route with carrier details

---

#### `POST /api/routes`
**Auth:** Bearer token (carrier role)  
**Body:**
```json
{
  "origin": "Cape Town, South Africa",
  "destination": "Johannesburg, South Africa",
  "departureDate": "2026-04-01T06:00:00Z",
  "frequency": "one-time",
  "maxCapacity": 10,
  "intermediateStops": ["Paarl", "Worcester"],
  "notes": "Can take fragile items"
}
```
**Response:** `201` — Created route (geocoordinates auto-resolved)

---

#### `PATCH /api/routes/:id`
**Auth:** Bearer token (owning carrier or admin)  
**Body:** Fields to update  
**Response:** Updated route

---

#### `DELETE /api/routes/:id`
**Auth:** Bearer token (owning carrier or admin)  
**Response:** `204`

---

#### `GET /api/routes/:id/matching-parcels`
**Auth:** Bearer token  
**Response:** Array of pending parcels that fall along the carrier's route (by proximity of origin/destination coordinates + weight capacity check)

---

#### `GET /api/routes/my`
**Auth:** Bearer token (carrier)  
**Response:** All routes belonging to the authenticated carrier

---

## Live Tracking Endpoints

### Carrier Location

#### `POST /api/tracking/carrier-location`
**Auth:** Bearer token (carrier)  
**Body:** `{ "parcelId": "uuid", "lat": -33.9, "lng": 18.4, "accuracy": 5, "heading": 90, "speed": 13.8 }`  
**Response:** `201` — Location recorded

#### `GET /api/tracking/carrier-location/:parcelId`
**Auth:** Bearer token (sender, receiver, or admin)  
**Response:** Latest carrier GPS position for a parcel

---

### Receiver Location

#### `POST /api/tracking/receiver-location`
**Auth:** Bearer token (receiver)  
**Body:** `{ "parcelId": "uuid", "lat": -33.9, "lng": 18.4 }`  
**Response:** `201` — Location recorded

#### `GET /api/tracking/receiver-location/:parcelId`
**Auth:** Bearer token (carrier or admin)  
**Response:** Latest receiver GPS position for a parcel

---

## Receiver Endpoints

#### `GET /api/receiver/incoming`
**Auth:** Bearer token  
**Response:** All parcels where the authenticated user is the receiver (or matching receiverEmail), ordered by status

---

#### `GET /api/receiver/parcels/:id`
**Auth:** Bearer token or confirmation token  
**Response:** Parcel details for the receiver's view (includes tracking events, carrier location)

---

#### `POST /api/receiver/confirm-delivery`
**Auth:** None (token-based)  
**Body:** `{ "token": "one-time-confirmation-token" }`  
**Response:** `200` — Delivery confirmed, parcel status updated to `Delivered`

---

#### `POST /api/receiver/update-location`
**Auth:** Bearer token  
**Body:** `{ "parcelId": "uuid", "lat": 0, "lng": 0 }`  
**Response:** Updated receiver location (shared with carrier for last-mile navigation)

---

## Wallet Endpoints

#### `GET /api/wallet/balance`
**Auth:** Bearer token  
**Response:** `{ "balance": 500.00, "currency": "ZAR" }`

---

#### `GET /api/wallet/transactions`
**Auth:** Bearer token  
**Query:** `?page=1&limit=20`  
**Response:** Paginated list of wallet transactions

---

#### `POST /api/wallet/topup/initialize`
**Auth:** Bearer token  
**Body:** `{ "amount": 500, "currency": "ZAR" }`  
**Response:** Paystack authorization URL — redirect user to this URL to complete payment

---

#### `GET /api/wallet/topup/verify/:reference`
**Auth:** Bearer token  
**Response:** Verification result — on success, wallet balance is updated and transaction marked `completed`

---

#### `GET /api/wallet/payment-methods`
**Auth:** Bearer token  
**Response:** User's saved payment methods

---

#### `DELETE /api/wallet/payment-methods/:id`
**Auth:** Bearer token  
**Response:** `204`

---

#### `GET /api/wallet/auto-topup`
**Auth:** Bearer token  
**Response:** Current auto top-up settings

---

#### `POST /api/wallet/auto-topup`
**Auth:** Bearer token  
**Body:** `{ "enabled": true, "triggerAmount": 100, "topUpAmount": 500, "paymentMethodId": "uuid" }`  
**Response:** Updated auto top-up settings

---

## Messaging Endpoints

#### `GET /api/conversations`
**Auth:** Bearer token  
**Response:** All conversations the user participates in, with last message preview

---

#### `GET /api/conversations/:id`
**Auth:** Bearer token  
**Response:** Conversation details + messages

---

#### `POST /api/conversations`
**Auth:** Bearer token  
**Body:** `{ "recipientId": "uuid" }`  
**Response:** Created or existing conversation

---

#### `POST /api/conversations/:id/messages`
**Auth:** Bearer token  
**Body:** `{ "content": "Hello" }`  
**Response:** Created message

---

## Reviews Endpoints

#### `POST /api/reviews`
**Auth:** Bearer token  
**Body:** `{ "parcelId": "uuid", "revieweeId": "uuid", "rating": 5, "comment": "Great carrier!" }`  
**Response:** `201` — Created review + user's average rating updated

---

#### `GET /api/users/:id/reviews`
**Auth:** None  
**Response:** All reviews for a user

---

## Disputes Endpoints

#### `GET /api/disputes`
**Auth:** Bearer token  
**Response:** Disputes where the user is either complainant or respondent

---

#### `POST /api/disputes`
**Auth:** Bearer token  
**Body:**
```json
{
  "parcelId": "uuid",
  "respondentId": "uuid",
  "subject": "Parcel not delivered",
  "description": "The carrier marked delivered but I never received it."
}
```
**Response:** `201` — Created dispute

---

#### `GET /api/disputes/:id`
**Auth:** Bearer token (participant or admin/support)  
**Response:** Dispute details with messages and participant info

---

#### `POST /api/disputes/:id/messages`
**Auth:** Bearer token (participant or admin/support)  
**Body:** `{ "content": "Here is my evidence..." }`  
**Response:** Created dispute message

---

## Subscription Endpoints

#### `GET /api/subscriptions`
**Auth:** Bearer token  
**Response:** Current user's subscription info

---

#### `POST /api/subscriptions`
**Auth:** Bearer token  
**Body:** `{ "tier": "professional" }`  
**Response:** Paystack subscription initialization URL

---

#### `DELETE /api/subscriptions`
**Auth:** Bearer token  
**Response:** `200` — Subscription cancelled

---

## Push Notification Endpoints

#### `POST /api/push-tokens`
**Auth:** Bearer token  
**Body:** `{ "token": "ExponentPushToken[...]", "platform": "android" }`  
**Response:** `201` — Token registered

---

#### `DELETE /api/push-tokens/:token`
**Auth:** Bearer token  
**Response:** `204` — Token removed (call on logout)

---

## Connections Endpoints

#### `GET /api/connections`
**Auth:** Bearer token  
**Response:** User's trusted contacts/connections list

---

#### `POST /api/connections`
**Auth:** Bearer token  
**Body:** `{ "connectedUserId": "uuid" }`  
**Response:** `201` — Connection created

---

#### `DELETE /api/connections/:id`
**Auth:** Bearer token  
**Response:** `204`

---

## Blocked Users Endpoints

#### `GET /api/blocked-users`
**Auth:** Bearer token  
**Response:** List of users the authenticated user has blocked

---

#### `POST /api/blocked-users`
**Auth:** Bearer token  
**Body:** `{ "blockedUserId": "uuid" }`  
**Response:** `201`

---

#### `DELETE /api/blocked-users/:id`
**Auth:** Bearer token  
**Response:** `204` — User unblocked

---

## Delivery Proof Endpoints

#### `POST /api/parcels/:id/proof`
**Auth:** Bearer token (transporter)  
**Body:** `{ "type": "pickup" | "delivery", "photoUrl": "https://...", "notes": "..." }`  
**Response:** `201` — Proof recorded

---

#### `GET /api/parcels/:id/proof`
**Auth:** Bearer token (sender, receiver, or admin)  
**Response:** All proof records for the parcel

---

## Admin Endpoints

> All admin endpoints require `role = admin`. Support staff endpoints noted separately.

---

### Dashboard

#### `GET /api/admin/stats`
**Auth:** Admin  
**Response:**
```json
{
  "users": { "total": 1200, "recent": 45 },
  "parcels": { "total": 5400, "pending": 120, "statusBreakdown": [...] },
  "routes": { "total": 890, "active": 210 },
  "payments": { "total": 3200, "revenue": 48500.00, "statusBreakdown": [...] },
  "disputes": { "total": 34, "open": 8, "statusBreakdown": [...] },
  "subscriptions": { "active": 320 },
  "wallet": { "totalBalance": 125000.00 }
}
```

---

#### `GET /api/admin/activity?limit=50`
**Auth:** Admin  
**Response:** Merged recent activity feed (parcels, routes, payments), sorted newest first

---

### User Management

#### `GET /api/admin/users`
**Auth:** Admin or Support (`view_users`)  
**Query:** `?search=&role=&verified=&suspended=&page=1&limit=20`  
**Response:** Paginated user list

---

#### `GET /api/admin/users/:id`
**Auth:** Admin or Support  
**Response:** User profile + stats (sentParcels, transportedParcels, routes, reviews)

---

#### `PATCH /api/admin/users/:id`
**Auth:** Admin  
**Body:** `{ "verified": true, "suspended": false, "role": "carrier" }`  
**Response:** Updated user

---

#### `DELETE /api/admin/users/:id`
**Auth:** Admin (`delete_users`)  
**Response:** `204`

---

### Parcel Management

#### `GET /api/admin/parcels`
**Auth:** Admin or Support  
**Query:** `?status=&search=&page=1&limit=20`  
**Response:** Paginated parcels with sender info

---

#### `PATCH /api/admin/parcels/:id`
**Auth:** Admin  
**Body:** Any parcel field (status, transporterId, etc.)  
**Response:** Updated parcel

---

#### `DELETE /api/admin/parcels/:id`
**Auth:** Admin  
**Response:** `204`

---

### Route Management

#### `GET /api/admin/routes`
**Auth:** Admin or Support  
**Query:** `?status=&search=&page=1&limit=20`  
**Response:** Paginated routes with carrier info

---

#### `PATCH /api/admin/routes/:id`
**Auth:** Admin  
**Response:** Updated route

---

#### `DELETE /api/admin/routes/:id`
**Auth:** Admin  
**Response:** `204`

---

### Payment Management

#### `GET /api/admin/payments`
**Auth:** Admin or Support  
**Query:** `?status=&page=1&limit=20`  
**Response:** Paginated payments with sender info

---

#### `POST /api/admin/payments/:id/refund`
**Auth:** Admin (`process_refunds`)  
**Body:** `{ "reason": "Carrier failed to deliver" }`  
**Response:** Refund initiated via Paystack + wallet credited

---

### Review Management

#### `GET /api/admin/reviews`
**Auth:** Admin or Support  
**Query:** `?page=1&limit=20`  
**Response:** Paginated reviews with reviewer info

---

#### `DELETE /api/admin/reviews/:id`
**Auth:** Admin or Support (`delete_reviews`)  
**Response:** `204`

---

### Dispute Management

#### `GET /api/admin/disputes`
**Auth:** Admin or Support  
**Query:** `?status=&search=&page=1&limit=20`  
**Response:** Paginated disputes with complainant and parcel info

---

#### `GET /api/admin/disputes/:id`
**Auth:** Admin or Support  
**Response:** Full dispute with messages, complainant, respondent, and parcel details

---

#### `PATCH /api/admin/disputes/:id`
**Auth:** Admin or Support  
**Body:** `{ "status": "resolved", "resolution": "Refund issued to sender." }`  
**Response:** Updated dispute

---

#### `POST /api/admin/disputes/:id/messages`
**Auth:** Admin or Support (`comment_disputes`)  
**Body:** `{ "content": "We have reviewed your case..." }`  
**Response:** Created message

---

### Subscription Management

#### `GET /api/admin/subscriptions`
**Auth:** Admin or Support  
**Query:** `?status=&page=1&limit=20`  
**Response:** Paginated subscriptions

---

#### `PATCH /api/admin/subscriptions/:id`
**Auth:** Admin  
**Body:** `{ "status": "cancelled" }`  
**Response:** Updated subscription

---

### Wallet Management

#### `GET /api/admin/wallets`
**Auth:** Admin or Support  
**Response:** All wallet transactions across all users (paginated)

---

#### `POST /api/admin/wallets/adjust`
**Auth:** Admin (`adjust_wallets`)  
**Body:** `{ "userId": "uuid", "amount": 100, "reason": "Goodwill credit" }`  
**Response:** New wallet transaction + updated balance

---

### Analytics & Reports

#### `GET /api/admin/analytics/overview`
**Auth:** Admin or Support  
**Query:** `?from=2026-01-01&to=2026-03-31`  
**Response:** Revenue, parcel volume, user growth, and delivery success rate over the date range

---

#### `GET /api/admin/analytics/subscriptions`
**Auth:** Admin or Support  
**Response:** Subscription tier breakdown and monthly recurring revenue

---

#### `GET /api/admin/analytics/disputes`
**Auth:** Admin or Support  
**Response:** Dispute resolution rates and average resolution time

---

## Payment & Wallet Logic

### Wallet Top-up Flow
1. User calls `POST /api/wallet/topup/initialize` with desired amount.
2. Server creates a `pending` wallet transaction record.
3. Server calls Paystack to initialize a transaction and returns the authorization URL.
4. User completes payment on Paystack's hosted page.
5. Paystack calls the server's webhook or user calls `GET /api/wallet/topup/verify/:reference`.
6. Server verifies with Paystack API → if successful: marks transaction `completed`, increments `users.walletBalance`.

### Parcel Payment Flow
1. When a carrier accepts a parcel, the sender's wallet is checked for sufficient balance (compensation + platform fee).
2. If insufficient, sender is prompted to top up.
3. On parcel acceptance, the compensation amount is reserved (deducted from sender's wallet, stored as `pending` payment).
4. On `Delivered` status confirmed: carrier's wallet is credited with their compensation; platform retains the platform fee.
5. On cancellation: sender's wallet is refunded minus any applicable cancellation fee.

### Platform Fees by Subscription Tier
| Tier | Monthly Parcel Limit | Platform Fee |
|---|---|---|
| Starter (Free) | 5 parcels/month | 10% |
| Professional | 50 parcels/month | 7% |
| Business | Unlimited | 5% |

### Auto Top-up
- A background job checks users with `auto_top_up_settings.enabled = true` whose `walletBalance` drops below `triggerAmount`.
- Uses the saved Paystack authorization code (`paystackAuthCode`) to charge the `topUpAmount` automatically.

### Paystack Webhook
#### `POST /api/webhooks/paystack`
**Auth:** Paystack HMAC signature validation  
**Handles:**
- `charge.success` → verify and credit wallet or payment
- `subscription.create` → update user subscription status
- `subscription.disable` → mark subscription cancelled

---

## Subscription Tiers & Limits

| Feature | Starter | Professional | Business |
|---|---|---|---|
| Monthly parcels | 5 | 50 | Unlimited |
| Platform fee | 10% | 7% | 5% |
| Priority matching | No | Yes | Yes |
| Insurance access | No | Yes | Yes |
| Analytics access | No | No | Yes |

---

## Notifications

The server sends push notifications (via FCM / Expo Push) for the following events:

| Event | Recipients |
|---|---|
| Parcel accepted by carrier | Sender |
| Parcel picked up | Sender, Receiver |
| Parcel in transit | Sender, Receiver |
| Parcel delivered | Sender, Receiver |
| New message received | Recipient user |
| Dispute opened | Admin/Support, Respondent |
| Dispute resolved | Complainant, Respondent |
| Wallet top-up successful | User |
| Low wallet balance | User |
| Auto top-up triggered | User |

---

## Security

- All passwords hashed with **bcrypt** (min 12 salt rounds).
- JWT access tokens expire after **15 minutes**; refresh tokens after **7 days**.
- Rate limiting applied per IP and per user on auth endpoints (e.g., max 10 login attempts per 15 minutes).
- Paystack webhooks validated via **HMAC-SHA512** signature.
- Suspended users are blocked at the sign-in step and at auth middleware.
- All sensitive user fields (passwordHash, etc.) are excluded from API responses.
- Blocked user relationships prevent messaging between blocked parties.

---

## Environment Variables Required

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Access token signing key |
| `JWT_REFRESH_SECRET` | Refresh token signing key |
| `PAYSTACK_SECRET_KEY` | Paystack API secret |
| `PAYSTACK_PUBLIC_KEY` | Paystack public key |
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_PRIVATE_KEY` | Firebase service account private key |
| `FIREBASE_CLIENT_EMAIL` | Firebase service account email |
| `FCM_SERVER_KEY` | Firebase Cloud Messaging key |
| `SENTRY_DSN` | Error tracking (optional) |
| `NODE_ENV` | `development` or `production` |

---

## Landing Page Backend

The landing page needs the following public endpoints:

#### `GET /api/public/stats`
Returns high-level platform stats for the marketing page:
```json
{
  "totalDeliveries": 12540,
  "activeCarriers": 890,
  "citiesCovered": 45,
  "averageRating": 4.8
}
```

#### `POST /api/public/waitlist`
**Body:** `{ "email": "user@example.com", "name": "Jane" }`  
Adds email to a waitlist/early access table.  
**Response:** `201`

#### `POST /api/public/contact`
**Body:** `{ "name": "...", "email": "...", "message": "..." }`  
Sends an enquiry to the support inbox.  
**Response:** `200`

---

## Error Response Format

All errors follow a consistent format:

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

### HTTP Status Codes Used
| Code | Meaning |
|---|---|
| 200 | OK |
| 201 | Created |
| 204 | No Content (delete success) |
| 400 | Bad Request (validation failure) |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (insufficient role/permission) |
| 404 | Not Found |
| 409 | Conflict (e.g., duplicate email) |
| 429 | Too Many Requests (rate limited) |
| 500 | Internal Server Error |

---

## API Base URL Structure

```
Production:  https://api.parcelpeer.app/api
Development: http://localhost:5000/api
```

All endpoints are prefixed with `/api`.
