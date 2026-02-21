import { db } from "./db";
import {
  orders, warnings, owners, settings, giveaways, giveawayEntries,
  type Order, type InsertOrder,
  type Warning, type InsertWarning,
  type Owner, type InsertOwner,
  type Setting, type InsertSetting,
  type Giveaway, type InsertGiveaway,
  type GiveawayEntry, type InsertGiveawayEntry
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // Orders
  getOrders(): Promise<Order[]>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrderStatus(id: number, status: string): Promise<Order>;
  getLatestOrder(userId: string): Promise<Order | undefined>;
  cancelLatestOrder(userId: string): Promise<Order | undefined>;
  getOrderByCustomId(customId: string): Promise<Order | undefined>;
  
  // Warnings
  getWarnings(userId: string): Promise<Warning[]>;
  createWarning(warning: InsertWarning): Promise<Warning>;
  
  // Owners
  getOwners(): Promise<Owner[]>;
  addOwner(owner: InsertOwner): Promise<Owner>;
  isOwner(userId: string): Promise<boolean>;
  
  // Settings
  getSetting(key: string): Promise<Setting | undefined>;
  setSetting(setting: InsertSetting): Promise<Setting>;

  // Giveaways
  getGiveaway(id: string): Promise<Giveaway | undefined>;
  createGiveaway(gw: InsertGiveaway): Promise<Giveaway>;
  updateGiveaway(id: string, data: Partial<Giveaway>): Promise<Giveaway>;
  addGiveawayEntry(entry: InsertGiveawayEntry): Promise<GiveawayEntry>;
  getGiveawayEntries(giveawayId: string): Promise<GiveawayEntry[]>;
}

export class DatabaseStorage implements IStorage {
  async getOrders(): Promise<Order[]> {
    return await db.select().from(orders).orderBy(desc(orders.createdAt));
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const [newOrder] = await db.insert(orders).values(order).returning();
    return newOrder;
  }

  async updateOrderStatus(id: number, status: string): Promise<Order> {
    const [updated] = await db.update(orders)
      .set({ status })
      .where(eq(orders.id, id))
      .returning();
    return updated;
  }

  async getLatestOrder(userId: string): Promise<Order | undefined> {
    const [latest] = await db.select()
      .from(orders)
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt))
      .limit(1);
    return latest;
  }

  async cancelLatestOrder(userId: string): Promise<Order | undefined> {
    const latest = await this.getLatestOrder(userId);
    if (!latest || latest.status !== 'pending') return undefined;
    return await this.updateOrderStatus(latest.id, 'cancelled');
  }

  async getOrderByCustomId(customId: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.customId, customId));
    return order;
  }

  async getWarnings(userId: string): Promise<Warning[]> {
    return await db.select().from(warnings).where(eq(warnings.userId, userId));
  }

  async createWarning(warning: InsertWarning): Promise<Warning> {
    const [newWarning] = await db.insert(warnings).values(warning).returning();
    return newWarning;
  }

  async getOwners(): Promise<Owner[]> {
    return await db.select().from(owners);
  }

  async addOwner(owner: InsertOwner): Promise<Owner> {
    const [newOwner] = await db.insert(owners).values(owner).onConflictDoNothing().returning();
    return newOwner;
  }

  async isOwner(userId: string): Promise<boolean> {
    const [owner] = await db.select().from(owners).where(eq(owners.userId, userId));
    return !!owner;
  }

  async getSetting(key: string): Promise<Setting | undefined> {
    const [setting] = await db.select().from(settings).where(eq(settings.key, key));
    return setting;
  }

  async setSetting(setting: InsertSetting): Promise<Setting> {
    const [newSetting] = await db.insert(settings)
      .values(setting)
      .onConflictDoUpdate({ target: settings.key, set: { value: setting.value } })
      .returning();
    return newSetting;
  }

  async getGiveaway(id: string): Promise<Giveaway | undefined> {
    const [gw] = await db.select().from(giveaways).where(eq(giveaways.id, id));
    return gw;
  }

  async createGiveaway(gw: InsertGiveaway): Promise<Giveaway> {
    const [newGw] = await db.insert(giveaways).values(gw).returning();
    return newGw;
  }

  async updateGiveaway(id: string, data: Partial<Giveaway>): Promise<Giveaway> {
    const [updated] = await db.update(giveaways).set(data).where(eq(giveaways.id, id)).returning();
    if (!updated) throw new Error(`Giveaway with ID ${id} not found`);
    return updated;
  }

  async addGiveawayEntry(entry: InsertGiveawayEntry): Promise<GiveawayEntry> {
    const [newEntry] = await db.insert(giveawayEntries).values(entry).returning();
    return newEntry;
  }

  async getGiveawayEntries(giveawayId: string): Promise<GiveawayEntry[]> {
    return await db.select().from(giveawayEntries).where(eq(giveawayEntries.giveawayId, giveawayId));
  }
}

export const storage = new DatabaseStorage();
