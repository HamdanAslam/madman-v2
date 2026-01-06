import { COOLDOWN_MS, COOLDOWN_CLEANUP_INTERVAL } from './constants.js';

const cooldowns = new Map();

export function checkCooldown(userId) {
  const now = Date.now();
  if (cooldowns.has(userId)) {
    const lastUsed = cooldowns.get(userId);
    if (now - lastUsed < COOLDOWN_MS) {
      return true;
    }
  }
  cooldowns.set(userId, now);
  return false;
}

// Cleanup old cooldowns periodically to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [userId, lastUsed] of cooldowns.entries()) {
    if (now - lastUsed > COOLDOWN_MS * 2) {
      cooldowns.delete(userId);
    }
  }
}, COOLDOWN_CLEANUP_INTERVAL);
