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
  userContext = null,
) {
  let userMessage = prompt;

  // Enhanced context injection
  if (replyContext) {
    userMessage = `[Replying to: "${replyContext}"]\n${prompt}`;
  }

  // Add user history context if available
  if (userContext) {
    userMessage = `${userContext}\n${userMessage}`;
  }

  // Store with full metadata
  addMessage(guildId, channelId, 'user', userMessage, userId, displayName || username);

  const conversationHistory = getConversation(guildId, channelId);
  const messages = [{ role: 'system', content: SYSTEM_PROMPT }, ...conversationHistory];

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

    // Enhanced mention resolution
    const mentionMap = getMentionMap(guildId, channelId);
    const allowedMentions = new Set();

    // More sophisticated name-to-mention replacement
    for (const nameKey of Object.keys(mentionMap)) {
      // Match whole words or names followed by punctuation
      const regex = new RegExp('\\b' + nameKey.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&') + '\\b', 'gi');

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

    // Store bot's own response with metadata
    addMessage(guildId, channelId, 'assistant', reply, null, 'TARS');

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
