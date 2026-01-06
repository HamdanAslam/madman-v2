import { MAX_TOKENS, MAX_MESSAGES, CONVERSATION_TIMEOUT, CLEANUP_INTERVAL, estimateTokens } from './constants.js';
import { Logger } from 'commandkit';

const conversations = new Map();

function getConvoKey(guildId, channelId) {
  return `${guildId}-${channelId}`;
}

export function addMessage(guildId, channelId, role, content, userId = null, displayName = 'User') {
  const key = getConvoKey(guildId, channelId);

  if (!conversations.has(key)) {
    conversations.set(key, {
      messages: [],
      lastActivity: Date.now(),
    });
  }

  const convo = conversations.get(key);

  // Store the message with its metadata
  convo.messages.push({
    role,
    content,
    userId,
    displayName,
    timestamp: Date.now(),
  });

  convo.lastActivity = Date.now();

  if (convo.messages.length > MAX_MESSAGES) {
    convo.messages.splice(0, convo.messages.length - MAX_MESSAGES);
  }

  smartTrim(convo);
}

function smartTrim(convo) {
  if (convo.messages.length <= 2) return;

  let totalTokens = 0;
  const messages = convo.messages;

  for (let i = messages.length - 1; i >= 0; i--) {
    const msgTokens = estimateTokens(messages[i].content);
    totalTokens += msgTokens;

    if (totalTokens > MAX_TOKENS) {
      const minKeep = Math.max(3, messages.length - i);
      const keepFrom = messages.length - minKeep;
      convo.messages = convo.messages.slice(keepFrom);
      Logger.info(`Trimmed conversation to ${convo.messages.length} messages (~${totalTokens} tokens)`);
      break;
    }
  }
}

export function getConversation(guildId, channelId) {
  const key = getConvoKey(guildId, channelId);
  const convo = conversations.get(key);

  if (!convo) return [];

  convo.lastActivity = Date.now();

  // Format messages properly for the API. Use displayName when available so AI learns nicknames.
  return convo.messages.map((msg) => {
    if (msg.role === 'user') {
      const name = msg.displayName || (msg.userId ? `user:${msg.userId}` : 'User');
      return {
        role: 'user',
        content: `${name}: ${msg.content}`,
      };
    } else {
      // Assistant messages stay as-is - these are the bot's own previous responses
      return {
        role: 'assistant',
        content: msg.content,
      };
    }
  });
}

// Build a mention map from stored conversation messages for simple name -> id resolution.
// Returns an object where keys are lowercased displayName/username and values are arrays of userIds.
export function getMentionMap(guildId, channelId) {
  const key = getConvoKey(guildId, channelId);
  const convo = conversations.get(key);
  const map = {};
  if (!convo) return map;

  for (const msg of convo.messages) {
    if (!msg.userId) continue;
    const names = new Set();
    if (msg.displayName) names.add(msg.displayName);
    // Also include a fallback username-like token if displayName contains spaces
    if (msg.displayName && msg.displayName.includes(' ')) {
      names.add(msg.displayName.replace(/\s+/g, ''));
    }

    for (const n of names) {
      const keyName = n.toLowerCase();
      if (!map[keyName]) map[keyName] = [];
      if (!map[keyName].includes(msg.userId)) map[keyName].push(msg.userId);
    }
  }

  return map;
}

export function resetConversation(guildId, channelId) {
  const key = getConvoKey(guildId, channelId);
  conversations.delete(key);
}

export function getConversationStats(guildId, channelId) {
  const key = getConvoKey(guildId, channelId);
  const convo = conversations.get(key);

  if (!convo) {
    return { messageCount: 0, estimatedTokens: 0 };
  }

  const totalTokens = convo.messages.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);

  return {
    messageCount: convo.messages.length,
    estimatedTokens: totalTokens,
  };
}

export function cleanupStaleConversations() {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, convo] of conversations.entries()) {
    if (now - convo.lastActivity > CONVERSATION_TIMEOUT) {
      conversations.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    Logger.info(`🧹 Cleaned up ${cleaned} stale conversation(s)`);
  }
}

setInterval(cleanupStaleConversations, CLEANUP_INTERVAL);
