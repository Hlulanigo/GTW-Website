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
var routeBookingStatusEnum = pgEnum("route_booking_status", ["Pending", "Approved", "Declined", "Cancelled"]);
var users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  photoUrl: text("photo_url"),
  rating: real("rating").default(5),
  verified: boolean("verified").default(false),
  role: text("role").notNull().default("user"),
  suspended: boolean("suspended").notNull().default(false),
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
var routeBookings = pgTable("route_bookings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  routeId: varchar("route_id").notNull().references(() => routes.id),
  parcelId: varchar("parcel_id").notNull().references(() => parcels.id),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  carrierId: varchar("carrier_id").notNull().references(() => users.id),
  pickupStop: text("pickup_stop"),
  dropoffStop: text("dropoff_stop"),
  message: text("message"),
  status: routeBookingStatusEnum("status").default("Pending").notNull(),
  responseNote: text("response_note"),
  respondedAt: timestamp("responded_at"),
  createdAt: timestamp("created_at").defaultNow()
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
var insertRouteBookingSchema = createInsertSchema(routeBookings).omit({
  id: true,
  createdAt: true,
  status: true,
  respondedAt: true,
  responseNote: true,
  carrierId: true,
  senderId: true
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
var disputes = pgTable("disputes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  parcelId: varchar("parcel_id").references(() => parcels.id),
  complainantId: varchar("complainant_id").notNull().references(() => users.id),
  respondentId: varchar("respondent_id").notNull().references(() => users.id),
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default("open"),
  resolution: text("resolution"),
  refundAmount: integer("refund_amount"),
  refundedToWallet: boolean("refunded_to_wallet").default(false),
  adminId: varchar("admin_id"),
  resolvedAt: timestamp("resolved_at"),
  autoCloseAt: timestamp("auto_close_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var disputeMessages = pgTable("dispute_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  disputeId: varchar("dispute_id").notNull().references(() => disputes.id),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  message: text("message").notNull(),
  attachmentUrl: text("attachment_url"),
  isAdminMessage: boolean("is_admin_message").default(false),
  createdAt: timestamp("created_at").defaultNow()
});
var insertDisputeSchema = createInsertSchema(disputes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true
});
var insertDisputeMessageSchema = createInsertSchema(disputeMessages).omit({
  id: true,
  createdAt: true
});
var parcelPhotos = pgTable("parcel_photos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  parcelId: varchar("parcel_id").notNull().references(() => parcels.id),
  uploadedBy: varchar("uploaded_by").notNull().references(() => users.id),
  photoUrl: text("photo_url").notNull(),
  photoType: text("photo_type").notNull(),
  caption: text("caption"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  createdAt: timestamp("created_at").defaultNow()
});
var insertParcelPhotoSchema = createInsertSchema(parcelPhotos).omit({
  id: true,
  createdAt: true
});
var deliveryProofs = pgTable("delivery_proofs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  parcelId: varchar("parcel_id").notNull().references(() => parcels.id),
  uploadedBy: varchar("uploaded_by").notNull().references(() => users.id),
  photoUrl: text("photo_url").notNull(),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  fileSizeBytes: integer("file_size_bytes").notNull(),
  sha256Hash: text("sha256_hash").notNull(),
  notes: text("notes"),
  uploadedAt: timestamp("uploaded_at").defaultNow()
});
var insertDeliveryProofSchema = createInsertSchema(deliveryProofs).omit({
  id: true,
  uploadedAt: true
});
var notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  data: text("data"),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow()
});
var insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true
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
    const compensationInKobo = Math.round(insertParcel.compensation * 100);
    if (user.subscriptionStatus === "free" && user.walletBalance < compensationInKobo) {
      throw new Error("Insufficient wallet balance");
    }
    let walletPaid = false;
    if (user.subscriptionStatus === "free" && user.walletBalance >= compensationInKobo) {
      const balanceBefore = user.walletBalance;
      const balanceAfter = balanceBefore - compensationInKobo;
      await db.update(users).set({ walletBalance: balanceAfter }).where(eq(users.id, user.id));
      await db.insert(walletTransactions).values({
        userId: user.id,
        type: "debit",
        amount: compensationInKobo,
        currency: "ZAR",
        status: "completed",
        reference: `parcel-debit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        description: `Parcel delivery: ${insertParcel.origin} \u2192 ${insertParcel.destination}`,
        balanceBefore,
        balanceAfter,
        completedAt: /* @__PURE__ */ new Date()
      });
      walletPaid = true;
    }
    const parcelToInsert = walletPaid ? { ...insertParcel, status: "Paid" } : insertParcel;
    const result = await db.insert(parcels).values(parcelToInsert).returning();
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
  async createRouteBooking(insert) {
    const result = await db.insert(routeBookings).values(insert).returning();
    return result[0];
  }
  async getRouteBooking(id) {
    const result = await db.select().from(routeBookings).where(eq(routeBookings.id, id));
    return result[0];
  }
  async getBookingsForRoute(routeId) {
    const result = await db.select().from(routeBookings).innerJoin(parcels, eq(routeBookings.parcelId, parcels.id)).innerJoin(users, eq(routeBookings.senderId, users.id)).where(eq(routeBookings.routeId, routeId)).orderBy(desc(routeBookings.createdAt));
    return result.map((r) => ({ ...r.route_bookings, parcel: r.parcels, sender: r.users }));
  }
  async getIncomingBookingsForCarrier(carrierId) {
    const result = await db.select().from(routeBookings).innerJoin(parcels, eq(routeBookings.parcelId, parcels.id)).innerJoin(users, eq(routeBookings.senderId, users.id)).innerJoin(routes, eq(routeBookings.routeId, routes.id)).where(eq(routeBookings.carrierId, carrierId)).orderBy(desc(routeBookings.createdAt));
    return result.map((r) => ({ ...r.route_bookings, parcel: r.parcels, sender: r.users, route: r.routes }));
  }
  async getOutgoingBookingsForSender(senderId) {
    const result = await db.select().from(routeBookings).innerJoin(routes, eq(routeBookings.routeId, routes.id)).innerJoin(users, eq(routeBookings.carrierId, users.id)).where(eq(routeBookings.senderId, senderId)).orderBy(desc(routeBookings.createdAt));
    return result.map((r) => ({ ...r.route_bookings, route: r.routes, carrier: r.users }));
  }
  async getPendingBookingForParcel(parcelId) {
    const result = await db.select().from(routeBookings).where(and(eq(routeBookings.parcelId, parcelId), eq(routeBookings.status, "Pending")));
    return result[0];
  }
  async updateRouteBooking(id, updates) {
    const result = await db.update(routeBookings).set(updates).where(eq(routeBookings.id, id)).returning();
    return result[0];
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
import { createHmac, timingSafeEqual } from "crypto";
import { eq as eq3, desc as desc3, and as and2, lte, ne, sql as sql3 } from "drizzle-orm";

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
function getMessaging() {
  return firebaseApp ? firebaseApp.messaging() : null;
}
async function verifyFirebaseToken(idToken) {
  if (!adminAuth) {
    try {
      const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.FIREBASE_API_KEY}`,
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

// shared/schema-enhancements.ts
import { pgTable as pgTable2, varchar as varchar2, text as text2, timestamp as timestamp2, boolean as boolean2 } from "drizzle-orm/pg-core";
import { sql as sql2 } from "drizzle-orm";
var receiverConfirmations = pgTable2("receiver_confirmations", {
  id: varchar2("id").primaryKey().default(sql2`gen_random_uuid()`),
  parcelId: varchar2("parcel_id").references(() => parcels.id),
  receiverEmail: text2("receiver_email").notNull(),
  confirmed: boolean2("confirmed").default(false),
  confirmedAt: timestamp2("confirmed_at"),
  requestedAt: timestamp2("requested_at").defaultNow(),
  token: text2("token").notNull().unique()
});
var notificationQueue = pgTable2("notification_queue", {
  id: varchar2("id").primaryKey().default(sql2`gen_random_uuid()`),
  userId: varchar2("user_id").notNull().references(() => users.id),
  title: text2("title").notNull(),
  body: text2("body").notNull(),
  data: text2("data"),
  // JSON string
  sent: boolean2("sent").default(false),
  sentAt: timestamp2("sent_at"),
  createdAt: timestamp2("created_at").defaultNow()
});

// server/receiver-enhancements.ts
import { eq as eq2, or as or2, desc as desc2 } from "drizzle-orm";

// server/notification-service.ts
var NotificationService = class {
  /**
   * Send push notifications to all devices for a user via FCM,
   * and persist to the in-app notification feed.
   */
  static async sendImmediateNotification(userId, payload) {
    try {
      await db.insert(notifications).values({
        userId,
        type: payload.data?.type || "general",
        title: payload.title,
        body: payload.body,
        data: payload.data ? JSON.stringify(payload.data) : null,
        isRead: false
      }).catch((err) => console.error("Failed to persist notification:", err));
      const messaging = getMessaging();
      if (messaging) {
        try {
          await messaging.send({
            topic: `user_${userId}`,
            notification: { title: payload.title, body: payload.body },
            data: payload.data ? Object.fromEntries(
              Object.entries(payload.data).map(([k, v]) => [k, String(v)])
            ) : void 0
          });
        } catch (fcmErr) {
          console.warn("FCM send failed (non-fatal):", fcmErr);
        }
      }
      return true;
    } catch (error) {
      console.error("Failed to send push notification:", error);
      return false;
    }
  }
  /**
   * Notify sender that a carrier has accepted their parcel
   */
  static async notifyParcelAccepted(senderId, parcelId, carrierName) {
    await this.sendImmediateNotification(senderId, {
      title: "Carrier Found! \u{1F389}",
      body: `${carrierName} has accepted your parcel and will pick it up soon.`,
      data: {
        type: "parcel_accepted",
        parcelId
      }
    });
  }
  /**
   * Notify relevant users about a parcel status change
   */
  static async notifyStatusChange(userId, parcelId, oldStatus, newStatus, context) {
    const routeText = context?.origin && context?.destination ? ` (${context.origin} \u2192 ${context.destination})` : "";
    const statusMessages = {
      Accepted: {
        title: "Carrier Found! \u{1F389}",
        body: `Your parcel${routeText} has been accepted by a carrier.`
      },
      "Picked Up": {
        title: "Parcel Picked Up \u{1F4E6}",
        body: `Your parcel${routeText} has been picked up and is on its way!`
      },
      "In Transit": {
        title: "Parcel In Transit \u{1F69A}",
        body: `Your parcel${routeText} is on the move!`
      },
      Delivered: {
        title: "Parcel Delivered! \u2705",
        body: `Your parcel${routeText} has been delivered successfully.`
      },
      Expired: {
        title: "Parcel Listing Expired",
        body: `Your parcel listing${routeText} has expired.`
      }
    };
    const msgConfig = statusMessages[newStatus];
    if (!msgConfig) return;
    await this.sendImmediateNotification(userId, {
      title: msgConfig.title,
      body: msgConfig.body,
      data: {
        type: "parcel_status_change",
        parcelId,
        oldStatus,
        newStatus
      }
    });
  }
  /**
   * Notify a user about a new chat message
   */
  static async notifyNewMessage(recipientId, parcelId, senderName, messagePreview) {
    const preview = messagePreview.length > 60 ? messagePreview.substring(0, 60) + "..." : messagePreview;
    await this.sendImmediateNotification(recipientId, {
      title: `Message from ${senderName}`,
      body: preview,
      data: {
        type: "new_message",
        parcelId
      }
    });
  }
  /**
   * Notify receiver about new incoming parcel
   */
  static async notifyNewIncomingParcel(receiverId, parcelId, senderName) {
    await this.sendImmediateNotification(receiverId, {
      title: "Incoming Parcel \u{1F4EC}",
      body: `${senderName} is sending you a parcel. Tap to view details.`,
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
   * Notify carrier (route owner) of a new parcel booking request on their route
   */
  static async notifyNewRouteBookingRequest(carrierId, bookingId, routeId, senderName, routeSummary) {
    await this.sendImmediateNotification(carrierId, {
      title: "New parcel along your route \u{1F4E6}",
      body: `${senderName} wants to add a parcel to your route (${routeSummary}). Tap to review.`,
      data: {
        type: "route_booking_request",
        bookingId,
        routeId
      }
    });
  }
  /**
   * Notify sender that the carrier responded to their route booking request
   */
  static async notifyRouteBookingDecision(senderId, bookingId, parcelId, routeId, decision, carrierName) {
    const approved = decision === "Approved";
    await this.sendImmediateNotification(senderId, {
      title: approved ? "Booking approved! \u{1F389}" : "Booking declined",
      body: approved ? `${carrierName} approved your parcel on their route. They'll pick it up soon.` : `${carrierName} declined your parcel for this route. You can request another route.`,
      data: {
        type: approved ? "route_booking_approved" : "route_booking_declined",
        bookingId,
        parcelId,
        routeId
      }
    });
  }
  /**
   * Request delivery confirmation from receiver
   */
  static async requestDeliveryConfirmation(receiverId, parcelId) {
    await this.sendImmediateNotification(receiverId, {
      title: "Confirm Delivery \u2705",
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
import { mkdir, writeFile } from "fs/promises";
import path2 from "path";
var MAX_PHOTO_BYTES = 10 * 1024 * 1024;
var PHOTO_MIME_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};
var PhotoValidationError = class extends Error {
  constructor(message) {
    super(message);
    this.name = "PhotoValidationError";
  }
};
function decodePhotoData(photoData) {
  if (typeof photoData !== "string") {
    throw new PhotoValidationError("Photo data must be a base64 data-URL");
  }
  const match = photoData.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\r\n]+)$/);
  if (!match) {
    throw new PhotoValidationError("Only JPEG, PNG, and WebP data-URLs are supported");
  }
  const mimeType = match[1];
  const buffer = Buffer.from(match[2].replace(/[\r\n]/g, ""), "base64");
  if (buffer.length === 0 || buffer.length > MAX_PHOTO_BYTES) {
    throw new PhotoValidationError("Photo must be between 1 byte and 10 MB");
  }
  return { buffer, mimeType, extension: PHOTO_MIME_TYPES[mimeType] };
}
async function storePhotoFile(buffer, mimeType, extension, subdir, parcelId) {
  const uploadRoot = path2.resolve(process.env.PHOTO_STORAGE_DIR || path2.resolve(process.cwd(), "uploads"));
  const parcelDirectory = path2.join(uploadRoot, subdir, parcelId);
  await mkdir(parcelDirectory, { recursive: true });
  const fileName = `${crypto.randomUUID()}.${extension}`;
  await writeFile(path2.join(parcelDirectory, fileName), buffer, { flag: "wx" });
  const url = `/uploads/${subdir}/${encodeURIComponent(parcelId)}/${fileName}`;
  return { url, fileName };
}
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
        const carrierLoc = await db.select().from(carrierLocations).where(eq2(carrierLocations.parcelId, parcelId)).orderBy(desc2(carrierLocations.timestamp)).limit(1);
        if (!carrierLoc[0]) {
          return res.json({
            available: false,
            message: "Carrier location not available"
          });
        }
        let receiverLat = parcel.receiverLat;
        let receiverLng = parcel.receiverLng;
        if (!receiverLat || !receiverLng) {
          const receiverLoc = await db.select().from(receiverLocations).where(eq2(receiverLocations.parcelId, parcelId)).orderBy(desc2(receiverLocations.timestamp)).limit(1);
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
        const { photoData, notes } = req.body;
        if (!photoData) {
          return res.status(400).json({ error: "Photo data is required" });
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
        if (parcel.status === "Delivered" || parcel.status === "Expired") {
          return res.status(409).json({ error: "Delivery proof cannot be added to this parcel" });
        }
        if (!["Accepted", "Picked Up", "In Transit", "Arrived"].includes(parcel.status || "")) {
          return res.status(409).json({ error: "Parcel is not in an active delivery state" });
        }
        let photoUrl;
        let storedFile;
        let decoded;
        try {
          decoded = decodePhotoData(photoData);
          storedFile = await storePhotoFile(
            decoded.buffer,
            decoded.mimeType,
            decoded.extension,
            "delivery-proofs",
            parcelId
          );
          photoUrl = storedFile.url;
        } catch (error) {
          return res.status(400).json({ error: error.message || "Invalid photo" });
        }
        await storage.updateParcel(parcelId, {
          status: "Delivered"
        });
        await db.update(parcels).set({ photoUrl }).where(eq2(parcels.id, parcelId));
        await db.insert(parcelPhotos).values({
          parcelId,
          uploadedBy: req.user.uid,
          photoUrl,
          photoType: "delivery",
          caption: typeof notes === "string" ? notes.slice(0, 500) : null
        });
        await db.insert(deliveryProofs).values({
          parcelId,
          uploadedBy: req.user.uid,
          photoUrl,
          fileName: storedFile.fileName,
          contentType: decoded.mimeType,
          fileSizeBytes: decoded.buffer.length,
          sha256Hash: crypto.createHash("sha256").update(decoded.buffer).digest("hex"),
          notes: typeof notes === "string" ? notes.slice(0, 500) : null
        });
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
        await db.insert(receiverConfirmations).values({
          parcelId: parcelDetails?.parcelId || null,
          receiverEmail,
          token,
          confirmed: false
        });
        const receiver = await storage.getUserByEmail(receiverEmail);
        if (receiver) {
          await db.insert(notificationQueue).values({
            userId: receiver.id,
            title: "Parcel delivery confirmation requested",
            body: "A sender has requested your confirmation before creating a parcel.",
            data: JSON.stringify({ type: "receiver_confirmation", token })
          });
        }
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
        const user = await storage.getUser(userId);
        const conditions = [eq2(parcels.receiverId, userId)];
        if (user?.email) {
          conditions.push(eq2(parcels.receiverEmail, user.email));
        }
        const allParcels = await db.select().from(parcels).where(conditions.length === 1 ? conditions[0] : or2(...conditions));
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
  app2.get(
    "/api/parcels/:parcelId/delivery-proof",
    requireAuth,
    async (req, res) => {
      try {
        const { parcelId } = req.params;
        const parcel = await storage.getParcel(parcelId);
        if (!parcel) {
          return res.status(404).json({ error: "Parcel not found" });
        }
        const isSender = parcel.senderId === req.user.uid;
        const isReceiver = parcel.receiverId === req.user.uid;
        const isCarrier = parcel.transporterId === req.user.uid;
        if (!isSender && !isReceiver && !isCarrier) {
          return res.status(403).json({ error: "Only the sender, receiver, or carrier can view delivery proof" });
        }
        const proofs = await db.select({
          id: deliveryProofs.id,
          photoUrl: deliveryProofs.photoUrl,
          fileName: deliveryProofs.fileName,
          contentType: deliveryProofs.contentType,
          fileSizeBytes: deliveryProofs.fileSizeBytes,
          sha256Hash: deliveryProofs.sha256Hash,
          notes: deliveryProofs.notes,
          uploadedBy: deliveryProofs.uploadedBy,
          uploadedAt: deliveryProofs.uploadedAt
        }).from(deliveryProofs).where(eq2(deliveryProofs.parcelId, parcelId)).orderBy(desc2(deliveryProofs.uploadedAt));
        res.json({ proofs });
      } catch (error) {
        console.error("Failed to fetch delivery proof:", error);
        res.status(500).json({ error: "Failed to fetch delivery proof" });
      }
    }
  );
}

// server/ai-service.ts
import OpenAI from "openai";
var cachedClient = null;
function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  if (!cachedClient) {
    cachedClient = new OpenAI({ apiKey });
  }
  return cachedClient;
}
function isAIEnabled() {
  return !!process.env.OPENAI_API_KEY;
}
var MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
async function improveParcelDescription(ctx) {
  const client = getOpenAIClient();
  const prompt = `You are helping a user write a clear, friendly parcel description for a peer-to-peer delivery app.

Parcel details:
- Origin: ${ctx.origin || "(not set)"}
- Destination: ${ctx.destination || "(not set)"}
- Size: ${ctx.size || "(not set)"}
- Weight: ${ctx.weight ? `${ctx.weight} kg` : "(not set)"}
- Fragile: ${ctx.isFragile ? "Yes" : "No"}
- User notes: ${ctx.description || "(none)"}

Write a concise (1-2 sentences, max 200 characters) description that helps a carrier understand what they'd be transporting. Be specific and practical. Do not include the origin/destination. Reply with only the description text, no quotes.`;
  const res = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.6,
    max_tokens: 120
  });
  return (res.choices[0]?.message?.content || "").trim().replace(/^"|"$/g, "");
}
async function suggestCompensation(ctx) {
  const client = getOpenAIClient();
  const prompt = `You are pricing a peer-to-peer parcel delivery in South Africa (currency: ZAR).

Parcel:
- Origin: ${ctx.origin || "(not set)"}
- Destination: ${ctx.destination || "(not set)"}
- Distance: ${ctx.distanceKm ? `${ctx.distanceKm.toFixed(0)} km` : "(unknown)"}
- Size: ${ctx.size || "medium"}
- Weight: ${ctx.weight ? `${ctx.weight} kg` : "(unknown)"}
- Fragile: ${ctx.isFragile ? "Yes" : "No"}

Suggest a fair compensation amount in ZAR (Rand) that the sender should pay the carrier. Account for distance, size, weight, and fragility. Typical baseline: R30-R50 short trips, +R3-R5 per km for longer routes, premium for fragile/large items.

Respond with valid JSON only: {"amount": <integer>, "reasoning": "<one short sentence>"}`;
  const res = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    max_tokens: 120,
    response_format: { type: "json_object" }
  });
  const raw = res.choices[0]?.message?.content || "{}";
  const parsed = JSON.parse(raw);
  const amount = Math.max(20, Math.round(Number(parsed.amount) || 0));
  const reasoning = String(parsed.reasoning || "Based on distance, size, and weight.");
  return { amount, reasoning };
}
async function suggestSmartReplies(history, myRole) {
  const client = getOpenAIClient();
  const transcript = history.slice(-10).map((m) => `${m.role === myRole ? "Me" : "Them"}: ${m.text}`).join("\n");
  const prompt = `You are helping a ${myRole} on a parcel delivery app reply to a chat with the other party. Suggest 3 short, natural reply options (each under 80 characters). They should be polite, practical, and varied (e.g. confirm, ask a question, propose a time).

Recent conversation:
${transcript || "(no messages yet)"}

Respond with valid JSON only: {"replies": ["...", "...", "..."]}`;
  const res = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    max_tokens: 200,
    response_format: { type: "json_object" }
  });
  const parsed = JSON.parse(res.choices[0]?.message?.content || "{}");
  const replies = Array.isArray(parsed.replies) ? parsed.replies : [];
  return replies.map((r) => String(r)).filter(Boolean).slice(0, 3);
}
async function suggestRouteStops(input) {
  const client = getOpenAIClient();
  const prompt = `You are helping a driver plan a route in South Africa. Suggest up to 5 useful intermediate stops (towns or cities) that lie roughly along the road between the origin and destination. Prefer real, well-known places that a delivery carrier could realistically pass through.

Origin: ${input.origin}${input.originLat ? ` (${input.originLat}, ${input.originLng})` : ""}
Destination: ${input.destination}${input.destinationLat ? ` (${input.destinationLat}, ${input.destinationLng})` : ""}
Already added stops (do not repeat): ${input.existing?.join(", ") || "(none)"}

For each stop provide: name (short), fullAddress (city, province, country), approximate lat/lng (decimal degrees), and a short reason (under 60 chars) why it's a useful stop.

Respond with valid JSON only: {"stops": [{"name": "...", "fullAddress": "...", "lat": -26.2, "lng": 28.04, "reason": "..."}]}`;
  const res = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.4,
    max_tokens: 600,
    response_format: { type: "json_object" }
  });
  const parsed = JSON.parse(res.choices[0]?.message?.content || "{}");
  const stops = Array.isArray(parsed.stops) ? parsed.stops : [];
  return stops.map((s) => ({
    name: String(s.name || "").trim(),
    fullAddress: String(s.fullAddress || s.name || "").trim(),
    lat: Number(s.lat),
    lng: Number(s.lng),
    reason: s.reason ? String(s.reason).trim() : void 0
  })).filter((s) => s.name && Number.isFinite(s.lat) && Number.isFinite(s.lng)).slice(0, 5);
}
async function analyzeParcelPhoto(imageDataUrl) {
  const client = getOpenAIClient();
  const res = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Analyze this parcel photo and extract delivery details. Estimate:
- size: "small" (fits in a backpack), "medium" (fits on a car seat), or "large" (needs trunk space)
- weight in kg (rough estimate, integer 1-30)
- isFragile: true if it looks like glass, electronics, or delicate items
- description: one short sentence (under 100 chars) describing the parcel
- confidence: "low", "medium", or "high" based on how clear the photo is

Respond with valid JSON only: {"size": "...", "weight": 0, "isFragile": false, "description": "...", "confidence": "..."}`
          },
          { type: "image_url", image_url: { url: imageDataUrl } }
        ]
      }
    ],
    temperature: 0.2,
    max_tokens: 200,
    response_format: { type: "json_object" }
  });
  const parsed = JSON.parse(res.choices[0]?.message?.content || "{}");
  const size = ["small", "medium", "large"].includes(parsed.size) ? parsed.size : "medium";
  return {
    size,
    weight: Math.max(1, Math.min(50, Math.round(Number(parsed.weight) || 1))),
    isFragile: !!parsed.isFragile,
    description: String(parsed.description || "").slice(0, 200),
    confidence: ["low", "medium", "high"].includes(parsed.confidence) ? parsed.confidence : "medium"
  };
}
async function parseSearchIntent(query) {
  const client = getOpenAIClient();
  const prompt = `Parse this natural language parcel search query into filter fields. The user is searching for parcels in a delivery app in South Africa.

Query: "${query}"

Available fields (omit any that don't apply):
- from: origin city/place name (string)
- to: destination city/place name (string)
- size: "small" | "medium" | "large"
- dateFilter: "today" or "thisWeek" (only these two literal values)
- maxPrice: maximum compensation in rand (number)
- minPrice: minimum compensation in rand (number)
- fragile: true if user mentions fragile

Examples:
"fragile boxes to Cape Town this weekend under R200" \u2192 {"to": "Cape Town", "fragile": true, "dateFilter": "thisWeek", "maxPrice": 200}
"small parcels from Joburg" \u2192 {"from": "Johannesburg", "size": "small"}
"anything to Durban today over R100" \u2192 {"to": "Durban", "dateFilter": "today", "minPrice": 100}

Respond with valid JSON only: {"filters": {...}}`;
  const res = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1,
    max_tokens: 200,
    response_format: { type: "json_object" }
  });
  const parsed = JSON.parse(res.choices[0]?.message?.content || "{}");
  const f = parsed.filters || {};
  const out = {};
  if (typeof f.from === "string") out.from = f.from;
  if (typeof f.to === "string") out.to = f.to;
  if (["small", "medium", "large"].includes(f.size)) out.size = f.size;
  if (f.dateFilter === "today" || f.dateFilter === "thisWeek") out.dateFilter = f.dateFilter;
  if (Number.isFinite(Number(f.maxPrice))) out.maxPrice = Number(f.maxPrice);
  if (Number.isFinite(Number(f.minPrice))) out.minPrice = Number(f.minPrice);
  if (typeof f.fragile === "boolean") out.fragile = f.fragile;
  return out;
}
async function summarizeMatchingParcels(input) {
  if (!input.parcels.length) return [];
  const client = getOpenAIClient();
  const prompt = `You're helping a carrier evaluate parcels offered for their route in South Africa.

Carrier's route: ${input.route.origin} \u2192 ${input.route.destination}${input.route.intermediateStops?.length ? ` (via ${input.route.intermediateStops.join(", ")})` : ""}

Parcels to evaluate:
${input.parcels.map(
    (p, i) => `${i + 1}. id=${p.id} | ${p.origin} \u2192 ${p.destination} | size:${p.size}${p.weight ? ` ${p.weight}kg` : ""}${p.isFragile ? " fragile" : ""} | R${p.compensation}${p.senderRating ? ` | sender \u2605${p.senderRating}` : ""}${p.description ? ` | "${p.description.slice(0, 60)}"` : ""}`
  ).join("\n")}

For each parcel, give a one-sentence reason (under 90 chars) why it's a good or poor fit, and rate it "great", "good", or "okay" based on alignment with the route, compensation fairness, and any practical concerns.

Respond with valid JSON only: {"insights": [{"parcelId": "...", "reason": "...", "rating": "great|good|okay"}]}`;
  const res = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    max_tokens: 700,
    response_format: { type: "json_object" }
  });
  const parsed = JSON.parse(res.choices[0]?.message?.content || "{}");
  const arr = Array.isArray(parsed.insights) ? parsed.insights : [];
  return arr.map((i) => ({
    parcelId: String(i.parcelId || ""),
    reason: String(i.reason || "").slice(0, 200),
    rating: ["great", "good", "okay"].includes(i.rating) ? i.rating : "okay"
  })).filter((i) => i.parcelId && i.reason);
}
async function assistantChat(messages4) {
  const client = getOpenAIClient();
  const system = `You are the AI assistant for "The GTW", a parcel route-matching app where users send parcels and carriers transport them along their routes. Help users with:
- How to create a parcel listing or find one to transport
- Pricing guidance for compensation
- Pickup, delivery, and tracking questions
- Safety tips for senders and carriers
- Resolving chat / coordination questions

Be concise, friendly, and practical. If the user asks about something outside the app, gently steer back to delivery topics.`;
  const res = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: system },
      ...messages4.slice(-20).map((m) => ({ role: m.role, content: m.content }))
    ],
    temperature: 0.6,
    max_tokens: 400
  });
  return (res.choices[0]?.message?.content || "").trim();
}

// server/ai-routes.ts
function handleAIError(res, error) {
  console.error("[AI]", error);
  if (!isAIEnabled()) {
    return res.status(503).json({ error: "AI features are not configured. Please add an OpenAI API key." });
  }
  const msg = error?.message || "AI request failed";
  res.status(500).json({ error: msg });
}
function registerAIRoutes(app2) {
  app2.get("/api/ai/status", (_req, res) => {
    res.json({ enabled: isAIEnabled() });
  });
  app2.post(
    "/api/ai/parcel/description",
    requireAuth,
    async (req, res) => {
      try {
        const text3 = await improveParcelDescription(req.body || {});
        res.json({ description: text3 });
      } catch (e) {
        handleAIError(res, e);
      }
    }
  );
  app2.post(
    "/api/ai/parcel/price",
    requireAuth,
    async (req, res) => {
      try {
        const result = await suggestCompensation(req.body || {});
        res.json(result);
      } catch (e) {
        handleAIError(res, e);
      }
    }
  );
  app2.post(
    "/api/ai/chat/replies",
    requireAuth,
    async (req, res) => {
      try {
        const { history, role } = req.body || {};
        const replies = await suggestSmartReplies(
          Array.isArray(history) ? history : [],
          role === "carrier" ? "carrier" : "sender"
        );
        res.json({ replies });
      } catch (e) {
        handleAIError(res, e);
      }
    }
  );
  app2.post(
    "/api/ai/route/stops",
    requireAuth,
    async (req, res) => {
      try {
        const body = req.body || {};
        if (!body.origin || !body.destination) {
          return res.status(400).json({ error: "origin and destination are required" });
        }
        const stops = await suggestRouteStops(body);
        res.json({ stops });
      } catch (e) {
        handleAIError(res, e);
      }
    }
  );
  app2.post(
    "/api/ai/parcel/photo",
    requireAuth,
    async (req, res) => {
      try {
        const { image } = req.body || {};
        if (!image || typeof image !== "string") {
          return res.status(400).json({ error: "image (data URL or http URL) is required" });
        }
        const details = await analyzeParcelPhoto(image);
        res.json(details);
      } catch (e) {
        handleAIError(res, e);
      }
    }
  );
  app2.post(
    "/api/ai/search/parse",
    requireAuth,
    async (req, res) => {
      try {
        const { query } = req.body || {};
        if (!query || typeof query !== "string") {
          return res.status(400).json({ error: "query is required" });
        }
        const filters = await parseSearchIntent(query);
        res.json({ filters });
      } catch (e) {
        handleAIError(res, e);
      }
    }
  );
  app2.post(
    "/api/ai/route/match-insights",
    requireAuth,
    async (req, res) => {
      try {
        const { route, parcels: parcels2 } = req.body || {};
        if (!route || !Array.isArray(parcels2)) {
          return res.status(400).json({ error: "route and parcels[] are required" });
        }
        const insights = await summarizeMatchingParcels({ route, parcels: parcels2.slice(0, 10) });
        res.json({ insights });
      } catch (e) {
        handleAIError(res, e);
      }
    }
  );
  app2.post(
    "/api/ai/assistant",
    requireAuth,
    async (req, res) => {
      try {
        const { messages: messages4 } = req.body || {};
        const reply = await assistantChat(Array.isArray(messages4) ? messages4 : []);
        res.json({ reply });
      } catch (e) {
        handleAIError(res, e);
      }
    }
  );
}

// server/realtime.ts
import { WebSocketServer } from "ws";
var clientsByUser = /* @__PURE__ */ new Map();
var lastSeenByUser = /* @__PURE__ */ new Map();
var wssRef = null;
function addClient(userId, ws) {
  let set = clientsByUser.get(userId);
  if (!set) {
    set = /* @__PURE__ */ new Set();
    clientsByUser.set(userId, set);
  }
  const wasOffline = set.size === 0;
  set.add(ws);
  if (wasOffline) {
    broadcastPresence(userId, true);
  }
}
function removeClient(userId, ws) {
  const set = clientsByUser.get(userId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) {
    clientsByUser.delete(userId);
    lastSeenByUser.set(userId, Date.now());
    broadcastPresence(userId, false);
  }
}
function send(ws, data) {
  if (ws.readyState === ws.OPEN) {
    try {
      ws.send(JSON.stringify(data));
    } catch (err) {
      console.error("WS send error:", err);
    }
  }
}
function isUserOnline(userId) {
  const set = clientsByUser.get(userId);
  return !!set && set.size > 0;
}
function getLastSeen(userId) {
  return lastSeenByUser.get(userId) ?? null;
}
function broadcastToUser(userId, event) {
  const set = clientsByUser.get(userId);
  if (!set) return;
  for (const ws of set) send(ws, event);
}
function broadcastToUsers(userIds, event) {
  const seen = /* @__PURE__ */ new Set();
  for (const id of userIds) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    broadcastToUser(id, event);
  }
}
function broadcastPresence(userId, online) {
  if (!wssRef) return;
  const payload = {
    type: "presence:update",
    userId,
    online,
    lastSeen: online ? null : lastSeenByUser.get(userId) ?? Date.now()
  };
  for (const ws of wssRef.clients) {
    send(ws, payload);
  }
}
function setupRealtime(server) {
  const wss = new WebSocketServer({ server, path: "/ws" });
  wssRef = wss;
  wss.on("connection", async (ws, req) => {
    try {
      const url = new URL(req.url || "/", "http://localhost");
      const token = url.searchParams.get("token");
      if (!token) {
        ws.close(4001, "Missing token");
        return;
      }
      let decoded;
      try {
        decoded = await verifyFirebaseToken(token);
      } catch {
        ws.close(4002, "Invalid token");
        return;
      }
      const userId = decoded.uid;
      ws.userId = userId;
      ws.isAlive = true;
      ws.parcelSubscriptions = /* @__PURE__ */ new Set();
      addClient(userId, ws);
      send(ws, { type: "connected", userId });
      ws.on("pong", () => {
        ws.isAlive = true;
      });
      ws.on("message", (raw) => {
        let msg;
        try {
          msg = JSON.parse(raw.toString());
        } catch {
          return;
        }
        if (!msg || typeof msg !== "object") return;
        if (msg.type === "ping") {
          send(ws, { type: "pong" });
          return;
        }
        if (msg.type === "subscribe:parcel" && typeof msg.parcelId === "string") {
          ws.parcelSubscriptions.add(msg.parcelId);
          return;
        }
        if (msg.type === "unsubscribe:parcel" && typeof msg.parcelId === "string") {
          ws.parcelSubscriptions.delete(msg.parcelId);
          return;
        }
        if (msg.type === "typing" && typeof msg.parcelId === "string" && Array.isArray(msg.recipientIds)) {
          broadcastToUsers(msg.recipientIds, {
            type: "typing",
            parcelId: msg.parcelId,
            userId,
            isTyping: !!msg.isTyping
          });
          return;
        }
      });
      ws.on("close", () => {
        if (ws.userId) removeClient(ws.userId, ws);
      });
      ws.on("error", () => {
        if (ws.userId) removeClient(ws.userId, ws);
      });
    } catch (err) {
      console.error("WS connection error:", err);
      try {
        ws.close(1011, "Server error");
      } catch {
      }
    }
  });
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const c = ws;
      if (c.isAlive === false) {
        try {
          c.terminate();
        } catch {
        }
        return;
      }
      c.isAlive = false;
      try {
        c.ping();
      } catch {
      }
    });
  }, 3e4);
  wss.on("close", () => clearInterval(interval));
  console.log("Realtime WebSocket server listening on /ws");
  return wss;
}

// server/routes.ts
function hasValidPaystackSignature(rawBody, signature, secret) {
  if (typeof signature !== "string") return false;
  const payload = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(JSON.stringify(rawBody));
  const expected = createHmac("sha512", secret).update(payload).digest("hex");
  const expectedBuffer = Buffer.from(expected, "utf8");
  const signatureBuffer = Buffer.from(signature, "utf8");
  return expectedBuffer.length === signatureBuffer.length && timingSafeEqual(expectedBuffer, signatureBuffer);
}
async function getPaystackTransaction(reference, secret) {
  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secret}` }
  });
  const data = await response.json();
  if (!response.ok || !data?.status || data?.data?.status !== "success") return null;
  return data.data;
}
async function completeWalletTopup(reference, amount, currency, paymentData) {
  return db.transaction(async (tx) => {
    const transactionResult = await tx.select().from(walletTransactions).where(eq3(walletTransactions.reference, reference)).limit(1);
    const transaction = transactionResult[0];
    if (!transaction || transaction.status !== "pending") return false;
    if (transaction.amount !== amount || transaction.currency !== currency) return false;
    await tx.execute(sql3`SELECT id FROM users WHERE id = ${transaction.userId} FOR UPDATE`);
    const lockedResult = await tx.select().from(walletTransactions).where(eq3(walletTransactions.reference, reference)).limit(1);
    const lockedTransaction = lockedResult[0];
    if (!lockedTransaction || lockedTransaction.status !== "pending") return false;
    const updatedUser = await tx.update(users).set({ walletBalance: sql3`${users.walletBalance} + ${lockedTransaction.amount}` }).where(eq3(users.id, lockedTransaction.userId)).returning({ walletBalance: users.walletBalance });
    const user = updatedUser[0];
    if (!user) return false;
    await tx.update(walletTransactions).set({
      status: "completed",
      balanceAfter: user.walletBalance,
      completedAt: /* @__PURE__ */ new Date(),
      paymentData: JSON.stringify(paymentData)
    }).where(and2(eq3(walletTransactions.reference, reference), eq3(walletTransactions.status, "pending")));
    return true;
  });
}
async function registerRoutes(app2) {
  app2.get("/api/config/firebase", (_req, res) => {
    res.json({
      apiKey: process.env.FIREBASE_API_KEY,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN,
      projectId: process.env.FIREBASE_PROJECT_ID,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.FIREBASE_APP_ID
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
        db.select({ count: sql3`count(*)::int` }).from(parcels).where(and2(eq3(parcels.transporterId, userId), eq3(parcels.status, "Delivered"))),
        db.select({ count: sql3`count(*)::int` }).from(connections).where(eq3(connections.userId, userId)),
        db.select({ count: sql3`count(*)::int` }).from(reviews).where(eq3(reviews.revieweeId, userId))
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
      const { senderId, receiverId, transporterId } = req.query;
      const conditions = [];
      if (senderId) conditions.push(eq3(parcels.senderId, senderId));
      if (receiverId) conditions.push(eq3(parcels.receiverId, receiverId));
      if (transporterId) conditions.push(eq3(parcels.transporterId, transporterId));
      const query = db.select({
        parcel: parcels,
        sender: users
      }).from(parcels).innerJoin(users, eq3(parcels.senderId, users.id)).orderBy(desc3(parcels.createdAt));
      const allParcels = conditions.length > 0 ? await query.where(and2(...conditions)) : await query;
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
      if (error?.message === "Insufficient wallet balance") {
        return res.status(400).json({ error: "Insufficient wallet balance. Please top up your wallet before creating a parcel." });
      }
      console.error("Failed to create parcel:", error);
      res.status(500).json({ error: "Failed to create parcel" });
    }
  });
  app2.patch("/api/parcels/:id", requireAuth, async (req, res) => {
    try {
      const oldParcel = await storage.getParcel(req.params.id);
      if (!oldParcel) return res.status(404).json({ error: "Parcel not found" });
      const userId = req.user.uid;
      const isParticipant = userId === oldParcel.senderId || userId === oldParcel.transporterId || userId === oldParcel.receiverId;
      if (!isParticipant) {
        return res.status(403).json({ error: "Forbidden" });
      }
      const parcel = await storage.updateParcel(req.params.id, req.body);
      if (!parcel) {
        return res.status(404).json({ error: "Parcel not found" });
      }
      if (oldParcel && parcel.status !== oldParcel.status) {
        if (parcel.receiverId) {
          NotificationService.notifyStatusChange(
            parcel.receiverId,
            parcel.id,
            oldParcel.status,
            parcel.status
          ).catch((err) => console.error("Failed to notify receiver:", err));
        }
        if (parcel.senderId && parcel.senderId !== parcel.receiverId) {
          NotificationService.notifyStatusChange(
            parcel.senderId,
            parcel.id,
            oldParcel.status,
            parcel.status
          ).catch((err) => console.error("Failed to notify sender:", err));
        }
      }
      res.json(parcel);
    } catch (error) {
      res.status(500).json({ error: "Failed to update parcel" });
    }
  });
  app2.patch("/api/parcels/:id/accept", requireAuth, async (req, res) => {
    try {
      const transporterId = req.user.uid;
      if (!transporterId) {
        return res.status(400).json({ error: "transporterId is required" });
      }
      const originalParcel = await storage.getParcel(req.params.id);
      const parcel = await storage.updateParcel(req.params.id, {
        transporterId,
        status: "Accepted"
      });
      if (!parcel) {
        return res.status(404).json({ error: "Parcel not found" });
      }
      res.json(parcel);
      const acceptParticipantIds = [parcel.senderId, parcel.transporterId, parcel.receiverId].filter(Boolean);
      broadcastToUsers(acceptParticipantIds, {
        type: "parcel:status",
        parcelId: req.params.id,
        status: "Accepted",
        onTheMove: false
      });
      if (originalParcel?.senderId) {
        const carrier = await storage.getUser(transporterId);
        NotificationService.notifyParcelAccepted(
          originalParcel.senderId,
          req.params.id,
          carrier?.name || "A carrier"
        ).catch((err) => console.error("Failed to send accept notification:", err));
      }
      if (originalParcel?.receiverId) {
        const carrier = await storage.getUser(transporterId);
        NotificationService.notifyStatusChange(
          originalParcel.receiverId,
          req.params.id,
          originalParcel.status,
          "Accepted",
          { origin: originalParcel.origin, destination: originalParcel.destination }
        ).catch((err) => console.error("Failed to send receiver accept notification:", err));
      }
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
      const userConversations = await db.select().from(conversations).where(eq3(conversations.participant1Id, req.params.userId)).orderBy(desc3(conversations.createdAt));
      const convos2 = await db.select().from(conversations).where(eq3(conversations.participant2Id, req.params.userId)).orderBy(desc3(conversations.createdAt));
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
  app2.get("/api/conversations/:id", optionalAuth, async (req, res) => {
    try {
      const conv = await db.select().from(conversations).where(eq3(conversations.id, req.params.id)).limit(1);
      if (!conv.length) return res.status(404).json({ error: "Conversation not found" });
      const c = conv[0];
      const requesterId = req.user?.uid;
      const otherUserId = requesterId === c.participant1Id ? c.participant2Id : c.participant1Id;
      const otherUser = await storage.getUser(otherUserId);
      res.json({
        ...c,
        otherUserId,
        otherUserName: otherUser?.name || "Unknown"
      });
    } catch (error) {
      console.error("Failed to fetch conversation:", error);
      res.status(500).json({ error: "Failed to fetch conversation" });
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
  app2.post("/api/conversations/:id/messages", requireAuth, async (req, res) => {
    try {
      const parsed = insertMessageSchema.safeParse({
        ...req.body,
        conversationId: req.params.id,
        senderId: req.user.uid
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
  app2.patch("/api/users/:id", requireAuth, async (req, res) => {
    try {
      if (req.user.uid !== req.params.id) {
        return res.status(403).json({ error: "Forbidden" });
      }
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
        "profileVisibility"
      ];
      const updates = {};
      for (const key of Object.keys(req.body)) {
        if (allowedFields.includes(key)) updates[key] = req.body[key];
      }
      const updated = Object.keys(updates).length ? await db.update(users).set(updates).where(eq3(users.id, req.params.id)).returning() : [user];
      res.json(updated[0] || user);
    } catch (error) {
      console.error("Failed to update user:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });
  app2.delete("/api/parcels/:id", requireAuth, async (req, res) => {
    try {
      const parcel = await storage.getParcel(req.params.id);
      if (!parcel) return res.status(404).json({ error: "Parcel not found" });
      if (parcel.senderId !== req.user.uid) {
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
      }).from(routes).innerJoin(users, eq3(routes.carrierId, users.id)).where(eq3(routes.status, "Active")).orderBy(desc3(routes.departureDate));
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
      const { amount, metadata } = req.body;
      const amountNumber = Number(amount);
      const parcelId = typeof metadata?.parcelId === "string" ? metadata.parcelId : "";
      if (!Number.isInteger(amountNumber) || amountNumber <= 0 || amountNumber > 5e5 || !parcelId) {
        return res.status(400).json({ error: "A valid amount and parcelId are required" });
      }
      const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
      if (!paystackSecretKey) {
        return res.status(500).json({ error: "Paystack configuration missing" });
      }
      const user = await storage.getUser(req.user.uid);
      const parcel = await storage.getParcel(parcelId);
      if (!user || !parcel || parcel.senderId !== req.user.uid) {
        return res.status(403).json({ error: "Payment is not authorized for this parcel" });
      }
      const expectedAmount = Math.round(Number(parcel.compensation) * 100);
      const requestedAmount = Math.round(amountNumber * 100);
      if (requestedAmount !== expectedAmount) {
        return res.status(400).json({ error: "Payment amount does not match the parcel compensation" });
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
          amount: requestedAmount,
          email: user.email,
          metadata: { parcelId },
          callback_url: `${baseUrl}/api/payments/verify-web`
        })
      });
      const data = await response.json();
      if (!data.status) {
        throw new Error(data.message || "Failed to initialize Paystack transaction");
      }
      const platformFee = Math.round(amountNumber * 0.03);
      const totalAmount = amountNumber + platformFee;
      await storage.createPayment({
        parcelId,
        userId: req.user.uid,
        reference: data.data.reference,
        amount: Math.round(amountNumber),
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
      const payment = await storage.getPaymentByReference(reference);
      if (!payment || payment.userId !== req.user.uid) {
        return res.status(404).json({ error: "Payment not found" });
      }
      const transaction = await getPaystackTransaction(reference, paystackSecretKey);
      if (!transaction || transaction.amount !== payment.amount * 100) {
        return res.status(400).json({ error: "Payment verification failed" });
      }
      if (payment.status === "pending") {
        await storage.updatePayment(payment.id, { status: "success" });
        await storage.updateParcel(payment.parcelId, { status: "Paid" });
      }
      res.json({ status: true, data: transaction });
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
      if (!hasValidPaystackSignature(req.rawBody, req.headers["x-paystack-signature"], paystackSecretKey)) {
        console.warn("Invalid Paystack webhook signature");
        return res.status(401).json({ error: "Unauthorized" });
      }
      const { event, data } = req.body;
      if (event === "charge.success" && data?.metadata?.type === "wallet_topup") {
        const transactionResult = await db.select().from(walletTransactions).where(eq3(walletTransactions.reference, data.reference)).limit(1);
        const transaction = transactionResult[0];
        if (transaction && data.amount === transaction.amount && data.currency === transaction.currency) {
          await completeWalletTopup(data.reference, transaction.amount, transaction.currency, data);
        }
      } else if (event === "charge.success") {
        const { reference, status, metadata, amount } = data || {};
        const payment = await storage.getPaymentByReference(reference);
        if (payment && payment.status === "pending" && status === "success" && amount === payment.amount * 100 && metadata?.parcelId === payment.parcelId) {
          await storage.updatePayment(payment.id, { status: "success" });
          await storage.updateParcel(payment.parcelId, { status: "Paid" });
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
      const payment = await db.select().from(payments).where(eq3(payments.id, req.params.paymentId));
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
    const reference = String(req.query.reference || req.query.trxref || "");
    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    let status = "failed";
    let parcelId;
    if (reference && paystackSecretKey) {
      try {
        const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
          headers: { Authorization: `Bearer ${paystackSecretKey}` }
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
    const target = parcelId ? `/app/parcels/${encodeURIComponent(parcelId)}?payment=${status}` : `/app/my-parcels?payment=${status}`;
    res.send(`<!doctype html><html><head>
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <meta http-equiv="refresh" content="0; url=${target}">
      <title>Returning to app...</title>
      <style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0F172A;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center;padding:24px}.card{max-width:360px}.spinner{width:36px;height:36px;border:3px solid rgba(255,255,255,.2);border-top-color:#F97316;border-radius:50%;animation:s 1s linear infinite;margin:0 auto 16px}@keyframes s{to{transform:rotate(360deg)}}</style>
      </head><body><div class="card"><div class="spinner"></div><p>Returning you to the app...</p>
      <p style="opacity:.6;font-size:13px"><a style="color:#F97316" href="${target}">Tap here if not redirected</a></p>
      </div><script>location.replace(${JSON.stringify(target)});</script></body></html>`);
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
        const issues = parsed.error.errors.map((e) => `${e.path.join(".") || "field"}: ${e.message}`).join("; ");
        console.error("Route validation failed:", issues, "body:", body);
        return res.status(400).json({ error: `Invalid route data \u2014 ${issues}` });
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
      const pendingParcels = await db.select({ parcel: parcels, sender: users }).from(parcels).innerJoin(users, eq3(parcels.senderId, users.id)).where(and2(
        eq3(parcels.status, "Pending"),
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
  app2.post("/api/routes/:routeId/bookings", requireAuth, async (req, res) => {
    try {
      const senderId = req.user.uid;
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
      const existing = await storage.getPendingBookingForParcel(parcelId);
      if (existing) {
        return res.status(409).json({
          error: "You already have a pending booking request for this parcel. Cancel it before requesting another route.",
          bookingId: existing.id
        });
      }
      if (route.availableCapacity != null) {
        const used = route.capacityUsed ?? 0;
        if (used >= route.availableCapacity) {
          return res.status(400).json({ error: "Route is at full capacity" });
        }
      }
      const SIZE_ORDER2 = { small: 1, medium: 2, large: 3 };
      if (route.maxParcelSize && SIZE_ORDER2[parcel.size] > SIZE_ORDER2[route.maxParcelSize]) {
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
        message: message || null
      });
      res.status(201).json(booking);
      const sender = await storage.getUser(senderId);
      NotificationService.notifyNewRouteBookingRequest(
        route.carrierId,
        booking.id,
        route.id,
        sender?.name || "A sender",
        `${route.origin} \u2192 ${route.destination}`
      ).catch((err) => console.error("Failed to send booking request notification:", err));
    } catch (error) {
      console.error("Failed to create route booking:", error);
      res.status(500).json({ error: "Failed to create route booking" });
    }
  });
  app2.get("/api/routes/:routeId/bookings", requireAuth, async (req, res) => {
    try {
      const route = await storage.getRoute(req.params.routeId);
      if (!route) return res.status(404).json({ error: "Route not found" });
      if (route.carrierId !== req.user.uid) {
        return res.status(403).json({ error: "Not authorized" });
      }
      const bookings = await storage.getBookingsForRoute(route.id);
      res.json(bookings);
    } catch (error) {
      console.error("Failed to fetch route bookings:", error);
      res.status(500).json({ error: "Failed to fetch route bookings" });
    }
  });
  app2.get("/api/bookings/incoming", requireAuth, async (req, res) => {
    try {
      const bookings = await storage.getIncomingBookingsForCarrier(req.user.uid);
      res.json(bookings);
    } catch (error) {
      console.error("Failed to fetch incoming bookings:", error);
      res.status(500).json({ error: "Failed to fetch incoming bookings" });
    }
  });
  app2.get("/api/bookings/outgoing", requireAuth, async (req, res) => {
    try {
      const bookings = await storage.getOutgoingBookingsForSender(req.user.uid);
      res.json(bookings);
    } catch (error) {
      console.error("Failed to fetch outgoing bookings:", error);
      res.status(500).json({ error: "Failed to fetch outgoing bookings" });
    }
  });
  app2.patch("/api/bookings/:id/approve", requireAuth, async (req, res) => {
    try {
      const booking = await storage.getRouteBooking(req.params.id);
      if (!booking) return res.status(404).json({ error: "Booking not found" });
      if (booking.carrierId !== req.user.uid) {
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
      if (route.availableCapacity != null) {
        const used = route.capacityUsed ?? 0;
        if (used >= route.availableCapacity) {
          return res.status(400).json({ error: "Route is at full capacity" });
        }
      }
      const updated = await storage.updateRouteBooking(booking.id, {
        status: "Approved",
        respondedAt: /* @__PURE__ */ new Date(),
        responseNote: req.body?.note || null
      });
      await storage.updateParcel(parcel.id, {
        transporterId: booking.carrierId,
        status: "Accepted"
      });
      await storage.updateRoute(route.id, {
        capacityUsed: (route.capacityUsed ?? 0) + 1
      });
      res.json(updated);
      const carrier = await storage.getUser(booking.carrierId);
      NotificationService.notifyRouteBookingDecision(
        booking.senderId,
        booking.id,
        booking.parcelId,
        booking.routeId,
        "Approved",
        carrier?.name || "Carrier"
      ).catch((err) => console.error("Failed to send approval notification:", err));
    } catch (error) {
      console.error("Failed to approve booking:", error);
      res.status(500).json({ error: "Failed to approve booking" });
    }
  });
  app2.patch("/api/bookings/:id/decline", requireAuth, async (req, res) => {
    try {
      const booking = await storage.getRouteBooking(req.params.id);
      if (!booking) return res.status(404).json({ error: "Booking not found" });
      if (booking.carrierId !== req.user.uid) {
        return res.status(403).json({ error: "Only the route owner can decline" });
      }
      if (booking.status !== "Pending") {
        return res.status(400).json({ error: `Booking is already ${booking.status}` });
      }
      const updated = await storage.updateRouteBooking(booking.id, {
        status: "Declined",
        respondedAt: /* @__PURE__ */ new Date(),
        responseNote: req.body?.note || null
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
      ).catch((err) => console.error("Failed to send decline notification:", err));
    } catch (error) {
      console.error("Failed to decline booking:", error);
      res.status(500).json({ error: "Failed to decline booking" });
    }
  });
  app2.patch("/api/bookings/:id/cancel", requireAuth, async (req, res) => {
    try {
      const booking = await storage.getRouteBooking(req.params.id);
      if (!booking) return res.status(404).json({ error: "Booking not found" });
      if (booking.senderId !== req.user.uid) {
        return res.status(403).json({ error: "Only the sender can cancel" });
      }
      if (booking.status !== "Pending") {
        return res.status(400).json({ error: `Booking is already ${booking.status}` });
      }
      const updated = await storage.updateRouteBooking(booking.id, {
        status: "Cancelled",
        respondedAt: /* @__PURE__ */ new Date()
      });
      res.json(updated);
    } catch (error) {
      console.error("Failed to cancel booking:", error);
      res.status(500).json({ error: "Failed to cancel booking" });
    }
  });
  app2.get("/api/parcels/:parcelId/matching-routes", async (req, res) => {
    try {
      const parcel = await storage.getParcel(req.params.parcelId);
      if (!parcel) {
        return res.status(404).json({ error: "Parcel not found" });
      }
      const activeRoutes = await db.select({ route: routes, carrier: users }).from(routes).innerJoin(users, eq3(routes.carrierId, users.id)).where(and2(
        eq3(routes.status, "Active"),
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
      const capacityFullRoutes = await db.update(routes).set({ status: "Expired", updatedAt: now }).where(and2(
        eq3(routes.status, "Active"),
        sql3`${routes.availableCapacity} IS NOT NULL AND ${routes.capacityUsed} >= ${routes.availableCapacity}`
      )).returning();
      if (capacityFullRoutes.length > 0) {
        console.log(`Expired ${capacityFullRoutes.length} routes due to full capacity`);
      }
      const routesToExpire = await db.select().from(routes).where(and2(
        eq3(routes.status, "Active"),
        lte(routes.departureDate, now)
      ));
      const expiredRoutes = await db.update(routes).set({ status: "Expired", updatedAt: now }).where(and2(
        eq3(routes.status, "Active"),
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
      const expiredParcels = await db.update(parcels).set({ status: "Expired" }).where(and2(
        eq3(parcels.status, "Pending"),
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
      const msgs = await db.select({ id: parcelMessages.id, parcelId: parcelMessages.parcelId, senderId: parcelMessages.senderId, senderName: users.name, senderRole: parcelMessages.senderRole, content: parcelMessages.content, createdAt: parcelMessages.createdAt }).from(parcelMessages).innerJoin(users, eq3(parcelMessages.senderId, users.id)).where(eq3(parcelMessages.parcelId, req.params.parcelId)).orderBy(parcelMessages.createdAt);
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
      const preAcceptedStatuses = ["Pending", "Paid"];
      if (preAcceptedStatuses.includes(parcel.status)) {
        return res.status(403).json({ error: "Messaging is not available until the parcel has been accepted by a carrier" });
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
      const allParticipantIds = [parcel.senderId, parcel.transporterId, parcel.receiverId].filter((id) => !!id);
      broadcastToUsers(allParticipantIds, {
        type: "message:new",
        parcelId: req.params.parcelId,
        message: completeMsg
      });
      const recipientIds = [parcel.senderId, parcel.transporterId, parcel.receiverId].filter((id) => !!id && id !== userId);
      const uniqueRecipients = [...new Set(recipientIds)];
      for (const recipientId of uniqueRecipients) {
        NotificationService.notifyNewMessage(
          recipientId,
          req.params.parcelId,
          sender?.name || "Someone",
          req.body.content || ""
        ).catch((err) => console.error("Failed to send message notification:", err));
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });
  app2.get("/api/parcels/:parcelId/carrier-location", async (req, res) => {
    try {
      const loc = await db.select().from(carrierLocations).where(eq3(carrierLocations.parcelId, req.params.parcelId)).orderBy(desc3(carrierLocations.timestamp)).limit(1);
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
      const loc = await db.select().from(receiverLocations).where(eq3(receiverLocations.parcelId, req.params.parcelId)).orderBy(desc3(receiverLocations.timestamp)).limit(1);
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
      const amountNumber = Number(amount);
      const normalizedCurrency = typeof currency === "string" ? currency.toUpperCase() : "";
      if (!Number.isFinite(amountNumber) || amountNumber < 5 || amountNumber > 5e4 || normalizedCurrency !== "ZAR") {
        return res.status(400).json({ error: "A valid ZAR amount between 5 and 50000 is required" });
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
          email: user.email,
          currency: normalizedCurrency,
          metadata: {
            userId: req.user.uid,
            type: "wallet_topup",
            currency: normalizedCurrency
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
        currency: normalizedCurrency,
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
      const transactionResult = await db.select().from(walletTransactions).where(and2(eq3(walletTransactions.reference, reference), eq3(walletTransactions.userId, req.user.uid))).limit(1);
      const transaction = transactionResult[0];
      if (!transaction) return res.status(404).json({ error: "Top-up not found" });
      const paystackTransaction = await getPaystackTransaction(reference, paystackSecretKey);
      if (!paystackTransaction || paystackTransaction.amount !== transaction.amount || paystackTransaction.currency !== transaction.currency) {
        return res.status(400).json({ error: "Top-up verification failed" });
      }
      await completeWalletTopup(reference, transaction.amount, transaction.currency, paystackTransaction);
      res.json({ status: true, data: paystackTransaction });
    } catch (error) {
      console.error("Wallet top-up verification error:", error);
      res.status(500).json({ error: error.message || "Failed to verify top-up" });
    }
  });
  app2.get("/api/wallet/topup/verify-web", async (req, res) => {
    const reference = String(req.query.reference || req.query.trxref || "");
    const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
    let status = "failed";
    if (reference && paystackSecretKey) {
      try {
        const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
          headers: { Authorization: `Bearer ${paystackSecretKey}` }
        });
        const data = await response.json();
        const paystackTransaction = data?.status && data?.data?.status === "success" ? data.data : null;
        const paystackStatus = data?.data?.status;
        if (paystackTransaction) {
          const txnResult = await db.select().from(walletTransactions).where(eq3(walletTransactions.reference, reference));
          const transaction = txnResult[0];
          if (transaction && paystackTransaction.amount === transaction.amount && paystackTransaction.currency === transaction.currency) {
            await completeWalletTopup(reference, transaction.amount, transaction.currency, paystackTransaction);
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
  app2.get("/api/wallet/transactions", requireAuth, async (req, res) => {
    try {
      const transactions = await db.select().from(walletTransactions).where(eq3(walletTransactions.userId, req.user.uid)).orderBy(desc3(walletTransactions.createdAt));
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
  app2.get("/api/disputes", requireAuth, async (req, res) => {
    try {
      const userId = req.user.uid;
      const userDisputes = await db.select().from(disputes).where(eq3(disputes.complainantId, userId)).orderBy(desc3(disputes.createdAt));
      const respondentDisputes = await db.select().from(disputes).where(eq3(disputes.respondentId, userId)).orderBy(desc3(disputes.createdAt));
      const all = [...userDisputes, ...respondentDisputes].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      res.json(all);
    } catch (error) {
      console.error("Failed to fetch disputes:", error);
      res.status(500).json({ error: "Failed to fetch disputes" });
    }
  });
  app2.get("/api/disputes/me", requireAuth, async (req, res) => {
    try {
      const userId = req.user.uid;
      const userDisputes = await db.select().from(disputes).where(eq3(disputes.complainantId, userId)).orderBy(desc3(disputes.createdAt));
      const respondentDisputes = await db.select().from(disputes).where(eq3(disputes.respondentId, userId)).orderBy(desc3(disputes.createdAt));
      const all = [...userDisputes, ...respondentDisputes].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      res.json(all);
    } catch (error) {
      console.error("Failed to fetch disputes:", error);
      res.status(500).json({ error: "Failed to fetch disputes" });
    }
  });
  app2.get("/api/disputes/:id", requireAuth, async (req, res) => {
    try {
      const result = await db.select().from(disputes).where(eq3(disputes.id, req.params.id)).limit(1);
      if (!result.length) return res.status(404).json({ error: "Dispute not found" });
      res.json(result[0]);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dispute" });
    }
  });
  app2.post("/api/disputes", requireAuth, async (req, res) => {
    try {
      const parsed = insertDisputeSchema.safeParse({ ...req.body, complainantId: req.user.uid });
      if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
      const [dispute] = await db.insert(disputes).values(parsed.data).returning();
      res.status(201).json(dispute);
    } catch (error) {
      console.error("Failed to create dispute:", error);
      res.status(500).json({ error: "Failed to create dispute" });
    }
  });
  app2.get("/api/disputes/:id/messages", requireAuth, async (req, res) => {
    try {
      const msgs = await db.select().from(disputeMessages).where(eq3(disputeMessages.disputeId, req.params.id)).orderBy(disputeMessages.createdAt);
      res.json(msgs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dispute messages" });
    }
  });
  app2.post("/api/disputes/:id/messages", requireAuth, async (req, res) => {
    try {
      const parsed = insertDisputeMessageSchema.safeParse({
        ...req.body,
        disputeId: req.params.id,
        senderId: req.user.uid
      });
      if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
      const [msg] = await db.insert(disputeMessages).values(parsed.data).returning();
      res.status(201).json(msg);
    } catch (error) {
      console.error("Failed to create dispute message:", error);
      res.status(500).json({ error: "Failed to create dispute message" });
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
  app2.get("/api/parcels/:parcelId/photos", requireAuth, async (req, res) => {
    try {
      const { parcelId } = req.params;
      const parcel = await storage.getParcel(parcelId);
      if (!parcel) return res.status(404).json({ error: "Parcel not found" });
      const userId = req.user.uid;
      if (parcel.senderId !== userId && parcel.transporterId !== userId && parcel.receiverId !== userId) {
        return res.status(403).json({ error: "You are not a participant in this parcel" });
      }
      const photos = await db.select().from(parcelPhotos).where(eq3(parcelPhotos.parcelId, parcelId)).orderBy(desc3(parcelPhotos.createdAt));
      res.json(photos);
    } catch (error) {
      console.error("Failed to fetch parcel photos:", error);
      res.status(500).json({ error: "Failed to fetch parcel photos" });
    }
  });
  app2.post("/api/parcels/:parcelId/photos/upload", requireAuth, async (req, res) => {
    try {
      const { parcelId } = req.params;
      const userId = req.user.uid;
      const { photoData, photoType, caption, latitude, longitude } = req.body;
      if (!photoData || !photoType) {
        return res.status(400).json({ error: "photoData and photoType are required" });
      }
      if (photoType !== "listing" && photoType !== "pickup" && photoType !== "delivery") {
        return res.status(400).json({ error: "photoType must be listing, pickup, or delivery" });
      }
      const parcelResult = await db.select().from(parcels).where(eq3(parcels.id, parcelId)).limit(1);
      if (!parcelResult.length) {
        return res.status(404).json({ error: "Parcel not found" });
      }
      const currentParcel = parcelResult[0];
      const isSender = currentParcel.senderId === userId;
      const isCarrier = currentParcel.transporterId === userId;
      const isReceiver = currentParcel.receiverId === userId;
      if (!isSender && !isCarrier && !isReceiver) {
        return res.status(403).json({ error: "You are not a participant in this parcel" });
      }
      if (currentParcel.status === "Delivered" || currentParcel.status === "Expired") {
        return res.status(409).json({ error: "Photos cannot be added to this parcel" });
      }
      if (photoType !== "listing" && !["Accepted", "Picked Up", "In Transit", "Arrived"].includes(currentParcel.status || "")) {
        return res.status(409).json({ error: "Parcel is not in an active delivery state" });
      }
      if (photoType === "listing" && !isSender) {
        return res.status(403).json({ error: "Only the sender can upload a listing photo" });
      }
      if (photoType === "pickup" && !isCarrier) {
        return res.status(403).json({ error: "Only the assigned carrier can upload pickup proof" });
      }
      if (photoType === "delivery" && !isCarrier && !isReceiver) {
        return res.status(403).json({ error: "Only the carrier or receiver can upload delivery proof" });
      }
      let photoUrl;
      try {
        photoUrl = await storeParcelPhoto(photoData, parcelId);
      } catch (error) {
        return res.status(400).json({ error: error.message || "Invalid photo" });
      }
      const photo = await db.insert(parcelPhotos).values({
        parcelId,
        uploadedBy: userId,
        photoUrl,
        photoType,
        caption: caption || null,
        latitude: latitude || null,
        longitude: longitude || null
      }).returning();
      if (photoType === "listing") {
        await db.update(parcels).set({ photoUrl }).where(eq3(parcels.id, parcelId));
      }
      if (photoType === "pickup") {
        await db.update(parcels).set({ status: "In Transit" }).where(eq3(parcels.id, parcelId));
        const participantIds = [currentParcel.senderId, currentParcel.transporterId, currentParcel.receiverId].filter(Boolean);
        broadcastToUsers(participantIds, {
          type: "parcel:status",
          parcelId,
          status: "In Transit",
          onTheMove: true
        });
        const notifyIds = [currentParcel.senderId, currentParcel.receiverId].filter(Boolean);
        for (const uid of notifyIds) {
          NotificationService.notifyStatusChange(uid, parcelId, currentParcel.status, "In Transit", {
            origin: currentParcel.origin,
            destination: currentParcel.destination
          }).catch((err) => console.error("Notify in-transit error:", err));
        }
      } else if (photoType === "delivery") {
        await db.update(parcels).set({ status: "Delivered" }).where(eq3(parcels.id, parcelId));
        const participantIds = [currentParcel.senderId, currentParcel.transporterId, currentParcel.receiverId].filter(Boolean);
        broadcastToUsers(participantIds, {
          type: "parcel:status",
          parcelId,
          status: "Delivered",
          onTheMove: false
        });
        const notifyIds = [currentParcel.senderId, currentParcel.receiverId].filter(Boolean);
        for (const uid of notifyIds) {
          NotificationService.notifyStatusChange(uid, parcelId, currentParcel.status, "Delivered", {
            origin: currentParcel.origin,
            destination: currentParcel.destination
          }).catch((err) => console.error("Notify delivered error:", err));
        }
      }
      res.status(201).json(photo[0]);
    } catch (error) {
      console.error("Failed to upload parcel photo:", error);
      res.status(500).json({ error: "Failed to upload photo" });
    }
  });
  app2.get("/api/parcels/:parcelId/eta", async (req, res) => {
    try {
      const { parcelId } = req.params;
      const parcel = await storage.getParcel(parcelId);
      if (!parcel) {
        return res.status(404).json({ error: "Parcel not found" });
      }
      const loc = await db.select().from(carrierLocations).where(eq3(carrierLocations.parcelId, parcelId)).orderBy(desc3(carrierLocations.timestamp)).limit(1);
      if (!loc.length || !parcel.destinationLat || !parcel.destinationLng) {
        return res.json({ available: false, message: "Location not available yet" });
      }
      const carrierLoc = loc[0];
      const dLat = (parcel.destinationLat - carrierLoc.lat) * Math.PI / 180;
      const dLng = (parcel.destinationLng - carrierLoc.lng) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(carrierLoc.lat * Math.PI / 180) * Math.cos(parcel.destinationLat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
      const distanceKm = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const speedKmh = carrierLoc.speed && carrierLoc.speed > 2 ? carrierLoc.speed * 3.6 : 50;
      const etaMinutes = Math.round(distanceKm / speedKmh * 60);
      const locationAge = Date.now() - new Date(carrierLoc.timestamp).getTime();
      const isStale = locationAge > 10 * 60 * 1e3;
      res.json({
        available: true,
        distance: Math.round(distanceKm * 10) / 10,
        etaMinutes,
        carrierLocation: {
          lat: carrierLoc.lat,
          lng: carrierLoc.lng,
          timestamp: carrierLoc.timestamp,
          speed: carrierLoc.speed
        },
        isStale,
        message: isStale ? "Location data may be outdated" : etaMinutes < 5 ? "Arriving very soon!" : `About ${etaMinutes} min away`
      });
    } catch (error) {
      console.error("Failed to calculate ETA:", error);
      res.status(500).json({ error: "Failed to calculate ETA" });
    }
  });
  app2.get("/api/notifications", requireAuth, async (req, res) => {
    try {
      const userId = req.user.uid;
      const limit = parseInt(req.query.limit) || 50;
      const unreadOnly = req.query.unread === "true";
      const query = db.select().from(notifications).where(
        unreadOnly ? and2(eq3(notifications.userId, userId), eq3(notifications.isRead, false)) : eq3(notifications.userId, userId)
      ).orderBy(desc3(notifications.createdAt)).limit(limit);
      const result = await query;
      res.json(result);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });
  app2.get("/api/notifications/unread-count", requireAuth, async (req, res) => {
    try {
      const userId = req.user.uid;
      const result = await db.select({ count: sql3`count(*)::int` }).from(notifications).where(and2(eq3(notifications.userId, userId), eq3(notifications.isRead, false)));
      res.json({ count: result[0]?.count || 0 });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch unread count" });
    }
  });
  app2.patch("/api/notifications/:id/read", requireAuth, async (req, res) => {
    try {
      const userId = req.user.uid;
      await db.update(notifications).set({ isRead: true }).where(and2(eq3(notifications.id, req.params.id), eq3(notifications.userId, userId)));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });
  app2.patch("/api/notifications/read-all", requireAuth, async (req, res) => {
    try {
      const userId = req.user.uid;
      await db.update(notifications).set({ isRead: true }).where(and2(eq3(notifications.userId, userId), eq3(notifications.isRead, false)));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to mark all notifications as read" });
    }
  });
  registerReceiverEnhancements(app2);
  registerAIRoutes(app2);
  app2.get("/api/users/online", (req, res) => {
    const idsParam = req.query.ids || "";
    const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean);
    const result = {};
    for (const id of ids) {
      result[id] = { online: isUserOnline(id), lastSeen: getLastSeen(id) };
    }
    res.json(result);
  });
  const httpServer = createServer(app2);
  setupRealtime(httpServer);
  return httpServer;
}

// server/admin-routes.ts
import { eq as eq5, desc as desc4, count, sql as sql4, and as and3, gte as gte2, ilike, or as or3 } from "drizzle-orm";

// server/rbac.ts
import { eq as eq4 } from "drizzle-orm";

// server/logger.ts
import winston from "winston";
import path3 from "path";
import fs2 from "fs";
var logsDir = path3.join(process.cwd(), "logs");
if (!fs2.existsSync(logsDir)) {
  fs2.mkdirSync(logsDir, { recursive: true });
}
var logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp({
      format: "YYYY-MM-DD HH:mm:ss"
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: "parcelpeer-api" },
  transports: [
    new winston.transports.File({
      filename: path3.join(logsDir, "error.log"),
      level: "error",
      maxsize: 5242880,
      // 5MB
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: path3.join(logsDir, "combined.log"),
      maxsize: 5242880,
      maxFiles: 5
    })
  ]
});
if (process.env.NODE_ENV !== "production") {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}
var logger_default = logger;

// server/error-handler.ts
var AppError = class extends Error {
  constructor(message, code = "INTERNAL_ERROR", status = 500, details) {
    super(message);
    this.message = message;
    this.code = code;
    this.status = status;
    this.details = details;
    this.name = "AppError";
  }
};
var UnauthorizedError = class extends AppError {
  constructor(message = "Unauthorized") {
    super(message, "UNAUTHORIZED", 401);
  }
};
var ForbiddenError = class extends AppError {
  constructor(message = "Forbidden") {
    super(message, "FORBIDDEN", 403);
  }
};

// server/rbac.ts
function requireAdmin(req, res, next) {
  return requireRole("admin")(req, res, next);
}
function requireRole(...roles) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return next(new UnauthorizedError("Authentication required"));
      }
      const userResult = await db.select().from(users).where(eq4(users.id, req.user.uid)).limit(1);
      if (userResult.length === 0) {
        throw new UnauthorizedError("User not found");
      }
      const user = userResult[0];
      if (user.suspended) {
        return next(new ForbiddenError("This account has been suspended"));
      }
      const userRole = user.role || "user";
      if (!roles.includes(userRole)) {
        throw new ForbiddenError(
          `This endpoint requires one of these roles: ${roles.join(", ")}`
        );
      }
      ;
      req.userRole = userRole;
      next();
    } catch (error) {
      next(error);
    }
  };
}

// server/admin-routes.ts
function registerAdminRoutes(app2) {
  app2.get("/api/admin/stats", requireAdmin, async (req, res) => {
    try {
      const [
        totalUsers,
        totalParcels,
        totalRoutes,
        totalPayments,
        pendingParcels,
        activeRoutes,
        successfulPayments,
        recentUsers,
        totalDisputes,
        openDisputes,
        activeSubscriptions,
        totalWalletBalance
      ] = await Promise.all([
        db.select({ count: count() }).from(users),
        db.select({ count: count() }).from(parcels),
        db.select({ count: count() }).from(routes),
        db.select({ count: count() }).from(payments),
        db.select({ count: count() }).from(parcels).where(eq5(parcels.status, "Pending")),
        db.select({ count: count() }).from(routes).where(eq5(routes.status, "Active")),
        db.select({ sum: sql4`COALESCE(SUM(${payments.amount}), 0)` }).from(payments).where(eq5(payments.status, "success")),
        db.select({ count: count() }).from(users).where(gte2(users.createdAt, sql4`NOW() - INTERVAL '30 days'`)),
        db.select({ count: count() }).from(disputes),
        db.select({ count: count() }).from(disputes).where(eq5(disputes.status, "open")),
        db.select({ count: count() }).from(subscriptions).where(eq5(subscriptions.status, "active")),
        db.select({ sum: sql4`COALESCE(SUM(${users.walletBalance}), 0)` }).from(users)
      ]);
      const revenue = successfulPayments[0]?.sum || 0;
      const parcelStatusCounts = await db.select({
        status: parcels.status,
        count: count()
      }).from(parcels).groupBy(parcels.status);
      const paymentStatusCounts = await db.select({
        status: payments.status,
        count: count()
      }).from(payments).groupBy(payments.status);
      const disputeStatusCounts = await db.select({
        status: disputes.status,
        count: count()
      }).from(disputes).groupBy(disputes.status);
      res.json({
        users: {
          total: totalUsers[0]?.count || 0,
          recent: recentUsers[0]?.count || 0
        },
        parcels: {
          total: totalParcels[0]?.count || 0,
          pending: pendingParcels[0]?.count || 0,
          statusBreakdown: parcelStatusCounts
        },
        routes: {
          total: totalRoutes[0]?.count || 0,
          active: activeRoutes[0]?.count || 0
        },
        payments: {
          total: totalPayments[0]?.count || 0,
          revenue,
          statusBreakdown: paymentStatusCounts
        },
        disputes: {
          total: totalDisputes[0]?.count || 0,
          open: openDisputes[0]?.count || 0,
          statusBreakdown: disputeStatusCounts
        },
        subscriptions: {
          active: activeSubscriptions[0]?.count || 0
        },
        wallet: {
          totalBalance: totalWalletBalance[0]?.sum || 0
        }
      });
    } catch (error) {
      logger_default.error("Failed to fetch admin stats:", error);
      res.status(500).json({ error: "Failed to fetch statistics" });
    }
  });
  app2.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const { search, role, verified, suspended, page = "1", limit = "20" } = req.query;
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;
      let query = db.select().from(users);
      const conditions = [];
      if (search) {
        conditions.push(
          or3(
            ilike(users.name, `%${search}%`),
            ilike(users.email, `%${search}%`),
            ilike(users.phone, `%${search}%`)
          )
        );
      }
      if (role) {
        conditions.push(eq5(users.role, role));
      }
      if (verified !== void 0) {
        conditions.push(eq5(users.verified, verified === "true"));
      }
      if (suspended !== void 0) {
        conditions.push(eq5(users.suspended, suspended === "true"));
      }
      if (conditions.length > 0) {
        query = query.where(and3(...conditions));
      }
      const allUsers = await query.orderBy(desc4(users.createdAt)).limit(limitNum).offset(offset);
      const totalCount = await db.select({ count: count() }).from(users);
      res.json({
        users: allUsers,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount[0]?.count || 0,
          totalPages: Math.ceil((totalCount[0]?.count || 0) / limitNum)
        }
      });
    } catch (error) {
      console.error("Failed to fetch users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });
  app2.get("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const [sentParcels, transportedParcels, userRoutes, userReviews] = await Promise.all([
        db.select({ count: count() }).from(parcels).where(eq5(parcels.senderId, req.params.id)),
        db.select({ count: count() }).from(parcels).where(eq5(parcels.transporterId, req.params.id)),
        db.select({ count: count() }).from(routes).where(eq5(routes.carrierId, req.params.id)),
        db.select({ count: count() }).from(reviews).where(eq5(reviews.revieweeId, req.params.id))
      ]);
      res.json({
        ...user,
        stats: {
          sentParcels: sentParcels[0]?.count || 0,
          transportedParcels: transportedParcels[0]?.count || 0,
          routes: userRoutes[0]?.count || 0,
          reviews: userReviews[0]?.count || 0
        }
      });
    } catch (error) {
      console.error("Failed to fetch user:", error);
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });
  app2.patch("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const { verified, suspended, role } = req.body;
      const updates = {};
      if (verified !== void 0) updates.verified = verified;
      if (suspended !== void 0) updates.suspended = suspended;
      if (role !== void 0) updates.role = role;
      const result = await db.update(users).set(updates).where(eq5(users.id, req.params.id)).returning();
      if (!result[0]) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(result[0]);
    } catch (error) {
      console.error("Failed to update user:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });
  app2.get("/api/admin/parcels", requireAdmin, async (req, res) => {
    try {
      const { status, search, page = "1", limit = "20" } = req.query;
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;
      const conditions = [];
      if (status) {
        conditions.push(eq5(parcels.status, status));
      }
      if (search) {
        conditions.push(
          or3(
            ilike(parcels.origin, `%${search}%`),
            ilike(parcels.destination, `%${search}%`),
            ilike(parcels.description, `%${search}%`)
          )
        );
      }
      let query = db.select({
        parcel: parcels,
        sender: users
      }).from(parcels).innerJoin(users, eq5(parcels.senderId, users.id));
      if (conditions.length > 0) {
        query = query.where(and3(...conditions));
      }
      const allParcels = await query.orderBy(desc4(parcels.createdAt)).limit(limitNum).offset(offset);
      const totalCount = await db.select({ count: count() }).from(parcels);
      const result = allParcels.map(({ parcel, sender }) => ({
        ...parcel,
        senderName: sender.name,
        senderEmail: sender.email
      }));
      res.json({
        parcels: result,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount[0]?.count || 0,
          totalPages: Math.ceil((totalCount[0]?.count || 0) / limitNum)
        }
      });
    } catch (error) {
      console.error("Failed to fetch parcels:", error);
      res.status(500).json({ error: "Failed to fetch parcels" });
    }
  });
  app2.patch("/api/admin/parcels/:id", requireAdmin, async (req, res) => {
    try {
      const parcel = await storage.updateParcel(req.params.id, req.body);
      if (!parcel) {
        return res.status(404).json({ error: "Parcel not found" });
      }
      res.json(parcel);
    } catch (error) {
      console.error("Failed to update parcel:", error);
      res.status(500).json({ error: "Failed to update parcel" });
    }
  });
  app2.delete("/api/admin/parcels/:id", requireAdmin, async (req, res) => {
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
  app2.get("/api/admin/routes", requireAdmin, async (req, res) => {
    try {
      const { status, search, page = "1", limit = "20" } = req.query;
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;
      const conditions = [];
      if (status) {
        conditions.push(eq5(routes.status, status));
      }
      if (search) {
        conditions.push(
          or3(
            ilike(routes.origin, `%${search}%`),
            ilike(routes.destination, `%${search}%`)
          )
        );
      }
      let query = db.select({
        route: routes,
        carrier: users
      }).from(routes).innerJoin(users, eq5(routes.carrierId, users.id));
      if (conditions.length > 0) {
        query = query.where(and3(...conditions));
      }
      const allRoutes = await query.orderBy(desc4(routes.createdAt)).limit(limitNum).offset(offset);
      const totalCount = await db.select({ count: count() }).from(routes);
      const result = allRoutes.map(({ route, carrier }) => ({
        ...route,
        carrierName: carrier.name,
        carrierEmail: carrier.email
      }));
      res.json({
        routes: result,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount[0]?.count || 0,
          totalPages: Math.ceil((totalCount[0]?.count || 0) / limitNum)
        }
      });
    } catch (error) {
      console.error("Failed to fetch routes:", error);
      res.status(500).json({ error: "Failed to fetch routes" });
    }
  });
  app2.patch("/api/admin/routes/:id", requireAdmin, async (req, res) => {
    try {
      const route = await storage.updateRoute(req.params.id, req.body);
      if (!route) {
        return res.status(404).json({ error: "Route not found" });
      }
      res.json(route);
    } catch (error) {
      console.error("Failed to update route:", error);
      res.status(500).json({ error: "Failed to update route" });
    }
  });
  app2.delete("/api/admin/routes/:id", requireAdmin, async (req, res) => {
    try {
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
  app2.get("/api/admin/payments", requireAdmin, async (req, res) => {
    try {
      const { status, page = "1", limit = "20" } = req.query;
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;
      let query = db.select({
        payment: payments,
        sender: users
      }).from(payments).innerJoin(users, eq5(payments.senderId, users.id));
      if (status) {
        query = query.where(eq5(payments.status, status));
      }
      const allPayments = await query.orderBy(desc4(payments.createdAt)).limit(limitNum).offset(offset);
      const totalCount = await db.select({ count: count() }).from(payments);
      const result = allPayments.map(({ payment, sender }) => ({
        ...payment,
        senderName: sender.name,
        senderEmail: sender.email
      }));
      res.json({
        payments: result,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount[0]?.count || 0,
          totalPages: Math.ceil((totalCount[0]?.count || 0) / limitNum)
        }
      });
    } catch (error) {
      console.error("Failed to fetch payments:", error);
      res.status(500).json({ error: "Failed to fetch payments" });
    }
  });
  app2.get("/api/admin/reviews", requireAdmin, async (req, res) => {
    try {
      const { page = "1", limit = "20" } = req.query;
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;
      const allReviews = await db.select({
        review: reviews,
        reviewer: users
      }).from(reviews).innerJoin(users, eq5(reviews.reviewerId, users.id)).orderBy(desc4(reviews.createdAt)).limit(limitNum).offset(offset);
      const totalCount = await db.select({ count: count() }).from(reviews);
      const result = allReviews.map(({ review, reviewer }) => ({
        ...review,
        reviewerName: reviewer.name,
        reviewerEmail: reviewer.email
      }));
      res.json({
        reviews: result,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount[0]?.count || 0,
          totalPages: Math.ceil((totalCount[0]?.count || 0) / limitNum)
        }
      });
    } catch (error) {
      console.error("Failed to fetch reviews:", error);
      res.status(500).json({ error: "Failed to fetch reviews" });
    }
  });
  app2.delete("/api/admin/reviews/:id", requireAdmin, async (req, res) => {
    try {
      const result = await db.delete(reviews).where(eq5(reviews.id, req.params.id)).returning();
      if (!result[0]) {
        return res.status(404).json({ error: "Review not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete review:", error);
      res.status(500).json({ error: "Failed to delete review" });
    }
  });
  app2.get("/api/admin/activity", requireAdmin, async (req, res) => {
    try {
      const { limit = "50" } = req.query;
      const limitNum = parseInt(limit);
      const [recentParcels, recentRoutes, recentPayments] = await Promise.all([
        db.select({
          id: parcels.id,
          type: sql4`'parcel'`,
          description: sql4`CONCAT('Parcel from ', ${parcels.origin}, ' to ', ${parcels.destination})`,
          status: parcels.status,
          createdAt: parcels.createdAt,
          userId: parcels.senderId,
          userName: users.name
        }).from(parcels).innerJoin(users, eq5(parcels.senderId, users.id)).orderBy(desc4(parcels.createdAt)).limit(limitNum / 3),
        db.select({
          id: routes.id,
          type: sql4`'route'`,
          description: sql4`CONCAT('Route from ', ${routes.origin}, ' to ', ${routes.destination})`,
          status: routes.status,
          createdAt: routes.createdAt,
          userId: routes.carrierId,
          userName: users.name
        }).from(routes).innerJoin(users, eq5(routes.carrierId, users.id)).orderBy(desc4(routes.createdAt)).limit(limitNum / 3),
        db.select({
          id: payments.id,
          type: sql4`'payment'`,
          description: sql4`CONCAT('Payment of ', ${payments.amount}, ' ', ${payments.currency})`,
          status: payments.status,
          createdAt: payments.createdAt,
          userId: payments.senderId,
          userName: users.name
        }).from(payments).innerJoin(users, eq5(payments.senderId, users.id)).orderBy(desc4(payments.createdAt)).limit(limitNum / 3)
      ]);
      const activities = [...recentParcels, ...recentRoutes, ...recentPayments].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, limitNum);
      res.json({ activities });
    } catch (error) {
      console.error("Failed to fetch activity:", error);
      res.status(500).json({ error: "Failed to fetch activity" });
    }
  });
  app2.get("/api/admin/disputes", requireAdmin, async (req, res) => {
    try {
      const { status, search, page = "1", limit = "20" } = req.query;
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;
      const conditions = [];
      if (status) {
        conditions.push(eq5(disputes.status, status));
      }
      if (search) {
        conditions.push(
          or3(
            ilike(disputes.subject, `%${search}%`),
            ilike(disputes.description, `%${search}%`)
          )
        );
      }
      let query = db.select({
        dispute: disputes,
        complainant: users,
        parcel: parcels
      }).from(disputes).innerJoin(users, eq5(disputes.complainantId, users.id)).leftJoin(parcels, eq5(disputes.parcelId, parcels.id));
      if (conditions.length > 0) {
        query = query.where(and3(...conditions));
      }
      const allDisputes = await query.orderBy(desc4(disputes.createdAt)).limit(limitNum).offset(offset);
      const totalCount = await db.select({ count: count() }).from(disputes);
      const result = allDisputes.map(({ dispute, complainant, parcel }) => ({
        ...dispute,
        complainantName: complainant.name,
        complainantEmail: complainant.email,
        parcelOrigin: parcel?.origin,
        parcelDestination: parcel?.destination
      }));
      res.json({
        disputes: result,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount[0]?.count || 0,
          totalPages: Math.ceil((totalCount[0]?.count || 0) / limitNum)
        }
      });
    } catch (error) {
      logger_default.error("Failed to fetch disputes:", error);
      res.status(500).json({ error: "Failed to fetch disputes" });
    }
  });
  app2.get("/api/admin/disputes/:id", requireAdmin, async (req, res) => {
    try {
      const dispute = await storage.getDispute(req.params.id);
      if (!dispute) {
        return res.status(404).json({ error: "Dispute not found" });
      }
      const [complainant, respondent, parcel] = await Promise.all([
        storage.getUser(dispute.complainantId),
        storage.getUser(dispute.respondentId),
        storage.getParcel(dispute.parcelId)
      ]);
      const messages4 = await storage.getDisputeMessages(req.params.id);
      res.json({
        ...dispute,
        complainant,
        respondent,
        parcel,
        messages: messages4
      });
    } catch (error) {
      logger_default.error("Failed to fetch dispute:", error);
      res.status(500).json({ error: "Failed to fetch dispute" });
    }
  });
  app2.patch("/api/admin/disputes/:id", requireAdmin, async (req, res) => {
    try {
      const { status, resolution, adminId } = req.body;
      const updates = { adminId: req.user.uid };
      if (status) updates.status = status;
      if (resolution) updates.resolution = resolution;
      if (status === "resolved" || status === "closed") {
        updates.resolvedAt = /* @__PURE__ */ new Date();
      }
      const dispute = await storage.updateDispute(req.params.id, updates);
      if (!dispute) {
        return res.status(404).json({ error: "Dispute not found" });
      }
      logger_default.info("Admin updated dispute", {
        adminId: req.user.uid,
        disputeId: req.params.id,
        updates
      });
      res.json(dispute);
    } catch (error) {
      logger_default.error("Failed to update dispute:", error);
      res.status(500).json({ error: "Failed to update dispute" });
    }
  });
  app2.post("/api/admin/disputes/:id/resolve", requireAdmin, async (req, res) => {
    try {
      const { refundAmount, resolution, refundToWallet = true } = req.body;
      const dispute = await storage.getDispute(req.params.id);
      if (!dispute) {
        return res.status(404).json({ error: "Dispute not found" });
      }
      if (dispute.status === "resolved" || dispute.status === "closed") {
        return res.status(400).json({ error: "Dispute already resolved" });
      }
      const updates = {
        status: "resolved",
        resolution,
        resolvedAt: /* @__PURE__ */ new Date(),
        adminId: req.user.uid
      };
      if (refundAmount && refundAmount > 0) {
        updates.refundAmount = refundAmount;
        if (refundToWallet) {
          const complainant = await storage.getUser(dispute.complainantId);
          if (complainant) {
            const newBalance = (complainant.walletBalance || 0) + refundAmount;
            await db.update(users).set({ walletBalance: newBalance }).where(eq5(users.id, dispute.complainantId));
            await storage.createWalletTransaction({
              userId: dispute.complainantId,
              amount: refundAmount,
              type: "refund",
              balanceBefore: complainant.walletBalance || 0,
              balanceAfter: newBalance,
              description: `Refund for dispute #${req.params.id}`,
              reference: `DISPUTE-REFUND-${req.params.id}`,
              parcelId: dispute.parcelId
            });
            updates.refundedToWallet = true;
          }
        }
      }
      const updatedDispute = await storage.updateDispute(req.params.id, updates);
      logger_default.info("Admin resolved dispute with refund", {
        adminId: req.user.uid,
        disputeId: req.params.id,
        refundAmount,
        refundToWallet
      });
      res.json(updatedDispute);
    } catch (error) {
      logger_default.error("Failed to resolve dispute:", error);
      res.status(500).json({ error: "Failed to resolve dispute" });
    }
  });
  app2.post("/api/admin/disputes/:id/messages", requireAdmin, async (req, res) => {
    try {
      const { message } = req.body;
      if (!message || message.trim().length === 0) {
        return res.status(400).json({ error: "Message is required" });
      }
      const dispute = await storage.getDispute(req.params.id);
      if (!dispute) {
        return res.status(404).json({ error: "Dispute not found" });
      }
      const disputeMessage = await storage.createDisputeMessage({
        disputeId: req.params.id,
        senderId: req.user.uid,
        message: message.trim(),
        isAdminMessage: true
      });
      logger_default.info("Admin sent dispute message", {
        adminId: req.user.uid,
        disputeId: req.params.id
      });
      res.json(disputeMessage);
    } catch (error) {
      logger_default.error("Failed to send dispute message:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });
  app2.get("/api/admin/subscriptions", requireAdmin, async (req, res) => {
    try {
      const { status, tier, page = "1", limit = "20" } = req.query;
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;
      const conditions = [];
      if (status) {
        conditions.push(eq5(subscriptions.status, status));
      }
      if (tier) {
        conditions.push(eq5(subscriptions.tier, tier));
      }
      let query = db.select({
        subscription: subscriptions,
        user: users
      }).from(subscriptions).innerJoin(users, eq5(subscriptions.userId, users.id));
      if (conditions.length > 0) {
        query = query.where(and3(...conditions));
      }
      const allSubscriptions = await query.orderBy(desc4(subscriptions.createdAt)).limit(limitNum).offset(offset);
      const totalCount = await db.select({ count: count() }).from(subscriptions);
      const result = allSubscriptions.map(({ subscription, user }) => ({
        ...subscription,
        userName: user.name,
        userEmail: user.email
      }));
      res.json({
        subscriptions: result,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount[0]?.count || 0,
          totalPages: Math.ceil((totalCount[0]?.count || 0) / limitNum)
        }
      });
    } catch (error) {
      logger_default.error("Failed to fetch subscriptions:", error);
      res.status(500).json({ error: "Failed to fetch subscriptions" });
    }
  });
  app2.get("/api/admin/subscriptions/stats", requireAdmin, async (req, res) => {
    try {
      const [totalSubscriptions, activeSubscriptions, revenueData, tierBreakdown] = await Promise.all([
        db.select({ count: count() }).from(subscriptions),
        db.select({ count: count() }).from(subscriptions).where(eq5(subscriptions.status, "active")),
        db.select({ sum: sql4`COALESCE(SUM(${subscriptions.amount}), 0)` }).from(subscriptions).where(eq5(subscriptions.status, "active")),
        db.select({
          tier: subscriptions.tier,
          count: count(),
          revenue: sql4`COALESCE(SUM(${subscriptions.amount}), 0)`
        }).from(subscriptions).where(eq5(subscriptions.status, "active")).groupBy(subscriptions.tier)
      ]);
      res.json({
        total: totalSubscriptions[0]?.count || 0,
        active: activeSubscriptions[0]?.count || 0,
        monthlyRevenue: revenueData[0]?.sum || 0,
        tierBreakdown
      });
    } catch (error) {
      logger_default.error("Failed to fetch subscription stats:", error);
      res.status(500).json({ error: "Failed to fetch subscription statistics" });
    }
  });
  app2.patch("/api/admin/subscriptions/:id", requireAdmin, async (req, res) => {
    try {
      const { status, endDate } = req.body;
      const updates = {};
      if (status) updates.status = status;
      if (endDate) updates.endDate = new Date(endDate);
      const result = await db.update(subscriptions).set(updates).where(eq5(subscriptions.id, req.params.id)).returning();
      if (!result[0]) {
        return res.status(404).json({ error: "Subscription not found" });
      }
      logger_default.info("Admin updated subscription", {
        adminId: req.user.uid,
        subscriptionId: req.params.id,
        updates
      });
      res.json(result[0]);
    } catch (error) {
      logger_default.error("Failed to update subscription:", error);
      res.status(500).json({ error: "Failed to update subscription" });
    }
  });
  app2.post("/api/admin/subscriptions/:id/cancel", requireAdmin, async (req, res) => {
    try {
      const { reason } = req.body;
      const result = await db.update(subscriptions).set({
        status: "cancelled",
        cancelledAt: /* @__PURE__ */ new Date(),
        cancellationReason: reason || "Cancelled by admin"
      }).where(eq5(subscriptions.id, req.params.id)).returning();
      if (!result[0]) {
        return res.status(404).json({ error: "Subscription not found" });
      }
      await db.update(users).set({
        subscriptionTier: "free",
        subscriptionStatus: "cancelled"
      }).where(eq5(users.id, result[0].userId));
      logger_default.info("Admin cancelled subscription", {
        adminId: req.user.uid,
        subscriptionId: req.params.id,
        reason
      });
      res.json(result[0]);
    } catch (error) {
      logger_default.error("Failed to cancel subscription:", error);
      res.status(500).json({ error: "Failed to cancel subscription" });
    }
  });
  app2.get("/api/admin/wallet/transactions", requireAdmin, async (req, res) => {
    try {
      const { type, userId, page = "1", limit = "50" } = req.query;
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;
      const conditions = [];
      if (type) {
        conditions.push(eq5(walletTransactions.type, type));
      }
      if (userId) {
        conditions.push(eq5(walletTransactions.userId, userId));
      }
      let query = db.select({
        transaction: walletTransactions,
        user: users
      }).from(walletTransactions).innerJoin(users, eq5(walletTransactions.userId, users.id));
      if (conditions.length > 0) {
        query = query.where(and3(...conditions));
      }
      const allTransactions = await query.orderBy(desc4(walletTransactions.createdAt)).limit(limitNum).offset(offset);
      const totalCount = await db.select({ count: count() }).from(walletTransactions);
      const result = allTransactions.map(({ transaction, user }) => ({
        ...transaction,
        userName: user.name,
        userEmail: user.email
      }));
      res.json({
        transactions: result,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount[0]?.count || 0,
          totalPages: Math.ceil((totalCount[0]?.count || 0) / limitNum)
        }
      });
    } catch (error) {
      logger_default.error("Failed to fetch wallet transactions:", error);
      res.status(500).json({ error: "Failed to fetch wallet transactions" });
    }
  });
  app2.get("/api/admin/wallet/stats", requireAdmin, async (req, res) => {
    try {
      const [totalTransactions, totalCredits, totalDebits, totalTopups, totalRefunds] = await Promise.all([
        db.select({ count: count() }).from(walletTransactions),
        db.select({ sum: sql4`COALESCE(SUM(${walletTransactions.amount}), 0)` }).from(walletTransactions).where(eq5(walletTransactions.type, "credit")),
        db.select({ sum: sql4`COALESCE(SUM(${walletTransactions.amount}), 0)` }).from(walletTransactions).where(eq5(walletTransactions.type, "debit")),
        db.select({ sum: sql4`COALESCE(SUM(${walletTransactions.amount}), 0)` }).from(walletTransactions).where(eq5(walletTransactions.type, "topup")),
        db.select({ sum: sql4`COALESCE(SUM(${walletTransactions.amount}), 0)` }).from(walletTransactions).where(eq5(walletTransactions.type, "refund"))
      ]);
      const totalWalletBalance = await db.select({
        sum: sql4`COALESCE(SUM(${users.walletBalance}), 0)`
      }).from(users);
      res.json({
        totalTransactions: totalTransactions[0]?.count || 0,
        totalCredits: totalCredits[0]?.sum || 0,
        totalDebits: totalDebits[0]?.sum || 0,
        totalTopups: totalTopups[0]?.sum || 0,
        totalRefunds: totalRefunds[0]?.sum || 0,
        totalWalletBalance: totalWalletBalance[0]?.sum || 0
      });
    } catch (error) {
      logger_default.error("Failed to fetch wallet stats:", error);
      res.status(500).json({ error: "Failed to fetch wallet statistics" });
    }
  });
  app2.post("/api/admin/wallet/adjust", requireAdmin, async (req, res) => {
    try {
      const { userId, amount, type, description } = req.body;
      if (!userId || !amount || !type) {
        return res.status(400).json({ error: "userId, amount, and type are required" });
      }
      if (!["credit", "debit"].includes(type)) {
        return res.status(400).json({ error: "Type must be credit or debit" });
      }
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const currentBalance = user.walletBalance || 0;
      const adjustAmount = type === "credit" ? amount : -amount;
      const newBalance = currentBalance + adjustAmount;
      if (newBalance < 0) {
        return res.status(400).json({ error: "Insufficient wallet balance for debit" });
      }
      await db.update(users).set({ walletBalance: newBalance }).where(eq5(users.id, userId));
      const transaction = await storage.createWalletTransaction({
        userId,
        amount: Math.abs(amount),
        type,
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
        description: description || `Admin ${type} by ${req.user.email}`,
        reference: `ADMIN-ADJUST-${Date.now()}`,
        metadata: JSON.stringify({ adminId: req.user.uid, adminEmail: req.user.email })
      });
      logger_default.info("Admin adjusted wallet", {
        adminId: req.user.uid,
        userId,
        amount,
        type,
        newBalance
      });
      res.json({
        transaction,
        newBalance
      });
    } catch (error) {
      logger_default.error("Failed to adjust wallet:", error);
      res.status(500).json({ error: "Failed to adjust wallet" });
    }
  });
  app2.post("/api/admin/wallet/refund", requireAdmin, async (req, res) => {
    try {
      const { userId, amount, description, parcelId } = req.body;
      if (!userId || !amount) {
        return res.status(400).json({ error: "userId and amount are required" });
      }
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const currentBalance = user.walletBalance || 0;
      const newBalance = currentBalance + amount;
      await db.update(users).set({ walletBalance: newBalance }).where(eq5(users.id, userId));
      const transaction = await storage.createWalletTransaction({
        userId,
        amount,
        type: "refund",
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
        description: description || `Refund issued by admin`,
        reference: `ADMIN-REFUND-${Date.now()}`,
        parcelId: parcelId || void 0,
        metadata: JSON.stringify({ adminId: req.user.uid, adminEmail: req.user.email })
      });
      logger_default.info("Admin issued refund to wallet", {
        adminId: req.user.uid,
        userId,
        amount,
        newBalance,
        parcelId
      });
      res.json({
        transaction,
        newBalance
      });
    } catch (error) {
      logger_default.error("Failed to issue refund:", error);
      res.status(500).json({ error: "Failed to issue refund" });
    }
  });
}

// server/index.ts
import * as path4 from "path";
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
function setupPhotoStorage(app2) {
  const uploadRoot = path4.resolve(process.env.PHOTO_STORAGE_DIR || path4.resolve(process.cwd(), "uploads"));
  app2.use("/uploads", express.static(uploadRoot, { index: false, maxAge: "1d" }));
}
function setupRequestLogging(app2) {
  app2.use((req, res, next) => {
    const start = Date.now();
    const path5 = req.path;
    let capturedJsonResponse = void 0;
    const originalResJson = res.json;
    res.json = function(bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
    res.on("finish", () => {
      if (!path5.startsWith("/api")) return;
      const duration = Date.now() - start;
      let logLine = `${req.method} ${path5} ${res.statusCode} in ${duration}ms`;
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
function configureProductionLanding(app2) {
  app2.get("/", (_req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>The GTW \u2013 Peer-to-Peer Parcel Delivery</title>
  <meta name="description" content="Send parcels with travelers going your way. Earn money carrying parcels on your existing routes. The GTW connects senders and carriers across any route." />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --navy: #0f172a;
      --navy-card: #1e293b;
      --navy-light: #334155;
      --slate: #94a3b8;
      --slate-light: #cbd5e1;
      --orange: #F97316;
      --orange-dark: #EA580C;
      --green: #22c55e;
      --white: #f8fafc;
    }
    html { scroll-behavior: smooth; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--navy);
      color: var(--white);
      line-height: 1.6;
      overflow-x: hidden;
    }

    /* ---- NAV ---- */
    nav {
      position: fixed; top: 0; left: 0; right: 0; z-index: 100;
      display: flex; align-items: center; justify-content: space-between;
      padding: 18px 40px;
      background: rgba(15,23,42,0);
      backdrop-filter: blur(0px);
      border-bottom: 1px solid transparent;
      transition: background 0.3s, backdrop-filter 0.3s, border-color 0.3s;
    }
    nav.scrolled {
      background: rgba(15,23,42,0.92);
      backdrop-filter: blur(14px);
      border-color: rgba(255,255,255,0.07);
    }
    .nav-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; }
    .nav-logo-icon {
      width: 36px; height: 36px; border-radius: 10px;
      background: var(--orange); display: flex; align-items: center; justify-content: center;
    }
    .nav-logo-icon svg { width: 20px; height: 20px; fill: white; }
    .nav-logo-text { font-size: 17px; font-weight: 700; color: var(--white); }
    .nav-links { display: flex; gap: 32px; align-items: center; }
    .nav-links a { font-size: 14px; color: var(--slate); text-decoration: none; font-weight: 500; transition: color 0.2s; }
    .nav-links a:hover { color: var(--white); }
    .nav-right { display: flex; gap: 12px; align-items: center; }
    .nav-signin {
      font-size: 14px; font-weight: 600; color: var(--slate-light);
      text-decoration: none; padding: 8px 16px; border-radius: 8px;
      transition: color 0.2s;
    }
    .nav-signin:hover { color: var(--white); }
    .nav-cta {
      display: inline-block; background: var(--orange); color: #fff;
      text-decoration: none; border-radius: 8px; padding: 10px 22px;
      font-weight: 600; font-size: 14px; transition: background 0.2s;
    }
    .nav-cta:hover { background: var(--orange-dark); }
    @media (max-width: 768px) {
      nav { padding: 16px 20px; }
      .nav-links { display: none; }
    }

    /* ---- HERO ---- */
    .hero {
      min-height: 100vh;
      display: flex; align-items: center; justify-content: center;
      text-align: center;
      padding: 120px 24px 80px;
      position: relative;
      overflow: hidden;
    }
    .hero::before {
      content: '';
      position: absolute; inset: 0;
      background:
        radial-gradient(ellipse 90% 65% at 50% -10%, rgba(249,115,22,0.16) 0%, transparent 65%),
        radial-gradient(ellipse 60% 40% at 80% 80%, rgba(99,102,241,0.07) 0%, transparent 60%);
    }
    .hero-grid {
      position: absolute; inset: 0;
      background-image: linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
      background-size: 60px 60px;
      mask-image: radial-gradient(ellipse 80% 70% at 50% 50%, black 30%, transparent 80%);
    }
    .hero-inner { max-width: 700px; position: relative; z-index: 1; }
    .hero-badge {
      display: inline-flex; align-items: center; gap: 7px;
      background: rgba(34,197,94,0.1); color: var(--green);
      border: 1px solid rgba(34,197,94,0.25); border-radius: 999px;
      font-size: 12px; font-weight: 600; padding: 5px 16px;
      letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 32px;
    }
    .hero-badge-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--green); animation: blink 2s infinite; }
    @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
    .hero h1 {
      font-size: clamp(2.6rem, 7vw, 4.4rem);
      font-weight: 800; line-height: 1.1;
      letter-spacing: -0.03em; margin-bottom: 22px;
    }
    .hero h1 .accent { color: var(--orange); }
    .hero-sub {
      font-size: 1.15rem; color: var(--slate); max-width: 540px;
      margin: 0 auto 44px; line-height: 1.8;
    }
    .hero-btns { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; }
    .btn-primary {
      display: inline-flex; align-items: center; gap: 8px;
      background: var(--orange); color: #fff; text-decoration: none;
      border-radius: 12px; padding: 16px 32px; font-weight: 700; font-size: 15px;
      transition: all 0.2s; box-shadow: 0 8px 24px rgba(249,115,22,0.35);
    }
    .btn-primary:hover { background: var(--orange-dark); transform: translateY(-2px); box-shadow: 0 14px 32px rgba(249,115,22,0.45); }
    .btn-ghost {
      display: inline-flex; align-items: center; gap: 8px;
      background: rgba(255,255,255,0.05); color: var(--slate-light); text-decoration: none;
      border: 1.5px solid rgba(255,255,255,0.12); border-radius: 12px;
      padding: 16px 32px; font-weight: 600; font-size: 15px; transition: all 0.2s;
    }
    .btn-ghost:hover { border-color: rgba(255,255,255,0.3); color: var(--white); background: rgba(255,255,255,0.08); }

    /* stats */
    .hero-stats {
      display: flex; gap: 0; justify-content: center; flex-wrap: wrap;
      margin-top: 64px; padding-top: 48px; border-top: 1px solid rgba(255,255,255,0.08);
    }
    .stat-item {
      text-align: center; padding: 0 32px;
      border-right: 1px solid rgba(255,255,255,0.08);
    }
    .stat-item:last-child { border-right: none; }
    .stat-num { font-size: 2rem; font-weight: 800; color: var(--white); line-height: 1; }
    .stat-label { font-size: 13px; color: var(--slate); margin-top: 5px; }
    @media (max-width: 600px) {
      .stat-item { padding: 12px 20px; border-right: none; }
    }

    /* ---- TRUST BAR ---- */
    .trust-bar {
      padding: 24px;
      border-top: 1px solid rgba(255,255,255,0.05);
      border-bottom: 1px solid rgba(255,255,255,0.05);
      background: rgba(30,41,59,0.35);
    }
    .trust-bar-inner {
      max-width: 900px; margin: 0 auto;
      display: flex; align-items: center; justify-content: center;
      gap: 40px; flex-wrap: wrap;
    }
    .trust-item {
      display: flex; align-items: center; gap: 8px;
      font-size: 13px; color: var(--slate); font-weight: 500;
    }
    .trust-item span { font-size: 16px; }

    /* ---- SECTION COMMON ---- */
    section { padding: 96px 24px; }
    .section-inner { max-width: 1100px; margin: 0 auto; }
    .section-tag {
      display: inline-block; background: rgba(249,115,22,0.12); color: var(--orange);
      border-radius: 999px; font-size: 12px; font-weight: 700;
      padding: 4px 14px; letter-spacing: 0.07em; text-transform: uppercase; margin-bottom: 16px;
    }
    .section-title { font-size: clamp(1.9rem, 4vw, 2.8rem); font-weight: 800; letter-spacing: -0.025em; margin-bottom: 14px; line-height: 1.2; }
    .section-sub { font-size: 1.05rem; color: var(--slate); max-width: 520px; line-height: 1.75; }

    /* ---- HOW IT WORKS ---- */
    .how { background: rgba(20,30,48,0.6); }
    .how-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 2px; margin-top: 56px; background: rgba(255,255,255,0.05); border-radius: 20px; overflow: hidden; }
    .how-step {
      background: var(--navy-card); padding: 36px 32px;
      position: relative; transition: background 0.2s;
    }
    .how-step:hover { background: #243044; }
    .step-num {
      width: 42px; height: 42px; border-radius: 12px;
      background: rgba(249,115,22,0.15); border: 1px solid rgba(249,115,22,0.3);
      display: flex; align-items: center; justify-content: center;
      font-size: 17px; font-weight: 800; color: var(--orange); margin-bottom: 20px;
    }
    .how-step h3 { font-size: 1.05rem; font-weight: 700; margin-bottom: 10px; }
    .how-step p { font-size: 0.92rem; color: var(--slate); line-height: 1.7; }

    /* ---- FEATURES ---- */
    .features-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-top: 56px; }
    .feature-card {
      background: var(--navy-card); border-radius: 16px; padding: 28px 28px 32px;
      border: 1px solid rgba(255,255,255,0.06); transition: border-color 0.25s, transform 0.25s, box-shadow 0.25s;
    }
    .feature-card:hover { border-color: rgba(249,115,22,0.35); transform: translateY(-3px); box-shadow: 0 12px 32px rgba(0,0,0,0.3); }
    .feature-icon {
      width: 50px; height: 50px; border-radius: 13px;
      background: rgba(249,115,22,0.12); display: flex; align-items: center; justify-content: center;
      margin-bottom: 18px; font-size: 23px;
    }
    .feature-card h3 { font-size: 1.02rem; font-weight: 700; margin-bottom: 8px; }
    .feature-card p { font-size: 0.91rem; color: var(--slate); line-height: 1.7; }

    /* ---- ROLES ---- */
    .roles-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 56px; }
    @media (max-width: 640px) { .roles-grid { grid-template-columns: 1fr; } }
    .role-card {
      border-radius: 20px; padding: 40px 36px; border: 1px solid rgba(255,255,255,0.08);
      position: relative; overflow: hidden; transition: transform 0.25s;
    }
    .role-card:hover { transform: translateY(-3px); }
    .role-card.sender { background: linear-gradient(140deg, rgba(249,115,22,0.14) 0%, rgba(249,115,22,0.03) 100%); }
    .role-card.carrier { background: linear-gradient(140deg, rgba(99,102,241,0.14) 0%, rgba(99,102,241,0.03) 100%); }
    .role-emoji { font-size: 2.6rem; margin-bottom: 16px; }
    .role-card h3 { font-size: 1.35rem; font-weight: 800; margin-bottom: 10px; }
    .role-card p { font-size: 0.95rem; color: var(--slate); line-height: 1.75; margin-bottom: 24px; }
    .role-list { list-style: none; display: flex; flex-direction: column; gap: 9px; margin-bottom: 30px; }
    .role-list li { font-size: 0.9rem; color: var(--slate-light); display: flex; align-items: flex-start; gap: 9px; }
    .role-list li::before { content: '\u2713'; color: var(--orange); font-weight: 800; flex-shrink: 0; margin-top: 1px; }
    .role-btn {
      display: inline-block; text-decoration: none; border-radius: 10px;
      padding: 12px 24px; font-weight: 700; font-size: 14px; transition: all 0.2s;
    }
    .role-btn.orange { background: var(--orange); color: #fff; box-shadow: 0 4px 14px rgba(249,115,22,0.3); }
    .role-btn.orange:hover { background: var(--orange-dark); transform: translateY(-1px); }
    .role-btn.indigo { background: rgba(99,102,241,0.2); color: #a5b4fc; border: 1px solid rgba(99,102,241,0.3); }
    .role-btn.indigo:hover { background: rgba(99,102,241,0.35); }

    /* ---- TESTIMONIALS ---- */
    .testimonials { background: rgba(20,30,48,0.5); }
    .testimonials-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-top: 56px; }
    .tcard {
      background: var(--navy-card); border-radius: 16px; padding: 28px;
      border: 1px solid rgba(255,255,255,0.06);
      display: flex; flex-direction: column; gap: 16px;
    }
    .tcard-stars { color: #FBBF24; font-size: 14px; letter-spacing: 2px; }
    .tcard-quote { font-size: 0.96rem; color: var(--slate-light); line-height: 1.75; font-style: italic; }
    .tcard-author { display: flex; align-items: center; gap: 12px; margin-top: auto; }
    .tcard-avatar {
      width: 40px; height: 40px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 17px; font-weight: 700; color: #fff; flex-shrink: 0;
    }
    .tcard-name { font-size: 14px; font-weight: 700; }
    .tcard-role { font-size: 12px; color: var(--slate); margin-top: 2px; }

    /* ---- CTA BANNER ---- */
    .cta-section { padding-top: 0; padding-bottom: 96px; }
    .cta-banner {
      background: linear-gradient(140deg, rgba(249,115,22,0.18) 0%, rgba(99,102,241,0.1) 100%);
      border: 1px solid rgba(249,115,22,0.22); border-radius: 24px;
      padding: 72px 56px; text-align: center;
      position: relative; overflow: hidden;
    }
    .cta-banner::before {
      content: '';
      position: absolute; inset: 0;
      background: radial-gradient(ellipse 60% 80% at 50% 100%, rgba(249,115,22,0.12) 0%, transparent 70%);
    }
    .cta-banner > * { position: relative; z-index: 1; }
    .cta-banner h2 { font-size: clamp(2rem, 5vw, 3rem); font-weight: 800; margin-bottom: 14px; letter-spacing: -0.02em; }
    .cta-banner p { color: var(--slate); font-size: 1.08rem; margin-bottom: 40px; max-width: 460px; margin-left: auto; margin-right: auto; line-height: 1.75; }
    @media (max-width: 600px) { .cta-banner { padding: 48px 24px; } }

    /* ---- FOOTER ---- */
    footer { border-top: 1px solid rgba(255,255,255,0.07); padding: 48px 24px; }
    .footer-inner { max-width: 1100px; margin: 0 auto; display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 32px; }
    .footer-brand { display: flex; flex-direction: column; gap: 10px; }
    .footer-logo { display: flex; align-items: center; gap: 9px; font-size: 16px; font-weight: 700; color: var(--white); text-decoration: none; }
    .footer-logo-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--green); }
    .footer-tagline { font-size: 13px; color: var(--slate); max-width: 220px; line-height: 1.6; }
    .footer-col h4 { font-size: 12px; font-weight: 700; color: var(--slate); text-transform: uppercase; letter-spacing: 0.07em; margin-bottom: 14px; }
    .footer-col-links { display: flex; flex-direction: column; gap: 10px; }
    .footer-col-links a { font-size: 14px; color: var(--slate); text-decoration: none; transition: color 0.2s; }
    .footer-col-links a:hover { color: var(--white); }
    .footer-bottom { max-width: 1100px; margin: 32px auto 0; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
    .footer-copy { font-size: 12px; color: #475569; }
    .api-status { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--slate); }
    .api-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--green); animation: blink 2s infinite; }

    /* ---- SCROLL ANIMATION ---- */
    .reveal {
      opacity: 0;
      transform: translateY(28px);
      transition: opacity 0.6s ease, transform 0.6s ease;
    }
    .reveal.visible {
      opacity: 1;
      transform: translateY(0);
    }
    .reveal-delay-1 { transition-delay: 0.1s; }
    .reveal-delay-2 { transition-delay: 0.2s; }
    .reveal-delay-3 { transition-delay: 0.3s; }
    .reveal-delay-4 { transition-delay: 0.4s; }
    .reveal-delay-5 { transition-delay: 0.5s; }
  </style>
</head>
<body>

  <!-- NAV -->
  <nav id="navbar">
    <a href="/" class="nav-logo">
      <div class="nav-logo-icon">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zm-.5 1.5 1.96 2.5H17V9.5h2.5zM6 18c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm13.5-1c0 .55-.45 1-1 1s-1-.45-1-1 .45-1 1-1 1 .45 1 1z"/></svg>
      </div>
      <span class="nav-logo-text">The GTW</span>
    </a>
    <div class="nav-links">
      <a href="#how">How it works</a>
      <a href="#features">Features</a>
      <a href="#for-you">For you</a>
    </div>
    <div class="nav-right">
      <a href="/app" class="nav-signin">Sign in</a>
      <a href="/app" class="nav-cta">Get Started</a>
    </div>
  </nav>

  <!-- HERO -->
  <section class="hero">
    <div class="hero-grid"></div>
    <div class="hero-inner">
      <div class="hero-badge"><span class="hero-badge-dot"></span> Now Live &mdash; Join the network</div>
      <h1>Send Parcels.<br><span class="accent">Earn on Every Trip.</span></h1>
      <p class="hero-sub">The GTW connects people who need to send parcels with travelers already going their way. No couriers, no middlemen \u2014 just a smarter, faster, peer-to-peer network.</p>
      <div class="hero-btns">
        <a href="/app" class="btn-primary">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M13 3L4 14h7v7l9-11h-7z"/></svg>
          Get Started Free
        </a>
        <a href="/dashboard" class="btn-ghost">
          Provider Dashboard
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>
        </a>
      </div>
      <div class="hero-stats">
        <div class="stat-item">
          <div class="stat-num" data-count="4800" data-suffix="+">0</div>
          <div class="stat-label">Deliveries Made</div>
        </div>
        <div class="stat-item">
          <div class="stat-num" data-count="98" data-suffix="%">0</div>
          <div class="stat-label">On-Time Rate</div>
        </div>
        <div class="stat-item">
          <div class="stat-num" data-count="1200" data-suffix="+">0</div>
          <div class="stat-label">Active Carriers</div>
        </div>
        <div class="stat-item">
          <div class="stat-num" data-count="4" data-suffix=".9\u2605">0</div>
          <div class="stat-label">Average Rating</div>
        </div>
      </div>
    </div>
  </section>

  <!-- TRUST BAR -->
  <div class="trust-bar">
    <div class="trust-bar-inner">
      <div class="trust-item"><span>\u{1F512}</span> End-to-end secure payments</div>
      <div class="trust-item"><span>\u2705</span> ID-verified carriers</div>
      <div class="trust-item"><span>\u{1F4CD}</span> Real-time GPS tracking</div>
      <div class="trust-item"><span>\u{1F4AC}</span> 24/7 in-app support</div>
      <div class="trust-item"><span>\u{1F6E1}\uFE0F</span> Parcel insurance available</div>
    </div>
  </div>

  <!-- HOW IT WORKS -->
  <section class="how" id="how">
    <div class="section-inner">
      <div class="section-tag reveal">How it works</div>
      <h2 class="section-title reveal reveal-delay-1">Simple from start to finish</h2>
      <p class="section-sub reveal reveal-delay-2">Whether you're sending a package or picking up extra income on your commute, The GTW makes it effortless.</p>
      <div class="how-grid">
        <div class="how-step reveal reveal-delay-1">
          <div class="step-num">1</div>
          <h3>Post Your Parcel or Route</h3>
          <p>Senders list what they need delivered and where. Carriers post their upcoming trips and available capacity.</p>
        </div>
        <div class="how-step reveal reveal-delay-2">
          <div class="step-num">2</div>
          <h3>Get Matched Instantly</h3>
          <p>Our platform surfaces the best matches between senders and carriers traveling the same route \u2014 no waiting around.</p>
        </div>
        <div class="how-step reveal reveal-delay-3">
          <div class="step-num">3</div>
          <h3>Track &amp; Deliver</h3>
          <p>Senders get real-time updates. Carriers handle pickup and drop-off. Everyone is kept in the loop the whole way.</p>
        </div>
        <div class="how-step reveal reveal-delay-4">
          <div class="step-num">4</div>
          <h3>Rate &amp; Get Paid</h3>
          <p>Payments are released on confirmed delivery. Carriers earn on every trip. Senders rate their experience.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- FEATURES -->
  <section id="features">
    <div class="section-inner">
      <div class="section-tag reveal">Features</div>
      <h2 class="section-title reveal reveal-delay-1">Everything you need, nothing you don't</h2>
      <p class="section-sub reveal reveal-delay-2">Built for reliability and trust \u2014 from the first message to the final delivery.</p>
      <div class="features-grid">
        <div class="feature-card reveal reveal-delay-1">
          <div class="feature-icon">\u{1F4CD}</div>
          <h3>Live Route Matching</h3>
          <p>Parcels and carriers are matched by route overlap in real time, so you always find the fastest option available.</p>
        </div>
        <div class="feature-card reveal reveal-delay-2">
          <div class="feature-icon">\u{1F512}</div>
          <h3>Verified Carriers</h3>
          <p>Every carrier goes through an identity verification process. Trust is built into the platform from day one.</p>
        </div>
        <div class="feature-card reveal reveal-delay-3">
          <div class="feature-icon">\u{1F4AC}</div>
          <h3>In-App Messaging</h3>
          <p>Senders and carriers communicate directly through the app \u2014 no need to share personal contact details.</p>
        </div>
        <div class="feature-card reveal reveal-delay-1">
          <div class="feature-icon">\u{1F4B3}</div>
          <h3>Secure Payments</h3>
          <p>Funds are held safely and only released once delivery is confirmed. No cash, no hassle, no risk.</p>
        </div>
        <div class="feature-card reveal reveal-delay-2">
          <div class="feature-icon">\u2B50</div>
          <h3>Reviews &amp; Ratings</h3>
          <p>A two-way rating system keeps the community accountable and helps you choose the best partners every time.</p>
        </div>
        <div class="feature-card reveal reveal-delay-3">
          <div class="feature-icon">\u{1F30D}</div>
          <h3>Any Route, Any Distance</h3>
          <p>Local neighborhood deliveries or cross-country hauls \u2014 The GTW works across any distance and any route.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- FOR SENDERS & CARRIERS -->
  <section id="for-you" style="padding-top: 0;">
    <div class="section-inner">
      <div class="section-tag reveal">Who it's for</div>
      <h2 class="section-title reveal reveal-delay-1">Two sides of the same network</h2>
      <p class="section-sub reveal reveal-delay-2">The GTW works for anyone who needs something moved \u2014 and anyone willing to move it.</p>
      <div class="roles-grid">
        <div class="role-card sender reveal reveal-delay-1">
          <div class="role-emoji">\u{1F4E6}</div>
          <h3>For Senders</h3>
          <p>Need to get a package somewhere? Let a trusted traveler carry it along their existing route \u2014 faster and cheaper than traditional shipping.</p>
          <ul class="role-list">
            <li>Post any size parcel in under 2 minutes</li>
            <li>Compare carriers by price, rating, and ETA</li>
            <li>Real-time delivery tracking</li>
            <li>Secure payment \u2014 only pay on delivery</li>
          </ul>
          <a href="/app" class="role-btn orange">Send a Parcel &rarr;</a>
        </div>
        <div class="role-card carrier reveal reveal-delay-2">
          <div class="role-emoji">\u{1F697}</div>
          <h3>For Carriers</h3>
          <p>Already making a trip? Pick up a parcel along the way and earn extra income without changing your plans.</p>
          <ul class="role-list">
            <li>Set your own route and availability</li>
            <li>Accept parcels that fit your schedule</li>
            <li>Earn on every delivery you complete</li>
            <li>Build your reputation with reviews</li>
          </ul>
          <a href="/app" class="role-btn indigo">Start Carrying &rarr;</a>
        </div>
      </div>
    </div>
  </section>

  <!-- TESTIMONIALS -->
  <section class="testimonials">
    <div class="section-inner">
      <div class="section-tag reveal">Testimonials</div>
      <h2 class="section-title reveal reveal-delay-1">Loved by senders &amp; carriers</h2>
      <p class="section-sub reveal reveal-delay-2">Real people, real deliveries, real results.</p>
      <div class="testimonials-grid">
        <div class="tcard reveal reveal-delay-1">
          <div class="tcard-stars">\u2605\u2605\u2605\u2605\u2605</div>
          <p class="tcard-quote">"I needed to send a gift to my sister in another city and The GTW matched me with a carrier within the hour. It arrived the same day \u2014 cheaper than any courier I've used."</p>
          <div class="tcard-author">
            <div class="tcard-avatar" style="background: linear-gradient(135deg,#F97316,#EA580C);">A</div>
            <div>
              <div class="tcard-name">Amara K.</div>
              <div class="tcard-role">Sender &mdash; Lagos</div>
            </div>
          </div>
        </div>
        <div class="tcard reveal reveal-delay-2">
          <div class="tcard-stars">\u2605\u2605\u2605\u2605\u2605</div>
          <p class="tcard-quote">"I drive the same route to work every day. Now I pick up a parcel or two on the way and earn an extra few thousand naira a week. It's genuinely passive income."</p>
          <div class="tcard-author">
            <div class="tcard-avatar" style="background: linear-gradient(135deg,#6366f1,#4f46e5);">D</div>
            <div>
              <div class="tcard-name">David O.</div>
              <div class="tcard-role">Carrier &mdash; Abuja</div>
            </div>
          </div>
        </div>
        <div class="tcard reveal reveal-delay-3">
          <div class="tcard-stars">\u2605\u2605\u2605\u2605\u2605</div>
          <p class="tcard-quote">"The tracking feature is brilliant. I could follow my parcel the entire way and the carrier kept me updated. This is the future of local delivery, no question."</p>
          <div class="tcard-author">
            <div class="tcard-avatar" style="background: linear-gradient(135deg,#22c55e,#16a34a);">F</div>
            <div>
              <div class="tcard-name">Fatima B.</div>
              <div class="tcard-role">Sender &mdash; Kano</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- CTA BANNER -->
  <section class="cta-section">
    <div class="section-inner">
      <div class="cta-banner reveal">
        <h2>Ready to join the network?</h2>
        <p>Sign up in minutes and start sending or carrying parcels across any route today. It's free to get started.</p>
        <div style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap;">
          <a href="/app" class="btn-primary">Create Free Account</a>
          <a href="/dashboard" class="btn-ghost">Provider Dashboard</a>
        </div>
      </div>
    </div>
  </section>

  <!-- FOOTER -->
  <footer>
    <div class="footer-inner">
      <div class="footer-brand">
        <a href="/" class="footer-logo">
          <span class="footer-logo-dot"></span>
          The GTW
        </a>
        <p class="footer-tagline">Peer-to-peer parcel delivery across any route, powered by community.</p>
      </div>
      <div class="footer-col">
        <h4>Platform</h4>
        <div class="footer-col-links">
          <a href="/app">Web App</a>
          <a href="/dashboard">Provider Dashboard</a>
          <a href="/app">Sign Up</a>
          <a href="/app">Sign In</a>
        </div>
      </div>
      <div class="footer-col">
        <h4>Resources</h4>
        <div class="footer-col-links">
          <a href="#how">How it Works</a>
          <a href="#features">Features</a>
          <a href="#for-you">For Carriers</a>
          <a href="/api/health">API Status</a>
        </div>
      </div>
    </div>
    <div class="footer-bottom">
      <p class="footer-copy">&copy; 2024 The GTW &mdash; ParcelPeer. All rights reserved.</p>
      <div class="api-status"><span class="api-dot"></span> All systems operational</div>
    </div>
  </footer>

  <script>
    // Nav scroll effect
    const navbar = document.getElementById('navbar');
    window.addEventListener('scroll', () => {
      navbar.classList.toggle('scrolled', window.scrollY > 40);
    }, { passive: true });

    // Scroll reveal
    const reveals = document.querySelectorAll('.reveal');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } });
    }, { threshold: 0.12 });
    reveals.forEach(el => observer.observe(el));

    // Animated counters
    function animateCount(el) {
      const target = parseInt(el.dataset.count);
      const suffix = el.dataset.suffix || '';
      const duration = 1800;
      const step = target / (duration / 16);
      let current = 0;
      const timer = setInterval(() => {
        current = Math.min(current + step, target);
        el.textContent = (current >= target ? target : Math.floor(current)).toLocaleString() + suffix;
        if (current >= target) clearInterval(timer);
      }, 16);
    }
    const statEls = document.querySelectorAll('[data-count]');
    const statObserver = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { animateCount(e.target); statObserver.unobserve(e.target); } });
    }, { threshold: 0.5 });
    statEls.forEach(el => statObserver.observe(el));
  </script>

</body>
</html>`);
  });
  log("\u2713 Landing page served at /");
}
function configureWebApp(app2) {
  const webDir = path4.resolve(process.cwd(), "static", "web");
  app2.use("/app", express.static(webDir, { index: "index.html" }));
  app2.use(/^\/app(\/.*)?$/, (_req, res) => {
    res.sendFile(path4.join(webDir, "index.html"));
  });
  log("\u2713 Web app served at /app");
}
function configureDashboard(app2) {
  const dashboardDir = path4.resolve(process.cwd(), "static", "dashboard");
  app2.use("/dashboard", express.static(dashboardDir));
  app2.get(/^\/dashboard(\/.*)?$/, (_req, res) => {
    res.sendFile(path4.join(dashboardDir, "index.html"));
  });
  log("\u2713 Provider dashboard served at /dashboard");
}
function configureViteDev(app2) {
  log("Proxying web requests to Vite dev server on port 3000");
  app2.get("/", (_req, res) => res.redirect("/app/"));
  app2.use(
    createProxyMiddleware({
      target: "http://localhost:3000",
      changeOrigin: true,
      ws: true,
      pathFilter: (path5) => !path5.startsWith("/api"),
      on: {
        error: (_err, _req, res) => {
          res.status(502).send(
            "<html><body style='font-family:sans-serif;padding:40px'><h2>Web dev server starting...</h2><p>Vite is warming up. Please refresh in a moment.</p><script>setTimeout(()=>location.reload(),3000)</script></body></html>"
          );
        }
      }
    })
  );
  log("\u2713 Web app proxied at / (API requests pass through to Node.js)");
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
  setupPhotoStorage(app);
  setupRequestLogging(app);
  if (process.env.NODE_ENV === "production") {
    configureProductionLanding(app);
    configureWebApp(app);
    configureDashboard(app);
  } else {
    configureViteDev(app);
  }
  const server = await registerRoutes(app);
  registerAdminRoutes(app);
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
