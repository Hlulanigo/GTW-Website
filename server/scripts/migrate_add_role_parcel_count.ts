/**
 * Migration: add role, monthly_parcel_count, last_parcel_reset_date to users
 *
 * Run with:  npx tsx server/scripts/migrate_add_role_parcel_count.ts
 */
import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user',
        ADD COLUMN IF NOT EXISTS monthly_parcel_count INTEGER NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS last_parcel_reset_date TIMESTAMP;
    `);

    await client.query("COMMIT");
    console.log("✅  Migration complete: role, monthly_parcel_count, last_parcel_reset_date added to users");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌  Migration failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
