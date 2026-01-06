import { Logger } from 'commandkit/logger';
import Server from '../../models/Server.js';
import { getGuildDoc } from '../../cache/guildCache.js';

const DISBOARD_ID = '302050872383242240';
const activeTimers = new Map(); // guildId -> timeout

/**
 * @type {import('commandkit').EventHandler<'messageCreate'>}
 */
const handler = async (message) => {
  if (!message.inGuild()) return;
  if (message.author.id !== DISBOARD_ID) return;
  if (!message.interaction) return;

  try {
    // Check if it's a bump success message
    const embed = message.embeds[0];
    if (!embed?.description?.includes('Bump done!')) return;

    const guildId = message.guildId;
    const serverDoc = await getGuildDoc(guildId);

    const bumpConfig = serverDoc?.modules?.bumpReminders;
    if (!bumpConfig?.status) return;
    if (!bumpConfig.roleId) return;

    const channel = message.channel;

    // Send confirmation message
    const confirmationMsg = bumpConfig.confirmationMessage || 'Thanks for bumping! I will remind you in 2 hours.';
    try {
      await channel.send(confirmationMsg);
    } catch (e) {
      Logger.error('Failed to send bump confirmation', e);
    }

    // Clear any existing timer for this guild
    if (activeTimers.has(guildId)) {
      clearTimeout(activeTimers.get(guildId));
    }

    // Set 2-hour timer
    const timeout = setTimeout(async () => {
      try {
        // Replace {role} placeholder
        let reminderMsg = bumpConfig.reminderMessage || '<@&{role}>, time to bump the server! Use /bump';
        reminderMsg = reminderMsg.replace(/\{role\}/g, bumpConfig.roleId);

        await channel.send(reminderMsg);
        activeTimers.delete(guildId);
      } catch (e) {
        Logger.error('Failed to send bump reminder', e);
        activeTimers.delete(guildId);
      }
    }, 7200000); // 2 hours in milliseconds

    activeTimers.set(guildId, timeout);
  } catch (err) {
    Logger.error('messageCreate/bump-reminder error', err);
  }
};

export default handler;
