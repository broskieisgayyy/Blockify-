import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  Interaction,
  SlashCommandBuilder,
} from "discord.js";
import { EconomyService } from "../../services/economy/EconomyService";
import { checkCooldown } from "../../middleware/cooldowns";
import { UI } from "../../utils/ui";

type BJGame = {
  id: string;
  userId: string;
  amount: number;
  deck: number[];
  player: number[];
  dealer: number[];
  done: boolean;
};

const econ = new EconomyService();
const games = new Map<string, BJGame>();
const gameTimers = new Map<string, NodeJS.Timeout>();

const PREFIX = "bj";

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

function newDeck() {
  // 4 suits × 13 ranks; store rank values (A=11 initially)
  const ranks = [11, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 10];
  const deck: number[] = [];
  for (let s = 0; s < 4; s++) for (const r of ranks) deck.push(r);
  // shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function draw(g: BJGame) {
  return g.deck.pop() ?? 10;
}

function score(hand: number[]) {
  let total = hand.reduce((a, b) => a + b, 0);
  let aces = hand.filter((v) => v === 11).length;
  while (total > 21 && aces > 0) {
    total -= 10; // make an ace worth 1 instead of 11
    aces -= 1;
  }
  return total;
}

function fmtHand(hand: number[]) {
  // Not revealing actual faces; just values.
  return hand.join(", ");
}

function components(g: BJGame) {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${PREFIX}:${g.userId}:${g.id}:hit`)
      .setLabel("Hit")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(g.done),
    new ButtonBuilder()
      .setCustomId(`${PREFIX}:${g.userId}:${g.id}:stand`)
      .setLabel("Stand")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(g.done)
  );
  return [row];
}

function embedFor(g: BJGame, revealDealer = false, status?: string) {
  const ps = score(g.player);
  const ds = score(g.dealer);

  const dealerShown = revealDealer ? fmtHand(g.dealer) : `${g.dealer[0]}, ?`;
  const dealerScore = revealDealer ? ds : "?";

  return new EmbedBuilder()
    .setColor(g.done ? UI.colors.accent : UI.colors.primary)
    .setTitle("🃏 Blackjack")
    .setDescription(
      [
        `Wager: **${g.amount}** ${UI.emojis.creditz} *(win: 2x)*`,
        "",
        `**You:** ${fmtHand(g.player)}  (score: **${ps}**)`,
        `**Dealer:** ${dealerShown}  (score: **${dealerScore}**)`,
        "",
        status ?? (g.done ? "" : "Choose an action."),
      ]
        .filter(Boolean)
        .join("\n")
    )
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

export const blackjackCommand = {
  data: new SlashCommandBuilder()
    .setName("bj")
    .setDescription("Play blackjack vs the bot (win: 2x)")
    .addIntegerOption((o) => o.setName("amount").setDescription("Wager amount").setRequired(true).setMinValue(1)),

  customId: PREFIX,

  async execute(interaction: Interaction) {
    if (interaction.isChatInputCommand()) {
      const cd = checkCooldown(`bj:${interaction.user.id}`, 2000);
      if ("error" in cd) return interaction.reply({ content: cd.error, ephemeral: true });

      const amount = interaction.options.getInteger("amount", true);
      if (games.has(interaction.user.id)) {
        return interaction.reply({ content: "You already have an active blackjack game.", ephemeral: true });
      }

      const debit = await econ.debitIfEnough(interaction.user.id, amount);
      if ("error" in debit) return interaction.reply({ content: debit.error, ephemeral: true });

      const g: BJGame = {
        id: newId(),
        userId: interaction.user.id,
        amount,
        deck: newDeck(),
        player: [],
        dealer: [],
        done: false,
      };

      g.player.push(draw(g), draw(g));
      g.dealer.push(draw(g), draw(g));

      games.set(interaction.user.id, g);
      scheduleExpiry(interaction.user.id);

      // Natural blackjack checks
      const ps = score(g.player);
      const ds = score(g.dealer);
      if (ps === 21 || ds === 21) {
        g.done = true;
        let status = "";
        if (ps === 21 && ds !== 21) {
          const payout = amount * 2;
          const bal = await econ.add(g.userId, payout);
          status = `✅ Blackjack! You won **${payout}** ${UI.emojis.creditz}. Balance: **${bal}** ${UI.emojis.creditz}`;
        } else if (ps === 21 && ds === 21) {
          const bal = await econ.add(g.userId, amount);
          status = `🤝 Push (both blackjack). Your wager was returned. Balance: **${bal}** ${UI.emojis.creditz}`;
        } else {
          status = `❌ Dealer has blackjack. You lost **${amount}** ${UI.emojis.creditz}.`;
        }
        cleanup(g.userId);
        return interaction.reply({ embeds: [embedFor(g, true, status)], components: components(g), ephemeral: true });
      }

      return (interaction as ChatInputCommandInteraction).reply({
        embeds: [embedFor(g, false)],
        components: components(g),
        ephemeral: true,
      });
    }

    if (interaction.isButton()) {
      const parts = interaction.customId.split(":");
      if (parts[0] !== PREFIX) return;
      const userId = parts[1];
      const gameId = parts[2];
      const action = parts[3];
      if (interaction.user.id !== userId) return interaction.reply({ content: "This isn't your game.", ephemeral: true });

      const g = games.get(userId);
      if (!g || g.id !== gameId) return interaction.reply({ content: "That blackjack game expired.", ephemeral: true });
      if (g.done) return interaction.reply({ content: "Game already ended.", ephemeral: true });

      if (action === "hit") {
        g.player.push(draw(g));
        const ps = score(g.player);
        if (ps > 21) {
          g.done = true;
          const status = `💥 Bust! You lost **${g.amount}** ${UI.emojis.creditz}.`;
          cleanup(userId);
          return interaction.update({ embeds: [embedFor(g, true, status)], components: components(g) });
        }
        return interaction.update({ embeds: [embedFor(g, false)], components: components(g) });
      }

      if (action === "stand") {
        // dealer plays
        while (score(g.dealer) < 17) g.dealer.push(draw(g));
        const ps = score(g.player);
        const ds = score(g.dealer);
        g.done = true;

        let status = "";
        if (ds > 21 || ps > ds) {
          const payout = g.amount * 2;
          const bal = await econ.add(g.userId, payout);
          status = `✅ You won **${payout}** ${UI.emojis.creditz}. Balance: **${bal}** ${UI.emojis.creditz}`;
        } else if (ps === ds) {
          const bal = await econ.add(g.userId, g.amount);
          status = `🤝 Push. Your wager was returned. Balance: **${bal}** ${UI.emojis.creditz}`;
        } else {
          status = `❌ Dealer wins. You lost **${g.amount}** ${UI.emojis.creditz}.`;
        }

        cleanup(userId);
        return interaction.update({ embeds: [embedFor(g, true, status)], components: components(g) });
      }
    }
  },
};
