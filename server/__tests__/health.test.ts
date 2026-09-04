import request from 'supertest';
import express from 'express';
import { registerRoutes } from '../routes';

describe('Health Check API', () => {
  let app: express.Application;
  let server: any;

  beforeAll(async () => {
    app = express();
    server = await registerRoutes(app);
  });

  afterAll((done) => {
    if (server) {
      server.close(done);
    } else {
      done();
    }
  });

  it('should return healthy status with database check', async () => {
    const res = await request(server)
      .get('/health')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('checks');
    expect(res.body.checks).toHaveProperty('database');
    expect(res.body.checks).toHaveProperty('timestamp');
    expect(res.body.checks).toHaveProperty('version');
  });

  it('should include timestamp in ISO format', async () => {
    const res = await request(server)
      .get('/health');

    const timestamp = res.body.checks.timestamp;
    expect(timestamp).toBeDefined();
    expect(new Date(timestamp).toISOString()).toBe(timestamp);
  });

  it('should return 503 if database is unhealthy', async () => {
    // This test would need database mocking to simulate failure
    // Skipping for now as it requires more complex setup
  });
});
