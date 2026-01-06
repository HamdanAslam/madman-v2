import { commandkit } from 'commandkit';
import { getGuildPrefix } from '../../cache/guildCache.js';
import { EmbedBuilder } from 'discord.js';

commandkit.setPrefixResolver(async (message) => {
  if (!message.inGuild) return ',';
  return await getGuildPrefix(message.guildId);
});

/**
 * @type {import('commandkit').CommandData}
 */
export const command = {
  name: 'servers',
  description: 'List all servers the bot is in',
};

/**
 * @param {import('commandkit').ChatInputCommandContext} ctx
 */
export const chatInput = async (ctx) => {
  await ctx.interaction.deferReply();

  const guilds = ctx.client.guilds.cache;
  const totalServers = guilds.size;

  if (totalServers === 0) {
    return ctx.interaction.editReply('No servers found.');
  }

  // Build server list with spacing
  const serverList = guilds.map((guild) => `**${guild.name}**\nID: \`${guild.id}\` | Members: ${guild.memberCount}\n`);

  // Chunk the list
  const chunks = chunkServerList(serverList, 2000);

  // Send first chunk
  const firstEmbed = new EmbedBuilder()
    .setTitle('📊 Server List')
    .setDescription(chunks[0])
    .setColor(0x5865f2)
    .setFooter({ text: `Total: ${totalServers} servers | Page 1/${chunks.length}` })
    .setTimestamp();

  await ctx.interaction.editReply({ embeds: [firstEmbed] });

  // Send remaining chunks
  for (let i = 1; i < chunks.length; i++) {
    const embed = new EmbedBuilder()
      .setTitle('📊 Server List (continued)')
      .setDescription(chunks[i])
      .setColor(0x5865f2)
      .setFooter({ text: `Page ${i + 1}/${chunks.length}` })
      .setTimestamp();

    await ctx.interaction.followUp({ embeds: [embed] });
  }
};

/**
 * Chunks server list into strings under maxLength
 */
function chunkServerList(servers, maxLength) {
  const chunks = [];
  let currentChunk = [];
  let currentLength = 0;

  for (const server of servers) {
    const length = server.length + 1;

    if (currentLength + length > maxLength) {
      chunks.push(currentChunk.join('\n'));
      currentChunk = [server];
      currentLength = length;
    } else {
      currentChunk.push(server);
      currentLength += length;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join('\n'));
  }

  return chunks;
}

/**
 * @typedef {import('commandkit').CommandMetadataFunction} CommandMetadataFunction
 */
/** @type {CommandMetadataFunction} */
export const generateMetadata = async () => {
  return {
    guilds: [process.env.DEV_GUILD],
  };
};
