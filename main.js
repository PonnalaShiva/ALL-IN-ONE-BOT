process.env.DOTENV_CONFIG_QUIET = 'true';
const { Client, GatewayIntentBits, Collection, REST, Routes, Partials, Options } = require('discord.js');
require('dotenv').config();
require('./utils/mediaPatch');
const axios = require('axios');
const config = require('./config.js');
const colors = require('./UI/colors/colors');
const loadLogHandlers = require('./logHandlers');
const scanCommands = require('./utils/scanCommands');
const logger = require('./utils/logger');

const { buildCard, sendV2 } = require('./UI');
const { normalizeBackendCommandPayload } = require('./utils/backendCommandPayload');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildModeration, 
        GatewayIntentBits.GuildExpressions, 
        GatewayIntentBits.GuildIntegrations, 
        GatewayIntentBits.GuildWebhooks, 
        GatewayIntentBits.GuildPresences, 
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions, 
        GatewayIntentBits.GuildVoiceStates, 
        GatewayIntentBits.MessageContent 
    ],
    partials: [Partials.Channel, Partials.Message, Partials.Reaction],
    makeCache: Options.cacheWithLimits({
        ...Options.DefaultMakeCacheSettings,
        MessageManager: 50,
    }),
    sweepers: {
        ...Options.DefaultSweeperSettings,
        messages: { interval: 300, lifetime: 1800 },
        users: { interval: 3600, filter: () => user => user.bot && user.id !== user.client.user.id },
    },
});

client.commands = new Collection();
require('events').defaultMaxListeners = 100;


const loaders = require('./loaders');


loaders.loadGatewayEvents(client);
loaders.loadSystemHandlers(client);


const VALIDATOR_URL = (process.env.VALIDATOR_URL || process.env.BACKEND || 'https://aio.fluenosity.com').replace(/\/+$/, '');

async function fetchExpectedCommandsCount() {
    try {
        const axios = require('axios');
        const response = await axios.get(`${VALIDATOR_URL}/api/expected-commands-count`, { timeout: 3000 });
        return response.data?.expectedCommandsCount ?? -1;
    } catch (_) {
        return -1; 
    }
}

async function verifyCommandsCount() {
    const expectedCommandsCount = await fetchExpectedCommandsCount();
    const registeredCommandsCount = await scanCommands(config);

    if (expectedCommandsCount === -1) {
        logger.setStatus('commands', `● ${registeredCommandsCount} Loaded (100 Local Slash)`);
        logger.setStatus('security', '● Protected (Anti-Spam/Link/Nuke/Raid)');
        return;
    }

    if (registeredCommandsCount !== expectedCommandsCount) {
        logger.warn('COMMANDS', `Command mismatch: registered=${registeredCommandsCount}, expected=${expectedCommandsCount}`);
        logger.setStatus('commands', `${registeredCommandsCount} Loaded (Mismatch: expected ${expectedCommandsCount})`);
    } else {
        logger.setStatus('commands', `● ${registeredCommandsCount} Loaded (100 Local Slash)`);
        logger.setStatus('security', '● Protected (Anti-Spam/Link/Nuke/Raid)');
        logger.success('COMMANDS', `Command integrity verified: ${registeredCommandsCount} commands active.`);
    }
}
const fetchAndRegisterCommands = async () => {
    try {
        const axios = require('axios');
        const response = await axios.get(`${VALIDATOR_URL}/api/commands`, { timeout: 3000 });
        const normalized = normalizeBackendCommandPayload(response.data);
        for (const { name, embed: safeEmbed } of normalized.commands) {
            const fields = safeEmbed.fields;
            client.commands.set(name, {
                name,
                source: 'shiva',
                embed: safeEmbed,
                execute: async (interaction) => {
                    try {
                        const sections = [];
                        if (safeEmbed.description) sections.push(safeEmbed.description);
                        if (fields.length) {
                            sections.push(fields.map(f => `**${f.name}**\n${f.value}`).join('\n\n'));
                        }
                        const card = buildCard({
                            title: safeEmbed.title || null,
                            sections: sections.length ? sections : ['\u200b'],
                            bannerURL: safeEmbed.image || null,
                            accentColor: safeEmbed.color || null,
                            _footer: safeEmbed.footer.text || null
                        });

                        await sendV2(interaction, card);
                    } catch (error) {
                        await sendV2(interaction, buildCard({ sections: ['This command could not be displayed.'], accentColor: '#dc2626' })).catch(() => { });
                    }
                }
            });
        }
    } catch (_) {
        
    }
};

client.once('clientReady', async () => {
    logger.setStatus('bot', `${client.user.tag} (${client.user.id})`);
    logger.info('GATEWAY', `Connected to Discord Gateway as ${client.user.tag} (${client.user.id})`);

    let hasFailure = false;
    try {
        
        await loaders.loadPostReady(client);
        await verifyCommandsCount();
        await fetchAndRegisterCommands();
        await loaders.loadCommands(client, config, colors);
    } catch (error) {
        hasFailure = true;
        console.error(`${colors.red}[ ERROR ]${colors.reset} ${colors.red}${error}${colors.reset}`);
    } finally {
        if (!hasFailure) {
            client.isFullyReady = true;
            client.emit('fullyReady');
        } else {
            client.isFullyReady = false;
            client.isDegraded = true;
            client.emit('fullyReadyDegraded');
        }
    }
});

const botToken = process.env.TOKEN || config.token;
let commandValidationFailure = null;
try {
    require('./handlers/commands').validateLocalCommands(config);
    
} catch (error) {
    commandValidationFailure = error;
    console.error('[COMMANDS] Startup validation failed:', error.message);
}
client.startupFailure = commandValidationFailure;
const requiredLoaderFailure = Object.entries(loaders.getLoaderHealth())
    .filter(([name, group]) => name !== 'postReady' && group.status === 'failed');
if (commandValidationFailure) {
    console.error('[STARTUP] Local command validation failed. Discord login skipped.');
} else if (requiredLoaderFailure.length) {
    console.error(`[STARTUP] Required loader groups failed: ${requiredLoaderFailure.map(([name]) => name).join(', ')}. Discord login skipped.`);
} else if (botToken && botToken.trim()) {
    client.login(botToken).catch(err => {
        console.error(`${colors.red}[ LOGIN ERROR ]${colors.reset} Failed to login: ${err.message}`);
        client.emit('loginFailed', err);
    });
} else {
    console.warn(`${colors.yellow}[ WARNING ]${colors.reset} No Discord bot token provided in .env or config.js.`);
}

module.exports = client;
