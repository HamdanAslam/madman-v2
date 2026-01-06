import { getGuildDoc } from './guildCache.js';
import { cacheTag } from '@commandkit/cache';

export async function getGuildTriggers(guildId) {
  'use cache';
  cacheTag(`server:${guildId}`);

  // Retrieve the full guild/server document via the centralized cache/upsert
  const serverDoc = await getGuildDoc(guildId);

  return {
    status: serverDoc.modules.triggers.status,
    list: serverDoc.modules.triggers.list,
  };
}
