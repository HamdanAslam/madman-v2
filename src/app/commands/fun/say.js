import { commandkit } from 'commandkit';
import { getGuildPrefix, getGuildDoc } from '../../cache/guildCache.js';
import { ApplicationCommandOptionType, MessageFlags, EmbedBuilder, Colors } from 'discord.js';
import Server from '../../models/Server.js'; // make sure this path is correct
const cooldown = new Map();

/** @type {import('commandkit').CommandData} */
export const command = {
  name: 'say',
  description: 'Make the bot say something',
  options: [
    {
      name: 'content',
      description: 'The message content',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: 'message-id',
      description: 'The message to be replied to',
      type: ApplicationCommandOptionType.String,
    },
  ],
};

/** @param {import('commandkit').ChatInputCommandContext} ctx */
export const chatInput = async (ctx) => {
  const { interaction, client } = ctx;
  const content = interaction.options.getString('content');
  const messageId = interaction.options.getString('message-id');

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (interaction.user.id !== process.env.OWNER_ID && !interaction.member?.permissions.has('Administrator')) {
    return await interaction.editReply({ content: 'You cannot use this command.' });
  }

  let sentMessage;
  try {
    if (messageId) {
      const targetMessage = await interaction.channel.messages.fetch(messageId);
      sentMessage = await targetMessage.reply(content);
      await interaction.editReply({ content: '✅ Replied to message.' });
    } else {
      sentMessage = await interaction.channel.send(content);
      await interaction.editReply({ content: '✅ Message sent to channel.' });
    }

    await logCommand(client, interaction, content, sentMessage, true);
  } catch (err) {
    await interaction.editReply({ content: `⚠️ Failed to send message: ${err.message}` });
    await logCommand(client, interaction, content, null, false);
  }
};

/**
 * Logs the command execution to the sayLogs channel set for this guild
 */
async function logCommand(client, interaction, content, sentMessage, success) {
  if (!interaction.guildId) return; // skip if DM

  const serverDoc = await getGuildDoc(interaction.guildId);
  const logChannelId = serverDoc?.modules?.logs?.misc?.sayLogs?.channel;
  if (!logChannelId) return; // no log channel set

  const guild = client.guilds.cache.get(interaction.guildId);
  if (!guild) return;

  const logChannel = guild.channels.cache.get(logChannelId);
  if (!logChannel || !logChannel.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setTitle('🗣️ Command Executed: /say')
    .setColor(success ? Colors.Green : Colors.Red)
    .addFields(
      {
        name: 'Executor',
        value: `${interaction.user.tag} (<@${interaction.user.id}>)\n**ID:** \`${interaction.user.id}\``,
      },
      {
        name: 'Guild',
        value: `${interaction.guild?.name ?? 'DM'}\n**ID:** \`${interaction.guild?.id ?? 'N/A'}\``,
      },
      {
        name: 'Channel',
        value: `${interaction.channel?.name ?? 'DMs'} (<#${interaction.channel?.id}>)\n**ID:** \`${interaction.channel?.id ?? 'N/A'}\``,
      },
      {
        name: 'Status',
        value: success ? '✅ Success' : '❌ Failed',
        inline: true,
      },
      {
        name: 'Message Content',
        value: `\`\`\`${content}\`\`\``,
      },
    )
    .setFooter({
      text: sentMessage ? `Sent Message ID: ${sentMessage.id}` : `No message sent`,
    })
    .setTimestamp();

  await logChannel.send({ embeds: [embed] });
}

/** @type {import('commandkit').CommandMetadataFunction} */
export const generateMetadata = async () => {
  return {};
};
