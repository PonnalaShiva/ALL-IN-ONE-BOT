'use strict';

const fs = require('fs');
const path = require('path');
const colors = require('./UI/colors/colors');


let gatewayEventsLoaded = false;
let systemHandlersLoaded = false;
let servicesLoaded = false;
let postReadyLoaded = false;
const loaderHealth = {
    gatewayEvents: { status: 'not_started', loaded: [], failed: [] },
    systemHandlers: { status: 'not_started', loaded: [], failed: [] },
    services: { status: 'not_started', loaded: [], failed: [] },
    postReady: { status: 'not_started', loaded: [], failed: [] },
    commands: { status: 'not_started', loaded: [], failed: [] }
};
const cleanupHandlers = [];
const cleanupNames = new Set();

function trackCleanup(name, result, explicitCleanup) {
    if (cleanupNames.has(name)) return;
    const cleanup = explicitCleanup || result?.stop || result?.shutdown || result?.close;
    if (typeof cleanup !== 'function') return;
    cleanupNames.add(name);
    cleanupHandlers.push({
        name,
        run: () => cleanup.call(result, result)
    });
}

async function shutdown(client) {
    const failures = [];
    for (const handler of cleanupHandlers.splice(0).reverse()) {
        try {
            await handler.run();
        } catch (error) {
            failures.push({ name: handler.name, error: error.message });
            console.error(`[LOADER] Cleanup failed for ${handler.name}:`, error);
        }
    }
    cleanupNames.clear();
    if (client?.commands && typeof client.commands.values === 'function') {
        const seenCommands = new Set();
        for (const command of client.commands.values()) {
            if (!command || seenCommands.has(command)) continue;
            seenCommands.add(command);
            const cleanup = command.stop || command.shutdown;
            if (typeof cleanup !== 'function') continue;
            try {
                await cleanup.call(command);
            } catch (error) {
                failures.push({ name: `Command ${command.data?.name || 'module'} cleanup`, error: error.message });
                console.error(`[LOADER] Command cleanup failed for ${command.data?.name || 'module'}:`, error);
            }
        }
    }
    try {
        require('./UI/sessions').clearAllSessionManagers();
    } catch (error) {
        failures.push({ name: 'UI sessions', error: error.message });
    }
    if (client && typeof client.destroy === 'function') {
        try {
            await client.destroy();
        } catch (error) {
            failures.push({ name: 'Discord client', error: error.message });
        }
    }
    for (const group of Object.values(loaderHealth)) {
        if (group.status === 'ready' || group.status === 'degraded') group.status = 'stopped';
    }
    return { success: failures.length === 0, failures };
}

function getLoaderHealth() {
    return JSON.parse(JSON.stringify(loaderHealth));
}

function loadGatewayEvents(client) {
    if (gatewayEventsLoaded) {
        console.log(`${colors.yellow}[LOADER] Gateway events already loaded; skipping.${colors.reset}`);
        return;
    }

    const eventsPath = path.join(__dirname, 'events');
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
    let loadedCount = 0;
    const loaded = [];
    const failed = [];

    for (const file of eventFiles) {
        try {
            const event = require(path.join(eventsPath, file));

            
            if (!event || typeof event.name !== 'string' || typeof event.execute !== 'function') {
                continue;
            }

            const listener = (...args) => event.execute(...args, client);
            if (event.once) client.once(event.name, listener);
            else client.on(event.name, listener);
            trackCleanup(`Gateway event ${file}`, event, async () => {
                client.off(event.name, listener);
                await event.stop?.();
            });

            loadedCount++;
            loaded.push(file);
        } catch (error) {
            failed.push({ name: file, error: error.message });
            console.error(`${colors.red}[LOADER] Failed to load gateway event ${file}:${colors.reset}`, error);
        }
    }

    const requiredEvents = ['clientReady', 'messageCreate', 'interactionCreate'];
    const missingRequired = requiredEvents.filter(name => !loaded.some(file => {
        try {
            const event = require(path.join(eventsPath, file));
            return event?.name === name;
        } catch {
            return false;
        }
    }));
    const missing = missingRequired.map(name => ({ name, error: 'Required gateway event was not registered.' }));
    loaderHealth.gatewayEvents = {
        status: missing.length ? 'failed' : failed.length ? 'degraded' : 'ready',
        loaded,
        failed: [...failed, ...missing]
    };
    gatewayEventsLoaded = !missing.length;
    
    if (failed.length) console.error(`[LOADER] Gateway event group degraded: ${failed.map(item => item.name).join(', ')}`);
    if (missing.length) console.error(`[LOADER] Required gateway events missing: ${missing.map(item => item.name).join(', ')}; Discord login must remain disabled.`);
}

function loadSystemHandlers(client) {
    if (systemHandlersLoaded) {
        console.log(`${colors.yellow}[LOADER] System handlers already loaded; skipping.${colors.reset}`);
        return;
    }

    const handlers = [
        { name: 'Security Handler', required: true, load: () => require('./handlers/security')(client) },
        { name: 'Applications Handler', required: false, load: () => require('./handlers/applications')(client) },
        { name: 'Report Handler', required: false, load: () => require('./handlers/reportHandler')(client) },
        { name: 'Local Status Server', required: false, load: () => {
            const statusServer = require('./handlers/server');
            statusServer.start();
            statusServer.setClient(client);
            return statusServer;
        }, cleanup: result => result.close?.() },
        { name: 'Economy Scheduler', required: true, load: () => require('./handlers/economyScheduler')(client) },
        { name: 'Embed Scheduler', required: false, load: () => require('./handlers/embedScheduler')(client) },
        { name: 'Embed Builder Modals', required: false, load: () => require('./handlers/embedBuilderModals')(client) },
        { name: 'Giveaway Handler', required: false, load: () => require('./handlers/giveawayHandler')(client) },
        { name: 'Server Stats Handler', required: false, load: () => require('./handlers/serverStatsHandler')(client) },
        { name: 'Boost Handler', required: false, load: () => require('./handlers/boostHandler')(client) },
        { name: 'Reaction Roles', required: false, load: () => new (require('./handlers/reactionRoleHandler'))(client) },
        { name: 'Reaction Role Modals', required: false, load: () => new (require('./handlers/reactionRolemodalHandler'))(client) },
        { name: 'Birthday Handlers', required: false, load: () => new (require('./handlers/birthdayHandlers'))(client) },
    ];

    let successCount = 0;
    const loaded = [];
    const failed = [];
    let requiredFailure = false;
    for (const h of handlers) {
        try {
            const result = h.load();
            trackCleanup(h.name, result, h.cleanup);
            successCount++;
            loaded.push(h.name);
        } catch (err) {
            failed.push({ name: h.name, required: Boolean(h.required), error: err.message });
            if (h.required) requiredFailure = true;
            console.error(`${colors.red}[LOADER] Error loading ${h.name}:${colors.reset}`, err);
        }
    }

    systemHandlersLoaded = true;
    loaderHealth.systemHandlers = { status: requiredFailure ? 'failed' : failed.length ? 'degraded' : 'ready', loaded, failed };
    
    if (failed.length) console.error(`[LOADER] System handler failures: ${failed.map(item => `${item.name}${item.required ? ' (required)' : ''}`).join(', ')}`);
    return getLoaderHealth().systemHandlers;
}

async function loadServices(client) {
    if (servicesLoaded) {
        console.log(`${colors.yellow}[LOADER] Background services already loaded; skipping.${colors.reset}`);
        return;
    }

    const services = [
        { name: 'Ticket Handler', required: false, load: () => require('./handlers/ticketHandler')(client), cleanup: () => require('./handlers/ticketHandler').stop?.(client) },
        { name: 'Voice Channel Handler', required: false, load: () => require('./handlers/voiceChannelHandler')(client) },
        { name: 'Autorole Service', required: false, load: () => require('./handlers/autorole')(client), cleanup: () => require('./handlers/autorole').stop?.(client) },
        { name: 'NQN Emoji Service', required: false, load: () => require('./handlers/nqn')(client) },
        { name: 'AFK System', required: false, load: () => require('./handlers/afkManager')(client) },
        { name: 'Notification Service', required: false, load: () => require('./handlers/notificationHandler').initialize(client), cleanup: () => require('./handlers/notificationHandler').shutdown() },
        { name: 'Music Core', required: false, load: () => require('./handlers/music')(client) },
        { name: 'DisTube Music System', required: false, load: () => require('./handlers/distube')(client) },
        { name: 'Protection Handler', required: true, load: () => require('./handlers/protectionHandler')(client), cleanup: () => require('./handlers/protectionHandler').stop?.(client) },
        { name: 'Role Persistence', required: false, load: () => require('./handlers/rolePersistHandler')(client), cleanup: () => require('./handlers/rolePersistHandler').stop?.(client) },
        { name: 'Boycott Handler', required: false, load: () => require('./handlers/boycottHandler')(client), cleanup: () => require('./handlers/boycottHandler').stop?.(client) },
        { name: 'Temp Mute Handler', required: true, load: () => require('./handlers/tempMuteHandler')(client), cleanup: () => require('./handlers/tempMuteHandler').stop?.(client) },
    ];

    let successCount = 0;
    const loaded = [];
    const failed = [];
    let requiredFailure = false;
    for (const s of services) {
        try {
            const result = await s.load();
            trackCleanup(s.name, result, s.cleanup);
            successCount++;
            loaded.push(s.name);
        } catch (err) {
            failed.push({ name: s.name, required: Boolean(s.required), error: err.message });
            if (s.required) requiredFailure = true;
            console.error(`${colors.red}[LOADER] Error loading service ${s.name}:${colors.reset}`, err);
        }
    }

    servicesLoaded = true;
    loaderHealth.services = { status: requiredFailure ? 'failed' : failed.length ? 'degraded' : 'ready', loaded, failed };
    
    if (failed.length) console.error(`[LOADER] Runtime service failures: ${failed.map(item => `${item.name}${item.required ? ' (required)' : ''}`).join(', ')}`);
    return getLoaderHealth().services;
}

async function loadPostReady(client) {
    if (postReadyLoaded) {
        console.log(`${colors.yellow}[LOADER] Post-ready services already loaded; skipping.${colors.reset}`);
        return;
    }

    const loaded = [];
    const failed = [];
    try {
        const loadLogHandlers = require('./logHandlers');
        trackCleanup('Log handlers', await loadLogHandlers(client));
        loaded.push('Log handlers');
    } catch (err) {
        failed.push({ name: 'Log handlers', required: false, error: err.message });
        console.error(`${colors.red}[LOADER] Failed to load log handlers:${colors.reset}`, err);
    }

    try {
        const ModMailHandler = require('./handlers/modMailHandler');
        trackCleanup('ModMail Handler', new ModMailHandler(client));
        loaded.push('ModMail Handler');
    } catch (err) {
        failed.push({ name: 'ModMail Handler', required: false, error: err.message });
        console.error(`${colors.red}[LOADER] Failed to initialize ModMailHandler:${colors.reset}`, err);
    }

    try {
        const LevelingHandler = require('./handlers/levelingHandler');
        trackCleanup('Leveling Handler', new LevelingHandler(client));
        loaded.push('Leveling Handler');
    } catch (err) {
        failed.push({ name: 'Leveling Handler', required: false, error: err.message });
        console.error(`${colors.red}[LOADER] Failed to initialize LevelingHandler:${colors.reset}`, err);
    }

    postReadyLoaded = true;
    loaderHealth.postReady = { status: failed.length ? 'degraded' : 'ready', loaded, failed };
    
}

async function loadCommands(client, config, colors) {
    const commandsHandler = require('./handlers/commands');
    loaderHealth.commands = { status: 'starting', loaded: [], failed: [] };
    try {
        const result = await commandsHandler(client, config, colors);
        loaderHealth.commands = {
            status: 'ready',
            loaded: [
                `${result.count} local slash commands`,
                result.registered ? 'remote registration synchronized' : 'remote registration failed'
            ],
            failed: []
        };
        return result;
    } catch (error) {
        loaderHealth.commands = { status: 'failed', loaded: [], failed: [{ name: 'Slash command registration', required: true, error: error.message }] };
        throw error;
    }
}

async function loadAll(client, config, colors) {
    loadGatewayEvents(client);
    loadSystemHandlers(client);
    await loadServices(client);
    await loadPostReady(client);
    if (config && colors) {
        await loadCommands(client, config, colors);
    }
}

module.exports = {
    loadGatewayEvents,
    loadSystemHandlers,
    loadServices,
    loadPostReady,
    loadCommands,
    loadAll,
    getLoaderHealth,
    shutdown
};

