import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import request from "supertest";
import { users, savedPaymentMethods, autoTopUpSettings } from "../../shared/schema";
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

  // Payment Methods Endpoints
  app.post("/api/payment-methods", async (req: TestRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      const { cardLast4, cardBrand, authorizationCode } = req.body;
      
      const result = await db
        .insert(savedPaymentMethods)
        .values({
          userId: req.user.uid,
          cardLast4,
          cardBrand,
          authorizationCode,
        })
        .returning();

      res.status(201).json({ data: result[0] });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/payment-methods", async (req: TestRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      
      const result = await db
        .select()
        .from(savedPaymentMethods)
        .where(eq(savedPaymentMethods.userId, req.user.uid));

      res.json({ data: result });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/payment-methods/:methodId", async (req: TestRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      
      const result = await db
        .delete(savedPaymentMethods)
        .where(eq(savedPaymentMethods.id, req.params.methodId))
        .returning();

      if (result.length === 0) {
        return res.status(404).json({ error: "Not found" });
      }

      res.json({ status: "success" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Auto Top-up Endpoints
  app.get("/api/auto-topup", async (req: TestRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      
      const result = await db
        .select()
        .from(autoTopUpSettings)
        .where(eq(autoTopUpSettings.userId, req.user.uid));

      res.json({ data: result[0] || null });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/auto-topup", async (req: TestRequest, res: Response) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthorized" });
      
      const { isEnabled, triggerAmount, topupAmount } = req.body;

      // Check if exists
      const existing = await db
        .select()
        .from(autoTopUpSettings)
        .where(eq(autoTopUpSettings.userId, req.user.uid));

      let result;
      if (existing.length > 0) {
        result = await db
          .update(autoTopUpSettings)
          .set({
            isEnabled,
            triggerAmount,
            topupAmount,
            updatedAt: new Date(),
          })
          .where(eq(autoTopUpSettings.userId, req.user.uid))
          .returning();
      } else {
        result = await db
          .insert(autoTopUpSettings)
          .values({
            userId: req.user.uid,
            isEnabled,
            triggerAmount,
            topupAmount,
          })
          .returning();
      }

      res.json({ data: result[0] });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return app;
};

describe("Payment Methods & Auto Top-up", () => {
  const testUserId = "test-payment-user-" + Date.now();
  let app: express.Application;

  beforeAll(async () => {
    // Create test user
    await db.insert(users).values({
      id: testUserId,
      name: "Payment Test User",
      email: `payment-${Date.now()}@test.com`,
    });

    app = createTestApp();
  });

  afterAll(async () => {
    // Clean up
    await db.delete(savedPaymentMethods).where(eq(savedPaymentMethods.userId, testUserId));
    await db.delete(autoTopUpSettings).where(eq(autoTopUpSettings.userId, testUserId));
    await db.delete(users).where(eq(users.id, testUserId));
    await pool.end();
  });

  it("should save a payment method", async () => {
    const response = await request(app)
      .post("/api/payment-methods")
      .set("x-test-user", testUserId)
      .send({
        cardLast4: "4242",
        cardBrand: "Visa",
        authorizationCode: "AUTH_CODE_123",
      });

    expect(response.status).toBe(201);
    expect(response.body.data).toBeDefined();
    expect(response.body.data.cardLast4).toBe("4242");
    expect(response.body.data.cardBrand).toBe("Visa");
  });

  it("should list saved payment methods", async () => {
    // Save two methods first
    await request(app)
      .post("/api/payment-methods")
      .set("x-test-user", testUserId)
      .send({
        cardLast4: "1111",
        cardBrand: "Mastercard",
        authorizationCode: "AUTH_MC_001",
      });

    await request(app)
      .post("/api/payment-methods")
      .set("x-test-user", testUserId)
      .send({
        cardLast4: "2222",
        cardBrand: "Amex",
        authorizationCode: "AUTH_AMEX_001",
      });

    const response = await request(app)
      .get("/api/payment-methods")
      .set("x-test-user", testUserId);

    expect(response.status).toBe(200);
    expect(response.body.data).toBeInstanceOf(Array);
    expect(response.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it("should enable and configure auto top-up", async () => {
    const response = await request(app)
      .patch("/api/auto-topup")
      .set("x-test-user", testUserId)
      .send({
        isEnabled: true,
        triggerAmount: 1000, // 10.00
        topupAmount: 5000, // 50.00
      });

    expect(response.status).toBe(200);
    expect(response.body.data.isEnabled).toBe(true);
    expect(response.body.data.triggerAmount).toBe(1000);
    expect(response.body.data.topupAmount).toBe(5000);
  });

  it("should fetch auto top-up settings", async () => {
    const response = await request(app)
      .get("/api/auto-topup")
      .set("x-test-user", testUserId);

    expect(response.status).toBe(200);
    expect(response.body.data).toBeDefined();
    expect(response.body.data.isEnabled).toBe(true);
  });

  it("should disable auto top-up", async () => {
    const response = await request(app)
      .patch("/api/auto-topup")
      .set("x-test-user", testUserId)
      .send({
        isEnabled: false,
        triggerAmount: 0,
        topupAmount: 0,
      });

    expect(response.status).toBe(200);
    expect(response.body.data.isEnabled).toBe(false);
  });

  it("should delete a payment method", async () => {
    // First create a method
    const createResponse = await request(app)
      .post("/api/payment-methods")
      .set("x-test-user", testUserId)
      .send({
        cardLast4: "5555",
        cardBrand: "Visa",
        authorizationCode: "AUTH_DELETE_TEST",
      });

    const methodId = createResponse.body.data.id;

    // Then delete it
    const deleteResponse = await request(app)
      .delete(`/api/payment-methods/${methodId}`)
      .set("x-test-user", testUserId);

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body.status).toBe("success");

    // Verify it's deleted
    const listResponse = await request(app)
      .get("/api/payment-methods")
      .set("x-test-user", testUserId);

    const methodIds = listResponse.body.data.map((m: any) => m.id);
    expect(methodIds).not.toContain(methodId);
  });
});
