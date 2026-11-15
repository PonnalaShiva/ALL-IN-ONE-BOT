

const axios = require('axios');
const dotenv = require('dotenv');
const logger = require('../utils/logger');
const colors = require('../UI/colors/colors');
const client = require('../main');
const io = require('socket.io-client');
const guildDataModule = require('./guild/guildData');
const geminiModule = require('./modules/gemini/gemini');
const serverStatsModule = require('./modules/serverstats/serverstats');
const afkModule = require('./modules/afk/afk');
const giveawayModule = require('./modules/giveaway/giveaway');
const { verifyControlPlaneSession } = require('../utils/entitlementService');
const configBus = require('./lib/configBus');
const registerConfigHandlers = require('./lib/registerConfigHandlers');
const { collectBulkSyncPayloads } = require('./lib/bulkSync');
require('./modules/gateVerification/gateVerification').setClient(client);


dotenv.config();
if (process.env.BOT_ENV !== 'production' && process.env.NODE_ENV !== 'production') {
    dotenv.config({ path: '.env.local', override: true });
}

const config = require('../config.js');

function isDashboardEnabled() {
    if (typeof config.dashboard === 'boolean') return config.dashboard;
    if (typeof config.dashboard?.enabled === 'boolean') return config.dashboard.enabled;
    if (typeof config.dashboard?.connection === 'boolean') return config.dashboard.connection;
    if (process.env.DASHBOARD_ENABLED !== undefined) return process.env.DASHBOARD_ENABLED === 'true';
    return true;
}
const API_BASE_URL = (process.env.API_BASE_URL || 'https://allinone.fluenosity.com').replace(/\/+$/, '');
const BOT_API = process.env.BOT_API;
const DISCORD_USER_ID = process.env.DISCORD_USER_ID;
const HEARTBEAT_INTERVAL_MS = 30000;
const AFK_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const GIVEAWAY_CHECK_INTERVAL_MS = 5 * 60 * 1000;

let serverOnline = true;
let socket = null;
let isSocketConnected = false;
let heartbeatInterval = null;
let startupTimeout = null;
let dashboardStopping = false;
const maintenanceIntervals = [];
const clientListeners = new Map();

function connectWebSocket() {
    if (!isDashboardEnabled()) return;
    if (socket) socket.disconnect();

    socket = io(API_BASE_URL, {
        transports: ['websocket'],
        timeout: 20000,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        maxReconnectionAttempts: 5
    });

    configBus.attach(socket);
    registerConfigHandlers(() => socket);

    socket.on('connect', async () => {
        console.log('\n' + '─'.repeat(50));
        console.log(`${colors.green}${colors.bright}🔗 WEBSOCKET CONNECTED${colors.reset}`);
        console.log('─'.repeat(50));
        isSocketConnected = true;
        await authenticateBot();
    });

    socket.on('disconnect', () => {
        console.log(`${colors.red}📡 WebSocket disconnected${colors.reset}`);
        isSocketConnected = false;
    });

    socket.on('bot_connected', (data) => {
        if (data.success) {
            console.log(`${colors.cyan}[ BOT ]${colors.reset} ${colors.green}Authenticated with middleware ✅${colors.reset}`);
            startHeartbeat();
            sendInitialData();
        }
    });

    socket.on('bot_auth_failed', (data) => {
        console.warn(`${colors.yellow}⚠️ Bot authentication with dashboard middleware failed: ${data.message}. Dashboard connection disabled.${colors.reset}`);
        isSocketConnected = false;
        socket.disconnect();
    });

    socket.on('get_server_details', async (data) => {
        const { serverId } = data;
        const serverDetails = await guildDataModule.getServerDetails(serverId, configBus.liveEventShim());
        socket.emit('server_details_response', serverDetails);
    });

    socket.on('reconnect', async (attemptNumber) => {
        console.log(`${colors.yellow}🔄 Reconnected to middleware (attempt ${attemptNumber})${colors.reset}`);
        await authenticateBot();
        await sendInitialData();
    });

    socket.on('reconnect_failed', () => {
        console.error(`${colors.red}❌ Failed to reconnect to middleware${colors.reset}`);
    });
}

async function authenticateBot() {
    if (!isSocketConnected || !client.user) return;

    const entitlement = await verifyControlPlaneSession({ force: false, allowGrace: true, reason: 'dashboard_socket', quiet: true });
    if (!entitlement.success) {
        console.warn(`${colors.yellow}⚠️ Entitlement check failed before middleware auth: ${entitlement.message}. Dashboard connection disabled.${colors.reset}`);
        isSocketConnected = false;
        socket.disconnect();
        return;
    }

    socket.emit('bot_connect', { botId: client.user.id, userId: DISCORD_USER_ID, apiKey: BOT_API });
}

function startHeartbeat() {
    if (heartbeatInterval) return;
    heartbeatInterval = setInterval(() => {
        if (!isSocketConnected) return;
        socket.emit('bot:heartbeat', {
            latencyMs: client.ws?.ping ?? null,
            guildCount: client.guilds.cache.size,
            memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024)
        });
    }, HEARTBEAT_INTERVAL_MS);
}

async function sendInitialData() {
    try {
        const guilds = await guildDataModule.getGuildsData();
        socket.emit('bot_data_update', { type: 'servers', payload: guilds });

        await collectBulkSyncPayloads(configBus, guilds);

        for (const guild of guilds) {
            await geminiModule.sendAllGeminiData(configBus.legacySyncShim('gemini'), guild.id);
        }

        console.log(`${colors.green}📊 Sent initial data snapshot to middleware (guilds: ${guilds.length})${colors.reset}`);
    } catch (error) {
        console.error(`${colors.red}❌ Error sending initial data:${colors.reset}`, error);
    }
}

async function checkServerStatus() {
    try {
        const response = await axios.get(`${API_BASE_URL}/server-status`);
        serverOnline = response.data.serverOnline;
        console.log('\n' + '─'.repeat(40));
        console.log(`${colors.magenta}${colors.bright}🔗  API SERVICES${colors.reset}`);
        console.log('─'.repeat(40));
        console.log(serverOnline
            ? `${colors.cyan}[ SERVER ]${colors.reset} ${colors.green}Connected to backend server ✅${colors.reset}`
            : `${colors.yellow}[ SERVER ]${colors.reset} ${colors.red}Server is offline ❌${colors.reset}`);
    } catch {
        serverOnline = false;
    }
}

async function initializeDashboard() {
    if (!isDashboardEnabled()) {
        console.log(`${colors.yellow}[ DASHBOARD ]${colors.reset} Dashboard connection disabled in config.js (dashboard.enabled = false). WebSocket skipped.`);
        return;
    }
    await checkServerStatus();
    if (dashboardStopping) return;
    connectWebSocket();
    await serverStatsModule.initializeServerStatsManager(client);
    if (dashboardStopping) return;

    startupTimeout = setTimeout(async () => {
        startupTimeout = null;
        if (isSocketConnected) await sendInitialData();
    }, 2000);
}

const onClientReady = async () => {
    if (dashboardStopping) return;
    
    await initializeDashboard();
};
client.once('clientReady', onClientReady);

if (client.isReady()) {
    
    initializeDashboard().catch((err) => logger.error('DASHBOARD', 'Error initializing dashboard', err));
}

function relayGuildsSnapshot() {
    if (!isSocketConnected) return;
    guildDataModule.getGuildsData().then((guilds) => {
        socket.emit('bot_data_update', { type: 'servers', payload: guilds });
    });
}

clientListeners.set('guildCreate', relayGuildsSnapshot);
clientListeners.set('guildDelete', relayGuildsSnapshot);

function relayServerDataUpdate(guildId, label, name) {
    if (!isSocketConnected) return;
    console.log(`${colors.cyan}🔄 ${label}: ${name}${colors.reset}`);
    guildDataModule.updateServerData(guildId, configBus.liveEventShim());
}

clientListeners.set('channelCreate', (channel) => channel.guild && relayServerDataUpdate(channel.guild.id, 'Channel created', channel.name));
clientListeners.set('channelDelete', (channel) => channel.guild && relayServerDataUpdate(channel.guild.id, 'Channel deleted', channel.name));
clientListeners.set('channelUpdate', (_old, ch) => ch.guild && relayServerDataUpdate(ch.guild.id, 'Channel updated', ch.name));
clientListeners.set('roleCreate', (role) => relayServerDataUpdate(role.guild.id, 'Role created', role.name));
clientListeners.set('roleDelete', (role) => relayServerDataUpdate(role.guild.id, 'Role deleted', role.name));
clientListeners.set('roleUpdate', (_old, role) => relayServerDataUpdate(role.guild.id, 'Role updated', role.name));
clientListeners.set('guildUpdate', (_old, guild) => relayServerDataUpdate(guild.id, 'Guild updated', guild.name));
for (const [eventName, listener] of clientListeners) client.on(eventName, listener);


maintenanceIntervals.push(setInterval(() => {
    afkModule.cleanupExpiredAFK(configBus.liveEventShim()).catch((err) => console.error('Error in AFK cleanup task:', err));
}, AFK_CLEANUP_INTERVAL_MS));

maintenanceIntervals.push(setInterval(() => {
    giveawayModule.handleExpiredGiveaways(client, configBus.liveEventShim()).catch((err) => console.error('Error in giveaway expiry check task:', err));
}, GIVEAWAY_CHECK_INTERVAL_MS));
maintenanceIntervals.forEach(timer => timer.unref?.());

function stop() {
    dashboardStopping = true;
    client.off('clientReady', onClientReady);
    for (const [eventName, listener] of clientListeners) client.off(eventName, listener);
    clientListeners.clear();
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = null;
    if (startupTimeout) clearTimeout(startupTimeout);
    startupTimeout = null;
    for (const timer of maintenanceIntervals) clearInterval(timer);
    maintenanceIntervals.length = 0;
    if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
        socket = null;
    }
    isSocketConnected = false;
    configBus.stop();
}

module.exports = {
    isServerOnline: () => serverOnline,
    isSocketConnected: () => isSocketConnected,
    getSocket: () => socket,
    stop
};
