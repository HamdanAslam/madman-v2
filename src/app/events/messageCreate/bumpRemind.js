import { Logger } from 'commandkit/logger';
import Server from '../../models/Server.js';
import { getGuildDoc } from '../../cache/guildCache.js';

const DISBOARD_ID = '302050872383242240';
const activeTimers = new Map(); // guildId -> timeout

export async function clearPendingReminder(guildId) {
  if (activeTimers.has(guildId)) {
    clearTimeout(activeTimers.get(guildId));
    activeTimers.delete(guildId);
  }

  await Server.findOneAndUpdate(
    { guildId },
    {
      $set: {
        'modules.bumpReminders.nextReminderAt': null,
        'modules.bumpReminders.reminderChannelId': '',
      },
    },
    { upsert: true },
  );
}

async function sendReminder(client, guildId, channelId) {
  try {
    const guild = client.guilds.cache.get(guildId) || (await client.guilds.fetch(guildId).catch(() => null));
    if (!guild) {
      throw new Error('Guild not found');
    }

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased?.()) {
      throw new Error('Reminder channel unavailable');
    }

    const serverDoc = await getGuildDoc(guildId);
    const bumpConfig = serverDoc?.modules?.bumpReminders;
    if (!bumpConfig?.status || !bumpConfig.roleId) {
      throw new Error('Bump reminders disabled or not configured');
    }

    let reminderMsg = bumpConfig.reminderMessage || '<@&{role}>, time to bump the server! Use /bump';
    reminderMsg = reminderMsg.replace(/\{role\}/g, bumpConfig.roleId);
    await channel.send(reminderMsg);
  } catch (e) {
    Logger.error('Failed to send bump reminder', e);
  } finally {
    await clearPendingReminder(guildId);
  }
}

function scheduleReminder(client, guildId, channelId, delayMs) {
  if (activeTimers.has(guildId)) {
    clearTimeout(activeTimers.get(guildId));
  }

  const timeout = setTimeout(async () => {
    activeTimers.delete(guildId);
    await sendReminder(client, guildId, channelId);
  }, delayMs);

  activeTimers.set(guildId, timeout);
}

export async function loadPendingBumpReminders(client) {
  const pending = await Server.find(
    {
      'modules.bumpReminders.nextReminderAt': { $ne: null },
      'modules.bumpReminders.status': true,
      'modules.bumpReminders.roleId': { $ne: '' },
    },
    {
      guildId: 1,
      'modules.bumpReminders.nextReminderAt': 1,
      'modules.bumpReminders.reminderChannelId': 1,
    },
  ).lean();

  for (const doc of pending) {
    const nextReminderAt = doc.modules.bumpReminders.nextReminderAt;
    const channelId = doc.modules.bumpReminders.reminderChannelId;
    if (!nextReminderAt || !channelId) {
      continue;
    }

    const delayMs = Math.max(0, new Date(nextReminderAt).getTime() - Date.now());
    scheduleReminder(client, doc.guildId, channelId, delayMs);
  }
}

/**
 * @type {import('commandkit').EventHandler<'messageCreate'>}
 */
const handler = async (message) => {
  if (!message.inGuild()) return;
  if (message.author.id !== DISBOARD_ID) return;
  if (!message.interaction) return;

  try {
    const embed = message.embeds[0];
    if (!embed?.description?.includes('Bump done!')) return;

    const guildId = message.guildId;
    const serverDoc = await getGuildDoc(guildId);
    const bumpConfig = serverDoc?.modules?.bumpReminders;
    if (!bumpConfig?.status || !bumpConfig.roleId) return;

    const channel = message.channel;
    const confirmationMsg = bumpConfig.confirmationMessage || 'Thanks for bumping! I will remind you in 2 hours.';
    try {
      await channel.send(confirmationMsg);
    } catch (e) {
      Logger.error('Failed to send bump confirmation', e);
    }

    await clearPendingReminder(guildId);

    const nextReminderAt = new Date(Date.now() + 7200000);
    await Server.findOneAndUpdate(
      { guildId },
      {
        $set: {
          'modules.bumpReminders.nextReminderAt': nextReminderAt,
          'modules.bumpReminders.reminderChannelId': channel.id,
        },
      },
      { upsert: true },
    );

    scheduleReminder(message.client, guildId, channel.id, 7200000);
  } catch (err) {
    Logger.error('messageCreate/bump-reminder error', err);
  }
};

export default handler;
