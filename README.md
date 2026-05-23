# Discord Panel Bot - Minecraft AFK Bot Control Panel

A **professional, production-ready Discord bot** for managing Minecraft AFK bots with a beautiful UI, role-based slot system, and real-time monitoring.

## ✨ Features

✅ **Beautiful Discord UI** - Modern embeds with colors and statuses  
✅ **Role-Based Slot System** - Dynamic slot allocation per tier  
✅ **Global Slot Limiting** - Maximum 40 concurrent bots (configurable)  
✅ **Anti-AFK Protection** - Automatic jumps every 30 seconds  
✅ **Auto Reconnection** - Up to 5 reconnect attempts with backoff  
✅ **Real-Time Status** - Uptime tracking & status monitoring  
✅ **Slash Commands** - Modern `/panel` command  
✅ **Security** - Users control only their own bots  
✅ **Error Handling** - Clear error messages & validation  
✅ **JSON Database** - Simple persistent storage  

## 🚀 Quick Start

### 1. Clone & Install
```bash
git clone https://github.com/nobmcgm/discord-panel-bot.git
cd discord-panel-bot
npm install
```

### 2. Configure
Edit `config.js`:
```javascript
token: "YOUR_BOT_TOKEN",
guildId: "YOUR_SERVER_ID",

roles: {
  member: { id: "ROLE_ID", slots: 1 },
  vip: { id: "ROLE_ID", slots: 2 },
  // ... add your roles
}
```

### 3. Run
```bash
npm start
```

### 4. Use in Discord
```
/panel
```

## 📋 Role Tiers

| Tier | Slots | Use Case |
|------|-------|----------|
| Member | 1 | Basic users |
| VIP | 2 | Supporters |
| MVP | 3 | Active members |
| ELITE | 5 | Premium users |
| ULTIMATE | 7 | VIP+ users |
| LEGEND | 10 | Top tier |
| Admin | ∞ | Moderators |

## 🎮 Bot Management

### Commands
- `/panel` - Open control panel

### Buttons
- **Get Started** - Register & view panel
- **My Bots** - List your bots
- **System Info** - View server stats
- **Start Bot** - Create new bot (modal)
- **Status** - View bot status & uptime
- **Stop** - Stop running bot
- **Restart** - Restart bot
- **Delete** - Delete bot (with confirmation)

## ⚙️ Configuration

### Minecraft Settings
```javascript
minecraft: {
  defaultHost: "play.example.com",
  defaultPort: 25565,
  defaultVersion: "1.21.8"
}
```

### Bot Behavior
```javascript
botBehavior: {
  antiAfkInterval: 30000,      // 30 seconds
  jumpDuration: 500,            // 500ms per jump
  reconnectDelay: 10000,        // 10 seconds
  maxReconnectAttempts: 5       // 5 attempts
}
```

## 📊 Database Structure

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
    "totalBotsCreated": 5,
    "totalBotsRunning": 3
  }
}
```

## 🔒 Security

✅ Users can only control their own bots  
✅ Role-based access control  
✅ Admin bypass for moderation  
✅ Input validation on all forms  
✅ No duplicate bots allowed  
✅ Slot limits enforced globally & per-user  

## 🛠️ Troubleshooting

### Bot won't connect to server
- Check server is online and accessible
- Verify IP/hostname and port
- Check Minecraft version compatibility
- Look at console logs for detailed errors

### Bots keep disconnecting
- Check network stability
- Verify server doesn't kick idle players
- Increase `reconnectDelay` if needed
- Check server resource limits

### Bot token invalid
- Go to [Discord Developer Portal](https://discord.com/developers/applications)
- Create new application
- Go to "Bot" section and copy token
- Update `config.js`

## 📦 Requirements

- Node.js 18+
- discord.js 14+
- mineflayer 4+
- 12GB RAM (recommended)

## 📝 License

MIT

## 🤝 Support

For issues, open a GitHub issue or check Discord support channel.
