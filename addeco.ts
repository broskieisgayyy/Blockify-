import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { EconomyService } from "../../../services/economy/EconomyService";
import { requireOwner } from "../../../middleware/guards";
import { UI } from "../../../utils/ui";

const eco = new EconomyService();

export const addEcoCommand = {
  data: new SlashCommandBuilder()
    .setName("addeco")
    .setDescription("(Owner) Add Pro Creditz to a user")
    .addUserOption((o) => o.setName("user").setDescription("Target").setRequired(true))
    .addIntegerOption((o) => o.setName("amount").setDescription("Amount").setRequired(true).setMinValue(1)),

  async execute(interaction: ChatInputCommandInteraction) {
    const t0 = Date.now();
    let ok = true;
    try {
      const guard = requireOwner(interaction.user.id);
      if ("error" in guard) return interaction.reply({ content: `${UI.emojis.error} ${guard.error}`, ephemeral: true });

      const user = interaction.options.getUser("user", true);
      const amount = interaction.options.getInteger("amount", true);
      const newBal = await eco.add(user.id, amount);
      await interaction.reply({ content: `${UI.emojis.sparkle} Added **${amount}** ${UI.emojis.creditz} to ${user}. New balance: **${newBal}** ${UI.emojis.creditz}` });
    } catch {
      ok = false;
      throw new Error("addeco failed");
    } finally {
      await eco.trackCommand("addeco", Date.now() - t0, ok);
    }
  },
};
