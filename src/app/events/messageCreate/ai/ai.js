import { askAI } from '../../../utils/ai/openrouter.js';
import { checkCooldown } from '../../../utils/ai/cooldown.js';
import { safeReply } from '../../../utils/ai/safeReply.js';
import { MAX_PROMPT_LENGTH } from '../../../utils/ai/constants.js';
import { MessageType } from 'discord.js';

/**
 * @type {import('commandkit').EventHandler<'messageCreate'>}
 */
const handler = async (message) => {
  if (!message.inGuild() || message.author.bot) return;

  const botId = message.client.user.id;
  const userId = message.author.id;
  const guildId = message.guildId;
  const channelId = message.channelId;
  const username = message.author.username;
  const displayName = message.member?.displayName || message.author.username;

  const isMentioned = message.mentions.has(botId);
  let isReplyToBot = false;
  let repliedMessage = null;

  if (message.type === MessageType.Reply && message.reference?.messageId) {
    try {
      repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
      isReplyToBot = repliedMessage.author.id === botId;
    } catch (err) {
      console.error('Failed to fetch replied message:', err);
    }
  }

  if (!isMentioned && !isReplyToBot) return;

  if (checkCooldown(userId)) {
    return message.reply('⏳ Slow down, chief. Wait a few seconds before asking again.');
  }

  let prompt = message.content.replace(`<@${botId}>`, '').trim();

  if (!prompt && repliedMessage) {
    prompt = repliedMessage.content;
  }

  if (!prompt) return;

  if (prompt.length > MAX_PROMPT_LENGTH) {
    return message.reply(
      `⚠️ Your prompt is too long (${prompt.length} chars). Keep it under ${MAX_PROMPT_LENGTH} characters.`,
    );
  }

  let replyContext = null;
  if (repliedMessage) {
    const repliedAuthor = repliedMessage.member?.displayName || repliedMessage.author.username;
    const repliedContent = repliedMessage.content || '[Image/Embed]';
    replyContext = `${repliedAuthor}: ${repliedContent}`;
  }

  await message.channel.sendTyping();

  try {
    const result = await askAI(guildId, channelId, username, prompt, replyContext, 0.7, userId, displayName);

    const { reply, allowedMentions = [] } =
      typeof result === 'string' ? { reply: result, allowedMentions: [] } : result || {};

    if (!reply || typeof reply !== 'string' || reply.trim() === '') {
      return message.reply('⚠️ (AI returned an empty message)');
    }

    let isFirstChunk = true;
    await safeReply(
      async (chunk, options = {}) => {
        if (isFirstChunk) {
          await message.reply({ content: chunk, ...options });
          isFirstChunk = false;
        } else {
          await message.channel.send({ content: chunk, ...options });
        }
      },
      reply,
      allowedMentions,
    );
  } catch (err) {
    console.error('AI messageCreate error:', err);
    const errorMsg = err.message || 'Something went wrong while talking to the AI.';
    await message.reply(`⚠️ ${errorMsg}`);
  }
};

export default handler;
