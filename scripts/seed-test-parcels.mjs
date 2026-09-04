import pg from "pg";
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const TEST_USERS = [
  {
    id: "test-sender-001",
    name: "Sipho Nkosi",
    email: "sipho.test@parcelpeer.dev",
    phone: "+27821234567",
    passwordHash: "firebase-auth",
    rating: 4.8,
    verified: true,
    walletBalance: 500,
    subscriptionStatus: "free",
  },
  {
    id: "test-sender-002",
    name: "Amahle Dlamini",
    email: "amahle.test@parcelpeer.dev",
    phone: "+27831234567",
    passwordHash: "firebase-auth",
    rating: 4.5,
    verified: true,
    walletBalance: 250,
    subscriptionStatus: "free",
  },
];

const now = new Date();
const tomorrow = new Date(now.getTime() + 86400000);
const nextWeek = new Date(now.getTime() + 7 * 86400000);

const TEST_PARCELS = [
  {
    origin: "Cape Town CBD, Cape Town, Western Cape",
    destination: "Stellenbosch, Western Cape",
    originLat: -33.9249,
    originLng: 18.4241,
    destinationLat: -33.9321,
    destinationLng: 18.8602,
    size: "small",
    compensation: 85,
    description: "Important documents, handle with care",
    status: "Paid",
    pickupDate: now,
    deliveryWindowEnd: tomorrow,
    senderId: "test-sender-001",
  },
  {
    origin: "Johannesburg, Sandton, Gauteng",
    destination: "Pretoria CBD, Pretoria, Gauteng",
    originLat: -26.1076,
    originLng: 28.0567,
    destinationLat: -25.7461,
    destinationLng: 28.1881,
    size: "medium",
    compensation: 150,
    description: "Electronics - fragile",
    isFragile: true,
    status: "In Transit",
    pickupDate: now,
    deliveryWindowEnd: tomorrow,
    senderId: "test-sender-001",
    transporterId: "test-sender-002",
  },
  {
    origin: "Durban Harbour, Durban, KwaZulu-Natal",
    destination: "Umhlanga Rocks, KwaZulu-Natal",
    originLat: -29.8587,
    originLng: 31.0218,
    destinationLat: -29.7271,
    destinationLng: 31.0765,
    size: "large",
    compensation: 320,
    description: "Household items for relocation",
    status: "Pending",
    pickupDate: tomorrow,
    deliveryWindowEnd: nextWeek,
    senderId: "test-sender-002",
  },
  {
    origin: "Soweto, Gauteng",
    destination: "Johannesburg CBD, Gauteng",
    originLat: -26.2677,
    originLng: 27.8534,
    destinationLat: -26.2041,
    destinationLng: 28.0473,
    size: "small",
    compensation: 60,
    description: "Birthday gift - surprise inside!",
    status: "Delivered",
    pickupDate: new Date(now.getTime() - 2 * 86400000),
    deliveryWindowEnd: new Date(now.getTime() - 86400000),
    senderId: "test-sender-001",
    transporterId: "test-sender-002",
  },
  {
    origin: "Port Elizabeth CBD, Gqeberha, Eastern Cape",
    destination: "East London CBD, East London, Eastern Cape",
    originLat: -33.9608,
    originLng: 25.6022,
    destinationLat: -32.9617,
    destinationLng: 27.8629,
    size: "medium",
    compensation: 280,
    description: "Clothing and accessories",
    status: "Paid",
    pickupDate: tomorrow,
    deliveryWindowEnd: nextWeek,
    senderId: "test-sender-002",
  },
  {
    origin: "Bloemfontein CBD, Free State",
    destination: "Kimberley, Northern Cape",
    originLat: -29.1213,
    originLng: 26.2145,
    destinationLat: -28.7323,
    destinationLng: 24.7553,
    size: "large",
    compensation: 450,
    description: "Automotive parts - heavy cargo",
    status: "Accepted",
    pickupDate: now,
    deliveryWindowEnd: nextWeek,
    senderId: "test-sender-001",
    transporterId: "test-sender-002",
  },
  {
    origin: "Waterfront, Cape Town, Western Cape",
    destination: "Paarl, Western Cape",
    originLat: -33.9011,
    originLng: 18.4200,
    destinationLat: -33.7271,
    destinationLng: 18.9536,
    size: "small",
    compensation: 95,
    description: "Wine bottles x4 - fragile",
    isFragile: true,
    status: "Paid",
    pickupDate: tomorrow,
    deliveryWindowEnd: nextWeek,
    senderId: "test-sender-002",
  },
  {
    origin: "Sandton City, Johannesburg, Gauteng",
    destination: "OR Tambo Airport, Ekurhuleni, Gauteng",
    originLat: -26.1070,
    originLng: 28.0587,
    destinationLat: -26.1345,
    destinationLng: 28.2467,
    size: "medium",
    compensation: 120,
    description: "Business documents - urgent delivery",
    status: "Picked Up",
    pickupDate: now,
    deliveryWindowEnd: tomorrow,
    senderId: "test-sender-001",
    transporterId: "test-sender-002",
  },
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const user of TEST_USERS) {
      await client.query(
        `INSERT INTO users (id, name, email, phone, rating, verified, wallet_balance, subscription_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email`,
        [user.id, user.name, user.email, user.phone, user.rating, user.verified, user.walletBalance, user.subscriptionStatus]
      );
      console.log(`Upserted user: ${user.name}`);
    }

    for (const parcel of TEST_PARCELS) {
      const result = await client.query(
        `INSERT INTO parcels (
          origin, destination, origin_lat, origin_lng, destination_lat, destination_lng,
          size, compensation, description, is_fragile, status,
          pickup_date, delivery_window_end, sender_id, transporter_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        RETURNING id`,
        [
          parcel.origin,
          parcel.destination,
          parcel.originLat,
          parcel.originLng,
          parcel.destinationLat,
          parcel.destinationLng,
          parcel.size,
          parcel.compensation,
          parcel.description,
          parcel.isFragile || false,
          parcel.status,
          parcel.pickupDate,
          parcel.deliveryWindowEnd,
          parcel.senderId,
          parcel.transporterId || null,
        ]
      );
      console.log(`Created parcel: ${parcel.origin} → ${parcel.destination} [${parcel.status}] id=${result.rows[0].id}`);
    }

    await client.query("COMMIT");
    console.log("\nSeed complete! Created 2 test users and 8 test parcels.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Seed failed:", err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
