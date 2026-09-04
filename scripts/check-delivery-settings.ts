import 'dotenv/config';
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

async function run() {
  const API_KEY = process.env.FIREBASE_API_KEY;
  if (!API_KEY) {
    console.error('FIREBASE_API_KEY is not set');
    process.exit(1);
  }

  const accountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || path.resolve(process.cwd(), 'server', 'firebase-service-account.json');
  if (!fs.existsSync(accountPath)) {
    console.error('Firebase service account not found at', accountPath);
    process.exit(1);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(accountPath, 'utf8'));
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount as any) });

  const port = parseInt(process.env.TEST_SERVER_PORT || '5000', 10);
  const BACKEND = `http://127.0.0.1:${port}/api`;

  const email = `test+delivery+${Date.now()}@example.com`;
  const password = 'Test12345!';

  console.log('Creating test Firebase user with email', email);
  let user;
  try {
    user = await admin.auth().createUser({ email, password });
  } catch (e: any) {
    if (e.code === 'auth/email-already-exists') {
      user = await admin.auth().getUserByEmail(email);
    } else {
      console.error('Failed to create or fetch test user', e);
      process.exit(1);
    }
  }

  const customToken = await admin.auth().createCustomToken(user.uid);

  // Exchange custom token for idToken
  const signInRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    }
  );
  const signInJson = await signInRes.json();
  const idToken = signInJson.idToken;
  if (!idToken) {
    console.error('Failed to obtain idToken', signInJson);
    process.exit(1);
  }

  console.log('Syncing user to backend DB...');
  const syncRes = await fetch(`${BACKEND}/auth/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ name: 'Delivery Tester', phone: null }),
  });
  const syncJson = await syncRes.json();
  if (!syncRes.ok) {
    console.error('Failed to sync user to DB', syncJson);
    process.exit(1);
  }
  console.log('User synced, id:', syncJson.id);

  // PATCH delivery settings
  const payload = {
    deliveryInstructions: 'Leave at reception and call on arrival',
    preferredCarriers: ['DHL Express', 'Local Couriers'],
    returnAddressName: 'Company HQ',
    returnAddressDetails: '3rd Floor, 123 Main St, Cape Town',
  };

  console.log('Patching user profile with delivery settings...');
  const patchRes = await fetch(`${BACKEND}/users/${user.uid}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(payload),
  });
  const patchJson = await patchRes.json();
  if (!patchRes.ok) {
    console.error('Failed to patch user profile', patchJson);
    process.exit(1);
  }
  console.log('Patch response:', patchJson);

  // GET and verify
  console.log('Fetching user and verifying fields...');
  const getRes = await fetch(`${BACKEND}/users/${user.uid}`);
  const getJson = await getRes.json();
  if (!getRes.ok) {
    console.error('Failed to fetch user after patch', getJson);
    process.exit(1);
  }

  const mismatches: string[] = [];
  if (getJson.deliveryInstructions !== payload.deliveryInstructions) mismatches.push('deliveryInstructions');
  if (!Array.isArray(getJson.preferredCarriers) || getJson.preferredCarriers.join(',') !== payload.preferredCarriers.join(',')) mismatches.push('preferredCarriers');
  if (getJson.returnAddressName !== payload.returnAddressName) mismatches.push('returnAddressName');
  if (getJson.returnAddressDetails !== payload.returnAddressDetails) mismatches.push('returnAddressDetails');

  if (mismatches.length === 0) {
    console.log('SUCCESS: Delivery settings persisted to backend ✅');
    console.log('Verified user payload:', {
      deliveryInstructions: getJson.deliveryInstructions,
      preferredCarriers: getJson.preferredCarriers,
      returnAddressName: getJson.returnAddressName,
      returnAddressDetails: getJson.returnAddressDetails,
    });
    process.exit(0);
  } else {
    console.error('MISMATCHES:', mismatches.join(', '));
    console.error('Fetched user:', getJson);
    process.exit(2);
  }
}

run().catch((e) => {
  console.error('Script error', e);
  process.exit(1);
});
