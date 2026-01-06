export default [
  // Core
  { name: 'help', description: 'Show a paginated list of available commands' },
  { name: 'ping', description: "Ping the bot to check if it's online." },

  // Info
  { name: 'servers', description: 'List all servers the bot is in' },
  { name: 'avatar', description: "Show a user's avatar" },
  { name: 'define', description: 'Get the proper dictionary definition of a word' },
  { name: 'urban', description: 'Get the Urban Dictionary definition of a word' },

  // AI
  { name: 'ask', description: 'Ask the AI for help or answers' },
  { name: 'reset', description: 'Reset the AI conversation history for this channel' },

  // Server config
  {
    name: 'prefix',
    description: 'Manage server prefix',
    subcommands: [
      { name: 'set', description: 'Set a new prefix for the server' },
      { name: 'get', description: "Get the server's prefix" },
      { name: 'reset', description: 'Reset to the default prefix (,)' },
    ],
  },
  {
    name: 'trigger',
    description: 'Manage custom triggers for your server',
    subcommands: [
      { name: 'create', description: 'Create a new trigger' },
      { name: 'delete', description: 'Delete an existing trigger' },
      { name: 'view', description: 'View all triggers for this server' },
    ],
  },
  {
    name: 'logs',
    description: 'Manage server logging channels',
    subcommands: [
      { name: 'set', description: 'Set a logging channel' },
      { name: 'disable', description: 'Disable a logging channel' },
      { name: 'view', description: 'View current logging channels' },
    ],
  },

  // Moderation
  { name: 'purge', description: 'Delete a bunch of messages' },
  { name: 'mute', description: 'Mute someone with an optional reason' },
  { name: 'unmute', description: 'Unmute a previously muted user' },
  { name: 'kick', description: 'Kick a user from the server with an optional reason' },
  { name: 'ban', description: 'Ban a user from the server with an optional reason' },
  { name: 'say', description: 'Make the bot say something' },

  // Utility / Fun
  { name: 'afk', description: 'Set an AFK status with an optional reason' },
  { name: 'dm', description: 'Send a DM to a server member' },
  { name: 'cat', description: 'Get a random cat image' },
  { name: 'dog', description: 'Get a random dog image' },
];
