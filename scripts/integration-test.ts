import 'dotenv/config';
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { createServerInstance } from '../server/index';
import { createHmac } from 'crypto';

const API_KEY = process.env.FIREBASE_API_KEY!;
let BACKEND = process.env.REACT_APP_BACKEND_URL || `http://localhost:5000/api`;

async function getIdTokenFor(uidPrefix: string) {
  const email = `test+${uidPrefix}+${Date.now()}@example.com`;
  const password = 'Test12345!';
  let user;
  try {
    user = await admin.auth().getUserByEmail(email);
  } catch (e) {
    user = await admin.auth().createUser({ email, password });
  }
  const customToken = await admin.auth().createCustomToken(user.uid);
  const signInRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    }
  );
  const signInJson = await signInRes.json();
  return { idToken: signInJson.idToken, uid: user.uid, email };
}

async function requireOk(res: Response, name = 'request') {
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    console.error(`${name} failed:`, json);
    process.exit(1);
  }
  return json;
}

async function run() {
  // Init Firebase Admin
  const accountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || path.resolve(process.cwd(), 'server', 'firebase-service-account.json');
  if (!fs.existsSync(accountPath)) {
    console.error('Firebase service account not found at', accountPath);
    process.exit(1);
  }
  const serviceAccount = JSON.parse(fs.readFileSync(accountPath, 'utf8'));
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount as any) });

  // Start test server
  const port = parseInt(process.env.TEST_SERVER_PORT || '5004', 10);
  const server = await createServerInstance();
  await new Promise<void>((resolve, reject) => {
    server.listen({ port, host: '127.0.0.1' }, () => resolve());
    server.on('error', reject);
  });
  BACKEND = `http://127.0.0.1:${port}/api`;
  console.log(`Test server listening at ${BACKEND}`);

  // Create sender user
  const sender = await getIdTokenFor('sender');
  // Sync sender
  const syncRes = await fetch(`${BACKEND}/auth/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sender.idToken}` },
    body: JSON.stringify({ name: 'Sender', phone: null }),
  });
  const senderJson = await requireOk(syncRes, 'auth/sync (sender)');
  console.log('Sender synced', senderJson.id);

  // Create carrier user
  const carrier = await getIdTokenFor('carrier');
  const syncRes2 = await fetch(`${BACKEND}/auth/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${carrier.idToken}` },
    body: JSON.stringify({ name: 'Carrier', phone: null }),
  });
  const carrierJson = await requireOk(syncRes2, 'auth/sync (carrier)');
  console.log('Carrier synced', carrierJson.id);

  // Sender creates a parcel
  const parcelPayload = {
    origin: 'Cape Town, South Africa',
    destination: 'Johannesburg, South Africa',
    size: 'small',
    compensation: 1200,
    pickupDate: new Date().toISOString(),
    contactPhone: '+27821234567',
    description: 'Integration test parcel',
  };

  const createParcelRes = await fetch(`${BACKEND}/parcels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sender.idToken}` },
    body: JSON.stringify(parcelPayload),
  });
  const parcelJson = await requireOk(createParcelRes, 'create parcel');
  console.log('Created parcel', parcelJson.id);

  // Carrier creates a route
  const routePayload = {
    origin: 'Cape Town, South Africa',
    destination: 'Johannesburg, South Africa',
    departureDate: new Date().toISOString(),
    maxParcelSize: 'small',
  };
  const createRouteRes = await fetch(`${BACKEND}/routes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${carrier.idToken}` },
    body: JSON.stringify(routePayload),
  });
  const routeJson = await requireOk(createRouteRes, 'create route');
  console.log('Created route', routeJson.id);

  // Carrier checks matching parcels
  const matchesRes = await fetch(`${BACKEND}/routes/${routeJson.id}/matching-parcels`, {
    headers: { Authorization: `Bearer ${carrier.idToken}` },
  });
  const matches = await requireOk(matchesRes, 'matching parcels');
  console.log('Matching parcels count:', matches.length);
  if (!matches.some((m: any) => m.id === parcelJson.id)) {
    console.error('Parcel not found in matches');
    process.exit(1);
  }

  // Send a message (carrier -> parcel)
  const msg1Res = await fetch(`${BACKEND}/parcels/${parcelJson.id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${carrier.idToken}` },
    body: JSON.stringify({ content: 'I can carry this', senderRole: 'carrier' }),
  });
  const msg1 = await requireOk(msg1Res, 'send message (carrier)');
  console.log('Carrier sent message', msg1.id);

  // Sender sends a message
  const msg2Res = await fetch(`${BACKEND}/parcels/${parcelJson.id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sender.idToken}` },
    body: JSON.stringify({ content: 'Great, thanks', senderRole: 'sender' }),
  });
  const msg2 = await requireOk(msg2Res, 'send message (sender)');
  console.log('Sender sent message', msg2.id);

  // Fetch messages
  const getMsgsRes = await fetch(`${BACKEND}/parcels/${parcelJson.id}/messages`);
  const msgs = await requireOk(getMsgsRes, 'get messages');
  console.log('Messages fetched:', msgs.length);

  // Carrier posts carrier location
  const carrierLocRes = await fetch(`${BACKEND}/parcels/${parcelJson.id}/carrier-location`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${carrier.idToken}` },
    body: JSON.stringify({ lat: 9.0765, lng: 7.3986, heading: 90, speed: 40, accuracy: 5 }),
  });
  const carrierLoc = await requireOk(carrierLocRes, 'post carrier location');
  console.log('Carrier location saved id', carrierLoc.id);

  // Get carrier location
  const getCarrierLocRes = await fetch(`${BACKEND}/parcels/${parcelJson.id}/carrier-location`);
  const cloc = await requireOk(getCarrierLocRes, 'get carrier location');
  console.log('Carrier location fetched', cloc.id);

  // Sender posts receiver location
  const receiverLocRes = await fetch(`${BACKEND}/parcels/${parcelJson.id}/receiver-location`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sender.idToken}` },
    body: JSON.stringify({ lat: 9.0765, lng: 7.3986, accuracy: 5 }),
  });
  const receiverLoc = await requireOk(receiverLocRes, 'post receiver location');
  console.log('Receiver location saved id', receiverLoc.id);

  // Get receiver location
  const getReceiverLocRes = await fetch(`${BACKEND}/parcels/${parcelJson.id}/receiver-location`);
  const rloc = await requireOk(getReceiverLocRes, 'get receiver location');
  console.log('Receiver location fetched', rloc.id);

  // Initialize payment (sender)
  const amount = Math.round(parcelPayload.compensation);
  const initRes = await fetch(`${BACKEND}/payments/initialize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sender.idToken}` },
    body: JSON.stringify({ amount, email: sender.email, metadata: { parcelId: parcelJson.id } }),
  });
  const initJson = await requireOk(initRes, 'payment initialize');
  console.log('Payment initialized', initJson.reference || initJson.data?.reference || initJson.access_code);
  const reference = initJson?.data?.reference || initJson.reference || initJson.access_code || initJson.data?.access_code;

  // Confirm payment record pending
  const hist1Res = await fetch(`${BACKEND}/payments/history`, { headers: { Authorization: `Bearer ${sender.idToken}` } });
  const hist1 = await requireOk(hist1Res, 'payment history (before)');
  console.log('Payments before webhook:', hist1.map((p: any) => ({ id: p.id, status: p.status })));

  // Simulate Paystack webhook
  const payload = { event: 'charge.success', data: { reference, status: 'success', amount: amount * 100, metadata: { parcelId: parcelJson.id } } };
  const signature = createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!).update(JSON.stringify(payload)).digest('hex');
  const webhookRes = await fetch(`${BACKEND}/payments/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-paystack-signature': signature },
    body: JSON.stringify(payload),
  });
  const webhookJson = await requireOk(webhookRes, 'paystack webhook');
  console.log('Webhook processed', webhookJson);

  // Check payments after webhook
  const hist2Res = await fetch(`${BACKEND}/payments/history`, { headers: { Authorization: `Bearer ${sender.idToken}` } });
  const hist2 = await requireOk(hist2Res, 'payment history (after)');
  console.log('Payments after webhook:', hist2.map((p: any) => ({ id: p.id, status: p.status })));

  // Verify parcel status updated to Paid
  const parcelCheckRes = await fetch(`${BACKEND}/parcels/${parcelJson.id}`);
  const parcelCheck = await requireOk(parcelCheckRes, 'get parcel');
  console.log('Parcel status:', parcelCheck.status);

  // Test receipt endpoint (get latest payment id)
  const paymentId = hist2[0]?.id;
  if (paymentId) {
    const receiptRes = await fetch(`${BACKEND}/payments/${paymentId}/receipt`, { headers: { Authorization: `Bearer ${sender.idToken}` } });
    const receiptHtml = await receiptRes.text();
    if (!receiptHtml.includes('Payment Receipt')) {
      console.error('Receipt content unexpected');
      process.exit(1);
    }
    console.log('Receipt generated for payment', paymentId);
  }

  console.log('Integration test flow complete ✅');
  process.exit(0);
}

run().catch((e) => {
  console.error('Integration test error', e);
  process.exit(1);
});
