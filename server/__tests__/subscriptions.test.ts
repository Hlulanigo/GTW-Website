import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import request from "supertest";
import { users, subscriptions } from "../../shared/schema";
import { eq } from "drizzle-orm";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

// Create Express app
import express from "express";
import type { Request, Response, NextFunction } from "express";

// Mock auth middleware
interface TestRequest extends Request {
  user?: { uid: string };
}

const mockAuth = (req: TestRequest, res: Response, next: NextFunction) => {
  const testUserId = req.get("x-test-user");
  if (testUserId) {
    req.user = { uid: testUserId };
  }
  next();
};

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use(mockAuth);

  // Subscription Endpoints
  app.get("/api/subscription", async (req: TestRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });

      const result = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, req.user.uid));

      res.json({ data: result[0] || null });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/subscription/upgrade", async (req: TestRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });

      const { planId } = req.body;

      if (!planId) {
        return res.status(400).json({ error: "planId is required" });
      }

      // Check if subscription exists
      const existing = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, req.user.uid));

      const now = new Date();
      const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      if (existing.length > 0) {
        // Update existing subscription
        await db
          .update(subscriptions)
          .set({
            planId: planId as any,
            status: "active",
            currentPeriodStart: now,
            currentPeriodEnd: nextMonth,
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.id, existing[0].id));
      } else {
        // Create new subscription
        await db.insert(subscriptions).values({
          userId: req.user.uid,
          planId: planId as any,
          status: "active",
          currentPeriodStart: now,
          currentPeriodEnd: nextMonth,
        });
      }

      res.json({ data: { status: "success" } });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/subscription/cancel", async (req: TestRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });

      const result = await db
        .update(subscriptions)
        .set({
          status: "cancelled",
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.userId, req.user.uid))
        .returning();

      if (result.length === 0) {
        return res.status(404).json({ error: "Subscription not found" });
      }

      res.json({ status: "success" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return app;
};

describe("Subscriptions Management", () => {
  const testUserId = "test-subscription-user-" + Date.now();
  let app: express.Application;

  beforeAll(async () => {
    // Create test user
    await db.insert(users).values({
      id: testUserId,
      name: "Subscription Test User",
      email: `subscription-${Date.now()}@test.com`,
    });

    app = createTestApp();
  });

  afterAll(async () => {
    // Clean up
    await db.delete(subscriptions).where(eq(subscriptions.userId, testUserId));
    await db.delete(users).where(eq(users.id, testUserId));
    await pool.end();
  });

  it("should return null for user without subscription", async () => {
    const response = await request(app)
      .get("/api/subscription")
      .set("x-test-user", testUserId);

    expect(response.status).toBe(200);
    expect(response.body.data).toBeNull();
  });

  it("should upgrade to a plan", async () => {
    const response = await request(app)
      .post("/api/subscription/upgrade")
      .set("x-test-user", testUserId)
      .send({ planId: "starter" });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe("success");
  });

  it("should fetch active subscription", async () => {
    const response = await request(app)
      .get("/api/subscription")
      .set("x-test-user", testUserId);

    expect(response.status).toBe(200);
    expect(response.body.data).toBeDefined();
    expect(response.body.data.planId).toBe("starter");
    expect(response.body.data.status).toBe("active");
  });

  it("should upgrade to a higher plan", async () => {
    await request(app)
      .post("/api/subscription/upgrade")
      .set("x-test-user", testUserId)
      .send({ planId: "professional" });

    const response = await request(app)
      .get("/api/subscription")
      .set("x-test-user", testUserId);

    expect(response.body.data.planId).toBe("professional");
    expect(response.body.data.status).toBe("active");
  });

  it("should cancel subscription", async () => {
    const response = await request(app)
      .post("/api/subscription/cancel")
      .set("x-test-user", testUserId);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("success");

    // Verify it's cancelled
    const getResponse = await request(app)
      .get("/api/subscription")
      .set("x-test-user", testUserId);

    expect(getResponse.body.data.status).toBe("cancelled");
    expect(getResponse.body.data.cancelledAt).toBeDefined();
  });
});
