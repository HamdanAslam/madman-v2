import Server from '../../models/Server.js';
import { revalidateTag } from '@commandkit/cache';

/**
 * @type {import('commandkit').EventHandler<'guildCreate'>}
 */
const handler = async (guild) => {
  console.log(`Joined server: ${guild.name} (${guild.id})`);

  await Server.findOneAndUpdate({ guildId: guild.id }, { $setOnInsert: { guildId: guild.id } }, { upsert: true });
  revalidateTag(`server:${guild.id}`);
};

export default handler;
