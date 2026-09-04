# The GTW - Parcel Route-Matching App

## Overview
The GTW is a mobile-first parcel delivery route-matching platform that connects senders and carriers along shared routes. Users can both send parcels and transport parcels, enabling a peer-to-peer delivery network.

## Core Features
- **Browse Parcels**: Search and filter parcels by origin/destination routes
- **Create Parcels**: Simple form to create parcel listings with size, pickup date, and compensation
- **My Parcels**: View parcels you've created or are transporting
- **Messages**: Chat with other users to coordinate pickups and deliveries
- **Profile**: User profile with stats, ratings, and settings
- **OSM Maps**: Parcel detail pages show interactive OpenStreetMap maps with origin/destination pins and route line

## Route Matching Logic
The app matches parcels based on:
1. Origin to destination (exact matches)
2. Intermediate stops along the route
3. Parcels from any location between origin/destination

## Tech Stack
- **Frontend**: React Native with Expo SDK 54
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **State Management**: React Query for server state
- **Navigation**: React Navigation 7 (bottom tabs + stack navigators)
- **UI**: Premium design system — deep navy (#0F172A) + orange (#F97316) accent, white card surfaces, custom Shadows utility

## Project Structure
```
client/
├── App.tsx                    # Root with providers
├── components/
│   ├── Button.tsx            # Primary button component
│   ├── Card.tsx              # Card with elevation
│   ├── ErrorBoundary.tsx     # Error handling
│   ├── FloatingActionButton.tsx # FAB for create parcel
│   ├── HeaderTitle.tsx       # App header with logo
│   ├── ParcelCard.tsx        # Parcel listing card
│   ├── ReceiverSearchModal.tsx # Modal to search and select receivers
│   └── ThemedText/View.tsx   # Themed components
├── constants/
│   └── theme.ts              # Colors, spacing, typography
├── hooks/
│   ├── useConversations.tsx  # Messages state (React Query)
│   ├── useParcels.tsx        # Parcels state (React Query)
│   ├── useTheme.ts           # Theme hook
│   └── useUserSearch.tsx     # Search users for receiver selection
├── lib/
│   └── query-client.ts       # React Query client and API helpers
├── navigation/
│   └── ...                   # Stack and tab navigators
└── screens/
    └── ...                   # All app screens

server/
├── index.ts                  # Express server entry point
├── routes.ts                 # API route handlers
└── storage.ts                # Database storage class

shared/
└── schema.ts                 # Drizzle database schema
```

## Database Schema
- **users**: id, name, email, phone, rating, verified, createdAt
- **parcels**: id, origin, destination, intermediateStops, size, weight, description, specialInstructions, isFragile, compensation, pickupDate, status, senderId, transporterId, receiverId, receiverName, receiverPhone, receiverEmail, receiverLat, receiverLng, receiverLocationUpdatedAt, createdAt
- **conversations**: id, parcelId, participant1Id, participant2Id, createdAt
- **messages**: id, conversationId, senderId, text, createdAt

## AI Features (OpenAI)
Powered by `OPENAI_API_KEY` (configure in Secrets to enable).
- **Improve Description**: AI rewrites parcel descriptions on the Create Parcel screen
- **Suggest Price**: AI proposes a fair compensation amount based on route, size, weight, fragility
- **Smart Replies**: AI suggests 3 quick replies in conversations (chat icon next to input)
- **AI Stop Suggestions**: AI suggests intermediate stops on the Create Route screen
- **Photo Auto-Fill**: Vision AI analyzes a parcel photo and fills size, weight, fragile flag and description on Create Parcel
- **Smart Search**: Natural-language search bar on the Browse screen converts queries like "fragile boxes to Cape Town this week" into filters
- **Match Insights**: Carriers can tap "Explain matches with AI" on the Route Detail screen for one-line per-parcel suitability reasons
- **AI Assistant**: Full chat assistant accessible from Profile → AI Assistant

**Files:**
- `server/ai-service.ts` — OpenAI client + prompt logic (model: `gpt-4o-mini`, vision uses same model)
- `server/ai-routes.ts` — `/api/ai/status`, `/api/ai/parcel/description`, `/api/ai/parcel/price`, `/api/ai/chat/replies`, `/api/ai/route/stops`, `/api/ai/parcel/photo`, `/api/ai/search/parse`, `/api/ai/route/match-insights`, `/api/ai/assistant`
- `client/hooks/useAI.tsx` — React Query hooks (mobile)
- `client/screens/AIAssistantScreen.tsx` — Assistant chat screen
- `web/src/hooks/useAI.ts` — React Query hooks (web): photo auto-fill, smart search, match insights
- Web pages wired: `CreateParcelPage.tsx` (photo auto-fill + weight/fragile fields), `BrowsePage.tsx` (smart search), `RouteDetailPage.tsx` (match insights)

When the key is missing, AI endpoints return 503 with a friendly error so the rest of the app keeps working.

## API Endpoints
- `GET /api/parcels` - List all parcels with sender info
- `GET /api/parcels/:id` - Get single parcel
- `POST /api/parcels` - Create new parcel
- `PATCH /api/parcels/:id` - Update parcel
- `PATCH /api/parcels/:id/accept` - Accept parcel for transport
- `DELETE /api/parcels/:id` - Delete parcel
- `GET /api/users/:userId/conversations` - Get user conversations
- `POST /api/conversations` - Create conversation
- `GET /api/conversations/:id/messages` - Get messages
- `POST /api/conversations/:id/messages` - Send message
- `DELETE /api/messages/:id` - Delete message
- `PATCH /api/parcels/:id/receiver-location` - Update receiver's live location (receiver only)

## Receiver Location Sharing
Receivers can share their live location with carriers for easier delivery:
1. When creating a parcel, sender selects a receiver from the user search
2. The receiverId is saved with the parcel
3. Receiver can toggle location sharing in IncomingParcelDetailScreen
4. Location is synced to Firebase (real-time) and server (persistence)
5. Carrier sees receiver location on map in ParcelDetailScreen

**Files:**
- `client/hooks/useReceiverLocation.tsx` - Hook for location sharing with Firebase
- `client/screens/IncomingParcelDetailScreen.tsx` - Receiver UI for sharing location
- `client/screens/ParcelDetailScreen.tsx` - Carrier view with map

## Design System
- **Primary Color**: Deep Teal (#0A7EA4)
- **Secondary Color**: Warm Orange (#F97316)
- **Icons**: Feather icons from @expo/vector-icons
- **Border Radius**: 8px (inputs), 12px (cards)
- **Spacing**: 4, 8, 12, 16, 20, 24, 32px scale

## Environment Setup (Replit)
- The server runs via `NODE_ENV=production npx tsx server/index.ts` on port 5000
- Database: Replit-managed PostgreSQL (DATABASE_URL secret is auto-provisioned)
- Firebase Admin: Requires `FIREBASE_SERVICE_ACCOUNT_JSON` secret for push notifications
- Payments: Requires `PAYSTACK_SECRET_KEY` secret for payment processing
- Auth tokens: Requires `JWT_SECRET` and `REFRESH_TOKEN_SECRET` secrets
- Admin email: `ADMIN_EMAIL` env var for admin routes
- **IMPORTANT — npm devDependencies**: The Replit environment sets `omit=dev` globally in npm config, which silently skips devDependencies on plain `npm install`. Always use `npm install --include=dev` when installing root packages to ensure TypeScript, eslint-config-expo, and other devDeps are written to node_modules.

## Workflow
- **Start dev servers**: Runs Express backend on port 5000 (webview)
- Database migrations: Run `npm run db:push` to sync schema changes

## App Variants (Sender vs Carrier)
The project ships as a single Expo codebase that can launch in two modes:
- **Default (The GTW)**: full app — sender + carrier with a mode toggle in the BrowseScreen header.
- **Carrier-only (The GTW Carrier)**: locked to carrier mode, no toggle, no sender FAB. Selected at runtime via:
  - Web preview: append `?variant=carrier` to the URL (the canvas has a dedicated iframe for this).
  - Native: set env `EXPO_PUBLIC_APP_VARIANT=carrier` at build time (for separate APK/IPA with bundle id `com.thegtw.carrier`, configure `app.config.js` to read this env var).
- Detection lives in `client/contexts/ModeContext.tsx` (`detectVariantLock()`). When locked, `toggleMode`/`setMode` are no-ops and `isLocked: true` is exposed.
- Existing UI (e.g. `BrowseScreen` header toggle) hides when `isLocked` is true. Tab navigator already swaps to carrier-tabs in carrier mode.

## Recent Changes
- April 2026 (Session 11 — Carrier App Variant):
  - Added carrier-locked variant via `?variant=carrier` URL flag (web) or `EXPO_PUBLIC_APP_VARIANT=carrier` env var (native).
  - `client/contexts/ModeContext.tsx`: new `detectVariantLock()` helper, `isLocked` exposed on context, mode setters become no-ops when locked.
  - `client/screens/BrowseScreen.tsx`: hides the Sender/Carrier header toggle when `isLocked`.
  - Canvas now shows two side-by-side iframes: the original GTW app and the carrier-locked variant.
  - Cleaned up `.replit` ports (removed unused 3000/3001/3002/8082→3000/8083→3003 leftovers from removed admin/web setups; kept 5000:80 and 8081:8081, added 8082:8082).

- April 2026 (Session 10 — Realtime Messaging & Presence):
  - Added WebSocket realtime layer (`server/realtime.ts`) attached to the existing HTTP server on path `/ws`. Auth via Firebase ID token in `?token=` query string. Tracks online users in-memory (`Map<userId, Set<WebSocket>>`) and broadcasts `presence:update` when users come/go.
  - Server now broadcasts realtime events: `message:new` after `POST /api/parcels/:id/messages`, `parcel:status` after parcel accept and pickup/delivery photo (with `onTheMove: true` for "In Transit").
  - New endpoint `GET /api/users/online?ids=a,b,c` returns `{ online, lastSeen }` per user.
  - Client realtime hook (`client/hooks/useRealtime.tsx`): singleton WS with auto-reconnect (exponential backoff), heartbeat ping every 25s, exposes `RealtimeMount` (mounted in `App.tsx`), `useRealtimeEvents`, and `usePresence` hooks.
  - `useMessages` no longer polls every 5s — it appends new messages from realtime events and falls back to a 30s refetch only if the socket drops.
  - `ParcelChatScreen` header now shows the other party's online dot + "Last seen Xm ago" and a green "On the move" badge when the parcel status is `Picked Up` or `In Transit`.
  - **Web parity**: added `web/src/lib/realtime.ts` (mirror of mobile hook), mounted via `useRealtimeMount()` in `App.tsx > AppLayout`. `web/src/pages/ConversationPage.tsx` and `MessagesPage.tsx` now drop their 5s/10s polling for realtime — chat updates instantly, conversation list refreshes on new messages, conversation list shows a green-dot avatar overlay for online partners, and the chat top bar shows the other party's online status + "On the move" badge. Extended `TopBar` to accept an optional `subtitle` ReactNode.
  - No external API keys (OpenAI etc.) required for any of the above.

- April 2026 (Session 9 — Route Booking Approval Flow):
  - Added `route_bookings` table (`shared/schema.ts`) with status enum (Pending/Approved/Declined/Cancelled), pickup/dropoff stops, message, and response note
  - New API endpoints in `server/routes.ts`:
    - `POST /api/routes/:routeId/bookings` — sender requests to add a paid parcel to a route (validates ownership, status, capacity, size, weight; enforces one pending request per parcel)
    - `GET /api/routes/:routeId/bookings` — route owner views requests for that route
    - `GET /api/bookings/incoming` / `GET /api/bookings/outgoing` — carrier/sender lists
    - `PATCH /api/bookings/:id/approve` — links parcel to carrier (transporterId + status=Accepted), increments route capacityUsed, notifies sender
    - `PATCH /api/bookings/:id/decline` — notifies sender (parcel stays available)
    - `PATCH /api/bookings/:id/cancel` — sender cancels their own pending request
  - Added storage methods in `server/storage.ts` for booking CRUD and queries
  - Added `notifyNewRouteBookingRequest` and `notifyRouteBookingDecision` to `server/notification-service.ts` for push + in-app notifications
  - New mobile screen `client/screens/RequestRouteBookingScreen.tsx` — sender selects from their paid+unassigned parcels, picks pickup/dropoff stops along the route, optional note, sends request
  - New hook `client/hooks/useRouteBookings.tsx` — wraps booking mutations and queries
  - Updated `RouteDetailScreen` — non-owners see "Request to add my parcel" button; owners see a Booking Requests panel with Approve/Decline buttons and a pending count badge
  - Registered `RequestRouteBooking` screen in `MyRoutesStackNavigator`
- April 2026 (Session 8 — Push Notifications & Tracking):
  - Implemented real Expo Push Notifications in `server/notification-service.ts` — was previously just logging; now sends via Expo Push API (`https://exp.host/--/api/v2/push/send`)
  - Added push notification triggers in `server/routes.ts`:
    - Parcel accepted → sender receives "Carrier Found!" notification; receiver also notified
    - Pickup photo upload → status becomes "In Transit"; sender + receiver notified
    - Delivery photo upload → status becomes "Delivered"; sender + receiver notified
    - New message sent → all other participants (sender/carrier/receiver) notified
  - Added notification deep linking (`client/hooks/useNotifications.tsx`):
    - Tapping parcel status/accepted notifications → navigates to ParcelDetail
    - Tapping new message notification → navigates to ParcelChat
    - Tapping incoming parcel notification → navigates to IncomingTab
  - Created `client/lib/navigationRef.ts` and attached to `NavigationContainer` in `App.tsx` to support out-of-component navigation
  - Fixed `LiveTrackingScreen.tsx` — was hitting non-existent `/location/history` endpoint; now correctly polls `/api/parcels/:id/carrier-location` every 15 seconds
  - Fixed `LiveTrackingScreen.tsx` — now supports tracking for "Accepted" + "Picked Up" + "In Transit" statuses (was only "In Transit")
  - Fixed DB — ran `db:push` to sync `routes` table that was missing
- April 2026 (Session 7 — UX Polish):
  - BrowseScreen: Fixed `recentActivity` to show only the user's own relevant parcels (mode-aware, sorted by most recent); now handles Accepted/Picked Up status icons too
  - BrowseScreen: Changed carrier mode accent from orange-dark to blue (#3B82F6 = Colors.info) for clear visual distinction; both the header toggle and welcome banner use blue in carrier mode
  - BrowseScreen: Wired up the "See all" button in Recent Activity to navigate to DeliveriesTab (carrier) or MyParcelsTab (sender)
  - BrowseScreen: Wired up notification bell in the welcome banner to navigate to MessagesTab
  - ConversationScreen: Added `KeyboardAvoidingView` so the message input doesn't get hidden by the software keyboard on mobile
  - ParcelChatScreen: Same KeyboardAvoidingView fix for message input
  - IncomingScreen: Fixed `handleRefresh` to properly await `refetch()` before dismissing the refresh spinner
  - Web BrowsePage: Fixed stats to use the current user's own parcels/deliveries (not all platform-wide), now mode-aware (carrier shows blue Active/Available/Completed/All Jobs; sender shows orange In Transit/Pending/Delivered/My Parcels)
  - Web BrowsePage: Added carrier-specific quick actions (Find Jobs, Deliveries, My Routes) and mode-aware FAB (blue "+" for carrier routes, orange "+" for sender create-parcel)
  - Web Sidebar: Carrier mode toggle button and active nav links now use blue; sender uses orange (previously both used orange)
  - Web BottomNav: Active tab indicator now uses blue for carrier mode and orange for sender mode

- April 2026 (Session 6 — Mode UX + DB Fix):
  - Fixed "routes" table missing from DB — ran db:push to sync schema
  - Added mode toggle pill to BrowseScreen header (via useLayoutEffect/headerRight) — tapping it instantly switches between Sender/Carrier mode without going to Profile
  - Fixed stat cards to be mode-aware: sender mode shows In Transit, Pending, Delivered, My Parcels counts (own parcels only); carrier mode shows Active deliveries, Completed, Earnings ($), All Jobs (own deliveries only)
  - Added `format` function to StatCard type — earnings stat displays as `$X,XXX`
  - Fixed quick actions for carrier mode: Find Jobs, Deliveries, My Routes, Earnings; sender mode unchanged (Scan, Track, Send, History)
  - Fixed carrier quick actions navigation: "Deliveries" → DeliveriesTab, "Routes" → MyRoutesTab, "Earnings" → ProfileTab

- April 2026 (Session 5 — Feature Completion):
  - Fixed `routes` table missing from DB — ran db:push to create it
  - Added `parcel_photos` table to schema (id, parcelId, uploadedBy, photoUrl, photoType, caption, lat, lng, createdAt)
  - Added photo API endpoints: `GET /api/parcels/:id/photos` and `POST /api/parcels/:id/photos/upload`
  - Photo upload automatically updates parcel status: pickup photo → "In Transit", delivery photo → "Delivered"
  - Registered `PhotoVerificationScreen` and `LiveTrackingScreen` in BrowseStackNavigator, MyParcelsStackNavigator, and DeliveriesStackNavigator (were missing — navigation would fail)
  - Fixed parcel accept flow: server now sets status to "Accepted" (was "In Transit"), allowing pickup verification step
  - Updated `ParcelDetailScreen`: "Verify Pickup" now shows for status "Accepted" (not "Pending")
  - Fixed `acceptParcel` in useParcels hook: now calls `/api/parcels/:id/accept` with transporterId (was using wrong endpoint)
  - Updated Parcel status type to include all values: Pending, Paid, Accepted, Picked Up, In Transit, Arrived, Delivered, Expired
  - Fixed `GET /api/parcels` to support query filtering by senderId, receiverId, transporterId
  - Fixed web `DeliveriesPage` to filter by `transporterId` (was incorrectly using `carrierId`)

- April 2026 (Session 5 — Web App Bug Fixes):
  - Fixed `BrowsePage` carrier mode: now shows "Pending" + "Paid" parcels (was only "Paid"), and search now checks both `origin`/`destination` field name variants
  - Fixed `ParcelDetailPage` accept: was calling `PATCH /api/parcels/:id` (wrong) → now uses correct `PATCH /api/parcels/:id/accept`; `canAccept` now allows "Pending" and "Paid" parcels; invalidates `deliveries` cache on success
  - Fixed `ConversationPage`: when navigating via `/parcels/:parcelId/chat` it now uses the parcel messages API (`GET/POST /api/parcels/:parcelId/messages`) instead of the conversation messages API; also infers `senderRole` (sender/carrier/receiver) from parcel data
  - Fixed `IncomingParcelDetailPage` "Message Carrier" button: was navigating to `/messages` (general list) → now navigates to `/parcels/:id/chat`
  - Fixed web app workflow config to keep port 3000 detection working

- April 2026 (Session 9 — Notification System Complete):
  - Added `notifications` table to shared/schema.ts and ran db:push
  - NotificationService updated to persist notifications to DB and send real Expo push notifications
  - Added `/api/parcels/:parcelId/eta` endpoint with Haversine distance calculation
  - Added full notifications API: GET list, GET unread-count, POST mark-read, POST mark-all-read
  - Created client/screens/NotificationsScreen.tsx — full in-app notification feed with mark-as-read, mark-all-read, unread badges, deep linking, empty state, pull-to-refresh
  - Added `navigateToParcel`/`navigateToParcelChat` exports to client/lib/navigationRef.ts (shared navigation helpers)
  - Registered NotificationsScreen in ProfileStackNavigator with proper TypeScript type
  - Added "Notifications" menu item to ProfileScreen
  - Bell icon in BrowseScreen now navigates to NotificationsScreen with live dynamic unread badge
  - Profile tab in bottom tab bar now shows numeric unread notification badge
  - useNotifications hook updated to use shared navigation helpers from navigationRef.ts

- April 2026 (Session 7 — UI Crashes, Memory Leaks & Validation):
  - Fixed BrowseScreen crash: parcel.origin/destination null check on filter (`.toLowerCase()` on undefined would throw)
  - Fixed EditProfilePage: form fields now sync when profile loads asynchronously (was showing empty fields if profile arrived after first render)
  - Fixed DisputeDetailScreen memory leak: polling interval continued after unmount, causing state updates on unmounted component; added isMountedRef guard
  - Fixed WalletPage (web): "Save Auto Top-up" button had no onClick handler — now calls PATCH /api/auto-topup with validation and loading state
  - Fixed CreateParcelScreen: added validation for past pickup dates and zero/negative compensation values
  - Fixed useReviews: averageRating could produce NaN if any rating was undefined; now filters out invalid values before computing

- April 2026 (Session 6 — Auth, Payment & Wallet Bug Fixes):
  - Fixed wallet unit mismatch: walletBalance stored in kobo (smallest unit) but compensation was compared/deducted in major units — now correctly converts with * 100
  - Fixed double-charge bug: free-plan parcel creation deducted wallet AND left parcel as "Pending" (prompting another Paystack payment). Now sets parcel status to "Paid" immediately after wallet deduction
  - Fixed ProfileScreen showing "Member" for all users — was reading `subscriptionTier` (non-existent field), now correctly reads `subscriptionStatus`
  - Fixed localStorage usage in AuthContext (sendVerificationCode/verifyCode) — localStorage doesn't exist in React Native; replaced with AsyncStorage which was already imported but unused
  - Fixed updateUserProfile using a null token from AsyncStorage key that was never written — now uses auth.currentUser.getIdToken() directly and calls correct PATCH /api/users/:id endpoint
  - Fixed completeSignUp using user.id (undefined on Firebase User) instead of user.uid
  - Fixed isReceiver race condition in useParcels — added userProfile.email to queryKey so the query refetches once the user profile loads
  - Fixed misleading "Payment Pending" alert on failed/abandoned Paystack payments — now correctly says "Payment Cancelled" or "Payment Failed"
  - Fixed notifications.ts using a never-populated 'firebaseToken' AsyncStorage key — replaced with apiRequest which handles auth automatically

- April 2026 (Session 4 — API Bug Fixes & Disputes Feature):
  - Fixed Sidebar brand logo (Package icon → actual logo.png, matching auth pages)
  - Added `GET /api/conversations/:id` server endpoint (was missing, needed by ConversationPage)
  - Fixed MessagesPage: was calling `/api/conversations` (non-existent) → now uses `/api/users/:uid/conversations`
  - Fixed ConversationPage: message field was `content` but DB/API uses `text` — fixed in interface, mutation payload, and render
  - Fixed WalletPage top-up flow: was calling `/api/wallet/topup` (non-existent) → now calls `/api/wallet/topup/initialize` with `{amount, currency, email}` and redirects to Paystack authorization_url
  - Fixed AuthContext profile update: was using HTTP PUT → now uses PATCH to match `PATCH /api/users/:id` server route
  - Added disputes and dispute_messages tables to schema (shared/schema.ts)
  - Added full disputes API: GET /api/disputes, GET /api/disputes/me, GET /api/disputes/:id, POST /api/disputes, GET /api/disputes/:id/messages, POST /api/disputes/:id/messages
  - Ran db:push to create new disputes tables in PostgreSQL

- April 2026 (Session 3 — Feature Parity): Added 3 missing web pages: ConnectionsPage (/connections), SubscriptionsPage (/subscriptions), PaymentHistoryPage (/payment-history). Improved existing pages: DeliveriesPage (filter tabs Active/Completed/All, earnings summary, progress bars), ReviewsPage (privacy settings modal, role badges As Sender/As Carrier, rating breakdown), DisputesPage (filter tabs All/Open/Resolved, refund display), BrowsePage (4-stat dashboard, quick action grid Send/Track/History), WalletPage (auto top-up toggle with threshold/amount settings, Payment History shortcut). ProfilePage now links to Connections, Subscriptions, Payment History.
- April 2026 (Session 2): Added ConnectionsPage, SubscriptionsPage, PaymentHistoryPage stubs. Rewrote DeliveriesPage, ReviewsPage, DisputesPage with improved UI.
- April 2026 (Session 1): Added missing web app pages to match mobile parity: ForgotPasswordPage, EditProfilePage, SettingsPage, CreateRoutePage, RouteDetailPage, IncomingParcelDetailPage. Wired up previously missing web app routes.
- March 2026: Removed admin dashboard (admin/) and landing page — project is now a single native app
- March 2026: Unified stack — removed legacy Python/FastAPI + MongoDB backend. Single stack: Node.js + PostgreSQL + Expo
- March 2026: Fixed client/lib/api.ts and client/lib/notifications.ts to use EXPO_PUBLIC_DOMAIN (Node.js backend on port 5000) instead of hardcoded localhost:3001
- March 2026: Removed orphaned backend/ (Python FastAPI) and the-gtw/ directories
- March 2026: Fixed database schema push — created all required tables in PostgreSQL
- March 2026: Switched Expo Dev Server from --tunnel (Ngrok) to --localhost mode
- December 17, 2025: Added receiver location sharing via Firebase real-time updates
- December 17, 2025: Added receiver search feature
- December 14, 2025: Backend persistence implemented with PostgreSQL and Drizzle ORM
- December 14, 2025: Initial prototype created with full navigation and in-memory data
