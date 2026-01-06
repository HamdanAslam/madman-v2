import { Logger } from 'commandkit/logger';
import Server from '../../models/Server.js';
import { revalidateTag } from '@commandkit/cache';
import { getGuildDoc } from '../../cache/guildCache.js';

/**
 * @type {import('commandkit').EventHandler<'messageCreate'>}
 */
const handler = async (message) => {
  if (!message.inGuild() || message.author.bot) return;

  try {
    const guildId = message.guildId;
    const serverDoc = await getGuildDoc(guildId);
    if (!serverDoc) return;

    const counting = serverDoc.modules?.counting || {};
    if (!counting.status) return;
    if (!counting.channel) return;
    if (message.channelId !== counting.channel) return;

    const content = message.content.trim();
    if (!/^\d+$/.test(content)) return;

    const num = Number(content);
    const expected = counting.current ?? 1;
    const lastUser = counting.lastUser ?? '';

    // Same user counting twice - delete and ignore
    if (message.author.id === lastUser) {
      try {
        await message.delete();
      } catch (e) {
        Logger.debug && Logger.debug('Failed to delete same-user message', e);
      }
      return;
    }

    // Wrong number - handle fail
    if (num !== expected) {
      await handleFail(message, serverDoc, expected);
      return;
    }

    // Correct number - atomic update
    const newCurrent = expected + 1;
    const atomicRes = await Server.findOneAndUpdate(
      { guildId, 'modules.counting.current': expected },
      {
        $set: {
          'modules.counting.current': newCurrent,
          'modules.counting.lastUser': message.author.id,
        },
      },
      { new: true },
    );

    if (atomicRes) {
      revalidateTag(`server:${guildId}`);
      try {
        await message.react('✅');
      } catch (e) {
        Logger.debug && Logger.debug('Failed to react', e);
      }
      return;
    }

    // Race condition - someone else won, just delete this message
    try {
      await message.delete();
    } catch (e) {
      Logger.debug && Logger.debug('Failed to delete race message', e);
    }
  } catch (err) {
    Logger.error('messageCreate/counting error', err);
  }
};

async function handleFail(message, serverDoc, expectedNumber) {
  try {
    const guildId = message.guildId;
    const counting = serverDoc.modules?.counting || {};

    const failMessagesEnabled = counting.failMessages ?? true;
    const revive = counting.revive ?? true;

    // Last successful number = expected - 1
    const lastNumber = expectedNumber - 1;
    const currentHigh = counting.highscore ?? 0;
    const newHigh = Math.max(lastNumber, currentHigh);

    // Revive ON: counter continues from where it was (doesn't reset)
    // Revive OFF: counter resets to 1
    const nextNumber = revive ? expectedNumber : 1;

    const update = {
      'modules.counting.current': nextNumber,
      'modules.counting.lastUser': '',
      'modules.counting.highscore': newHigh,
    };

    await Server.findOneAndUpdate({ guildId }, { $set: update });
    revalidateTag(`server:${guildId}`);

    // Revive ON: delete the wrong message (clean it up)
    if (revive) {
      try {
        await message.delete();
      } catch (e) {
        Logger.debug && Logger.debug('Failed to delete fail message', e);
      }
    }

    // Show fail message if:
    // - Revive OFF (always show)
    // - Revive ON + failMessages enabled
    const shouldShowFailMessage = !revive || failMessagesEnabled;

    if (!shouldShowFailMessage) return;

    // Build fail message - {number} is the number they failed at (expected)
    let failText = counting.failMessage || 'Oops! <user> ruined it at **{number}**!';
    failText = failText.replace(/<user>/g, `<@${message.author.id}>`).replace(/\{number\}/g, String(expectedNumber));

    // Add last number, next number, and high score
    if (lastNumber > 0) {
      failText += `\nLast Number: **${lastNumber}**`;
    }

    failText += `\nNext Number: **${nextNumber}**`;

    if (newHigh > 0) {
      failText += `\nHigh Score: **${newHigh}**`;
    }

    // Send the fail message
    try {
      await message.channel.send(failText);
    } catch (e) {
      Logger.error('Failed to send fail message', e);
    }
  } catch (err) {
    Logger.error('handleFail error', err);
  }
}

export default handler;
