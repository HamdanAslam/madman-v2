import { commandkit } from 'commandkit';
import { getGuildPrefix } from '../../cache/guildCache.js';
import { PermissionsBitField, EmbedBuilder, Colors, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

commandkit.setPrefixResolver(async (message) => {
  if (!message.inGuild) return ',';
  return await getGuildPrefix(message.guildId);
});

/** @type {import('commandkit').CommandData} */
export const command = {
  name: 'banish',
  description: 'Mock ban',
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

  // Send confirmation embed
  const confirmEmbed = new EmbedBuilder()
    .setTitle('Confirm Ban')
    .setColor(Colors.Yellow)
    .setDescription(`Are you sure you want to ban **${target.tag}**?`)
    .addFields({ name: 'Reason', value: reason })
    .setTimestamp();

  const yesButton = new ButtonBuilder()
    .setCustomId('confirm_ban_yes')
    .setLabel('Yes')
    .setStyle(ButtonStyle.Danger);

  const noButton = new ButtonBuilder()
    .setCustomId('confirm_ban_no')
    .setLabel('No')
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder().addComponents(yesButton, noButton);

  const replyMessage = await ctx.message.reply({ embeds: [confirmEmbed], components: [row] });

  const filter = (interaction) => interaction.user.id === ctx.message.author.id;

  const collector = replyMessage.createMessageComponentCollector({ filter, time: 10000 });

  collector.on('collect', async (interaction) => {
    if (interaction.customId === 'confirm_ban_yes') {
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

      // Mock ban - just send confirmation
      const successEmbed = new EmbedBuilder()
        .setTitle('User Banned')
        .setColor(Colors.DarkRed)
        .setDescription(`**${target.tag} has been banned.**`)
        .addFields({ name: 'Reason', value: reason }, { name: 'Banned by', value: ctx.message.author.tag })
        .setTimestamp();

      await interaction.update({ embeds: [successEmbed], components: [] });
    } else if (interaction.customId === 'confirm_ban_no') {
      const cancelEmbed = new EmbedBuilder()
        .setTitle('Ban Cancelled')
        .setColor(Colors.Green)
        .setDescription('The ban has been cancelled.');

      await interaction.update({ embeds: [cancelEmbed], components: [] });
    }
  });

  collector.on('end', async (collected, reason) => {
    if (reason === 'time' && collected.size === 0) {
      const timeoutEmbed = new EmbedBuilder()
        .setTitle('Ban Timed Out')
        .setColor(Colors.Red)
        .setDescription('The confirmation timed out.');

      await replyMessage.edit({ embeds: [timeoutEmbed], components: [] });
    }
  });
};