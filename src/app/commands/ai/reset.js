import { commandkit } from 'commandkit';
import { getGuildPrefix } from '../../cache/guildCache.js';
import { resetConversation, getConversationStats } from '../../utils/ai/memory.js';
import { PermissionFlagsBits } from 'discord.js';

const OWNER_ID = process.env.OWNER_ID;

commandkit.setPrefixResolver(async (message) => {
  if (!message.guild) {
    return ',';
  }
  return await getGuildPrefix(message.guildId);
});

/**
 * @type {import('commandkit').CommandData}
 */
export const command = {
  name: 'reset',
  description: 'reset the AI conversation history for this channel',
};

/**
 * @param {import('commandkit').ChatInputCommandContext} ctx
 */
export const chatInput = async (ctx) => {
  const guildId = ctx.interaction.guildId;
  const channelId = ctx.interaction.channelId;
  const userId = ctx.interaction.user.id;

  // permission check
  if (userId !== OWNER_ID && !ctx.interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
    return ctx.interaction.reply({
      content: '❌ You need the `Manage Messages` permission to use this command.',
      ephemeral: true,
    });
  }

  const stats = getConversationStats(guildId, channelId);
  if (stats.messageCount === 0) {
    return ctx.interaction.reply({
      content: "🤷 There's no conversation history in this channel.",
      ephemeral: true,
    });
  }

  resetConversation(guildId, channelId);
  return ctx.interaction.reply({
    content: `✅ Conversation history cleared! (${stats.messageCount} messages, ~${stats.estimatedTokens} tokens)`,
    ephemeral: true,
  });
};

/**
 * @param {import('commandkit').MessageCommandContext} ctx
 */
export const message = async (ctx) => {
  if (!ctx.message.guild) {
    return ctx.message.reply('This is a server-only command.');
  }

  const guildId = ctx.message.guildId;
  const channelId = ctx.message.channelId;
  const userId = ctx.message.author.id;

  // permission check
  const member = ctx.message.member;
  if (userId !== OWNER_ID && !member.permissions.has(PermissionFlagsBits.ManageMessages)) {
    return ctx.message.reply('❌ You need the `Manage Messages` permission to use this command.');
  }

  const stats = getConversationStats(guildId, channelId);
  if (stats.messageCount === 0) {
    return ctx.message.reply("🤷 There's no conversation history in this channel.");
  }

  resetConversation(guildId, channelId);
  return ctx.message.reply(
    `✅ Conversation history cleared! (${stats.messageCount} messages, ~${stats.estimatedTokens} tokens)`,
  );
};

/**
 * @typedef {import('commandkit').CommandMetadataFunction} CommandMetadataFunction
 */

/** @type {CommandMetadataFunction} */
export const generateMetadata = async () => {
  return {};
};
