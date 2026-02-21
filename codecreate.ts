import { EmbedBuilder, SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { EconomyService } from "../../../services/economy/EconomyService";
import { requireOwner } from "../../../middleware/guards";
import { UI } from "../../../utils/ui";

const eco = new EconomyService();

export const codeCreateCommand = {
  data: new SlashCommandBuilder()
    .setName("code-create")
    .setDescription("(Owner) Create a one-time redeem code")
    .addStringOption((o) => o.setName("code").setDescription("Code text").setRequired(true))
    .addIntegerOption((o) => o.setName("creditz").setDescription("Amount").setRequired(true).setMinValue(1))
    .addIntegerOption((o) => o.setName("expiry_hours").setDescription("Optional expiry in hours").setRequired(false).setMinValue(1)),

  async execute(interaction: ChatInputCommandInteraction) {
    const t0 = Date.now();
    let ok = true;
    try {
      const guard = requireOwner(interaction.user.id);
      if ("error" in guard) return interaction.reply({ content: `${UI.emojis.error} ${guard.error}`, ephemeral: true });

      const code = interaction.options.getString("code", true);
      const creditz = interaction.options.getInteger("creditz", true);
      const expiry = interaction.options.getInteger("expiry_hours") ?? undefined;

      const created = await eco.createCode(code, creditz, expiry);
      const embed = new EmbedBuilder()
        .setColor(UI.colors.accent)
        .setTitle("Code created")
        .setDescription(
          [
            `Code: \`${created.code}\``,
            `Reward: **${created.creditz}** ${UI.emojis.creditz}`,
            created.expiresAt ? `Expires: <t:${Math.floor(created.expiresAt / 1000)}:R>` : "Expires: **never**",
          ].join("\n")
        )
        .setFooter({ text: UI.footer });

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch {
      ok = false;
      throw new Error("code-create failed");
    } finally {
      await eco.trackCommand("code-create", Date.now() - t0, ok);
    }
  },
};
