import { commandkit } from 'commandkit';
import { getGuildPrefix } from '../../cache/guildCache.js';
import { ApplicationCommandOptionType, PermissionsBitField, EmbedBuilder, Colors } from 'discord.js';

commandkit.setPrefixResolver(async (message) => {
  if (!message.inGuild) return ',';
  return await getGuildPrefix(message.guildId);
});

/** @type {import('commandkit').CommandData} */
export const command = {
  name: 'purge',
  description: 'delete a bunch of messages',
  options: [
    {
      name: 'amount',
      description: 'Number of messages to delete (1-1000)',
      type: ApplicationCommandOptionType.Integer,
      required: true,
      min_value: 1,
      max_value: 1000,
    },
    {
      name: 'target',
      description: 'Only delete messages from this user',
      type: ApplicationCommandOptionType.User,
      required: false,
    },
    {
      name: 'filter',
      description: 'Filter messages by type',
      type: ApplicationCommandOptionType.String,
      required: false,
      choices: [
        { name: 'Bots', value: 'bots' },
        { name: 'Humans', value: 'humans' },
        { name: 'Links', value: 'links' },
        { name: 'Images', value: 'images' },
        { name: 'Embeds', value: 'embeds' },
      ],
    },
  ],
};

/**
 * Apply filters to messages
 * @param {Array|import('discord.js').Collection} messages
 * @param {Object} options
 * @returns {Array}
 */
const filterMessages = (messages, { target, filter }) => {
  // Convert to array if it's a Collection or Map
  let filtered = Array.isArray(messages) ? messages : Array.from(messages.values());

  // Filter by target user
  if (target) {
    filtered = filtered.filter((msg) => msg.author.id === target.id);
  }

  // Filter by type
  if (filter) {
    switch (filter) {
      case 'bots':
        filtered = filtered.filter((msg) => msg.author.bot);
        break;
      case 'humans':
        filtered = filtered.filter((msg) => !msg.author.bot);
        break;
      case 'links':
        filtered = filtered.filter((msg) => /https?:\/\/[^\s]+/.test(msg.content));
        break;
      case 'images':
        filtered = filtered.filter(
          (msg) => msg.attachments.size > 0 || /\.(jpg|jpeg|png|gif|webp)$/i.test(msg.content),
        );
        break;
      case 'embeds':
        filtered = filtered.filter((msg) => msg.embeds.length > 0);
        break;
    }
  }

  return filtered;
};

/**
 * Create success embed
 * @param {number} deletedCount
 * @param {Object} options
 * @returns {EmbedBuilder}
 */
const createSuccessEmbed = (deletedCount, { target, filter, executor }) => {
  let description = `Successfully deleted **${deletedCount}** message${deletedCount !== 1 ? 's' : ''}`;

  const filters = [];
  if (target) filters.push(`from ${target.tag}`);
  if (filter) filters.push(`with filter: ${filter}`);

  if (filters.length > 0) {
    description += ` (${filters.join(', ')})`;
  }

  return new EmbedBuilder()
    .setTitle('Messages Purged')
    .setColor(Colors.Green)
    .setDescription(description)
    .addFields({ name: 'Purged by', value: executor.tag })
    .setTimestamp();
};

/** @param {import('commandkit').ChatInputCommandContext} ctx */
export const chatInput = async (ctx) => {
  await ctx.interaction.deferReply({ ephemeral: true });

  const executor = ctx.interaction.user;
  const amount = ctx.interaction.options.getInteger('amount');
  const targetUser = ctx.interaction.options.getUser('target');
  const filter = ctx.interaction.options.getString('filter');

  const { guild, channel } = ctx.interaction;
  const executorMember = await guild.members.fetch(executor.id);
  const botMember = guild.members.me;

  // Permission checks (owner bypass)
  if (
    executor.id !== process.env.OWNER_ID &&
    !executorMember.permissions.has(PermissionsBitField.Flags.ManageMessages)
  ) {
    return ctx.interaction.editReply('You need the Manage Messages permission to use this command.');
  }
  if (!botMember.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
    return ctx.interaction.editReply('I need the Manage Messages permission to execute this command.');
  }
  if (!channel.permissionsFor(botMember).has(PermissionsBitField.Flags.ManageMessages)) {
    return ctx.interaction.editReply('I need the Manage Messages permission in this channel.');
  }

  try {
    const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    let allMessages = [];
    let lastId;

    // Fetch messages in batches of 100 (Discord API limit)
    while (allMessages.length < amount) {
      const fetchLimit = Math.min(amount - allMessages.length, 100);
      const fetchOptions = { limit: fetchLimit };
      if (lastId) fetchOptions.before = lastId;

      const batch = await channel.messages.fetch(fetchOptions);
      if (batch.size === 0) break;

      lastId = batch.last().id;

      // Filter and collect in one pass
      for (const msg of batch.values()) {
        if (msg.createdTimestamp <= twoWeeksAgo) continue;

        // Apply filters during collection for early filtering
        if (targetUser && msg.author.id !== targetUser.id) continue;
        if (filter) {
          let skipMessage = false;
          switch (filter) {
            case 'bots':
              skipMessage = !msg.author.bot;
              break;
            case 'humans':
              skipMessage = msg.author.bot;
              break;
            case 'links':
              skipMessage = !/https?:\/\/[^\s]+/.test(msg.content);
              break;
            case 'images':
              skipMessage = msg.attachments.size === 0 && !/\.(jpg|jpeg|png|gif|webp)$/i.test(msg.content);
              break;
            case 'embeds':
              skipMessage = msg.embeds.length === 0;
              break;
          }
          if (skipMessage) continue;
        }

        allMessages.push(msg);
        if (allMessages.length >= amount) break;
      }

      // Stop if we have enough or reached channel start
      if (allMessages.length >= amount || batch.size < fetchLimit) break;
    }

    if (allMessages.length === 0) {
      return ctx.interaction.editReply('No messages found to delete (messages must be less than 14 days old).');
    }

    // Bulk delete in batches of 100
    let totalDeleted = 0;
    for (let i = 0; i < allMessages.length; i += 100) {
      const batch = allMessages.slice(i, i + 100);
      const deleted = await channel.bulkDelete(batch, true);
      totalDeleted += deleted.size;
    }

    const deleted = { size: totalDeleted };

    // Send success embed
    const successEmbed = createSuccessEmbed(deleted.size, {
      target: targetUser,
      filter,
      executor,
    });

    await ctx.interaction.editReply({ embeds: [successEmbed] });

    // Auto-delete success message after 5 seconds
    setTimeout(async () => {
      try {
        await ctx.interaction.deleteReply();
      } catch {
        /* ignore if already deleted */
      }
    }, 5000);
  } catch (error) {
    console.error('Purge error:', error);
    return ctx.interaction.editReply('An error occurred while trying to delete messages.');
  }
};

/** @param {import('commandkit').MessageCommandContext} ctx */
export const message = async (ctx) => {
  const args = ctx.args();
  const amount = parseInt(args[0]);

  if (!amount || amount < 1 || amount > 1000) {
    return ctx.message.reply('Please provide a valid number between 1 and 1000.');
  }

  const guild = ctx.message.guild;
  const channel = ctx.message.channel;
  const executorMember = await guild.members.fetch(ctx.message.author.id);
  const botMember = guild.members.me;

  // Permission checks (owner bypass)
  if (
    ctx.message.author.id !== process.env.OWNER_ID &&
    !executorMember.permissions.has(PermissionsBitField.Flags.ManageMessages)
  ) {
    return ctx.message.reply('You need the Manage Messages permission to use this command.');
  }
  if (!botMember.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
    return ctx.message.reply('I need the Manage Messages permission to execute this command.');
  }
  if (!channel.permissionsFor(botMember).has(PermissionsBitField.Flags.ManageMessages)) {
    return ctx.message.reply('I need the Manage Messages permission in this channel.');
  }

  try {
    const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    let allMessages = [];
    let lastId;

    // Fetch messages in batches of 100
    while (allMessages.length < amount + 1) {
      const fetchLimit = Math.min(amount + 1 - allMessages.length, 100);
      const fetchOptions = { limit: fetchLimit };
      if (lastId) fetchOptions.before = lastId;

      const batch = await channel.messages.fetch(fetchOptions);
      if (batch.size === 0) break;

      lastId = batch.last().id;

      // Filter in one pass
      for (const msg of batch.values()) {
        if (msg.createdTimestamp > twoWeeksAgo) {
          allMessages.push(msg);
          if (allMessages.length >= amount + 1) break;
        }
      }

      if (allMessages.length >= amount + 1 || batch.size < fetchLimit) break;
    }

    if (allMessages.length === 0) {
      return ctx.message.reply('No messages found to delete (messages must be less than 14 days old).');
    }

    // Bulk delete in batches of 100
    let totalDeleted = 0;
    for (let i = 0; i < allMessages.length; i += 100) {
      const batch = allMessages.slice(i, i + 100);
      const deleted = await channel.bulkDelete(batch, true);
      totalDeleted += deleted.size;
    }

    const deleted = { size: totalDeleted };

    // Send success embed
    const successEmbed = createSuccessEmbed(deleted.size, {
      target: null,
      filter: null,
      executor: ctx.message.author,
    });

    const reply = await channel.send({ embeds: [successEmbed] });

    // Auto-delete success message after 5 seconds
    setTimeout(async () => {
      try {
        await reply.delete();
      } catch {
        /* ignore if already deleted */
      }
    }, 5000);
  } catch (error) {
    console.error('Purge error:', error);
    return ctx.message.reply('An error occurred while trying to delete messages.');
  }
};

/** @type {import('commandkit').CommandMetadataFunction} */
export const generateMetadata = async () => {
  return {
    // guilds: [process.env.DEV_GUILD],
  };
};
