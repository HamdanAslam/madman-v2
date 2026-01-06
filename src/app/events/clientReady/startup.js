import { Logger } from 'commandkit/logger';
import mongoose from 'mongoose';
import { loadAFKCache } from '../../cache/afkCache.js';

/**
 * @type {import('commandkit').EventHandler<'clientReady'>}
 */
const handler = async (client) => {
  Logger.info(`Logged in as ${client.user.username}!`);
  try {
    await mongoose.connect(process.env.MONGOOSE_URI);
    Logger.info('Database connected!');
  } catch (err) {
    Logger.error('Database connection failed', err);
  }
  await loadAFKCache();
};

export default handler;
