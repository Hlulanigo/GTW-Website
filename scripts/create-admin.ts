import 'dotenv/config';
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { db } from '../server/storage';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function run() {
  const accountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || path.resolve(process.cwd(), 'server', 'firebase-service-account.json');
  if (!fs.existsSync(accountPath)) {
    console.error('Firebase service account not found at', accountPath);
    process.exit(1);
  }
  const serviceAccount = JSON.parse(fs.readFileSync(accountPath, 'utf8'));
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount as any) });

  const email = process.env.ADMIN_EMAIL || `admin+local@thegtw.test`;
  const password = process.env.ADMIN_PASSWORD || `Admin12345!`;

  let user;
  try {
    user = await admin.auth().getUserByEmail(email);
    console.log('Found existing admin user:', user.uid);
  } catch (e) {
    user = await admin.auth().createUser({ email, password });
    console.log('Created admin user:', user.uid);
  }

  // Sync to DB: if already exists, update verified and subscription; otherwise, create in DB
  // Try to find matching DB user
  const existing = await db.select().from(users).where(eq(users.id, user.uid));
  if (existing.length === 0) {
    await db.insert(users).values({ id: user.uid, name: 'Admin', email, phone: null, verified: true, walletBalance: 10000, subscriptionStatus: 'premium' });
    console.log('Inserted admin into DB');
  } else {
    await db.update(users).set({ verified: true, subscriptionStatus: 'premium', walletBalance: 10000 }).where(eq(users.id, user.uid));
    console.log('Updated admin record in DB');
  }

  console.log('Admin credentials:');
  console.log('  email:', email);
  console.log('  password:', password);
}

run().catch((e) => {
  console.error('Create admin error', e);
  process.exit(1);
});