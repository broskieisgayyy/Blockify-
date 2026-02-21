import { EmbedBuilder, SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { EconomyService } from "../../services/economy/EconomyService";
import { UI } from "../../utils/ui";

const eco = new EconomyService();

export const balanceCommand = {
  data: new SlashCommandBuilder()
    .setName("balance")
    .setDescription("Check Pro Creditz balance")
    .addUserOption((o) => o.setName("user").setDescription("User to check").setRequired(false)),

  async execute(interaction: ChatInputCommandInteraction) {
    const t0 = Date.now();
    let ok = true;
    try {
      const user = interaction.options.getUser("user") ?? interaction.user;
      const bal = await eco.getBalance(user.id);
      const embed = new EmbedBuilder()
        .setColor(UI.colors.accent)
        .setTitle("Pro Creditz")
        .setDescription(`${user.id === interaction.user.id ? "Your" : `${user.username}'s`} balance: **${bal}** ${UI.emojis.creditz}`)
        .setFooter({ text: UI.footer });
      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch {
      ok = false;
      throw new Error("balance failed");
    } finally {
      await eco.trackCommand("balance", Date.now() - t0, ok);
    }
  },
};
