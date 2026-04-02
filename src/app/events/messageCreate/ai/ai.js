import { askAI } from '../../../utils/ai/openrouter.js';
import { checkCooldown } from '../../../utils/ai/cooldown.js';
import { safeReply } from '../../../utils/ai/safeReply.js';
import { MAX_PROMPT_LENGTH } from '../../../utils/ai/constants.js';
import { getUserProfile } from '../../../utils/ai/memory.js';
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
    return message.reply('â³ Slow down there. Give me a few seconds to catch up.');
  }

  let prompt = message.content.replace(`<@${botId}>`, '').trim();

  // Enhanced reply context handling
  let replyContext = null;
  if (repliedMessage) {
    const repliedAuthor = repliedMessage.member?.displayName || repliedMessage.author.username;
    const repliedUserId = repliedMessage.author.id;
    const repliedContent = repliedMessage.content || '[Image/Embed/Attachment]';

    // Include who sent the message being replied to
    replyContext = `${repliedAuthor} (ID: ${repliedUserId}): ${repliedContent}`;

    // If prompt is empty and they're replying to something, assume they want analysis
    if (!prompt) {
      prompt = 'What about this message?';
    }
  }

  if (!prompt) return;

  if (prompt.length > MAX_PROMPT_LENGTH) {
    return message.reply(
      `âš ï¸ That's ${prompt.length} characters. I can handle up to ${MAX_PROMPT_LENGTH}. Try being more concise.`,
    );
  }

  // Get user's history for context
  const userProfile = getUserProfile(userId);
  let userContext = null;
  if (userProfile && userProfile.messages.length > 0) {
    const recentCount = Math.min(3, userProfile.messages.length);
    userContext = `[User history: ${userProfile.displayName} has sent ${userProfile.messages.length} messages. Recent topics: ${userProfile.messages
      .slice(-recentCount)
      .map((m) => m.content.substring(0, 50))
      .join('; ')}]`;
  }

  await message.channel.sendTyping();

  try {
    const result = await askAI(
      guildId,
      channelId,
      username,
      prompt,
      replyContext,
      0.7,
      userId,
      displayName,
      userContext,
    );

    const { reply, allowedMentions = [] } =
      typeof result === 'string' ? { reply: result, allowedMentions: [] } : result || {};

    if (!reply || typeof reply !== 'string' || reply.trim() === '') {
      return message.reply('âš ï¸ Hmm. I got nothing. Try asking differently.');
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
    const errorMsg = err.message || 'Something went sideways with the AI.';
    await message.reply(`âš ï¸ ${errorMsg}`);
  }
};

export default handler;
