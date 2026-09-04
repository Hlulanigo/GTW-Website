import { pgTable, varchar, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { parcels, users } from "./schema";

// Re-exported from ./schema (single source of truth)
export { deliveryProofs } from "./schema";

// Receiver confirmation requests (created before a parcel exists, so parcel_id is nullable)
export const receiverConfirmations = pgTable("receiver_confirmations", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  parcelId: varchar("parcel_id").references(() => parcels.id),
  receiverEmail: text("receiver_email").notNull(),
  confirmed: boolean("confirmed").default(false),
  confirmedAt: timestamp("confirmed_at"),
  requestedAt: timestamp("requested_at").defaultNow(),
  token: text("token").notNull().unique(),
});

// Notification queue
export const notificationQueue = pgTable("notification_queue", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  body: text("body").notNull(),
  data: text("data"), // JSON string
  sent: boolean("sent").default(false),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
});
