import 'dotenv/config';
import { storage, db } from '../server/storage';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';

async function run() {
  const id = `test-delivery-${Date.now()}`;
  const email = `${id}@example.com`;

  console.log('Creating test user directly in DB with id', id);
  try {
    await storage.createUser({
      id,
      name: 'Storage Delivery Tester',
      email,
      phone: null,
      rating: 5.0,
      verified: false,
      emailVerified: false,
      walletBalance: 0,
      subscriptionStatus: 'free',
    });
  } catch (e: any) {
    if (!e?.message?.includes('duplicate')) {
      console.error('Failed to create user:', e);
      process.exit(1);
    }
  }

  const payload = {
    deliveryInstructions: 'Leave at the concierge desk; call before arrival',
    preferredCarriers: ['DHL Express', 'Local Couriers'],
    returnAddressName: 'Main Office',
    returnAddressDetails: '3rd Floor, 123 Main St, Cape Town',
  };

  console.log('Updating user fields via DB update...');
  try {
    await db.update(users).set(payload).where(eq(users.id, id)).returning();
  } catch (e: any) {
    console.error('DB update failed:', e);
    process.exit(1);
  }

  console.log('Fetching user to verify...');
  const user = await storage.getUser(id);
  if (!user) {
    console.error('User not found after update');
    process.exit(1);
  }

  const mismatches = [] as string[];
  if (user.deliveryInstructions !== payload.deliveryInstructions) mismatches.push('deliveryInstructions');
  if (!Array.isArray(user.preferredCarriers) || user.preferredCarriers.join(',') !== payload.preferredCarriers.join(',')) mismatches.push('preferredCarriers');
  if (user.returnAddressName !== payload.returnAddressName) mismatches.push('returnAddressName');
  if (user.returnAddressDetails !== payload.returnAddressDetails) mismatches.push('returnAddressDetails');

  if (mismatches.length === 0) {
    console.log('SUCCESS: Storage-level delivery settings persisted ✅');
    console.log({ deliveryInstructions: user.deliveryInstructions, preferredCarriers: user.preferredCarriers, returnAddressName: user.returnAddressName, returnAddressDetails: user.returnAddressDetails });
    process.exit(0);
  } else {
    console.error('MISMATCH:', mismatches.join(', '));
    console.error('User:', user);
    process.exit(2);
  }
}

run().catch((e) => {
  console.error('Script error', e);
  process.exit(1);
});
