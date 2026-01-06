import { commandkit } from 'commandkit';
import { getGuildPrefix } from '../../cache/guildCache.js';
import { EmbedBuilder, Colors } from 'discord.js';

commandkit.setPrefixResolver(async (message) => {
  if (!message.inGuild) return ',';
  return await getGuildPrefix(message.guildId);
});

/**
 * @type {import('commandkit').CommandData}
 */
export const command = {
  name: 'ping',
  description: "Ping the bot to check if it's online.",
};

/**
 * helper to format uptime
 */
function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000) % 60;
  const minutes = Math.floor(ms / (1000 * 60)) % 60;
  const hours = Math.floor(ms / (1000 * 60 * 60)) % 24;
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));

  let parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);

  return parts.join(' ');
}

/**
 * @param {import('commandkit').ChatInputCommandContext} ctx
 */
export const chatInput = async (ctx) => {
  const latency = ctx.client.ws.ping ?? -1;
  const uptime = formatUptime(ctx.client.uptime);

  const embed = new EmbedBuilder()
    .setTitle('🏓 Pong!')
    .setColor(Colors.Blue)
    .addFields(
      { name: 'Latency', value: `${latency}ms`, inline: true },
      { name: 'Uptime', value: uptime, inline: true },
    );

  await ctx.interaction.reply({ embeds: [embed] });
};

/**
 * @param {import('commandkit').MessageCommandContext} ctx
 */
export const message = async (ctx) => {
  const latency = ctx.client.ws.ping ?? -1;
  const uptime = formatUptime(ctx.client.uptime);

  const embed = new EmbedBuilder()
    .setTitle('🏓 Pong!')
    .setColor(Colors.Blue)
    .addFields(
      { name: 'Latency', value: `${latency}ms`, inline: true },
      { name: 'Uptime', value: uptime, inline: true },
    );

  await ctx.message.reply({ embeds: [embed] });
};

/**
 * @typedef {import('commandkit').CommandMetadataFunction} CommandMetadataFunction
 */

/** @type {CommandMetadataFunction} */
export const generateMetadata = async () => ({
  aliases: ['p', 'pong'],
});
