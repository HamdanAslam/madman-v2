import axios from 'axios';
import { MODEL, SYSTEM_PROMPT, MAX_TOKENS, API_TIMEOUT, calculateCost } from './constants.js';
import { addMessage, getConversation, getMentionMap } from './memory.js';
import { Logger } from 'commandkit';

export async function askAI(
  guildId,
  channelId,
  username,
  prompt,
  replyContext = null,
  temperature = 0.7,
  userId = null,
  displayName = null,
  replyToDisplayName = null,
  replyToUserId = null,
  userContext = null,
) {
  const author = displayName || username || 'User';
  const baseUserMessage = `${author}${replyToDisplayName ? ` (replying to ${replyToDisplayName})` : ''}: ${prompt}`;
  const requestMessage = replyContext
    ? `[Replying to: ${replyContext}]\n${baseUserMessage}`
    : baseUserMessage;

  const conversationHistory = getConversation(guildId, channelId);
  const messages = [{ role: 'system', content: SYSTEM_PROMPT }];

  if (userContext) {
    messages.push({
      role: 'system',
      content: `Conversation memory note: ${userContext}`,
    });
  }

  messages.push(...conversationHistory, { role: 'user', content: requestMessage });

  try {
    const { data } = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: MODEL,
        messages,
        max_tokens: MAX_TOKENS,
        temperature,
        frequency_penalty: 0.5,
        presence_penalty: 0.3,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: API_TIMEOUT,
      },
    );

    let reply = data.choices?.[0]?.message?.content || 'No response.';
    const mentionMap = getMentionMap(guildId, channelId);
    const allowedMentions = new Set();

    for (const nameKey of Object.keys(mentionMap)) {
      const regex = new RegExp('\\b' + nameKey.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&') + '\\b', 'gi');

      if (regex.test(reply)) {
        reply = reply.replace(regex, (match) => {
          const ids = mentionMap[match.toLowerCase()] || mentionMap[nameKey];
          if (ids && ids.length > 0) {
            allowedMentions.add(ids[0]);
            return `<@${ids[0]}>`;
          }
          return match;
        });
      }
    }

    if (data.usage) {
      const cost = calculateCost(data.usage.prompt_tokens, data.usage.completion_tokens);
      Logger.info(
        `AI Request - Tokens: ${data.usage.total_tokens} (prompt: ${data.usage.prompt_tokens}, completion: ${data.usage.completion_tokens}) | Cost: $${cost.totalCost.toFixed(6)}`,
      );
    }

    addMessage(guildId, channelId, 'user', prompt, userId, author, replyToDisplayName, replyToUserId);
    addMessage(guildId, channelId, 'assistant', reply, null, 'madman');

    return { reply, allowedMentions: Array.from(allowedMentions) };
  } catch (err) {
    console.error('OpenRouter API error:', err.response?.data || err.message);

    if (err.response?.status === 429) {
      throw new Error('Rate limit exceeded. Give it a moment.');
    }

    if (err.response?.status === 401) {
      throw new Error('API authentication failed. Check your API key configuration.');
    }

    if (err.response?.status === 400) {
      throw new Error('Invalid request. Your prompt might contain problematic content.');
    }

    if (err.response?.status === 503) {
      throw new Error('AI service unavailable. Try again in a minute.');
    }

    if (err.code === 'ECONNABORTED') {
      throw new Error('Request timed out. The AI is taking too long to respond.');
    }

    throw new Error('Failed to get AI response. Try again later.');
  }
}
