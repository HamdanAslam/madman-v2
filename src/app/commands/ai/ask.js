import { commandkit } from 'commandkit';
import { getGuildPrefix } from '../../cache/guildCache.js';
import { ApplicationCommandOptionType } from 'discord.js';
import { askAI } from '../../utils/ai/openrouter.js';
import { checkCooldown } from '../../utils/ai/cooldown.js';
import { safeReply } from '../../utils/ai/safeReply.js';
import { MAX_PROMPT_LENGTH } from '../../utils/ai/constants.js';

commandkit.setPrefixResolver(async (message) => {
  if (!message.inGuild) return ',';
  return await getGuildPrefix(message.guildId);
});

export const command = {
  name: 'ask',
  description: 'ask the super smart AI',
  options: [
    {
      name: 'message',
      description: 'the prompt',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
    {
      name: 'creativity',
      description: 'how creative should the response be? (default: balanced)',
      type: ApplicationCommandOptionType.String,
      required: false,
      choices: [
        { name: 'focused', value: '0.3' },
        { name: 'balanced', value: '0.7' },
        { name: 'creative', value: '1.0' },
      ],
    },
  ],
};

export const chatInput = async (ctx) => {
  await ctx.interaction.deferReply();

  const userId = ctx.interaction.user.id;
  const guildId = ctx.interaction.guildId;
  const channelId = ctx.interaction.channelId;
  const username = ctx.interaction.user.username;
  const displayName = ctx.interaction.member?.displayName || ctx.interaction.user.username;
  const prompt = ctx.options.getString('message');
  const temperature = parseFloat(ctx.options.getString('creativity') || '0.7');

  if (checkCooldown(userId)) {
    return ctx.interaction.editReply({
      content: '⏳ Slow down, chief. Wait a few seconds before asking again.',
    });
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    return ctx.interaction.editReply({
      content: `⚠️ Your prompt is too long (${prompt.length} chars). Keep it under ${MAX_PROMPT_LENGTH} characters.`,
    });
  }

  try {
    const result = await askAI(guildId, channelId, username, prompt, null, temperature, userId, displayName);
    const { reply, allowedMentions = [] } =
      typeof result === 'string' ? { reply: result, allowedMentions: [] } : result || {};

    let isFirstChunk = true;

    await safeReply(
      async (chunk, options = {}) => {
        if (isFirstChunk) {
          await ctx.interaction.editReply({ content: chunk, ...options });
          isFirstChunk = false;
        } else {
          await ctx.interaction.followUp({ content: chunk, ...options });
        }
      },
      reply,
      allowedMentions,
    );
  } catch (err) {
    console.error('AI command error:', err);
    const errorMsg = err.message || 'Something went wrong while talking to the AI.';
    try {
      await ctx.interaction.editReply(`⚠️ ${errorMsg}`);
    } catch (editErr) {
      console.error('Failed to edit reply with error:', editErr);
    }
  }
};

export const generateMetadata = async () => {
  return {};
};
