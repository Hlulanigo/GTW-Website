import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { storage, db } from "./storage";
import { users, parcels, conversations, messages, connections, routes, routeBookings, reviews, pushTokens, parcelMessages, carrierLocations, receiverLocations, parcelTrackingEvents, payments, walletTransactions, savedPaymentMethods, autoTopUpSettings, disputes, disputeMessages, parcelPhotos, notifications, insertParcelSchema, insertMessageSchema, insertConnectionSchema, insertRouteSchema, insertRouteBookingSchema, insertReviewSchema, insertPushTokenSchema, insertParcelMessageSchema, insertCarrierLocationSchema, insertReceiverLocationSchema, insertPaymentSchema, insertWalletTransactionSchema, insertSavedPaymentMethodSchema, insertAutoTopUpSettingsSchema, insertDisputeSchema, insertDisputeMessageSchema, insertParcelPhotoSchema } from "../shared/schema";
import { createHmac } from "crypto";
import { eq, desc, and, gte, lte, ne, sql } from "drizzle-orm";
import { requireAuth, optionalAuth, type AuthenticatedRequest } from "./firebase-admin";
import { registerReceiverEnhancements } from "./receiver-enhancements";
import { registerAIRoutes } from "./ai-routes";
import { NotificationService } from "./notification-service";
import { setupRealtime, broadcastToUsers, isUserOnline, getLastSeen } from "./realtime";

const TRACKING_EVENT_TYPES = new Set(["Accepted", "Picked Up", "In Transit", "Arrived", "Delivered"]);

function normalizedEmail(email?: string | null) {
  return email?.trim().toLowerCase() || null;
}

function isParcelParticipant(
  parcel: { senderId: string; transporterId?: string | null; receiverId?: string | null; receiverEmail?: string | null },
  user?: { uid: string; email?: string },
) {
  const email = normalizedEmail(user?.email);
  return Boolean(
    user &&
    (parcel.senderId === user.uid ||
      parcel.transporterId === user.uid ||
      parcel.receiverId === user.uid ||
      (email && normalizedEmail(parcel.receiverEmail) === email)),
  );
}

async function recordTrackingEvent(parcelId: string, eventType: string, createdByUserId: string, note?: string) {
  if (!TRACKING_EVENT_TYPES.has(eventType)) return;
  await db.insert(parcelTrackingEvents).values({
    parcelId,
    eventType: eventType as "Accepted" | "Picked Up" | "In Transit" | "Arrived" | "Delivered",
    createdByUserId,
    note: note || null,
  });
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Public Firebase config for the provider dashboard (keys are safe to expose in browser)
  app.get("/api/config/firebase", (_req, res) => {
    res.json({
      apiKey:            process.env.FIREBASE_API_KEY,
      authDomain:        process.env.FIREBASE_AUTH_DOMAIN,
      projectId:         process.env.FIREBASE_PROJECT_ID,
      storageBucket:     process.env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      appId:             process.env.FIREBASE_APP_ID,
    });
  });

  app.post("/api/auth/sync", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { uid, email } = req.user as any;
      const { name, phone } = req.body;

      let user = await storage.getUser(uid);

      if (!user) {
        user = await storage.createUser({
          id: uid,
          name: name || email?.split("@")[0] || "User",
          email: email || "",
          phone: phone || null,
          passwordHash: "firebase-auth",
        } as any);
      }

      res.json(user);
    } catch (error) {
      console.error("Auth sync error:", error);
      res.status(500).json({ error: "Failed to sync user" });
    }
  });

  app.get("/api/auth/me", optionalAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        return res.json(null);
      }
      const user = await storage.getUser(req.user.uid);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  app.get("/api/users/search", optionalAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const searchTerm = req.query.q as string;
      if (!searchTerm || searchTerm.trim().length < 2) {
        return res.json([]);
      }

      const searchLower = searchTerm.toLowerCase().trim();
      const currentUserId = req.user?.uid;

      const allUsers = await db.select().from(users);
      const results = allUsers
        .filter((user) => {
          const userName = (user.name || "").toLowerCase();
          const userEmail = (user.email || "").toLowerCase();
          return (
            (currentUserId ? user.id !== currentUserId : true) &&
            (userName.includes(searchLower) || userEmail.includes(searchLower))
          );
        })
        .sort((a, b) => {
          const aNameMatch = (a.name || "").toLowerCase().startsWith(searchLower);
          const bNameMatch = (b.name || "").toLowerCase().startsWith(searchLower);
          if (aNameMatch && !bNameMatch) return -1;
          if (!aNameMatch && bNameMatch) return 1;
          return (a.name || "").localeCompare(b.name || "");
        })
        .slice(0, 10);

      res.json(results);
    } catch (error) {
      console.error("Failed to search users:", error);
      res.status(500).json({ error: "Failed to search users" });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const userId = req.params.id;

      const [deliveriesResult, connectionsResult, reviewsResult] = await Promise.all([
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(parcels)
          .where(and(eq(parcels.transporterId, userId), eq(parcels.status, "Delivered"))),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(connections)
          .where(eq(connections.userId, userId)),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(reviews)
          .where(eq(reviews.revieweeId, userId)),
      ]);

      const totalDeliveries = deliveriesResult[0]?.count ?? 0;
      const connectionsCount = connectionsResult[0]?.count ?? 0;
      const reviewsCount = reviewsResult[0]?.count ?? 0;
      const successRate = totalDeliveries > 0 ? 100 : 100;

      res.json({
        ...user,
        totalDeliveries,
        connectionsCount,
        reviewsCount,
        successRate,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  app.get("/api/parcels", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { senderId, receiverId, transporterId } = req.query as {
        senderId?: string;
        receiverId?: string;
        transporterId?: string;
      };

      const userId = req.user!.uid;
      if ((senderId && senderId !== userId) || (receiverId && receiverId !== userId) || (transporterId && transporterId !== userId)) {
        return res.status(403).json({ error: "You can only query your own parcels" });
      }

      const conditions = [];
      if (senderId) conditions.push(eq(parcels.senderId, userId));
      if (receiverId) {
        const email = normalizedEmail(req.user!.email);
        conditions.push(email
          ? sql`(${parcels.receiverId} = ${userId} OR lower(${parcels.receiverEmail}) = ${email})`
          : eq(parcels.receiverId, userId));
      }
      if (transporterId) conditions.push(eq(parcels.transporterId, userId));
      if (conditions.length === 0) {
        conditions.push(ne(parcels.status, "Delivered"), ne(parcels.status, "Expired"));
      }

      const query = db
        .select({
          parcel: parcels,
          sender: users,
        })
        .from(parcels)
        .innerJoin(users, eq(parcels.senderId, users.id))
        .orderBy(desc(parcels.createdAt));

      const allParcels = conditions.length > 0
        ? await query.where(and(...conditions))
        : await query;

      const result = allParcels.map(({ parcel, sender }) => ({
        ...parcel,
        senderName: sender.name,
        senderRating: sender.rating,
        ...(!isParcelParticipant(parcel, req.user)
          ? {
              receiverPhone: undefined,
              receiverEmail: undefined,
              receiverLat: undefined,
              receiverLng: undefined,
              receiverLocationUpdatedAt: undefined,
            }
          : {}),
      }));

      res.json(result);
    } catch (error) {
      console.error("Failed to fetch parcels:", error);
      res.status(500).json({ error: "Failed to fetch parcels" });
    }
  });

  app.get("/api/parcels/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const parcelWithSender = await storage.getParcelWithSender(req.params.id);
      if (!parcelWithSender) {
        return res.status(404).json({ error: "Parcel not found" });
      }
      if (!isParcelParticipant(parcelWithSender, req.user)) {
        return res.status(403).json({ error: "You do not have access to this parcel" });
      }
      res.json({
        ...parcelWithSender,
        senderName: parcelWithSender.sender.name,
        senderRating: parcelWithSender.sender.rating,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch parcel" });
    }
  });

  app.get("/api/receiver/parcels", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const email = normalizedEmail(req.user!.email);
      const result = await db
        .select({ parcel: parcels, sender: users })
        .from(parcels)
        .innerJoin(users, eq(parcels.senderId, users.id))
        .where(email
          ? sql`(${parcels.receiverId} = ${req.user!.uid} OR lower(${parcels.receiverEmail}) = ${email})`
          : eq(parcels.receiverId, req.user!.uid))
        .orderBy(desc(parcels.createdAt));

      res.json(result.map(({ parcel, sender }) => ({
        ...parcel,
        senderName: sender.name,
        senderRating: sender.rating,
      })));
    } catch (error) {
      console.error("Failed to fetch receiver parcels:", error);
      res.status(500).json({ error: "Failed to fetch incoming parcels" });
    }
  });

  app.get("/api/parcels/:parcelId/tracking-events", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const parcel = await storage.getParcel(req.params.parcelId);
      if (!parcel) return res.status(404).json({ error: "Parcel not found" });
      if (!isParcelParticipant(parcel, req.user)) {
        return res.status(403).json({ error: "You do not have access to this parcel" });
      }
      const events = await db
        .select()
        .from(parcelTrackingEvents)
        .where(eq(parcelTrackingEvents.parcelId, req.params.parcelId))
        .orderBy(desc(parcelTrackingEvents.createdAt));
      res.json(events);
    } catch (error) {
      console.error("Failed to fetch tracking events:", error);
      res.status(500).json({ error: "Failed to fetch tracking events" });
    }
  });

  app.post("/api/parcels", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const data = { ...req.body };
      if (typeof data.pickupDate === "string") data.pickupDate = new Date(data.pickupDate);
      if (typeof data.pickupWindowEnd === "string" && data.pickupWindowEnd) data.pickupWindowEnd = new Date(data.pickupWindowEnd);
      if (typeof data.deliveryWindowStart === "string" && data.deliveryWindowStart) data.deliveryWindowStart = new Date(data.deliveryWindowStart);
      if (typeof data.deliveryWindowEnd === "string" && data.deliveryWindowEnd) data.deliveryWindowEnd = new Date(data.deliveryWindowEnd);
      if (typeof data.expiresAt === "string" && data.expiresAt) data.expiresAt = new Date(data.expiresAt);

      const parsed = insertParcelSchema.safeParse({
        ...data,
        senderId: req.user!.uid,
      });
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      
      const parcelData = { ...parsed.data };
      
      try {
        const [originGeo, destGeo] = await Promise.all([
          fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(parsed.data.origin)}&limit=1`, {
            headers: { "User-Agent": "ParcelPeer/1.0" }
          }).then(r => r.json()),
          fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(parsed.data.destination)}&limit=1`, {
            headers: { "User-Agent": "ParcelPeer/1.0" }
          }).then(r => r.json())
        ]);
        
        if (originGeo[0]) {
          parcelData.originLat = parseFloat(originGeo[0].lat);
          parcelData.originLng = parseFloat(originGeo[0].lon);
        }
        if (destGeo[0]) {
          parcelData.destinationLat = parseFloat(destGeo[0].lat);
          parcelData.destinationLng = parseFloat(destGeo[0].lon);
        }
      } catch (geoError) {
        console.warn("Geocoding failed, continuing without coordinates:", geoError);
      }
      
      const parcel = await storage.createParcel(parcelData);
      
      // Send notification to receiver if receiverId is set
      if (parcel.receiverId) {
        const sender = await storage.getUser(req.user!.uid);
        await NotificationService.notifyNewIncomingParcel(
          parcel.receiverId,
          parcel.id,
          sender?.name || "Someone"
        );
      }
      
      res.status(201).json(parcel);
    } catch (error: any) {
      if (error?.message === "Insufficient wallet balance") {
        return res.status(400).json({ error: "Insufficient wallet balance. Please top up your wallet before creating a parcel." });
      }
      console.error("Failed to create parcel:", error);
      res.status(500).json({ error: "Failed to create parcel" });
    }
  });

  app.patch("/api/parcels/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const oldParcel = await storage.getParcel(req.params.id);
      if (!oldParcel) return res.status(404).json({ error: "Parcel not found" });

      const userId = req.user!.uid;
      const isParticipant = isParcelParticipant(oldParcel, req.user);
      if (!isParticipant) {
        return res.status(403).json({ error: "Forbidden" });
      }

      if (req.body.status && req.body.status !== oldParcel.status) {
        if (req.body.status === "Delivered") {
          return res.status(409).json({ error: "A receiver must confirm delivery before it can be marked Delivered" });
        }
        if (oldParcel.transporterId !== userId) {
          return res.status(403).json({ error: "Only the assigned carrier can update delivery status" });
        }
      }

      const parcel = await storage.updateParcel(req.params.id, req.body);
      if (!parcel) {
        return res.status(404).json({ error: "Parcel not found" });
      }
      
      // Send notification on status change
      if (oldParcel && parcel.status !== oldParcel.status) {
        await recordTrackingEvent(parcel.id, parcel.status || "", userId);
        if (parcel.receiverId) {
          NotificationService.notifyStatusChange(
            parcel.receiverId,
            parcel.id,
            oldParcel.status || "",
            parcel.status || ""
          ).catch(err => console.error("Failed to notify receiver:", err));
        }
        if (parcel.senderId && parcel.senderId !== parcel.receiverId) {
          NotificationService.notifyStatusChange(
            parcel.senderId,
            parcel.id,
            oldParcel.status || "",
            parcel.status || ""
          ).catch(err => console.error("Failed to notify sender:", err));
        }
      }
      
      res.json(parcel);
    } catch (error) {
      res.status(500).json({ error: "Failed to update parcel" });
    }
  });

  app.patch("/api/parcels/:id/accept", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const transporterId = req.user!.uid;
      if (!transporterId) {
        return res.status(400).json({ error: "transporterId is required" });
      }
      const originalParcel = await storage.getParcel(req.params.id);
      if (!originalParcel) {
        return res.status(404).json({ error: "Parcel not found" });
      }
      const currentUser = await storage.getUser(transporterId);
      if (originalParcel.senderId === transporterId ||
        originalParcel.receiverId === transporterId ||
        normalizedEmail(currentUser?.email) === normalizedEmail(originalParcel.receiverEmail)) {
        return res.status(403).json({ error: "The sender or receiver cannot accept their own parcel" });
      }
      if (originalParcel.transporterId || !["Pending", "Paid"].includes(originalParcel.status)) {
        return res.status(409).json({ error: `Parcel cannot be accepted while it is ${originalParcel.status}` });
      }
      const parcel = await storage.updateParcel(req.params.id, {
        transporterId,
        status: "Accepted",
      });
      if (!parcel) {
        return res.status(404).json({ error: "Parcel not found" });
      }
      await recordTrackingEvent(parcel.id, "Accepted", transporterId);
      res.json(parcel);

      // Realtime: notify all participants of acceptance
      const acceptParticipantIds = [parcel.senderId, parcel.transporterId, parcel.receiverId]
        .filter(Boolean) as string[];
      broadcastToUsers(acceptParticipantIds, {
        type: "parcel:status",
        parcelId: req.params.id,
        status: "Accepted",
        onTheMove: false,
      });

      // Notify sender that a carrier accepted their parcel
      if (originalParcel?.senderId) {
        const carrier = await storage.getUser(transporterId);
        NotificationService.notifyParcelAccepted(
          originalParcel.senderId,
          req.params.id,
          carrier?.name || "A carrier"
        ).catch(err => console.error("Failed to send accept notification:", err));
      }

      // Notify receiver if assigned
      if (originalParcel?.receiverId) {
        const carrier = await storage.getUser(transporterId);
        NotificationService.notifyStatusChange(
          originalParcel.receiverId,
          req.params.id,
          originalParcel.status || "",
          "Accepted",
          { origin: originalParcel.origin, destination: originalParcel.destination }
        ).catch(err => console.error("Failed to send receiver accept notification:", err));
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to accept parcel" });
    }
  });

  app.patch("/api/parcels/:id/receiver-location", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { lat, lng } = req.body;
      if (typeof lat !== "number" || typeof lng !== "number") {
        return res.status(400).json({ error: "lat and lng are required numbers" });
      }

      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return res.status(400).json({ error: "Invalid coordinates" });
      }

      const parcel = await storage.getParcel(req.params.id);
      if (!parcel) {
        return res.status(404).json({ error: "Parcel not found" });
      }

      const isReceiver = parcel.receiverId === req.user!.uid;
      const user = await storage.getUser(req.user!.uid);
      const isReceiverByEmail = user?.email && parcel.receiverEmail === user.email;

      if (!isReceiver && !isReceiverByEmail) {
        return res.status(403).json({ error: "Only the receiver can update the receiver location" });
      }

      const updated = await storage.updateParcel(req.params.id, {
        receiverLat: lat,
        receiverLng: lng,
        receiverLocationUpdatedAt: new Date(),
      });

      res.json(updated);
    } catch (error) {
      console.error("Failed to update receiver location:", error);
      res.status(500).json({ error: "Failed to update receiver location" });
    }
  });

  app.get("/api/users/:userId/conversations", async (req, res) => {
    try {
      const userConversations = await db
        .select()
        .from(conversations)
        .where(eq(conversations.participant1Id, req.params.userId))
        .orderBy(desc(conversations.createdAt));

      const convos2 = await db
        .select()
        .from(conversations)
        .where(eq(conversations.participant2Id, req.params.userId))
        .orderBy(desc(conversations.createdAt));

      const allConvos = [...userConversations, ...convos2];

      const result = await Promise.all(
        allConvos.map(async (conv) => {
          const otherUserId = conv.participant1Id === req.params.userId
            ? conv.participant2Id
            : conv.participant1Id;
          const otherUser = await storage.getUser(otherUserId);
          const msgs = await storage.getConversationMessages(conv.id);
          const lastMsg = msgs[msgs.length - 1];

          return {
            ...conv,
            userName: otherUser?.name || "Unknown",
            lastMessage: lastMsg?.text || "",
            lastMessageTime: lastMsg?.createdAt || conv.createdAt,
            messages: msgs.map(m => ({
              ...m,
              isMe: m.senderId === req.params.userId,
              timestamp: m.createdAt,
            })),
          };
        })
      );

      res.json(result);
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  app.get("/api/conversations/:id", optionalAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const conv = await db.select().from(conversations).where(eq(conversations.id, req.params.id)).limit(1);
      if (!conv.length) return res.status(404).json({ error: "Conversation not found" });
      const c = conv[0];
      const requesterId = req.user?.uid;
      const otherUserId = requesterId === c.participant1Id ? c.participant2Id : c.participant1Id;
      const otherUser = await storage.getUser(otherUserId);
      res.json({
        ...c,
        otherUserId,
        otherUserName: otherUser?.name || "Unknown",
      });
    } catch (error) {
      console.error("Failed to fetch conversation:", error);
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  app.get("/api/conversations/:id/messages", async (req, res) => {
    try {
      const msgs = await storage.getConversationMessages(req.params.id);
      res.json(msgs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/conversations/:id/messages", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = insertMessageSchema.safeParse({
        ...req.body,
        conversationId: req.params.id,
        senderId: req.user!.uid,
      });
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const message = await storage.createMessage(parsed.data);
      res.status(201).json(message);
    } catch (error) {
      console.error("Failed to create message:", error);
      res.status(500).json({ error: "Failed to create message" });
    }
  });

  app.post("/api/conversations", async (req, res) => {
    try {
      const conversation = await storage.createConversation(req.body);
      res.status(201).json(conversation);
    } catch (error) {
      console.error("Failed to create conversation:", error);
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      if (!req.body.id) {
        return res.status(400).json({ error: "User ID is required" });
      }
      // Check if user already exists
      const existing = await storage.getUser(req.body.id);
      if (existing) {
        return res.json(existing);
      }
      const user = await storage.createUser(req.body);
      res.status(201).json(user);
    } catch (error) {
      console.error("Failed to create user:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.patch("/api/users/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (req.user!.uid !== req.params.id) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      // Whitelist only profile fields that users are allowed to change themselves
      const allowedFields = [
        "name", "phone", "photoUrl",
        "savedLocationName", "savedLocationAddress", "savedLocationLat", "savedLocationLng",
        "deliveryInstructions", "preferredCarriers", "returnAddressName", "returnAddressDetails",
        "profileVisibility",
      ];
      const updates: Record<string, any> = {};
      for (const key of Object.keys(req.body)) {
        if (allowedFields.includes(key)) updates[key] = (req.body as any)[key];
      }
      const updated = Object.keys(updates).length
        ? await db.update(users).set(updates).where(eq(users.id, req.params.id)).returning()
        : [user];
      res.json(updated[0] || user);
    } catch (error) {
      console.error("Failed to update user:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.delete("/api/parcels/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const parcel = await storage.getParcel(req.params.id);
      if (!parcel) return res.status(404).json({ error: "Parcel not found" });
      if (parcel.senderId !== req.user!.uid) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const deleted = await storage.deleteParcel(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Parcel not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete parcel:", error);
      res.status(500).json({ error: "Failed to delete parcel" });
    }
  });

  app.delete("/api/messages/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteMessage(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Message not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete message:", error);
      res.status(500).json({ error: "Failed to delete message" });
    }
  });

  app.get("/api/users/:userId/connections", async (req, res) => {
    try {
      const userConnections = await storage.getUserConnections(req.params.userId);
      res.json(userConnections);
    } catch (error) {
      console.error("Failed to fetch connections:", error);
      res.status(500).json({ error: "Failed to fetch connections" });
    }
  });

  app.post("/api/users/:userId/connections", async (req, res) => {
    try {
      const parsed = insertConnectionSchema.safeParse({
        ...req.body,
        userId: req.params.userId,
      });
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const connectedUser = await storage.getUser(parsed.data.connectedUserId);
      if (!connectedUser) {
        return res.status(404).json({ error: "Connected user not found" });
      }
      const existing = await storage.getConnection(req.params.userId, parsed.data.connectedUserId);
      if (existing) {
        return res.status(409).json({ error: "Connection already exists" });
      }
      const connection = await storage.createConnection(parsed.data);
      res.status(201).json({ ...connection, connectedUser });
    } catch (error) {
      console.error("Failed to create connection:", error);
      res.status(500).json({ error: "Failed to create connection" });
    }
  });

  // Blocked users management
  app.get('/api/users/:userId/blocked', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (req.user!.uid !== req.params.userId) return res.status(403).json({ error: 'Forbidden' });
      const blocked = await storage.getBlockedUsers(req.params.userId);
      res.json(blocked);
    } catch (error) {
      console.error('Failed to fetch blocked users:', error);
      res.status(500).json({ error: 'Failed to fetch blocked users' });
    }
  });

  app.post('/api/users/:userId/blocked', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (req.user!.uid !== req.params.userId) return res.status(403).json({ error: 'Forbidden' });
      const { blockedUserId, blockedUserEmail } = req.body;
      let targetUserId = blockedUserId;
      if (!targetUserId && blockedUserEmail) {
        const u = await storage.getUserByEmail(blockedUserEmail);
        if (!u) return res.status(404).json({ error: 'User not found' });
        targetUserId = u.id;
      }
      if (!targetUserId) return res.status(400).json({ error: 'blockedUserId or blockedUserEmail is required' });
      const ok = await storage.blockUser(req.params.userId, targetUserId);
      if (!ok) return res.status(409).json({ error: 'Already blocked' });
      res.status(201).json({ success: true });
    } catch (error) {
      console.error('Failed to block user:', error);
      res.status(500).json({ error: 'Failed to block user' });
    }
  });

  app.delete('/api/users/:userId/blocked/:blockedUserId', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (req.user!.uid !== req.params.userId) return res.status(403).json({ error: 'Forbidden' });
      const ok = await storage.unblockUser(req.params.userId, req.params.blockedUserId);
      if (!ok) return res.status(404).json({ error: 'Not found' });
      res.status(204).send();
    } catch (error) {
      console.error('Failed to unblock user:', error);
      res.status(500).json({ error: 'Failed to unblock user' });
    }
  });

  app.delete("/api/users/:userId/connections/:connectedUserId", async (req, res) => {
    try {
      const deleted = await storage.deleteConnection(req.params.userId, req.params.connectedUserId);
      if (!deleted) {
        return res.status(404).json({ error: "Connection not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete connection:", error);
      res.status(500).json({ error: "Failed to delete connection" });
    }
  });

  app.get("/api/geocode", async (req, res) => {
    try {
      const { q } = req.query;
      if (!q || typeof q !== "string") {
        return res.status(400).json({ error: "Query parameter 'q' is required" });
      }
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5`,
        {
          headers: {
            "User-Agent": "ParcelPeer/1.0",
          },
        }
      );
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Geocoding failed:", error);
      res.status(500).json({ error: "Geocoding failed" });
    }
  });

  app.get("/api/routes", async (req, res) => {
    try {
      const allRoutes = await db
        .select({
          route: routes,
          carrier: users,
        })
        .from(routes)
        .innerJoin(users, eq(routes.carrierId, users.id))
        .where(eq(routes.status, "Active"))
        .orderBy(desc(routes.departureDate));

      const result = allRoutes.map(({ route, carrier }) => ({
        ...route,
        carrierName: carrier.name,
        carrierRating: carrier.rating,
      }));

      res.json(result);
    } catch (error) {
      console.error("Failed to fetch routes:", error);
      res.status(500).json({ error: "Failed to fetch routes" });
    }
  });

  app.get("/api/routes/:id", async (req, res) => {
    try {
      const routeWithCarrier = await storage.getRouteWithCarrier(req.params.id);
      if (!routeWithCarrier) {
        return res.status(404).json({ error: "Route not found" });
      }
      res.json({
        ...routeWithCarrier,
        carrierName: routeWithCarrier.carrier.name,
        carrierRating: routeWithCarrier.carrier.rating,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch route" });
    }
  });

  app.get("/api/users/:userId/routes", async (req, res) => {
    try {
      const userRoutes = await storage.getUserRoutes(req.params.userId);
      res.json(userRoutes);
    } catch (error) {
      console.error("Failed to fetch user routes:", error);
      res.status(500).json({ error: "Failed to fetch user routes" });
    }
  });

  // Paystack Integration
  app.post("/api/payments/initialize", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { amount, email, metadata } = req.body;
      
      if (!amount || !email) {
        return res.status(400).json({ error: "Amount and email are required" });
      }

      const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
      if (!paystackSecretKey) {
        return res.status(500).json({ error: "Paystack configuration missing" });
      }

      // Get the base URL from request or environment
      const protocol = req.get("x-forwarded-proto") || req.protocol || "https";
      const host = req.get("x-forwarded-host") || req.get("host");
      const baseUrl = `${protocol}://${host}`;

      const response = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: Math.round(amount * 100), // Convert to kobo/cents
          email,
          metadata,
          callback_url: `${baseUrl}/api/payments/verify-web`,
        }),
      });

      const data = await response.json();
      if (!data.status) {
        throw new Error(data.message || "Failed to initialize Paystack transaction");
      }

      // Store payment record
      const platformFee = Math.round(amount * 0.03);
      const totalAmount = amount + platformFee;
      
      await storage.createPayment({
        parcelId: metadata.parcelId,
        userId: req.user!.uid,
        reference: data.data.reference,
        amount: Math.round(amount),
        platformFee,
        totalAmount,
        status: "pending",
        paymentMethod: "paystack",
        paystackData: JSON.stringify(data.data),
      });

      res.json(data.data);
    } catch (error: any) {
      console.error("Paystack initialization error:", error);
      res.status(500).json({ error: error.message || "Failed to initialize payment" });
    }
  });

  app.get("/api/payments/verify/:reference", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { reference } = req.params;
      const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
      
      if (!paystackSecretKey) {
        return res.status(500).json({ error: "Payment configuration missing" });
      }

      const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
        },
      });

      const data = await response.json();
      if (data.status && data.data.status === "success") {
        const { parcelId } = data.data.metadata;
        if (parcelId) {
          await storage.updateParcel(parcelId, { status: "Paid" });
        }
      }

      res.json(data);
    } catch (error: any) {
      console.error("Paystack verification error:", error);
      res.status(500).json({ error: error.message || "Failed to verify payment" });
    }
  });

  // Paystack webhook endpoint
  app.post("/api/payments/webhook", async (req, res) => {
    try {
      const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
      if (!paystackSecretKey) {
        console.error("PAYSTACK_SECRET_KEY not configured");
        return res.status(500).json({ error: "Payment configuration missing" });
      }

      const hash = createHmac("sha512", paystackSecretKey).update(JSON.stringify(req.body)).digest("hex");
      
      if (hash !== req.headers["x-paystack-signature"]) {
        console.warn("Invalid Paystack webhook signature");
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { event, data } = req.body;
      
      if (event === "charge.success") {
        const { reference, status, metadata } = data;
        
        // Update payment record
        const payment = await storage.getPaymentByReference(reference);
        if (payment) {
          await storage.updatePayment(payment.id, { status: "success" });
          
          // Update parcel status
          if (metadata?.parcelId) {
            await storage.updateParcel(metadata.parcelId, { status: "Paid" });
          }
        }
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error("Webhook error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get payment history for authenticated user
  app.get("/api/payments/history", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const payments = await storage.getPaymentsByUserId(req.user!.uid);
      res.json(payments);
    } catch (error: any) {
      console.error("Failed to fetch payment history:", error);
      res.status(500).json({ error: error.message || "Failed to fetch payment history" });
    }
  });

  // Generate receipt for payment
  app.get("/api/payments/:paymentId/receipt", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const payment = await db.select().from(payments).where(eq(payments.id, req.params.paymentId));
      if (!payment.length) {
        return res.status(404).json({ error: "Payment not found" });
      }

      const paymentRecord = payment[0];
      if (paymentRecord.userId !== req.user!.uid) {
        return res.status(403).json({ error: "Not authorized to view this receipt" });
      }

      const parcelData = await storage.getParcel(paymentRecord.parcelId);
      const userData = await storage.getUser(req.user!.uid);

      const receiptHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Receipt</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
            .receipt { max-width: 500px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #007AFF; padding-bottom: 20px; }
            .header h1 { margin: 0; font-size: 24px; color: #333; }
            .header p { margin: 5px 0 0 0; color: #666; font-size: 14px; }
            .section { margin-bottom: 20px; }
            .section-title { font-weight: 600; color: #333; margin-bottom: 10px; font-size: 14px; text-transform: uppercase; color: #666; }
            .row { display: flex; justify-content: space-between; margin: 8px 0; }
            .label { color: #666; font-size: 14px; }
            .value { color: #333; font-weight: 500; font-size: 14px; font-family: monospace; }
            .divider { height: 1px; background: #eee; margin: 15px 0; }
            .total-section { background: #f9f9f9; padding: 15px; border-radius: 6px; margin-top: 20px; }
            .total-row { display: flex; justify-content: space-between; font-size: 16px; font-weight: 700; color: #007AFF; }
            .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
            .footer p { margin: 5px 0; color: #999; font-size: 12px; }
            .status-success { color: #34C759; }
            .status-pending { color: #FF9500; }
            .status-failed { color: #FF3B30; }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="header">
              <h1>Payment Receipt</h1>
              <p>ParcelPeer</p>
            </div>

            <div class="section">
              <div class="section-title">Transaction Details</div>
              <div class="row">
                <span class="label">Reference:</span>
                <span class="value">${paymentRecord.reference}</span>
              </div>
              <div class="row">
                <span class="label">Status:</span>
                <span class="value status-${paymentRecord.status || 'pending'}">${(paymentRecord.status || 'pending').toUpperCase()}</span>
              </div>
              <div class="row">
                <span class="label">Date:</span>
                <span class="value">${new Date(paymentRecord.createdAt || new Date()).toLocaleDateString()}</span>
              </div>
            </div>

            <div class="divider"></div>

            <div class="section">
              <div class="section-title">Parcel Information</div>
              <div class="row">
                <span class="label">Parcel ID:</span>
                <span class="value">${paymentRecord.parcelId}</span>
              </div>
              <div class="row">
                <span class="label">From:</span>
                <span class="value">${parcelData?.origin || 'N/A'}</span>
              </div>
              <div class="row">
                <span class="label">To:</span>
                <span class="value">${parcelData?.destination || 'N/A'}</span>
              </div>
            </div>

            <div class="divider"></div>

            <div class="section">
              <div class="section-title">Amount Breakdown</div>
              <div class="row">
                <span class="label">Base Amount:</span>
                <span class="value">R${paymentRecord.amount.toLocaleString()}</span>
              </div>
              <div class="row">
                <span class="label">Platform Fee (3%):</span>
                <span class="value">R${paymentRecord.platformFee.toLocaleString()}</span>
              </div>
            </div>

            <div class="total-section">
              <div class="total-row">
                <span>Total Paid:</span>
                <span>R${paymentRecord.totalAmount.toLocaleString()}</span>
              </div>
            </div>

            <div class="section">
              <div class="section-title">Payment Method</div>
              <div class="row">
                <span class="label">Method:</span>
                <span class="value">${paymentRecord.paymentMethod === "paystack" ? "Paystack Card" : "Cash"}</span>
              </div>
            </div>

            <div class="footer">
              <p>Payer: ${userData?.name || 'Unknown'}</p>
              <p>Email: ${userData?.email || 'N/A'}</p>
              <p style="margin-top: 15px; font-size: 11px;">Generated on ${new Date().toLocaleString()}</p>
              <p style="margin-top: 10px;">Thank you for using ParcelPeer</p>
            </div>
          </div>
        </body>
        </html>
      `;

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(receiptHTML);
    } catch (error: any) {
      console.error("Failed to generate receipt:", error);
      res.status(500).json({ error: error.message || "Failed to generate receipt" });
    }
  });

  // Web fallback for browser payment completion - verifies and redirects back into the app
  app.get("/api/payments/verify-web", async (req, res) => {
    const reference = String(req.query.reference || req.query.trxref || "");
    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;

    let status: "success" | "failed" | "cancelled" = "failed";
    let parcelId: string | undefined;

    if (reference && paystackSecretKey) {
      try {
        const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
          headers: { Authorization: `Bearer ${paystackSecretKey}` },
        });
        const data = await response.json();
        const paystackStatus = data?.data?.status;
        parcelId = data?.data?.metadata?.parcelId;

        if (data?.status && paystackStatus === "success") {
          status = "success";
          if (parcelId) {
            await storage.updateParcel(parcelId, { status: "Paid" });
          }
        } else if (paystackStatus === "abandoned") {
          status = "cancelled";
        }
      } catch (err) {
        console.error("verify-web payment verification failed:", err);
      }
    }

    const target = parcelId
      ? `/app/parcels/${encodeURIComponent(parcelId)}?payment=${status}`
      : `/app/my-parcels?payment=${status}`;

    res.send(`<!doctype html><html><head>
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <meta http-equiv="refresh" content="0; url=${target}">
      <title>Returning to app...</title>
      <style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0F172A;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center;padding:24px}.card{max-width:360px}.spinner{width:36px;height:36px;border:3px solid rgba(255,255,255,.2);border-top-color:#F97316;border-radius:50%;animation:s 1s linear infinite;margin:0 auto 16px}@keyframes s{to{transform:rotate(360deg)}}</style>
      </head><body><div class="card"><div class="spinner"></div><p>Returning you to the app...</p>
      <p style="opacity:.6;font-size:13px"><a style="color:#F97316" href="${target}">Tap here if not redirected</a></p>
      </div><script>location.replace(${JSON.stringify(target)});</script></body></html>`);
  });

  app.post("/api/routes", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      // Normalize date strings to Date objects (allow clients to send ISO strings)
      const body: any = { ...req.body };
      if (typeof body.departureDate === 'string') body.departureDate = new Date(body.departureDate);
      if (typeof body.recurrenceEndDate === 'string' && body.recurrenceEndDate) body.recurrenceEndDate = new Date(body.recurrenceEndDate);

      const parsed = insertRouteSchema.safeParse({
        ...body,
        carrierId: req.user!.uid,
      });
      if (!parsed.success) {
        const issues = parsed.error.errors
          .map((e) => `${e.path.join(".") || "field"}: ${e.message}`)
          .join("; ");
        console.error("Route validation failed:", issues, "body:", body);
        return res.status(400).json({ error: `Invalid route data — ${issues}` });
      }

      const routeData = { ...parsed.data };

      try {
        const [originGeo, destGeo] = await Promise.all([
          fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(parsed.data.origin)}&limit=1`, {
            headers: { "User-Agent": "ParcelPeer/1.0" }
          }).then(r => r.json()),
          fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(parsed.data.destination)}&limit=1`, {
            headers: { "User-Agent": "ParcelPeer/1.0" }
          }).then(r => r.json())
        ]);

        if (originGeo[0]) {
          routeData.originLat = parseFloat(originGeo[0].lat);
          routeData.originLng = parseFloat(originGeo[0].lon);
        }
        if (destGeo[0]) {
          routeData.destinationLat = parseFloat(destGeo[0].lat);
          routeData.destinationLng = parseFloat(destGeo[0].lon);
        }
      } catch (geoError) {
        console.warn("Geocoding failed, continuing without coordinates:", geoError);
      }

      const route = await storage.createRoute(routeData);
      res.status(201).json(route);
    } catch (error) {
      console.error("Failed to create route:", error);
      res.status(500).json({ error: "Failed to create route" });
    }
  });

  app.patch("/api/routes/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const existingRoute = await storage.getRoute(req.params.id);
      if (!existingRoute) {
        return res.status(404).json({ error: "Route not found" });
      }
      if (existingRoute.carrierId !== req.user!.uid) {
        return res.status(403).json({ error: "Not authorized to update this route" });
      }

      const route = await storage.updateRoute(req.params.id, req.body);
      res.json(route);
    } catch (error) {
      console.error("Failed to update route:", error);
      res.status(500).json({ error: "Failed to update route" });
    }
  });

  app.delete("/api/routes/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const existingRoute = await storage.getRoute(req.params.id);
      if (!existingRoute) {
        return res.status(404).json({ error: "Route not found" });
      }
      if (existingRoute.carrierId !== req.user!.uid) {
        return res.status(403).json({ error: "Not authorized to delete this route" });
      }

      const deleted = await storage.deleteRoute(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Route not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete route:", error);
      res.status(500).json({ error: "Failed to delete route" });
    }
  });

  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  const SIZE_ORDER = { small: 1, medium: 2, large: 3 };

  app.get("/api/routes/:routeId/matching-parcels", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const route = await storage.getRoute(req.params.routeId);
      if (!route) {
        return res.status(404).json({ error: "Route not found" });
      }

      const pendingParcels = await db
        .select({ parcel: parcels, sender: users })
        .from(parcels)
        .innerJoin(users, eq(parcels.senderId, users.id))
        .where(and(
          eq(parcels.status, "Pending"),
          ne(parcels.senderId, req.user!.uid)
        ));

      const maxDistanceKm = 50;
      const matchingParcels = pendingParcels
        .filter(({ parcel }) => {
          if (!route.originLat || !route.originLng || !route.destinationLat || !route.destinationLng) {
            return parcel.origin.toLowerCase().includes(route.origin.toLowerCase()) ||
              route.origin.toLowerCase().includes(parcel.origin.toLowerCase());
          }
          if (!parcel.originLat || !parcel.originLng || !parcel.destinationLat || !parcel.destinationLng) {
            return parcel.origin.toLowerCase().includes(route.origin.toLowerCase()) ||
              route.origin.toLowerCase().includes(parcel.origin.toLowerCase());
          }

          const originDistance = calculateDistance(
            route.originLat, route.originLng,
            parcel.originLat, parcel.originLng
          );
          const destDistance = calculateDistance(
            route.destinationLat, route.destinationLng,
            parcel.destinationLat, parcel.destinationLng
          );

          return originDistance <= maxDistanceKm && destDistance <= maxDistanceKm;
        })
        .filter(({ parcel }) => {
          const routeDate = new Date(route.departureDate);
          const parcelDate = new Date(parcel.pickupDate);
          const daysDiff = Math.abs((routeDate.getTime() - parcelDate.getTime()) / (1000 * 60 * 60 * 24));

          if (route.frequency === "one_time") {
            return daysDiff <= 2;
          } else if (route.frequency === "daily") {
            return true;
          } else if (route.frequency === "weekly") {
            return daysDiff <= 7;
          } else {
            return daysDiff <= 30;
          }
        })
        .filter(({ parcel }) => {
          if (!route.maxParcelSize) return true;
          return SIZE_ORDER[parcel.size] <= SIZE_ORDER[route.maxParcelSize];
        })
        .filter(({ parcel }) => {
          if (!route.maxWeight || !parcel.weight) return true;
          return parcel.weight <= route.maxWeight;
        })
        .map(({ parcel, sender }) => {
          let score = 100;

          if (route.originLat && route.originLng && parcel.originLat && parcel.originLng) {
            const originDistance = calculateDistance(
              route.originLat, route.originLng,
              parcel.originLat, parcel.originLng
            );
            score -= originDistance;
          }

          return {
            ...parcel,
            senderName: sender.name,
            senderRating: sender.rating,
            matchScore: Math.max(0, Math.round(score)),
          };
        })
        .sort((a, b) => b.matchScore - a.matchScore);

      res.json(matchingParcels);
    } catch (error) {
      console.error("Failed to find matching parcels:", error);
      res.status(500).json({ error: "Failed to find matching parcels" });
    }
  });

  // ========== Route Booking Requests ==========

  // Sender creates a booking request to add their parcel to a route
  app.post("/api/routes/:routeId/bookings", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const senderId = req.user!.uid;
      const route = await storage.getRoute(req.params.routeId);
      if (!route) return res.status(404).json({ error: "Route not found" });
      if (route.status !== "Active") return res.status(400).json({ error: "Route is not active" });
      if (route.carrierId === senderId) return res.status(400).json({ error: "You cannot book your own route" });

      const { parcelId, pickupStop, dropoffStop, message } = req.body || {};
      if (!parcelId) return res.status(400).json({ error: "parcelId is required" });

      const parcel = await storage.getParcel(parcelId);
      if (!parcel) return res.status(404).json({ error: "Parcel not found" });
      if (parcel.senderId !== senderId) return res.status(403).json({ error: "You don't own this parcel" });
      if (parcel.status !== "Paid") {
        return res.status(400).json({ error: "Only paid parcels can be booked onto a route" });
      }
      if (parcel.transporterId) {
        return res.status(400).json({ error: "This parcel already has a carrier" });
      }

      // Enforce: one pending request per parcel
      const existing = await storage.getPendingBookingForParcel(parcelId);
      if (existing) {
        return res.status(409).json({
          error: "You already have a pending booking request for this parcel. Cancel it before requesting another route.",
          bookingId: existing.id,
        });
      }

      // Capacity check
      if (route.availableCapacity != null) {
        const used = route.capacityUsed ?? 0;
        if (used >= route.availableCapacity) {
          return res.status(400).json({ error: "Route is at full capacity" });
        }
      }
      // Size check
      const SIZE_ORDER: Record<string, number> = { small: 1, medium: 2, large: 3 };
      if (route.maxParcelSize && SIZE_ORDER[parcel.size] > SIZE_ORDER[route.maxParcelSize]) {
        return res.status(400).json({ error: "Parcel size exceeds the route's max size" });
      }
      if (route.maxWeight != null && parcel.weight != null && parcel.weight > route.maxWeight) {
        return res.status(400).json({ error: "Parcel weight exceeds the route's max weight" });
      }

      const booking = await storage.createRouteBooking({
        routeId: route.id,
        parcelId,
        senderId,
        carrierId: route.carrierId,
        pickupStop: pickupStop || null,
        dropoffStop: dropoffStop || null,
        message: message || null,
      } as any);

      res.status(201).json(booking);

      // Notify the carrier
      const sender = await storage.getUser(senderId);
      NotificationService.notifyNewRouteBookingRequest(
        route.carrierId,
        booking.id,
        route.id,
        sender?.name || "A sender",
        `${route.origin} → ${route.destination}`
      ).catch(err => console.error("Failed to send booking request notification:", err));
    } catch (error) {
      console.error("Failed to create route booking:", error);
      res.status(500).json({ error: "Failed to create route booking" });
    }
  });

  // Carrier (route owner) views all bookings for one of their routes
  app.get("/api/routes/:routeId/bookings", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const route = await storage.getRoute(req.params.routeId);
      if (!route) return res.status(404).json({ error: "Route not found" });
      if (route.carrierId !== req.user!.uid) {
        return res.status(403).json({ error: "Not authorized" });
      }
      const bookings = await storage.getBookingsForRoute(route.id);
      res.json(bookings);
    } catch (error) {
      console.error("Failed to fetch route bookings:", error);
      res.status(500).json({ error: "Failed to fetch route bookings" });
    }
  });

  // Carrier views all incoming booking requests across their routes
  app.get("/api/bookings/incoming", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const bookings = await storage.getIncomingBookingsForCarrier(req.user!.uid);
      res.json(bookings);
    } catch (error) {
      console.error("Failed to fetch incoming bookings:", error);
      res.status(500).json({ error: "Failed to fetch incoming bookings" });
    }
  });

  // Sender views their outgoing booking requests
  app.get("/api/bookings/outgoing", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const bookings = await storage.getOutgoingBookingsForSender(req.user!.uid);
      res.json(bookings);
    } catch (error) {
      console.error("Failed to fetch outgoing bookings:", error);
      res.status(500).json({ error: "Failed to fetch outgoing bookings" });
    }
  });

  // Carrier approves a booking
  app.patch("/api/bookings/:id/approve", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const booking = await storage.getRouteBooking(req.params.id);
      if (!booking) return res.status(404).json({ error: "Booking not found" });
      if (booking.carrierId !== req.user!.uid) {
        return res.status(403).json({ error: "Only the route owner can approve" });
      }
      if (booking.status !== "Pending") {
        return res.status(400).json({ error: `Booking is already ${booking.status}` });
      }

      const parcel = await storage.getParcel(booking.parcelId);
      if (!parcel) return res.status(404).json({ error: "Parcel not found" });
      if (parcel.transporterId) {
        return res.status(400).json({ error: "Parcel already has a carrier" });
      }

      const route = await storage.getRoute(booking.routeId);
      if (!route) return res.status(404).json({ error: "Route not found" });

      // Capacity re-check
      if (route.availableCapacity != null) {
        const used = route.capacityUsed ?? 0;
        if (used >= route.availableCapacity) {
          return res.status(400).json({ error: "Route is at full capacity" });
        }
      }

      // Approve booking
      const updated = await storage.updateRouteBooking(booking.id, {
        status: "Approved",
        respondedAt: new Date(),
        responseNote: req.body?.note || null,
      });

      // Link parcel to carrier
      await storage.updateParcel(parcel.id, {
        transporterId: booking.carrierId,
        status: "Accepted",
      });

      // Increment capacity used
      await storage.updateRoute(route.id, {
        capacityUsed: (route.capacityUsed ?? 0) + 1,
      });

      res.json(updated);

      // Notifications
      const carrier = await storage.getUser(booking.carrierId);
      NotificationService.notifyRouteBookingDecision(
        booking.senderId,
        booking.id,
        booking.parcelId,
        booking.routeId,
        "Approved",
        carrier?.name || "Carrier"
      ).catch(err => console.error("Failed to send approval notification:", err));
    } catch (error) {
      console.error("Failed to approve booking:", error);
      res.status(500).json({ error: "Failed to approve booking" });
    }
  });

  // Carrier declines a booking
  app.patch("/api/bookings/:id/decline", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const booking = await storage.getRouteBooking(req.params.id);
      if (!booking) return res.status(404).json({ error: "Booking not found" });
      if (booking.carrierId !== req.user!.uid) {
        return res.status(403).json({ error: "Only the route owner can decline" });
      }
      if (booking.status !== "Pending") {
        return res.status(400).json({ error: `Booking is already ${booking.status}` });
      }

      const updated = await storage.updateRouteBooking(booking.id, {
        status: "Declined",
        respondedAt: new Date(),
        responseNote: req.body?.note || null,
      });

      res.json(updated);

      const carrier = await storage.getUser(booking.carrierId);
      NotificationService.notifyRouteBookingDecision(
        booking.senderId,
        booking.id,
        booking.parcelId,
        booking.routeId,
        "Declined",
        carrier?.name || "Carrier"
      ).catch(err => console.error("Failed to send decline notification:", err));
    } catch (error) {
      console.error("Failed to decline booking:", error);
      res.status(500).json({ error: "Failed to decline booking" });
    }
  });

  // Sender cancels their own pending booking
  app.patch("/api/bookings/:id/cancel", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const booking = await storage.getRouteBooking(req.params.id);
      if (!booking) return res.status(404).json({ error: "Booking not found" });
      if (booking.senderId !== req.user!.uid) {
        return res.status(403).json({ error: "Only the sender can cancel" });
      }
      if (booking.status !== "Pending") {
        return res.status(400).json({ error: `Booking is already ${booking.status}` });
      }

      const updated = await storage.updateRouteBooking(booking.id, {
        status: "Cancelled",
        respondedAt: new Date(),
      });
      res.json(updated);
    } catch (error) {
      console.error("Failed to cancel booking:", error);
      res.status(500).json({ error: "Failed to cancel booking" });
    }
  });

  app.get("/api/parcels/:parcelId/matching-routes", async (req, res) => {
    try {
      const parcel = await storage.getParcel(req.params.parcelId);
      if (!parcel) {
        return res.status(404).json({ error: "Parcel not found" });
      }

      const activeRoutes = await db
        .select({ route: routes, carrier: users })
        .from(routes)
        .innerJoin(users, eq(routes.carrierId, users.id))
        .where(and(
          eq(routes.status, "Active"),
          ne(routes.carrierId, parcel.senderId)
        ));

      const maxDistanceKm = 50;
      const matchingRoutes = activeRoutes
        .filter(({ route }) => {
          if (!route.originLat || !route.originLng || !route.destinationLat || !route.destinationLng) {
            return parcel.origin.toLowerCase().includes(route.origin.toLowerCase()) ||
              route.origin.toLowerCase().includes(parcel.origin.toLowerCase());
          }
          if (!parcel.originLat || !parcel.originLng || !parcel.destinationLat || !parcel.destinationLng) {
            return parcel.origin.toLowerCase().includes(route.origin.toLowerCase()) ||
              route.origin.toLowerCase().includes(parcel.origin.toLowerCase());
          }

          const originDistance = calculateDistance(
            route.originLat, route.originLng,
            parcel.originLat, parcel.originLng
          );
          const destDistance = calculateDistance(
            route.destinationLat, route.destinationLng,
            parcel.destinationLat, parcel.destinationLng
          );

          return originDistance <= maxDistanceKm && destDistance <= maxDistanceKm;
        })
        .filter(({ route }) => {
          const routeDate = new Date(route.departureDate);
          const parcelDate = new Date(parcel.pickupDate);
          const daysDiff = Math.abs((routeDate.getTime() - parcelDate.getTime()) / (1000 * 60 * 60 * 24));

          if (route.frequency === "one_time") {
            return daysDiff <= 2;
          } else if (route.frequency === "daily") {
            return true;
          } else if (route.frequency === "weekly") {
            return daysDiff <= 7;
          } else {
            return daysDiff <= 30;
          }
        })
        .filter(({ route }) => {
          if (!route.maxParcelSize) return true;
          return SIZE_ORDER[parcel.size] <= SIZE_ORDER[route.maxParcelSize];
        })
        .filter(({ route }) => {
          if (!route.maxWeight || !parcel.weight) return true;
          return parcel.weight <= route.maxWeight;
        })
        .map(({ route, carrier }) => {
          let score = 100;

          if (route.originLat && route.originLng && parcel.originLat && parcel.originLng) {
            const originDistance = calculateDistance(
              route.originLat, route.originLng,
              parcel.originLat, parcel.originLng
            );
            score -= originDistance;
          }

          return {
            ...route,
            carrierName: carrier.name,
            carrierRating: carrier.rating,
            matchScore: Math.max(0, Math.round(score)),
          };
        })
        .sort((a, b) => b.matchScore - a.matchScore);

      res.json(matchingRoutes);
    } catch (error) {
      console.error("Failed to find matching routes:", error);
      res.status(500).json({ error: "Failed to find matching routes" });
    }
  });

  app.get("/api/users/:userId/reviews", async (req, res) => {
    try {
      const userReviews = await storage.getUserReviews(req.params.userId);
      res.json(userReviews);
    } catch (error) {
      console.error("Failed to fetch reviews:", error);
      res.status(500).json({ error: "Failed to fetch reviews" });
    }
  });

  app.post("/api/reviews", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = insertReviewSchema.safeParse({
        ...req.body,
        reviewerId: req.user!.uid,
      });
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }

      const existing = await storage.getReviewByParcelAndReviewer(
        parsed.data.parcelId,
        req.user!.uid
      );
      if (existing) {
        return res.status(409).json({ error: "You have already reviewed this delivery" });
      }

      const parcel = await storage.getParcel(parsed.data.parcelId);
      if (!parcel) {
        return res.status(404).json({ error: "Parcel not found" });
      }
      if (parcel.status !== "Delivered") {
        return res.status(400).json({ error: "Can only review delivered parcels" });
      }

      const review = await storage.createReview(parsed.data);

      const revieweeTokens = await storage.getUserPushTokens(parsed.data.revieweeId);
      if (revieweeTokens.length > 0) {
        console.log(`Would send notification to ${revieweeTokens.length} devices for new review`);
      }

      res.status(201).json(review);
    } catch (error) {
      console.error("Failed to create review:", error);
      res.status(500).json({ error: "Failed to create review" });
    }
  });

  app.post("/api/push-tokens", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = insertPushTokenSchema.safeParse({
        ...req.body,
        userId: req.user!.uid,
      });
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }

      const pushToken = await storage.createOrUpdatePushToken(parsed.data);
      res.status(201).json(pushToken);
    } catch (error) {
      console.error("Failed to save push token:", error);
      res.status(500).json({ error: "Failed to save push token" });
    }
  });

  app.delete("/api/push-tokens/:token", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const deleted = await storage.deletePushToken(req.params.token);
      if (!deleted) {
        return res.status(404).json({ error: "Push token not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete push token:", error);
      res.status(500).json({ error: "Failed to delete push token" });
    }
  });

  async function checkAndExpireItems() {
    const now = new Date();
    
    try {
      const capacityFullRoutes = await db
        .update(routes)
        .set({ status: "Expired", updatedAt: now })
        .where(and(
          eq(routes.status, "Active"),
          sql`${routes.availableCapacity} IS NOT NULL AND ${routes.capacityUsed} >= ${routes.availableCapacity}`
        ))
        .returning();
      
      if (capacityFullRoutes.length > 0) {
        console.log(`Expired ${capacityFullRoutes.length} routes due to full capacity`);
      }
      
      const routesToExpire = await db
        .select()
        .from(routes)
        .where(and(
          eq(routes.status, "Active"),
          lte(routes.departureDate, now)
        ));
      
      const expiredRoutes = await db
        .update(routes)
        .set({ status: "Expired", updatedAt: now })
        .where(and(
          eq(routes.status, "Active"),
          lte(routes.departureDate, now)
        ))
        .returning();
      
      for (const expiredRoute of expiredRoutes) {
        if (expiredRoute.frequency && expiredRoute.frequency !== "one_time") {
          const shouldCreateNext = !expiredRoute.recurrenceEndDate || 
            new Date(expiredRoute.recurrenceEndDate) > now;
          
          if (shouldCreateNext) {
            const nextDate = new Date(expiredRoute.departureDate);
            switch (expiredRoute.frequency) {
              case "daily":
                nextDate.setDate(nextDate.getDate() + 1);
                break;
              case "weekly":
                nextDate.setDate(nextDate.getDate() + 7);
                break;
              case "monthly":
                nextDate.setMonth(nextDate.getMonth() + 1);
                break;
            }
            
            if (!expiredRoute.recurrenceEndDate || nextDate <= new Date(expiredRoute.recurrenceEndDate)) {
              await db.insert(routes).values({
                carrierId: expiredRoute.carrierId,
                origin: expiredRoute.origin,
                destination: expiredRoute.destination,
                originLat: expiredRoute.originLat,
                originLng: expiredRoute.originLng,
                destinationLat: expiredRoute.destinationLat,
                destinationLng: expiredRoute.destinationLng,
                intermediateStops: expiredRoute.intermediateStops,
                departureDate: nextDate,
                departureTime: expiredRoute.departureTime,
                frequency: expiredRoute.frequency,
                recurrenceEndDate: expiredRoute.recurrenceEndDate,
                maxParcelSize: expiredRoute.maxParcelSize,
                maxWeight: expiredRoute.maxWeight,
                availableCapacity: expiredRoute.availableCapacity,
                capacityUsed: 0,
                pricePerKg: expiredRoute.pricePerKg,
                notes: expiredRoute.notes,
                parentRouteId: expiredRoute.parentRouteId || expiredRoute.id,
              });
              console.log(`Created next occurrence for recurring route ${expiredRoute.id}`);
            }
          }
        }
      }
      
      const expiredParcels = await db
        .update(parcels)
        .set({ status: "Expired" })
        .where(and(
          eq(parcels.status, "Pending"),
          lte(parcels.expiresAt, now)
        ))
        .returning();
      
      if (expiredRoutes.length > 0 || expiredParcels.length > 0) {
        console.log(`Expiry check: ${expiredRoutes.length} routes, ${expiredParcels.length} parcels expired`);
      }
    } catch (error) {
      console.error("Expiry check failed:", error);
    }
  }

  app.post("/api/admin/check-expiry", async (req, res) => {
    try {
      await checkAndExpireItems();
      res.json({ success: true, message: "Expiry check completed" });
    } catch (error) {
      res.status(500).json({ error: "Failed to run expiry check" });
    }
  });

  app.get("/api/parcels/:parcelId/messages", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const parcel = await storage.getParcel(req.params.parcelId);
      if (!parcel) return res.status(404).json({ error: "Parcel not found" });
      if (!isParcelParticipant(parcel, req.user)) {
        return res.status(403).json({ error: "You do not have access to this parcel" });
      }
      const msgs = await db
        .select({ id: parcelMessages.id, parcelId: parcelMessages.parcelId, senderId: parcelMessages.senderId, senderName: users.name, senderRole: parcelMessages.senderRole, content: parcelMessages.content, createdAt: parcelMessages.createdAt })
        .from(parcelMessages)
        .innerJoin(users, eq(parcelMessages.senderId, users.id))
        .where(eq(parcelMessages.parcelId, req.params.parcelId))
        .orderBy(parcelMessages.createdAt);
      res.json(msgs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/parcels/:parcelId/messages", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const parcel = await storage.getParcel(req.params.parcelId);
      if (!parcel) {
        return res.status(404).json({ error: "Parcel not found" });
      }

      // Verify user has permission to send messages (must be sender, carrier, or receiver)
      const userId = req.user!.uid;
      const userEmail = req.user!.email;
      const isParticipant = 
        userId === parcel.senderId || 
        userId === parcel.transporterId || 
        userId === parcel.receiverId ||
        (userEmail && parcel.receiverEmail && userEmail.toLowerCase() === parcel.receiverEmail.toLowerCase());

      if (!isParticipant) {
        return res.status(403).json({ error: "You don't have permission to send messages for this parcel" });
      }

      // Messages are only allowed once a carrier has accepted the parcel
      const preAcceptedStatuses = ["Pending", "Paid"];
      if (preAcceptedStatuses.includes(parcel.status || "")) {
        return res.status(403).json({ error: "Messaging is not available until the parcel has been accepted by a carrier" });
      }

      const parsed = insertParcelMessageSchema.safeParse({
        parcelId: req.params.parcelId,
        senderId: req.user!.uid,
        content: req.body.content,
        senderRole: req.body.senderRole,
      });
      if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
      const msg = await db.insert(parcelMessages).values(parsed.data).returning();
      
      // Get sender info to return complete message
      const sender = await storage.getUser(req.user!.uid);
      const completeMsg = {
        ...msg[0],
        senderName: sender?.name || "Unknown",
      };
      
      res.json(completeMsg);

      // Realtime broadcast to all parcel participants (including sender for multi-device echo)
      const allParticipantIds = [parcel.senderId, parcel.transporterId, parcel.receiverId]
        .filter((id): id is string => !!id);
      broadcastToUsers(allParticipantIds, {
        type: "message:new",
        parcelId: req.params.parcelId,
        message: completeMsg,
      });

      // Notify other participants about the new message
      const recipientIds = [parcel.senderId, parcel.transporterId, parcel.receiverId]
        .filter((id): id is string => !!id && id !== userId);
      const uniqueRecipients = [...new Set(recipientIds)];
      for (const recipientId of uniqueRecipients) {
        NotificationService.notifyNewMessage(
          recipientId,
          req.params.parcelId,
          sender?.name || "Someone",
          req.body.content || ""
        ).catch(err => console.error("Failed to send message notification:", err));
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  app.get("/api/parcels/:parcelId/carrier-location", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const parcel = await storage.getParcel(req.params.parcelId);
      if (!parcel) return res.status(404).json({ error: "Parcel not found" });
      if (!isParcelParticipant(parcel, req.user)) {
        return res.status(403).json({ error: "You do not have access to this parcel" });
      }
      const loc = await db.select().from(carrierLocations).where(eq(carrierLocations.parcelId, req.params.parcelId)).orderBy(desc(carrierLocations.timestamp)).limit(1);
      res.json(loc[0] || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch carrier location" });
    }
  });

  app.post("/api/parcels/:parcelId/carrier-location", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = insertCarrierLocationSchema.safeParse({
        parcelId: req.params.parcelId,
        carrierId: req.user!.uid,
        lat: req.body.lat,
        lng: req.body.lng,
        heading: req.body.heading,
        speed: req.body.speed,
        accuracy: req.body.accuracy,
      });
      if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
      const loc = await db.insert(carrierLocations).values(parsed.data).returning();
      res.json(loc[0]);
    } catch (error) {
      res.status(500).json({ error: "Failed to save carrier location" });
    }
  });

  app.get("/api/parcels/:parcelId/receiver-location", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const parcel = await storage.getParcel(req.params.parcelId);
      if (!parcel) return res.status(404).json({ error: "Parcel not found" });
      if (!isParcelParticipant(parcel, req.user)) {
        return res.status(403).json({ error: "You do not have access to this parcel" });
      }
      const loc = await db.select().from(receiverLocations).where(eq(receiverLocations.parcelId, req.params.parcelId)).orderBy(desc(receiverLocations.timestamp)).limit(1);
      res.json(loc[0] || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch receiver location" });
    }
  });

  app.post("/api/parcels/:parcelId/receiver-location", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const parcel = await storage.getParcel(req.params.parcelId);
      if (!parcel) return res.status(404).json({ error: "Parcel not found" });
      const receiver = await storage.getUser(req.user!.uid);
      const isReceiver = parcel.receiverId === req.user!.uid ||
        normalizedEmail(receiver?.email) === normalizedEmail(parcel.receiverEmail);
      if (!isReceiver) return res.status(403).json({ error: "Only the receiver can share their location" });

      const parsed = insertReceiverLocationSchema.safeParse({
        parcelId: req.params.parcelId,
        receiverId: req.user!.uid,
        lat: req.body.lat,
        lng: req.body.lng,
        accuracy: req.body.accuracy,
      });
      if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
      const loc = await db.insert(receiverLocations).values(parsed.data).returning();
      res.json(loc[0]);
    } catch (error) {
      res.status(500).json({ error: "Failed to save receiver location" });
    }
  });

  checkAndExpireItems();
  setInterval(checkAndExpireItems, 60 * 60 * 1000);

  // ========== WALLET TOP-UP API ROUTES ==========
  
  // Initialize wallet top-up
  app.post("/api/wallet/topup/initialize", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { amount, currency, email } = req.body;
      
      if (!amount || !currency || !email) {
        return res.status(400).json({ error: "Amount, currency, and email are required" });
      }

      if (amount < 5 || amount > 50000) {
        return res.status(400).json({ error: "Invalid amount" });
      }

      const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
      if (!paystackSecretKey) {
        return res.status(500).json({ error: "Payment configuration missing" });
      }

      const user = await storage.getUser(req.user!.uid);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Get the base URL from request or environment
      const protocol = req.get("x-forwarded-proto") || req.protocol || "https";
      const host = req.get("x-forwarded-host") || req.get("host");
      const baseUrl = `${protocol}://${host}`;

      // Convert to smallest unit (cents, pence, etc.) - amount is already in major unit
      const amountInSmallestUnit = Math.round(amount * 100);

      const response = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: amountInSmallestUnit, // Already in smallest unit
          email,
          currency: currency.toUpperCase(),
          metadata: {
            userId: req.user!.uid,
            type: "wallet_topup",
            currency,
          },
          callback_url: `${baseUrl}/api/wallet/topup/verify-web`,
        }),
      });

      const data = await response.json();
      if (!data.status) {
        throw new Error(data.message || "Failed to initialize Paystack transaction");
      }

      // Create wallet transaction record
      await db.insert(walletTransactions).values({
        userId: req.user!.uid,
        type: "topup",
        amount: amountInSmallestUnit,
        currency: currency.toUpperCase(),
        status: "pending",
        reference: data.data.reference,
        description: `Wallet top-up`,
        paymentMethod: "paystack",
        paymentData: JSON.stringify(data.data),
        balanceBefore: user.walletBalance,
        balanceAfter: user.walletBalance, // Will be updated on success
      });

      res.json(data.data);
    } catch (error: any) {
      console.error("Wallet top-up initialization error:", error);
      res.status(500).json({ error: error.message || "Failed to initialize top-up" });
    }
  });

  // Verify wallet top-up
  app.get("/api/wallet/topup/verify/:reference", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { reference } = req.params;
      const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
      
      if (!paystackSecretKey) {
        return res.status(500).json({ error: "Payment configuration missing" });
      }

      const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
        },
      });

      const data = await response.json();
      
      if (data.status && data.data.status === "success") {
        const { metadata, amount, currency } = data.data;
        
        // Get transaction record
        const txnResult = await db
          .select()
          .from(walletTransactions)
          .where(eq(walletTransactions.reference, reference));
        
        if (txnResult.length > 0 && txnResult[0].status === "pending") {
          const transaction = txnResult[0];
          
          // Get user
          const user = await storage.getUser(metadata.userId);
          if (user) {
            // Update user wallet balance
            const newBalance = user.walletBalance + transaction.amount;
            await db
              .update(users)
              .set({ walletBalance: newBalance })
              .where(eq(users.id, metadata.userId));
            
            // Update transaction status
            await db
              .update(walletTransactions)
              .set({ 
                status: "completed",
                balanceAfter: newBalance,
                completedAt: new Date(),
              })
              .where(eq(walletTransactions.reference, reference));
          }
        }
      }

      res.json(data);
    } catch (error: any) {
      console.error("Wallet top-up verification error:", error);
      res.status(500).json({ error: error.message || "Failed to verify top-up" });
    }
  });

  // Web fallback for browser top-up completion - verifies and redirects back into the app
  app.get("/api/wallet/topup/verify-web", async (req, res) => {
    const reference = String(req.query.reference || req.query.trxref || "");
    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;

    let status: "success" | "failed" | "cancelled" = "failed";

    if (reference && paystackSecretKey) {
      try {
        const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
          headers: { Authorization: `Bearer ${paystackSecretKey}` },
        });
        const data = await response.json();
        const paystackStatus = data?.data?.status;

        if (data?.status && paystackStatus === "success") {
          const txnResult = await db
            .select()
            .from(walletTransactions)
            .where(eq(walletTransactions.reference, reference));

          if (txnResult.length > 0 && txnResult[0].status === "pending") {
            const transaction = txnResult[0];
            const user = await storage.getUser(transaction.userId);
            if (user) {
              const newBalance = user.walletBalance + transaction.amount;
              await db
                .update(users)
                .set({ walletBalance: newBalance })
                .where(eq(users.id, transaction.userId));
              await db
                .update(walletTransactions)
                .set({
                  status: "completed",
                  balanceAfter: newBalance,
                  completedAt: new Date(),
                })
                .where(eq(walletTransactions.reference, reference));
            }
          }
          status = "success";
        } else if (paystackStatus === "abandoned") {
          status = "cancelled";
        }
      } catch (err) {
        console.error("verify-web wallet verification failed:", err);
      }
    }

    const target = `/app/wallet?topup=${status}`;
    res.send(`<!doctype html><html><head>
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <meta http-equiv="refresh" content="0; url=${target}">
      <title>Returning to app...</title>
      <style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0F172A;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center;padding:24px}.card{max-width:360px}.spinner{width:36px;height:36px;border:3px solid rgba(255,255,255,.2);border-top-color:#F97316;border-radius:50%;animation:s 1s linear infinite;margin:0 auto 16px}@keyframes s{to{transform:rotate(360deg)}}</style>
      </head><body><div class="card"><div class="spinner"></div><p>Returning you to the app...</p>
      <p style="opacity:.6;font-size:13px"><a style="color:#F97316" href="${target}">Tap here if not redirected</a></p>
      </div><script>location.replace(${JSON.stringify(target)});</script></body></html>`);
  });

  // Get wallet transactions
  app.get("/api/wallet/transactions", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const transactions = await db
        .select()
        .from(walletTransactions)
        .where(eq(walletTransactions.userId, req.user!.uid))
        .orderBy(desc(walletTransactions.createdAt));
      
      res.json(transactions);
    } catch (error: any) {
      console.error("Failed to fetch wallet transactions:", error);
      res.status(500).json({ error: error.message || "Failed to fetch transactions" });
    }
  });

  // Get wallet balance
  app.get("/api/wallet/balance", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const user = await storage.getUser(req.user!.uid);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      res.json({ balance: user.walletBalance, currency: "ZAR" });
    } catch (error: any) {
      console.error("Failed to fetch wallet balance:", error);
      res.status(500).json({ error: error.message || "Failed to fetch balance" });
    }
  });

  // Payment Methods
  app.get("/api/payment-methods", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const methods = await storage.getSavedPaymentMethods(req.user!.uid);
      res.json({ data: methods });
    } catch (error: any) {
      console.error("Failed to fetch payment methods:", error);
      res.status(500).json({ error: error.message || "Failed to fetch payment methods" });
    }
  });

  app.post("/api/payment-methods", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { cardLast4, cardBrand, authorizationCode } = req.body;
      
      if (!cardLast4 || !cardBrand || !authorizationCode) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const method = await storage.createSavedPaymentMethod(
        req.user!.uid,
        cardLast4,
        cardBrand,
        authorizationCode
      );

      res.status(201).json({ data: method });
    } catch (error: any) {
      console.error("Failed to save payment method:", error);
      res.status(500).json({ error: error.message || "Failed to save payment method" });
    }
  });

  app.patch("/api/payment-methods/:methodId/default", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { methodId } = req.params;
      
      const success = await storage.setSavedPaymentMethodAsDefault(req.user!.uid, methodId);
      
      if (!success) {
        return res.status(404).json({ error: "Payment method not found" });
      }

      res.json({ status: "success" });
    } catch (error: any) {
      console.error("Failed to set default payment method:", error);
      res.status(500).json({ error: error.message || "Failed to set default payment method" });
    }
  });

  app.delete("/api/payment-methods/:methodId", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { methodId } = req.params;
      
      const success = await storage.deleteSavedPaymentMethod(methodId, req.user!.uid);
      
      if (!success) {
        return res.status(404).json({ error: "Payment method not found" });
      }

      res.json({ status: "success" });
    } catch (error: any) {
      console.error("Failed to delete payment method:", error);
      res.status(500).json({ error: error.message || "Failed to delete payment method" });
    }
  });

  // Auto Top-up Settings
  app.get("/api/auto-topup", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const settings = await storage.getAutoTopUpSettings(req.user!.uid);
      
      if (!settings) {
        return res.json({ data: null });
      }

      res.json({ data: settings });
    } catch (error: any) {
      console.error("Failed to fetch auto top-up settings:", error);
      res.status(500).json({ error: error.message || "Failed to fetch auto top-up settings" });
    }
  });

  app.patch("/api/auto-topup", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { isEnabled, triggerAmount, topupAmount, paymentMethodId } = req.body;

      const settings = await storage.updateAutoTopUpSettings(
        req.user!.uid,
        isEnabled,
        triggerAmount,
        topupAmount,
        paymentMethodId
      );

      res.json({ data: settings });
    } catch (error: any) {
      console.error("Failed to update auto top-up settings:", error);
      res.status(500).json({ error: error.message || "Failed to update auto top-up settings" });
    }
  });

  // Disputes
  app.get("/api/disputes", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.uid;
      const userDisputes = await db.select().from(disputes)
        .where(eq(disputes.complainantId, userId))
        .orderBy(desc(disputes.createdAt));
      const respondentDisputes = await db.select().from(disputes)
        .where(eq(disputes.respondentId, userId))
        .orderBy(desc(disputes.createdAt));
      const all = [...userDisputes, ...respondentDisputes].sort(
        (a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
      );
      res.json(all);
    } catch (error: any) {
      console.error("Failed to fetch disputes:", error);
      res.status(500).json({ error: "Failed to fetch disputes" });
    }
  });

  app.get("/api/disputes/me", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.uid;
      const userDisputes = await db.select().from(disputes)
        .where(eq(disputes.complainantId, userId))
        .orderBy(desc(disputes.createdAt));
      const respondentDisputes = await db.select().from(disputes)
        .where(eq(disputes.respondentId, userId))
        .orderBy(desc(disputes.createdAt));
      const all = [...userDisputes, ...respondentDisputes].sort(
        (a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
      );
      res.json(all);
    } catch (error: any) {
      console.error("Failed to fetch disputes:", error);
      res.status(500).json({ error: "Failed to fetch disputes" });
    }
  });

  app.get("/api/disputes/:id", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const result = await db.select().from(disputes).where(eq(disputes.id, req.params.id)).limit(1);
      if (!result.length) return res.status(404).json({ error: "Dispute not found" });
      res.json(result[0]);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch dispute" });
    }
  });

  app.post("/api/disputes", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = insertDisputeSchema.safeParse({ ...req.body, complainantId: req.user!.uid });
      if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
      const [dispute] = await db.insert(disputes).values(parsed.data).returning();
      res.status(201).json(dispute);
    } catch (error: any) {
      console.error("Failed to create dispute:", error);
      res.status(500).json({ error: "Failed to create dispute" });
    }
  });

  app.get("/api/disputes/:id/messages", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const msgs = await db.select().from(disputeMessages)
        .where(eq(disputeMessages.disputeId, req.params.id))
        .orderBy(disputeMessages.createdAt);
      res.json(msgs);
    } catch (error: any) {
      res.status(500).json({ error: "Failed to fetch dispute messages" });
    }
  });

  app.post("/api/disputes/:id/messages", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const parsed = insertDisputeMessageSchema.safeParse({
        ...req.body,
        disputeId: req.params.id,
        senderId: req.user!.uid,
      });
      if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
      const [msg] = await db.insert(disputeMessages).values(parsed.data).returning();
      res.status(201).json(msg);
    } catch (error: any) {
      console.error("Failed to create dispute message:", error);
      res.status(500).json({ error: "Failed to create dispute message" });
    }
  });

  // Subscriptions
  app.get("/api/subscription", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const subscription = await storage.getSubscription(req.user!.uid);
      res.json(subscription || null);
    } catch (error: any) {
      console.error("Failed to fetch subscription:", error);
      res.status(500).json({ error: error.message || "Failed to fetch subscription" });
    }
  });

  app.post("/api/subscription/upgrade", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { planId } = req.body;
      
      if (!planId) {
        return res.status(400).json({ error: "Missing planId" });
      }

      const subscription = await storage.createSubscription(req.user!.uid, planId);
      res.status(201).json(subscription);
    } catch (error: any) {
      console.error("Failed to upgrade subscription:", error);
      res.status(500).json({ error: error.message || "Failed to upgrade subscription" });
    }
  });

  app.post("/api/subscription/cancel", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const subscription = await storage.cancelSubscription(req.user!.uid);
      
      if (!subscription) {
        return res.status(404).json({ error: "No active subscription found" });
      }

      res.json(subscription);
    } catch (error: any) {
      console.error("Failed to cancel subscription:", error);
      res.status(500).json({ error: error.message || "Failed to cancel subscription" });
    }
  });

  // Contact Form Endpoint
  app.post("/api/contact", async (req, res) => {
    try {
      const { name, email, phone, subject, message } = req.body;

      // Validate required fields
      if (!name || !email || !subject || !message) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Store in database (create a contact_enquiries table if needed)
      console.log("Contact form submission:", {
        name,
        email,
        phone,
        subject,
        message,
        timestamp: new Date(),
      });

      // For now, just log and return success
      // In production, you'd store this in the database
      res.json({ success: true, message: "Contact form submitted successfully" });
    } catch (error: any) {
      console.error("Contact form error:", error);
      res.status(500).json({ error: "Failed to submit contact form" });
    }
  });

  // Complaints Endpoint
  app.post("/api/complaints", async (req, res) => {
    try {
      const { name, email, type, description, reference_id } = req.body;

      // Validate required fields
      if (!name || !email || !type || !description) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Store complaint
      console.log("Complaint submission:", {
        name,
        email,
        type,
        description,
        reference_id,
        timestamp: new Date(),
      });

      // In production, you'd store this in the database with a unique ID
      res.json({ 
        success: true, 
        message: "Complaint submitted successfully",
        complaint_id: `COMP-${Date.now()}`
      });
    } catch (error: any) {
      console.error("Complaint submission error:", error);
      res.status(500).json({ error: "Failed to submit complaint" });
    }
  });

  // Parcel Photos API
  app.get("/api/parcels/:parcelId/photos", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { parcelId } = req.params;
      const parcel = await storage.getParcel(parcelId);
      if (!parcel) return res.status(404).json({ error: "Parcel not found" });
      if (!isParcelParticipant(parcel, req.user)) {
        return res.status(403).json({ error: "You do not have access to this parcel" });
      }
      const photos = await db
        .select()
        .from(parcelPhotos)
        .where(eq(parcelPhotos.parcelId, parcelId))
        .orderBy(desc(parcelPhotos.createdAt));
      res.json(photos);
    } catch (error: any) {
      console.error("Failed to fetch parcel photos:", error);
      res.status(500).json({ error: "Failed to fetch parcel photos" });
    }
  });

  app.post("/api/parcels/:parcelId/photos/upload", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { parcelId } = req.params;
      const userId = req.user!.uid;
      const { photoData, photoType, caption, latitude, longitude } = req.body;

      if (!photoData || !photoType) {
        return res.status(400).json({ error: "photoData and photoType are required" });
      }

      const parcelResult = await db.select().from(parcels).where(eq(parcels.id, parcelId)).limit(1);
      if (!parcelResult.length) {
        return res.status(404).json({ error: "Parcel not found" });
      }

      const currentParcel = parcelResult[0];
      const isCarrier = currentParcel.transporterId === userId;
      const receiver = await storage.getUser(userId);
      const isReceiver = currentParcel.receiverId === userId ||
        normalizedEmail(receiver?.email) === normalizedEmail(currentParcel.receiverEmail);
      if (!isCarrier && !isReceiver) {
        return res.status(403).json({ error: "You do not have access to this parcel" });
      }
      if (photoType === "pickup" && !isCarrier) {
        return res.status(403).json({ error: "Only the assigned carrier can upload pickup proof" });
      }
      if (photoType === "delivery" && !isCarrier && !isReceiver) {
        return res.status(403).json({ error: "Only a parcel participant can upload delivery proof" });
      }
      if (photoType === "pickup") {
        if (!["Accepted", "Picked Up"].includes(currentParcel.status || "")) {
          return res.status(409).json({ error: `Pickup proof is not valid while the parcel is ${currentParcel.status}` });
        }
        await db.update(parcels).set({ status: "In Transit" }).where(eq(parcels.id, parcelId));
        await recordTrackingEvent(parcelId, "In Transit", userId, "Pickup proof uploaded");
        // Realtime: carrier is now on the move
        const participantIds = [currentParcel.senderId, currentParcel.transporterId, currentParcel.receiverId]
          .filter(Boolean) as string[];
        broadcastToUsers(participantIds, {
          type: "parcel:status",
          parcelId,
          status: "In Transit",
          onTheMove: true,
        });
        // Notify sender and receiver that parcel is now in transit
        const notifyIds = [currentParcel.senderId, currentParcel.receiverId].filter(Boolean) as string[];
        for (const uid of notifyIds) {
          NotificationService.notifyStatusChange(uid, parcelId, currentParcel.status || "", "In Transit", {
            origin: currentParcel.origin,
            destination: currentParcel.destination,
          }).catch(err => console.error("Notify in-transit error:", err));
        }
      } else if (photoType === "delivery") {
        if (!["In Transit", "Arrived"].includes(currentParcel.status || "")) {
          return res.status(409).json({ error: `Delivery proof is not valid while the parcel is ${currentParcel.status}` });
        }
        if (currentParcel.receiverId) {
          NotificationService.requestDeliveryConfirmation(currentParcel.receiverId, parcelId)
            .catch(err => console.error("Notify receiver confirmation error:", err));
        }
      }

      const photo = await db.insert(parcelPhotos).values({
        parcelId,
        uploadedBy: userId,
        photoUrl: photoData,
        photoType,
        caption: caption || null,
        latitude: latitude || null,
        longitude: longitude || null,
      }).returning();

      res.status(201).json(photo[0]);
    } catch (error: any) {
      console.error("Failed to upload parcel photo:", error);
      res.status(500).json({ error: "Failed to upload photo" });
    }
  });

  // ─── ETA Endpoint ─────────────────────────────────────────────────────────
  app.get("/api/parcels/:parcelId/eta", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { parcelId } = req.params;
      const parcel = await storage.getParcel(parcelId);
      if (!parcel) {
        return res.status(404).json({ error: "Parcel not found" });
      }
      if (!isParcelParticipant(parcel, req.user)) {
        return res.status(403).json({ error: "You do not have access to this parcel" });
      }

      // Get latest carrier location
      const loc = await db.select().from(carrierLocations)
        .where(eq(carrierLocations.parcelId, parcelId))
        .orderBy(desc(carrierLocations.timestamp))
        .limit(1);

      if (!loc.length || parcel.destinationLat == null || parcel.destinationLng == null) {
        return res.json({ available: false, message: "Location not available yet" });
      }

      const carrierLoc = loc[0];
      const dLat = (parcel.destinationLat - carrierLoc.lat) * Math.PI / 180;
      const dLng = (parcel.destinationLng - carrierLoc.lng) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(carrierLoc.lat * Math.PI / 180) *
        Math.cos(parcel.destinationLat * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2;
      const distanceKm = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      // Use actual speed if available, otherwise assume 50 km/h in city
      const speedKmh = carrierLoc.speed && carrierLoc.speed > 2
        ? carrierLoc.speed * 3.6
        : 50;

      const etaMinutes = Math.round((distanceKm / speedKmh) * 60);

      const locationAge = Date.now() - new Date(carrierLoc.timestamp || 0).getTime();
      const isStale = locationAge > 10 * 60 * 1000; // > 10 minutes old

      res.json({
        available: true,
        distance: Math.round(distanceKm * 10) / 10,
        etaMinutes,
        carrierLocation: {
          lat: carrierLoc.lat,
          lng: carrierLoc.lng,
          timestamp: carrierLoc.timestamp,
          speed: carrierLoc.speed,
        },
        isStale,
        message: isStale
          ? "Location data may be outdated"
          : etaMinutes < 5
            ? "Arriving very soon!"
            : `About ${etaMinutes} min away`,
      });
    } catch (error) {
      console.error("Failed to calculate ETA:", error);
      res.status(500).json({ error: "Failed to calculate ETA" });
    }
  });

  // ─── Notifications API ─────────────────────────────────────────────────────
  app.get("/api/notifications", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.uid;
      const limit = parseInt(req.query.limit as string) || 50;
      const unreadOnly = req.query.unread === "true";

      const query = db.select().from(notifications)
        .where(
          unreadOnly
            ? and(eq(notifications.userId, userId), eq(notifications.isRead, false))
            : eq(notifications.userId, userId)
        )
        .orderBy(desc(notifications.createdAt))
        .limit(limit);

      const result = await query;
      res.json(result);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.get("/api/notifications/unread-count", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.uid;
      const result = await db.select({ count: sql<number>`count(*)::int` })
        .from(notifications)
        .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
      res.json({ count: result[0]?.count || 0 });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch unread count" });
    }
  });

  app.patch("/api/notifications/:id/read", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.uid;
      await db.update(notifications)
        .set({ isRead: true })
        .where(and(eq(notifications.id, req.params.id), eq(notifications.userId, userId)));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  app.patch("/api/notifications/read-all", requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.uid;
      await db.update(notifications)
        .set({ isRead: true })
        .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to mark all notifications as read" });
    }
  });

  // Register receiver enhancements
  registerReceiverEnhancements(app);

  // Register AI routes (OpenAI-powered features)
  registerAIRoutes(app);

  // Online presence lookup: GET /api/users/online?ids=a,b,c
  app.get("/api/users/online", (req, res) => {
    const idsParam = (req.query.ids as string) || "";
    const ids = idsParam.split(",").map(s => s.trim()).filter(Boolean);
    const result: Record<string, { online: boolean; lastSeen: number | null }> = {};
    for (const id of ids) {
      result[id] = { online: isUserOnline(id), lastSeen: getLastSeen(id) };
    }
    res.json(result);
  });

  const httpServer = createServer(app);

  setupRealtime(httpServer);

  return httpServer;
}
