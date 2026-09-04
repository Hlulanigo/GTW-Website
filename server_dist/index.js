// server/index.ts
import "dotenv/config";
import express from "express";

// server/routes.ts
import { createServer } from "node:http";

// server/storage.ts
import { eq, or, and, desc, avg } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// shared/schema.ts
import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, real, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
var parcelSizeEnum = pgEnum("parcel_size", ["small", "medium", "large"]);
var parcelStatusEnum = pgEnum("parcel_status", ["Pending", "Paid", "Accepted", "Picked Up", "In Transit", "Arrived", "Delivered", "Expired"]);
var subscriptionStatusEnum = pgEnum("subscription_status", ["active", "cancelled", "expired", "past_due"]);
var subscriptionPlanEnum = pgEnum("subscription_plan", ["free", "starter", "professional", "business"]);
var parcelTrackingEventEnum = pgEnum("parcel_tracking_event", [
  "Accepted",
  "Picked Up",
  "In Transit",
  "Arrived",
  "Delivered",
  "Cancelled",
  "Issue"
]);
var connectionTypeEnum = pgEnum("connection_type", ["trusted_carrier", "saved_contact"]);
var routeStatusEnum = pgEnum("route_status", ["Active", "Completed", "Expired", "Cancelled"]);
var routeFrequencyEnum = pgEnum("route_frequency", ["one_time", "daily", "weekly", "monthly"]);
var users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  photoUrl: text("photo_url"),
  rating: real("rating").default(5),
  verified: boolean("verified").default(false),
  emailVerified: boolean("email_verified").default(false),
  walletBalance: integer("wallet_balance").default(0).notNull(),
  subscriptionStatus: text("subscription_status").default("free").notNull(),
  subscriptionExpiresAt: timestamp("subscription_expires_at"),
  savedLocationName: text("saved_location_name"),
  savedLocationAddress: text("saved_location_address"),
  savedLocationLat: real("saved_location_lat"),
  savedLocationLng: real("saved_location_lng"),
  // Delivery settings
  deliveryInstructions: text("delivery_instructions"),
  preferredCarriers: text("preferred_carriers").array(),
  returnAddressName: text("return_address_name"),
  returnAddressDetails: text("return_address_details"),
  bio: text("bio"),
  city: text("city"),
  profileVisibility: text("profile_visibility").default("public").notNull(),
  // Review settings
  reviewsVisibility: text("reviews_visibility").default("public").notNull(),
  reviewNotifications: boolean("review_notifications").default(true),
  // Subscription settings
  showSubscriptionStatus: boolean("show_subscription_status").default(false),
  createdAt: timestamp("created_at").defaultNow()
});
var subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  planId: subscriptionPlanEnum("plan_id").notNull(),
  status: subscriptionStatusEnum("status").notNull(),
  currentPeriodStart: timestamp("current_period_start").notNull(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  cancelledAt: timestamp("cancelled_at"),
  renewalAttempts: integer("renewal_attempts").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var parcels = pgTable("parcels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  origin: text("origin").notNull(),
  destination: text("destination").notNull(),
  originLat: real("origin_lat"),
  originLng: real("origin_lng"),
  destinationLat: real("destination_lat"),
  destinationLng: real("destination_lng"),
  intermediateStops: text("intermediate_stops").array(),
  size: parcelSizeEnum("size").notNull(),
  weight: real("weight"),
  description: text("description"),
  specialInstructions: text("special_instructions"),
  isFragile: boolean("is_fragile").default(false),
  compensation: integer("compensation").notNull(),
  pickupDate: timestamp("pickup_date").notNull(),
  pickupWindowEnd: timestamp("pickup_window_end"),
  deliveryWindowStart: timestamp("delivery_window_start"),
  deliveryWindowEnd: timestamp("delivery_window_end"),
  expiresAt: timestamp("expires_at"),
  declaredValue: integer("declared_value"),
  insuranceNeeded: boolean("insurance_needed").default(false),
  contactPhone: text("contact_phone"),
  status: parcelStatusEnum("status").default("Pending"),
  // Tracking features
  manualTrackingEnabled: boolean("manual_tracking_enabled").default(true).notNull(),
  liveTrackingEnabled: boolean("live_tracking_enabled").default(false).notNull(),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  transporterId: varchar("transporter_id").references(() => users.id),
  receiverId: varchar("receiver_id").references(() => users.id),
  photoUrl: text("photo_url"),
  receiverName: text("receiver_name"),
  receiverPhone: text("receiver_phone"),
  receiverEmail: text("receiver_email"),
  receiverLat: real("receiver_lat"),
  receiverLng: real("receiver_lng"),
  receiverLocationUpdatedAt: timestamp("receiver_location_updated_at"),
  createdAt: timestamp("created_at").defaultNow()
});
var routes = pgTable("routes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  carrierId: varchar("carrier_id").notNull().references(() => users.id),
  origin: text("origin").notNull(),
  destination: text("destination").notNull(),
  originLat: real("origin_lat"),
  originLng: real("origin_lng"),
  destinationLat: real("destination_lat"),
  destinationLng: real("destination_lng"),
  intermediateStops: text("intermediate_stops").array(),
  departureDate: timestamp("departure_date").notNull(),
  departureTime: text("departure_time"),
  frequency: routeFrequencyEnum("frequency").default("one_time"),
  recurrenceEndDate: timestamp("recurrence_end_date"),
  maxParcelSize: parcelSizeEnum("max_parcel_size"),
  maxWeight: real("max_weight"),
  availableCapacity: integer("available_capacity"),
  capacityUsed: integer("capacity_used").default(0),
  pricePerKg: integer("price_per_kg"),
  notes: text("notes"),
  status: routeStatusEnum("status").default("Active"),
  expiresAt: timestamp("expires_at"),
  parentRouteId: varchar("parent_route_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  parcelId: varchar("parcel_id").references(() => parcels.id),
  participant1Id: varchar("participant1_id").notNull().references(() => users.id),
  participant2Id: varchar("participant2_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow()
});
var messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").defaultNow()
});
var connections = pgTable("connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  connectedUserId: varchar("connected_user_id").notNull().references(() => users.id),
  connectionType: connectionTypeEnum("connection_type").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow()
});
var blockedUsers = pgTable("blocked_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  blockedUserId: varchar("blocked_user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow()
});
var parcelMessages = pgTable("parcel_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  parcelId: varchar("parcel_id").notNull().references(() => parcels.id),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  senderRole: text("sender_role").notNull(),
  createdAt: timestamp("created_at").defaultNow()
});
var carrierLocations = pgTable("carrier_locations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  parcelId: varchar("parcel_id").notNull().references(() => parcels.id),
  carrierId: varchar("carrier_id").notNull().references(() => users.id),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  heading: real("heading"),
  speed: real("speed"),
  accuracy: real("accuracy"),
  timestamp: timestamp("timestamp").defaultNow()
});
var parcelTrackingEvents = pgTable("parcel_tracking_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  parcelId: varchar("parcel_id").notNull().references(() => parcels.id),
  eventType: parcelTrackingEventEnum("event_type").notNull(),
  note: text("note"),
  createdByUserId: varchar("created_by_user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow()
});
var receiverLocations = pgTable("receiver_locations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  parcelId: varchar("parcel_id").notNull().references(() => parcels.id),
  receiverId: varchar("receiver_id").notNull().references(() => users.id),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  accuracy: real("accuracy"),
  timestamp: timestamp("timestamp").defaultNow()
});
var usersRelations = relations(users, ({ many }) => ({
  sentParcels: many(parcels, { relationName: "sender" }),
  transportingParcels: many(parcels, { relationName: "transporter" }),
  routes: many(routes),
  conversations1: many(conversations, { relationName: "participant1" }),
  conversations2: many(conversations, { relationName: "participant2" }),
  messages: many(messages),
  connections: many(connections, { relationName: "userConnections" }),
  connectedBy: many(connections, { relationName: "connectedByUsers" }),
  blockedUsers: many(blockedUsers, { relationName: "userBlocked" })
}));
var routesRelations = relations(routes, ({ one }) => ({
  carrier: one(users, {
    fields: [routes.carrierId],
    references: [users.id]
  })
}));
var parcelsRelations = relations(parcels, ({ one, many }) => ({
  sender: one(users, {
    fields: [parcels.senderId],
    references: [users.id],
    relationName: "sender"
  }),
  transporter: one(users, {
    fields: [parcels.transporterId],
    references: [users.id],
    relationName: "transporter"
  }),
  conversations: many(conversations)
}));
var conversationsRelations = relations(conversations, ({ one, many }) => ({
  parcel: one(parcels, {
    fields: [conversations.parcelId],
    references: [parcels.id]
  }),
  participant1: one(users, {
    fields: [conversations.participant1Id],
    references: [users.id],
    relationName: "participant1"
  }),
  participant2: one(users, {
    fields: [conversations.participant2Id],
    references: [users.id],
    relationName: "participant2"
  }),
  messages: many(messages)
}));
var messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, {
    fields: [messages.conversationId],
    references: [conversations.id]
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id]
  })
}));
var connectionsRelations = relations(connections, ({ one }) => ({
  user: one(users, {
    fields: [connections.userId],
    references: [users.id],
    relationName: "userConnections"
  }),
  connectedUser: one(users, {
    fields: [connections.connectedUserId],
    references: [users.id],
    relationName: "connectedByUsers"
  })
}));
var parcelMessagesRelations = relations(parcelMessages, ({ one }) => ({
  parcel: one(parcels, {
    fields: [parcelMessages.parcelId],
    references: [parcels.id]
  }),
  sender: one(users, {
    fields: [parcelMessages.senderId],
    references: [users.id]
  })
}));
var carrierLocationsRelations = relations(carrierLocations, ({ one }) => ({
  parcel: one(parcels, {
    fields: [carrierLocations.parcelId],
    references: [parcels.id]
  }),
  carrier: one(users, {
    fields: [carrierLocations.carrierId],
    references: [users.id]
  })
}));
var receiverLocationsRelations = relations(receiverLocations, ({ one }) => ({
  parcel: one(parcels, {
    fields: [receiverLocations.parcelId],
    references: [parcels.id]
  }),
  receiver: one(users, {
    fields: [receiverLocations.receiverId],
    references: [users.id]
  })
}));
var reviews = pgTable("reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  parcelId: varchar("parcel_id").notNull().references(() => parcels.id),
  reviewerId: varchar("reviewer_id").notNull().references(() => users.id),
  revieweeId: varchar("reviewee_id").notNull().references(() => users.id),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  reviewType: text("review_type").notNull(),
  createdAt: timestamp("created_at").defaultNow()
});
var pushTokens = pgTable("push_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  token: text("token").notNull().unique(),
  platform: text("platform"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var paymentStatusEnum = pgEnum("payment_status", ["pending", "success", "failed", "cancelled"]);
var payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  parcelId: varchar("parcel_id").notNull().references(() => parcels.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  reference: text("reference").notNull().unique(),
  amount: integer("amount").notNull(),
  platformFee: integer("platform_fee").notNull(),
  totalAmount: integer("total_amount").notNull(),
  status: paymentStatusEnum("status").default("pending"),
  paymentMethod: text("payment_method").notNull(),
  paystackData: text("paystack_data"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var transactionTypeEnum = pgEnum("transaction_type", ["topup", "debit", "refund", "bonus"]);
var transactionStatusEnum = pgEnum("transaction_status", ["pending", "completed", "failed", "cancelled"]);
var walletTransactions = pgTable("wallet_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: transactionTypeEnum("type").notNull(),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("ZAR"),
  status: transactionStatusEnum("status").notNull().default("pending"),
  reference: text("reference").notNull().unique(),
  description: text("description"),
  metadata: text("metadata"),
  paymentMethod: text("payment_method"),
  paymentData: text("payment_data"),
  balanceBefore: integer("balance_before").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at")
});
var savedPaymentMethods = pgTable("saved_payment_methods", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  cardLast4: text("card_last_4").notNull(),
  cardBrand: text("card_brand").notNull(),
  authorizationCode: text("authorization_code").notNull(),
  isDefault: boolean("is_default").default(false),
  expiryMonth: integer("expiry_month"),
  expiryYear: integer("expiry_year"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var autoTopUpSettings = pgTable("auto_top_up_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id).unique(),
  isEnabled: boolean("is_enabled").default(false),
  triggerAmount: integer("trigger_amount"),
  topupAmount: integer("topup_amount"),
  paymentMethodId: varchar("payment_method_id").references(() => savedPaymentMethods.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var paymentsRelations = relations(payments, ({ one }) => ({
  parcel: one(parcels, {
    fields: [payments.parcelId],
    references: [parcels.id]
  }),
  user: one(users, {
    fields: [payments.userId],
    references: [users.id]
  })
}));
var walletTransactionsRelations = relations(walletTransactions, ({ one }) => ({
  user: one(users, {
    fields: [walletTransactions.userId],
    references: [users.id]
  })
}));
var savedPaymentMethodsRelations = relations(savedPaymentMethods, ({ one }) => ({
  user: one(users, {
    fields: [savedPaymentMethods.userId],
    references: [users.id]
  })
}));
var autoTopUpSettingsRelations = relations(autoTopUpSettings, ({ one }) => ({
  user: one(users, {
    fields: [autoTopUpSettings.userId],
    references: [users.id]
  }),
  paymentMethod: one(savedPaymentMethods, {
    fields: [autoTopUpSettings.paymentMethodId],
    references: [savedPaymentMethods.id]
  })
}));
var reviewsRelations = relations(reviews, ({ one }) => ({
  parcel: one(parcels, {
    fields: [reviews.parcelId],
    references: [parcels.id]
  }),
  reviewer: one(users, {
    fields: [reviews.reviewerId],
    references: [users.id],
    relationName: "reviewsGiven"
  }),
  reviewee: one(users, {
    fields: [reviews.revieweeId],
    references: [users.id],
    relationName: "reviewsReceived"
  })
}));
var pushTokensRelations = relations(pushTokens, ({ one }) => ({
  user: one(users, {
    fields: [pushTokens.userId],
    references: [users.id]
  })
}));
var insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true
});
var insertParcelSchema = createInsertSchema(parcels).omit({
  id: true,
  createdAt: true,
  status: true,
  transporterId: true,
  // tracking toggles are controlled after creation
  manualTrackingEnabled: true,
  liveTrackingEnabled: true
});
var insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true
});
var insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true
});
var insertConnectionSchema = createInsertSchema(connections).omit({
  id: true,
  createdAt: true
});
var insertRouteSchema = createInsertSchema(routes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true
});
var insertReviewSchema = createInsertSchema(reviews).omit({
  id: true,
  createdAt: true
});
var insertParcelTrackingEventSchema = createInsertSchema(parcelTrackingEvents).omit({
  id: true,
  createdAt: true
});
var insertPushTokenSchema = createInsertSchema(pushTokens).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertParcelMessageSchema = createInsertSchema(parcelMessages).omit({
  id: true,
  createdAt: true
});
var insertCarrierLocationSchema = createInsertSchema(carrierLocations).omit({
  id: true,
  timestamp: true
});
var insertReceiverLocationSchema = createInsertSchema(receiverLocations).omit({
  id: true,
  timestamp: true
});
var insertWalletTransactionSchema = createInsertSchema(walletTransactions).omit({
  id: true,
  createdAt: true,
  completedAt: true
});
var insertSavedPaymentMethodSchema = createInsertSchema(savedPaymentMethods).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertAutoTopUpSettingsSchema = createInsertSchema(autoTopUpSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

// server/storage.ts
var pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
pool.on("error", (err) => {
  console.error("Postgres pool error (non-fatal):", err);
});
var db = drizzle(pool);
var DatabaseStorage = class {
  async getUser(id) {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }
  async getUserByEmail(email) {
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0];
  }
  async createUser(insertUser) {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }
  async getAllParcels() {
    return await db.select().from(parcels).orderBy(desc(parcels.createdAt));
  }
  async getParcel(id) {
    const result = await db.select().from(parcels).where(eq(parcels.id, id));
    return result[0];
  }
  async getParcelWithSender(id) {
    const result = await db.select().from(parcels).innerJoin(users, eq(parcels.senderId, users.id)).where(eq(parcels.id, id));
    if (result[0]) {
      return { ...result[0].parcels, sender: result[0].users };
    }
    return void 0;
  }
  async createParcel(insertParcel) {
    const user = await this.getUser(insertParcel.senderId);
    if (!user) throw new Error("User not found");
    if (user.subscriptionStatus === "free" && user.walletBalance < insertParcel.compensation) {
      console.warn("User has insufficient balance, but allowing for now in development");
    }
    if (user.subscriptionStatus === "free" && user.walletBalance >= insertParcel.compensation) {
      await db.update(users).set({ walletBalance: user.walletBalance - insertParcel.compensation }).where(eq(users.id, user.id));
    }
    const result = await db.insert(parcels).values(insertParcel).returning();
    return result[0];
  }
  async updateParcel(id, updates) {
    const result = await db.update(parcels).set(updates).where(eq(parcels.id, id)).returning();
    return result[0];
  }
  async getUserConversations(userId) {
    return await db.select().from(conversations).where(
      or(
        eq(conversations.participant1Id, userId),
        eq(conversations.participant2Id, userId)
      )
    ).orderBy(desc(conversations.createdAt));
  }
  // Blocked users
  async getBlockedUsers(userId) {
    const result = await db.select().from(blockedUsers).innerJoin(users, eq(blockedUsers.blockedUserId, users.id)).where(eq(blockedUsers.userId, userId)).orderBy(desc(blockedUsers.createdAt));
    return result.map((r) => r.users);
  }
  async blockUser(userId, blockedUserId) {
    const existing = await db.select().from(blockedUsers).where(and(eq(blockedUsers.userId, userId), eq(blockedUsers.blockedUserId, blockedUserId)));
    if (existing.length) return false;
    const result = await db.insert(blockedUsers).values({ userId, blockedUserId }).returning();
    return result.length > 0;
  }
  async unblockUser(userId, blockedUserId) {
    const result = await db.delete(blockedUsers).where(and(eq(blockedUsers.userId, userId), eq(blockedUsers.blockedUserId, blockedUserId))).returning();
    return result.length > 0;
  }
  async getConversation(id) {
    const result = await db.select().from(conversations).where(eq(conversations.id, id));
    return result[0];
  }
  async createConversation(insertConversation) {
    const result = await db.insert(conversations).values(insertConversation).returning();
    return result[0];
  }
  async getConversationMessages(conversationId) {
    return await db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(messages.createdAt);
  }
  async createMessage(insertMessage) {
    const result = await db.insert(messages).values(insertMessage).returning();
    return result[0];
  }
  async deleteParcel(id) {
    const result = await db.delete(parcels).where(eq(parcels.id, id)).returning();
    return result.length > 0;
  }
  async deleteMessage(id) {
    const result = await db.delete(messages).where(eq(messages.id, id)).returning();
    return result.length > 0;
  }
  async getUserConnections(userId) {
    const result = await db.select().from(connections).innerJoin(users, eq(connections.connectedUserId, users.id)).where(eq(connections.userId, userId)).orderBy(desc(connections.createdAt));
    return result.map((r) => ({ ...r.connections, connectedUser: r.users }));
  }
  async getConnection(userId, connectedUserId) {
    const result = await db.select().from(connections).where(and(eq(connections.userId, userId), eq(connections.connectedUserId, connectedUserId)));
    return result[0];
  }
  async createConnection(insertConnection) {
    const result = await db.insert(connections).values(insertConnection).returning();
    return result[0];
  }
  async deleteConnection(userId, connectedUserId) {
    const result = await db.delete(connections).where(and(eq(connections.userId, userId), eq(connections.connectedUserId, connectedUserId))).returning();
    return result.length > 0;
  }
  async getRoute(id) {
    const result = await db.select().from(routes).where(eq(routes.id, id));
    return result[0];
  }
  async getRouteWithCarrier(id) {
    const result = await db.select().from(routes).innerJoin(users, eq(routes.carrierId, users.id)).where(eq(routes.id, id));
    if (result[0]) {
      return { ...result[0].routes, carrier: result[0].users };
    }
    return void 0;
  }
  async getUserRoutes(userId) {
    return await db.select().from(routes).where(eq(routes.carrierId, userId)).orderBy(desc(routes.departureDate));
  }
  async getAllActiveRoutes() {
    return await db.select().from(routes).where(eq(routes.status, "Active")).orderBy(desc(routes.departureDate));
  }
  async createRoute(insertRoute) {
    const result = await db.insert(routes).values(insertRoute).returning();
    return result[0];
  }
  async updateRoute(id, updates) {
    const result = await db.update(routes).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(eq(routes.id, id)).returning();
    return result[0];
  }
  async deleteRoute(id) {
    const result = await db.delete(routes).where(eq(routes.id, id)).returning();
    return result.length > 0;
  }
  async getUserReviews(userId) {
    const result = await db.select().from(reviews).innerJoin(users, eq(reviews.reviewerId, users.id)).where(eq(reviews.revieweeId, userId)).orderBy(desc(reviews.createdAt));
    return result.map((r) => ({ ...r.reviews, reviewer: r.users }));
  }
  async getReviewByParcelAndReviewer(parcelId, reviewerId) {
    const result = await db.select().from(reviews).where(and(eq(reviews.parcelId, parcelId), eq(reviews.reviewerId, reviewerId)));
    return result[0];
  }
  async createReview(insertReview) {
    const result = await db.insert(reviews).values(insertReview).returning();
    const avgResult = await db.select({ avgRating: avg(reviews.rating) }).from(reviews).where(eq(reviews.revieweeId, insertReview.revieweeId));
    if (avgResult[0]?.avgRating) {
      await db.update(users).set({ rating: parseFloat(avgResult[0].avgRating) }).where(eq(users.id, insertReview.revieweeId));
    }
    return result[0];
  }
  async getUserPushTokens(userId) {
    return await db.select().from(pushTokens).where(eq(pushTokens.userId, userId));
  }
  async getPushTokenByToken(token) {
    const result = await db.select().from(pushTokens).where(eq(pushTokens.token, token));
    return result[0];
  }
  async createOrUpdatePushToken(insertPushToken) {
    const existing = await this.getPushTokenByToken(insertPushToken.token);
    if (existing) {
      const result2 = await db.update(pushTokens).set({ userId: insertPushToken.userId, updatedAt: /* @__PURE__ */ new Date() }).where(eq(pushTokens.token, insertPushToken.token)).returning();
      return result2[0];
    }
    const result = await db.insert(pushTokens).values(insertPushToken).returning();
    return result[0];
  }
  async deletePushToken(token) {
    const result = await db.delete(pushTokens).where(eq(pushTokens.token, token)).returning();
    return result.length > 0;
  }
  async createPayment(insertPayment) {
    const result = await db.insert(payments).values(insertPayment).returning();
    return result[0];
  }
  async getPaymentByReference(reference) {
    const result = await db.select().from(payments).where(eq(payments.reference, reference));
    return result[0];
  }
  async updatePayment(id, updates) {
    const result = await db.update(payments).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(eq(payments.id, id)).returning();
    return result[0];
  }
  async getPaymentsByUserId(userId) {
    return await db.select().from(payments).where(eq(payments.userId, userId)).orderBy(desc(payments.createdAt));
  }
  // Saved Payment Methods
  async createSavedPaymentMethod(userId, cardLast4, cardBrand, authorizationCode) {
    const result = await db.insert(savedPaymentMethods).values({
      userId,
      cardLast4,
      cardBrand,
      authorizationCode,
      isDefault: false
    }).returning();
    return result[0];
  }
  async getSavedPaymentMethods(userId) {
    return await db.select().from(savedPaymentMethods).where(eq(savedPaymentMethods.userId, userId)).orderBy(desc(savedPaymentMethods.createdAt));
  }
  async setSavedPaymentMethodAsDefault(userId, methodId) {
    await db.update(savedPaymentMethods).set({ isDefault: false }).where(eq(savedPaymentMethods.userId, userId));
    const result = await db.update(savedPaymentMethods).set({ isDefault: true }).where(and(eq(savedPaymentMethods.id, methodId), eq(savedPaymentMethods.userId, userId))).returning();
    return result.length > 0;
  }
  async deleteSavedPaymentMethod(methodId, userId) {
    const result = await db.delete(savedPaymentMethods).where(and(eq(savedPaymentMethods.id, methodId), eq(savedPaymentMethods.userId, userId))).returning();
    return result.length > 0;
  }
  // Auto Top-up Settings
  async getAutoTopUpSettings(userId) {
    const result = await db.select().from(autoTopUpSettings).where(eq(autoTopUpSettings.userId, userId));
    return result[0];
  }
  async updateAutoTopUpSettings(userId, isEnabled, triggerAmount, topupAmount, paymentMethodId) {
    const existing = await this.getAutoTopUpSettings(userId);
    if (existing) {
      const result = await db.update(autoTopUpSettings).set({
        isEnabled,
        triggerAmount,
        topupAmount,
        paymentMethodId,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq(autoTopUpSettings.userId, userId)).returning();
      return result[0];
    } else {
      const result = await db.insert(autoTopUpSettings).values({
        userId,
        isEnabled,
        triggerAmount,
        topupAmount,
        paymentMethodId
      }).returning();
      return result[0];
    }
  }
  // Subscriptions
  async getSubscription(userId) {
    const result = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId));
    return result[0];
  }
  async createSubscription(userId, planId) {
    const now = /* @__PURE__ */ new Date();
    const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1e3);
    const result = await db.insert(subscriptions).values({
      userId,
      planId,
      status: "active",
      currentPeriodStart: now,
      currentPeriodEnd: nextMonth
    }).returning();
    return result[0];
  }
  async updateSubscription(userId, planId, status) {
    const updates = { updatedAt: /* @__PURE__ */ new Date() };
    if (planId) updates.planId = planId;
    if (status) updates.status = status;
    const result = await db.update(subscriptions).set(updates).where(eq(subscriptions.userId, userId)).returning();
    return result[0];
  }
  async cancelSubscription(userId) {
    const result = await db.update(subscriptions).set({
      status: "cancelled",
      cancelledAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq(subscriptions.userId, userId)).returning();
    return result[0];
  }
};
var storage = new DatabaseStorage();

// server/routes.ts
import { createHmac } from "crypto";
import { eq as eq4, desc as desc3, and as and3, lte, ne, sql as sql2 } from "drizzle-orm";

// server/firebase-admin.ts
import * as admin from "firebase-admin";
import * as fs from "fs";
import * as path from "path";
var firebaseApp = null;
function initializeFirebase() {
  if (firebaseApp) return firebaseApp;
  try {
    let serviceAccount = {};
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      } catch (e) {
        console.warn("Invalid FIREBASE_SERVICE_ACCOUNT_JSON env var, will try file fallback.");
      }
    }
    const accountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || path.resolve(process.cwd(), "server", "firebase-service-account.json");
    if (!serviceAccount.project_id && fs.existsSync(accountPath)) {
      try {
        const fileContents = fs.readFileSync(accountPath, "utf8");
        serviceAccount = JSON.parse(fileContents);
      } catch (e) {
        console.warn("Failed to read/parse firebase service account file:", e);
      }
    }
    if (!serviceAccount.project_id) {
      console.warn("Firebase service account not provided. Falling back to default auth.");
      return null;
    } else {
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      return firebaseApp;
    }
  } catch (error) {
    console.error("Failed to initialize Firebase Admin", error);
    return null;
  }
}
firebaseApp = initializeFirebase();
var adminAuth = firebaseApp ? firebaseApp.auth() : null;
var adminDb = firebaseApp ? firebaseApp.firestore() : null;
async function verifyFirebaseToken(idToken) {
  if (!adminAuth) {
    try {
      const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.EXPO_PUBLIC_FIREBASE_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken })
        }
      );
      if (!response.ok) return null;
      const data = await response.json();
      if (data.users && data.users.length > 0) {
        return {
          uid: data.users[0].localId,
          email: data.users[0].email
        };
      }
    } catch (e) {
      console.error("Fallback token verification failed:", e);
    }
    return null;
  }
  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    console.error("Failed to verify Firebase token", error);
    return null;
  }
}
function requireAuth(req, res, next) {
  if (process.env.NODE_ENV === "test" && req.headers["x-test-user"]) {
    const uid = String(req.headers["x-test-user"]);
    const email = req.headers["x-test-user-email"] ? String(req.headers["x-test-user-email"]) : void 0;
    req.user = { uid, email };
    return next();
  }
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }
  const token = authHeader.split("Bearer ")[1];
  verifyFirebaseToken(token).then((user) => {
    if (!user) {
      return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }
    req.user = user;
    next();
  }).catch((error) => {
    console.error("Auth middleware error:", error);
    res.status(500).json({ error: "Authentication error" });
  });
}
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }
  const token = authHeader.split("Bearer ")[1];
  verifyFirebaseToken(token).then((user) => {
    if (user) {
      req.user = user;
    }
    next();
  }).catch(() => {
    next();
  });
}

// server/receiver-enhancements.ts
import { eq as eq3, desc as desc2 } from "drizzle-orm";

// server/notification-service.ts
import { eq as eq2 } from "drizzle-orm";
var NotificationService = class {
  /**
   * Queue a notification for a user (logs for now, actual queue would be implemented separately)
   */
  static async queueNotification(userId, payload) {
    try {
      console.log(`Queued notification for user ${userId}:`, payload);
    } catch (error) {
      console.error("Failed to queue notification:", error);
    }
  }
  /**
   * Send notification immediately to all user's devices
   */
  static async sendImmediateNotification(userId, payload) {
    try {
      const tokens = await db.select().from(pushTokens).where(eq2(pushTokens.userId, userId));
      if (tokens.length === 0) {
        console.log(`No push tokens found for user ${userId}`);
        return false;
      }
      console.log(
        `Would send notification to ${tokens.length} devices:`,
        payload
      );
      await this.queueNotification(userId, payload);
      return true;
    } catch (error) {
      console.error("Failed to send immediate notification:", error);
      return false;
    }
  }
  /**
   * Send status update notification
   */
  static async notifyStatusChange(userId, parcelId, oldStatus, newStatus) {
    const statusMessages = {
      Pending: "Your parcel is waiting for a carrier",
      Paid: "Payment confirmed for your parcel",
      "In Transit": "Your parcel is on its way! \u{1F69A}",
      Delivered: "Your parcel has been delivered! \u{1F4E6}",
      Expired: "Your parcel listing has expired"
    };
    await this.sendImmediateNotification(userId, {
      title: "Parcel Status Update",
      body: statusMessages[newStatus] || `Status changed to ${newStatus}`,
      data: {
        type: "status_change",
        parcelId,
        oldStatus,
        newStatus
      }
    });
  }
  /**
   * Notify receiver about new incoming parcel
   */
  static async notifyNewIncomingParcel(receiverId, parcelId, senderName) {
    await this.sendImmediateNotification(receiverId, {
      title: "Incoming Parcel",
      body: `${senderName} is sending you a parcel`,
      data: {
        type: "new_incoming_parcel",
        parcelId
      }
    });
  }
  /**
   * Notify when carrier is nearby
   */
  static async notifyCarrierNearby(receiverId, parcelId, estimatedMinutes) {
    await this.sendImmediateNotification(receiverId, {
      title: "Carrier is Nearby! \u{1F4CD}",
      body: `Your delivery will arrive in approximately ${estimatedMinutes} minutes`,
      data: {
        type: "carrier_nearby",
        parcelId,
        estimatedMinutes
      }
    });
  }
  /**
   * Request delivery confirmation
   */
  static async requestDeliveryConfirmation(receiverId, parcelId) {
    await this.sendImmediateNotification(receiverId, {
      title: "Confirm Delivery",
      body: "Have you received your parcel? Please confirm delivery.",
      data: {
        type: "confirm_delivery",
        parcelId
      }
    });
  }
};

// server/receiver-enhancements.ts
import * as crypto from "crypto";
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
function calculateETA(distanceInKm) {
  const averageSpeedKmh = 40;
  const timeInHours = distanceInKm / averageSpeedKmh;
  return Math.round(timeInHours * 60);
}
function registerReceiverEnhancements(app2) {
  app2.get(
    "/api/parcels/:parcelId/eta",
    requireAuth,
    async (req, res) => {
      try {
        const { parcelId } = req.params;
        const parcel = await storage.getParcel(parcelId);
        if (!parcel) {
          return res.status(404).json({ error: "Parcel not found" });
        }
        const isReceiver = parcel.receiverId === req.user.uid;
        const user = await storage.getUser(req.user.uid);
        const isReceiverByEmail = user?.email && parcel.receiverEmail === user.email;
        if (!isReceiver && !isReceiverByEmail) {
          return res.status(403).json({ error: "Only receiver can access ETA" });
        }
        const carrierLoc = await db.select().from(carrierLocations).where(eq3(carrierLocations.parcelId, parcelId)).orderBy(desc2(carrierLocations.timestamp)).limit(1);
        if (!carrierLoc[0]) {
          return res.json({
            available: false,
            message: "Carrier location not available"
          });
        }
        let receiverLat = parcel.receiverLat;
        let receiverLng = parcel.receiverLng;
        if (!receiverLat || !receiverLng) {
          const receiverLoc = await db.select().from(receiverLocations).where(eq3(receiverLocations.parcelId, parcelId)).orderBy(desc2(receiverLocations.timestamp)).limit(1);
          if (receiverLoc[0]) {
            receiverLat = receiverLoc[0].lat;
            receiverLng = receiverLoc[0].lng;
          } else if (parcel.destinationLat && parcel.destinationLng) {
            receiverLat = parcel.destinationLat;
            receiverLng = parcel.destinationLng;
          } else {
            return res.json({
              available: false,
              message: "Receiver location not available"
            });
          }
        }
        const distance = calculateDistance(
          carrierLoc[0].lat,
          carrierLoc[0].lng,
          receiverLat,
          receiverLng
        );
        const etaMinutes = calculateETA(distance);
        if (distance < 2 && etaMinutes < 10) {
          await NotificationService.notifyCarrierNearby(
            req.user.uid,
            parcelId,
            etaMinutes
          );
        }
        res.json({
          available: true,
          distance: Math.round(distance * 10) / 10,
          // Round to 1 decimal
          etaMinutes,
          carrierLocation: {
            lat: carrierLoc[0].lat,
            lng: carrierLoc[0].lng,
            timestamp: carrierLoc[0].timestamp,
            speed: carrierLoc[0].speed
          }
        });
      } catch (error) {
        console.error("Failed to calculate ETA:", error);
        res.status(500).json({ error: "Failed to calculate ETA" });
      }
    }
  );
  app2.post(
    "/api/parcels/:parcelId/delivery-proof",
    requireAuth,
    async (req, res) => {
      try {
        const { parcelId } = req.params;
        const { photoUrl, notes } = req.body;
        if (!photoUrl) {
          return res.status(400).json({ error: "Photo URL is required" });
        }
        const parcel = await storage.getParcel(parcelId);
        if (!parcel) {
          return res.status(404).json({ error: "Parcel not found" });
        }
        const isReceiver = parcel.receiverId === req.user.uid;
        const isCarrier = parcel.transporterId === req.user.uid;
        const user = await storage.getUser(req.user.uid);
        const isReceiverByEmail = user?.email && parcel.receiverEmail === user.email;
        if (!isReceiver && !isCarrier && !isReceiverByEmail) {
          return res.status(403).json({ error: "Only receiver or carrier can upload proof" });
        }
        await storage.updateParcel(parcelId, {
          status: "Delivered"
        });
        await db.update(parcels).set({ photoUrl }).where(eq3(parcels.id, parcelId));
        if (isCarrier && parcel.receiverId) {
          await NotificationService.sendImmediateNotification(
            parcel.receiverId,
            {
              title: "Delivery Proof Uploaded",
              body: "Your carrier has uploaded proof of delivery",
              data: { type: "delivery_proof", parcelId }
            }
          );
        }
        res.json({
          success: true,
          message: "Delivery proof uploaded successfully"
        });
      } catch (error) {
        console.error("Failed to upload delivery proof:", error);
        res.status(500).json({ error: "Failed to upload delivery proof" });
      }
    }
  );
  app2.post(
    "/api/receiver-confirmations/request",
    requireAuth,
    async (req, res) => {
      try {
        const { receiverEmail, parcelDetails } = req.body;
        if (!receiverEmail) {
          return res.status(400).json({ error: "Receiver email is required" });
        }
        const token = crypto.randomBytes(32).toString("hex");
        res.json({
          success: true,
          token,
          message: "Confirmation request sent. Receiver will need to confirm before parcel is created."
        });
      } catch (error) {
        console.error("Failed to request receiver confirmation:", error);
        res.status(500).json({ error: "Failed to request receiver confirmation" });
      }
    }
  );
  app2.get(
    "/api/receiver/stats",
    requireAuth,
    async (req, res) => {
      try {
        const userId = req.user.uid;
        const allParcels = await db.select().from(parcels).where(eq3(parcels.receiverId, userId));
        const stats = {
          totalReceived: allParcels.length,
          delivered: allParcels.filter((p) => p.status === "Delivered").length,
          inTransit: allParcels.filter((p) => p.status === "In Transit").length,
          pending: allParcels.filter((p) => p.status === "Pending").length,
          averageDeliveryTime: 0
          // Would calculate from actual delivery data
        };
        res.json(stats);
      } catch (error) {
        console.error("Failed to get receiver stats:", error);
        res.status(500).json({ error: "Failed to get receiver stats" });
      }
    }
  );
  app2.patch(
    "/api/receiver/preferences",
    requireAuth,
    async (req, res) => {
      try {
        const {
          notifyOnStatusChange,
          notifyOnCarrierNearby,
          autoShareLocation
        } = req.body;
        res.json({
          success: true,
          preferences: {
            notifyOnStatusChange,
            notifyOnCarrierNearby,
            autoShareLocation
          }
        });
      } catch (error) {
        console.error("Failed to update preferences:", error);
        res.status(500).json({ error: "Failed to update preferences" });
      }
    }
  );
}

// server/routes.ts
async function registerRoutes(app2) {
  app2.get("/api/config/firebase", (_req, res) => {
    res.json({
      apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID
    });
  });
  app2.post("/api/auth/sync", requireAuth, async (req, res) => {
    try {
      const { uid, email } = req.user;
      const { name, phone } = req.body;
      let user = await storage.getUser(uid);
      if (!user) {
        user = await storage.createUser({
          id: uid,
          name: name || email?.split("@")[0] || "User",
          email: email || "",
          phone: phone || null,
          passwordHash: "firebase-auth"
        });
      }
      res.json(user);
    } catch (error) {
      console.error("Auth sync error:", error);
      res.status(500).json({ error: "Failed to sync user" });
    }
  });
  app2.get("/api/auth/me", optionalAuth, async (req, res) => {
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
  app2.get("/api/users/search", optionalAuth, async (req, res) => {
    try {
      const searchTerm = req.query.q;
      if (!searchTerm || searchTerm.trim().length < 2) {
        return res.json([]);
      }
      const searchLower = searchTerm.toLowerCase().trim();
      const currentUserId = req.user?.uid;
      const allUsers = await db.select().from(users);
      const results = allUsers.filter((user) => {
        const userName = (user.name || "").toLowerCase();
        const userEmail = (user.email || "").toLowerCase();
        return (currentUserId ? user.id !== currentUserId : true) && (userName.includes(searchLower) || userEmail.includes(searchLower));
      }).sort((a, b) => {
        const aNameMatch = (a.name || "").toLowerCase().startsWith(searchLower);
        const bNameMatch = (b.name || "").toLowerCase().startsWith(searchLower);
        if (aNameMatch && !bNameMatch) return -1;
        if (!aNameMatch && bNameMatch) return 1;
        return (a.name || "").localeCompare(b.name || "");
      }).slice(0, 10);
      res.json(results);
    } catch (error) {
      console.error("Failed to search users:", error);
      res.status(500).json({ error: "Failed to search users" });
    }
  });
  app2.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const userId = req.params.id;
      const [deliveriesResult, connectionsResult, reviewsResult] = await Promise.all([
        db.select({ count: sql2`count(*)::int` }).from(parcels).where(and3(eq4(parcels.transporterId, userId), eq4(parcels.status, "Delivered"))),
        db.select({ count: sql2`count(*)::int` }).from(connections).where(eq4(connections.userId, userId)),
        db.select({ count: sql2`count(*)::int` }).from(reviews).where(eq4(reviews.revieweeId, userId))
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
        successRate
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });
  app2.get("/api/parcels", async (req, res) => {
    try {
      const allParcels = await db.select({
        parcel: parcels,
        sender: users
      }).from(parcels).innerJoin(users, eq4(parcels.senderId, users.id)).orderBy(desc3(parcels.createdAt));
      const result = allParcels.map(({ parcel, sender }) => ({
        ...parcel,
        senderName: sender.name,
        senderRating: sender.rating
      }));
      res.json(result);
    } catch (error) {
      console.error("Failed to fetch parcels:", error);
      res.status(500).json({ error: "Failed to fetch parcels" });
    }
  });
  app2.get("/api/parcels/:id", async (req, res) => {
    try {
      const parcelWithSender = await storage.getParcelWithSender(req.params.id);
      if (!parcelWithSender) {
        return res.status(404).json({ error: "Parcel not found" });
      }
      res.json({
        ...parcelWithSender,
        senderName: parcelWithSender.sender.name,
        senderRating: parcelWithSender.sender.rating
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch parcel" });
    }
  });
  app2.post("/api/parcels", requireAuth, async (req, res) => {
    try {
      const data = { ...req.body };
      if (typeof data.pickupDate === "string") data.pickupDate = new Date(data.pickupDate);
      if (typeof data.pickupWindowEnd === "string" && data.pickupWindowEnd) data.pickupWindowEnd = new Date(data.pickupWindowEnd);
      if (typeof data.deliveryWindowStart === "string" && data.deliveryWindowStart) data.deliveryWindowStart = new Date(data.deliveryWindowStart);
      if (typeof data.deliveryWindowEnd === "string" && data.deliveryWindowEnd) data.deliveryWindowEnd = new Date(data.deliveryWindowEnd);
      if (typeof data.expiresAt === "string" && data.expiresAt) data.expiresAt = new Date(data.expiresAt);
      const parsed = insertParcelSchema.safeParse({
        ...data,
        senderId: req.user.uid
      });
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const parcelData = { ...parsed.data };
      try {
        const [originGeo, destGeo] = await Promise.all([
          fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(parsed.data.origin)}&limit=1`, {
            headers: { "User-Agent": "ParcelPeer/1.0" }
          }).then((r) => r.json()),
          fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(parsed.data.destination)}&limit=1`, {
            headers: { "User-Agent": "ParcelPeer/1.0" }
          }).then((r) => r.json())
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
      if (parcel.receiverId) {
        const sender = await storage.getUser(req.user.uid);
        await NotificationService.notifyNewIncomingParcel(
          parcel.receiverId,
          parcel.id,
          sender?.name || "Someone"
        );
      }
      res.status(201).json(parcel);
    } catch (error) {
      console.error("Failed to create parcel:", error);
      res.status(500).json({ error: "Failed to create parcel" });
    }
  });
  app2.patch("/api/parcels/:id", async (req, res) => {
    try {
      const oldParcel = await storage.getParcel(req.params.id);
      const parcel = await storage.updateParcel(req.params.id, req.body);
      if (!parcel) {
        return res.status(404).json({ error: "Parcel not found" });
      }
      if (oldParcel && parcel.status !== oldParcel.status) {
        if (parcel.receiverId) {
          await NotificationService.notifyStatusChange(
            parcel.receiverId,
            parcel.id,
            oldParcel.status,
            parcel.status
          );
        }
        if (parcel.senderId) {
          await NotificationService.notifyStatusChange(
            parcel.senderId,
            parcel.id,
            oldParcel.status,
            parcel.status
          );
        }
      }
      res.json(parcel);
    } catch (error) {
      res.status(500).json({ error: "Failed to update parcel" });
    }
  });
  app2.patch("/api/parcels/:id/accept", async (req, res) => {
    try {
      const { transporterId } = req.body;
      if (!transporterId) {
        return res.status(400).json({ error: "transporterId is required" });
      }
      const parcel = await storage.updateParcel(req.params.id, {
        transporterId,
        status: "In Transit"
      });
      if (!parcel) {
        return res.status(404).json({ error: "Parcel not found" });
      }
      res.json(parcel);
    } catch (error) {
      res.status(500).json({ error: "Failed to accept parcel" });
    }
  });
  app2.patch("/api/parcels/:id/receiver-location", requireAuth, async (req, res) => {
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
      const isReceiver = parcel.receiverId === req.user.uid;
      const user = await storage.getUser(req.user.uid);
      const isReceiverByEmail = user?.email && parcel.receiverEmail === user.email;
      if (!isReceiver && !isReceiverByEmail) {
        return res.status(403).json({ error: "Only the receiver can update the receiver location" });
      }
      const updated = await storage.updateParcel(req.params.id, {
        receiverLat: lat,
        receiverLng: lng,
        receiverLocationUpdatedAt: /* @__PURE__ */ new Date()
      });
      res.json(updated);
    } catch (error) {
      console.error("Failed to update receiver location:", error);
      res.status(500).json({ error: "Failed to update receiver location" });
    }
  });
  app2.get("/api/users/:userId/conversations", async (req, res) => {
    try {
      const userConversations = await db.select().from(conversations).where(eq4(conversations.participant1Id, req.params.userId)).orderBy(desc3(conversations.createdAt));
      const convos2 = await db.select().from(conversations).where(eq4(conversations.participant2Id, req.params.userId)).orderBy(desc3(conversations.createdAt));
      const allConvos = [...userConversations, ...convos2];
      const result = await Promise.all(
        allConvos.map(async (conv) => {
          const otherUserId = conv.participant1Id === req.params.userId ? conv.participant2Id : conv.participant1Id;
          const otherUser = await storage.getUser(otherUserId);
          const msgs = await storage.getConversationMessages(conv.id);
          const lastMsg = msgs[msgs.length - 1];
          return {
            ...conv,
            userName: otherUser?.name || "Unknown",
            lastMessage: lastMsg?.text || "",
            lastMessageTime: lastMsg?.createdAt || conv.createdAt,
            messages: msgs.map((m) => ({
              ...m,
              isMe: m.senderId === req.params.userId,
              timestamp: m.createdAt
            }))
          };
        })
      );
      res.json(result);
    } catch (error) {
      console.error("Failed to fetch conversations:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });
  app2.get("/api/conversations/:id/messages", async (req, res) => {
    try {
      const msgs = await storage.getConversationMessages(req.params.id);
      res.json(msgs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });
  app2.post("/api/conversations/:id/messages", async (req, res) => {
    try {
      const parsed = insertMessageSchema.safeParse({
        ...req.body,
        conversationId: req.params.id
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
  app2.post("/api/conversations", async (req, res) => {
    try {
      const conversation = await storage.createConversation(req.body);
      res.status(201).json(conversation);
    } catch (error) {
      console.error("Failed to create conversation:", error);
      res.status(500).json({ error: "Failed to create conversation" });
    }
  });
  app2.post("/api/users", async (req, res) => {
    try {
      if (!req.body.id) {
        return res.status(400).json({ error: "User ID is required" });
      }
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
  app2.patch("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const allowedFields = [
        "name",
        "phone",
        "photoUrl",
        "savedLocationName",
        "savedLocationAddress",
        "savedLocationLat",
        "savedLocationLng",
        "deliveryInstructions",
        "preferredCarriers",
        "returnAddressName",
        "returnAddressDetails",
        "profileVisibility",
        "walletBalance",
        "subscriptionStatus",
        "verified",
        "emailVerified"
      ];
      const updates = {};
      for (const key of Object.keys(req.body)) {
        if (allowedFields.includes(key)) updates[key] = req.body[key];
      }
      const updated = Object.keys(updates).length ? await db.update(users).set(updates).where(eq4(users.id, req.params.id)).returning() : [user];
      res.json(updated[0] || user);
    } catch (error) {
      console.error("Failed to update user:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });
  app2.delete("/api/parcels/:id", async (req, res) => {
    try {
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
  app2.delete("/api/messages/:id", async (req, res) => {
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
  app2.get("/api/users/:userId/connections", async (req, res) => {
    try {
      const userConnections = await storage.getUserConnections(req.params.userId);
      res.json(userConnections);
    } catch (error) {
      console.error("Failed to fetch connections:", error);
      res.status(500).json({ error: "Failed to fetch connections" });
    }
  });
  app2.post("/api/users/:userId/connections", async (req, res) => {
    try {
      const parsed = insertConnectionSchema.safeParse({
        ...req.body,
        userId: req.params.userId
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
  app2.get("/api/users/:userId/blocked", requireAuth, async (req, res) => {
    try {
      if (req.user.uid !== req.params.userId) return res.status(403).json({ error: "Forbidden" });
      const blocked = await storage.getBlockedUsers(req.params.userId);
      res.json(blocked);
    } catch (error) {
      console.error("Failed to fetch blocked users:", error);
      res.status(500).json({ error: "Failed to fetch blocked users" });
    }
  });
  app2.post("/api/users/:userId/blocked", requireAuth, async (req, res) => {
    try {
      if (req.user.uid !== req.params.userId) return res.status(403).json({ error: "Forbidden" });
      const { blockedUserId, blockedUserEmail } = req.body;
      let targetUserId = blockedUserId;
      if (!targetUserId && blockedUserEmail) {
        const u = await storage.getUserByEmail(blockedUserEmail);
        if (!u) return res.status(404).json({ error: "User not found" });
        targetUserId = u.id;
      }
      if (!targetUserId) return res.status(400).json({ error: "blockedUserId or blockedUserEmail is required" });
      const ok = await storage.blockUser(req.params.userId, targetUserId);
      if (!ok) return res.status(409).json({ error: "Already blocked" });
      res.status(201).json({ success: true });
    } catch (error) {
      console.error("Failed to block user:", error);
      res.status(500).json({ error: "Failed to block user" });
    }
  });
  app2.delete("/api/users/:userId/blocked/:blockedUserId", requireAuth, async (req, res) => {
    try {
      if (req.user.uid !== req.params.userId) return res.status(403).json({ error: "Forbidden" });
      const ok = await storage.unblockUser(req.params.userId, req.params.blockedUserId);
      if (!ok) return res.status(404).json({ error: "Not found" });
      res.status(204).send();
    } catch (error) {
      console.error("Failed to unblock user:", error);
      res.status(500).json({ error: "Failed to unblock user" });
    }
  });
  app2.delete("/api/users/:userId/connections/:connectedUserId", async (req, res) => {
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
  app2.get("/api/geocode", async (req, res) => {
    try {
      const { q } = req.query;
      if (!q || typeof q !== "string") {
        return res.status(400).json({ error: "Query parameter 'q' is required" });
      }
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5`,
        {
          headers: {
            "User-Agent": "ParcelPeer/1.0"
          }
        }
      );
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("Geocoding failed:", error);
      res.status(500).json({ error: "Geocoding failed" });
    }
  });
  app2.get("/api/routes", async (req, res) => {
    try {
      const allRoutes = await db.select({
        route: routes,
        carrier: users
      }).from(routes).innerJoin(users, eq4(routes.carrierId, users.id)).where(eq4(routes.status, "Active")).orderBy(desc3(routes.departureDate));
      const result = allRoutes.map(({ route, carrier }) => ({
        ...route,
        carrierName: carrier.name,
        carrierRating: carrier.rating
      }));
      res.json(result);
    } catch (error) {
      console.error("Failed to fetch routes:", error);
      res.status(500).json({ error: "Failed to fetch routes" });
    }
  });
  app2.get("/api/routes/:id", async (req, res) => {
    try {
      const routeWithCarrier = await storage.getRouteWithCarrier(req.params.id);
      if (!routeWithCarrier) {
        return res.status(404).json({ error: "Route not found" });
      }
      res.json({
        ...routeWithCarrier,
        carrierName: routeWithCarrier.carrier.name,
        carrierRating: routeWithCarrier.carrier.rating
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch route" });
    }
  });
  app2.get("/api/users/:userId/routes", async (req, res) => {
    try {
      const userRoutes = await storage.getUserRoutes(req.params.userId);
      res.json(userRoutes);
    } catch (error) {
      console.error("Failed to fetch user routes:", error);
      res.status(500).json({ error: "Failed to fetch user routes" });
    }
  });
  app2.post("/api/payments/initialize", requireAuth, async (req, res) => {
    try {
      const { amount, email, metadata } = req.body;
      if (!amount || !email) {
        return res.status(400).json({ error: "Amount and email are required" });
      }
      const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
      if (!paystackSecretKey) {
        return res.status(500).json({ error: "Paystack configuration missing" });
      }
      const protocol = req.get("x-forwarded-proto") || req.protocol || "https";
      const host = req.get("x-forwarded-host") || req.get("host");
      const baseUrl = `${protocol}://${host}`;
      const response = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          amount: Math.round(amount * 100),
          // Convert to kobo/cents
          email,
          metadata,
          callback_url: `${baseUrl}/api/payments/verify-web`
        })
      });
      const data = await response.json();
      if (!data.status) {
        throw new Error(data.message || "Failed to initialize Paystack transaction");
      }
      const platformFee = Math.round(amount * 0.03);
      const totalAmount = amount + platformFee;
      await storage.createPayment({
        parcelId: metadata.parcelId,
        userId: req.user.uid,
        reference: data.data.reference,
        amount: Math.round(amount),
        platformFee,
        totalAmount,
        status: "pending",
        paymentMethod: "paystack",
        paystackData: JSON.stringify(data.data)
      });
      res.json(data.data);
    } catch (error) {
      console.error("Paystack initialization error:", error);
      res.status(500).json({ error: error.message || "Failed to initialize payment" });
    }
  });
  app2.get("/api/payments/verify/:reference", requireAuth, async (req, res) => {
    try {
      const { reference } = req.params;
      const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
      if (!paystackSecretKey) {
        return res.status(500).json({ error: "Payment configuration missing" });
      }
      const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`
        }
      });
      const data = await response.json();
      if (data.status && data.data.status === "success") {
        const { parcelId } = data.data.metadata;
        if (parcelId) {
          await storage.updateParcel(parcelId, { status: "Paid" });
        }
      }
      res.json(data);
    } catch (error) {
      console.error("Paystack verification error:", error);
      res.status(500).json({ error: error.message || "Failed to verify payment" });
    }
  });
  app2.post("/api/payments/webhook", async (req, res) => {
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
        const payment = await storage.getPaymentByReference(reference);
        if (payment) {
          await storage.updatePayment(payment.id, { status: "success" });
          if (metadata?.parcelId) {
            await storage.updateParcel(metadata.parcelId, { status: "Paid" });
          }
        }
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app2.get("/api/payments/history", requireAuth, async (req, res) => {
    try {
      const payments2 = await storage.getPaymentsByUserId(req.user.uid);
      res.json(payments2);
    } catch (error) {
      console.error("Failed to fetch payment history:", error);
      res.status(500).json({ error: error.message || "Failed to fetch payment history" });
    }
  });
  app2.get("/api/payments/:paymentId/receipt", requireAuth, async (req, res) => {
    try {
      const payment = await db.select().from(payments).where(eq4(payments.id, req.params.paymentId));
      if (!payment.length) {
        return res.status(404).json({ error: "Payment not found" });
      }
      const paymentRecord = payment[0];
      if (paymentRecord.userId !== req.user.uid) {
        return res.status(403).json({ error: "Not authorized to view this receipt" });
      }
      const parcelData = await storage.getParcel(paymentRecord.parcelId);
      const userData = await storage.getUser(req.user.uid);
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
                <span class="value status-${paymentRecord.status || "pending"}">${(paymentRecord.status || "pending").toUpperCase()}</span>
              </div>
              <div class="row">
                <span class="label">Date:</span>
                <span class="value">${new Date(paymentRecord.createdAt || /* @__PURE__ */ new Date()).toLocaleDateString()}</span>
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
                <span class="value">${parcelData?.origin || "N/A"}</span>
              </div>
              <div class="row">
                <span class="label">To:</span>
                <span class="value">${parcelData?.destination || "N/A"}</span>
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
              <p>Payer: ${userData?.name || "Unknown"}</p>
              <p>Email: ${userData?.email || "N/A"}</p>
              <p style="margin-top: 15px; font-size: 11px;">Generated on ${(/* @__PURE__ */ new Date()).toLocaleString()}</p>
              <p style="margin-top: 10px;">Thank you for using ParcelPeer</p>
            </div>
          </div>
        </body>
        </html>
      `;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(receiptHTML);
    } catch (error) {
      console.error("Failed to generate receipt:", error);
      res.status(500).json({ error: error.message || "Failed to generate receipt" });
    }
  });
  app2.get("/api/payments/verify-web", async (req, res) => {
    const { reference } = req.query;
    res.send(`
      <html>
        <body>
          <h1>Payment Processing</h1>
          <p>Your payment is being verified. You can close this window.</p>
          <script>
            setTimeout(() => window.close(), 3000);
          </script>
        </body>
      </html>
    `);
  });
  app2.post("/api/routes", requireAuth, async (req, res) => {
    try {
      const body = { ...req.body };
      if (typeof body.departureDate === "string") body.departureDate = new Date(body.departureDate);
      if (typeof body.recurrenceEndDate === "string" && body.recurrenceEndDate) body.recurrenceEndDate = new Date(body.recurrenceEndDate);
      const parsed = insertRouteSchema.safeParse({
        ...body,
        carrierId: req.user.uid
      });
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const routeData = { ...parsed.data };
      try {
        const [originGeo, destGeo] = await Promise.all([
          fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(parsed.data.origin)}&limit=1`, {
            headers: { "User-Agent": "ParcelPeer/1.0" }
          }).then((r) => r.json()),
          fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(parsed.data.destination)}&limit=1`, {
            headers: { "User-Agent": "ParcelPeer/1.0" }
          }).then((r) => r.json())
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
  app2.patch("/api/routes/:id", requireAuth, async (req, res) => {
    try {
      const existingRoute = await storage.getRoute(req.params.id);
      if (!existingRoute) {
        return res.status(404).json({ error: "Route not found" });
      }
      if (existingRoute.carrierId !== req.user.uid) {
        return res.status(403).json({ error: "Not authorized to update this route" });
      }
      const route = await storage.updateRoute(req.params.id, req.body);
      res.json(route);
    } catch (error) {
      console.error("Failed to update route:", error);
      res.status(500).json({ error: "Failed to update route" });
    }
  });
  app2.delete("/api/routes/:id", requireAuth, async (req, res) => {
    try {
      const existingRoute = await storage.getRoute(req.params.id);
      if (!existingRoute) {
        return res.status(404).json({ error: "Route not found" });
      }
      if (existingRoute.carrierId !== req.user.uid) {
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
  function calculateDistance2(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  const SIZE_ORDER = { small: 1, medium: 2, large: 3 };
  app2.get("/api/routes/:routeId/matching-parcels", requireAuth, async (req, res) => {
    try {
      const route = await storage.getRoute(req.params.routeId);
      if (!route) {
        return res.status(404).json({ error: "Route not found" });
      }
      const pendingParcels = await db.select({ parcel: parcels, sender: users }).from(parcels).innerJoin(users, eq4(parcels.senderId, users.id)).where(and3(
        eq4(parcels.status, "Pending"),
        ne(parcels.senderId, req.user.uid)
      ));
      const maxDistanceKm = 50;
      const matchingParcels = pendingParcels.filter(({ parcel }) => {
        if (!route.originLat || !route.originLng || !route.destinationLat || !route.destinationLng) {
          return parcel.origin.toLowerCase().includes(route.origin.toLowerCase()) || route.origin.toLowerCase().includes(parcel.origin.toLowerCase());
        }
        if (!parcel.originLat || !parcel.originLng || !parcel.destinationLat || !parcel.destinationLng) {
          return parcel.origin.toLowerCase().includes(route.origin.toLowerCase()) || route.origin.toLowerCase().includes(parcel.origin.toLowerCase());
        }
        const originDistance = calculateDistance2(
          route.originLat,
          route.originLng,
          parcel.originLat,
          parcel.originLng
        );
        const destDistance = calculateDistance2(
          route.destinationLat,
          route.destinationLng,
          parcel.destinationLat,
          parcel.destinationLng
        );
        return originDistance <= maxDistanceKm && destDistance <= maxDistanceKm;
      }).filter(({ parcel }) => {
        const routeDate = new Date(route.departureDate);
        const parcelDate = new Date(parcel.pickupDate);
        const daysDiff = Math.abs((routeDate.getTime() - parcelDate.getTime()) / (1e3 * 60 * 60 * 24));
        if (route.frequency === "one_time") {
          return daysDiff <= 2;
        } else if (route.frequency === "daily") {
          return true;
        } else if (route.frequency === "weekly") {
          return daysDiff <= 7;
        } else {
          return daysDiff <= 30;
        }
      }).filter(({ parcel }) => {
        if (!route.maxParcelSize) return true;
        return SIZE_ORDER[parcel.size] <= SIZE_ORDER[route.maxParcelSize];
      }).filter(({ parcel }) => {
        if (!route.maxWeight || !parcel.weight) return true;
        return parcel.weight <= route.maxWeight;
      }).map(({ parcel, sender }) => {
        let score = 100;
        if (route.originLat && route.originLng && parcel.originLat && parcel.originLng) {
          const originDistance = calculateDistance2(
            route.originLat,
            route.originLng,
            parcel.originLat,
            parcel.originLng
          );
          score -= originDistance;
        }
        return {
          ...parcel,
          senderName: sender.name,
          senderRating: sender.rating,
          matchScore: Math.max(0, Math.round(score))
        };
      }).sort((a, b) => b.matchScore - a.matchScore);
      res.json(matchingParcels);
    } catch (error) {
      console.error("Failed to find matching parcels:", error);
      res.status(500).json({ error: "Failed to find matching parcels" });
    }
  });
  app2.get("/api/parcels/:parcelId/matching-routes", async (req, res) => {
    try {
      const parcel = await storage.getParcel(req.params.parcelId);
      if (!parcel) {
        return res.status(404).json({ error: "Parcel not found" });
      }
      const activeRoutes = await db.select({ route: routes, carrier: users }).from(routes).innerJoin(users, eq4(routes.carrierId, users.id)).where(and3(
        eq4(routes.status, "Active"),
        ne(routes.carrierId, parcel.senderId)
      ));
      const maxDistanceKm = 50;
      const matchingRoutes = activeRoutes.filter(({ route }) => {
        if (!route.originLat || !route.originLng || !route.destinationLat || !route.destinationLng) {
          return parcel.origin.toLowerCase().includes(route.origin.toLowerCase()) || route.origin.toLowerCase().includes(parcel.origin.toLowerCase());
        }
        if (!parcel.originLat || !parcel.originLng || !parcel.destinationLat || !parcel.destinationLng) {
          return parcel.origin.toLowerCase().includes(route.origin.toLowerCase()) || route.origin.toLowerCase().includes(parcel.origin.toLowerCase());
        }
        const originDistance = calculateDistance2(
          route.originLat,
          route.originLng,
          parcel.originLat,
          parcel.originLng
        );
        const destDistance = calculateDistance2(
          route.destinationLat,
          route.destinationLng,
          parcel.destinationLat,
          parcel.destinationLng
        );
        return originDistance <= maxDistanceKm && destDistance <= maxDistanceKm;
      }).filter(({ route }) => {
        const routeDate = new Date(route.departureDate);
        const parcelDate = new Date(parcel.pickupDate);
        const daysDiff = Math.abs((routeDate.getTime() - parcelDate.getTime()) / (1e3 * 60 * 60 * 24));
        if (route.frequency === "one_time") {
          return daysDiff <= 2;
        } else if (route.frequency === "daily") {
          return true;
        } else if (route.frequency === "weekly") {
          return daysDiff <= 7;
        } else {
          return daysDiff <= 30;
        }
      }).filter(({ route }) => {
        if (!route.maxParcelSize) return true;
        return SIZE_ORDER[parcel.size] <= SIZE_ORDER[route.maxParcelSize];
      }).filter(({ route }) => {
        if (!route.maxWeight || !parcel.weight) return true;
        return parcel.weight <= route.maxWeight;
      }).map(({ route, carrier }) => {
        let score = 100;
        if (route.originLat && route.originLng && parcel.originLat && parcel.originLng) {
          const originDistance = calculateDistance2(
            route.originLat,
            route.originLng,
            parcel.originLat,
            parcel.originLng
          );
          score -= originDistance;
        }
        return {
          ...route,
          carrierName: carrier.name,
          carrierRating: carrier.rating,
          matchScore: Math.max(0, Math.round(score))
        };
      }).sort((a, b) => b.matchScore - a.matchScore);
      res.json(matchingRoutes);
    } catch (error) {
      console.error("Failed to find matching routes:", error);
      res.status(500).json({ error: "Failed to find matching routes" });
    }
  });
  app2.get("/api/users/:userId/reviews", async (req, res) => {
    try {
      const userReviews = await storage.getUserReviews(req.params.userId);
      res.json(userReviews);
    } catch (error) {
      console.error("Failed to fetch reviews:", error);
      res.status(500).json({ error: "Failed to fetch reviews" });
    }
  });
  app2.post("/api/reviews", requireAuth, async (req, res) => {
    try {
      const parsed = insertReviewSchema.safeParse({
        ...req.body,
        reviewerId: req.user.uid
      });
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      const existing = await storage.getReviewByParcelAndReviewer(
        parsed.data.parcelId,
        req.user.uid
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
  app2.post("/api/push-tokens", requireAuth, async (req, res) => {
    try {
      const parsed = insertPushTokenSchema.safeParse({
        ...req.body,
        userId: req.user.uid
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
  app2.delete("/api/push-tokens/:token", requireAuth, async (req, res) => {
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
    const now = /* @__PURE__ */ new Date();
    try {
      const capacityFullRoutes = await db.update(routes).set({ status: "Expired", updatedAt: now }).where(and3(
        eq4(routes.status, "Active"),
        sql2`${routes.availableCapacity} IS NOT NULL AND ${routes.capacityUsed} >= ${routes.availableCapacity}`
      )).returning();
      if (capacityFullRoutes.length > 0) {
        console.log(`Expired ${capacityFullRoutes.length} routes due to full capacity`);
      }
      const routesToExpire = await db.select().from(routes).where(and3(
        eq4(routes.status, "Active"),
        lte(routes.departureDate, now)
      ));
      const expiredRoutes = await db.update(routes).set({ status: "Expired", updatedAt: now }).where(and3(
        eq4(routes.status, "Active"),
        lte(routes.departureDate, now)
      )).returning();
      for (const expiredRoute of expiredRoutes) {
        if (expiredRoute.frequency && expiredRoute.frequency !== "one_time") {
          const shouldCreateNext = !expiredRoute.recurrenceEndDate || new Date(expiredRoute.recurrenceEndDate) > now;
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
                parentRouteId: expiredRoute.parentRouteId || expiredRoute.id
              });
              console.log(`Created next occurrence for recurring route ${expiredRoute.id}`);
            }
          }
        }
      }
      const expiredParcels = await db.update(parcels).set({ status: "Expired" }).where(and3(
        eq4(parcels.status, "Pending"),
        lte(parcels.expiresAt, now)
      )).returning();
      if (expiredRoutes.length > 0 || expiredParcels.length > 0) {
        console.log(`Expiry check: ${expiredRoutes.length} routes, ${expiredParcels.length} parcels expired`);
      }
    } catch (error) {
      console.error("Expiry check failed:", error);
    }
  }
  app2.post("/api/admin/check-expiry", async (req, res) => {
    try {
      await checkAndExpireItems();
      res.json({ success: true, message: "Expiry check completed" });
    } catch (error) {
      res.status(500).json({ error: "Failed to run expiry check" });
    }
  });
  app2.get("/api/parcels/:parcelId/messages", async (req, res) => {
    try {
      const msgs = await db.select({ id: parcelMessages.id, parcelId: parcelMessages.parcelId, senderId: parcelMessages.senderId, senderName: users.name, senderRole: parcelMessages.senderRole, content: parcelMessages.content, createdAt: parcelMessages.createdAt }).from(parcelMessages).innerJoin(users, eq4(parcelMessages.senderId, users.id)).where(eq4(parcelMessages.parcelId, req.params.parcelId)).orderBy(parcelMessages.createdAt);
      res.json(msgs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });
  app2.post("/api/parcels/:parcelId/messages", requireAuth, async (req, res) => {
    try {
      const parcel = await storage.getParcel(req.params.parcelId);
      if (!parcel) {
        return res.status(404).json({ error: "Parcel not found" });
      }
      const userId = req.user.uid;
      const userEmail = req.user.email;
      const isParticipant = userId === parcel.senderId || userId === parcel.transporterId || userId === parcel.receiverId || userEmail && parcel.receiverEmail && userEmail.toLowerCase() === parcel.receiverEmail.toLowerCase();
      if (!isParticipant) {
        return res.status(403).json({ error: "You don't have permission to send messages for this parcel" });
      }
      const parsed = insertParcelMessageSchema.safeParse({
        parcelId: req.params.parcelId,
        senderId: req.user.uid,
        content: req.body.content,
        senderRole: req.body.senderRole
      });
      if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
      const msg = await db.insert(parcelMessages).values(parsed.data).returning();
      const sender = await storage.getUser(req.user.uid);
      const completeMsg = {
        ...msg[0],
        senderName: sender?.name || "Unknown"
      };
      res.json(completeMsg);
    } catch (error) {
      console.error("Failed to send message:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });
  app2.get("/api/parcels/:parcelId/carrier-location", async (req, res) => {
    try {
      const loc = await db.select().from(carrierLocations).where(eq4(carrierLocations.parcelId, req.params.parcelId)).orderBy(desc3(carrierLocations.timestamp)).limit(1);
      res.json(loc[0] || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch carrier location" });
    }
  });
  app2.post("/api/parcels/:parcelId/carrier-location", requireAuth, async (req, res) => {
    try {
      const parsed = insertCarrierLocationSchema.safeParse({
        parcelId: req.params.parcelId,
        carrierId: req.user.uid,
        lat: req.body.lat,
        lng: req.body.lng,
        heading: req.body.heading,
        speed: req.body.speed,
        accuracy: req.body.accuracy
      });
      if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
      const loc = await db.insert(carrierLocations).values(parsed.data).returning();
      res.json(loc[0]);
    } catch (error) {
      res.status(500).json({ error: "Failed to save carrier location" });
    }
  });
  app2.get("/api/parcels/:parcelId/receiver-location", async (req, res) => {
    try {
      const loc = await db.select().from(receiverLocations).where(eq4(receiverLocations.parcelId, req.params.parcelId)).orderBy(desc3(receiverLocations.timestamp)).limit(1);
      res.json(loc[0] || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch receiver location" });
    }
  });
  app2.post("/api/parcels/:parcelId/receiver-location", requireAuth, async (req, res) => {
    try {
      const parsed = insertReceiverLocationSchema.safeParse({
        parcelId: req.params.parcelId,
        receiverId: req.user.uid,
        lat: req.body.lat,
        lng: req.body.lng,
        accuracy: req.body.accuracy
      });
      if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
      const loc = await db.insert(receiverLocations).values(parsed.data).returning();
      res.json(loc[0]);
    } catch (error) {
      res.status(500).json({ error: "Failed to save receiver location" });
    }
  });
  checkAndExpireItems();
  setInterval(checkAndExpireItems, 60 * 60 * 1e3);
  app2.post("/api/wallet/topup/initialize", requireAuth, async (req, res) => {
    try {
      const { amount, currency, email } = req.body;
      if (!amount || !currency || !email) {
        return res.status(400).json({ error: "Amount, currency, and email are required" });
      }
      if (amount < 5 || amount > 5e4) {
        return res.status(400).json({ error: "Invalid amount" });
      }
      const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
      if (!paystackSecretKey) {
        return res.status(500).json({ error: "Payment configuration missing" });
      }
      const user = await storage.getUser(req.user.uid);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const protocol = req.get("x-forwarded-proto") || req.protocol || "https";
      const host = req.get("x-forwarded-host") || req.get("host");
      const baseUrl = `${protocol}://${host}`;
      const amountInSmallestUnit = Math.round(amount * 100);
      const response = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          amount: amountInSmallestUnit,
          // Already in smallest unit
          email,
          currency: currency.toUpperCase(),
          metadata: {
            userId: req.user.uid,
            type: "wallet_topup",
            currency
          },
          callback_url: `${baseUrl}/api/wallet/topup/verify-web`
        })
      });
      const data = await response.json();
      if (!data.status) {
        throw new Error(data.message || "Failed to initialize Paystack transaction");
      }
      await db.insert(walletTransactions).values({
        userId: req.user.uid,
        type: "topup",
        amount: amountInSmallestUnit,
        currency: currency.toUpperCase(),
        status: "pending",
        reference: data.data.reference,
        description: `Wallet top-up`,
        paymentMethod: "paystack",
        paymentData: JSON.stringify(data.data),
        balanceBefore: user.walletBalance,
        balanceAfter: user.walletBalance
        // Will be updated on success
      });
      res.json(data.data);
    } catch (error) {
      console.error("Wallet top-up initialization error:", error);
      res.status(500).json({ error: error.message || "Failed to initialize top-up" });
    }
  });
  app2.get("/api/wallet/topup/verify/:reference", requireAuth, async (req, res) => {
    try {
      const { reference } = req.params;
      const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
      if (!paystackSecretKey) {
        return res.status(500).json({ error: "Payment configuration missing" });
      }
      const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`
        }
      });
      const data = await response.json();
      if (data.status && data.data.status === "success") {
        const { metadata, amount, currency } = data.data;
        const txnResult = await db.select().from(walletTransactions).where(eq4(walletTransactions.reference, reference));
        if (txnResult.length > 0 && txnResult[0].status === "pending") {
          const transaction = txnResult[0];
          const user = await storage.getUser(metadata.userId);
          if (user) {
            const newBalance = user.walletBalance + transaction.amount;
            await db.update(users).set({ walletBalance: newBalance }).where(eq4(users.id, metadata.userId));
            await db.update(walletTransactions).set({
              status: "completed",
              balanceAfter: newBalance,
              completedAt: /* @__PURE__ */ new Date()
            }).where(eq4(walletTransactions.reference, reference));
          }
        }
      }
      res.json(data);
    } catch (error) {
      console.error("Wallet top-up verification error:", error);
      res.status(500).json({ error: error.message || "Failed to verify top-up" });
    }
  });
  app2.get("/api/wallet/topup/verify-web", async (req, res) => {
    const { reference } = req.query;
    res.send(`
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px; text-align: center; background: #f5f5f5; }
            .container { max-width: 400px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { color: #0A58FF; margin-bottom: 10px; }
            p { color: #666; }
            .icon { font-size: 48px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">\u2713</div>
            <h1>Processing Payment</h1>
            <p>Your wallet top-up is being verified. You can close this window and return to the app.</p>
          </div>
          <script>
            setTimeout(() => window.close(), 3000);
          </script>
        </body>
      </html>
    `);
  });
  app2.get("/api/wallet/transactions", requireAuth, async (req, res) => {
    try {
      const transactions = await db.select().from(walletTransactions).where(eq4(walletTransactions.userId, req.user.uid)).orderBy(desc3(walletTransactions.createdAt));
      res.json(transactions);
    } catch (error) {
      console.error("Failed to fetch wallet transactions:", error);
      res.status(500).json({ error: error.message || "Failed to fetch transactions" });
    }
  });
  app2.get("/api/wallet/balance", requireAuth, async (req, res) => {
    try {
      const user = await storage.getUser(req.user.uid);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ balance: user.walletBalance, currency: "ZAR" });
    } catch (error) {
      console.error("Failed to fetch wallet balance:", error);
      res.status(500).json({ error: error.message || "Failed to fetch balance" });
    }
  });
  app2.get("/api/payment-methods", requireAuth, async (req, res) => {
    try {
      const methods = await storage.getSavedPaymentMethods(req.user.uid);
      res.json({ data: methods });
    } catch (error) {
      console.error("Failed to fetch payment methods:", error);
      res.status(500).json({ error: error.message || "Failed to fetch payment methods" });
    }
  });
  app2.post("/api/payment-methods", requireAuth, async (req, res) => {
    try {
      const { cardLast4, cardBrand, authorizationCode } = req.body;
      if (!cardLast4 || !cardBrand || !authorizationCode) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      const method = await storage.createSavedPaymentMethod(
        req.user.uid,
        cardLast4,
        cardBrand,
        authorizationCode
      );
      res.status(201).json({ data: method });
    } catch (error) {
      console.error("Failed to save payment method:", error);
      res.status(500).json({ error: error.message || "Failed to save payment method" });
    }
  });
  app2.patch("/api/payment-methods/:methodId/default", requireAuth, async (req, res) => {
    try {
      const { methodId } = req.params;
      const success = await storage.setSavedPaymentMethodAsDefault(req.user.uid, methodId);
      if (!success) {
        return res.status(404).json({ error: "Payment method not found" });
      }
      res.json({ status: "success" });
    } catch (error) {
      console.error("Failed to set default payment method:", error);
      res.status(500).json({ error: error.message || "Failed to set default payment method" });
    }
  });
  app2.delete("/api/payment-methods/:methodId", requireAuth, async (req, res) => {
    try {
      const { methodId } = req.params;
      const success = await storage.deleteSavedPaymentMethod(methodId, req.user.uid);
      if (!success) {
        return res.status(404).json({ error: "Payment method not found" });
      }
      res.json({ status: "success" });
    } catch (error) {
      console.error("Failed to delete payment method:", error);
      res.status(500).json({ error: error.message || "Failed to delete payment method" });
    }
  });
  app2.get("/api/auto-topup", requireAuth, async (req, res) => {
    try {
      const settings = await storage.getAutoTopUpSettings(req.user.uid);
      if (!settings) {
        return res.json({ data: null });
      }
      res.json({ data: settings });
    } catch (error) {
      console.error("Failed to fetch auto top-up settings:", error);
      res.status(500).json({ error: error.message || "Failed to fetch auto top-up settings" });
    }
  });
  app2.patch("/api/auto-topup", requireAuth, async (req, res) => {
    try {
      const { isEnabled, triggerAmount, topupAmount, paymentMethodId } = req.body;
      const settings = await storage.updateAutoTopUpSettings(
        req.user.uid,
        isEnabled,
        triggerAmount,
        topupAmount,
        paymentMethodId
      );
      res.json({ data: settings });
    } catch (error) {
      console.error("Failed to update auto top-up settings:", error);
      res.status(500).json({ error: error.message || "Failed to update auto top-up settings" });
    }
  });
  app2.get("/api/subscription", requireAuth, async (req, res) => {
    try {
      const subscription = await storage.getSubscription(req.user.uid);
      res.json(subscription || null);
    } catch (error) {
      console.error("Failed to fetch subscription:", error);
      res.status(500).json({ error: error.message || "Failed to fetch subscription" });
    }
  });
  app2.post("/api/subscription/upgrade", requireAuth, async (req, res) => {
    try {
      const { planId } = req.body;
      if (!planId) {
        return res.status(400).json({ error: "Missing planId" });
      }
      const subscription = await storage.createSubscription(req.user.uid, planId);
      res.status(201).json(subscription);
    } catch (error) {
      console.error("Failed to upgrade subscription:", error);
      res.status(500).json({ error: error.message || "Failed to upgrade subscription" });
    }
  });
  app2.post("/api/subscription/cancel", requireAuth, async (req, res) => {
    try {
      const subscription = await storage.cancelSubscription(req.user.uid);
      if (!subscription) {
        return res.status(404).json({ error: "No active subscription found" });
      }
      res.json(subscription);
    } catch (error) {
      console.error("Failed to cancel subscription:", error);
      res.status(500).json({ error: error.message || "Failed to cancel subscription" });
    }
  });
  app2.post("/api/contact", async (req, res) => {
    try {
      const { name, email, phone, subject, message } = req.body;
      if (!name || !email || !subject || !message) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      console.log("Contact form submission:", {
        name,
        email,
        phone,
        subject,
        message,
        timestamp: /* @__PURE__ */ new Date()
      });
      res.json({ success: true, message: "Contact form submitted successfully" });
    } catch (error) {
      console.error("Contact form error:", error);
      res.status(500).json({ error: "Failed to submit contact form" });
    }
  });
  app2.post("/api/complaints", async (req, res) => {
    try {
      const { name, email, type, description, reference_id } = req.body;
      if (!name || !email || !type || !description) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      console.log("Complaint submission:", {
        name,
        email,
        type,
        description,
        reference_id,
        timestamp: /* @__PURE__ */ new Date()
      });
      res.json({
        success: true,
        message: "Complaint submitted successfully",
        complaint_id: `COMP-${Date.now()}`
      });
    } catch (error) {
      console.error("Complaint submission error:", error);
      res.status(500).json({ error: "Failed to submit complaint" });
    }
  });
  registerReceiverEnhancements(app2);
  const httpServer = createServer(app2);
  return httpServer;
}

// server/index.ts
import * as fs2 from "fs";
import * as path2 from "path";
import { createProxyMiddleware } from "http-proxy-middleware";
var app = express();
var log = console.log;
function setupCors(app2) {
  app2.use((req, res, next) => {
    const origins = /* @__PURE__ */ new Set();
    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }
    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        origins.add(`https://${d.trim()}`);
      });
    }
    const origin = req.header("origin");
    if (origin && origins.has(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, PATCH, DELETE, OPTIONS"
      );
      res.header(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization"
      );
      res.header("Access-Control-Allow-Credentials", "true");
    }
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
}
function setupBodyParsing(app2) {
  app2.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );
  app2.use(express.urlencoded({ extended: false }));
}
function setupRequestLogging(app2) {
  app2.use((req, res, next) => {
    const start = Date.now();
    const path3 = req.path;
    let capturedJsonResponse = void 0;
    const originalResJson = res.json;
    res.json = function(bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
    res.on("finish", () => {
      if (!path3.startsWith("/api")) return;
      const duration = Date.now() - start;
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    });
    next();
  });
}
function serveExpoManifest(platform, res) {
  const manifestPath = path2.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json"
  );
  if (!fs2.existsSync(manifestPath)) {
    return res.status(404).json({ error: `Manifest not found for platform: ${platform}` });
  }
  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");
  const manifest = fs2.readFileSync(manifestPath, "utf-8");
  res.send(manifest);
}
function configureProductionLanding(app2) {
  app2.get("/", (_req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>ParcelPeer \u2013 The GTW</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #f1f5f9; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
    .card { background: #1e293b; border-radius: 16px; padding: 48px 40px; max-width: 480px; width: 100%; text-align: center; box-shadow: 0 25px 50px rgba(0,0,0,0.4); }
    .badge { display: inline-block; background: #22c55e20; color: #22c55e; border: 1px solid #22c55e40; border-radius: 999px; font-size: 12px; font-weight: 600; padding: 4px 14px; margin-bottom: 28px; letter-spacing: 0.05em; text-transform: uppercase; }
    h1 { font-size: 2rem; font-weight: 700; margin-bottom: 12px; }
    p { color: #94a3b8; line-height: 1.6; margin-bottom: 32px; }
    .btn { display: inline-block; background: #6366f1; color: #fff; text-decoration: none; border-radius: 10px; padding: 14px 28px; font-weight: 600; font-size: 15px; transition: background 0.2s; }
    .btn:hover { background: #4f46e5; }
    .api { margin-top: 24px; font-size: 13px; color: #475569; }
    .api span { color: #22c55e; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">\u25CF Live</div>
    <h1>ParcelPeer</h1>
    <p>The GTW \u2014 peer-to-peer parcel delivery platform. Download the mobile app to send and carry parcels.</p>
    <a href="/dashboard" class="btn">Open Provider Dashboard</a>
    <p class="api">API status: <span>operational</span></p>
  </div>
</body>
</html>`);
  });
  log("\u2713 Landing page served at /");
}
function configureDashboard(app2) {
  const dashboardDir = path2.resolve(process.cwd(), "static", "dashboard");
  app2.use("/dashboard", express.static(dashboardDir));
  app2.get(/^\/dashboard(\/.*)?$/, (_req, res) => {
    res.sendFile(path2.join(dashboardDir, "index.html"));
  });
  log("\u2713 Provider dashboard served at /dashboard");
}
function configureExpoAndLanding(app2) {
  log("Proxying web requests to Expo Metro dev server on port 8081");
  app2.use("/assets", express.static(path2.resolve(process.cwd(), "assets")));
  app2.use((req, res, next) => {
    const platform = req.header("expo-platform");
    if (!req.path.startsWith("/api") && platform && (platform === "ios" || platform === "android")) {
      return serveExpoManifest(platform, res);
    }
    next();
  });
  app2.use(
    createProxyMiddleware({
      target: "http://localhost:8081",
      changeOrigin: true,
      ws: true,
      pathFilter: (path3) => !path3.startsWith("/api") && !path3.startsWith("/assets") && !path3.startsWith("/dashboard"),
      on: {
        error: (_err, _req, res) => {
          res.status(502).send(
            "<html><body style='font-family:sans-serif;padding:40px'><h2>Expo Dev Server starting...</h2><p>The Expo Metro bundler is warming up. Please refresh in a moment.</p><script>setTimeout(()=>location.reload(),3000)</script></body></html>"
          );
        }
      }
    })
  );
  log("\u2713 Expo web app proxied at / (API requests pass through to Node.js)");
}
function setupErrorHandler(app2) {
  app2.use((err, _req, res, _next) => {
    const error = err;
    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
}
async function createServerInstance() {
  setupCors(app);
  setupBodyParsing(app);
  setupRequestLogging(app);
  if (process.env.NODE_ENV === "production") {
    configureProductionLanding(app);
  }
  configureDashboard(app);
  if (process.env.NODE_ENV !== "production") {
    configureExpoAndLanding(app);
  }
  const server = await registerRoutes(app);
  setupErrorHandler(app);
  return server;
}
if (process.env.NODE_ENV !== "test") {
  (async () => {
    try {
      const server = await createServerInstance();
      const port = process.env.PORT ? parseInt(process.env.PORT) : 5e3;
      const listenOptions = { port, host: "0.0.0.0" };
      if (process.platform !== "win32") {
        listenOptions.reusePort = true;
      }
      server.listen(listenOptions, () => {
        log(`express server serving on port ${port}`);
      });
    } catch (error) {
      console.error("Failed to start server:", error);
      process.exit(1);
    }
  })();
}
export {
  createServerInstance
};
