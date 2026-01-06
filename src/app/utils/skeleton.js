// import { commandkit } from 'commandkit';
// ...existing code...
// import { ApplicationCommandOptionType, MessageFlags } from 'discord.js';
// const cooldown = new Map();

// commandkit.setPrefixResolver(async (message) => {
//   if (!message.inGuild) {
//     return ',';
//   }

//   return await getGuildPrefix(message.guildId);
// });

// /**
//  * @type {import('commandkit').CommandData}
//  */
// export const command = {
//   name: 'mute',
//   description: 'mute someone with an optional reason',
//   options: [
//     {
//       name: 'target',
//       description: 'the user you want to mute',
//       type: ApplicationCommandOptionType.User,
//       required: true,
//     },
//     {
//       name: 'duration',
//       description: 'the duration',
//       type: ApplicationCommandOptionType.String,
//       required: true,
//     },
//   ],
// };

// /**
//  * @param {import('commandkit').ChatInputCommandContext} ctx
//  */
// export const chatInput = async (ctx) => {};

// /**
//  * @param {import('commandkit').MessageCommandContext} ctx
//  */
// export const message = async (ctx) => {};

// /**
//  * @typedef {import('commandkit').CommandMetadataFunction} CommandMetadataFunction
//  */

// /** @type {CommandMetadataFunction} */
// export const generateMetadata = async () => {
//   return {};
// };
