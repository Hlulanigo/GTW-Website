import { eq, or, and, desc, avg } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  type User, type InsertUser, users,
  type Parcel, type InsertParcel, parcels,
  type Conversation, type InsertConversation, conversations,
  type Message, type InsertMessage, messages,
  type Connection, type InsertConnection, connections,
  type Route, type InsertRoute, routes,
  type RouteBooking, type InsertRouteBooking, routeBookings,
  type Review, type InsertReview, reviews,
  type PushToken, type InsertPushToken, pushTokens,
  type Payment, type InsertPayment, payments,
  type BlockedUser, blockedUsers,
  type SavedPaymentMethod, type InsertSavedPaymentMethod, savedPaymentMethods,
  type AutoTopUpSettings, type InsertAutoTopUpSettings, autoTopUpSettings,
  subscriptions, walletTransactions,
} from "../shared/schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Guard against unhandled pool errors (e.g., when Postgres isn't available) so the server
// can continue running in development when the database is not present.
pool.on("error", (err) => {
  console.error("Postgres pool error (non-fatal):", err);
});

export const db = drizzle(pool);

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser & { id?: string }): Promise<User>;
  getAllParcels(): Promise<Parcel[]>;
  getParcel(id: string): Promise<Parcel | undefined>;
  getParcelWithSender(id: string): Promise<(Parcel & { sender: User }) | undefined>;
  createParcel(parcel: InsertParcel): Promise<Parcel>;
  updateParcel(id: string, updates: Partial<Parcel>): Promise<Parcel | undefined>;
  getUserConversations(userId: string): Promise<Conversation[]>;
  getConversation(id: string): Promise<Conversation | undefined>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  getConversationMessages(conversationId: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0];
  }

  async createUser(insertUser: InsertUser & { id?: string }): Promise<User> {
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async getAllParcels(): Promise<Parcel[]> {
    return await db.select().from(parcels).orderBy(desc(parcels.createdAt));
  }

  async getParcel(id: string): Promise<Parcel | undefined> {
    const result = await db.select().from(parcels).where(eq(parcels.id, id));
    return result[0];
  }

  async getParcelWithSender(id: string): Promise<(Parcel & { sender: User }) | undefined> {
    const result = await db
      .select()
      .from(parcels)
      .innerJoin(users, eq(parcels.senderId, users.id))
      .where(eq(parcels.id, id));
    if (result[0]) {
      return { ...result[0].parcels, sender: result[0].users };
    }
    return undefined;
  }

  async createParcel(insertParcel: InsertParcel): Promise<Parcel> {
    const user = await this.getUser(insertParcel.senderId);
    if (!user) throw new Error("User not found");

    // walletBalance is stored in smallest currency unit (kobo/cents)
    // compensation is stored in major units (e.g. 50 = R50), so convert for comparison
    const compensationInKobo = Math.round(insertParcel.compensation * 100);

    // Enforce balance check for free plan users
    if (user.subscriptionStatus === "free" && user.walletBalance < compensationInKobo) {
      throw new Error("Insufficient wallet balance");
    }

    // Deduct from wallet for free plan users and mark parcel as paid immediately
    let walletPaid = false;
    if (user.subscriptionStatus === "free" && user.walletBalance >= compensationInKobo) {
      const balanceBefore = user.walletBalance;
      const balanceAfter = balanceBefore - compensationInKobo;
      await db.update(users)
        .set({ walletBalance: balanceAfter })
        .where(eq(users.id, user.id));
      await db.insert(walletTransactions).values({
        userId: user.id,
        type: "debit",
        amount: compensationInKobo,
        currency: "ZAR",
        status: "completed",
        reference: `parcel-debit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        description: `Parcel delivery: ${insertParcel.origin} → ${insertParcel.destination}`,
        balanceBefore,
        balanceAfter,
        completedAt: new Date(),
      });
      walletPaid = true;
    }

    // If wallet was used, mark parcel as Paid so the user isn't prompted to pay again
    const parcelToInsert = walletPaid
      ? { ...insertParcel, status: "Paid" as const }
      : insertParcel;

    const result = await db.insert(parcels).values(parcelToInsert).returning();
    return result[0];
  }

  async updateParcel(id: string, updates: Partial<Parcel>): Promise<Parcel | undefined> {
    const result = await db.update(parcels).set(updates).where(eq(parcels.id, id)).returning();
    return result[0];
  }

  async getUserConversations(userId: string): Promise<Conversation[]> {
    return await db
      .select()
      .from(conversations)
      .where(
        or(
          eq(conversations.participant1Id, userId),
          eq(conversations.participant2Id, userId)
        )
      )
      .orderBy(desc(conversations.createdAt));
  }

  // Blocked users
  async getBlockedUsers(userId: string): Promise<User[]> {
    const result = await db
      .select()
      .from(blockedUsers)
      .innerJoin(users, eq(blockedUsers.blockedUserId, users.id))
      .where(eq(blockedUsers.userId, userId))
      .orderBy(desc(blockedUsers.createdAt));
    return result.map(r => r.users);
  }

  async blockUser(userId: string, blockedUserId: string): Promise<boolean> {
    const existing = await db
      .select()
      .from(blockedUsers)
      .where(and(eq(blockedUsers.userId, userId), eq(blockedUsers.blockedUserId, blockedUserId)));
    if (existing.length) return false;
    const result = await db.insert(blockedUsers).values({ userId, blockedUserId }).returning();
    return result.length > 0;
  }

  async unblockUser(userId: string, blockedUserId: string): Promise<boolean> {
    const result = await db
      .delete(blockedUsers)
      .where(and(eq(blockedUsers.userId, userId), eq(blockedUsers.blockedUserId, blockedUserId)))
      .returning();
    return result.length > 0;
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    const result = await db.select().from(conversations).where(eq(conversations.id, id));
    return result[0];
  }

  async createConversation(insertConversation: InsertConversation): Promise<Conversation> {
    const result = await db.insert(conversations).values(insertConversation).returning();
    return result[0];
  }

  async getConversationMessages(conversationId: string): Promise<Message[]> {
    return await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt);
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const result = await db.insert(messages).values(insertMessage).returning();
    return result[0];
  }

  async deleteParcel(id: string): Promise<boolean> {
    const result = await db.delete(parcels).where(eq(parcels.id, id)).returning();
    return result.length > 0;
  }

  async deleteMessage(id: string): Promise<boolean> {
    const result = await db.delete(messages).where(eq(messages.id, id)).returning();
    return result.length > 0;
  }

  async getUserConnections(userId: string): Promise<(Connection & { connectedUser: User })[]> {
    const result = await db
      .select()
      .from(connections)
      .innerJoin(users, eq(connections.connectedUserId, users.id))
      .where(eq(connections.userId, userId))
      .orderBy(desc(connections.createdAt));
    return result.map(r => ({ ...r.connections, connectedUser: r.users }));
  }

  async getConnection(userId: string, connectedUserId: string): Promise<Connection | undefined> {
    const result = await db
      .select()
      .from(connections)
      .where(and(eq(connections.userId, userId), eq(connections.connectedUserId, connectedUserId)));
    return result[0];
  }

  async createConnection(insertConnection: InsertConnection): Promise<Connection> {
    const result = await db.insert(connections).values(insertConnection).returning();
    return result[0];
  }

  async deleteConnection(userId: string, connectedUserId: string): Promise<boolean> {
    const result = await db
      .delete(connections)
      .where(and(eq(connections.userId, userId), eq(connections.connectedUserId, connectedUserId)))
      .returning();
    return result.length > 0;
  }

  async getRoute(id: string): Promise<Route | undefined> {
    const result = await db.select().from(routes).where(eq(routes.id, id));
    return result[0];
  }

  async getRouteWithCarrier(id: string): Promise<(Route & { carrier: User }) | undefined> {
    const result = await db
      .select()
      .from(routes)
      .innerJoin(users, eq(routes.carrierId, users.id))
      .where(eq(routes.id, id));
    if (result[0]) {
      return { ...result[0].routes, carrier: result[0].users };
    }
    return undefined;
  }

  async getUserRoutes(userId: string): Promise<Route[]> {
    return await db
      .select()
      .from(routes)
      .where(eq(routes.carrierId, userId))
      .orderBy(desc(routes.departureDate));
  }

  async getAllActiveRoutes(): Promise<Route[]> {
    return await db
      .select()
      .from(routes)
      .where(eq(routes.status, "Active"))
      .orderBy(desc(routes.departureDate));
  }

  async createRoute(insertRoute: InsertRoute): Promise<Route> {
    const result = await db.insert(routes).values(insertRoute).returning();
    return result[0];
  }

  async updateRoute(id: string, updates: Partial<Route>): Promise<Route | undefined> {
    const result = await db
      .update(routes)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(routes.id, id))
      .returning();
    return result[0];
  }

  async deleteRoute(id: string): Promise<boolean> {
    const result = await db.delete(routes).where(eq(routes.id, id)).returning();
    return result.length > 0;
  }

  async createRouteBooking(insert: InsertRouteBooking & { senderId: string; carrierId: string }): Promise<RouteBooking> {
    const result = await db.insert(routeBookings).values(insert).returning();
    return result[0];
  }

  async getRouteBooking(id: string): Promise<RouteBooking | undefined> {
    const result = await db.select().from(routeBookings).where(eq(routeBookings.id, id));
    return result[0];
  }

  async getBookingsForRoute(routeId: string): Promise<(RouteBooking & { parcel: Parcel; sender: User })[]> {
    const result = await db
      .select()
      .from(routeBookings)
      .innerJoin(parcels, eq(routeBookings.parcelId, parcels.id))
      .innerJoin(users, eq(routeBookings.senderId, users.id))
      .where(eq(routeBookings.routeId, routeId))
      .orderBy(desc(routeBookings.createdAt));
    return result.map((r: any) => ({ ...r.route_bookings, parcel: r.parcels, sender: r.users }));
  }

  async getIncomingBookingsForCarrier(carrierId: string): Promise<(RouteBooking & { parcel: Parcel; sender: User; route: Route })[]> {
    const result = await db
      .select()
      .from(routeBookings)
      .innerJoin(parcels, eq(routeBookings.parcelId, parcels.id))
      .innerJoin(users, eq(routeBookings.senderId, users.id))
      .innerJoin(routes, eq(routeBookings.routeId, routes.id))
      .where(eq(routeBookings.carrierId, carrierId))
      .orderBy(desc(routeBookings.createdAt));
    return result.map((r: any) => ({ ...r.route_bookings, parcel: r.parcels, sender: r.users, route: r.routes }));
  }

  async getOutgoingBookingsForSender(senderId: string): Promise<(RouteBooking & { route: Route; carrier: User })[]> {
    const result = await db
      .select()
      .from(routeBookings)
      .innerJoin(routes, eq(routeBookings.routeId, routes.id))
      .innerJoin(users, eq(routeBookings.carrierId, users.id))
      .where(eq(routeBookings.senderId, senderId))
      .orderBy(desc(routeBookings.createdAt));
    return result.map((r: any) => ({ ...r.route_bookings, route: r.routes, carrier: r.users }));
  }

  async getPendingBookingForParcel(parcelId: string): Promise<RouteBooking | undefined> {
    const result = await db
      .select()
      .from(routeBookings)
      .where(and(eq(routeBookings.parcelId, parcelId), eq(routeBookings.status, "Pending")));
    return result[0];
  }

  async updateRouteBooking(id: string, updates: Partial<RouteBooking>): Promise<RouteBooking | undefined> {
    const result = await db
      .update(routeBookings)
      .set(updates)
      .where(eq(routeBookings.id, id))
      .returning();
    return result[0];
  }

  async getUserReviews(userId: string): Promise<(Review & { reviewer: User })[]> {
    const result = await db
      .select()
      .from(reviews)
      .innerJoin(users, eq(reviews.reviewerId, users.id))
      .where(eq(reviews.revieweeId, userId))
      .orderBy(desc(reviews.createdAt));
    return result.map(r => ({ ...r.reviews, reviewer: r.users }));
  }

  async getReviewByParcelAndReviewer(parcelId: string, reviewerId: string): Promise<Review | undefined> {
    const result = await db
      .select()
      .from(reviews)
      .where(and(eq(reviews.parcelId, parcelId), eq(reviews.reviewerId, reviewerId)));
    return result[0];
  }

  async createReview(insertReview: InsertReview): Promise<Review> {
    const result = await db.insert(reviews).values(insertReview).returning();
    
    const avgResult = await db
      .select({ avgRating: avg(reviews.rating) })
      .from(reviews)
      .where(eq(reviews.revieweeId, insertReview.revieweeId));
    
    if (avgResult[0]?.avgRating) {
      await db
        .update(users)
        .set({ rating: parseFloat(avgResult[0].avgRating) })
        .where(eq(users.id, insertReview.revieweeId));
    }
    
    return result[0];
  }

  async getUserPushTokens(userId: string): Promise<PushToken[]> {
    return await db
      .select()
      .from(pushTokens)
      .where(eq(pushTokens.userId, userId));
  }

  async getPushTokenByToken(token: string): Promise<PushToken | undefined> {
    const result = await db
      .select()
      .from(pushTokens)
      .where(eq(pushTokens.token, token));
    return result[0];
  }

  async createOrUpdatePushToken(insertPushToken: InsertPushToken): Promise<PushToken> {
    const existing = await this.getPushTokenByToken(insertPushToken.token);
    if (existing) {
      const result = await db
        .update(pushTokens)
        .set({ userId: insertPushToken.userId, updatedAt: new Date() })
        .where(eq(pushTokens.token, insertPushToken.token))
        .returning();
      return result[0];
    }
    const result = await db.insert(pushTokens).values(insertPushToken).returning();
    return result[0];
  }

  async deletePushToken(token: string): Promise<boolean> {
    const result = await db.delete(pushTokens).where(eq(pushTokens.token, token)).returning();
    return result.length > 0;
  }

  async createPayment(insertPayment: InsertPayment): Promise<Payment> {
    const result = await db.insert(payments).values(insertPayment).returning();
    return result[0];
  }

  async getPaymentByReference(reference: string): Promise<Payment | undefined> {
    const result = await db.select().from(payments).where(eq(payments.reference, reference));
    return result[0];
  }

  async updatePayment(id: string, updates: Partial<Payment>): Promise<Payment | undefined> {
    const result = await db.update(payments).set({ ...updates, updatedAt: new Date() }).where(eq(payments.id, id)).returning();
    return result[0];
  }

  async getPaymentsByUserId(userId: string): Promise<Payment[]> {
    return await db.select().from(payments).where(eq(payments.userId, userId)).orderBy(desc(payments.createdAt));
  }

  // Saved Payment Methods
  async createSavedPaymentMethod(userId: string, cardLast4: string, cardBrand: string, authorizationCode: string): Promise<SavedPaymentMethod> {
    const result = await db
      .insert(savedPaymentMethods)
      .values({
        userId,
        cardLast4,
        cardBrand,
        authorizationCode,
        isDefault: false,
      })
      .returning();
    return result[0];
  }

  async getSavedPaymentMethods(userId: string): Promise<SavedPaymentMethod[]> {
    return await db
      .select()
      .from(savedPaymentMethods)
      .where(eq(savedPaymentMethods.userId, userId))
      .orderBy(desc(savedPaymentMethods.createdAt));
  }

  async setSavedPaymentMethodAsDefault(userId: string, methodId: string): Promise<boolean> {
    // First unset all default methods for this user
    await db
      .update(savedPaymentMethods)
      .set({ isDefault: false })
      .where(eq(savedPaymentMethods.userId, userId));

    // Set the selected method as default
    const result = await db
      .update(savedPaymentMethods)
      .set({ isDefault: true })
      .where(and(eq(savedPaymentMethods.id, methodId), eq(savedPaymentMethods.userId, userId)))
      .returning();
    return result.length > 0;
  }

  async deleteSavedPaymentMethod(methodId: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(savedPaymentMethods)
      .where(and(eq(savedPaymentMethods.id, methodId), eq(savedPaymentMethods.userId, userId)))
      .returning();
    return result.length > 0;
  }

  // Auto Top-up Settings
  async getAutoTopUpSettings(userId: string): Promise<AutoTopUpSettings | undefined> {
    const result = await db
      .select()
      .from(autoTopUpSettings)
      .where(eq(autoTopUpSettings.userId, userId));
    return result[0];
  }

  async updateAutoTopUpSettings(
    userId: string,
    isEnabled: boolean,
    triggerAmount?: number,
    topupAmount?: number,
    paymentMethodId?: string
  ): Promise<AutoTopUpSettings> {
    const existing = await this.getAutoTopUpSettings(userId);
    
    if (existing) {
      const result = await db
        .update(autoTopUpSettings)
        .set({
          isEnabled,
          triggerAmount,
          topupAmount,
          paymentMethodId,
          updatedAt: new Date(),
        })
        .where(eq(autoTopUpSettings.userId, userId))
        .returning();
      return result[0];
    } else {
      const result = await db
        .insert(autoTopUpSettings)
        .values({
          userId,
          isEnabled,
          triggerAmount,
          topupAmount,
          paymentMethodId,
        })
        .returning();
      return result[0];
    }
  }

  // Subscriptions
  async getSubscription(userId: string): Promise<any | undefined> {
    const result = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId));
    return result[0];
  }

  async createSubscription(userId: string, planId: string): Promise<any> {
    const now = new Date();
    const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const result = await db
      .insert(subscriptions)
      .values({
        userId,
        planId: planId as any,
        status: "active",
        currentPeriodStart: now,
        currentPeriodEnd: nextMonth,
      })
      .returning();
    return result[0];
  }

  async updateSubscription(
    userId: string,
    planId?: string,
    status?: string
  ): Promise<any | undefined> {
    const updates: any = { updatedAt: new Date() };
    if (planId) updates.planId = planId;
    if (status) updates.status = status;

    const result = await db
      .update(subscriptions)
      .set(updates)
      .where(eq(subscriptions.userId, userId))
      .returning();
    return result[0];
  }

  async cancelSubscription(userId: string): Promise<any | undefined> {
    const result = await db
      .update(subscriptions)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.userId, userId))
      .returning();
    return result[0];
  }
}

export const storage = new DatabaseStorage();
