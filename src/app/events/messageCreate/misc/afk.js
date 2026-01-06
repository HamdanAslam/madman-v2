import { afkCache, clearAFK } from '../../../cache/afkCache.js';
import AFK from '../../../models/AFK.js';

/**
 * @type {import('commandkit').EventHandler<'messageCreate'>}
 */
const handler = async (message) => {
  if (!message.inGuild() || message.author.bot) return;

  const guildId = message.guild.id;
  const userId = message.author.id;

  // Helper to format AFK duration
  const formatDuration = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const parts = [];
    if (hours) parts.push(`${hours}h`);
    if (minutes) parts.push(`${minutes}m`);
    if (seconds || parts.length === 0) parts.push(`${seconds}s`);
    return parts.join(' ');
  };

  // 1. Remove AFK if the author was AFK
  if (afkCache.has(guildId) && afkCache.get(guildId).has(userId)) {
    const { since } = afkCache.get(guildId).get(userId);
    const duration = formatDuration(Date.now() - new Date(since).getTime());

    clearAFK(guildId, userId);
    await AFK.deleteOne({ guildId, userId });

    message.reply(`Welcome back ${message.author}, you were AFK for ${duration}.`);
  }

  // 2. Notify if any mentioned users are AFK
  if (message.mentions.users.size === 0) return;

  const mentions = Array.from(message.mentions.users.values());
  const afkMentions = mentions
    .map((user) => {
      if (afkCache.has(guildId) && afkCache.get(guildId).has(user.id)) {
        const { reason, since } = afkCache.get(guildId).get(user.id);
        const duration = formatDuration(Date.now() - new Date(since).getTime());
        // show only elapsed time, not the absolute since date/time
        return `${user.username} is currently AFK: ${reason} (AFK for ${duration})`;
      }
      return null;
    })
    .filter(Boolean);

  if (afkMentions.length > 0) {
    message.reply(afkMentions.join('\n'));
  }
};

export default handler;
