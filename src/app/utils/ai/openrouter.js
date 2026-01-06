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
) {
  let userMessage = prompt;
  if (replyContext) {
    userMessage = `[Replying to: "${replyContext}"]\n${prompt}`;
  }

  // store userId and displayName when available
  addMessage(guildId, channelId, 'user', userMessage, userId, displayName || username);

  const messages = [{ role: 'system', content: SYSTEM_PROMPT }, ...getConversation(guildId, channelId)];

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

    // Try to resolve plain display names in the AI reply into actual mention ids using recent conversation map.
    const mentionMap = getMentionMap(guildId, channelId);
    const allowedMentions = new Set();

    // naive regex to capture tokens like "DisplayName:" or "DisplayName"
    for (const nameKey of Object.keys(mentionMap)) {
      const regex = new RegExp('\\b' + nameKey.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&') + '\\b', 'ig');
      if (regex.test(reply)) {
        // replace occurrences with a mention placeholder for now
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

    addMessage(guildId, channelId, 'assistant', reply, null, 'Assistant');
    return { reply, allowedMentions: Array.from(allowedMentions) };
  } catch (err) {
    console.error('OpenRouter API error:', err.response?.data || err.message);

    if (err.response?.status === 429) {
      throw new Error('Rate limit hit. Try again in a moment.');
    }
    if (err.response?.status === 401) {
      throw new Error('API authentication failed. Check your API key.');
    }
    if (err.response?.status === 400) {
      throw new Error('Invalid request. Your prompt might be too long or contain invalid characters.');
    }
    if (err.response?.status === 503) {
      throw new Error('AI service is temporarily unavailable. Try again in a minute.');
    }
    if (err.code === 'ECONNABORTED') {
      throw new Error('Request timed out. The AI took too long to respond.');
    }
    throw new Error('Failed to fetch AI response. Try again later.');
  }
}
