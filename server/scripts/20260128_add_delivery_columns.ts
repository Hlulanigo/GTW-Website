import "dotenv/config";
import { Pool } from "pg";

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    console.log("Adding delivery columns to users...");

    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS delivery_instructions text;`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_carriers text[];`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS return_address_name text;`);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS return_address_details text;`);

    console.log("Delivery columns applied successfully.");
  } catch (err) {
    console.error("Failed to apply delivery columns:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
