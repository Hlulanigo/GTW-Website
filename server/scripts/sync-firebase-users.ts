import "dotenv/config";
import * as admin from "firebase-admin";
import { db } from "../storage";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

async function syncFirebaseUsers() {
  let serviceAccount: any = null;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  } else {
    const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
      path.resolve(process.cwd(), "server", "firebase-service-account.json");
    if (fs.existsSync(filePath)) {
      serviceAccount = JSON.parse(fs.readFileSync(filePath, "utf8"));
    }
  }

  if (!serviceAccount?.project_id) {
    console.error("No Firebase service account credentials found.");
    process.exit(1);
  }

  const app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  const auth = app.auth();

  console.log("Fetching all Firebase users...");

  let totalSynced = 0;
  let totalSkipped = 0;
  let pageToken: string | undefined = undefined;

  do {
    const listResult = await auth.listUsers(1000, pageToken);

    for (const firebaseUser of listResult.users) {
      if (!firebaseUser.email) {
        totalSkipped++;
        continue;
      }

      const existing = await db
        .select()
        .from(users)
        .where(eq(users.id, firebaseUser.uid))
        .limit(1);

      if (existing.length > 0) {
        console.log(`  ↳ Already exists: ${firebaseUser.email}`);
        totalSkipped++;
        continue;
      }

      const emailExists = await db
        .select()
        .from(users)
        .where(eq(users.email, firebaseUser.email))
        .limit(1);

      if (emailExists.length > 0) {
        console.log(`  ↳ Email already used: ${firebaseUser.email}`);
        totalSkipped++;
        continue;
      }

      const name =
        firebaseUser.displayName ||
        firebaseUser.email.split("@")[0] ||
        "User";

      await db.insert(users).values({
        id: firebaseUser.uid,
        name,
        email: firebaseUser.email,
        phone: firebaseUser.phoneNumber || null,
        photoUrl: firebaseUser.photoURL || null,
        rating: 5.0,
        verified: false,
        emailVerified: firebaseUser.emailVerified || false,
        walletBalance: 0,
        subscriptionStatus: "free",
        profileVisibility: "public",
      } as any);

      console.log(`  ✓ Synced: ${firebaseUser.email} (${name})`);
      totalSynced++;
    }

    pageToken = listResult.pageToken;
  } while (pageToken);

  console.log("\n--- Sync Complete ---");
  console.log(`✓ Synced:  ${totalSynced} users`);
  console.log(`↳ Skipped: ${totalSkipped} users (already existed or no email)`);

  await app.delete();
  process.exit(0);
}

syncFirebaseUsers().catch((err) => {
  console.error("Sync failed:", err);
  process.exit(1);
});
