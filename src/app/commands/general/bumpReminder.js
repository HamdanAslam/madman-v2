import { commandkit } from 'commandkit';
import { ApplicationCommandOptionType, PermissionFlagsBits, EmbedBuilder, Colors } from 'discord.js';
import Server from '../../models/Server.js';
import { getGuildPrefix, getGuildDoc } from '../../cache/guildCache.js';
import { clearPendingReminder } from '../../events/messageCreate/bumpRemind.js';
import { revalidateTag } from '@commandkit/cache';

commandkit.setPrefixResolver(async (message) => {
  if (!message.inGuild) return ',';
  return await getGuildPrefix(message.guildId);
});

/** @type {import('commandkit').CommandData} */
export const command = {
  name: 'bump-reminder',
  description: 'Manage Disboard bump reminders',
  options: [
    {
      name: 'toggle',
      description: 'Enable or disable bump reminders',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'enabled',
          description: 'Enable or disable',
          type: ApplicationCommandOptionType.Boolean,
          required: true,
        },
      ],
    },
    {
      name: 'set-role',
      description: 'Set the role to ping for bump reminders',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'role',
          description: 'The role to ping',
          type: ApplicationCommandOptionType.Role,
          required: true,
        },
      ],
    },
    {
      name: 'set-messages',
      description: 'Set confirmation and/or reminder messages',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'confirmation',
          description: 'Message sent after someone bumps',
          type: ApplicationCommandOptionType.String,
          required: false,
        },
        {
          name: 'reminder',
          description: 'Message sent after 2 hours (use {role} for role mention)',
          type: ApplicationCommandOptionType.String,
          required: false,
        },
      ],
    },
    {
      name: 'view',
      description: 'View current bump reminder settings',
      type: ApplicationCommandOptionType.Subcommand,
    },
  ],
};

/** @param {import('commandkit').ChatInputCommandContext} ctx */
export const chatInput = async (ctx) => {
  const { interaction } = ctx;
  await interaction.deferReply({ ephemeral: true });

  if (!interaction.guild) {
    return interaction.editReply('This is a server-only command.');
  }

  if (
    interaction.user.id !== process.env.OWNER_ID &&
    !interaction.member?.permissions.has(PermissionFlagsBits.Administrator)
  ) {
    return interaction.editReply('You cannot use this command.');
  }

  const sub = interaction.options.getSubcommand();
  const guildId = interaction.guildId;

  if (sub === 'toggle') {
    const enabled = interaction.options.getBoolean('enabled');

    const serverDoc = await getGuildDoc(guildId);
    const roleId = serverDoc?.modules?.bumpReminders?.roleId;

    if (enabled && !roleId) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(Colors.Yellow)
            .setTitle('⚠️ Warning')
            .setDescription(
              "Bump reminders are now **enabled**, but you haven't set a role yet.\nUse `/bump-reminder set-role` to set one.",
            )
            .setTimestamp(),
        ],
      });
    }

    await Server.findOneAndUpdate({ guildId }, { $set: { 'modules.bumpReminders.status': enabled } }, { upsert: true });
    revalidateTag(`server:${guildId}`);

    if (!enabled) {
      await clearPendingReminder(guildId);
    }

    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(enabled ? Colors.Green : Colors.Red)
          .setTitle(enabled ? '✅ Bump Reminders Enabled' : '❌ Bump Reminders Disabled')
          .setDescription(`Bump reminders are now **${enabled ? 'enabled' : 'disabled'}**.`)
          .setTimestamp(),
      ],
    });
  }

  if (sub === 'set-role') {
    const role = interaction.options.getRole('role');

    await Server.findOneAndUpdate({ guildId }, { $set: { 'modules.bumpReminders.roleId': role.id } }, { upsert: true });
    revalidateTag(`server:${guildId}`);

    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.Green)
          .setTitle('✅ Role Set')
          .setDescription(`Bump reminders will now ping ${role}`)
          .setTimestamp(),
      ],
    });
  }

  if (sub === 'set-messages') {
    const confirmation = interaction.options.getString('confirmation');
    const reminder = interaction.options.getString('reminder');

    if (!confirmation && !reminder) {
      return interaction.editReply('You need to provide at least one message to update.');
    }

    const updateObj = {};
    if (confirmation) updateObj['modules.bumpReminders.confirmationMessage'] = confirmation;
    if (reminder) updateObj['modules.bumpReminders.reminderMessage'] = reminder;

    await Server.findOneAndUpdate({ guildId }, { $set: updateObj }, { upsert: true });
    revalidateTag(`server:${guildId}`);

    const updated = [];
    if (confirmation) updated.push('Confirmation message');
    if (reminder) updated.push('Reminder message');

    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.Green)
          .setTitle('✅ Messages Updated')
          .setDescription(`${updated.join(' and ')} updated successfully.`)
          .setTimestamp(),
      ],
    });
  }

  if (sub === 'view') {
    const serverDoc = await getGuildDoc(guildId);
    const config = serverDoc?.modules?.bumpReminders;

    const status = config?.status ? '✅ Enabled' : '❌ Disabled';
    const roleId = config?.roleId;
    const role = roleId ? `<@&${roleId}>` : 'Not set';
    const confirmation = config?.confirmationMessage || 'Thanks for bumping! I will remind you in 2 hours.';
    const reminder = config?.reminderMessage || '<@&{role}>, time to bump the server! Use /bump';
    const nextReminderAt = config?.nextReminderAt ? new Date(config.nextReminderAt).toLocaleString() : 'Not scheduled';

    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(Colors.Blue)
          .setTitle('⚙️ Bump Reminder Settings')
          .addFields(
            { name: 'Status', value: status, inline: true },
            { name: 'Role', value: role, inline: true },
            { name: 'Next Reminder', value: nextReminderAt, inline: false },
            { name: 'Confirmation Message', value: `\`\`\`${confirmation}\`\`\``, inline: false },
            { name: 'Reminder Message', value: `\`\`\`${reminder}\`\`\``, inline: false },
          )
          .setTimestamp(),
      ],
    });
  }
};

/** @type {import('commandkit').CommandMetadataFunction} */
export const generateMetadata = async () => ({
  // guilds: [process.env.DEV_GUILD],
});
