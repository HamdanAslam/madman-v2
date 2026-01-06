import { commandkit } from 'commandkit';
import { getGuildPrefix } from '../../cache/guildCache.js';
import {
  ApplicationCommandOptionType,
  EmbedBuilder,
  Colors,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import fetch from 'node-fetch';

commandkit.setPrefixResolver(async (message) => {
  if (!message.inGuild) return ',';
  return await getGuildPrefix(message.guildId);
});

/** @type {import('commandkit').CommandData} */
export const command = {
  name: 'define',
  description: 'Get the proper dictionary definition of a word',
  options: [
    {
      name: 'word',
      description: 'The word you want the definition for',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],
};

function createEmbed(word, phonetic, definitions, page) {
  const embed = new EmbedBuilder()
    .setTitle(word)
    .setDescription(definitions[page])
    .setColor(Colors.Blue)
    .setFooter({ text: `Phonetics: ${phonetic || 'N/A'} | Page ${page + 1}/${definitions.length}` });
  return embed;
}

function buildButtons(page, total) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('prev')
      .setLabel('⬅ Previous')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId('next')
      .setLabel('Next ➡')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(page === total - 1),
  );
}

/** @param {import('commandkit').ChatInputCommandContext} ctx */
export const chatInput = async (ctx) => {
  await ctx.interaction.deferReply();

  const word = ctx.interaction.options.getString('word');

  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    if (!res.ok) throw new Error('Word not found');

    const data = await res.json();
    const entry = data[0];

    const definitions = entry.meanings
      .map((m) =>
        m.definitions.map(
          (d) => `**${m.partOfSpeech}**: ${d.definition}${d.example ? `\n_Example_: ${d.example}` : ''}`,
        ),
      )
      .flat();

    if (!definitions.length) return ctx.interaction.editReply(`No definitions found for **${word}**.`);

    let page = 0;
    const msg = await ctx.interaction.editReply({
      embeds: [createEmbed(entry.word, entry.phonetics?.[0]?.text, definitions, page)],
      components: [buildButtons(page, definitions.length)],
    });

    const collector = msg.createMessageComponentCollector({ time: 60000 });

    collector.on('collect', (i) => {
      if (i.user.id !== ctx.interaction.user.id)
        return i.reply({ content: "This isn't your session!", ephemeral: true });

      if (i.customId === 'next') page++;
      if (i.customId === 'prev') page--;

      i.update({
        embeds: [createEmbed(entry.word, entry.phonetics?.[0]?.text, definitions, page)],
        components: [buildButtons(page, definitions.length)],
      });
    });

    collector.on('end', () => {
      msg.edit({ components: [] }).catch(() => {});
    });
  } catch (err) {
    console.error(err);
    ctx.interaction.editReply(`No definition found for **${word}**.`);
  }
};

/** @param {import('commandkit').MessageCommandContext} ctx */
export const message = async (ctx) => {
  const args = ctx.args();
  if (!args.length) return ctx.message.reply('You need to provide a word to define.');

  const word = args.join(' ');

  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    if (!res.ok) throw new Error('Word not found');

    const data = await res.json();
    const entry = data[0];

    const definitions = entry.meanings
      .map((m) =>
        m.definitions.map(
          (d) => `**${m.partOfSpeech}**: ${d.definition}${d.example ? `\n_Example_: ${d.example}` : ''}`,
        ),
      )
      .flat();

    if (!definitions.length) return ctx.message.reply(`No definitions found for **${word}**.`);

    let page = 0;
    const msg = await ctx.message.reply({
      embeds: [createEmbed(entry.word, entry.phonetics?.[0]?.text, definitions, page)],
      components: [buildButtons(page, definitions.length)],
    });

    const collector = msg.createMessageComponentCollector({ time: 60000 });

    collector.on('collect', (i) => {
      if (i.user.id !== ctx.message.author.id) return i.reply({ content: "This isn't your session!", ephemeral: true });

      if (i.customId === 'next') page++;
      if (i.customId === 'prev') page--;

      i.update({
        embeds: [createEmbed(entry.word, entry.phonetics?.[0]?.text, definitions, page)],
        components: [buildButtons(page, definitions.length)],
      });
    });

    collector.on('end', () => {
      msg.edit({ components: [] }).catch(() => {});
    });
  } catch (err) {
    console.error(err);
    ctx.message.reply(`No definition found for **${word}**.`);
  }
};

/** @type {import('commandkit').CommandMetadataFunction} */
export const generateMetadata = async () => {
  return {
    //   guilds: [process.env.DEV_GUILD]
  };
};
