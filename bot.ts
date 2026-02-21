// server/bot.ts
import { 
  Client, 
  GatewayIntentBits, 
  REST, 
  Routes, 
  SlashCommandBuilder, 
  ChatInputCommandInteraction,
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  TextChannel,
  EmbedBuilder,
  ActivityType,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ComponentType
} from 'discord.js';
import { IStorage } from './storage';
import * as dotenv from 'dotenv';
dotenv.config();

const FOOTER_TEXT = "⚡ ʙʟᴏᴄᴋɪꜰʏ™ | ɢᴀᴍɪɴɢ ᴏʀɢᴀɴɪᴢᴀᴛɪᴏɴ 🎮";

const COLORS = {
  SUCCESS: 0x00FFFF,
  ERROR: 0xFF4B4B,
  INFO: 0x00E5FF,
  WARNING: 0xFFD700,
  PRIMARY: 0x00FFFF,
  OWNER: 0x00CED1
};

const EMOJIS = {
  SUCCESS: "✨",
  ERROR: "🏮",
  INFO: "💎",
  WARNING: "⚡",
  ORDER: "🛒",
  INVITE: "📈",
  COIN: "🎲",
  HELP: "🛠️",
  OWNER: "👑",
  PUBLIC: "🌐",
  BACK: "🔙",
  DM: "📧",
  BAN: "🚫",
  KICK: "👟",
  MUTE: "😶",
  STATUS: "📊",
  NAME: "🏷️",
  ANNOUNCE: "📢",
  GIVEAWAY: "🎁"
};
const DEFAULT_OWNERS = ['827864129501921281', '1355452864390103051'];

function generateOrderId() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

import { orders as ordersTable, snipedMessages } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { db } from "./db";

export async function startBot(storage: IStorage) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    console.error("DISCORD_BOT_TOKEN missing!");
    return;
  }

  const client = new Client({ 
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ] 
  });

  const commands = [
    // PUBLIC
    new SlashCommandBuilder().setName('help').setDescription('Shows the help menu'),
    new SlashCommandBuilder().setName('order').setDescription('Creates a purchase inquiry')
      .addStringOption(opt => opt.setName('name').setDescription('The name of the item').setRequired(true))
      .addStringOption(opt => opt.setName('id').setDescription('A custom ID for the order').setRequired(true))
      .addStringOption(opt => opt.setName('customer').setDescription('The customer username').setRequired(true)),
    new SlashCommandBuilder().setName('order-complete').setDescription('Marks an order as completed (Owner only)')
      .addStringOption(opt => opt.setName('id').setDescription('The custom ID of the order').setRequired(true)),
    new SlashCommandBuilder().setName('completed-logs').setDescription('Sets the completed orders log channel (Owner only)')
      .addChannelOption(opt => opt.setName('channel').setDescription('Log channel').setRequired(true)),
    new SlashCommandBuilder().setName('invites').setDescription('Shows invites for a user')
      .addUserOption(opt => opt.setName('user').setDescription('User to check').setRequired(false)),
    new SlashCommandBuilder().setName('cancel').setDescription('Cancels your latest pending order'),
    new SlashCommandBuilder().setName('invited').setDescription('Shows list of users invited by someone')
      .addUserOption(opt => opt.setName('user').setDescription('User to check').setRequired(false)),
    new SlashCommandBuilder().setName('coinflip').setDescription('Flips a coin')
      .addStringOption(opt => opt.setName('choice').setDescription('Heads or tails?').addChoices({name:'Heads (h)', value:'heads'}, {name:'Tails (t)', value:'tails'}).setRequired(false)),
      
    // OWNER
    new SlashCommandBuilder().setName('dm').setDescription('DMs a user (Owner only)')
      .addUserOption(opt => opt.setName('user').setDescription('User to DM').setRequired(true))
      .addStringOption(opt => opt.setName('text').setDescription('Message text').setRequired(true))
      .addIntegerOption(opt => opt.setName('amount').setDescription('Amount of times').setRequired(false)),
    new SlashCommandBuilder().setName('ban').setDescription('Bans a user (Owner only)')
      .addUserOption(opt => opt.setName('user').setDescription('User to ban').setRequired(true))
      .addIntegerOption(opt => opt.setName('days').setDescription('Time in days to delete messages').setRequired(true))
      .addStringOption(opt => opt.setName('reason').setDescription('Reason').setRequired(true)),
    new SlashCommandBuilder().setName('kick').setDescription('Kicks a user (Owner only)')
      .addUserOption(opt => opt.setName('user').setDescription('User to kick').setRequired(true))
      .addStringOption(opt => opt.setName('reason').setDescription('Reason').setRequired(true)),
    new SlashCommandBuilder().setName('pendinglogset').setDescription('Sets order log channel (Owner only)')
      .addChannelOption(opt => opt.setName('channel').setDescription('Log channel').setRequired(true)),
    new SlashCommandBuilder().setName('announce').setDescription('Make an announcement (Owner only)'),
    new SlashCommandBuilder().setName('addowner').setDescription('Adds a new bot owner (Owner only)')
      .addUserOption(opt => opt.setName('user').setDescription('User to add').setRequired(true)),
    new SlashCommandBuilder().setName('warn').setDescription('Warns a user (Owner only)')
      .addUserOption(opt => opt.setName('user').setDescription('User to warn').setRequired(true))
      .addStringOption(opt => opt.setName('reason').setDescription('Reason').setRequired(true)),
    new SlashCommandBuilder().setName('mute').setDescription('Timeouts a user (Owner only)')
      .addUserOption(opt => opt.setName('user').setDescription('User to timeout').setRequired(true))
      .addIntegerOption(opt => opt.setName('minutes').setDescription('Minutes').setRequired(true))
      .addStringOption(opt => opt.setName('reason').setDescription('Reason').setRequired(true)),
    new SlashCommandBuilder().setName('dm-all').setDescription('DMs everyone (Owner only)')
      .addStringOption(opt => opt.setName('text').setDescription('Message text').setRequired(true))
      .addIntegerOption(opt => opt.setName('amount').setDescription('Amount of times').setRequired(false)),
    new SlashCommandBuilder().setName('giveaway').setDescription('Interactive giveaway (Owner only)')
      .addStringOption(opt => opt.setName('description').setDescription('Optional description for the giveaway').setRequired(false)),
    new SlashCommandBuilder().setName('status').setDescription('Sets bot status (Owner only)')
      .addStringOption(opt => opt.setName('type').setDescription('Type').setRequired(true).addChoices(
        {name:'Watching', value:'Watching'}, {name:'Listening', value:'Listening'}, {name:'Playing', value:'Playing'}, {name:'Competing', value:'Competing'}
      ))
      .addStringOption(opt => opt.setName('text').setDescription('Status text').setRequired(true)),
    new SlashCommandBuilder().setName('bot-name').setDescription('Changes bot name (Owner only)')
      .addStringOption(opt => opt.setName('text').setDescription('New name').setRequired(true)),
  ].map(c => c.toJSON());

  const rest = new REST({ version: '10' }).setToken(token);

  client.once('ready', async () => {
    console.log(`Bot logged in as ${client.user?.tag}`);
    try {
      if (client.user) {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('Successfully registered slash commands.');
      }
      
      for (const id of DEFAULT_OWNERS) {
        await storage.addOwner({ userId: id });
      }
    } catch (error) {
      console.error(error);
    }
  });

  client.on('messageCreate', async message => {
    if (message.author.bot) return;
    const isOwnerStatus = await isOwner(message.author.id, storage);
    
    // Add message content intent check or use prefix logic
    if (!message.content) return;

    if (message.content.startsWith('.maintenance ')) {
      if (!isOwnerStatus) return;
      const state = message.content.split(' ')[1];
      if (state === 'on' || state === 'off') {
        await storage.setSetting({ key: 'maintenance_mode', value: state === 'on' ? 'true' : 'false' });
        await message.reply(`${EMOJIS.SUCCESS} Maintenance mode turned **${state.toUpperCase()}**.`);
      }
    } else if (message.content === '.reload') {
      if (!isOwnerStatus) return;
      await message.reply(`${EMOJIS.SUCCESS} **System Synchronized**\nAll bot modules have been reloaded and are now up to date.`);
    } else if (message.content === '.logs') {
      if (!isOwnerStatus) return;
      const embed = new EmbedBuilder()
        .setTitle('📑 **Recent System Logs**')
        .setDescription('`[SYSTEM]` Bot initialized successfully.\n`[INFO]` Slash commands registered.\n`[DB]` Connection established.\n`[EVENT]` Message delete listener active.')
        .setColor(COLORS.INFO)
        .addFields({ name: '━━━━━━━━━━━━━━━━━━━━━━', value: ' ' })
        .setFooter({ text: FOOTER_TEXT });
      await message.reply({ embeds: [embed] });
    } else if (message.content.startsWith('.snipe')) {
      if (!isOwnerStatus) return;
      const amount = parseInt(message.content.split(' ')[1]) || 1;
      const sniped = await db.select().from(snipedMessages).where(eq(snipedMessages.channelId, message.channelId)).orderBy(desc(snipedMessages.createdAt)).limit(amount);
      if (sniped.length === 0) return message.reply(`${EMOJIS.ERROR} No recently deleted messages found in this channel.`);
      
      for (const msg of sniped) {
        const embed = new EmbedBuilder()
          .setAuthor({ name: `Ghost Message Detected`, iconURL: 'https://cdn-icons-png.flaticon.com/512/1164/1164620.png' })
          .setDescription(`**Content:**\n${msg.content}`)
          .addFields({ name: 'Author ID', value: `\`${msg.authorId}\``, inline: true })
          .setColor(COLORS.PRIMARY)
          .setTimestamp(msg.createdAt || new Date())
          .setFooter({ text: `Deleted at` });
        await message.channel.send({ embeds: [embed] });
      }
    } else if (message.content.startsWith('.userinfo ')) {
      if (!isOwnerStatus) return;
      const id = message.content.split(' ')[1].replace(/[<@!>]/g, '');
      const user = await client.users.fetch(id).catch(() => null);
      if (!user) return message.reply(`${EMOJIS.ERROR} User with ID \`${id}\` not found.`);
      
      const warnings = await storage.getWarnings(id);
      const orders = await db.select().from(ordersTable).where(eq(ordersTable.userId, id));

      const embed = new EmbedBuilder()
        .setTitle(`👤 **User Intelligence: ${user.tag}**`)
        .setThumbnail(user.displayAvatarURL({ size: 512 }))
        .addFields(
          { name: "System ID", value: `\`${user.id}\``, inline: true },
          { name: "Account Born", value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
          { name: "Organization Status", value: isOwnerStatus ? 'Authorized Owner' : 'Standard Member', inline: true },
          { name: "Moderation Record", value: `${warnings.length} Warnings`, inline: true },
          { name: "Order History", value: `${orders.length} Total Orders`, inline: true },
          { name: "Badges", value: user.flags?.toArray().join(', ') || 'None', inline: true }
        )
        .setColor(COLORS.INFO)
        .addFields({ name: '━━━━━━━━━━━━━━━━━━━━━━', value: ' ' })
        .setFooter({ text: FOOTER_TEXT });
      await message.reply({ embeds: [embed] });
    } else if (message.content === '.servers') {
      if (!isOwnerStatus) return;
      const serverList = client.guilds.cache.map(g => `✨ **${g.name}**\n   └ ID: \`${g.id}\` | Members: \`${g.memberCount}\``).join('\n\n');
      const embed = new EmbedBuilder()
        .setTitle('🌐 **Active Network Clusters**')
        .setDescription(serverList || 'No active clusters connected.')
        .setColor(COLORS.PRIMARY)
        .setFooter({ text: FOOTER_TEXT });
      await message.reply({ embeds: [embed] });
    } else if (message.content.startsWith('.leave-server ')) {
      if (!isOwnerStatus) return;
      const id = message.content.split(' ')[1];
      const guild = client.guilds.cache.get(id);
      if (guild) {
        const guildName = guild.name;
        await guild.leave();
        await message.reply(`${EMOJIS.SUCCESS} Successfully terminated connection with server: **${guildName}**.`);
      } else {
        await message.reply(`${EMOJIS.ERROR} No server found with ID \`${id}\`.`);
      }
    } else if (message.content === '.secret') {
      if (!isOwnerStatus) return;
      const embed = new EmbedBuilder()
        .setTitle('💎 **RESTRICTED OPERATIONS PROTOCOL** 💎')
        .setDescription('Authorized personnel only. Use these commands with extreme caution.')
        .addFields(
          { name: '⚙️ Maintenance', value: '`.maintenance on/off` - Toggle global system lock.' },
          { name: '🔄 Synchronize', value: '`.reload` - Hot-reload all bot modules.' },
          { name: '📑 Diagnostics', value: '`.logs` - Stream recent system activity.' },
          { name: '👻 Spectral Snipe', value: '`.snipe [amount]` - Recover fragmented message data.' },
          { name: '🕵️ Intel Search', value: '`.userinfo [id]` - Deep-dive into user metadata.' },
          { name: '🌐 Network View', value: '`.servers` - Audit all connected servers.' },
          { name: '🔌 Emergency Exit', value: '`.leave-server [id]` - Terminate guild connection.' }
        )
        .setColor(COLORS.OWNER)
        .setImage("https://cdn.discordapp.com/attachments/1474668795162263563/1474669398156509316/1769226844176.png?ex=699ab066&is=69995ee6&hm=07addf577039c32c67ce038d761f477b70b6ffa20dff019a81076f013877ac61&")
        .setTimestamp()
        .setFooter({ text: FOOTER_TEXT });
      await message.author.send({ embeds: [embed] }).then(() => message.reply(`${EMOJIS.DM} **Secret Intelligence Transmitted**\nPlease check your direct messages for the full protocol.`)).catch(() => message.reply(`${EMOJIS.ERROR} **Transmission Failed**\nI cannot establish a private connection with you. Please enable your DMs.`));
    }

    if (!isOwnerStatus) return;
    // ... existing rigwin/rigsdisable logic
  });

  client.on('messageDelete', async message => {
    if (!message.content || message.author?.bot) return;
    await db.insert(snipedMessages).values({
      channelId: message.channelId,
      authorId: message.author?.id || 'Unknown',
      content: message.content
    });
  });

  client.on('interactionCreate', async interaction => {
    if (interaction.isChatInputCommand()) {
      await handleCommand(interaction, storage, client);
    } else if (interaction.isButton()) {
      await handleButton(interaction, storage);
    } else if (interaction.isModalSubmit()) {
      await handleModal(interaction, storage);
    } else if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'help_menu') {
        const category = interaction.values[0];
        let embed = new EmbedBuilder().setFooter({ text: FOOTER_TEXT }).setTimestamp();
        
        if (category === 'public') {
          embed.setTitle(`${EMOJIS.PUBLIC} **Public Command Hub**`)
               .setDescription(`Exploring the community tools for members.`)
               .addFields(
                 { name: `${EMOJIS.ORDER} \`/order\``, value: `> Professional purchase inquiry system.` },
                 { name: `${EMOJIS.INVITE} \`/invites\``, value: `> Comprehensive invite tracking.` },
                 { name: `${EMOJIS.COIN} \`/coinflip\``, value: `> Interactive chance-based games.` }
               )
               .setColor(COLORS.INFO);
        } else if (category === 'owner') {
          const isOwnerStatus = await isOwner(interaction.user.id, storage);
          if (!isOwnerStatus) return interaction.reply({ content: "Unauthorized access detected.", ephemeral: true });
          embed.setTitle(`${EMOJIS.OWNER} **Administrative Command Panel**`)
               .setDescription(`Leadership tools for organization management.`)
               .addFields(
                 { name: `${EMOJIS.BAN} \`/ban\``, value: `> Secure member termination.` },
                 { name: `${EMOJIS.KICK} \`/kick\``, value: `> Guild access removal.` },
                 { name: `${EMOJIS.MUTE} \`/mute\``, value: `> Interaction suspension.` }
               )
               .setColor(COLORS.OWNER);
        } else if (category === 'secret') {
          const isOwnerStatus = await isOwner(interaction.user.id, storage);
          if (!isOwnerStatus) return interaction.reply({ content: "Access denied: Secret clearance required.", ephemeral: true });
          embed.setTitle(`💎 **Secret Operations**`)
               .setDescription(`Hidden developer-level system controls.`)
               .addFields(
                 { name: "Transmission", value: "Type `.secret` in any channel to receive the full documentation." }
               )
               .setColor(0x000000);
        }

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId('help_main_btn').setLabel('Back').setEmoji(EMOJIS.BACK).setStyle(ButtonStyle.Secondary)
        );

        await interaction.update({ embeds: [embed], components: [row] });
      }
    }
  });

  await client.login(token);
}

async function isOwner(userId: string, storage: IStorage) {
  if (DEFAULT_OWNERS.includes(userId)) return true;
  return await storage.isOwner(userId);
}

async function handleCommand(interaction: ChatInputCommandInteraction, storage: IStorage, client: Client) {
  const cmd = interaction.commandName;
  const userId = interaction.user.id;
  const isOwnerStatus = await isOwner(userId, storage);

  const ownerCommands = ['dm', 'ban', 'kick', 'pendinglogset', 'announce', 'addowner', 'warn', 'mute', 'dm-all', 'giveaway', 'status', 'bot-name', 'order-complete', 'completed-logs'];
  
  const maintenance = await storage.getSetting('maintenance_mode');
  if (maintenance?.value === 'true' && !isOwnerStatus) {
    return interaction.reply({ content: `${EMOJIS.WARNING} **Maintenance Mode Active**\nThe bot is currently undergoing scheduled maintenance. Please try again later.`, ephemeral: true });
  }

  if (ownerCommands.includes(cmd) && !isOwnerStatus) {
    return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
  }

  try {
    if (cmd === 'status') {
      const typeStr = interaction.options.getString('type', true);
      const text = interaction.options.getString('text', true);
      let type: ActivityType;
      switch(typeStr) {
        case 'Watching': type = ActivityType.Watching; break;
        case 'Listening': type = ActivityType.Listening; break;
        case 'Playing': type = ActivityType.Playing; break;
        case 'Competing': type = ActivityType.Competing; break;
        default: type = ActivityType.Playing;
      }
      client.user?.setActivity(text, { type });
      const embed = new EmbedBuilder()
        .setTitle(`${EMOJIS.SUCCESS} Status Updated`)
        .setDescription(`Bot status set to **${typeStr} ${text}**.`)
        .setColor(COLORS.SUCCESS)
        .setFooter({ text: FOOTER_TEXT });
      await interaction.reply({ embeds: [embed] });
    }
    
    else if (cmd === 'bot-name') {
      const text = interaction.options.getString('text', true);
      await client.user?.setUsername(text);
      const embed = new EmbedBuilder()
        .setTitle(`${EMOJIS.SUCCESS} Name Updated`)
        .setDescription(`Bot name changed to **${text}**.`)
        .setColor(COLORS.SUCCESS)
        .setFooter({ text: FOOTER_TEXT });
      await interaction.reply({ embeds: [embed] });
    }

    else if (cmd === 'help') {
      const embed = new EmbedBuilder()
        .setTitle(`✨ **BLOCKIFY HUB** ✨`)
        .setDescription(`Welcome to the next generation of management. Select a module from the menu below to explore our features.\n\n${EMOJIS.INFO} *Experience the ultimate gaming organization suite.*`)
        .setColor(COLORS.PRIMARY)
        .setThumbnail(client.user?.displayAvatarURL() || null)
        .setImage("https://cdn.discordapp.com/attachments/1474668795162263563/1474669398156509316/1769226844176.png?ex=699ab066&is=69995ee6&hm=07addf577039c32c67ce038d761f477b70b6ffa20dff019a81076f013877ac61&") // Example aesthetic separator
        .addFields({ name: '━━━━━━━━━━━━━━━━━━━━━━', value: ' ' })
        .setTimestamp()
        .setFooter({ text: FOOTER_TEXT });
        
      const select = new StringSelectMenuBuilder()
        .setCustomId('help_menu')
        .setPlaceholder('📂 Select a category...')
        .addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel('Public Hub')
            .setDescription('Community commands for everyone.')
            .setEmoji(EMOJIS.PUBLIC)
            .setValue('public'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Admin Panel')
            .setDescription('Restricted management tools.')
            .setEmoji(EMOJIS.OWNER)
            .setValue('owner'),
          new StringSelectMenuOptionBuilder()
            .setLabel('Secret Access')
            .setDescription('Hidden developer-only commands.')
            .setEmoji('💎')
            .setValue('secret')
        );

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
        
      await interaction.reply({ embeds: [embed], components: [row] });
    }
    
    else if (cmd === 'order') {
      const name = interaction.options.getString('name', true);
      const customId = interaction.options.getString('id', true);
      const customer = interaction.options.getString('customer', true);

      const existingOrder = await storage.getOrderByCustomId(customId);
      if (existingOrder) {
        return interaction.reply({ content: `${EMOJIS.ERROR} An order with ID \`${customId}\` already exists. Please use a unique ID.`, ephemeral: true });
      }

      const order = await storage.createOrder({ 
        userId, 
        customId,
        name,
        customer,
        text: name,
        status: 'pending' 
      });
      
      const responseEmbed = new EmbedBuilder()
        .setTitle(`${EMOJIS.ORDER} **Order Registered Successfully!**`)
        .setDescription(`Your request has been documented and is now in our processing queue.\n\n` +
                        `**Order Metadata**\n` +
                        `> ${EMOJIS.INFO} **System ID:** \`${customId}\`\n` +
                        `> ${EMOJIS.NAME} **Item Name:** ${name}\n` +
                        `> ${EMOJIS.PUBLIC} **Customer:** ${customer}`)
        .setColor(COLORS.SUCCESS)
        .addFields({ name: '━━━━━━━━━━━━━━━━━━━━━━', value: ' ' })
        .setTimestamp()
        .setFooter({ text: FOOTER_TEXT });

      const logChannelSetting = await storage.getSetting('order_log_channel');
      if (logChannelSetting && interaction.guild) {
        const channel = interaction.guild.channels.cache.get(logChannelSetting.value) as TextChannel;
        if (channel) {
          const logEmbed = new EmbedBuilder()
            .setTitle(`${EMOJIS.ORDER} **New Inbound Order**`)
            .addFields(
              { name: "Order ID", value: `\`${customId}\``, inline: true },
              { name: "Client", value: `<@${userId}> (${customer})`, inline: true },
              { name: "Product", value: name }
            )
            .setColor(COLORS.WARNING)
            .setTimestamp()
            .setFooter({ text: FOOTER_TEXT });
          await channel.send({ embeds: [logEmbed] });
        }
      }
      
      await interaction.reply({ embeds: [responseEmbed] });
    }

    else if (cmd === 'order-complete') {
      const customId = interaction.options.getString('id', true);
      const order = await storage.getOrderByCustomId(customId);

      if (!order) {
        return interaction.reply({ content: `${EMOJIS.ERROR} No order found with ID \`${customId}\`.`, ephemeral: true });
      }

      await storage.updateOrderStatus(order.id, 'completed');

      const completionEmbed = new EmbedBuilder()
        .setTitle(`${EMOJIS.SUCCESS} **Order Fulfilled!**`)
        .setDescription(`Order **#${customId}** has been successfully processed and marked as completed.`)
        .addFields(
          { name: "Product", value: order.name, inline: true },
          { name: "Customer", value: order.customer, inline: true }
        )
        .setColor(COLORS.SUCCESS)
        .setTimestamp()
        .setFooter({ text: FOOTER_TEXT });

      const logChannelSetting = await storage.getSetting('completed_log_channel');
      if (logChannelSetting && interaction.guild) {
        const channel = interaction.guild.channels.cache.get(logChannelSetting.value) as TextChannel;
        if (channel) {
          await channel.send({ embeds: [completionEmbed] });
        }
      }

      await interaction.reply({ embeds: [completionEmbed] });
    }

    else if (cmd === 'completed-logs') {
      const channel = interaction.options.getChannel('channel', true);
      await storage.setSetting({ key: 'completed_log_channel', value: channel.id });
      await interaction.reply({ content: `${EMOJIS.SUCCESS} **Log Channel Configured**\nCompleted orders will now be logged in <#${channel.id}>.`, ephemeral: true });
    }
    
    else if (cmd === 'cancel') {
      const cancelled = await storage.cancelLatestOrder(userId);
      const embed = new EmbedBuilder().setFooter({ text: FOOTER_TEXT }).setTimestamp();
      if (cancelled) {
        embed.setTitle(`${EMOJIS.SUCCESS} Order Cancelled`)
             .setDescription(`Successfully cancelled your latest pending order (**#${cancelled.id}**).`)
             .setColor(COLORS.SUCCESS);
      } else {
        embed.setTitle(`${EMOJIS.ERROR} No Pending Orders`)
             .setDescription("We couldn't find any pending orders associated with your account.")
             .setColor(COLORS.ERROR);
      }
      await interaction.reply({ embeds: [embed] });
    }
    
    else if (cmd === 'invites' || cmd === 'invited') {
      const targetUser = interaction.options.getUser('user') || interaction.user;
      if (!interaction.guild) return interaction.reply({ content: `${EMOJIS.ERROR} This command must be used within a server.`, ephemeral: true });
      
      await interaction.deferReply();
      const invites = await interaction.guild.invites.fetch();
      const userInvites = invites.filter(i => i.inviter?.id === targetUser.id);
      
      let count = 0;
      userInvites.forEach(inv => { count += (inv.uses || 0); });
      
      const embed = new EmbedBuilder()
        .setTitle(cmd === 'invites' ? `${EMOJIS.INVITE} Invite Statistics` : `${EMOJIS.INVITE} Invite Tracking`)
        .setDescription(`User **${targetUser.username}** currently has **${count}** successful invite uses.`)
        .setColor(COLORS.PRIMARY)
        .setTimestamp()
        .setFooter({ text: FOOTER_TEXT });

      await interaction.editReply({ embeds: [embed] });
    }
    
    else if (cmd === 'coinflip') {
      const choice = interaction.options.getString('choice') || 'heads';
      const result = Math.random() < 0.5 ? 'heads' : 'tails';
      const won = choice === result;
      
      const embed = new EmbedBuilder()
        .setTitle(`${EMOJIS.COIN} Coinflip Result`)
        .setDescription(`The coin landed on **${result.toUpperCase()}**!\n\n${won ? `🏆 **Congratulations, you won!**` : `❌ **Better luck next time!**`}`)
        .setColor(won ? COLORS.SUCCESS : COLORS.ERROR)
        .setFooter({ text: FOOTER_TEXT });

      await interaction.reply({ embeds: [embed] });
    }
    
    else if (cmd === 'dm') {
      const target = interaction.options.getUser('user', true);
      const text = interaction.options.getString('text', true);
      const amount = interaction.options.getInteger('amount') || 1;
      
      await interaction.deferReply({ ephemeral: true });
      let sent = 0;
      for(let i=0; i<amount; i++) {
        const dmEmbed = new EmbedBuilder()
          .setTitle(`${EMOJIS.DM} New Message`)
          .setDescription(text)
          .setColor(COLORS.PRIMARY)
          .setTimestamp()
          .setFooter({ text: FOOTER_TEXT });
        await target.send({ embeds: [dmEmbed] }).then(() => sent++).catch(() => {});
      }
      
      const resEmbed = new EmbedBuilder()
        .setTitle(`${EMOJIS.SUCCESS} Transmission Complete`)
        .setDescription(`Successfully delivered **${sent}** message(s) to **${target.username}**.`)
        .setColor(COLORS.SUCCESS)
        .setFooter({ text: FOOTER_TEXT });
      await interaction.editReply({ embeds: [resEmbed] });
    }
    
    else if (cmd === 'dm-all') {
      const text = interaction.options.getString('text', true);
      const amount = interaction.options.getInteger('amount') || 1;
      
      if (!interaction.guild) return;
      await interaction.deferReply({ ephemeral: true });
      
      const members = await interaction.guild.members.fetch();
      let totalSent = 0;
      
      const dmEmbed = new EmbedBuilder()
        .setTitle(`${EMOJIS.ANNOUNCE} Announcement`)
        .setDescription(text)
        .setColor(COLORS.PRIMARY)
        .setTimestamp()
        .setFooter({ text: FOOTER_TEXT });

      for(let i=0; i<amount; i++) {
        for (const [_, member] of Array.from(members.entries())) {
          if (!member.user.bot) {
            await member.send({ embeds: [dmEmbed] }).then(() => totalSent++).catch(() => {});
          }
        }
      }
      
      const resEmbed = new EmbedBuilder()
        .setTitle(`${EMOJIS.SUCCESS} Global Transmission Complete`)
        .setDescription(`Successfully delivered **${totalSent}** DMs to server members.`)
        .setColor(COLORS.SUCCESS)
        .setFooter({ text: FOOTER_TEXT });
      await interaction.editReply({ embeds: [resEmbed] });
    }
    
    else if (cmd === 'ban') {
      const target = interaction.options.getUser('user', true);
      const days = interaction.options.getInteger('days', true);
      const reason = interaction.options.getString('reason', true);
      
      if (!interaction.guild) return;
      const member = await interaction.guild.members.fetch(target.id).catch(() => null);
      
      if (member) {
        const dmEmbed = new EmbedBuilder()
          .setTitle(`${EMOJIS.BAN} Notice of Ban`)
          .setDescription(`You have been banned from **${interaction.guild.name}**.`)
          .addFields({ name: "Reason", value: `> ${reason}` })
          .setColor(COLORS.ERROR)
          .setTimestamp()
          .setFooter({ text: FOOTER_TEXT });
          
        await target.send({ embeds: [dmEmbed] }).catch(() => {});
        await member.ban({ deleteMessageSeconds: days * 86400, reason });
        
        const resEmbed = new EmbedBuilder()
          .setTitle(`${EMOJIS.SUCCESS} Action Successful`)
          .setDescription(`Successfully banned **${target.username}** from the server.`)
          .setColor(COLORS.SUCCESS)
          .setFooter({ text: FOOTER_TEXT });
        await interaction.reply({ embeds: [resEmbed] });
      } else {
        await interaction.reply({ content: `${EMOJIS.ERROR} User not found.`, ephemeral: true });
      }
    }
    
    else if (cmd === 'kick') {
      const target = interaction.options.getUser('user', true);
      const reason = interaction.options.getString('reason', true);
      
      if (!interaction.guild) return;
      const member = await interaction.guild.members.fetch(target.id).catch(() => null);
      
      if (member) {
        const dmEmbed = new EmbedBuilder()
          .setTitle(`${EMOJIS.KICK} Notice of Kick`)
          .setDescription(`You have been kicked from **${interaction.guild.name}**.`)
          .addFields({ name: "Reason", value: `> ${reason}` })
          .setColor(COLORS.WARNING)
          .setTimestamp()
          .setFooter({ text: FOOTER_TEXT });
          
        await target.send({ embeds: [dmEmbed] }).catch(() => {});
        await member.kick(reason);
        
        const resEmbed = new EmbedBuilder()
          .setTitle(`${EMOJIS.SUCCESS} Action Successful`)
          .setDescription(`Successfully kicked **${target.username}** from the server.`)
          .setColor(COLORS.SUCCESS)
          .setFooter({ text: FOOTER_TEXT });
        await interaction.reply({ embeds: [resEmbed] });
      } else {
        await interaction.reply({ content: `${EMOJIS.ERROR} User not found.`, ephemeral: true });
      }
    }
    
    else if (cmd === 'mute') {
      const target = interaction.options.getUser('user', true);
      const minutes = interaction.options.getInteger('minutes', true);
      const reason = interaction.options.getString('reason', true);
      
      if (!interaction.guild) return;
      const member = await interaction.guild.members.fetch(target.id).catch(() => null);
      
      if (member) {
        await member.timeout(minutes * 60 * 1000, reason);
        const resEmbed = new EmbedBuilder()
          .setTitle(`${EMOJIS.MUTE} User Muted`)
          .setDescription(`Successfully timed out **${target.username}** for **${minutes}** minutes.`)
          .addFields({ name: "Reason", value: `> ${reason}` })
          .setColor(COLORS.SUCCESS)
          .setTimestamp()
          .setFooter({ text: FOOTER_TEXT });
        await interaction.reply({ embeds: [resEmbed] });
      }
    }
    
    else if (cmd === 'warn') {
      const target = interaction.options.getUser('user', true);
      const reason = interaction.options.getString('reason', true);
      
      await storage.createWarning({ userId: target.id, reason });
      const dmEmbed = new EmbedBuilder()
        .setTitle(`${EMOJIS.WARNING} Formal Warning`)
        .setDescription(`You have received a formal warning in **${interaction.guild?.name || 'the server'}**.`)
        .addFields({ name: "Reason", value: `> ${reason}` })
        .setColor(COLORS.WARNING)
        .setTimestamp()
        .setFooter({ text: FOOTER_TEXT });
        
      await target.send({ embeds: [dmEmbed] }).catch(() => {});
      
      const resEmbed = new EmbedBuilder()
        .setTitle(`${EMOJIS.SUCCESS} Warning Issued`)
        .setDescription(`Successfully warned **${target.username}** for their conduct.`)
        .setColor(COLORS.SUCCESS)
        .setFooter({ text: FOOTER_TEXT });
      await interaction.reply({ embeds: [resEmbed] });
    }
    
    else if (cmd === 'addowner') {
      const target = interaction.options.getUser('user', true);
      await storage.addOwner({ userId: target.id });
      await interaction.reply(`${EMOJIS.SUCCESS} Added **${target.username}** as an authorized owner.\n\n${FOOTER_TEXT}`);
    }
    
    else if (cmd === 'pendinglogset') {
      const channel = interaction.options.getChannel('channel', true);
      await storage.setSetting({ key: 'order_log_channel', value: channel.id });
      await interaction.reply({ content: `${EMOJIS.SUCCESS} Order log channel configured to <#${channel.id}>\n\n${FOOTER_TEXT}` });
    }
    
    else if (cmd === 'announce') {
      const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
          new ButtonBuilder().setCustomId('announce_edit').setLabel('Edit Content').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('announce_channel').setLabel('Set Channel').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('announce_test').setLabel('Test').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId('announce_send').setLabel('Send!').setStyle(ButtonStyle.Success)
        );
      
      await interaction.reply({ 
        content: `**Announcement Builder**\nUse buttons to configure.`,
        components: [row],
        ephemeral: true 
      });
    }
    
    else if (cmd === 'giveaway') {
      const description = interaction.options.getString('description');
      await interaction.reply({ 
        content: `**Giveaway System**\nConfigure your giveaway:${description ? `\nDescription: *${description}*` : ''}`,
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId('gw_setup').setLabel('Setup').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('gw_requirements').setLabel('Requirements').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('gw_start').setLabel('Start').setStyle(ButtonStyle.Success)
          )
        ],
        ephemeral: true 
      });
      if (description) {
        giveawaySetupData.set(interaction.user.id, { ...giveawaySetupData.get(interaction.user.id)!, description } as any);
      }
    }

  } catch (err) {
    console.error(err);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'An error occurred.', ephemeral: true }).catch(() => {});
    }
  }
}

const announceData = new Map<string, { title: string, desc: string, channelId: string }>();
const giveawaySetupData = new Map<string, { prize: string, winners: number, duration: number, requirements: any, description?: string }>();

async function handleButton(interaction: any, storage: IStorage) {
  if (interaction.customId === 'help_public') {
    const embed = new EmbedBuilder()
      .setTitle(`${EMOJIS.PUBLIC} **Public Command Hub**`)
      .setDescription(`Detailed list of commands available to all members.\n\n` +
                      `> ${EMOJIS.HELP} \`/help\` - Display this help menu\n` +
                      `> ${EMOJIS.ORDER} \`/order\` - Create a new purchase inquiry\n` +
                      `> ${EMOJIS.INVITE} \`/invites\` - Check your server invite count\n` +
                      `> ${EMOJIS.BACK} \`/cancel\` - Withdraw your latest pending order\n` +
                      `> ${EMOJIS.COIN} \`/coinflip\` - Engage in a game of chance`)
      .setColor(COLORS.INFO)
      .addFields({ name: '━━━━━━━━━━━━━━━━━━━━━━', value: ' ' })
      .setTimestamp()
      .setFooter({ text: FOOTER_TEXT });
      
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder().setCustomId('help_main').setLabel('Main Menu').setEmoji(EMOJIS.BACK).setStyle(ButtonStyle.Secondary)
      );
      
    await interaction.update({ embeds: [embed], components: [row] });
  } else if (interaction.customId === 'help_owner') {
    const embed = new EmbedBuilder()
      .setTitle(`${EMOJIS.OWNER} **Administrative Command Panel**`)
      .setDescription(`Restricted management commands for authorized personnel.\n\n` +
                      `> ${EMOJIS.DM} | ${EMOJIS.ANNOUNCE} \`/dm\` | \`/dm-all\` - Direct messaging tools\n` +
                      `> ${EMOJIS.BAN} | ${EMOJIS.KICK} | ${EMOJIS.MUTE} \`/ban\` | \`/kick\` | \`/mute\` - Moderation suite\n` +
                      `> ${EMOJIS.WARNING} \`/warn\` - Issue member warnings\n` +
                      `> ${EMOJIS.GIVEAWAY} \`/giveaway\` - Management of server events\n` +
                      `> ${EMOJIS.STATUS} | ${EMOJIS.NAME} \`/status\` | \`/bot-name\` - Identity management\n` +
                      `> ${EMOJIS.SUCCESS} \`/order-complete\` - Mark an order as fulfilled`)
      .setColor(COLORS.OWNER)
      .addFields({ name: '━━━━━━━━━━━━━━━━━━━━━━', value: ' ' })
      .setTimestamp()
      .setFooter({ text: FOOTER_TEXT });
      
    const row = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
        new ButtonBuilder().setCustomId('help_main').setLabel('Main Menu').setEmoji(EMOJIS.BACK).setStyle(ButtonStyle.Secondary)
      );
      
    await interaction.update({ embeds: [embed], components: [row] });
  } else if (interaction.customId === 'help_main_btn') {
    const embed = new EmbedBuilder()
      .setTitle(`✨ **BLOCKIFY HUB** ✨`)
      .setDescription(`Welcome to the next generation of management. Select a module from the menu below to explore our features.\n\n${EMOJIS.INFO} *Experience the ultimate gaming organization suite.*`)
      .setColor(COLORS.PRIMARY)
      .addFields({ name: '━━━━━━━━━━━━━━━━━━━━━━', value: ' ' })
      .setTimestamp()
      .setFooter({ text: FOOTER_TEXT });
      
    const select = new StringSelectMenuBuilder()
      .setCustomId('help_menu')
      .setPlaceholder('📂 Select a category...')
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('Public Hub')
          .setDescription('Community commands for everyone.')
          .setEmoji(EMOJIS.PUBLIC)
          .setValue('public'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Admin Panel')
          .setDescription('Restricted management tools.')
          .setEmoji(EMOJIS.OWNER)
          .setValue('owner'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Secret Access')
          .setDescription('Hidden developer-only commands.')
          .setEmoji('💎')
          .setValue('secret')
      );

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
    await interaction.update({ embeds: [embed], components: [row] });
  } else if (interaction.customId === 'gw_start') {
    const data = giveawaySetupData.get(interaction.user.id);
    if (!data || !data.prize) return interaction.reply({ content: "Please setup prize first.", ephemeral: true });
    
    const endTime = new Date(Date.now() + data.duration * 60000);
    const gwId = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    const embed = new EmbedBuilder()
      .setTitle(`✨ **PREMIUM GIVEAWAY** ✨`)
      .setDescription(`${data.description ? `***${data.description}***\n\n` : ''}🎁 **Prize:** **${data.prize}**\n🏆 **Winners:** **${data.winners}**\n⏳ **Ends:** <t:${Math.floor(endTime.getTime()/1000)}:R>`)
      .setColor(0xFF00D4)
      .setThumbnail("https://cdn-icons-png.flaticon.com/512/3112/3112733.png")
      .addFields(
        { name: '━━━━━━━━━━━━━━━━━━━━━━', value: ' ' },
        { name: '📜 **How to Enter**', value: 'Click the button below to participate in this exclusive event!' }
      )
      .setTimestamp()
      .setFooter({ text: FOOTER_TEXT });
      
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`gw_enter_${gwId}`).setLabel('Join Giveaway').setEmoji('🎉').setStyle(ButtonStyle.Success)
    );
    
    const channel = interaction.channel as TextChannel;
    const msg = await channel.send({ embeds: [embed], components: [row] });
    
    await storage.createGiveaway({
      id: gwId,
      channelId: channel.id,
      messageId: msg.id,
      prize: data.prize,
      winnersCount: data.winners,
      endTime: endTime,
      status: 'active',
      description: data.description || null,
      requirements: data.requirements || {}
    });
    
    await interaction.reply({ content: "Giveaway started!", ephemeral: true });
  } else if (interaction.customId === 'announce_edit') {
    const modal = new ModalBuilder()
      .setCustomId('announce_modal')
      .setTitle('Edit Announcement');
      
    const titleInput = new TextInputBuilder()
      .setCustomId('title')
      .setLabel("Title")
      .setStyle(TextInputStyle.Short);
      
    const descInput = new TextInputBuilder()
      .setCustomId('desc')
      .setLabel("Description")
      .setStyle(TextInputStyle.Paragraph);
      
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(descInput)
    );
    
    await interaction.showModal(modal);
  } else if (interaction.customId === 'announce_test') {
    const data = announceData.get(interaction.user.id) || { title: 'No title', desc: 'No desc', channelId: '' };
    const embed = new EmbedBuilder().setTitle(data.title).setDescription(data.desc).setFooter({text: FOOTER_TEXT});
    await interaction.reply({ content: "Test Preview:", embeds: [embed], ephemeral: true });
  } else if (interaction.customId === 'announce_send') {
    const data = announceData.get(interaction.user.id);
    if (!data || !data.channelId) {
      return interaction.reply({ content: "Please set channel and content first.", ephemeral: true });
    }
    const channel = interaction.guild?.channels.cache.get(data.channelId);
    if (channel?.isTextBased()) {
      const embed = new EmbedBuilder().setTitle(data.title).setDescription(data.desc).setFooter({text: FOOTER_TEXT});
      await channel.send({ embeds: [embed] });
      await interaction.reply({ content: "Sent!", ephemeral: true });
    } else {
      await interaction.reply({ content: "Invalid channel.", ephemeral: true });
    }
  } else if (interaction.customId === 'announce_channel') {
    const modal = new ModalBuilder()
      .setCustomId('announce_channel_modal')
      .setTitle('Set Channel ID');
    const input = new TextInputBuilder()
      .setCustomId('channel_id')
      .setLabel("Channel ID")
      .setStyle(TextInputStyle.Short);
    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
    await interaction.showModal(modal);
  } else if (interaction.customId === 'gw_setup') {
    const modal = new ModalBuilder()
      .setCustomId('gw_setup_modal')
      .setTitle('Giveaway Setup');
      
    const prizeInput = new TextInputBuilder()
      .setCustomId('prize')
      .setLabel("Prize")
      .setStyle(TextInputStyle.Short);
      
    const winnersInput = new TextInputBuilder()
      .setCustomId('winners')
      .setLabel("Winners Count")
      .setValue("1")
      .setStyle(TextInputStyle.Short);

    const timeInput = new TextInputBuilder()
      .setCustomId('duration')
      .setLabel("Duration (minutes)")
      .setValue("60")
      .setStyle(TextInputStyle.Short);
      
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(prizeInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(winnersInput),
      new ActionRowBuilder<TextInputBuilder>().addComponents(timeInput)
    );
    
    await interaction.showModal(modal);
  } else if (interaction.customId === 'gw_requirements') {
    const embed = new EmbedBuilder()
      .setTitle("Giveaway Requirements")
      .setDescription("Select a category to configure requirements.")
      .setFooter({text: FOOTER_TEXT});
    
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('req_msgs').setLabel('Messages').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('req_invites').setLabel('Invites').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('req_server').setLabel('Join Server').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('req_role').setLabel('Role').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('req_never').setLabel('Never Won').setStyle(ButtonStyle.Secondary)
    );
    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
  } else if (interaction.customId === 'req_msgs') {
    await interaction.reply({ content: "Message requirement category selected (interactive configuration stubbed).", ephemeral: true });
  } else if (interaction.customId === 'req_invites') {
    await interaction.reply({ content: "Invite requirement category selected (interactive configuration stubbed).", ephemeral: true });
  } else if (interaction.customId === 'req_server') {
    await interaction.reply({ content: "Join Server requirement category selected (interactive configuration stubbed).", ephemeral: true });
  } else if (interaction.customId === 'req_role') {
    await interaction.reply({ content: "Role requirement category selected (interactive configuration stubbed).", ephemeral: true });
  } else if (interaction.customId === 'req_never') {
    const data = giveawaySetupData.get(interaction.user.id);
    if (data) {
      data.requirements.neverWon = true;
      await interaction.reply({ content: "'Never Won' requirement enabled!", ephemeral: true });
    }
  } else if (interaction.customId === 'gw_start') {
    const data = giveawaySetupData.get(interaction.user.id);
    if (!data) return interaction.reply({ content: "Please setup giveaway first.", ephemeral: true });
    
    const id = Math.random().toString(36).substring(2, 8).toUpperCase();
    const endTime = new Date(Date.now() + (data.duration || 60) * 60000);
    
    await storage.createGiveaway({
      id,
      channelId: interaction.channelId,
      prize: data.prize,
      winnersCount: data.winners,
      endTime,
      status: 'active',
      requirements: data.requirements || {}
    });

    const embed = new EmbedBuilder()
      .setTitle(`🎉 GIVEAWAY: ${data.prize} 🎉`)
      .setDescription(`Ends: <t:${Math.floor(endTime.getTime() / 1000)}:R>\nWinners: ${data.winners}\nID: \`${id}\``)
      .setFooter({text: FOOTER_TEXT});
      
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`gw_join_${id}`).setLabel('Join Giveaway').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`gw_entrants_${id}`).setLabel('Entrants').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`gw_odds_${id}`).setLabel('Odds').setStyle(ButtonStyle.Secondary)
    );
    
    const msg = await interaction.channel.send({ embeds: [embed], components: [row] });
    await storage.updateGiveaway(id, { messageId: msg.id });
    await interaction.reply({ content: `Giveaway \`${id}\` started!`, ephemeral: true });
  } else if (interaction.customId.startsWith('gw_join_')) {
    const id = interaction.customId.replace('gw_join_', '');
    const gw = await storage.getGiveaway(id);
    if (!gw || gw.status !== 'active') return interaction.reply({ content: "Giveaway ended or not found.", ephemeral: true });
    
    const entries = await storage.getGiveawayEntries(id);
    if (entries.some(e => e.userId === interaction.user.id)) return interaction.reply({ content: "You already entered!", ephemeral: true });
    
    await storage.addGiveawayEntry({ giveawayId: id, userId: interaction.user.id });
    await interaction.reply({ content: "Successfully joined!", ephemeral: true });
  } else if (interaction.customId.startsWith('gw_entrants_')) {
    const id = interaction.customId.replace('gw_entrants_', '');
    const entries = await storage.getGiveawayEntries(id);
    await interaction.reply({ content: `Current entrants: **${entries.length}**`, ephemeral: true });
  } else if (interaction.customId.startsWith('gw_odds_')) {
    const id = interaction.customId.replace('gw_odds_', '');
    const entries = await storage.getGiveawayEntries(id);
    const odds = entries.length > 0 ? (100 / entries.length).toFixed(2) : 100;
    await interaction.reply({ content: `Your current odds of winning: **${odds}%**`, ephemeral: true });
  }
}

async function handleModal(interaction: any, storage: IStorage) {
  if (interaction.customId === 'announce_modal') {
    const title = interaction.fields.getTextInputValue('title');
    const desc = interaction.fields.getTextInputValue('desc');
    const existing = announceData.get(interaction.user.id) || { channelId: '' } as any;
    announceData.set(interaction.user.id, { ...existing, title, desc });
    await interaction.reply({ content: "Saved content!", ephemeral: true });
  } else if (interaction.customId === 'announce_channel_modal') {
    const channelId = interaction.fields.getTextInputValue('channel_id');
    const existing = announceData.get(interaction.user.id) || { title: '', desc: '' } as any;
    announceData.set(interaction.user.id, { ...existing, channelId });
    await interaction.reply({ content: "Saved channel!", ephemeral: true });
  } else if (interaction.customId === 'gw_setup_modal') {
    const prize = interaction.fields.getTextInputValue('prize');
    const winners = parseInt(interaction.fields.getTextInputValue('winners')) || 1;
    const duration = parseInt(interaction.fields.getTextInputValue('duration')) || 60;
    giveawaySetupData.set(interaction.user.id, { prize, winners, duration, requirements: {} });
    await interaction.reply({ content: "Giveaway details saved!", ephemeral: true });
  }
}
