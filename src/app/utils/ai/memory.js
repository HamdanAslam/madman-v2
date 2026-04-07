import {
  MAX_TOKENS,
  MAX_MESSAGES,
  MAX_USER_MEMORIES,
  MAX_TOTAL_USERS,
  CONVERSATION_TIMEOUT,
  CLEANUP_INTERVAL,
  estimateTokens,
} from './constants.js';

import { Logger } from 'commandkit';

const conversations = new Map();
const userProfiles = new Map(); // Per-user memory across channels

function getConvoKey(guildId, channelId) {
  return `${guildId}-${channelId}`;
}

// Track user-specific information across the bot
function updateUserProfile(userId, displayName, message) {
  if (!userProfiles.has(userId)) {
    userProfiles.set(userId, {
      displayName,
      messages: [],
      firstSeen: Date.now(),
      lastSeen: Date.now(),
    });
  }

  const profile = userProfiles.get(userId);
  profile.displayName = displayName; // Update to latest display name
  profile.lastSeen = Date.now();
  profile.messages.push({
    content: message,
    timestamp: Date.now(),
  });

  // Trim user memory if too large
  if (profile.messages.length > MAX_USER_MEMORIES) {
    profile.messages = profile.messages.slice(-MAX_USER_MEMORIES);
  }

  // If we have too many users tracked, remove least recently seen
  if (userProfiles.size > MAX_TOTAL_USERS) {
    const sorted = Array.from(userProfiles.entries()).sort((a, b) => a[1].lastSeen - b[1].lastSeen);
    userProfiles.delete(sorted[0][0]);
    Logger.info(`Removed user profile for ${sorted[0][0]} due to memory limit`);
  }
}

export function addMessage(
  guildId,
  channelId,
  role,
  content,
  userId = null,
  displayName = 'User',
  replyToDisplayName = null,
  replyToUserId = null,
) {
  const key = getConvoKey(guildId, channelId);

  if (!conversations.has(key)) {
    conversations.set(key, {
      messages: [],
      lastActivity: Date.now(),
    });
  }

  const convo = conversations.get(key);

  // Store the message with enhanced metadata
  convo.messages.push({
    role,
    content,
    userId,
    displayName,
    replyToDisplayName,
    replyToUserId,
    timestamp: Date.now(),
  });

  convo.lastActivity = Date.now();

  // Update user profile for cross-channel memory
  if (userId && role === 'user') {
    updateUserProfile(userId, displayName, content);
  }

  // Trim by message count first
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

  // Format messages for the API with clear user identification
  return convo.messages.map((msg) => {
    if (msg.role === 'user') {
      const speaker = msg.displayName || (msg.userId ? `user:${msg.userId}` : 'User');
      const replyNote = msg.replyToDisplayName ? ` (replying to ${msg.replyToDisplayName})` : '';
      return {
        role: 'user',
        content: `${speaker}${replyNote}: ${msg.content}`,
      };
    }

    const assistantName = msg.displayName || 'madman';
    return {
      role: 'assistant',
      content: `${assistantName}: ${msg.content}`,
    };
  });
}

// Get user profile for enhanced context
export function getUserProfile(userId) {
  return userProfiles.get(userId) || null;
}

// Build a mention map from stored conversation messages for name -> id resolution
export function getMentionMap(guildId, channelId) {
  const key = getConvoKey(guildId, channelId);
  const convo = conversations.get(key);
  const map = {};

  if (!convo) return map;

  for (const msg of convo.messages) {
    if (!msg.userId) continue;

    const names = new Set();
    if (msg.displayName) names.add(msg.displayName);

    // Handle display names with spaces
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

export function getMemoryStats() {
  return {
    activeConversations: conversations.size,
    trackedUsers: userProfiles.size,
    totalMessages: Array.from(conversations.values()).reduce((sum, convo) => sum + convo.messages.length, 0),
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
    Logger.info(`ðŸ§¹ Cleaned up ${cleaned} stale conversation(s)`);
  }
}

setInterval(cleanupStaleConversations, CLEANUP_INTERVAL);
