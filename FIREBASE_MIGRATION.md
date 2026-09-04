# Firebase Migration to REST API

## Summary
The client application has been migrated from Firebase Realtime Database/Firestore to a REST API backend approach. This allows the entire backend to use PostgreSQL and removes the dependency on Firebase services.

## Key Changes

### 1. Authentication
- **Before**: Firebase Authentication
- **After**: JWT tokens stored in AsyncStorage
- Updated `client/contexts/AuthContext.tsx` to use API endpoints

### 2. Data Storage
- **Before**: Firestore collections (parcels, users, messages, etc.)
- **After**: PostgreSQL database accessed via REST API
- All data operations now go through `client/lib/api.ts` helper functions

### 3. Real-time Updates
- **Before**: Firestore listeners with `onSnapshot()`
- **After**: Polling via React Query or WebSocket connections (to be implemented)
- Hooks can be updated to use React Query's `useQuery` and `useMutation`

## Migration Steps for Remaining Hooks

The following hooks still have Firebase imports and need to be updated:
- `client/hooks/useParcels.tsx`
- `client/hooks/useConnections.tsx`
- `client/hooks/useConversations.tsx`
- `client/hooks/useMessages.tsx`
- `client/hooks/useCarrierLocation.tsx`
- `client/hooks/useReceiverLocation.tsx`
- `client/hooks/useUserSearch.tsx`

### Pattern for Updating Hooks

Replace Firestore operations with API calls:

```typescript
// Before (Firestore)
import { collection, query, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

useEffect(() => {
  const q = query(collection(db, "parcels"));
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    setParcels(data);
  });
  return unsubscribe;
}, []);

// After (REST API)
import { get } from "@/lib/api";

useEffect(() => {
  const fetchParcels = async () => {
    const data = await get("/parcels");
    setParcels(data);
  };
  fetchParcels();
}, []);
```

## API Endpoints Required

Make sure the backend implements these endpoints:
- `GET /api/parcels` - List parcels
- `GET /api/parcels/:id` - Get parcel details
- `POST /api/parcels` - Create parcel
- `PUT /api/parcels/:id` - Update parcel
- `GET /api/messages` - List messages
- `POST /api/messages` - Send message
- `GET /api/users/:id` - Get user profile
- `PUT /api/users/:id` - Update user profile

## Files Updated
- ✅ `client/contexts/AuthContext.tsx` - JWT auth
- ✅ `client/lib/api.ts` - REST API helpers
- ✅ `client/lib/firebase.ts` - Deprecated (kept for compatibility)
- ✅ `client/lib/query-client.ts` - Updated token retrieval
- ✅ `client/lib/notifications.ts` - API-based push tokens
- ⏳ `client/hooks/*.tsx` - Need individual updates

## Next Steps
1. Update remaining hooks to use REST API
2. Implement WebSocket connections if real-time updates are needed
3. Update screens to handle the new async data loading patterns
4. Test all CRUD operations
5. Remove Firebase completely once all hooks are migrated
