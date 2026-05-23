module.exports = {
  // Discord Bot Token
  token: "YOUR_DISCORD_BOT_TOKEN",

  // Discord Server ID
  guildId: "YOUR_GUILD_ID",

  // Panel Channel ID (where embed will be posted)
  panelChannelId: "YOUR_PANEL_CHANNEL_ID",

  // Maximum global slots (total bots running across all users)
  maxGlobalSlots: 40,

  // Role-based slot system
  roles: {
    member: {
      id: "ROLE_ID_MEMBER",
      slots: 1,
      name: "Member"
    },

    vip: {
      id: "ROLE_ID_VIP",
      slots: 2,
      name: "VIP"
    },

    mvp: {
      id: "ROLE_ID_MVP",
      slots: 3,
      name: "MVP"
    },

    elite: {
      id: "ROLE_ID_ELITE",
      slots: 5,
      name: "ELITE"
    },

    ultimate: {
      id: "ROLE_ID_ULTIMATE",
      slots: 7,
      name: "ULTIMATE"
    },

    legend: {
      id: "ROLE_ID_LEGEND",
      slots: 10,
      name: "LEGEND"
    },

    admin: {
      id: "ROLE_ID_ADMIN",
      slots: Infinity,
      name: "Admin"
    }
  },

  // Minecraft Server Defaults
  minecraft: {
    defaultHost: "nnca.mcsh.io",
    defaultPort: 25565,
    defaultVersion: "1.21.8"
  },

  // Bot Behavior
  botBehavior: {
    antiAfkInterval: 30000, // 30 seconds
    jumpDuration: 500, // 500ms
    reconnectDelay: 10000, // 10 seconds
    maxReconnectAttempts: 5
  },

  // Logging
  debug: false
};
