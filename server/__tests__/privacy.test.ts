import 'tsconfig-paths/register';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createServerInstance } from '../index';
import { Pool } from 'pg';

let server: any;
let pool: Pool;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  server = await createServerInstance();
  pool = new Pool({ connectionString: process.env.DATABASE_URL });

  await pool.query('INSERT INTO users (id, name, email) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING', ['test-privacy-user', 'Test Privacy', 'tp@example.com']);
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE id = $1', ['test-privacy-user']);
  await pool.end();
  if (server && server.close) await server.close();
});

describe('Profile visibility', () => {
  it('should update and persist profileVisibility via PATCH', async () => {
    const patch = await request(server).patch('/api/users/test-privacy-user').set('x-test-user', 'test-privacy-user').send({ profileVisibility: 'private' });
    expect([200, 201].includes(patch.status)).toBeTruthy();

    const res = await request(server).get('/api/users/test-privacy-user');
    expect(res.status).toBe(200);
    expect(res.body.profileVisibility).toBe('private');
  });

  it('should allow toggling back to public', async () => {
    const patch = await request(server).patch('/api/users/test-privacy-user').set('x-test-user', 'test-privacy-user').send({ profileVisibility: 'public' });
    expect([200, 201].includes(patch.status)).toBeTruthy();

    const res = await request(server).get('/api/users/test-privacy-user');
    expect(res.status).toBe(200);
    expect(res.body.profileVisibility).toBe('public');
  });
});
