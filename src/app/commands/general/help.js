import { commandkit } from 'commandkit';
import { getGuildPrefix } from '../../cache/guildCache.js';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ApplicationCommandOptionType } from 'discord.js';
import commandsList from '../../utils/commands.js';

commandkit.setPrefixResolver(async (message) => {
  if (!message.inGuild) return ',';
  return await getGuildPrefix(message.guildId);
});

/** @type {import('commandkit').CommandData} */
export const command = {
  name: 'help',
  description: 'Shows a list of available commands',
  options: [
    {
      name: 'page',
      description: 'Which help page to show',
      type: ApplicationCommandOptionType.Integer,
      required: false,
      min_value: 1,
    },
  ],
};

const PAGE_SIZE = 6;

function buildPages() {
  const entries = commandsList.map((c) => {
    // show command name without prefix (prefix shown separately on the embed)
    let line = `**${c.name}**`;
    if (c.subcommands && c.subcommands.length) {
      const subs = c.subcommands.map((s) => s.name).join(', ');
      line += ` — ${c.description} \n_Subcommands:_ ${subs}`;
    } else {
      line += ` — ${c.description}`;
    }
    return line;
  });

  const pages = [];
  for (let i = 0; i < entries.length; i += PAGE_SIZE) {
    pages.push(entries.slice(i, i + PAGE_SIZE).join('\n\n'));
  }
  return pages;
}

function makeEmbed(pageContent, pageIndex, totalPages, prefix) {
  return new EmbedBuilder()
    .setTitle(`Current prefix: \`${prefix}\``)
    .setDescription(pageContent)
    .setColor(0x5865f2)
    .setFooter({ text: `Page ${pageIndex + 1}/${totalPages}` })
    .setTimestamp();
}

function makeButtons(pageIndex, totalPages) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('prev')
      .setLabel('◀ Previous')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(pageIndex === 0),
    new ButtonBuilder()
      .setCustomId('next')
      .setLabel('Next ▶')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(pageIndex === totalPages - 1),
  );
}

/** @param {import('commandkit').ChatInputCommandContext} ctx */
export const chatInput = async (ctx) => {
  await ctx.interaction.deferReply();

  const prefix = (ctx.client && (await getGuildPrefix(ctx.interaction.guildId))) || ',';
  const pages = buildPages();
  if (!pages.length) return ctx.interaction.editReply('No commands available.');

  let pageIndex = Math.max(0, (ctx.interaction.options.getInteger('page') || 1) - 1);
  if (pageIndex >= pages.length) pageIndex = pages.length - 1;

  const msg = await ctx.interaction.editReply({
    embeds: [makeEmbed(pages[pageIndex], pageIndex, pages.length, prefix)],
    components: [makeButtons(pageIndex, pages.length)],
  });

  if (pages.length === 1) return;

  const collector = msg.createMessageComponentCollector({ time: 60_000 });

  collector.on('collect', async (i) => {
    if (i.user.id !== ctx.interaction.user.id)
      return i.reply({ content: "This isn't your help session.", ephemeral: true });

    if (i.customId === 'next') pageIndex++;
    if (i.customId === 'prev') pageIndex--;
    pageIndex = Math.max(0, Math.min(pageIndex, pages.length - 1));

    await i.update({
      embeds: [makeEmbed(pages[pageIndex], pageIndex, pages.length, prefix)],
      components: [makeButtons(pageIndex, pages.length)],
    });
  });

  collector.on('end', () => {
    try {
      msg.edit({ components: [] }).catch(() => {});
    } catch (err) {
      /* ignore */
    }
  });
};

/** @param {import('commandkit').MessageCommandContext} ctx */
export const message = async (ctx) => {
  const prefix = await getGuildPrefix(ctx.message.guildId);
  const pages = buildPages();
  if (!pages.length) return ctx.message.reply('No commands available.');

  let args = ctx.args();
  let pageIndex = 0;
  if (args[0]) {
    const n = parseInt(args[0]);
    if (!isNaN(n) && n > 0) pageIndex = Math.max(0, Math.min(n - 1, pages.length - 1));
  }

  const sent = await ctx.message.reply({
    embeds: [makeEmbed(pages[pageIndex], pageIndex, pages.length, prefix)],
    components: pages.length > 1 ? [makeButtons(pageIndex, pages.length)] : [],
  });

  if (pages.length === 1) return;

  const collector = sent.createMessageComponentCollector({ time: 60_000 });

  collector.on('collect', async (i) => {
    if (i.user.id !== ctx.message.author.id)
      return i.reply({ content: "This isn't your help session.", ephemeral: true });

    if (i.customId === 'next') pageIndex++;
    if (i.customId === 'prev') pageIndex--;
    pageIndex = Math.max(0, Math.min(pageIndex, pages.length - 1));

    await i.update({
      embeds: [makeEmbed(pages[pageIndex], pageIndex, pages.length, prefix)],
      components: [makeButtons(pageIndex, pages.length)],
    });
  });

  collector.on('end', () => {
    try {
      sent.edit({ components: [] }).catch(() => {});
    } catch (err) {
      /* ignore */
    }
  });
};

/** @typedef {import('commandkit').CommandMetadataFunction} CommandMetadataFunction */
/** @type {CommandMetadataFunction} */
export const generateMetadata = async () => ({
  //   guilds: [process.env.DEV_GUILD],
});
