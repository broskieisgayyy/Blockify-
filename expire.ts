import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { EconomyService } from "../../../services/economy/EconomyService";
import { requireOwner } from "../../../middleware/guards";
import { UI } from "../../../utils/ui";

const eco = new EconomyService();

export const expireCodeCommand = {
  data: new SlashCommandBuilder()
    .setName("expire")
    .setDescription("(Owner) Expire a redeem code")
    .addStringOption((o) => o.setName("code").setDescription("Code").setRequired(true)),

  async execute(interaction: ChatInputCommandInteraction) {
    const t0 = Date.now();
    let ok = true;
    try {
      const guard = requireOwner(interaction.user.id);
      if ("error" in guard) return interaction.reply({ content: `${UI.emojis.error} ${guard.error}`, ephemeral: true });

      const code = interaction.options.getString("code", true);
      const res = await eco.expireCode(code);
      if ("error" in res) return interaction.reply({ content: `${UI.emojis.warn} ${res.error}`, ephemeral: true });
      await interaction.reply({ content: `${UI.emojis.warn} Code expired.`, ephemeral: true });
    } catch {
      ok = false;
      throw new Error("expire failed");
    } finally {
      await eco.trackCommand("expire", Date.now() - t0, ok);
    }
  },
};
