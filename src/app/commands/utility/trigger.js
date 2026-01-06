import { commandkit } from 'commandkit';
import { ApplicationCommandOptionType, EmbedBuilder, Colors } from 'discord.js';
import { getGuildPrefix } from '../../cache/guildCache.js';
import { getGuildTriggers } from '../../cache/triggerCache.js';
import Server from '../../models/Server.js';
import { revalidateTag } from '@commandkit/cache';

const OWNER_ID = process.env.OWNER_ID;
const cooldown = new Map();

commandkit.setPrefixResolver(async (message) => {
  if (!message.inGuild()) return ',';
  return await getGuildPrefix(message.guildId);
});

const applyCooldown = (userId, ms = 5000) => {
  const last = cooldown.get(userId);
  if (last && Date.now() - last < ms) return true;
  cooldown.set(userId, Date.now());
  return false;
};

const checkPermissions = (userId, member) => {
  return userId === OWNER_ID || member.permissions.has('ManageChannels') || member.permissions.has('Administrator');
};

export const command = {
  name: 'trigger',
  description: 'Manage custom triggers for your server',
  options: [
    {
      name: 'create',
      description: 'Create a new trigger',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'keyword',
          description: 'Trigger word/phrase',
          type: ApplicationCommandOptionType.String,
          required: true,
        },
        {
          name: 'response',
          description: 'Message to respond with',
          type: ApplicationCommandOptionType.String,
          required: true,
        },
      ],
    },
    {
      name: 'delete',
      description: 'Delete an existing trigger',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'keyword',
          description: 'Trigger keyword to delete',
          type: ApplicationCommandOptionType.String,
          required: true,
        },
      ],
    },
    {
      name: 'view',
      description: 'View all triggers for this server',
      type: ApplicationCommandOptionType.Subcommand,
    },
  ],
};

export const chatInput = async (ctx) => {
  await ctx.interaction.deferReply();
  const { interaction } = ctx;
  if (!interaction.guild) return interaction.editReply('This is a server-only command.');

  if (applyCooldown(interaction.user.id)) return interaction.editReply('Slow down, you’re spamming!');
  if (!checkPermissions(interaction.user.id, interaction.member))
    return interaction.editReply('You don’t have permission to manage triggers.');

  const guildId = interaction.guildId;
  const sub = interaction.options.getSubcommand();

  // fetch triggers from cache/DB
  const cached = await getGuildTriggers(guildId);

  if (sub === 'create') {
    const keyword = interaction.options.getString('keyword').toLowerCase();
    const response = interaction.options.getString('response');

    if (cached.list.some((t) => t.keyword === keyword))
      return interaction.editReply(`Trigger **${keyword}** already exists.`);

    cached.list.push({ keyword, response });
    await Server.findOneAndUpdate({ guildId }, { 'modules.triggers.list': cached.list });
    revalidateTag(`server:${guildId}`);

    return interaction.editReply(`✅ Added trigger **${keyword}** → ${response}`);
  }

  if (sub === 'delete') {
    const keyword = interaction.options.getString('keyword').toLowerCase();
    const before = cached.list.length;
    cached.list = cached.list.filter((t) => t.keyword !== keyword);

    if (before === cached.list.length) return interaction.editReply(`No trigger found for **${keyword}**.`);

    await Server.findOneAndUpdate({ guildId }, { 'modules.triggers.list': cached.list });
    revalidateTag(`server:${guildId}`);

    return interaction.editReply(`🗑️ Deleted trigger **${keyword}**`);
  }

  if (sub === 'view') {
    if (!cached.list.length) return interaction.editReply('No triggers found for this server.');
    const lines = cached.list.map((t, i) => `**${i + 1}.** \`${t.keyword}\` → ${t.response}`).join('\n');
    return interaction.editReply({
      embeds: [new EmbedBuilder().setTitle('📜 Triggers').setColor(Colors.Blurple).setDescription(lines)],
    });
  }
};
