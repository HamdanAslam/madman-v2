import { Schema, model } from 'mongoose';

const afkSchema = new Schema({
  guildId: {
    type: String,
    required: true,
  },
  userId: {
    type: String,
    required: true,
  },
  reason: {
    type: String,
    default: 'AFK',
  },
  since: {
    type: Date,
    default: Date.now,
  },
});

afkSchema.index({ guildId: 1, userId: 1 }, { unique: true });

export default model('AFK', afkSchema);
