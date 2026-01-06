import AFK from '../models/AFK.js';
import { Logger } from 'commandkit';

export const afkCache = new Map();

export const loadAFKCache = async () => {
  const afks = await AFK.find({});
  for (const afk of afks) {
    if (!afkCache.has(afk.guildId)) {
      afkCache.set(afk.guildId, new Map());
    }
    afkCache.get(afk.guildId).set(afk.userId, {
      reason: afk.reason,
      since: afk.since,
    });
  }
  Logger.info(`AFKCache loaded ${afkCache.size} guilds with AFK records!`);
};

export const setAFK = (guildId, userId, reason, since = Date.now()) => {
  if (!afkCache.has(guildId)) {
    afkCache.set(guildId, new Map());
  }
  afkCache.get(guildId).set(userId, { reason, since });
};

export const clearAFK = (guildId, userId) => {
  if (afkCache.has(guildId)) {
    afkCache.get(guildId).delete(userId);
    if (afkCache.get(guildId).size === 0) {
      afkCache.delete(guildId);
    }
  }
};
