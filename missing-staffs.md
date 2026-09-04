# Outstanding / Missing Items — The GTW Web App

Generated: July 2026. Based on full codebase audit.

---

## 1. AI Features — Server built, Web UI missing

The AI endpoints exist and work (when `OPENAI_API_KEY` is set) but most have no trigger in the web app.

| Feature | Server endpoint | Web UI status |
|---|---|---|
| Improve description | `POST /api/ai/parcel/description` | ❌ No button on CreateParcelPage |
| Suggest price | `POST /api/ai/parcel/price` | ❌ No button on CreateParcelPage |
| Smart replies | `POST /api/ai/chat/replies` | ❌ No trigger in ConversationPage |
| AI route stop suggestions | `POST /api/ai/route/stops` | ❌ No trigger in CreateRoutePage |
| Photo auto-fill | `POST /api/ai/parcel/photo` | ⚠️ Hook exists (`useAI.ts`) but UI button not confirmed wired |
| Match insights | `POST /api/ai/route/match-insights` | ⚠️ Hook exists but not confirmed shown in RouteDetailPage |
| AI Assistant chat | `POST /api/ai/assistant` | ❌ No page/screen in web app (was only in mobile `AIAssistantScreen.tsx`) |
| Smart search | `POST /api/ai/search/parse` | ⚠️ Partially wired in BrowsePage |

**Action needed:** Add AI buttons to CreateParcelPage, ConversationPage, CreateRoutePage, and create an AI Assistant page in web app.

---

## 2. Receiver Enhancements — Server built, no Web UI

| Feature | Server file / endpoint | Web UI status |
|---|---|---|
| Request receiver confirmation | `POST /api/receiver-confirmations/request` | ❌ No page |
| Receiver stats | `GET /api/receiver/stats` | ❌ No page |
| Receiver location sharing | `PATCH /api/parcels/:id/receiver-location` | ❌ No toggle UI (was in mobile `IncomingParcelDetailScreen`) |

**Action needed:** Add receiver location sharing toggle to `IncomingParcelDetailPage.tsx`.

---

## 3. Live Tracking — No Web UI

The server exposes carrier location and ETA endpoints. The web app has no live tracking map view.

| Feature | Server endpoint | Web UI status |
|---|---|---|
| Get carrier location | `GET /api/parcels/:id/carrier-location` | ❌ No map view |
| ETA calculation | `GET /api/parcels/:id/eta` | ❌ Not shown anywhere |
| Parcel photos (pickup/delivery) | `GET /api/parcels/:id/photos` | ❌ No photo verification screen |
| Upload pickup/delivery photo | `POST /api/parcels/:id/photos/upload` | ❌ No upload UI for carriers |

**Action needed:** Create `LiveTrackingPage` and `PhotoVerificationPage` for the web app.

---

## 4. Notifications — No Web UI

Full notifications system is built on the server (DB-persisted, Expo push). Web has no notification feed.

| Feature | Status |
|---|---|
| Notification list | `GET /api/notifications` — ❌ no page |
| Unread count badge | `GET /api/notifications/unread-count` — ❌ not shown |
| Mark as read | `POST /api/notifications/:id/read` — ❌ no UI |
| Bell icon / notification feed page | ❌ not implemented in web |

**Action needed:** Create `NotificationsPage` and wire bell icon in the top bar.

---

## 5. Route Bookings — Partially missing from Web UI

The booking approval flow (session 9) was built for mobile. Web only shows routes but booking request/approval is incomplete.

| Feature | Status |
|---|---|
| Sender requests to add parcel to a route | ❌ No "Request to book" button on `RouteDetailPage` |
| Carrier views/approves/declines booking requests | ❌ No bookings panel on `RouteDetailPage` |
| Sender views outgoing bookings | ❌ No page (`GET /api/bookings/outgoing`) |
| Carrier views incoming bookings | ❌ No page (`GET /api/bookings/incoming`) |

**Action needed:** Add booking request flow to `RouteDetailPage` and create a bookings list page.

---

## 6. Incomplete Server-Side Logic

| Item | Location | Issue |
|---|---|---|
| Password reset | `server/auth-routes.ts:353` | TODO comment — reset token/email not fully implemented |
| Role-based access control | `server/jwt-middleware.ts:56` | TODO — RBAC not implemented |
| Disk space health check | `server/health-check.ts:75` | Not implemented |
| Contact form backend | `POST /api/contact` | Logs to console only, no email sent |
| Complaints backend | `POST /api/complaints` | Logs to console only, no storage |
| Admin check-expiry | `POST /api/admin/check-expiry` | No UI trigger |

---

## 7. Missing Web Pages (vs Mobile)

Pages that existed on mobile but have no equivalent in the web app:

| Mobile screen | Web equivalent needed |
|---|---|
| `NotificationsScreen` | `NotificationsPage` |
| `AIAssistantScreen` | `AIAssistantPage` |
| `LiveTrackingScreen` | `LiveTrackingPage` |
| `PhotoVerificationScreen` | `PhotoVerificationPage` |
| `RequestRouteBookingScreen` | Integrated into `RouteDetailPage` |
| `IncomingParcelDetailScreen` receiver location toggle | Add to `IncomingParcelDetailPage` |

---

## 8. Payments & Wallet Gaps

| Item | Status |
|---|---|
| Paystack `PAYSTACK_SECRET_KEY` not configured | Will cause 500 errors on all payment routes |
| Payment methods page (`/payment-methods`) | No route in `App.tsx` |
| Wallet auto top-up — save button | Was fixed in session 7, verify still works |
| Paystack webhook handler | Exists on server, not tested end-to-end |

---

## 9. Auth & Security Gaps

| Item | Status |
|---|---|
| `JWT_SECRET` / `REFRESH_TOKEN_SECRET` not set | Auth tokens will fail |
| `FIREBASE_SERVICE_ACCOUNT_JSON` not set | Server falls back to REST API (functional but limited) |
| Push notifications | `EXPO_PUBLIC_FIREBASE_API_KEY` used instead of service account — Expo push notifications won't work in web context |
| Blocked users list | `GET /api/users/:userId/blocked` exists but no web UI |

---

## 10. Design / UX Gaps

| Item | Status |
|---|---|
| Empty states | Some pages show blank when no data, need empty state illustrations |
| Error boundaries | No global error boundary in web app |
| Loading skeletons | Most pages use spinner — consider skeleton screens |
| Mobile responsiveness | Web app is desktop-first; mobile breakpoints need review |
| Parcel status timeline | No visual step tracker on `ParcelDetailPage` |
| `replit.md` file | Getting very large — consider trimming to keep it manageable |

---

## Priority Order (suggested)

1. **High** — Notifications page + bell icon (users need to know what's happening)
2. **High** — Photo upload / pickup verification for carriers (core delivery flow)
3. **High** — Route booking request/approval flow (core carrier feature)
4. **Medium** — Live tracking map page
5. **Medium** — AI buttons wired to CreateParcelPage and ConversationPage
6. **Medium** — AI Assistant page
7. **Low** — Receiver location sharing toggle
8. **Low** — Contact/complaints proper backend (email integration)
9. **Low** — RBAC and password reset completion
