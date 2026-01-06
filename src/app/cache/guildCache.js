import { cacheTag } from '@commandkit/cache';
import Server from '../models/Server.js';

// Centralized guild document cache/upsert. Returns the full server document.
export async function getGuildDoc(guildId) {
  'use cache';
  // Use a server-scoped cache tag so cached reads can be revalidated by tag
  cacheTag(`server:${guildId}`);

  // Use an atomic upsert to avoid race conditions where multiple
  // callers try to create the same Server document simultaneously.
  const serverDoc = await Server.findOneAndUpdate(
    { guildId },
    { $setOnInsert: { guildId } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return serverDoc;
}

// Backwards-compatible helper that returns the prefix only.
export async function getGuildPrefix(guildId) {
  const doc = await getGuildDoc(guildId);
  return doc?.prefix ?? ',';
}
