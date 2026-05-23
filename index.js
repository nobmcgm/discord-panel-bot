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
  Routes
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
let activeBots = new Map(); // userId -> Array of bot instances

// ===== UTILITY FUNCTIONS =====

/**
 * Get user's highest role slot limit
 */
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

  if (config.debug) {
    console.log(`[SLOTS] User ${member.user.username}: ${maxSlots} slots (role: ${highestRole})`);
  }

  return maxSlots;
}

/**
 * Count all active bots across all users
 */
function getGlobalActiveBots() {
  let count = 0;
  activeBots.forEach(userBots => {
    count += userBots.filter(b => b.getStatus().running).length;
  });
  return count;
}

/**
 * Count user's active bots
 */
function getUserActiveBots(userId) {
  const userBots = activeBots.get(userId) || [];
  return userBots.filter(b => b.getStatus().running).length;
}

/**
 * Get user database entry
 */
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

/**
 * Create main control panel embed
 */
function createPanelEmbed() {
  const globalActive = getGlobalActiveBots();
  const availableSlots = config.maxGlobalSlots - globalActive;

  return new EmbedBuilder()
    .setColor('#1f8b4c')
    .setTitle('🤖 Minecraft AFK Bot Control Panel')
    .setDescription('Manage your Minecraft AFK bots directly from Discord')
    .addFields(
      {
        name: '📊 System Status',
        value: `✅ Backend: Online\n🤖 Active Bots: ${globalActive}/${config.maxGlobalSlots}\n📌 Available Slots: ${availableSlots}`,
        inline: true
      },
      {
        name: '⚙️ Features',
        value: `✅ Anti-AFK Enabled\n✅ Auto Reconnect\n✅ Role-Based System`,
        inline: true
      },
      {
        name: '📋 Role Slot System',
        value: Object.entries(config.roles)
          .map(([, role]) => `• **${role.name}**: ${role.slots === Infinity ? 'Unlimited' : role.slots} slot${role.slots !== 1 ? 's' : ''}`)
          .join('\n'),
        inline: false
      }
    )
    .setFooter({
      text: 'Click buttons below to manage your bots',
      iconURL: 'https://www.minecraft.net/favicon.ico'
    })
    .setTimestamp();
}

/**
 * Create user panel embed
 */
function createUserPanelEmbed(userId, member) {
  const userData = getUserData(userId);
  const slotLimit = getUserSlotLimit(member);
  const activeBotCount = getUserActiveBots(userId);

  let botList = '```No bots registered```';
  if (userData.bots.length > 0) {
    botList = userData.bots.map((bot, idx) => {
      const status = bot.running ? '🟢' : '🔴';
      return `${idx + 1}. ${status} ${bot.username} @ ${bot.host}:${bot.port}`;
    }).join('\n');
  }

  return new EmbedBuilder()
    .setColor('#1f8b4c')
    .setTitle(`🤖 ${member.user.username}'s Bot Panel`)
    .addFields(
      {
        name: '📊 Slot Usage',
        value: `${activeBotCount}/${slotLimit === Infinity ? '∞' : slotLimit} slots used`,
        inline: true
      },
      {
        name: '🤖 Total Bots',
        value: userData.bots.length.toString(),
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

// ===== BUTTON HANDLERS =====

/**
 * Register user for bot panel
 */
async function handleRegister(interaction) {
  const userId = interaction.user.id;
  const userData = getUserData(userId);

  if (userData.bots.length > 0) {
    return interaction.reply({
      content: '✅ You are already registered!',
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

/**
 * Show start bot modal
 */
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
        .setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('server_host')
        .setLabel('Server Host')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder(config.minecraft.defaultHost)
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

/**
 * Start bot from modal submission
 */
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
      content: '❌ Username must be 3-16 characters',
      ephemeral: true
    });
  }

  if (isNaN(serverPort) || serverPort < 1 || serverPort > 65535) {
    return interaction.reply({
      content: '❌ Port must be between 1-65535',
      ephemeral: true
    });
  }

  // Check for duplicate bot
  if (userData.bots.some(b => b.username === botUsername && b.host === serverHost)) {
    return interaction.reply({
      content: '❌ You already have a bot with this username on this server',
      ephemeral: true
    });
  }

  // Check slot limit
  const slotLimit = getUserSlotLimit(member);
  const activeBotCount = getUserActiveBots(userId);

  if (slotLimit !== Infinity && activeBotCount >= slotLimit) {
    return interaction.reply({
      content: `❌ You have reached your slot limit (${activeBotCount}/${slotLimit})`,
      ephemeral: true
    });
  }

  // Check global slots
  const globalActive = getGlobalActiveBots();
  if (globalActive >= config.maxGlobalSlots) {
    return interaction.reply({
      content: `❌ Server is full! (${globalActive}/${config.maxGlobalSlots} bots running)`,
      ephemeral: true
    });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    // Create mineflayer bot
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

    // Start the bot
    await botInstance.start();

    // Store bot instance
    if (!activeBots.has(userId)) {
      activeBots.set(userId, []);
    }
    activeBots.get(userId).push(botInstance);

    // Store in database
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

    // Update panel
    const embed = createUserPanelEmbed(userId, member);
    const row = createUserButtons(userId);

    return interaction.editReply({
      content: `✅ Bot **${botUsername}** started successfully!`,
      embeds: [embed],
      components: [row]
    });

  } catch (err) {
    console.error('[BOT] Start error:', err);
    return interaction.editReply({
      content: `❌ Failed to start bot: ${err.message}`
    });
  }
}

/**
 * Stop specific bot
 */
async function handleStopBot(interaction, botIndex) {
  const userId = interaction.user.id;
  const userData = getUserData(userId);
  const member = await interaction.guild.members.fetch(userId);

  if (!userData.bots[botIndex]) {
    return interaction.reply({
      content: '❌ Bot not found',
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
      content: `✅ Bot **${botName}** stopped!`,
      embeds: [embed],
      components: [row]
    });

  } catch (err) {
    console.error('[BOT] Stop error:', err);
    return interaction.editReply({
      content: `❌ Failed to stop bot: ${err.message}`
    });
  }
}

/**
 * Restart specific bot
 */
async function handleRestartBot(interaction, botIndex) {
  const userId = interaction.user.id;
  const userData = getUserData(userId);
  const member = await interaction.guild.members.fetch(userId);

  if (!userData.bots[botIndex]) {
    return interaction.reply({
      content: '❌ Bot not found',
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

    const embed = createUserPanelEmbed(userId, member);
    const row = createUserButtons(userId);

    return interaction.editReply({
      content: `✅ Bot **${botName}** restarted!`,
      embeds: [embed],
      components: [row]
    });

  } catch (err) {
    console.error('[BOT] Restart error:', err);
    return interaction.editReply({
      content: `❌ Failed to restart bot: ${err.message}`
    });
  }
}

/**
 * Show status for specific bot
 */
async function handleBotStatus(interaction, botIndex) {
  const userId = interaction.user.id;
  const userData = getUserData(userId);

  if (!userData.bots[botIndex]) {
    return interaction.reply({
      content: '❌ Bot not found',
      ephemeral: true
    });
  }

  const bot = userData.bots[botIndex];
  const userBots = activeBots.get(userId) || [];
  const botInstance = userBots[botIndex];

  let statusEmbed = new EmbedBuilder()
    .setColor(botInstance && botInstance.getStatus().running ? '#00ff00' : '#ff0000')
    .setTitle(`📊 Bot Status: ${bot.username}`)
    .addFields(
      {
        name: 'Status',
        value: botInstance && botInstance.getStatus().running ? '🟢 Online' : '🔴 Offline',
        inline: true
      },
      {
        name: 'Username',
        value: bot.username,
        inline: true
      },
      {
        name: 'Server',
        value: `${bot.host}:${bot.port}`,
        inline: true
      },
      {
        name: 'Started',
        value: new Date(bot.startedAt).toLocaleString(),
        inline: true
      }
    );

  if (botInstance) {
    const status = botInstance.getStatus();
    statusEmbed.addFields(
      {
        name: 'Reconnect Count',
        value: status.reconnectCount.toString(),
        inline: true
      },
      {
        name: 'Anti-AFK',
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

/**
 * Delete specific bot
 */
async function handleDeleteBot(interaction, botIndex) {
  const userId = interaction.user.id;
  const userData = getUserData(userId);
  const member = await interaction.guild.members.fetch(userId);

  if (!userData.bots[botIndex]) {
    return interaction.reply({
      content: '❌ Bot not found',
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
    content: `⚠️ Are you sure you want to delete **${botName}**? This action cannot be undone.`,
    components: [confirmRow],
    ephemeral: true
  });
}

/**
 * Confirm deletion
 */
async function handleConfirmDelete(interaction, botIndex) {
  const userId = interaction.user.id;
  const userData = getUserData(userId);
  const member = await interaction.guild.members.fetch(userId);

  if (!userData.bots[botIndex]) {
    return interaction.reply({
      content: '❌ Bot not found',
      ephemeral: true
    });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const botName = userData.bots[botIndex].username;
    
    // Stop bot if running
    const userBots = activeBots.get(userId) || [];
    if (userBots[botIndex]) {
      await userBots[botIndex].stop();
      userBots.splice(botIndex, 1);
    }

    // Remove from database
    userData.bots.splice(botIndex, 1);
    saveDB(db);

    const embed = createUserPanelEmbed(userId, member);
    const row = createUserButtons(userId);

    return interaction.editReply({
      content: `✅ Bot **${botName}** deleted successfully!`,
      embeds: [embed],
      components: [row]
    });

  } catch (err) {
    console.error('[BOT] Delete error:', err);
    return interaction.editReply({
      content: `❌ Failed to delete bot: ${err.message}`
    });
  }
}

// ===== BUTTON ROW BUILDERS =====

/**
 * Create main panel buttons
 */
function createMainPanelButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('register')
      .setLabel('Register')
      .setStyle(ButtonStyle.Success)
      .setEmoji('📋'),
    new ButtonBuilder()
      .setCustomId('my_panel')
      .setLabel('My Panel')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🎮'),
    new ButtonBuilder()
      .setCustomId('info')
      .setLabel('Info')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('ℹ️')
  );
}

/**
 * Create user panel buttons
 */
function createUserButtons(userId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`startbot_modal_${userId}`)
      .setLabel('Start Bot')
      .setStyle(ButtonStyle.Success)
      .setEmoji('▶️'),
    new ButtonBuilder()
      .setCustomId(`my_bots_${userId}`)
      .setLabel('My Bots')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('📋'),
    new ButtonBuilder()
      .setCustomId(`back_${userId}`)
      .setLabel('Back')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('⬅️')
  );
}

// ===== CLIENT EVENTS =====

client.once('ready', async () => {
  console.log(`[READY] ${client.user.tag} is online!`);
  client.user.setActivity('🤖 Minecraft AFK Bots', { type: 'WATCHING' });

  // Register slash commands
  const commands = [
    new SlashCommandBuilder()
      .setName('panel')
      .setDescription('📋 Show the Minecraft AFK Bot control panel')
  ];

  const rest = new REST({ version: '10' }).setToken(config.token);

  try {
    console.log('[COMMANDS] Registering slash commands...');
    await rest.put(
      Routes.applicationGuildCommands(client.user.id, config.guildId),
      { body: commands.map(cmd => cmd.toJSON()) }
    );
    console.log('[COMMANDS] Slash commands registered!');
  } catch (err) {
    console.error('[COMMANDS] Failed to register:', err);
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

      // Main panel buttons
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

      // Start bot modal
      else if (customId.startsWith('startbot_modal_')) {
        await handleStartBotModal(interaction);
      }

      // My bots list
      else if (customId.startsWith('my_bots_')) {
        const userData = getUserData(userId);
        if (userData.bots.length === 0) {
          return interaction.reply({
            content: '❌ You have no bots. Click **Start Bot** to create one!',
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
          .setColor('#1f8b4c')
          .setTitle(`📋 Your Bots (${userData.bots.length})`)
          .setDescription(userData.bots.map((b, i) => `${i + 1}. **${b.username}** @ ${b.host}:${b.port}`).join('\n'));

        return interaction.reply({
          embeds: [embed],
          components: botRows,
          ephemeral: true
        });
      }

      // Bot control buttons
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
          content: '✅ Deletion cancelled',
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

    // Modal submissions
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
          content: `❌ An error occurred: ${err.message}`
        });
      } else {
        await interaction.reply({
          content: `❌ An error occurred: ${err.message}`,
          ephemeral: true
        });
      }
    } catch (replyErr) {
      console.error('[ERROR] Failed to send error message:', replyErr);
    }
  }
});

// ===== LOGIN =====
client.login(config.token);
