import type { Express } from "express";
import { db, storage } from "./storage";
import { users, parcels, routes, payments, reviews, conversations, messages, disputes, disputeMessages, subscriptions, walletTransactions } from "@shared/schema";
import { eq, desc, count, sql, and, gte, lte, ilike, or } from "drizzle-orm";
import { requireAdmin, type AuthenticatedRequest } from "./jwt-middleware";
import logger from "./logger";

export function registerAdminRoutes(app: Express) {
  // Dashboard Statistics
  app.get("/api/admin/stats", requireAdmin, async (req: AuthenticatedRequest, res) => {
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
        totalWalletBalance,
      ] = await Promise.all([
        db.select({ count: count() }).from(users),
        db.select({ count: count() }).from(parcels),
        db.select({ count: count() }).from(routes),
        db.select({ count: count() }).from(payments),
        db.select({ count: count() }).from(parcels).where(eq(parcels.status, "Pending")),
        db.select({ count: count() }).from(routes).where(eq(routes.status, "Active")),
        db
          .select({ sum: sql<number>`COALESCE(SUM(${payments.amount}), 0)` })
          .from(payments)
          .where(eq(payments.status, "success")),
        db.select({ count: count() }).from(users).where(gte(users.createdAt, sql`NOW() - INTERVAL '30 days'`)),
        db.select({ count: count() }).from(disputes),
        db.select({ count: count() }).from(disputes).where(eq(disputes.status, "open")),
        db.select({ count: count() }).from(subscriptions).where(eq(subscriptions.status, "active")),
        db.select({ sum: sql<number>`COALESCE(SUM(${users.walletBalance}), 0)` }).from(users),
      ]);

      const revenue = successfulPayments[0]?.sum || 0;

      // Get parcel status breakdown
      const parcelStatusCounts = await db
        .select({
          status: parcels.status,
          count: count(),
        })
        .from(parcels)
        .groupBy(parcels.status);

      // Get payment status breakdown
      const paymentStatusCounts = await db
        .select({
          status: payments.status,
          count: count(),
        })
        .from(payments)
        .groupBy(payments.status);

      // Get dispute status breakdown
      const disputeStatusCounts = await db
        .select({
          status: disputes.status,
          count: count(),
        })
        .from(disputes)
        .groupBy(disputes.status);

      res.json({
        users: {
          total: totalUsers[0]?.count || 0,
          recent: recentUsers[0]?.count || 0,
        },
        parcels: {
          total: totalParcels[0]?.count || 0,
          pending: pendingParcels[0]?.count || 0,
          statusBreakdown: parcelStatusCounts,
        },
        routes: {
          total: totalRoutes[0]?.count || 0,
          active: activeRoutes[0]?.count || 0,
        },
        payments: {
          total: totalPayments[0]?.count || 0,
          revenue: revenue,
          statusBreakdown: paymentStatusCounts,
        },
        disputes: {
          total: totalDisputes[0]?.count || 0,
          open: openDisputes[0]?.count || 0,
          statusBreakdown: disputeStatusCounts,
        },
        subscriptions: {
          active: activeSubscriptions[0]?.count || 0,
        },
        wallet: {
          totalBalance: totalWalletBalance[0]?.sum || 0,
        },
      });
    } catch (error) {
      logger.error("Failed to fetch admin stats:", error);
      res.status(500).json({ error: "Failed to fetch statistics" });
    }
  });

  // User Management
  app.get("/api/admin/users", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { search, role, verified, suspended, page = "1", limit = "20" } = req.query;
      
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      let query = db.select().from(users);
      const conditions = [];

      if (search) {
        conditions.push(
          or(
            ilike(users.name, `%${search}%`),
            ilike(users.email, `%${search}%`),
            ilike(users.phone, `%${search}%`)
          )
        );
      }

      if (role) {
        conditions.push(eq(users.role, role as any));
      }

      if (verified !== undefined) {
        conditions.push(eq(users.verified, verified === "true"));
      }

      if (suspended !== undefined) {
        conditions.push(eq(users.suspended, suspended === "true"));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      const allUsers = await query
        .orderBy(desc(users.createdAt))
        .limit(limitNum)
        .offset(offset);

      const totalCount = await db.select({ count: count() }).from(users);

      res.json({
        users: allUsers,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount[0]?.count || 0,
          totalPages: Math.ceil((totalCount[0]?.count || 0) / limitNum),
        },
      });
    } catch (error) {
      console.error("Failed to fetch users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.get("/api/admin/users/:id", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Get user statistics
      const [sentParcels, transportedParcels, userRoutes, userReviews] = await Promise.all([
        db.select({ count: count() }).from(parcels).where(eq(parcels.senderId, req.params.id)),
        db.select({ count: count() }).from(parcels).where(eq(parcels.transporterId, req.params.id)),
        db.select({ count: count() }).from(routes).where(eq(routes.carrierId, req.params.id)),
        db.select({ count: count() }).from(reviews).where(eq(reviews.revieweeId, req.params.id)),
      ]);

      res.json({
        ...user,
        stats: {
          sentParcels: sentParcels[0]?.count || 0,
          transportedParcels: transportedParcels[0]?.count || 0,
          routes: userRoutes[0]?.count || 0,
          reviews: userReviews[0]?.count || 0,
        },
      });
    } catch (error) {
      console.error("Failed to fetch user:", error);
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  app.patch("/api/admin/users/:id", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { verified, suspended, role } = req.body;
      const updates: any = {};

      if (verified !== undefined) updates.verified = verified;
      if (suspended !== undefined) updates.suspended = suspended;
      if (role !== undefined) updates.role = role;

      const result = await db.update(users).set(updates).where(eq(users.id, req.params.id)).returning();

      if (!result[0]) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(result[0]);
    } catch (error) {
      console.error("Failed to update user:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  // Parcel Management
  app.get("/api/admin/parcels", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { status, search, page = "1", limit = "20" } = req.query;
      
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      const conditions = [];

      if (status) {
        conditions.push(eq(parcels.status, status as any));
      }

      if (search) {
        conditions.push(
          or(
            ilike(parcels.origin, `%${search}%`),
            ilike(parcels.destination, `%${search}%`),
            ilike(parcels.description, `%${search}%`)
          )
        );
      }

      let query = db
        .select({
          parcel: parcels,
          sender: users,
        })
        .from(parcels)
        .innerJoin(users, eq(parcels.senderId, users.id));

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      const allParcels = await query
        .orderBy(desc(parcels.createdAt))
        .limit(limitNum)
        .offset(offset);

      const totalCount = await db.select({ count: count() }).from(parcels);

      const result = allParcels.map(({ parcel, sender }) => ({
        ...parcel,
        senderName: sender.name,
        senderEmail: sender.email,
      }));

      res.json({
        parcels: result,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount[0]?.count || 0,
          totalPages: Math.ceil((totalCount[0]?.count || 0) / limitNum),
        },
      });
    } catch (error) {
      console.error("Failed to fetch parcels:", error);
      res.status(500).json({ error: "Failed to fetch parcels" });
    }
  });

  app.patch("/api/admin/parcels/:id", requireAdmin, async (req: AuthenticatedRequest, res) => {
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

  app.delete("/api/admin/parcels/:id", requireAdmin, async (req: AuthenticatedRequest, res) => {
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

  // Route Management
  app.get("/api/admin/routes", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { status, search, page = "1", limit = "20" } = req.query;
      
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      const conditions = [];

      if (status) {
        conditions.push(eq(routes.status, status as any));
      }

      if (search) {
        conditions.push(
          or(
            ilike(routes.origin, `%${search}%`),
            ilike(routes.destination, `%${search}%`)
          )
        );
      }

      let query = db
        .select({
          route: routes,
          carrier: users,
        })
        .from(routes)
        .innerJoin(users, eq(routes.carrierId, users.id));

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      const allRoutes = await query
        .orderBy(desc(routes.createdAt))
        .limit(limitNum)
        .offset(offset);

      const totalCount = await db.select({ count: count() }).from(routes);

      const result = allRoutes.map(({ route, carrier }) => ({
        ...route,
        carrierName: carrier.name,
        carrierEmail: carrier.email,
      }));

      res.json({
        routes: result,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount[0]?.count || 0,
          totalPages: Math.ceil((totalCount[0]?.count || 0) / limitNum),
        },
      });
    } catch (error) {
      console.error("Failed to fetch routes:", error);
      res.status(500).json({ error: "Failed to fetch routes" });
    }
  });

  app.patch("/api/admin/routes/:id", requireAdmin, async (req: AuthenticatedRequest, res) => {
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

  app.delete("/api/admin/routes/:id", requireAdmin, async (req: AuthenticatedRequest, res) => {
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

  // Payment Management
  app.get("/api/admin/payments", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { status, page = "1", limit = "20" } = req.query;
      
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      let query = db
        .select({
          payment: payments,
          sender: users,
        })
        .from(payments)
        .innerJoin(users, eq(payments.senderId, users.id));

      if (status) {
        query = query.where(eq(payments.status, status as any));
      }

      const allPayments = await query
        .orderBy(desc(payments.createdAt))
        .limit(limitNum)
        .offset(offset);

      const totalCount = await db.select({ count: count() }).from(payments);

      const result = allPayments.map(({ payment, sender }) => ({
        ...payment,
        senderName: sender.name,
        senderEmail: sender.email,
      }));

      res.json({
        payments: result,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount[0]?.count || 0,
          totalPages: Math.ceil((totalCount[0]?.count || 0) / limitNum),
        },
      });
    } catch (error) {
      console.error("Failed to fetch payments:", error);
      res.status(500).json({ error: "Failed to fetch payments" });
    }
  });

  // Review Management
  app.get("/api/admin/reviews", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { page = "1", limit = "20" } = req.query;
      
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      const allReviews = await db
        .select({
          review: reviews,
          reviewer: users,
        })
        .from(reviews)
        .innerJoin(users, eq(reviews.reviewerId, users.id))
        .orderBy(desc(reviews.createdAt))
        .limit(limitNum)
        .offset(offset);

      const totalCount = await db.select({ count: count() }).from(reviews);

      const result = allReviews.map(({ review, reviewer }) => ({
        ...review,
        reviewerName: reviewer.name,
        reviewerEmail: reviewer.email,
      }));

      res.json({
        reviews: result,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount[0]?.count || 0,
          totalPages: Math.ceil((totalCount[0]?.count || 0) / limitNum),
        },
      });
    } catch (error) {
      console.error("Failed to fetch reviews:", error);
      res.status(500).json({ error: "Failed to fetch reviews" });
    }
  });

  app.delete("/api/admin/reviews/:id", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const result = await db.delete(reviews).where(eq(reviews.id, req.params.id)).returning();
      if (!result[0]) {
        return res.status(404).json({ error: "Review not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete review:", error);
      res.status(500).json({ error: "Failed to delete review" });
    }
  });

  // Activity Logs - Recent activities across the platform
  app.get("/api/admin/activity", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { limit = "50" } = req.query;
      const limitNum = parseInt(limit as string);

      // Get recent parcels, routes, and payments
      const [recentParcels, recentRoutes, recentPayments] = await Promise.all([
        db
          .select({
            id: parcels.id,
            type: sql<string>`'parcel'`,
            description: sql<string>`CONCAT('Parcel from ', ${parcels.origin}, ' to ', ${parcels.destination})`,
            status: parcels.status,
            createdAt: parcels.createdAt,
            userId: parcels.senderId,
            userName: users.name,
          })
          .from(parcels)
          .innerJoin(users, eq(parcels.senderId, users.id))
          .orderBy(desc(parcels.createdAt))
          .limit(limitNum / 3),
        
        db
          .select({
            id: routes.id,
            type: sql<string>`'route'`,
            description: sql<string>`CONCAT('Route from ', ${routes.origin}, ' to ', ${routes.destination})`,
            status: routes.status,
            createdAt: routes.createdAt,
            userId: routes.carrierId,
            userName: users.name,
          })
          .from(routes)
          .innerJoin(users, eq(routes.carrierId, users.id))
          .orderBy(desc(routes.createdAt))
          .limit(limitNum / 3),
        
        db
          .select({
            id: payments.id,
            type: sql<string>`'payment'`,
            description: sql<string>`CONCAT('Payment of ', ${payments.amount}, ' ', ${payments.currency})`,
            status: payments.status,
            createdAt: payments.createdAt,
            userId: payments.senderId,
            userName: users.name,
          })
          .from(payments)
          .innerJoin(users, eq(payments.senderId, users.id))
          .orderBy(desc(payments.createdAt))
          .limit(limitNum / 3),
      ]);

      const activities = [...recentParcels, ...recentRoutes, ...recentPayments]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, limitNum);

      res.json({ activities });
    } catch (error) {
      console.error("Failed to fetch activity:", error);
      res.status(500).json({ error: "Failed to fetch activity" });
    }
  });

  // =====================================================
  // DISPUTE MANAGEMENT
  // =====================================================
  
  // List all disputes with filters
  app.get("/api/admin/disputes", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { status, search, page = "1", limit = "20" } = req.query;
      
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      const conditions = [];

      if (status) {
        conditions.push(eq(disputes.status, status as any));
      }

      if (search) {
        conditions.push(
          or(
            ilike(disputes.subject, `%${search}%`),
            ilike(disputes.description, `%${search}%`)
          )
        );
      }

      let query = db
        .select({
          dispute: disputes,
          complainant: users,
          parcel: parcels,
        })
        .from(disputes)
        .innerJoin(users, eq(disputes.complainantId, users.id))
        .leftJoin(parcels, eq(disputes.parcelId, parcels.id));

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      const allDisputes = await query
        .orderBy(desc(disputes.createdAt))
        .limit(limitNum)
        .offset(offset);

      const totalCount = await db.select({ count: count() }).from(disputes);

      const result = allDisputes.map(({ dispute, complainant, parcel }) => ({
        ...dispute,
        complainantName: complainant.name,
        complainantEmail: complainant.email,
        parcelOrigin: parcel?.origin,
        parcelDestination: parcel?.destination,
      }));

      res.json({
        disputes: result,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount[0]?.count || 0,
          totalPages: Math.ceil((totalCount[0]?.count || 0) / limitNum),
        },
      });
    } catch (error) {
      logger.error("Failed to fetch disputes:", error);
      res.status(500).json({ error: "Failed to fetch disputes" });
    }
  });

  // Get dispute details with messages
  app.get("/api/admin/disputes/:id", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const dispute = await storage.getDispute(req.params.id);
      if (!dispute) {
        return res.status(404).json({ error: "Dispute not found" });
      }

      // Get all participants
      const [complainant, respondent, parcel] = await Promise.all([
        storage.getUser(dispute.complainantId),
        storage.getUser(dispute.respondentId),
        storage.getParcel(dispute.parcelId),
      ]);

      // Get dispute messages
      const messages = await storage.getDisputeMessages(req.params.id);

      res.json({
        ...dispute,
        complainant,
        respondent,
        parcel,
        messages,
      });
    } catch (error) {
      logger.error("Failed to fetch dispute:", error);
      res.status(500).json({ error: "Failed to fetch dispute" });
    }
  });

  // Update dispute status
  app.patch("/api/admin/disputes/:id", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { status, resolution, adminId } = req.body;
      const updates: any = { adminId: req.user!.uid };

      if (status) updates.status = status;
      if (resolution) updates.resolution = resolution;
      if (status === "resolved" || status === "closed") {
        updates.resolvedAt = new Date();
      }

      const dispute = await storage.updateDispute(req.params.id, updates);
      if (!dispute) {
        return res.status(404).json({ error: "Dispute not found" });
      }

      logger.info("Admin updated dispute", {
        adminId: req.user!.uid,
        disputeId: req.params.id,
        updates,
      });

      res.json(dispute);
    } catch (error) {
      logger.error("Failed to update dispute:", error);
      res.status(500).json({ error: "Failed to update dispute" });
    }
  });

  // Resolve dispute with refund
  app.post("/api/admin/disputes/:id/resolve", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { refundAmount, resolution, refundToWallet = true } = req.body;

      const dispute = await storage.getDispute(req.params.id);
      if (!dispute) {
        return res.status(404).json({ error: "Dispute not found" });
      }

      if (dispute.status === "resolved" || dispute.status === "closed") {
        return res.status(400).json({ error: "Dispute already resolved" });
      }

      // Update dispute with resolution
      const updates: any = {
        status: "resolved",
        resolution,
        resolvedAt: new Date(),
        adminId: req.user!.uid,
      };

      if (refundAmount && refundAmount > 0) {
        updates.refundAmount = refundAmount;
        
        if (refundToWallet) {
          // Add refund to complainant's wallet
          const complainant = await storage.getUser(dispute.complainantId);
          if (complainant) {
            const newBalance = (complainant.walletBalance || 0) + refundAmount;
            await db.update(users).set({ walletBalance: newBalance }).where(eq(users.id, dispute.complainantId));

            // Create wallet transaction
            await storage.createWalletTransaction({
              userId: dispute.complainantId,
              amount: refundAmount,
              type: "refund",
              balanceBefore: complainant.walletBalance || 0,
              balanceAfter: newBalance,
              description: `Refund for dispute #${req.params.id}`,
              reference: `DISPUTE-REFUND-${req.params.id}`,
              parcelId: dispute.parcelId,
            });

            updates.refundedToWallet = true;
          }
        }
      }

      const updatedDispute = await storage.updateDispute(req.params.id, updates);

      logger.info("Admin resolved dispute with refund", {
        adminId: req.user!.uid,
        disputeId: req.params.id,
        refundAmount,
        refundToWallet,
      });

      res.json(updatedDispute);
    } catch (error) {
      logger.error("Failed to resolve dispute:", error);
      res.status(500).json({ error: "Failed to resolve dispute" });
    }
  });

  // Admin message in dispute
  app.post("/api/admin/disputes/:id/messages", requireAdmin, async (req: AuthenticatedRequest, res) => {
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
        senderId: req.user!.uid,
        message: message.trim(),
        isAdminMessage: true,
      });

      logger.info("Admin sent dispute message", {
        adminId: req.user!.uid,
        disputeId: req.params.id,
      });

      res.json(disputeMessage);
    } catch (error) {
      logger.error("Failed to send dispute message:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // =====================================================
  // SUBSCRIPTION MANAGEMENT
  // =====================================================
  
  // List all subscriptions
  app.get("/api/admin/subscriptions", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { status, tier, page = "1", limit = "20" } = req.query;
      
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      const conditions = [];

      if (status) {
        conditions.push(eq(subscriptions.status, status as any));
      }

      if (tier) {
        conditions.push(eq(subscriptions.tier, tier as any));
      }

      let query = db
        .select({
          subscription: subscriptions,
          user: users,
        })
        .from(subscriptions)
        .innerJoin(users, eq(subscriptions.userId, users.id));

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      const allSubscriptions = await query
        .orderBy(desc(subscriptions.createdAt))
        .limit(limitNum)
        .offset(offset);

      const totalCount = await db.select({ count: count() }).from(subscriptions);

      const result = allSubscriptions.map(({ subscription, user }) => ({
        ...subscription,
        userName: user.name,
        userEmail: user.email,
      }));

      res.json({
        subscriptions: result,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount[0]?.count || 0,
          totalPages: Math.ceil((totalCount[0]?.count || 0) / limitNum),
        },
      });
    } catch (error) {
      logger.error("Failed to fetch subscriptions:", error);
      res.status(500).json({ error: "Failed to fetch subscriptions" });
    }
  });

  // Subscription statistics
  app.get("/api/admin/subscriptions/stats", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const [totalSubscriptions, activeSubscriptions, revenueData, tierBreakdown] = await Promise.all([
        db.select({ count: count() }).from(subscriptions),
        db.select({ count: count() }).from(subscriptions).where(eq(subscriptions.status, "active")),
        db
          .select({ sum: sql<number>`COALESCE(SUM(${subscriptions.amount}), 0)` })
          .from(subscriptions)
          .where(eq(subscriptions.status, "active")),
        db
          .select({
            tier: subscriptions.tier,
            count: count(),
            revenue: sql<number>`COALESCE(SUM(${subscriptions.amount}), 0)`,
          })
          .from(subscriptions)
          .where(eq(subscriptions.status, "active"))
          .groupBy(subscriptions.tier),
      ]);

      res.json({
        total: totalSubscriptions[0]?.count || 0,
        active: activeSubscriptions[0]?.count || 0,
        monthlyRevenue: revenueData[0]?.sum || 0,
        tierBreakdown,
      });
    } catch (error) {
      logger.error("Failed to fetch subscription stats:", error);
      res.status(500).json({ error: "Failed to fetch subscription statistics" });
    }
  });

  // Update subscription
  app.patch("/api/admin/subscriptions/:id", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { status, endDate } = req.body;
      const updates: any = {};

      if (status) updates.status = status;
      if (endDate) updates.endDate = new Date(endDate);

      const result = await db
        .update(subscriptions)
        .set(updates)
        .where(eq(subscriptions.id, req.params.id))
        .returning();

      if (!result[0]) {
        return res.status(404).json({ error: "Subscription not found" });
      }

      logger.info("Admin updated subscription", {
        adminId: req.user!.uid,
        subscriptionId: req.params.id,
        updates,
      });

      res.json(result[0]);
    } catch (error) {
      logger.error("Failed to update subscription:", error);
      res.status(500).json({ error: "Failed to update subscription" });
    }
  });

  // Cancel subscription
  app.post("/api/admin/subscriptions/:id/cancel", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { reason } = req.body;

      const result = await db
        .update(subscriptions)
        .set({
          status: "cancelled",
          cancelledAt: new Date(),
          cancellationReason: reason || "Cancelled by admin",
        })
        .where(eq(subscriptions.id, req.params.id))
        .returning();

      if (!result[0]) {
        return res.status(404).json({ error: "Subscription not found" });
      }

      // Update user's subscription tier to free
      await db
        .update(users)
        .set({
          subscriptionTier: "free",
          subscriptionStatus: "cancelled",
        })
        .where(eq(users.id, result[0].userId));

      logger.info("Admin cancelled subscription", {
        adminId: req.user!.uid,
        subscriptionId: req.params.id,
        reason,
      });

      res.json(result[0]);
    } catch (error) {
      logger.error("Failed to cancel subscription:", error);
      res.status(500).json({ error: "Failed to cancel subscription" });
    }
  });

  // =====================================================
  // WALLET MANAGEMENT
  // =====================================================
  
  // List all wallet transactions
  app.get("/api/admin/wallet/transactions", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const { type, userId, page = "1", limit = "50" } = req.query;
      
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const offset = (pageNum - 1) * limitNum;

      const conditions = [];

      if (type) {
        conditions.push(eq(walletTransactions.type, type as any));
      }

      if (userId) {
        conditions.push(eq(walletTransactions.userId, userId as string));
      }

      let query = db
        .select({
          transaction: walletTransactions,
          user: users,
        })
        .from(walletTransactions)
        .innerJoin(users, eq(walletTransactions.userId, users.id));

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      const allTransactions = await query
        .orderBy(desc(walletTransactions.createdAt))
        .limit(limitNum)
        .offset(offset);

      const totalCount = await db.select({ count: count() }).from(walletTransactions);

      const result = allTransactions.map(({ transaction, user }) => ({
        ...transaction,
        userName: user.name,
        userEmail: user.email,
      }));

      res.json({
        transactions: result,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount[0]?.count || 0,
          totalPages: Math.ceil((totalCount[0]?.count || 0) / limitNum),
        },
      });
    } catch (error) {
      logger.error("Failed to fetch wallet transactions:", error);
      res.status(500).json({ error: "Failed to fetch wallet transactions" });
    }
  });

  // Wallet statistics
  app.get("/api/admin/wallet/stats", requireAdmin, async (req: AuthenticatedRequest, res) => {
    try {
      const [totalTransactions, totalCredits, totalDebits, totalTopups, totalRefunds] = await Promise.all([
        db.select({ count: count() }).from(walletTransactions),
        db
          .select({ sum: sql<number>`COALESCE(SUM(${walletTransactions.amount}), 0)` })
          .from(walletTransactions)
          .where(eq(walletTransactions.type, "credit")),
        db
          .select({ sum: sql<number>`COALESCE(SUM(${walletTransactions.amount}), 0)` })
          .from(walletTransactions)
          .where(eq(walletTransactions.type, "debit")),
        db
          .select({ sum: sql<number>`COALESCE(SUM(${walletTransactions.amount}), 0)` })
          .from(walletTransactions)
          .where(eq(walletTransactions.type, "topup")),
        db
          .select({ sum: sql<number>`COALESCE(SUM(${walletTransactions.amount}), 0)` })
          .from(walletTransactions)
          .where(eq(walletTransactions.type, "refund")),
      ]);

      // Get total wallet balance across all users
      const totalWalletBalance = await db.select({
        sum: sql<number>`COALESCE(SUM(${users.walletBalance}), 0)`
      }).from(users);

      res.json({
        totalTransactions: totalTransactions[0]?.count || 0,
        totalCredits: totalCredits[0]?.sum || 0,
        totalDebits: totalDebits[0]?.sum || 0,
        totalTopups: totalTopups[0]?.sum || 0,
        totalRefunds: totalRefunds[0]?.sum || 0,
        totalWalletBalance: totalWalletBalance[0]?.sum || 0,
      });
    } catch (error) {
      logger.error("Failed to fetch wallet stats:", error);
      res.status(500).json({ error: "Failed to fetch wallet statistics" });
    }
  });

  // Manual wallet adjustment (credit/debit)
  app.post("/api/admin/wallet/adjust", requireAdmin, async (req: AuthenticatedRequest, res) => {
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

      // Update user's wallet balance
      await db.update(users).set({ walletBalance: newBalance }).where(eq(users.id, userId));

      // Create wallet transaction
      const transaction = await storage.createWalletTransaction({
        userId,
        amount: Math.abs(amount),
        type,
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
        description: description || `Admin ${type} by ${req.user!.email}`,
        reference: `ADMIN-ADJUST-${Date.now()}`,
        metadata: JSON.stringify({ adminId: req.user!.uid, adminEmail: req.user!.email }),
      });

      logger.info("Admin adjusted wallet", {
        adminId: req.user!.uid,
        userId,
        amount,
        type,
        newBalance,
      });

      res.json({
        transaction,
        newBalance,
      });
    } catch (error) {
      logger.error("Failed to adjust wallet:", error);
      res.status(500).json({ error: "Failed to adjust wallet" });
    }
  });

  // Issue refund to wallet
  app.post("/api/admin/wallet/refund", requireAdmin, async (req: AuthenticatedRequest, res) => {
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

      // Update user's wallet balance
      await db.update(users).set({ walletBalance: newBalance }).where(eq(users.id, userId));

      // Create wallet transaction
      const transaction = await storage.createWalletTransaction({
        userId,
        amount,
        type: "refund",
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
        description: description || `Refund issued by admin`,
        reference: `ADMIN-REFUND-${Date.now()}`,
        parcelId: parcelId || undefined,
        metadata: JSON.stringify({ adminId: req.user!.uid, adminEmail: req.user!.email }),
      });

      logger.info("Admin issued refund to wallet", {
        adminId: req.user!.uid,
        userId,
        amount,
        newBalance,
        parcelId,
      });

      res.json({
        transaction,
        newBalance,
      });
    } catch (error) {
      logger.error("Failed to issue refund:", error);
      res.status(500).json({ error: "Failed to issue refund" });
    }
  });
}
