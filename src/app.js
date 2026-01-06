import { Client, Partials } from 'discord.js';

const client = new Client({
  intents: ['Guilds', 'GuildMembers', 'GuildMessages', 'DirectMessages', 'MessageContent'],
  partials: [Partials.Channel, Partials.Message],
});
export default client;
