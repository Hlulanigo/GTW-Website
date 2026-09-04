import "dotenv/config";
import { Pool } from "pg";

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    console.log("Running privacy migration...");

    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_visibility text NOT NULL DEFAULT 'public';`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS blocked_users (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id varchar NOT NULL REFERENCES users(id),
        blocked_user_id varchar NOT NULL REFERENCES users(id),
        created_at timestamp DEFAULT now()
      );
    `);

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_blocked_users_user_id ON blocked_users(user_id);`);

    console.log("Privacy migration applied successfully.");
  } catch (err) {
    console.error("Failed to apply migration:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
