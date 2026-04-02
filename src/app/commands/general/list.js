import { EmbedBuilder, PermissionsBitField } from 'discord.js';

/**
 * @type {import('commandkit').CommandData}
 */
export const command = {
  name: 'servers',
  description: 'List all servers the bot is in',
  options: [
    {
      name: 'invites',
      description: 'Generate invite links (best effort)',
      type: 5, // BOOLEAN
      required: false,
    },
  ],
};

/**
 * @param {import('commandkit').ChatInputCommandContext} ctx
 */
export const chatInput = async (ctx) => {
  await ctx.interaction.deferReply({ ephemeral: true });

  const includeInvites = ctx.interaction.options.getBoolean('invites') ?? false;

  const guilds = ctx.client.guilds.cache;

  if (!guilds.size) {
    return ctx.interaction.editReply('No servers found.');
  }

  const lines = [];

  for (const guild of guilds.values()) {
    let inviteLine = '';

    if (includeInvites) {
      try {
        const me = guild.members.me;
        if (!me) throw new Error('Member not cached');

        const channel = guild.channels.cache.find(
          (c) => c.isTextBased() && c.permissionsFor(me)?.has(PermissionsBitField.Flags.CreateInstantInvite),
        );

        if (!channel) throw new Error('No invite perms');

        const invite = await channel.createInvite({
          maxAge: 0,
          maxUses: 0,
          unique: true,
          reason: 'Server list invite generation',
        });

        inviteLine = `\nInvite: ${invite.url}`;
      } catch {
        inviteLine = `\nInvite: ❌`;
      }
    }

    lines.push(
      `**${guild.name}**
ID: \`${guild.id}\`
Members: ${guild.memberCount}${inviteLine}`,
    );
  }

  const chunks = chunkText(lines, 3800);

  await ctx.interaction.editReply({
    embeds: [buildEmbed(chunks[0], 1, chunks.length, guilds.size)],
  });

  for (let i = 1; i < chunks.length; i++) {
    await ctx.interaction.followUp({
      embeds: [buildEmbed(chunks[i], i + 1, chunks.length)],
      ephemeral: true,
    });
  }
};

/* ---------------- HELPERS ---------------- */

function buildEmbed(description, page, totalPages, totalServers) {
  return new EmbedBuilder()
    .setTitle(page === 1 ? '📊 Server List' : '📊 Server List (continued)')
    .setColor(0x5865f2)
    .setDescription(description)
    .setFooter({
      text: `Total: ${totalServers} servers | Page ${page}/${totalPages}`,
    })
    .setTimestamp();
}

function chunkText(lines, maxLength) {
  const chunks = [];
  let current = '';

  for (const line of lines) {
    const next = current ? `${current}\n\n${line}` : line;

    if (next.length > maxLength) {
      chunks.push(current);
      current = line;
    } else {
      current = next;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

/* ---------------- METADATA ---------------- */

export const generateMetadata = async () => ({
  guilds: [process.env.DEV_GUILD],
});
