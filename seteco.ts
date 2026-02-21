import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { EconomyService } from "../../../services/economy/EconomyService";
import { requireOwner } from "../../../middleware/guards";
import { UI } from "../../../utils/ui";

const eco = new EconomyService();

export const setEcoCommand = {
  data: new SlashCommandBuilder()
    .setName("set-eco")
    .setDescription("(Owner) Set a user's Pro Creditz")
    .addUserOption((o) => o.setName("user").setDescription("Target").setRequired(true))
    .addIntegerOption((o) => o.setName("amount").setDescription("New balance").setRequired(true).setMinValue(0)),

  async execute(interaction: ChatInputCommandInteraction) {
    const t0 = Date.now();
    let ok = true;
    try {
      const guard = requireOwner(interaction.user.id);
      if ("error" in guard) return interaction.reply({ content: `${UI.emojis.error} ${guard.error}`, ephemeral: true });

      const user = interaction.options.getUser("user", true);
      const amount = interaction.options.getInteger("amount", true);
      const newBal = await eco.set(user.id, amount);
      await interaction.reply({ content: `${UI.emojis.info} Set ${user}'s balance to **${newBal}** ${UI.emojis.creditz}` });
    } catch {
      ok = false;
      throw new Error("set-eco failed");
    } finally {
      await eco.trackCommand("set-eco", Date.now() - t0, ok);
    }
  },
};
