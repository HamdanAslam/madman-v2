import { Logger } from 'commandkit/logger';
import { PermissionFlagsBits } from 'discord.js';
import Server from '../../models/Server.js';
import { revalidateTag } from '@commandkit/cache';

/**
 * @type {import('commandkit').EventHandler<'interactionCreate'>}
 */
const handler = async (interaction) => {
  try {
    if (!interaction.isModalSubmit()) return;
    if (interaction.customId !== 'counting-fail-message') return;

    if (!interaction.guild) {
      return interaction.reply({ content: 'This action must be performed in a server.' });
    }

    const member = interaction.member;
    const isOwner = interaction.user.id === process.env.OWNER_ID;
    const hasAdmin = member?.permissions?.has?.(PermissionFlagsBits.Administrator);

    if (!isOwner && !hasAdmin) {
      return interaction.reply({
        content: 'You need Administrator permissions to change the fail message.',
      });
    }

    const failMessage = interaction.fields.getTextInputValue('fail-message')?.trim();

    if (!failMessage) {
      return interaction.reply({ content: 'Fail message cannot be empty.' });
    }

    await Server.findOneAndUpdate(
      { guildId: interaction.guildId },
      { $set: { 'modules.counting.failMessage': failMessage } },
      { upsert: true },
    );
    revalidateTag(`server:${interaction.guildId}`);

    return interaction.reply({ content: '✅ Counting fail message updated.' });
  } catch (err) {
    Logger.error('interactionCreate/counting error', err);
    try {
      if (interaction?.replied || interaction?.deferred) {
        await interaction.editReply({ content: '❌ An error occurred while processing the modal.' });
      } else {
        await interaction.reply({ content: '❌ An error occurred while processing the modal.' });
      }
    } catch (e) {
      Logger.error('Failed to send error reply for counting modal', e);
    }
  }
};

export default handler;
