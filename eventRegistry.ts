import type { Client } from "discord.js";
import { logger } from "../utils/logger";

export function registerEventHandlers(client: Client) {
  client.on("shardError", (error) => logger.error("Shard error", { err: error }));
  client.on("shardDisconnect", (_, shardId) => logger.warn("Shard disconnected", { shardId }));
  client.on("shardReconnecting", (shardId) => logger.info("Shard reconnecting", { shardId }));
  client.on("rateLimit", (data) => logger.warn("Discord rate limit", data as any));
}
