import { commandkit } from 'commandkit';
import { ApplicationCommandOptionType } from 'discord.js';
import { getGuildPrefix, getGuildDoc } from '../../cache/guildCache.js';
import { revalidateTag } from '@commandkit/cache';
import Server from '../../models/Server.js';
const cooldown = new Map();

commandkit.setPrefixResolver(async (message) => {
  if (!message.inGuild) {
    return ',';
  }

  return await getGuildPrefix(message.guildId);
});

/**
 * @type {import('commandkit').CommandData}
 */
export const command = {
  name: 'prefix',
  description: 'Manage server prefix',
  options: [
    {
      name: 'set',
      description: 'Set a new prefix for the server',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'value',
          description: 'The new prefix',
          type: ApplicationCommandOptionType.String,
          required: true,
        },
      ],
    },
    {
      name: 'get',
      description: "Get the server's prefix",
      type: ApplicationCommandOptionType.Subcommand,
    },
    {
      name: 'reset',
      description: 'Reset to the default prefix (,)',
      type: ApplicationCommandOptionType.Subcommand,
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

  const lastSet = cooldown.get(ctx.interaction.user.id);
  if (lastSet && Date.now() - lastSet < 20_000) {
    return ctx.interaction.editReply(`${ctx.interaction.user} COOLDOWN!!`);
  }

  const sub = ctx.interaction.options.getSubcommand();
  const guildId = ctx.interaction.guildId;

  if (ctx.interaction.user.id !== process.env.OWNER_ID && !ctx.interaction.member?.permissions?.has('Administrator')) {
    return await ctx.interaction.editReply({ content: 'You cannot use this command.' });
  }

  if (sub === 'set') {
    const value = ctx.interaction.options.getString('value');

    if (value.length < 1 || value.length > 5) {
      return await ctx.interaction.editReply('Prefix must be between **1–5 characters**.');
    }

    const serverDoc = await Server.findOneAndUpdate({ guildId }, { prefix: value }, { upsert: true, new: true });

    revalidateTag(`server:${guildId}`);

    cooldown.set(ctx.interaction.user.id, Date.now());

    return await ctx.interaction.editReply(`Prefix for this server set to \`${serverDoc.prefix}\``);
  }

  if (sub === 'get') {
    const serverDoc = await getGuildDoc(guildId);
    const prefix = serverDoc?.prefix || ',';

    cooldown.set(ctx.interaction.user.id, Date.now());

    await ctx.interaction.editReply(`Prefix for this server is \`${prefix}\``);
  }

  if (sub === 'reset') {
    const serverDoc = await Server.findOneAndUpdate({ guildId }, { prefix: ',' }, { upsert: true, new: true });

    revalidateTag(`server:${guildId}`);

    cooldown.set(ctx.interaction.user.id, Date.now());

    return await ctx.interaction.editReply(`Prefix reset to default: \`${serverDoc.prefix}\``);
  }
};

/**
 * @param {import('commandkit').MessageCommandContext} ctx
 */
export const message = async (ctx) => {
  if (!ctx.message.guild) {
    return ctx.message.reply('This is a server-only command.');
  }

  const lastSet = cooldown.get(ctx.message.author.id);
  if (lastSet && Date.now() - lastSet < 20_000) {
    return ctx.message.reply(`${ctx.message.author} COOLDOWN!!`);
  }
  const guildId = ctx.message.guildId;
  const [sub, ...args] = ctx.args();

  if (ctx.message.author.id !== process.env.OWNER_ID && !ctx.message.member?.permissions?.has('Administrator')) {
    return await ctx.message.reply('You cannot use this command.');
  }

  if (sub === 'set') {
    const value = args[0];
    if (!value) {
      return await ctx.message.reply('Please provide a prefix to set.');
    }

    if (value.length < 1 || value.length > 5) {
      return await ctx.message.reply('Prefix must be between **1–5 characters**.');
    }

    const serverDoc = await Server.findOneAndUpdate({ guildId }, { prefix: value }, { upsert: true, new: true });

    revalidateTag(`server:${guildId}`);

    cooldown.set(ctx.message.author.id, Date.now());

    return await ctx.message.reply(`Prefix set to \`${serverDoc.prefix}\``);
  }

  if (sub === 'get') {
    const serverDoc = await getGuildDoc(guildId);
    const prefix = serverDoc?.prefix || ',';
    cooldown.set(ctx.message.author.id, Date.now());
    return await ctx.message.reply(`Prefix for this server is \`${prefix}\``);
  }

  if (sub === 'reset') {
    const serverDoc = await Server.findOneAndUpdate({ guildId }, { prefix: ',' }, { upsert: true, new: true });

    revalidateTag(`server:${guildId}`);

    cooldown.set(ctx.message.author.id, Date.now());

    return await ctx.message.reply(`Prefix reset to default: \`${serverDoc.prefix}\``);
  }

  // Fallback if no valid subcommand
  return await ctx.message.reply('Usage: `prefix set <value>`, `prefix get` or `prefix reset`');
};

export const generateMetadata = async () => {
  return {};
};
