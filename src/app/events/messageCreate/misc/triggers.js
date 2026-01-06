import { getGuildTriggers } from '../../../cache/triggerCache.js';

const triggerHandler = async (message) => {
  if (!message.inGuild() || message.author.bot) return;

  const triggers = await getGuildTriggers(message.guild.id);
  if (!triggers.status || triggers.list.length === 0) return;

  const content = message.content.toLowerCase();
  for (const { keyword, response } of triggers.list) {
    if (content.includes(keyword)) {
      await message.channel.send(response);
      break;
    }
  }
};

export default triggerHandler;
