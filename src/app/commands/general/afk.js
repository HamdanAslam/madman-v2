import { commandkit } from 'commandkit';
import AFK from '../../models/AFK.js';
import { getGuildPrefix } from '../../cache/guildCache.js';
import { ApplicationCommandOptionType } from 'discord.js';
import { afkCache, setAFK as setAFKCache } from '../../cache/afkCache.js';
const cooldown = new Map();

commandkit.setPrefixResolver(async (message) => {
  if (!message.guild) {
    return ',';
  }

  return await getGuildPrefix(message.guildId);
});

/**
 * @type {import('commandkit').CommandData}
 */
export const command = {
  name: 'afk',
  description: 'set an AFK status with an optional reason',
  options: [
    {
      name: 'reason',
      description: 'why are you afk?',
      type: ApplicationCommandOptionType.String,
    },
  ],
};

/**
 * @param {import('commandkit').ChatInputCommandContext} ctx
 */
export const chatInput = async (ctx) => {
  await ctx.interaction.deferReply();
  if (!ctx.interaction.guild) {
    return await ctx.interaction.editReply('This is a server only command');
  }
  const reason = ctx.interaction.options.get('reason')?.value || 'AFK';
  const guildId = ctx.interaction.guildId;
  const userId = ctx.interaction.user.id;

  const lastSet = cooldown.get(userId);
  if (lastSet && Date.now() - lastSet < 20_000) {
    return ctx.interaction.editReply(`${ctx.interaction.user} COOLDOWN!!`);
  }

  await AFK.findOneAndUpdate({ guildId, userId }, { reason, since: new Date() }, { upsert: true, new: true });

  cooldown.set(userId, Date.now());

  setAFKCache(guildId, userId, reason);

  await ctx.interaction.editReply(`${ctx.interaction.user.username} is now AFK: ${reason}`);
};

/**
 * @param {import('commandkit').MessageCommandContext} ctx
 */
export const message = async (ctx) => {
  if (!ctx.message.guild) {
    return ctx.message.reply('This is a server-only command.');
  }

  const args = ctx.args();
  const reason = args.length > 0 ? args.join(' ') : 'AFK';
  const guildId = ctx.message.guildId;
  const userId = ctx.message.author.id;
  const lastSet = cooldown.get(userId);
  if (lastSet && Date.now() - lastSet < 20_000) {
    return ctx.message.reply(`${ctx.message.author} COOLDOWN!!`);
  }

  await AFK.findOneAndUpdate({ guildId, userId }, { reason, since: new Date() }, { upsert: true, new: true });

  cooldown.set(userId, Date.now());

  setAFKCache(guildId, userId, reason);

  await ctx.message.reply(`${ctx.message.author.username} is now AFK: ${reason}`);
};

/**
 * @typedef {import('commandkit').CommandMetadataFunction} CommandMetadataFunction
 */

/** @type {CommandMetadataFunction} */
export const generateMetadata = async () => {
  return {};
};
