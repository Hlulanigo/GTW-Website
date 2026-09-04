import request from 'supertest';
import { createServerInstance } from '../index';

let httpServer: any;

beforeAll(async () => {
  httpServer = await createServerInstance();
});

afterAll(async () => {
  if (httpServer && httpServer.close) {
    await new Promise((resolve) => httpServer.close(resolve));
  }
});

test('GET / returns landing page HTML', async () => {
  const res = await request(httpServer).get('/');
  expect(res.status).toBe(200);
  expect(res.headers['content-type']).toMatch(/text\/html/);
});

test('GET /manifest returns 404 (no static manifest served)', async () => {
  const res = await request(httpServer).get('/manifest');
  expect(res.status).toBe(404);
  expect(res.body).toHaveProperty('error');
});
