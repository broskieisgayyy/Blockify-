import {
  EmbedBuilder,
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from "discord.js";
import { EconomyService } from "../../services/economy/EconomyService";
import { UI } from "../../utils/ui";
import { checkCooldown } from "../../middleware/cooldowns";

const eco = new EconomyService();

export const payCommand = {
  data: new SlashCommandBuilder()
    .setName("pay")
    .setDescription("Pay a user Pro Creditz")
    .addUserOption((o) => o.setName("user").setDescription("Recipient").setRequired(true))
    .addIntegerOption((o) => o.setName("amount").setDescription("Amount").setRequired(true).setMinValue(1)),

  async execute(interaction: ChatInputCommandInteraction) {
    const t0 = Date.now();
    let ok = true;
    try {
      const cd = checkCooldown(`pay:${interaction.user.id}`, 3_000);
      if ("error" in cd) {
        return interaction.reply({ content: cd.error, ephemeral: true });
      }

      const user = interaction.options.getUser("user", true);
      const amount = interaction.options.getInteger("amount", true);

      const res = await eco.pay(interaction.user.id, user.id, amount);
      if ("error" in res) {
        return interaction.reply({ content: `${UI.emojis.warn} ${res.error}`, ephemeral: true });
      }

      // Confirmation message (non-ephemeral) as requested.
      const embed = new EmbedBuilder()
        .setColor(UI.colors.accent)
        .setTitle("Payment confirmed")
        .setDescription(
          `${interaction.user} paid ${user} **${amount}** ${UI.emojis.creditz}`
        )
        .addFields(
          { name: "Sender new balance", value: `**${res.payer}** ${UI.emojis.creditz}`, inline: true },
          { name: "Recipient new balance", value: `**${res.recipient}** ${UI.emojis.creditz}`, inline: true }
        )
        .setFooter({ text: UI.footer })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch {
      ok = false;
      throw new Error("pay failed");
    } finally {
      await eco.trackCommand("pay", Date.now() - t0, ok);
    }
  },
};
