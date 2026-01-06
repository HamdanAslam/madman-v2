import { commandkit } from 'commandkit';
import { getGuildPrefix } from '../../cache/guildCache.js';
import { EmbedBuilder, Colors } from 'discord.js';
import axios from 'axios';

// Cooldown map: userId -> timestamp of last command
const cooldowns = new Map();

commandkit.setPrefixResolver(async (message) => {
  if (!message.inGuild) return ','; // default DM prefix
  return await getGuildPrefix(message.guildId);
});

/**
 * @type {import('commandkit').CommandData}
 */
export const command = {
  name: 'cat',
  description: 'Get a random cat image',
};

/**
 * Check if user is on cooldown
 */
const isOnCooldown = (userId) => {
  const now = Date.now();
  const last = cooldowns.get(userId) || 0;
  if (now - last < 5000) return true; // 5 seconds
  cooldowns.set(userId, now);
  return false;
};

/**
 * @param {import('commandkit').ChatInputCommandContext} ctx
 */
export const chatInput = async (ctx) => {
  if (isOnCooldown(ctx.interaction.user.id)) {
    await ctx.interaction.reply({ content: 'COOLDOWN!!!!', ephemeral: true }).catch(() => {});
    return;
  }

  const { data } = await axios.get('https://api.thecatapi.com/v1/images/search').catch(() => ({ data: [] }));
  const cat = data[0];

  await ctx.interaction.deferReply();

  if (!cat?.url) {
    await ctx.interaction.editReply('No cat found...').catch(() => {});
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('🐱 enjoy cat')
    .setImage(cat.url)
    .setColor(Colors.Purple)
    .setFooter({ text: `Command executed by ${ctx.interaction.user.tag}` })
    .setTimestamp();

  return await ctx.interaction.editReply({ embeds: [embed] });
};

/**
 * @param {import('commandkit').MessageCommandContext} ctx
 */
export const message = async (ctx) => {
  if (isOnCooldown(ctx.message.author.id)) {
    // silently fail for prefix commands
    return;
  }

  const { data } = await axios.get('https://api.thecatapi.com/v1/images/search').catch(() => ({ data: [] }));
  const cat = data[0];

  if (!cat?.url) {
    await ctx.message.reply('No cat found...').catch(() => {});
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('🐱 enjoy cat')
    .setImage(cat.url)
    .setColor(Colors.Purple)
    .setFooter({ text: `Command executed by ${ctx.message.author.tag}` })
    .setTimestamp();

  return await ctx.message.reply({ embeds: [embed] });
};

/**
 * @typedef {import('commandkit').CommandMetadataFunction} CommandMetadataFunction
 */

/** @type {CommandMetadataFunction} */
export const generateMetadata = async () => {
  return {
    aliases: ['kitty', 'kit'],
  };
};
