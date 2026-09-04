import { db } from '../server/storage';
import { sql } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  try {
    console.log('Running wallet system migration...');
    
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, '../migrations/002_wallet_system.sql'),
      'utf-8'
    );

    // Split by semicolon and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      try {
        await db.execute(sql.raw(statement));
        console.log('✓ Executed statement');
      } catch (error: any) {
        if (error.message.includes('already exists') || error.message.includes('duplicate')) {
          console.log('⊘ Skipped (already exists)');
        } else {
          throw error;
        }
      }
    }

    console.log('✅ Wallet migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();
