# Discord Panel Bot - Minecraft AFK Bot Control Panel

A professional Discord-based control panel for managing Minecraft AFK bots with role-based slot system.

## Features

✅ **Discord Integration** - Full bot control via Discord buttons and embeds  
✅ **Role-Based Slot System** - Dynamic slot allocation based on user roles  
✅ **Global Slot Limiting** - Manage maximum concurrent bots (default: 40)  
✅ **Anti-AFK System** - Automatic jump every 30 seconds  
✅ **Auto Reconnection** - Up to 5 reconnect attempts with configurable delays  
✅ **Bot Management** - Start, stop, restart, status, delete bots  
✅ **Security** - Users can only control their own bots  
✅ **Lightweight** - Optimized for 12GB RAM systems  
✅ **JSON Database** - Simple file-based persistence  

## Installation

### 1. Clone the Repository
```bash
git clone https://github.com/nobmcgm/discord-panel-bot.git
cd discord-panel-bot
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure `config.js`

Edit `config.js` and set:

- **Discord Bot Token** - Your bot's token from Discord Developer Portal
- **Guild ID** - Your Discord server ID
- **Panel Channel ID** - Channel for the control panel
- **Role IDs** - ID of each tier role

```javascript
token: "YOUR_TOKEN_HERE",
guildId: "YOUR_GUILD_ID",
panelChannelId: "YOUR_CHANNEL_ID",

roles: {
  member: { id: "ROLE_ID", slots: 1 },
  vip: { id: "ROLE_ID", slots: 2 },
  // ... etc
}
```

### 4. Run the Bot
```bash
npm start
```

## Usage

### Commands

- **`!panel`** - Post the control panel to current channel (Admin only)

### Buttons

- **Register** - Register to the bot panel
- **My Panel** - View your personal panel
- **Info** - View system information
- **Start Bot** - Create and start a new bot
- **My Bots** - List your active bots
- **Status** - View bot status
- **Stop** - Stop a running bot
- **Restart** - Restart a bot
- **Delete** - Delete a bot (with confirmation)

## Role Slot System

Default tier structure:

| Role | Slots |
|------|-------|
| Member | 1 |
| VIP | 2 |
| MVP | 3 |
| ELITE | 5 |
| ULTIMATE | 7 |
| LEGEND | 10 |
| Admin | Unlimited |

The system automatically uses the **highest tier role** a user has.

## Configuration

### Minecraft Settings
```javascript
minecraft: {
  defaultHost: "nnca.mcsh.io",
  defaultPort: 25565,
  defaultVersion: "1.21.8"
}
```

### Bot Behavior
```javascript
botBehavior: {
  antiAfkInterval: 30000,        // 30 seconds
  jumpDuration: 500,              // 500ms
  reconnectDelay: 10000,          // 10 seconds
  maxReconnectAttempts: 5         // 5 attempts
}
```

## Database

Data is stored in `data.json` with the following structure:

```json
{
  "users": {
    "USER_ID": {
      "bots": [
        {
          "username": "BotName",
          "host": "server.ip",
          "port": 25565,
          "running": true,
          "startedAt": "2026-05-23T..."
        }
      ],
      "createdAt": "2026-05-23T..."
    }
  },
  "stats": {
    "totalBotsCreated": 0,
    "totalBotsRunning": 0
  }
}
```

## Security

- Users can only control their own bots
- Admin role bypasses all slot limits
- Invalid input validation
- No duplicate bots allowed
- Slot limits enforced per user and globally

## Performance

- **Memory Efficient** - Map-based bot instance tracking
- **Stable Reconnections** - Prevents reconnect spam
- **Low CPU Usage** - Lightweight event-based architecture
- **Scalable** - Supports 40+ concurrent bots

## Troubleshooting

### Bot won't start
- Check server address and port
- Verify server is running and accessible
- Check Minecraft version compatibility

### Bots disconnecting frequently
- Check network stability
- Verify server isn't kicking idle players
- Increase `reconnectDelay` in config

### Memory issues
- Monitor with `node --max-old-space-size=4096 index.js`
- Reduce `maxGlobalSlots` if needed
- Check for bot instance leaks in logs

## License

MIT

## Support

For issues, create a GitHub issue or contact the developer.
