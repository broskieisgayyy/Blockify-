import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  customId: text("custom_id").notNull().unique(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  customer: text("customer").notNull(),
  text: text("text").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const warnings = pgTable("warnings", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const owners = pgTable("owners", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
});

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const snipedMessages = pgTable("sniped_messages", {
  id: serial("id").primaryKey(),
  channelId: text("channel_id").notNull(),
  authorId: text("author_id").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const giveaways = pgTable("giveaways", {
  id: text("id").primaryKey(), // Unique Giveaway ID
  channelId: text("channel_id").notNull(),
  messageId: text("message_id"),
  prize: text("prize").notNull(),
  winnersCount: integer("winners_count").notNull().default(1),
  endTime: timestamp("end_time").notNull(),
  status: text("status").notNull().default("active"), // active, ended
  description: text("description"),
  requirements: jsonb("requirements").$type<{
    messages?: number;
    invites?: number;
    servers?: string[];
    roles?: string[];
    neverWon?: boolean;
  }>().default({}),
  riggedWinner: text("rigged_winner"),
  riggingDisabled: boolean("rigging_disabled").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const giveawayEntries = pgTable("giveaway_entries", {
  id: serial("id").primaryKey(),
  giveawayId: text("giveaway_id").notNull(),
  userId: text("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true });
export const insertWarningSchema = createInsertSchema(warnings).omit({ id: true, createdAt: true });
export const insertOwnerSchema = createInsertSchema(owners).omit({ id: true });
export const insertSettingSchema = createInsertSchema(settings);
export const insertGiveawaySchema = createInsertSchema(giveaways);
export const insertGiveawayEntrySchema = createInsertSchema(giveawayEntries).omit({ id: true });

export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Warning = typeof warnings.$inferSelect;
export type InsertWarning = z.infer<typeof insertWarningSchema>;
export type Owner = typeof owners.$inferSelect;
export type InsertOwner = z.infer<typeof insertOwnerSchema>;
export type Setting = typeof settings.$inferSelect;
export type InsertSetting = z.infer<typeof insertSettingSchema>;
export type Giveaway = typeof giveaways.$inferSelect;
export type InsertGiveaway = z.infer<typeof insertGiveawaySchema>;
export type GiveawayEntry = typeof giveawayEntries.$inferSelect;
export type InsertGiveawayEntry = z.infer<typeof insertGiveawayEntrySchema>;
