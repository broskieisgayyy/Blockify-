import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { EconomyService } from "../../services/economy/EconomyService";
import { checkCooldown } from "../../middleware/cooldowns";
import { UI } from "../../utils/ui";

const econ = new EconomyService();

export const coinflipCommand = {
  data: new SlashCommandBuilder()
    .setName("coinflip")
    .setDescription("Wager Pro Creditz on a coin flip (win: 2x)")
    .addIntegerOption((o) => o.setName("amount").setDescription("Wager amount").setRequired(true).setMinValue(1))
    .addStringOption((o) =>
      o
        .setName("choice")
        .setDescription("Heads or tails")
        .setRequired(true)
        .addChoices(
          { name: "Heads (h)", value: "h" },
          { name: "Tails (t)", value: "t" }
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const cd = checkCooldown(`coinflip:${interaction.user.id}`, 2000);
    if ("error" in cd) return interaction.reply({ content: cd.error, ephemeral: true });

    const amount = interaction.options.getInteger("amount", true);
    const choice = interaction.options.getString("choice", true);

    const debit = await econ.debitIfEnough(interaction.user.id, amount);
    if ("error" in debit) return interaction.reply({ content: debit.error, ephemeral: true });

    const result = Math.random() < 0.5 ? "h" : "t";
    const win = result === choice;

    let newBalance = debit.balance;
    let payout = 0;
    if (win) {
      payout = amount * 2;
      newBalance = await econ.add(interaction.user.id, payout);
    }

    await econ.trackCommand("coinflip", 0, true);

    const embed = new EmbedBuilder()
      .setColor(win ? UI.colors.good : UI.colors.bad)
      .setTitle("🎲 Coinflip")
      .setDescription(
        [
          `Wager: **${amount}** ${UI.emojis.creditz}`,
          `Your pick: **${choice === "h" ? "Heads" : "Tails"}**`,
          `Result: **${result === "h" ? "Heads" : "Tails"}**`,
          "",
          win ? `✅ You won **${payout}** ${UI.emojis.creditz}! *(2x)*` : `❌ You lost **${amount}** ${UI.emojis.creditz}.`,
          `Balance: **${newBalance}** ${UI.emojis.creditz}`,
        ].join("\n")
      )
      .setFooter({ text: UI.footer });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
