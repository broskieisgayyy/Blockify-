import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { EconomyService } from "../../../services/economy/EconomyService";
import { requireOwner } from "../../../middleware/guards";
import { UI } from "../../../utils/ui";

const eco = new EconomyService();

export const takeEcoCommand = {
  data: new SlashCommandBuilder()
    .setName("take-eco")
    .setDescription("(Owner) Remove Pro Creditz from a user")
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
      const newBal = await eco.take(user.id, amount);
      await interaction.reply({ content: `${UI.emojis.warn} Removed **${amount}** ${UI.emojis.creditz} from ${user}. New balance: **${newBal}** ${UI.emojis.creditz}` });
    } catch {
      ok = false;
      throw new Error("take-eco failed");
    } finally {
      await eco.trackCommand("take-eco", Date.now() - t0, ok);
    }
  },
};
