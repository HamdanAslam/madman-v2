import { commandkit } from 'commandkit';
import { getGuildPrefix, getGuildDoc } from '../../cache/guildCache.js';
import { ApplicationCommandOptionType, EmbedBuilder, Colors } from 'discord.js';
import Server from '../../models/Server.js'; // fix path if needed
const cooldown = new Map();

/** @type {import('commandkit').CommandData} */
export const command = {
  name: 'dm',
  description: 'Send a DM to a server member',
  options: [
    {
      name: 'target',
      description: 'The target user to receive the message',
      type: ApplicationCommandOptionType.User,
      required: true,
    },
    {
      name: 'message',
      description: 'The message to send',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],
};

/** @param {import('commandkit').ChatInputCommandContext} ctx */
export const chatInput = async (ctx) => {
  const { interaction, client } = ctx;
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guild) {
    return interaction.editReply('This command can only be used inside a server.');
  }

  const target = interaction.options.getUser('target');
  const message = interaction.options.getString('message');

  // Permission check
  if (interaction.user.id !== process.env.OWNER_ID && !interaction.member?.permissions.has('Administrator')) {
    return interaction.editReply('You cannot use this command.');
  }

  if (!target) return interaction.editReply('Invalid target.');
  if (!message) return interaction.editReply('No message provided.');

  try {
    await target.send(message);
    await interaction.editReply(`✅ DM sent to **${target.tag}** (\`${target.id}\`)`);
    await logCommand(client, interaction, target, message, true);
  } catch (err) {
    await interaction.editReply(
      `⚠️ Could not send DM to **${target.tag}** (\`${target.id}\`) (they might have DMs disabled).`,
    );
    await logCommand(client, interaction, target, message, false);
  }
};

/**
 * Logs the DM command to the dmLogs channel set for this guild
 */
async function logCommand(client, interaction, target, message, success) {
  if (!interaction.guildId) return;

  const serverDoc = await getGuildDoc(interaction.guildId);
  const logChannelId = serverDoc?.modules?.logs?.misc?.dmLogs?.channel;
  if (!logChannelId) return; // no DM log channel set

  const guild = client.guilds.cache.get(interaction.guildId);
  if (!guild) return;

  const logChannel = guild.channels.cache.get(logChannelId);
  if (!logChannel || !logChannel.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setTitle('📜 Command Executed: /dm')
    .setColor(success ? Colors.Green : Colors.Red)
    .addFields(
      {
        name: 'Executor',
        value: `${interaction.user.tag} (<@${interaction.user.id}>)\n**ID:** \`${interaction.user.id}\``,
      },
      {
        name: 'Target',
        value: `${target.tag} (<@${target.id}>)\n**ID:** \`${target.id}\``,
      },
      { name: 'Status', value: success ? '✅ Success' : '❌ Failed', inline: true },
      { name: 'Message', value: `\`\`\`${message}\`\`\`` },
    )
    .setFooter({
      text: `Guild: ${interaction.guild?.name ?? 'DM'} | Guild ID: ${interaction.guild?.id ?? 'N/A'}`,
    })
    .setTimestamp();

  await logChannel.send({ embeds: [embed] });
}

/** @type {import('commandkit').CommandMetadataFunction} */
export const generateMetadata = async () => {
  return {};
};
