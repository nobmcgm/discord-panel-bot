const mineflayer = require('mineflayer');

/**
 * Creates and manages a Minecraft AFK bot instance
 * @param {Object} options - Bot configuration
 * @param {string} options.host - Server host
 * @param {number} options.port - Server port
 * @param {string} options.username - Bot username
 * @param {string} options.version - Minecraft version
 * @param {Object} options.antiAfk - Anti-AFK settings
 * @param {Function} options.onReconnect - Callback for reconnection
 * @returns {Object} Bot instance with control methods
 */
function createMineflayerBot(options) {
  const {
    host,
    port,
    username,
    version,
    antiAfk = {},
    onReconnect = () => {}
  } = options;

  let botInstance = null;
  let antiAFKInterval = null;
  let reconnectCount = 0;
  let isManualStop = false;

  const defaultAntiAfk = {
    enabled: true,
    interval: 30000,
    jumpDuration: 500,
    maxReconnectAttempts: 5,
    reconnectDelay: 10000
  };

  const settings = { ...defaultAntiAfk, ...antiAfk };

  function startBot() {
    return new Promise((resolve, reject) => {
      try {
        console.log(`[MINEFLAYER] Creating bot: ${username} on ${host}:${port}`);

        botInstance = mineflayer.createBot({
          host: host,
          port: port,
          username: username,
          auth: 'offline',
          version: version,
          hideErrors: false,
          validateChannelCache: false
        });

        // Login event
        botInstance.on('login', () => {
          console.log(`[MINEFLAYER] ${username} logged in`);
          reconnectCount = 0;
        });

        // Spawn event
        botInstance.on('spawn', () => {
          console.log(`[MINEFLAYER] ${username} spawned`);

          // Start anti-AFK if enabled
          if (settings.enabled && !antiAFKInterval) {
            startAntiAFK();
          }

          resolve({ success: true, instance: botInstance });
        });

        // Chat message handler
        botInstance.on('messagestr', (message) => {
          console.log(`[MINEFLAYER] ${username}: ${message}`);
        });

        // Kicked event
        botInstance.on('kicked', (reason) => {
          console.log(`[MINEFLAYER] ${username} kicked: ${reason}`);
          if (!isManualStop) {
            attemptReconnect();
          }
        });

        // Error handler
        botInstance.on('error', (err) => {
          console.error(`[MINEFLAYER] ${username} error: ${err.message}`);
          if (!isManualStop) {
            attemptReconnect();
          }
        });

        // End event
        botInstance.on('end', () => {
          console.log(`[MINEFLAYER] ${username} disconnected`);
          stopAntiAFK();
          
          if (!isManualStop) {
            attemptReconnect();
          }
        });

        // Timeout for spawn
        setTimeout(() => {
          if (botInstance && !botInstance.player) {
            reject(new Error('Bot spawn timeout'));
          }
        }, 30000);

      } catch (err) {
        reject(err);
      }
    });
  }

  function startAntiAFK() {
    stopAntiAFK(); // Clear any existing interval
    
    antiAFKInterval = setInterval(() => {
      if (botInstance && botInstance.player) {
        botInstance.setControlState('jump', true);
        
        setTimeout(() => {
          if (botInstance) {
            botInstance.setControlState('jump', false);
          }
        }, settings.jumpDuration);
      }
    }, settings.interval);

    console.log(`[MINEFLAYER] Anti-AFK started for ${username}`);
  }

  function stopAntiAFK() {
    if (antiAFKInterval) {
      clearInterval(antiAFKInterval);
      antiAFKInterval = null;
      console.log(`[MINEFLAYER] Anti-AFK stopped for ${username}`);
    }
  }

  function attemptReconnect() {
    if (reconnectCount >= settings.maxReconnectAttempts) {
      console.log(`[MINEFLAYER] Max reconnect attempts reached for ${username}`);
      return;
    }

    reconnectCount++;
    console.log(`[MINEFLAYER] Reconnecting ${username} (attempt ${reconnectCount}/${settings.maxReconnectAttempts})...`);

    setTimeout(() => {
      isManualStop = false;
      startBot().catch(err => {
        console.error(`[MINEFLAYER] Reconnect failed: ${err.message}`);
      });
    }, settings.reconnectDelay);

    onReconnect({
      username,
      reconnectCount,
      timestamp: new Date()
    });
  }

  function stopBot() {
    return new Promise((resolve) => {
      isManualStop = true;
      stopAntiAFK();
      
      if (botInstance) {
        botInstance.quit();
        botInstance = null;
        console.log(`[MINEFLAYER] ${username} stopped`);
        resolve({ success: true });
      } else {
        resolve({ success: true });
      }
    });
  }

  function restartBot() {
    return stopBot().then(() => {
      isManualStop = false;
      return startBot();
    });
  }

  function getStatus() {
    return {
      running: botInstance !== null && botInstance.player !== null,
      username: username,
      host: host,
      port: port,
      version: version,
      reconnectCount: reconnectCount,
      antiAFKEnabled: settings.enabled
    };
  }

  return {
    start: startBot,
    stop: stopBot,
    restart: restartBot,
    getStatus: getStatus,
    getInstance: () => botInstance
  };
}

module.exports = { createMineflayerBot };
