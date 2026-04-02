import { Schema, model } from 'mongoose';

const triggerSchema = new Schema({
  keyword: {
    type: String,
    required: true,
  },
  response: {
    type: String,
    required: true,
  },
});

const serverSchema = new Schema({
  guildId: {
    type: String,
    unique: true,
    required: true,
  },
  prefix: {
    type: String,
    default: ',',
  },
  modules: {
    triggers: {
      status: {
        type: Boolean,
        default: true,
      },
      list: {
        type: [triggerSchema],
        default: [],
      },
    },
    afk: {
      status: { type: Boolean, default: false },
    },
    logs: {
      joinLogs: { channel: { type: String, default: '' } },
      leaveLogs: { channel: { type: String, default: '' } },
      modLogs: { channel: { type: String, default: '' } },
      messageLogs: { channel: { type: String, default: '' } },
      misc: {
        sayLogs: { channel: { type: String, default: '' } },
        dmLogs: { channel: { type: String, default: '' } },
      },
    },
    automod: { status: { type: Boolean, default: false } },
    autoresponder: { status: { type: Boolean, default: false } },
    reminders: { status: { type: Boolean, default: false } },
    autoroles: { status: { type: Boolean, default: false } },
    moderation: { status: { type: Boolean, default: false } },
    customCmd: { status: { type: Boolean, default: false } },
    welcome: { status: { type: Boolean, default: false } },
    reactionRoles: { status: { type: Boolean, default: false } },
    starboard: { status: { type: Boolean, default: false } },
    giveaways: { status: { type: Boolean, default: false } },
    fakeperms: {
      status: { type: Boolean, default: true },
      roles: { type: Array, default: [] },
    },
    counting: {
      status: { type: Boolean, default: false },
      channel: { type: String, default: '' },
      current: { type: Number, default: 1 },
      lastUser: { type: String, default: '' },
      failMessages: { type: Boolean, default: true },
      revive: { type: Boolean, default: true },
      highscore: { type: Number, default: 0 },
      failMessage: { type: String, default: 'Oops! <user> ruined it at **{number}**!' },
    },
    bumpReminders: {
      status: { type: Boolean, default: false },
      roleId: { type: String, default: '' },
      confirmationMessage: {
        type: String,
        default: 'Thanks for bumping! I will remind you in 2 hours.',
      },
      reminderMessage: {
        type: String,
        default: '<@&{role}>, time to bump the server! Use /bump',
      },
    },
    music: {
      status: { type: Boolean, default: true },

      volume: {
        type: Number,
        default: 50,
        min: 0,
        max: 100,
      },

      djRole: {
        type: String,
        default: '',
      },

      autoLeave: {
        type: Boolean,
        default: true,
      },

      stay24x7: {
        type: Boolean,
        default: false,
      },

      announceNowPlaying: {
        type: Boolean,
        default: true,
      },
    },
  },
});

export default model('Server', serverSchema);
