import { EmbedBuilder, SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { EconomyService } from "../../services/economy/EconomyService";
import { UI } from "../../utils/ui";

const eco = new EconomyService();

export const useCodeCommand = {
  data: new SlashCommandBuilder()
    .setName("usecode")
    .setDescription("Claim a one-time Pro Creditz code")
    .addStringOption((o) => o.setName("code").setDescription("Code").setRequired(true)),

  async execute(interaction: ChatInputCommandInteraction) {
    const t0 = Date.now();
    let ok = true;
    try {
      const code = interaction.options.getString("code", true);
      const res = await eco.useCode(interaction.user.id, code);
      if ("error" in res) {
        return interaction.reply({ content: `${UI.emojis.warn} ${res.error}`, ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setColor(UI.colors.good)
        .setTitle("Code claimed")
        .setDescription(
          `You received **${res.creditz}** ${UI.emojis.creditz}\nNew balance: **${res.balance}** ${UI.emojis.creditz}`
        )
        .setFooter({ text: UI.footer });
      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch {
      ok = false;
      throw new Error("usecode failed");
    } finally {
      await eco.trackCommand("usecode", Date.now() - t0, ok);
    }
  },
};
