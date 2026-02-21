import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Interaction,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
} from "discord.js";
import { EconomyService } from "../../services/economy/EconomyService";
import { checkCooldown } from "../../middleware/cooldowns";
import { UI } from "../../utils/ui";

type MinesGame = {
  id: string;
  userId: string;
  amount: number;
  startedAt: number;
  bombs: Set<number>; // 0..26
  revealedSafe: Set<number>;
  revealedBomb?: number;
  layer: 0 | 1 | 2;
};

const econ = new EconomyService();
const games = new Map<string, MinesGame>(); // userId -> game
const gameTimers = new Map<string, NodeJS.Timeout>();

const PREFIX = "mines";

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

function pos(layer: number, row: number, col: number) {
  return layer * 9 + row * 3 + col;
}

function renderGrid(g: MinesGame) {
  const rows: Array<ActionRowBuilder<ButtonBuilder>> = [];
  for (let r = 0; r < 3; r++) {
    const row = new ActionRowBuilder<ButtonBuilder>();
    for (let c = 0; c < 3; c++) {
      const p = pos(g.layer, r, c);
      const revealed = g.revealedSafe.has(p) || g.revealedBomb === p;
      const isBomb = g.bombs.has(p);
      const label = revealed ? (isBomb ? "💣" : "✅") : "⬛";
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`${PREFIX}:${g.userId}:${g.id}:pick:${p}`)
          .setLabel(label)
          .setStyle(revealed ? (isBomb ? ButtonStyle.Danger : ButtonStyle.Success) : ButtonStyle.Secondary)
          .setDisabled(revealed || !!g.revealedBomb)
      );
    }
    rows.push(row);
  }
  return rows;
}

function renderLayerMenu(g: MinesGame) {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`${PREFIX}:${g.userId}:${g.id}:layer`)
      .setPlaceholder("Select layer")
      .addOptions(
        { label: "Layer 1", value: "0", default: g.layer === 0 },
        { label: "Layer 2", value: "1", default: g.layer === 1 },
        { label: "Layer 3", value: "2", default: g.layer === 2 }
      )
  );
}

function embedFor(g: MinesGame, status?: string) {
  const safeTotal = 27 - 9; // 9 bombs fixed
  const safeFound = g.revealedSafe.size;
  const done = !!g.revealedBomb || safeFound >= safeTotal;
  const title = "💣 Mines (3×3×3)";
  const desc = [
    `Wager: **${g.amount}** ${UI.emojis.creditz}`,
    `Bombs: **9** | Safe: **${safeTotal}**`,
    `Safe found: **${safeFound}/${safeTotal}**`,
    "",
    status ?? (done ? "" : "Pick tiles — avoid bombs."),
  ]
    .filter(Boolean)
    .join("\n");

  return new EmbedBuilder()
    .setColor(done ? (g.revealedBomb ? UI.colors.bad : UI.colors.good) : UI.colors.accent)
    .setTitle(title)
    .setDescription(desc)
    .setFooter({ text: UI.footer });
}

function cleanup(userId: string) {
  games.delete(userId);
  const t = gameTimers.get(userId);
  if (t) clearTimeout(t);
  gameTimers.delete(userId);
}

function scheduleExpiry(userId: string) {
  const t = setTimeout(() => cleanup(userId), 10 * 60 * 1000);
  gameTimers.set(userId, t);
}

function randomBombs(): Set<number> {
  const set = new Set<number>();
  while (set.size < 9) {
    set.add(Math.floor(Math.random() * 27));
  }
  return set;
}

export const minesCommand = {
  data: new SlashCommandBuilder()
    .setName("mines")
    .setDescription("Interactive mines game (3x3x3). Win: 10x")
    .addIntegerOption((o) => o.setName("amount").setDescription("Wager amount").setRequired(true).setMinValue(1)),

  customId: PREFIX,

  async execute(interaction: Interaction) {
    // Start game
    if (interaction.isChatInputCommand()) {
      const cd = checkCooldown(`mines:${interaction.user.id}`, 2000);
      if ("error" in cd) return interaction.reply({ content: cd.error, ephemeral: true });

      const amount = interaction.options.getInteger("amount", true);
      if (games.has(interaction.user.id)) {
        return interaction.reply({ content: "You already have an active mines game.", ephemeral: true });
      }

      const debit = await econ.debitIfEnough(interaction.user.id, amount);
      if ("error" in debit) return interaction.reply({ content: debit.error, ephemeral: true });

      const g: MinesGame = {
        id: newId(),
        userId: interaction.user.id,
        amount,
        startedAt: Date.now(),
        bombs: randomBombs(),
        revealedSafe: new Set<number>(),
        layer: 0,
      };
      games.set(interaction.user.id, g);
      scheduleExpiry(interaction.user.id);

      const components = [renderLayerMenu(g), ...renderGrid(g)];
      return interaction.reply({
        embeds: [embedFor(g)],
        components,
        ephemeral: true,
      });
    }

    // Layer switch (select menu)
    if (interaction.isStringSelectMenu()) {
      const parts = interaction.customId.split(":");
      if (parts[0] !== PREFIX) return;
      const userId = parts[1];
      const gameId = parts[2];
      if (interaction.user.id !== userId) return interaction.reply({ content: "This isn't your game.", ephemeral: true });

      const g = games.get(userId);
      if (!g || g.id !== gameId) return interaction.reply({ content: "That mines game expired.", ephemeral: true });
      if (g.revealedBomb) return interaction.reply({ content: "Game already ended.", ephemeral: true });

      const layer = Number(interaction.values?.[0] ?? 0);
      g.layer = (layer === 1 ? 1 : layer === 2 ? 2 : 0) as 0 | 1 | 2;

      return (interaction as StringSelectMenuInteraction).update({
        embeds: [embedFor(g)],
        components: [renderLayerMenu(g), ...renderGrid(g)],
      });
    }

    // Tile pick (button)
    if (interaction.isButton()) {
      const parts = interaction.customId.split(":");
      if (parts[0] !== PREFIX) return;
      const userId = parts[1];
      const gameId = parts[2];
      const action = parts[3];
      const arg = parts[4];
      if (action !== "pick") return;
      if (interaction.user.id !== userId) return interaction.reply({ content: "This isn't your game.", ephemeral: true });

      const g = games.get(userId);
      if (!g || g.id !== gameId) return interaction.reply({ content: "That mines game expired.", ephemeral: true });

      const p = Number(arg);
      if (!Number.isFinite(p) || p < 0 || p > 26) return interaction.reply({ content: "Invalid tile.", ephemeral: true });
      if (g.revealedBomb) return interaction.reply({ content: "Game already ended.", ephemeral: true });
      if (g.revealedSafe.has(p)) {
        return interaction.reply({ content: "Already revealed.", ephemeral: true });
      }

      const safeTotal = 27 - 9;
      if (g.bombs.has(p)) {
        g.revealedBomb = p;
        const status = `💥 You hit a bomb and lost **${g.amount}** ${UI.emojis.creditz}.`;
        cleanup(userId);
        return interaction.update({
          embeds: [embedFor(g, status)],
          components: [renderLayerMenu(g), ...renderGrid(g)],
        });
      }

      g.revealedSafe.add(p);
      if (g.revealedSafe.size >= safeTotal) {
        const payout = g.amount * 10;
        const newBalance = await econ.add(userId, payout);
        const status = `🏆 You cleared all safe tiles! Won **${payout}** ${UI.emojis.creditz} *(10x)*\nBalance: **${newBalance}** ${UI.emojis.creditz}`;
        cleanup(userId);
        return interaction.update({
          embeds: [embedFor(g, status)],
          components: [renderLayerMenu(g), ...renderGrid(g)],
        });
      }

      return interaction.update({
        embeds: [embedFor(g)],
        components: [renderLayerMenu(g), ...renderGrid(g)],
      });
    }
  },
};
