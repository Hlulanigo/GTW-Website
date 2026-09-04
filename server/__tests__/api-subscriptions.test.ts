import request from 'supertest';
import express from 'express';
import { registerRoutes } from '../routes';

describe('Subscriptions API', () => {
  let app: express.Application;
  let server: any;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    server = await registerRoutes(app);
  });

  afterAll((done) => {
    if (server) {
      server.close(done);
    } else {
      done();
    }
  });

  describe('GET /api/subscriptions/plans', () => {
    it('should return all subscription plans', async () => {
      const res = await request(server)
        .get('/api/subscriptions/plans')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(res.body).toHaveProperty('plans');
      expect(Array.isArray(res.body.plans)).toBe(true);
      expect(res.body.plans.length).toBeGreaterThan(0);
    });

    it('should include free, premium, and business tiers', async () => {
      const res = await request(server)
        .get('/api/subscriptions/plans');

      const plans = res.body.plans;
      const tiers = plans.map((p: any) => p.tier);
      
      expect(tiers).toContain('free');
      expect(tiers).toContain('premium');
      expect(tiers).toContain('business');
    });

    it('should include plan details', async () => {
      const res = await request(server)
        .get('/api/subscriptions/plans');

      const plan = res.body.plans[0];
      expect(plan).toHaveProperty('tier');
      expect(plan).toHaveProperty('price');
      expect(plan).toHaveProperty('monthlyParcelLimit');
      expect(plan).toHaveProperty('platformFeePercentage');
    });
  });

  describe('GET /api/subscriptions/me', () => {
    it('should require authentication', async () => {
      await request(server)
        .get('/api/subscriptions/me')
        .expect(401);
    });
  });

  describe('POST /api/subscriptions/subscribe', () => {
    it('should require authentication', async () => {
      await request(server)
        .post('/api/subscriptions/subscribe')
        .send({ tier: 'premium' })
        .expect(401);
    });

    it('should validate tier parameter', async () => {
      // This would need authentication mock
      // Testing validation for invalid tier
    });
  });
});
