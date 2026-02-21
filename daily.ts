import { EmbedBuilder, SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { EconomyService } from "../../services/economy/EconomyService";
import { UI } from "../../utils/ui";
import { checkCooldown } from "../../middleware/cooldowns";

const eco = new EconomyService();

export const dailyCommand = {
  data: new SlashCommandBuilder().setName("daily").setDescription("Claim your daily Pro Creditz reward"),

  async execute(interaction: ChatInputCommandInteraction) {
    const t0 = Date.now();
    let ok = true;
    try {
      const cd = checkCooldown(`daily:${interaction.user.id}`, 2_000);
      if ("error" in cd) return interaction.reply({ content: cd.error, ephemeral: true });

      const res = await eco.claimDaily(interaction.user.id);
      if ("error" in res) {
        return interaction.reply({ content: `${UI.emojis.warn} ${res.error}`, ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setColor(UI.colors.good)
        .setTitle("Daily claimed")
        .setDescription(
          `You received **${res.reward}** ${UI.emojis.creditz} — streak: **${res.streak}** days\nNew balance: **${res.balance}** ${UI.emojis.creditz}`
        )
        .setFooter({ text: UI.footer })
        .setTimestamp();

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch {
      ok = false;
      throw new Error("daily failed");
    } finally {
      await eco.trackCommand("daily", Date.now() - t0, ok);
    }
  },
};
