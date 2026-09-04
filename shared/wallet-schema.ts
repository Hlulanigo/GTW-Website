import { pgTable, varchar, text, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";
import { sql, relations } from "drizzle-orm";
import { users } from "./schema";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const transactionTypeEnum = pgEnum("transaction_type", ["topup", "debit", "refund", "bonus"]);
export const transactionStatusEnum = pgEnum("transaction_status", ["pending", "completed", "failed", "cancelled"]);

// Wallet transactions table
export const walletTransactions = pgTable("wallet_transactions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: transactionTypeEnum("type").notNull(),
  amount: integer("amount").notNull(), // Amount in cents/smallest unit
  currency: text("currency").notNull().default("ZAR"), // ZAR, USD, EUR, GBP
  status: transactionStatusEnum("status").notNull().default("pending"),
  reference: text("reference").notNull().unique(),
  description: text("description"),
  metadata: text("metadata"), // JSON string for additional data
  paymentMethod: text("payment_method"), // paystack, stripe, etc.
  paymentData: text("payment_data"), // JSON string from payment provider
  balanceBefore: integer("balance_before").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const walletTransactionsRelations = relations(walletTransactions, ({ one }) => ({
  user: one(users, {
    fields: [walletTransactions.userId],
    references: [users.id],
  }),
}));

export const insertWalletTransactionSchema = createInsertSchema(walletTransactions).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export type InsertWalletTransaction = z.infer<typeof insertWalletTransactionSchema>;
export type WalletTransaction = typeof walletTransactions.$inferSelect;
