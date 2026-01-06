import { EmbedBuilder, Colors } from 'discord.js';

/**
 * @type {import('commandkit').EventHandler<'messageCreate'>}
 */
const handler = async (message) => {
  // Ignore guild messages or bots
  if (message.inGuild() || message.author.bot) return;

  const client = message.client;

  const guild = client.guilds.cache.get(process.env.DEV_GUILD);
  if (!guild) return;

  const logChannel = guild.channels.cache.get('1426735819783143526');
  if (!logChannel || !logChannel.isTextBased()) return;

  // Build attachments field
  let attachmentsField = 'None';
  if (message.attachments.size > 0) {
    attachmentsField = message.attachments.map((att) => att.url).join('\n');
  }

  const embed = new EmbedBuilder()
    .setTitle('📩 DM Received')
    .setColor(Colors.Blurple)
    .addFields(
      {
        name: 'From',
        value: `${message.author.tag} (<@${message.author.id}>)\n**ID:** \`${message.author.id}\``,
      },
      { name: 'Message ID', value: `\`${message.id}\`` },
      { name: 'Content', value: message.content || '[Empty message]' },
      { name: 'Attachments', value: attachmentsField },
    )
    .setFooter({ text: `Timestamp: ${new Date().toLocaleString()}` })
    .setTimestamp();

  await logChannel.send({ embeds: [embed] });
};

export default handler;
