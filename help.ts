import {
  ActionRowBuilder,
  EmbedBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
  ChatInputCommandInteraction,
} from "discord.js";
import { UI } from "../utils/ui";

const MENU_ID = "help_menu";

const categories = [
  {
    label: "Economy",
    value: "economy",
    description: "Balance, pay, daily, codes, leaderboard",
    emoji: "💰",
  },
  {
    label: "Fun commands",
    value: "fun",
    description: "Games & wagers (Pro Creditz)",
    emoji: "🎮",
  },
  {
    label: "Owner Economy",
    value: "owner_economy",
    description: "Admin tools for Pro Creditz",
    emoji: "👑",
  },
];

function buildMenu(selected?: string) {
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(MENU_ID)
      .setPlaceholder("Select a category")
      .addOptions(
        categories.map((c) => ({
          label: c.label,
          value: c.value,
          description: c.description,
          emoji: c.emoji,
          default: selected === c.value,
        }))
      )
  );
}

function categoryEmbed(value: string) {
  const base = new EmbedBuilder()
    .setColor(UI.colors.accent)
    .setFooter({ text: UI.footer });

  if (value === "economy") {
    return base
      .setTitle("💰 Economy")
      .setDescription(
        [
          `**Pro Creditz** ${UI.emojis.creditz}`,
          "",
          "`/balance [user]` — check balance",
          "`/pay <user> <amount>` — transfer creditz *(1x per 24h per target)*",
          "`/daily` — claim daily rewards (streak-based)",
          "`/usecode <code>` — claim a one-time code",
          "`/leaderboard` — top global balances",
        ].join("\n")
      );
  }

  if (value === "owner_economy") {
    return base
      .setTitle("👑 Owner Economy")
      .setDescription(
        [
          "`/addeco <user> <amount>` — add creditz",
          "`/take-eco <user> <amount>` — remove creditz",
          "`/set-eco <user> <amount>` — set balance",
          "`/code-create <code> <creditz> [expiry_hours]` — create redeem code",
          "`/expire <code>` — expire code",
        ].join("\n")
      );
  }

  // fun
  return base
    .setTitle("🎮 Fun commands")
    .setDescription(
      [
        `All wagers use **Pro Creditz** ${UI.emojis.creditz}`,
        "",
        "`/coinflip <amount> <h|t>` — wager (win: 2x)",
        "`/mines <amount>` — interactive mines (win: 10x)",
        "`/bj <amount>` — blackjack vs bot (win: 2x)",
      ].join("\n")
    );
}

async function animatedIntro(interaction: ChatInputCommandInteraction) {
  const frames = [
    `${UI.emojis.sparkle} Loading help…`,
    `${UI.emojis.info} Building menus…`,
    `${UI.emojis.sparkle} Ready.`,
  ];
  const embed = new EmbedBuilder()
    .setColor(UI.colors.accent)
    .setTitle("Help")
    .setDescription(frames[0])
    .setFooter({ text: UI.footer });

  await interaction.reply({ embeds: [embed], components: [buildMenu()], ephemeral: true });
  for (let i = 1; i < frames.length; i++) {
    await sleep(450);
    embed.setDescription(frames[i]);
    await interaction.editReply({ embeds: [embed] });
  }

  await interaction.editReply({
    embeds: [categoryEmbed("economy")],
    components: [buildMenu("economy")],
  });
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export const helpCommand = {
  data: new SlashCommandBuilder().setName("help").setDescription("Open the interactive help menu"),
  customId: MENU_ID,
  async execute(interaction: ChatInputCommandInteraction | StringSelectMenuInteraction) {
    if (interaction.isChatInputCommand()) {
      return animatedIntro(interaction);
    }
    if (!interaction.isStringSelectMenu()) return;
    const value = interaction.values?.[0] ?? "economy";
    await interaction.update({
      embeds: [categoryEmbed(value)],
      components: [buildMenu(value)],
    });
  },
};
