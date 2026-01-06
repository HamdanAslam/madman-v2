import { commandkit } from 'commandkit';
import {
  ApplicationCommandOptionType,
  PermissionFlagsBits,
  EmbedBuilder,
  Colors,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from 'discord.js';
import Server from '../../models/Server.js';
import { getGuildPrefix, getGuildDoc } from '../../cache/guildCache.js';
import { revalidateTag } from '@commandkit/cache';

commandkit.setPrefixResolver(async (message) => {
  if (!message.inGuild) return ',';
  return await getGuildPrefix(message.guildId);
});

/** @type {import('commandkit').CommandData} */
export const command = {
  name: 'counting',
  description: 'Manage the counting module',
  options: [
    {
      name: 'set-channel',
      description: 'Set the counting channel',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'channel',
          description: 'The text channel to use for counting',
          type: ApplicationCommandOptionType.Channel,
          required: true,
        },
      ],
    },
    {
      name: 'toggle',
      description: 'Enable or disable the counting module',
      type: ApplicationCommandOptionType.Subcommand,
    },
    {
      name: 'view-channel',
      description: 'View the current counting channel',
      type: ApplicationCommandOptionType.Subcommand,
    },
    {
      name: 'set-message',
      description: 'Set a custom fail message',
      type: ApplicationCommandOptionType.Subcommand,
    },
    {
      name: 'view-message',
      description: 'View the current fail message',
      type: ApplicationCommandOptionType.Subcommand,
    },
    {
      name: 'toggle-revive',
      description: 'Toggle the revive feature',
      type: ApplicationCommandOptionType.Subcommand,
    },
    {
      name: 'toggle-failtext',
      description: 'Toggle fail messages',
      type: ApplicationCommandOptionType.Subcommand,
    },
    {
      name: 'details',
      description: 'View all counting settings and stats',
      type: ApplicationCommandOptionType.Subcommand,
    },
  ],
};

/** @param {import('commandkit').ChatInputCommandContext} ctx */
export const chatInput = async (ctx) => {
  const { interaction } = ctx;

  if (!interaction.guild) {
    return interaction.reply({ content: 'This is a server-only command.' });
  }

  const isOwner = interaction.user.id === process.env.OWNER_ID;
  const isAdmin = interaction.member?.permissions.has(PermissionFlagsBits.Administrator);

  if (!isOwner && !isAdmin) {
    return interaction.reply({ content: 'You need Administrator permissions to use this command.' });
  }

  const sub = interaction.options.getSubcommand();
  const guildId = interaction.guildId;

  // --- SET CHANNEL ---
  if (sub === 'set-channel') {
    await interaction.deferReply();
    const channel = interaction.options.getChannel('channel');

    if (!isOwner && ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) {
      return interaction.editReply('Please select a text-based channel.');
    }

    await Server.findOneAndUpdate(
      { guildId },
      {
        $set: {
          'modules.counting.channel': channel.id,
          'modules.counting.status': true,
          'modules.counting.current': 1,
          'modules.counting.lastUser': '',
        },
      },
      { upsert: true },
    );
    revalidateTag(`server:${guildId}`);

    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.Green)
          .setTitle('✅ Counting Channel Set')
          .setDescription(`Counting channel set to ${channel}\nStarting number: **1**`)
          .setTimestamp(),
      ],
    });
  }

  // --- TOGGLE ---
  if (sub === 'toggle') {
    await interaction.deferReply();
    const serverDoc = await getGuildDoc(guildId);
    const currentStatus = serverDoc?.modules?.counting?.status || false;

    await Server.findOneAndUpdate(
      { guildId },
      { $set: { 'modules.counting.status': !currentStatus } },
      { upsert: true },
    );
    revalidateTag(`server:${guildId}`);

    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(currentStatus ? Colors.Yellow : Colors.Green)
          .setTitle(`${currentStatus ? '❌' : '✅'} Counting ${currentStatus ? 'Disabled' : 'Enabled'}`)
          .setDescription(`Counting module is now **${currentStatus ? 'disabled' : 'enabled'}**.`)
          .setTimestamp(),
      ],
    });
  }

  // --- VIEW CHANNEL ---
  if (sub === 'view-channel') {
    await interaction.deferReply();
    const serverDoc = await getGuildDoc(guildId);
    const channel = serverDoc?.modules?.counting?.channel;

    if (!channel) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.Yellow)
            .setTitle('⚠️ No Channel Set')
            .setDescription('No counting channel has been configured yet.')
            .setTimestamp(),
        ],
      });
    }

    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.Blue)
          .setTitle('📍 Counting Channel')
          .setDescription(`Current counting channel: <#${channel}>`)
          .setTimestamp(),
      ],
    });
  }

  // --- SET MESSAGE (MODAL) ---
  if (sub === 'set-message') {
    const serverDoc = await getGuildDoc(guildId);
    const currentFailMessage = serverDoc?.modules?.counting?.failMessage || 'Oops! <user> ruined it at **{number}**!';

    const modal = new ModalBuilder().setCustomId('counting-fail-message').setTitle('Set Fail Message');

    const messageInput = new TextInputBuilder()
      .setCustomId('fail-message')
      .setLabel('Fail Message')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Oops! {user} ruined it at **{number}**!')
      .setValue(currentFailMessage)
      .setRequired(true)
      .setMaxLength(500);

    const actionRow = new ActionRowBuilder().addComponents(messageInput);
    modal.addComponents(actionRow);

    await interaction.showModal(modal);
    return;
  }

  // --- VIEW MESSAGE ---
  if (sub === 'view-message') {
    await interaction.deferReply();
    const serverDoc = await getGuildDoc(guildId);
    const failMessage = serverDoc?.modules?.counting?.failMessage || 'Oops! <user> ruined it at **{number}**!';

    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.Blue)
          .setTitle('💬 Current Fail Message')
          .setDescription(failMessage)
          .setFooter({ text: 'Use {user} and {number} as placeholders' })
          .setTimestamp(),
      ],
    });
  }

  // --- TOGGLE REVIVE ---
  if (sub === 'toggle-revive') {
    await interaction.deferReply();
    const serverDoc = await getGuildDoc(guildId);
    const currentRevive = serverDoc?.modules?.counting?.revive ?? true;

    await Server.findOneAndUpdate(
      { guildId },
      { $set: { 'modules.counting.revive': !currentRevive } },
      { upsert: true },
    );
    revalidateTag(`server:${guildId}`);

    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(currentRevive ? Colors.Yellow : Colors.Green)
          .setTitle(`${currentRevive ? '❌' : '✅'} Revive ${currentRevive ? 'Disabled' : 'Enabled'}`)
          .setDescription(`Counting revive is now **${currentRevive ? 'disabled' : 'enabled'}**.`)
          .setTimestamp(),
      ],
    });
  }

  // --- TOGGLE FAILTEXT ---
  if (sub === 'toggle-failtext') {
    await interaction.deferReply();
    const serverDoc = await getGuildDoc(guildId);
    const currentFailMessages = serverDoc?.modules?.counting?.failMessages ?? true;

    await Server.findOneAndUpdate(
      { guildId },
      { $set: { 'modules.counting.failMessages': !currentFailMessages } },
      { upsert: true },
    );
    revalidateTag(`server:${guildId}`);

    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(currentFailMessages ? Colors.Yellow : Colors.Green)
          .setTitle(
            `${currentFailMessages ? '❌' : '✅'} Fail Messages ${currentFailMessages ? 'Disabled' : 'Enabled'}`,
          )
          .setDescription(`Fail messages are now **${currentFailMessages ? 'disabled' : 'enabled'}**.`)
          .setTimestamp(),
      ],
    });
  }

  // --- DETAILS ---
  if (sub === 'details') {
    await interaction.deferReply();
    const serverDoc = await getGuildDoc(guildId);
    const counting = serverDoc?.modules?.counting || {};

    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.Blue)
          .setTitle('📊 Counting Module Details')
          .addFields(
            { name: 'Status', value: counting.status ? '✅ Enabled' : '❌ Disabled', inline: true },
            { name: 'Channel', value: counting.channel ? `<#${counting.channel}>` : 'Not set', inline: true },
            { name: 'Current Count', value: (counting.current ?? 1).toString(), inline: true },
            { name: 'High Score', value: (counting.highscore ?? 0).toString(), inline: true },
            {
              name: 'Fail Messages',
              value: (counting.failMessages ?? true) ? '✅ Enabled' : '❌ Disabled',
              inline: true,
            },
            { name: 'Revive', value: (counting.revive ?? true) ? '✅ Enabled' : '❌ Disabled', inline: true },
            {
              name: 'Fail Message',
              value: counting.failMessage || 'Oops! <user> ruined it at **{number}**!',
              inline: false,
            },
          )
          .setTimestamp(),
      ],
    });
  }
};

/** @type {import('commandkit').CommandMetadataFunction} */
export const generateMetadata = async () => ({
  // guilds: [process.env.DEV_GUILD],
});
