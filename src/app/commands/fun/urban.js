import { commandkit } from 'commandkit';
import { getGuildPrefix } from '../../cache/guildCache.js';
import { ApplicationCommandOptionType, EmbedBuilder, Colors } from 'discord.js';
import fetch from 'node-fetch';

commandkit.setPrefixResolver(async (message) => {
  if (!message.inGuild) return ',';
  return await getGuildPrefix(message.guildId);
});

/** @type {import('commandkit').CommandData} */
export const command = {
  name: 'urban',
  description: 'Get the Urban Dictionary definition of a word',
  options: [
    {
      name: 'word',
      description: 'The word you want the definition for',
      type: ApplicationCommandOptionType.String,
      required: true,
    },
  ],
};

/** @param {import('commandkit').ChatInputCommandContext} ctx */
export const chatInput = async (ctx) => {
  await ctx.interaction.deferReply();

  const word = ctx.interaction.options.getString('word');

  try {
    const res = await fetch(`https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(word)}`);
    const data = await res.json();

    if (!data.list.length) {
      return ctx.interaction.editReply(`No Urban Dictionary results found for **${word}**.`);
    }

    const top = data.list[0];
    const embed = new EmbedBuilder()
      .setTitle(top.word)
      .setURL(top.permalink)
      .setDescription(top.definition.length > 4096 ? top.definition.slice(0, 4000) + '...' : top.definition)
      .addFields({ name: 'Example', value: top.example || 'None' })
      .setColor(Colors.DarkGreen)
      .setFooter({ text: `👍 ${top.thumbs_up} | 👎 ${top.thumbs_down}` });

    return ctx.interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error(err);
    return ctx.interaction.editReply('Something went wrong while fetching the definition.');
  }
};

/** @param {import('commandkit').MessageCommandContext} ctx */
export const message = async (ctx) => {
  const args = ctx.args();
  if (!args.length) return ctx.message.reply('You need to provide a word to look up.');

  const word = args.join(' ');

  try {
    const res = await fetch(`https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(word)}`);
    const data = await res.json();

    if (!data.list.length) {
      return ctx.message.reply(`No Urban Dictionary results found for **${word}**.`);
    }

    const top = data.list[0];
    const embed = new EmbedBuilder()
      .setTitle(top.word)
      .setURL(top.permalink)
      .setDescription(top.definition.length > 4096 ? top.definition.slice(0, 4000) + '...' : top.definition)
      .addFields({ name: 'Example', value: top.example || 'None' })
      .setColor(Colors.DarkGreen)
      .setFooter({ text: `👍 ${top.thumbs_up} | 👎 ${top.thumbs_down}` });

    return ctx.message.reply({ embeds: [embed] });
  } catch (err) {
    console.error(err);
    return ctx.message.reply('Something went wrong while fetching the definition.');
  }
};

/** @type {import('commandkit').CommandMetadataFunction} */
export const generateMetadata = async () => {
  return {
    // guilds: [process.env.DEV_GUILD]
  };
};
