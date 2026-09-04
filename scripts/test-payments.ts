import 'dotenv/config';
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { createHmac } from 'crypto';
import { createServerInstance } from '../server/index';

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY!;
const API_KEY = process.env.FIREBASE_API_KEY!;
let BACKEND = process.env.REACT_APP_BACKEND_URL || `http://localhost:5000/api`;

async function run() {
  // Initialize Firebase Admin
  const accountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || path.resolve(process.cwd(), 'server', 'firebase-service-account.json');
  if (!fs.existsSync(accountPath)) {
    console.error('Firebase service account not found at', accountPath);
    process.exit(1);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(accountPath, 'utf8'));
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount as any) });
  } else {
    console.log('Firebase Admin already initialized');
  }

  // Start a local server instance for testing
  const port = parseInt(process.env.TEST_SERVER_PORT || '5001', 10);
  const server = await createServerInstance();
  await new Promise<void>((resolve, reject) => {
    server.listen({ port, host: '127.0.0.1' }, () => {
      console.log(`Test server listening on http://127.0.0.1:${port}`);
      resolve();
    }).on('error', reject);
  });
  BACKEND = `http://127.0.0.1:${port}/api`;

  const email = `test+payments+${Date.now()}@example.com`;
  const password = 'Test12345!';

  let user;
  try {
    user = await admin.auth().getUserByEmail(email);
    console.log('Found existing user', user.uid);
  } catch (e) {
    user = await admin.auth().createUser({ email, password });
    console.log('Created test user', user.uid);
  }

  const customToken = await admin.auth().createCustomToken(user.uid);

  // Exchange custom token for idToken via Firebase REST
  const signInRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  const signInJson = await signInRes.json();
  const idToken = signInJson.idToken;

  if (!idToken) {
    console.error('Failed to obtain idToken', signInJson);
    process.exit(1);
  }
  console.log('Obtained idToken for test user');

  // Ensure user is synced to the database
  const syncRes = await fetch(`${BACKEND}/auth/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ name: 'Test User', phone: null }),
  });
  const syncJson = await syncRes.json();
  if (!syncRes.ok) {
    console.error('Failed to sync user to DB', syncJson);
    process.exit(1);
  }
  console.log('User synced to DB', syncJson.id);

  // Create a parcel
  const parcelPayload = {
    origin: 'Cape Town, South Africa',
    destination: 'Johannesburg, South Africa',
    size: 'small',
    compensation: 1000,
    pickupDate: new Date().toISOString(),
    contactPhone: '+27821234567',
    description: 'Test parcel for payments',
  };

  const parcelRes = await fetch(`${BACKEND}/parcels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(parcelPayload),
  });
  const parcelJson = await parcelRes.json();
  if (!parcelRes.ok) {
    console.error('Failed to create parcel', parcelJson);
    process.exit(1);
  }
  console.log('Created parcel', parcelJson.id);

  // Initialize payment
  const amount = 1000; // ZAR
  const initRes = await fetch(`${BACKEND}/payments/initialize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ amount, email, metadata: { parcelId: parcelJson.id } }),
  });

  const initJson = await initRes.json();
  if (!initRes.ok) {
    console.error('Payment initialize failed', initJson);
    process.exit(1);
  }

  console.log('Initialized Paystack transaction:', initJson);
  const reference = initJson?.data?.reference || initJson.reference || initJson?.data?.data?.reference;
  if (!reference) {
    console.error('Failed to extract reference from initialization response', initJson);
    process.exit(1);
  }

  // Check payment history (should be pending)
  const histRes1 = await fetch(`${BACKEND}/payments/history`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  const hist1 = await histRes1.json();
  console.log('Payment history (before webhook):', hist1.map((p: any) => ({ id: p.id, status: p.status })));

  // Simulate Paystack webhook
  const payload = { event: 'charge.success', data: { reference, status: 'success', metadata: { parcelId: parcelJson.id } } };
  const signature = createHmac('sha512', PAYSTACK_SECRET).update(JSON.stringify(payload)).digest('hex');

  const webhookRes = await fetch(`${BACKEND}/payments/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-paystack-signature': signature },
    body: JSON.stringify(payload),
  });
  const webhookJson = await webhookRes.json();
  console.log('Webhook response:', webhookJson);

  // Check payment history after webhook
  const histRes2 = await fetch(`${BACKEND}/payments/history`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  const hist2 = await histRes2.json();
  console.log('Payment history (after webhook):', hist2.map((p: any) => ({ id: p.id, status: p.status })));

  // Check parcel status
  const parcelCheckRes = await fetch(`${BACKEND}/parcels/${parcelJson.id}`);
  const parcelCheckJson = await parcelCheckRes.json();
  console.log('Parcel status after webhook:', parcelCheckJson.status || 'unknown');

  console.log('Test flow complete');
}

run().catch((e) => {
  console.error('Test script error', e);
  process.exit(1);
});
