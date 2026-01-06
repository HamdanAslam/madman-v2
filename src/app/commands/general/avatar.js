import { commandkit } from 'commandkit';
import { ApplicationCommandOptionType } from 'discord.js';
import { getGuildPrefix } from '../../cache/guildCache.js';

commandkit.setPrefixResolver(async (message) => {
  if (!message.inGuild) return ',';
  return await getGuildPrefix(message.guildId);
});

/**
 * @type {import('commandkit').CommandData}
 */
export const command = {
  name: 'avatar',
  description: "Show a user's avatar",
  options: [
    {
      name: 'user',
      description: "Which user's avatar to show",
      type: ApplicationCommandOptionType.User,
      required: false,
    },
    {
      name: 'type',
      description: 'Type of avatar to show',
      type: ApplicationCommandOptionType.String,
      required: false,
      choices: [
        { name: 'main', value: 'main' },
        { name: 'server', value: 'server' },
      ],
    },
  ],
};

/**
 * @param {import('commandkit').ChatInputCommandContext} ctx
 */
export const chatInput = async (ctx) => {
  await ctx.interaction.deferReply();

  const target = ctx.interaction.options.getUser('user') ?? ctx.interaction.user;
  const type = ctx.interaction.options.getString('type') ?? 'main';
  const guild = ctx.interaction.guild;

  let avatarURL,
    footerNote = '';
  let embedColor = 0x3498db;

  if (type === 'server' && guild) {
    const member = await guild.members.fetch(target.id).catch(() => null);
    if (member?.avatar) avatarURL = member.displayAvatarURL({ size: 1024, dynamic: true });
    else {
      avatarURL = target.displayAvatarURL({ size: 1024, dynamic: true });
      footerNote = 'No server avatar, showing global avatar';
    }
    embedColor = member?.displayColor || embedColor;
  } else {
    avatarURL = target.displayAvatarURL({ size: 1024, dynamic: true });
  }

  const embed = {
    title: target.username,
    image: { url: avatarURL },
    color: embedColor,
  };

  if (footerNote) embed.footer = { text: footerNote };

  await ctx.interaction.editReply({ embeds: [embed] });
};

/**
 * @param {import('commandkit').MessageCommandContext} ctx
 */
export const message = async (ctx) => {
  if (!ctx.message.guild) return ctx.message.reply('This command only works in servers.');

  const args = ctx.args();
  let type = 'main';
  let userArg;

  if (args[0]?.toLowerCase() === 'server' || args[0]?.toLowerCase() === 's') {
    type = 'server';
    userArg = args[1];
  } else {
    userArg = args[0];
  }

  let target;
  if (userArg) {
    // Try mention
    const mention = ctx.message.mentions.users.first();
    if (mention) target = mention;
    else {
      // Try user ID
      target = await ctx.message.guild.members
        .fetch(userArg)
        .then((m) => m.user)
        .catch(() => null);
      if (!target) {
        // Try exact username match
        await ctx.message.guild.members.fetch();
        const byUsername = ctx.message.guild.members.cache.find(
          (m) => m.user.username.toLowerCase() === userArg.toLowerCase(),
        )?.user;
        target = byUsername || ctx.message.author;
      }
    }
  } else {
    target = ctx.message.author;
  }

  let avatarURL,
    footerNote = '';
  let embedColor = 0x3498db;

  if (type === 'server') {
    const member = await ctx.message.guild.members.fetch(target.id).catch(() => null);
    if (member?.avatar) avatarURL = member.displayAvatarURL({ size: 1024, dynamic: true });
    else {
      avatarURL = target.displayAvatarURL({ size: 1024, dynamic: true });
      footerNote = 'No server avatar, showing global avatar';
    }
    embedColor = member?.displayColor || embedColor;
  } else {
    avatarURL = target.displayAvatarURL({ size: 1024, dynamic: true });
  }

  const embed = {
    title: target.username,
    image: { url: avatarURL },
    color: embedColor,
  };

  if (footerNote) embed.footer = { text: footerNote };

  return ctx.message.reply({ embeds: [embed] });
};

/** @type {import('commandkit').CommandMetadataFunction} */
export const generateMetadata = async () => {
  return {
    // guilds: [process.env.DEV_GUILD],
    aliases: ['av'],
  };
};
