import { commandkit } from 'commandkit';
import { getGuildPrefix } from '../../cache/guildCache.js';
import { ApplicationCommandOptionType, PermissionsBitField, EmbedBuilder, Colors } from 'discord.js';

commandkit.setPrefixResolver(async (message) => {
  if (!message.inGuild) return ',';
  return await getGuildPrefix(message.guildId);
});

/** @type {import('commandkit').CommandData} */
export const command = {
  name: 'unmute',
  description: 'Unmute a previously muted user',
  options: [
    {
      name: 'target',
      description: 'The user you want to unmute',
      type: ApplicationCommandOptionType.User,
      required: true,
    },
    {
      name: 'reason',
      description: 'Reason for unmuting',
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
  const targetMember = await guild.members.fetch(targetUser.id);
  const executorMember = await guild.members.fetch(executor.id);
  const botMember = guild.members.me;

  if (executor.id !== process.env.OWNER_ID && !executorMember.permissions.has(PermissionsBitField.Flags.MuteMembers)) {
    return ctx.interaction.editReply('You need the Mute Members permission to use this command.');
  }
  if (!botMember.permissions.has(PermissionsBitField.Flags.MuteMembers)) {
    return ctx.interaction.editReply('I need the Mute Members permission to execute this command.');
  }

  if (targetUser.id === executor.id) return ctx.interaction.editReply('You cannot unmute yourself.');
  if (targetUser.id === guild.ownerId) return ctx.interaction.editReply('You cannot unmute the server owner.');
  if (targetMember.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return ctx.interaction.editReply('Members with Administrator cannot be unmuted.');
  }
  if (executor.id !== process.env.OWNER_ID && executor.id !== guild.ownerId && targetMember.roles.highest.position >= executorMember.roles.highest.position) {
    return ctx.interaction.editReply("You can't unmute this user because they have the same or higher role than you.");
  }
  if (!targetMember.moderatable) {
    return ctx.interaction.editReply("I can't unmute this user due to role hierarchy or missing permissions.");
  }

  const isMuted = targetMember.communicationDisabledUntil && targetMember.communicationDisabledUntil > new Date();

  if (!isMuted) {
    return ctx.interaction.editReply(`${targetMember.user.tag} is not currently muted.`);
  }

  // Remove timeout
  await targetMember.timeout(null, reason);

  // DM the user
  const dmEmbed = new EmbedBuilder()
    .setTitle(`You have been unmuted in ${guild.name}`)
    .setColor(Colors.Green)
    .addFields({ name: 'Reason', value: reason }, { name: 'Unmuted by', value: executor.tag })
    .setTimestamp();

  try {
    await targetMember.send({ embeds: [dmEmbed] });
  } catch {}

  const successEmbed = new EmbedBuilder()
    .setTitle('User Unmuted')
    .setColor(Colors.Green)
    .setDescription(`${targetMember.user.tag} has been unmuted.`)
    .addFields({ name: 'Reason', value: reason }, { name: 'Unmuted by', value: executor.tag })
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
  const targetMember = await guild.members.fetch(target.id);
  const executorMember = await guild.members.fetch(ctx.message.author.id);
  const botMember = guild.members.me;

  if (
    ctx.message.author.id !== process.env.OWNER_ID &&
    !executorMember.permissions.has(PermissionsBitField.Flags.MuteMembers)
  ) {
    return ctx.message.reply('You need the Mute Members permission to use this command.');
  }
  if (!botMember.permissions.has(PermissionsBitField.Flags.MuteMembers)) {
    return ctx.message.reply('I need the Mute Members permission to execute this command.');
  }

  if (targetMember.id === executorMember.id) return ctx.message.reply('You cannot unmute yourself.');
  if (targetMember.id === guild.ownerId) return ctx.message.reply('You cannot unmute the server owner.');
  if (targetMember.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return ctx.message.reply('Members with Administrator cannot be unmuted.');
  }
  if (
    executorMember.id !== process.env.OWNER_ID &&
    executorMember.id !== guild.ownerId &&
    targetMember.roles.highest.position >= executorMember.roles.highest.position
  ) {
    return ctx.message.reply("You can't unmute this user because they have the same or higher role than you.");
  }
  if (!targetMember.moderatable) {
    return ctx.message.reply("I can't unmute this user due to role hierarchy or missing permissions.");
  }

  const isMuted = targetMember.communicationDisabledUntil && targetMember.communicationDisabledUntil > new Date();

  if (!isMuted) {
    return ctx.message.reply(`${targetMember.user.tag} is not currently muted.`);
  }

  await targetMember.timeout(null, reason);

  const dmEmbed = new EmbedBuilder()
    .setTitle(`You have been unmuted in ${guild.name}`)
    .setColor(Colors.Green)
    .addFields({ name: 'Reason', value: reason }, { name: 'Unmuted by', value: ctx.message.author.tag })
    .setTimestamp();

  try {
    await targetMember.send({ embeds: [dmEmbed] });
  } catch {}

  const successEmbed = new EmbedBuilder()
    .setTitle('User Unmuted')
    .setColor(Colors.Green)
    .setDescription(`${targetMember.user.tag} has been unmuted.`)
    .addFields({ name: 'Reason', value: reason }, { name: 'Unmuted by', value: ctx.message.author.tag })
    .setTimestamp();

  return ctx.message.reply({ embeds: [successEmbed] });
};

/** @type {import('commandkit').CommandMetadataFunction} */
export const generateMetadata = async () => ({});
