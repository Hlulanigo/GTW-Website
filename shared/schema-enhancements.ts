import { pgTable, varchar, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { parcels, users } from "./schema";

// New table for delivery proof photos
export const deliveryProofs = pgTable("delivery_proofs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  parcelId: varchar("parcel_id").notNull().references(() => parcels.id),
  uploadedBy: varchar("uploaded_by").notNull().references(() => users.id),
  photoUrl: text("photo_url").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  notes: text("notes"),
});

// Receiver confirmation requests
export const receiverConfirmations = pgTable("receiver_confirmations", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  parcelId: varchar("parcel_id").notNull().references(() => parcels.id),
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
