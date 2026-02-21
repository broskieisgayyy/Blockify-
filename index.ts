import {
  Client,
  Collection,
  GatewayIntentBits,
  Interaction,
  REST,
  Routes,
} from "discord.js";
import * as dotenv from "dotenv";
import { loadCommands } from "./registry/commandRegistry";
import { registerEventHandlers } from "./registry/eventRegistry";
import { logger } from "./utils/logger";

dotenv.config();

declare module "discord.js" {
  interface Client {
    commands: Collection<string, any>;
  }
}

export async function startBot(): Promise<void> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    logger.error("DISCORD_BOT_TOKEN missing in environment");
    return;
  }

  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
    shards: "auto",
  });

  client.commands = new Collection();

  const { commands, commandData } = await loadCommands();
  client.commands = commands;

  registerEventHandlers(client);

  client.on("interactionCreate", async (interaction: Interaction) => {
    if (
      !interaction.isChatInputCommand() &&
      !interaction.isStringSelectMenu() &&
      !interaction.isButton()
    )
      return;

    try {
      const key = interaction.isChatInputCommand()
        ? interaction.commandName
        : interaction.customId.split(":")[0];
      const handler = client.commands.get(key);
      if (!handler) return;
      await handler.execute(interaction, client);
    } catch (err) {
      logger.error("Unhandled interaction error", { err });
      try {
        if (interaction.isRepliable()) {
          const msg = "Something went wrong while running that command.";
          if (interaction.deferred || interaction.replied) {
            await interaction.followUp({ content: msg, ephemeral: true });
          } else {
            await interaction.reply({ content: msg, ephemeral: true });
          }
        }
      } catch {
        // swallow
      }
    }
  });

  client.once("ready", async () => {
    logger.info(`Logged in as ${client.user?.tag}`);
    await registerSlashCommands(token, client.user!.id, commandData);
  });

  client.on("error", (e) => logger.error("Discord client error", { err: e }));
  client.on("warn", (w) => logger.warn("Discord client warn", { warn: w }));

  // Anti-crash safeguards
  process.on("unhandledRejection", (reason) => logger.error("unhandledRejection", { reason }));
  process.on("uncaughtException", (err) => logger.error("uncaughtException", { err }));

  await client.login(token);
}

async function registerSlashCommands(token: string, appId: string, body: any[]) {
  const rest = new REST({ version: "10" }).setToken(token);

  const guildId = process.env.DISCORD_GUILD_ID;
  try {
    if (guildId) {
      await rest.put(Routes.applicationGuildCommands(appId, guildId), { body });
      logger.info("Registered slash commands (guild)", { guildId, count: body.length });
    } else {
      await rest.put(Routes.applicationCommands(appId), { body });
      logger.info("Registered slash commands (global)", { count: body.length });
    }
  } catch (err) {
    logger.error("Failed to register slash commands", { err });
  }
}
