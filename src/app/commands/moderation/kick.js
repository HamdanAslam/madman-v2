import { commandkit } from 'commandkit';
import { getGuildPrefix } from '../../cache/guildCache.js';
import { ApplicationCommandOptionType, PermissionsBitField, EmbedBuilder, Colors } from 'discord.js';

commandkit.setPrefixResolver(async (message) => {
  if (!message.inGuild) return ',';
  return await getGuildPrefix(message.guildId);
});

/** @type {import('commandkit').CommandData} */
export const command = {
  name: 'kick',
  description: 'Kick a user from the server with an optional reason',
  options: [
    {
      name: 'target',
      description: 'The user you want to kick',
      type: ApplicationCommandOptionType.User,
      required: true,
    },
    {
      name: 'reason',
      description: 'Reason to kick this user',
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

  // Permission checks (owner bypass)
  if (executor.id !== process.env.OWNER_ID && !executorMember.permissions.has(PermissionsBitField.Flags.KickMembers)) {
    return ctx.interaction.editReply('You need the Kick Members permission to use this command.');
  }
  if (!botMember.permissions.has(PermissionsBitField.Flags.KickMembers)) {
    return ctx.interaction.editReply('I need the Kick Members permission to execute this command.');
  }

  // Self/owner/admin checks
  if (targetUser.id === executor.id) return ctx.interaction.editReply('You cannot kick yourself.');
  if (targetUser.id === guild.ownerId) return ctx.interaction.editReply('You cannot kick the server owner.');
  if (targetMember.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return ctx.interaction.editReply('Members with Administrator cannot be kicked.');
  }
  if (executor.id !== guild.ownerId && targetMember.roles.highest.position >= executorMember.roles.highest.position) {
    return ctx.interaction.editReply("You can't kick this user because they have the same or higher role than you.");
  }
  if (!targetMember.kickable) {
    return ctx.interaction.editReply("I can't kick this user due to role hierarchy or missing permissions.");
  }

  // DM the user
  const dmEmbed = new EmbedBuilder()
    .setTitle(`You have been kicked from ${guild.name}`)
    .setColor(Colors.Orange)
    .addFields({ name: 'Reason', value: reason }, { name: 'Kicked by', value: executor.tag })
    .setTimestamp();

  try {
    await targetMember.send({ embeds: [dmEmbed] });
  } catch {
    /* ignore if DMs are closed */
  }

  // Kick the user
  await targetMember.kick(reason);

  const successEmbed = new EmbedBuilder()
    .setTitle('User Kicked')
    .setColor(Colors.Orange)
    .setDescription(`${targetMember.user.tag} has been kicked.`)
    .addFields({ name: 'Reason', value: reason }, { name: 'Kicked by', value: executor.tag })
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

  // Permission checks (owner bypass)
  if (
    ctx.message.author.id !== process.env.OWNER_ID &&
    !executorMember.permissions.has(PermissionsBitField.Flags.KickMembers)
  ) {
    return ctx.message.reply('You need the Kick Members permission to use this command.');
  }
  if (!botMember.permissions.has(PermissionsBitField.Flags.KickMembers)) {
    return ctx.message.reply('I need the Kick Members permission to execute this command.');
  }

  // Self/owner/admin checks
  if (targetMember.id === executorMember.id) return ctx.message.reply('You cannot kick yourself.');
  if (targetMember.id === guild.ownerId) return ctx.message.reply('You cannot kick the server owner.');
  if (targetMember.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return ctx.message.reply('Members with Administrator cannot be kicked.');
  }
  if (
    executorMember.id !== guild.ownerId &&
    targetMember.roles.highest.position >= executorMember.roles.highest.position
  ) {
    return ctx.message.reply("You can't kick this user because they have the same or higher role than you.");
  }
  if (!targetMember.kickable) {
    return ctx.message.reply("I can't kick this user due to role hierarchy or missing permissions.");
  }

  // DM the user
  const dmEmbed = new EmbedBuilder()
    .setTitle(`You have been kicked from ${guild.name}`)
    .setColor(Colors.Orange)
    .addFields({ name: 'Reason', value: reason }, { name: 'Kicked by', value: ctx.message.author.tag })
    .setTimestamp();

  try {
    await targetMember.send({ embeds: [dmEmbed] });
  } catch {
    /* ignore if DMs are closed */
  }

  // Kick the user
  await targetMember.kick(reason);

  // Success embed (same as slash command)
  const successEmbed = new EmbedBuilder()
    .setTitle('User Kicked')
    .setColor(Colors.Orange)
    .setDescription(`${targetMember.user.tag} has been kicked.`)
    .addFields({ name: 'Reason', value: reason }, { name: 'Kicked by', value: ctx.message.author.tag })
    .setTimestamp();

  return ctx.message.reply({ embeds: [successEmbed] });
};

/** @type {import('commandkit').CommandMetadataFunction} */
export const generateMetadata = async () => {
  return {
    // guilds: [process.env.DEV_GUILD],
  };
};
