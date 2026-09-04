import 'tsconfig-paths/register';
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createServerInstance } from "../index";
import { Pool } from "pg";

let server: any;
let pool: Pool;

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  server = await createServerInstance();
  pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // Ensure test users exist (direct DB insert to avoid auth middleware and DB schema differences)
  await pool.query("INSERT INTO users (id, name, email) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING", ["test-privacy-1", "Test Privacy 1", "tp1@example.com"]);
  await pool.query("INSERT INTO users (id, name, email) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING", ["test-privacy-2", "Test Privacy 2", "tp2@example.com"]);
});

afterAll(async () => {
  // Cleanup: remove blocked entries and test users
  await pool.query("DELETE FROM blocked_users WHERE user_id = $1 OR user_id = $2 OR blocked_user_id = $1 OR blocked_user_id = $2", ["test-privacy-1", "test-privacy-2"]);
  await pool.query("DELETE FROM users WHERE id = $1 OR id = $2", ["test-privacy-1", "test-privacy-2"]);
  await pool.end();
  if (server && server.close) await server.close();
});

describe("Blocked users endpoints", () => {
  it("should start with empty blocked list", async () => {
    const res = await request(server).get("/api/users/test-privacy-1/blocked").set('x-test-user', 'test-privacy-1');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("should block and list user", async () => {
    const post = await request(server).post("/api/users/test-privacy-1/blocked").set('x-test-user', 'test-privacy-1').send({ blockedUserId: "test-privacy-2" });
    expect([200, 201, 204, 201].includes(post.status)).toBeTruthy();

    const res = await request(server).get("/api/users/test-privacy-1/blocked").set('x-test-user', 'test-privacy-1');
    expect(res.status).toBe(200);
    expect(res.body.find((u: any) => u.id === "test-privacy-2")).toBeTruthy();
  });

  it("should unblock user", async () => {
    const del = await request(server).delete("/api/users/test-privacy-1/blocked/test-privacy-2").set('x-test-user', 'test-privacy-1');
    expect([200, 204].includes(del.status)).toBeTruthy();

    const res = await request(server).get("/api/users/test-privacy-1/blocked").set('x-test-user', 'test-privacy-1');
    expect(res.status).toBe(200);
    expect(res.body.find((u: any) => u.id === "test-privacy-2")).toBeFalsy();
  });


});
