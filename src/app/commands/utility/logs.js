import { commandkit } from 'commandkit';
import { ApplicationCommandOptionType, PermissionFlagsBits, EmbedBuilder, Colors, ChannelType } from 'discord.js';
import Server from '../../models/Server.js'; // adjust path
import { getGuildPrefix, getGuildDoc } from '../../cache/guildCache.js';
import { revalidateTag } from '@commandkit/cache';

commandkit.setPrefixResolver(async (message) => {
  if (!message.inGuild) return ',';
  return await getGuildPrefix(message.guildId);
});

/** @type {import('commandkit').CommandData} */
export const command = {
  name: 'logs',
  description: 'Manage server logging channels',
  options: [
    {
      name: 'set',
      description: 'Set a logging channel',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'type',
          description: 'Which log type to set',
          type: ApplicationCommandOptionType.String,
          required: true,
          autocomplete: true,
        },
        {
          name: 'channel',
          description: 'The text channel for logs',
          type: ApplicationCommandOptionType.Channel,
          required: true,
        },
      ],
    },
    {
      name: 'disable',
      description: 'Disable a logging channel',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'type',
          description: 'Which log type to disable',
          type: ApplicationCommandOptionType.String,
          required: true,
          autocomplete: true,
        },
      ],
    },
    {
      name: 'view',
      description: 'View current logging channels',
      type: ApplicationCommandOptionType.Subcommand,
    },
  ],
};

/** @param {import('commandkit').ChatInputCommandContext} ctx */
export const chatInput = async (ctx) => {
  const { interaction } = ctx;
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guild) return interaction.editReply('This is a server-only command.');

  // OWNER_ID bypass OR Administrator check
  if (
    interaction.user.id !== process.env.OWNER_ID &&
    !interaction.member?.permissions.has(PermissionFlagsBits.Administrator)
  ) {
    return interaction.editReply('You cannot use this command.');
  }

  const sub = interaction.options.getSubcommand();
  const guildId = interaction.guildId;
  const logTypes = ['sayLogs', 'dmLogs'];

  if (sub === 'set') {
    const type = interaction.options.getString('type');
    const channel = interaction.options.getChannel('channel');

    if (!logTypes.includes(type)) return interaction.editReply('Invalid log type.');
    if (![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) {
      return interaction.editReply('Please select a text-based channel.');
    }

    const path = `modules.logs.misc.${type}.channel`;
    await Server.findOneAndUpdate({ guildId }, { $set: { [path]: channel.id } }, { upsert: true });
    revalidateTag(`server:${guildId}`);

    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.Green)
          .setTitle('✅ Log Channel Updated')
          .setDescription(`**${type.replace('Logs', ' Logs')}** will now log to ${channel}`)
          .setTimestamp(),
      ],
    });
  }

  if (sub === 'disable') {
    const type = interaction.options.getString('type');
    if (!logTypes.includes(type)) return interaction.editReply('Invalid log type.');

    const path = `modules.logs.misc.${type}.channel`;
    await Server.findOneAndUpdate({ guildId }, { $set: { [path]: '' } }, { upsert: true });
    revalidateTag(`server:${guildId}`);

    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.Yellow)
          .setTitle('⚠️ Log Channel Disabled')
          .setDescription(`**${type.replace('Logs', ' Logs')}** logging has been disabled.`)
          .setTimestamp(),
      ],
    });
  }

  if (sub === 'view') {
    const serverDoc = await getGuildDoc(guildId);
    const sayChannelId = serverDoc?.modules?.logs?.misc?.sayLogs?.channel;
    const dmChannelId = serverDoc?.modules?.logs?.misc?.dmLogs?.channel;

    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.Blue)
          .setTitle('📜 Current Logging Channels')
          .addFields(
            { name: 'Say Logs', value: sayChannelId ? `<#${sayChannelId}>` : 'Disabled', inline: true },
            { name: 'DM Logs', value: dmChannelId ? `<#${dmChannelId}>` : 'Disabled', inline: true },
          )
          .setTimestamp(),
      ],
    });
  }
};

/** @type {import('commandkit').AutocompleteCommand} */
export const autocomplete = async ({ interaction }) => {
  try {
    const input = interaction.options.getString('type', false);
    const logTypes = ['sayLogs', 'dmLogs'];
    const filtered = logTypes.filter((l) => !input || l.toLowerCase().includes(input.toLowerCase()));
    await interaction.respond(filtered.map((l) => ({ name: l, value: l })));
  } catch (err) {
    console.error('autocomplete error:', err);
  }
};

/** @type {import('commandkit').CommandMetadataFunction} */
export const generateMetadata = async () => ({
  // guilds: [process.env.DEV_GUILD],
});
