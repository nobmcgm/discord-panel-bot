const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  SlashCommandBuilder,
  Routes,
  Colors
} = require('discord.js');

const fs = require('fs');
const path = require('path');
const config = require('./config');
const { createMineflayerBot } = require('./bot');
const { REST } = require('discord.js');

// ===== INITIALIZE CLIENT =====
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ===== DATABASE =====
const dbPath = path.join(__dirname, 'data.json');

function loadDB() {
  try {
    if (fs.existsSync(dbPath)) {
      return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    }
    return { users: {}, stats: { totalBotsCreated: 0, totalBotsRunning: 0 } };
  } catch (err) {
    console.error('[DB] Error loading database:', err);
    return { users: {}, stats: { totalBotsCreated: 0, totalBotsRunning: 0 } };
  }
}

function saveDB(data) {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('[DB] Error saving database:', err);
  }
}

let db = loadDB();
let activeBots = new Map();

// ===== UTILITY FUNCTIONS =====

function getUserSlotLimit(member) {
  if (!member) return 0;

  let maxSlots = 0;
  let highestRole = null;

  for (const [roleKey, roleConfig] of Object.entries(config.roles)) {
    if (member.roles.cache.has(roleConfig.id)) {
      if (roleConfig.slots > maxSlots || (roleConfig.slots === Infinity && maxSlots !== Infinity)) {
        maxSlots = roleConfig.slots;
        highestRole = roleKey;
      }
    }
  }

  return maxSlots;
}

function getGlobalActiveBots() {
  let count = 0;
  activeBots.forEach(userBots => {
    count += userBots.filter(b => b.getStatus().running).length;
  });
  return count;
}

function getUserActiveBots(userId) {
  const userBots = activeBots.get(userId) || [];
  return userBots.filter(b => b.getStatus().running).length;
}

function getUserData(userId) {
  if (!db.users[userId]) {
    db.users[userId] = {
      bots: [],
      createdAt: new Date().toISOString()
    };
    saveDB(db);
  }
  return db.users[userId];
}

function getUptime(startedAt) {
  const uptime = Date.now() - new Date(startedAt).getTime();
  const hours = Math.floor(uptime / (1000 * 60 * 60));
  const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

// ===== EMBED BUILDERS =====

function createPanelEmbed() {
  const globalActive = getGlobalActiveBots();
  const availableSlots = config.maxGlobalSlots - globalActive;
  const percentage = Math.round((globalActive / config.maxGlobalSlots) * 100);

  return new EmbedBuilder()
    .setColor(Colors.Green)
    .setTitle('🤖 Minecraft AFK Bot Control Panel')
    .setDescription('Manage your Minecraft AFK bots with ease')
    .addFields(
      {
        name: '📊 System Status',
        value: `✅ **Backend:** Online\n🤖 **Active Bots:** ${globalActive}/${config.maxGlobalSlots} (${percentage}%)\n📌 **Available Slots:** ${availableSlots}`,
        inline: false
      },
      {
        name: '⚙️ Features',
        value: `✅ Anti-AFK System (30s jumps)\n✅ Auto Reconnect (5 attempts)\n✅ Role-Based Slot System\n✅ Real-Time Status Updates`,
        inline: false
      },
      {
        name: '📋 Subscription Tiers',
        value: Object.entries(config.roles)
          .map(([, role]) => `**${role.name}** → ${role.slots === Infinity ? '∞ Slots' : `${role.slots} Slot${role.slots !== 1 ? 's' : ''}`}`)
          .join('\n'),
        inline: false
      }
    )
    .setFooter({
      text: 'Click buttons to get started',
      iconURL: 'https://www.minecraft.net/favicon.ico'
    })
    .setTimestamp();
}

function createUserPanelEmbed(userId, member) {
  const userData = getUserData(userId);
  const slotLimit = getUserSlotLimit(member);
  const activeBotCount = getUserActiveBots(userId);
  const totalBots = userData.bots.length;

  let botList = '```No bots yet - Click Start Bot to create one!```';
  if (userData.bots.length > 0) {
    botList = userData.bots.map((bot, idx) => {
      const status = bot.running ? '🟢' : '🔴';
      const uptime = bot.running ? getUptime(bot.startedAt) : 'N/A';
      return `${idx + 1}. ${status} **${bot.username}** @ ${bot.host}:${bot.port}\n   ⏱️ ${uptime}`;
    }).join('\n');
  }

  return new EmbedBuilder()
    .setColor(Colors.Blue)
    .setTitle(`🤖 ${member.user.username}'s Bot Panel`)
    .setThumbnail(member.user.displayAvatarURL())
    .addFields(
      {
        name: '📊 Slot Usage',
        value: `${activeBotCount}/${slotLimit === Infinity ? '∞' : slotLimit} slots used`,
        inline: true
      },
      {
        name: '🤖 Total Bots',
        value: `${totalBots} bot${totalBots !== 1 ? 's' : ''}`,
        inline: true
      },
      {
        name: '📋 Your Bots',
        value: botList,
        inline: false
      }
    )
    .setFooter({ text: `User ID: ${userId}` })
    .setTimestamp();
}

function createSuccessEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(Colors.Green)
    .setTitle(`✅ ${title}`)
    .setDescription(description)
    .setTimestamp();
}

function createErrorEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(Colors.Red)
    .setTitle(`❌ ${title}`)
    .setDescription(description)
    .setTimestamp();
}

function createWarningEmbed(title, description) {
  return new EmbedBuilder()
    .setColor(Colors.Orange)
    .setTitle(`⚠️ ${title}`)
    .setDescription(description)
    .setTimestamp();
}

// ===== BUTTON HANDLERS =====

async function handleRegister(interaction) {
  const userId = interaction.user.id;
  const userData = getUserData(userId);

  if (userData.bots.length > 0) {
    return interaction.reply({
      embeds: [createSuccessEmbed('Already Registered', 'You are already set up! Click **My Panel** to manage your bots.')],
      ephemeral: true
    });
  }

  const embed = createUserPanelEmbed(userId, interaction.member);
  const row = createUserButtons(userId);

  return interaction.reply({
    embeds: [embed],
    components: [row],
    ephemeral: true
  });
}

async function handleStartBotModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId(`startbot_${interaction.user.id}`)
    .setTitle('Start Minecraft Bot');

  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('bot_username')
        .setLabel('Bot Username')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., AFKBot123')
        .setMinLength(3)
        .setMaxLength(16)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('server_host')
        .setLabel('Server Host / IP')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., play.example.com')
        .setValue(config.minecraft.defaultHost)
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('server_port')
        .setLabel('Server Port')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('25565')
        .setValue(config.minecraft.defaultPort.toString())
        .setRequired(true)
    )
  );

  return interaction.showModal(modal);
}

async function handleStartBotSubmit(interaction) {
  const userId = interaction.user.id;
  const userData = getUserData(userId);
  const member = await interaction.guild.members.fetch(userId);

  const botUsername = interaction.fields.getTextInputValue('bot_username');
  const serverHost = interaction.fields.getTextInputValue('server_host');
  const serverPort = parseInt(interaction.fields.getTextInputValue('server_port'));

  // Validation
  if (!botUsername || botUsername.length < 3 || botUsername.length > 16) {
    return interaction.reply({
      embeds: [createErrorEmbed('Invalid Username', 'Username must be 3-16 characters long.')],
      ephemeral: true
    });
  }

  if (isNaN(serverPort) || serverPort < 1 || serverPort > 65535) {
    return interaction.reply({
      embeds: [createErrorEmbed('Invalid Port', 'Port must be a number between 1-65535.')],
      ephemeral: true
    });
  }

  if (!serverHost || serverHost.length < 3) {
    return interaction.reply({
      embeds: [createErrorEmbed('Invalid Host', 'Please provide a valid server host or IP address.')],
      ephemeral: true
    });
  }

  if (userData.bots.some(b => b.username === botUsername && b.host === serverHost)) {
    return interaction.reply({
      embeds: [createErrorEmbed('Duplicate Bot', `You already have a bot named **${botUsername}** on this server.`)],
      ephemeral: true
    });
  }

  const slotLimit = getUserSlotLimit(member);
  const activeBotCount = getUserActiveBots(userId);

  if (slotLimit === 0) {
    return interaction.reply({
      embeds: [createErrorEmbed('No Access', 'You do not have any roles that grant bot slots. Contact admin.')],
      ephemeral: true
    });
  }

  if (slotLimit !== Infinity && activeBotCount >= slotLimit) {
    return interaction.reply({
      embeds: [createWarningEmbed('Slot Limit Reached', `You have reached your slot limit: **${activeBotCount}/${slotLimit}**\n\nUpgrade your role to create more bots.`)],
      ephemeral: true
    });
  }

  const globalActive = getGlobalActiveBots();
  if (globalActive >= config.maxGlobalSlots) {
    return interaction.reply({
      embeds: [createWarningEmbed('Server Full', `The server is at maximum capacity: **${globalActive}/${config.maxGlobalSlots}** bots.\n\nTry again later.`)],
      ephemeral: true
    });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const botInstance = createMineflayerBot({
      host: serverHost,
      port: serverPort,
      username: botUsername,
      version: config.minecraft.defaultVersion,
      antiAfk: config.botBehavior,
      onReconnect: (data) => {
        console.log(`[RECONNECT] ${data.username} (attempt ${data.reconnectCount})`);
      }
    });

    await botInstance.start();

    if (!activeBots.has(userId)) {
      activeBots.set(userId, []);
    }
    activeBots.get(userId).push(botInstance);

    const botData = {
      username: botUsername,
      host: serverHost,
      port: serverPort,
      running: true,
      startedAt: new Date().toISOString()
    };

    userData.bots.push(botData);
    db.stats.totalBotsCreated++;
    saveDB(db);

    const embed = createUserPanelEmbed(userId, member);
    const row = createUserButtons(userId);

    return interaction.editReply({
      embeds: [createSuccessEmbed('Bot Started', `**${botUsername}** is now running on **${serverHost}:${serverPort}**!`)],
      components: [row]
    });

  } catch (err) {
    console.error('[BOT] Start error:', err);
    return interaction.editReply({
      embeds: [createErrorEmbed('Connection Failed', `Could not connect to **${serverHost}:${serverPort}**\n\n**Error:** ${err.message}\n\nMake sure the server is online and accessible.`)]
    });
  }
}

async function handleStopBot(interaction, botIndex) {
  const userId = interaction.user.id;
  const userData = getUserData(userId);
  const member = await interaction.guild.members.fetch(userId);

  if (!userData.bots[botIndex]) {
    return interaction.reply({
      embeds: [createErrorEmbed('Bot Not Found', 'This bot no longer exists.')],
      ephemeral: true
    });
  }

  const botName = userData.bots[botIndex].username;
  await interaction.deferReply({ ephemeral: true });

  try {
    const userBots = activeBots.get(userId) || [];
    if (userBots[botIndex]) {
      await userBots[botIndex].stop();
      userBots.splice(botIndex, 1);
    }

    userData.bots[botIndex].running = false;
    saveDB(db);

    const embed = createUserPanelEmbed(userId, member);
    const row = createUserButtons(userId);

    return interaction.editReply({
      embeds: [createSuccessEmbed('Bot Stopped', `**${botName}** has been stopped.`)],
      components: [row]
    });

  } catch (err) {
    console.error('[BOT] Stop error:', err);
    return interaction.editReply({
      embeds: [createErrorEmbed('Stop Failed', `Could not stop **${botName}**.\n\n**Error:** ${err.message}`)]
    });
  }
}

async function handleRestartBot(interaction, botIndex) {
  const userId = interaction.user.id;
  const userData = getUserData(userId);
  const member = await interaction.guild.members.fetch(userId);

  if (!userData.bots[botIndex]) {
    return interaction.reply({
      embeds: [createErrorEmbed('Bot Not Found', 'This bot no longer exists.')],
      ephemeral: true
    });
  }

  const botName = userData.bots[botIndex].username;
  await interaction.deferReply({ ephemeral: true });

  try {
    const userBots = activeBots.get(userId) || [];
    if (userBots[botIndex]) {
      await userBots[botIndex].restart();
    }

    userData.bots[botIndex].startedAt = new Date().toISOString();
    saveDB(db);

    const embed = createUserPanelEmbed(userId, member);
    const row = createUserButtons(userId);

    return interaction.editReply({
      embeds: [createSuccessEmbed('Bot Restarted', `**${botName}** has been restarted successfully.`)],
      components: [row]
    });

  } catch (err) {
    console.error('[BOT] Restart error:', err);
    return interaction.editReply({
      embeds: [createErrorEmbed('Restart Failed', `Could not restart **${botName}**.\n\n**Error:** ${err.message}`)]
    });
  }
}

async function handleBotStatus(interaction, botIndex) {
  const userId = interaction.user.id;
  const userData = getUserData(userId);

  if (!userData.bots[botIndex]) {
    return interaction.reply({
      embeds: [createErrorEmbed('Bot Not Found', 'This bot no longer exists.')],
      ephemeral: true
    });
  }

  const bot = userData.bots[botIndex];
  const userBots = activeBots.get(userId) || [];
  const botInstance = userBots[botIndex];
  const isRunning = botInstance && botInstance.getStatus().running;

  let statusEmbed = new EmbedBuilder()
    .setColor(isRunning ? Colors.Green : Colors.Red)
    .setTitle(`📊 ${bot.username} Status`)
    .addFields(
      {
        name: '🔌 Status',
        value: isRunning ? '🟢 **Online**' : '🔴 **Offline**',
        inline: true
      },
      {
        name: '👤 Username',
        value: bot.username,
        inline: true
      },
      {
        name: '🌐 Server',
        value: `${bot.host}:${bot.port}`,
        inline: true
      },
      {
        name: '📅 Started',
        value: new Date(bot.startedAt).toLocaleString(),
        inline: true
      }
    );

  if (botInstance) {
    const status = botInstance.getStatus();
    statusEmbed.addFields(
      {
        name: '⏱️ Uptime',
        value: getUptime(bot.startedAt),
        inline: true
      },
      {
        name: '🔄 Reconnect Count',
        value: `${status.reconnectCount}/5`,
        inline: true
      },
      {
        name: '⚙️ Anti-AFK',
        value: status.antiAFKEnabled ? '✅ Enabled' : '❌ Disabled',
        inline: true
      }
    );
  }

  return interaction.reply({
    embeds: [statusEmbed],
    ephemeral: true
  });
}

async function handleDeleteBot(interaction, botIndex) {
  const userId = interaction.user.id;
  const userData = getUserData(userId);

  if (!userData.bots[botIndex]) {
    return interaction.reply({
      embeds: [createErrorEmbed('Bot Not Found', 'This bot no longer exists.')],
      ephemeral: true
    });
  }

  const botName = userData.bots[botIndex].username;
  const confirmRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`confirm_delete_${userId}_${botIndex}`)
      .setLabel('Yes, Delete')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`cancel_delete_${userId}`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary)
  );

  return interaction.reply({
    embeds: [createWarningEmbed('Delete Bot', `Are you sure you want to delete **${botName}**?\n\nThis action **cannot be undone**.`)],
    components: [confirmRow],
    ephemeral: true
  });
}

async function handleConfirmDelete(interaction, botIndex) {
  const userId = interaction.user.id;
  const userData = getUserData(userId);
  const member = await interaction.guild.members.fetch(userId);

  if (!userData.bots[botIndex]) {
    return interaction.reply({
      embeds: [createErrorEmbed('Bot Not Found', 'This bot no longer exists.')],
      ephemeral: true
    });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const botName = userData.bots[botIndex].username;
    
    const userBots = activeBots.get(userId) || [];
    if (userBots[botIndex]) {
      await userBots[botIndex].stop();
      userBots.splice(botIndex, 1);
    }

    userData.bots.splice(botIndex, 1);
    saveDB(db);

    const embed = createUserPanelEmbed(userId, member);
    const row = createUserButtons(userId);

    return interaction.editReply({
      embeds: [createSuccessEmbed('Bot Deleted', `**${botName}** has been permanently deleted.`)],
      components: [row]
    });

  } catch (err) {
    console.error('[BOT] Delete error:', err);
    return interaction.editReply({
      embeds: [createErrorEmbed('Delete Failed', `Could not delete bot.\n\n**Error:** ${err.message}`)]
    });
  }
}

// ===== BUTTON ROW BUILDERS =====

function createMainPanelButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('register')
      .setLabel('Get Started')
      .setStyle(ButtonStyle.Success)
      .setEmoji('📋'),
    new ButtonBuilder()
      .setCustomId('my_panel')
      .setLabel('My Bots')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🎮'),
    new ButtonBuilder()
      .setCustomId('info')
      .setLabel('System Info')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('ℹ️')
  );
}

function createUserButtons(userId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`startbot_modal_${userId}`)
      .setLabel('Start Bot')
      .setStyle(ButtonStyle.Success)
      .setEmoji('▶️'),
    new ButtonBuilder()
      .setCustomId(`my_bots_${userId}`)
      .setLabel('Refresh')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🔄'),
    new ButtonBuilder()
      .setCustomId(`back_${userId}`)
      .setLabel('Back')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('⬅️')
  );
}

// ===== CLIENT EVENTS =====

client.once('ready', async () => {
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`[READY] ${client.user.tag} is online!`);
  console.log(`[INFO] Bot is ready in guild: ${config.guildId}`);
  console.log(`${'═'.repeat(50)}\n`);
  
  client.user.setActivity('🤖 Minecraft AFK Bots | /panel', { type: 'WATCHING' });

  const commands = [
    new SlashCommandBuilder()
      .setName('panel')
      .setDescription('📋 Open the Minecraft AFK Bot control panel')
  ];

  const rest = new REST({ version: '10' }).setToken(config.token);

  try {
    console.log('[COMMANDS] Registering slash commands...');
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, config.guildId),
      { body: commands.map(cmd => cmd.toJSON()) }
    );
    console.log('[COMMANDS] ✅ Slash commands registered!\n');
  } catch (err) {
    console.error('[COMMANDS] ❌ Failed to register:', err);
  }
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'panel') {
        const embed = createPanelEmbed();
        const row = createMainPanelButtons();
        return interaction.reply({
          embeds: [embed],
          components: [row]
        });
      }
    }
    else if (interaction.isButton()) {
      const customId = interaction.customId;
      const userId = interaction.user.id;

      if (customId === 'register') {
        await handleRegister(interaction);
      }
      else if (customId === 'my_panel') {
        const member = await interaction.guild.members.fetch(userId);
        const embed = createUserPanelEmbed(userId, member);
        const row = createUserButtons(userId);
        return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
      }
      else if (customId === 'info') {
        const embed = createPanelEmbed();
        const row = createMainPanelButtons();
        return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
      }
      else if (customId.startsWith('startbot_modal_')) {
        await handleStartBotModal(interaction);
      }
      else if (customId.startsWith('my_bots_')) {
        const userData = getUserData(userId);
        if (userData.bots.length === 0) {
          return interaction.reply({
            embeds: [createWarningEmbed('No Bots', 'You have no bots yet. Click **Start Bot** to create one!')],
            ephemeral: true
          });
        }

        const botRows = [];
        userData.bots.forEach((bot, idx) => {
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`status_${userId}_${idx}`)
              .setLabel(`${bot.username}`)
              .setStyle(bot.running ? ButtonStyle.Success : ButtonStyle.Secondary)
              .setEmoji(bot.running ? '🟢' : '🔴'),
            new ButtonBuilder()
              .setCustomId(`stop_${userId}_${idx}`)
              .setLabel('Stop')
              .setStyle(ButtonStyle.Danger)
              .setEmoji('⏹️')
              .setDisabled(!bot.running),
            new ButtonBuilder()
              .setCustomId(`restart_${userId}_${idx}`)
              .setLabel('Restart')
              .setStyle(ButtonStyle.Primary)
              .setEmoji('🔄')
              .setDisabled(!bot.running),
            new ButtonBuilder()
              .setCustomId(`delete_${userId}_${idx}`)
              .setLabel('Delete')
              .setStyle(ButtonStyle.Danger)
              .setEmoji('🗑️')
          );
          botRows.push(row);
        });

        const embed = new EmbedBuilder()
          .setColor(Colors.Blue)
          .setTitle(`📋 Your Bots (${userData.bots.length})`)
          .setDescription(userData.bots.map((b, i) => `${i + 1}. **${b.username}** @ ${b.host}:${b.port}`).join('\n'));

        return interaction.reply({
          embeds: [embed],
          components: botRows,
          ephemeral: true
        });
      }
      else if (customId.startsWith('stop_')) {
        const [, , botIndex] = customId.split('_');
        await handleStopBot(interaction, parseInt(botIndex));
      }
      else if (customId.startsWith('restart_')) {
        const [, , botIndex] = customId.split('_');
        await handleRestartBot(interaction, parseInt(botIndex));
      }
      else if (customId.startsWith('status_')) {
        const [, , botIndex] = customId.split('_');
        await handleBotStatus(interaction, parseInt(botIndex));
      }
      else if (customId.startsWith('delete_')) {
        const [, , botIndex] = customId.split('_');
        await handleDeleteBot(interaction, parseInt(botIndex));
      }
      else if (customId.startsWith('confirm_delete_')) {
        const [, , , botIndex] = customId.split('_');
        await handleConfirmDelete(interaction, parseInt(botIndex));
      }
      else if (customId.startsWith('cancel_delete_')) {
        return interaction.reply({
          embeds: [createSuccessEmbed('Cancelled', 'Bot deletion cancelled.')],
          ephemeral: true
        });
      }
      else if (customId.startsWith('back_')) {
        const member = await interaction.guild.members.fetch(userId);
        const embed = createUserPanelEmbed(userId, member);
        const row = createUserButtons(userId);
        return interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
      }
    }
    else if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('startbot_')) {
        await handleStartBotSubmit(interaction);
      }
    }

  } catch (err) {
    console.error('[ERROR] Interaction error:', err);
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({
          embeds: [createErrorEmbed('Error', `Something went wrong: ${err.message}`)]
        });
      } else {
        await interaction.reply({
          embeds: [createErrorEmbed('Error', `Something went wrong: ${err.message}`)],
          ephemeral: true
        });
      }
    } catch (replyErr) {
      console.error('[ERROR] Failed to send error message:', replyErr);
    }
  }
});

client.login(config.token);
