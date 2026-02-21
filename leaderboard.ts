import { EmbedBuilder, SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { EconomyService } from "../../services/economy/EconomyService";
import { UI } from "../../utils/ui";

const eco = new EconomyService();

export const leaderboardCommand = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Top global Pro Creditz holders"),

  async execute(interaction: ChatInputCommandInteraction) {
    const t0 = Date.now();
    let ok = true;
    try {
      const top = await eco.getLeaderboard(10);
      const lines = top.length
        ? top
            .map((e, i) => `${i + 1}. <@${e.userId}> — **${e.balance}** ${UI.emojis.creditz}`)
            .join("\n")
        : "No data yet.";

      const embed = new EmbedBuilder()
        .setColor(UI.colors.accent)
        .setTitle("Global leaderboard")
        .setDescription(lines)
        .setFooter({ text: UI.footer });
      await interaction.reply({ embeds: [embed] });
    } catch {
      ok = false;
      throw new Error("leaderboard failed");
    } finally {
      await eco.trackCommand("leaderboard", Date.now() - t0, ok);
    }
  },
};
