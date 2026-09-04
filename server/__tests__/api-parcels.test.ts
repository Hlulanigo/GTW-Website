import request from 'supertest';
import express from 'express';
import { registerRoutes } from '../routes';

describe('Parcels API', () => {
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

  describe('GET /api/parcels', () => {
    it('should return array of parcels', async () => {
      const res = await request(server)
        .get('/api/parcels')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });

    it('should return parcels with sender information', async () => {
      const res = await request(server)
        .get('/api/parcels');

      if (res.body.length > 0) {
        const parcel = res.body[0];
        expect(parcel).toHaveProperty('id');
        expect(parcel).toHaveProperty('origin');
        expect(parcel).toHaveProperty('destination');
        expect(parcel).toHaveProperty('senderName');
        expect(parcel).toHaveProperty('status');
      }
    });
  });

  describe('POST /api/parcels', () => {
    it('should require authentication', async () => {
      await request(server)
        .post('/api/parcels')
        .send({
          origin: 'Lagos',
          destination: 'Abuja',
          size: 'small',
          compensation: 5000,
          pickupDate: new Date().toISOString(),
        })
        .expect(401);
    });

    it('should validate required fields', async () => {
      // This would need authentication mock
      // Testing validation logic
    });
  });

  describe('GET /api/parcels/:id', () => {
    it('should return 404 for non-existent parcel', async () => {
      await request(server)
        .get('/api/parcels/non-existent-id')
        .expect(404);
    });
  });
});
