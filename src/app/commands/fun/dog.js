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
  name: 'dog',
  description: 'Get a random dog image',
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

  const { data } = await axios.get('https://dog.ceo/api/breeds/image/random').catch(() => ({ data: {} }));
  const dogUrl = data?.message;

  await ctx.interaction.deferReply();

  if (!dogUrl) {
    await ctx.interaction.editReply('No dog found...').catch(() => {});
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('🐶 enjoy dog')
    .setImage(dogUrl)
    .setColor(Colors.Gold)
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

  const { data } = await axios.get('https://dog.ceo/api/breeds/image/random').catch(() => ({ data: {} }));
  const dogUrl = data?.message;

  if (!dogUrl) {
    await ctx.message.reply('No dog found...').catch(() => {});
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('🐶 enjoy dog')
    .setImage(dogUrl)
    .setColor(Colors.Gold)
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
    aliases: ['puppy', 'pup'],
  };
};
