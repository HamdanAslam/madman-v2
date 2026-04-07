import { commandkit } from 'commandkit';
import { getGuildPrefix } from '../../cache/guildCache.js';
import { ApplicationCommandOptionType, PermissionsBitField, EmbedBuilder, Colors } from 'discord.js';

commandkit.setPrefixResolver(async (message) => {
  if (!message.inGuild) return ',';
  return await getGuildPrefix(message.guildId);
});

/** @type {import('commandkit').CommandData} */
export const command = {
  name: 'ban',
  description: 'Ban a user from the server with an optional reason',
  options: [
    {
      name: 'target',
      description: 'The user you want to ban',
      type: ApplicationCommandOptionType.User,
      required: true,
    },
    {
      name: 'reason',
      description: 'Reason to ban this user',
      type: ApplicationCommandOptionType.String,
    },
  ],
};

/** @param {import('commandkit').ChatInputCommandContext} ctx */
export const chatInput = async (ctx) => {
  await ctx.interaction.deferReply();

  const executor = ctx.interaction.user;
  const targetUser = ctx.interaction.options.getUser('target');
  const reason = ctx.interaction.options.getString('reason') || 'No reason provided.';

  const guild = ctx.interaction.guild;
  const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
  const executorMember = await guild.members.fetch(executor.id);
  const botMember = guild.members.me;

  // Permission checks (owner bypass)
  if (executor.id !== process.env.OWNER_ID && !executorMember.permissions.has(PermissionsBitField.Flags.BanMembers)) {
    return ctx.interaction.editReply('You need the Ban Members permission to use this command.');
  }
  if (!botMember.permissions.has(PermissionsBitField.Flags.BanMembers)) {
    return ctx.interaction.editReply('I need the Ban Members permission to execute this command.');
  }

  // Self/owner/admin checks
  if (targetUser.id === executor.id) return ctx.interaction.editReply('You cannot ban yourself.');
  if (targetUser.id === guild.ownerId) return ctx.interaction.editReply('You cannot ban the server owner.');
  if (targetMember?.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return ctx.interaction.editReply('Members with Administrator cannot be banned.');
  }
  if (
    executor.id !== process.env.OWNER_ID &&
    executor.id !== guild.ownerId &&
    targetMember &&
    targetMember.roles.highest.position >= executorMember.roles.highest.position
  ) {
    return ctx.interaction.editReply("You can't ban this user because they have the same or higher role than you.");
  }
  if (targetMember && !targetMember.bannable) {
    return ctx.interaction.editReply("I can't ban this user due to role hierarchy or missing permissions.");
  }

  // DM the user
  const dmEmbed = new EmbedBuilder()
    .setTitle(`You have been banned from ${guild.name}`)
    .setColor(Colors.DarkRed)
    .addFields({ name: 'Reason', value: reason }, { name: 'Banned by', value: executor.tag })
    .setTimestamp();

  try {
    if (targetMember) await targetMember.send({ embeds: [dmEmbed] });
  } catch {
    /* ignore if DMs are closed */
  }

  // Ban the user
  await guild.members.ban(targetUser.id, { reason });

  const successEmbed = new EmbedBuilder()
    .setTitle('User Banned')
    .setColor(Colors.DarkRed)
    .setDescription(`${targetUser.tag} has been banned.`)
    .addFields({ name: 'Reason', value: reason }, { name: 'Banned by', value: executor.tag })
    .setTimestamp();

  return ctx.interaction.editReply({ embeds: [successEmbed] });
};

/** @param {import('commandkit').MessageCommandContext} ctx */
export const message = async (ctx) => {
  const args = ctx.args();
  const target = ctx.message.mentions.users.first() || ctx.message.client.users.cache.get(args[0]);
  if (!target) return ctx.message.reply('Invalid user.');

  const reason = args.slice(1).join(' ') || 'No reason provided.';
  const guild = ctx.message.guild;
  const targetMember = await guild.members.fetch(target.id).catch(() => null);
  const executorMember = await guild.members.fetch(ctx.message.author.id);
  const botMember = guild.members.me;

  // Permission checks (owner bypass)
  if (
    ctx.message.author.id !== process.env.OWNER_ID &&
    !executorMember.permissions.has(PermissionsBitField.Flags.BanMembers)
  ) {
    return ctx.message.reply('You need the Ban Members permission to use this command.');
  }
  if (!botMember.permissions.has(PermissionsBitField.Flags.BanMembers)) {
    return ctx.message.reply('I need the Ban Members permission to execute this command.');
  }

  // Self/owner/admin checks
  if (target.id === executorMember.id) return ctx.message.reply('You cannot ban yourself.');
  if (target.id === guild.ownerId) return ctx.message.reply('You cannot ban the server owner.');
  if (targetMember?.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return ctx.message.reply('Members with Administrator cannot be banned.');
  }
  if (
    executorMember.id !== process.env.OWNER_ID &&
    executorMember.id !== guild.ownerId &&
    targetMember &&
    targetMember.roles.highest.position >= executorMember.roles.highest.position
  ) {
    return ctx.message.reply("You can't ban this user because they have the same or higher role than you.");
  }
  if (targetMember && !targetMember.bannable) {
    return ctx.message.reply("I can't ban this user due to role hierarchy or missing permissions.");
  }

  // DM the user
  const dmEmbed = new EmbedBuilder()
    .setTitle(`You have been banned from ${guild.name}`)
    .setColor(Colors.DarkRed)
    .addFields({ name: 'Reason', value: reason }, { name: 'Banned by', value: ctx.message.author.tag })
    .setTimestamp();

  try {
    if (targetMember) await targetMember.send({ embeds: [dmEmbed] });
  } catch {
    /* ignore if DMs are closed */
  }

  // Ban the user
  await guild.members.ban(target.id, { reason });

  // Success embed
  const successEmbed = new EmbedBuilder()
    .setTitle('User Banned')
    .setColor(Colors.DarkRed)
    .setDescription(`${target.tag} has been banned.`)
    .addFields({ name: 'Reason', value: reason }, { name: 'Banned by', value: ctx.message.author.tag })
    .setTimestamp();

  return ctx.message.reply({ embeds: [successEmbed] });
};

/** @type {import('commandkit').CommandMetadataFunction} */
export const generateMetadata = async () => {
  return {
    // guilds: [process.env.DEV_GUILD],
  };
};
