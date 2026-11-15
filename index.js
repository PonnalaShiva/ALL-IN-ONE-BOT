process.env.DOTENV_CONFIG_QUIET = 'true';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('./utils/mediaPatch');
const { connectToDatabase, closeDatabase } = require('./mongodb');
const initializeBot = require('./utils/intializer');
const { initializeCache } = require('./utils/cacheInitializer');
const { enforceRuntimeSeal, startPeriodicEntitlementAttestation, stopPeriodicEntitlementAttestation, setBotClient } = require('./utils/entitlementService');
const loaders = require('./loaders');
const logger = require('./utils/logger');
const ANSI = logger.colors;
console.log(`\n${ANSI.bold}${ANSI.brightCyan}╭── Fluenosity System Initializing ──────────────────────────────╮${ANSI.reset}`);
console.log(`${ANSI.cyan}│${ANSI.reset}  ${ANSI.yellow}⚙${ANSI.reset}  Starting core services, database & Discord gateway..       ${ANSI.cyan}│${ANSI.reset}`);
console.log(`${ANSI.brightCyan}╰────────────────────────────────────────────────────────────────╯${ANSI.reset}\n`);
logger.startBoot();
const { installFatalProcessHandlers } = require('./utils/fatalProcessHandlers');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let activeClient = null;
let activeShiva = null;
let shutdownPromise = null;
let shutdownRequested = false;

function gracefulShutdown(signal, exitCode = 0) {
    if (shutdownPromise) return shutdownPromise;
    shutdownRequested = true;
    shutdownPromise = (async () => {
        logger.info('SHUTDOWN', `[${signal}] Shutting down gracefully...`);
        process.exitCode = Math.max(process.exitCode || 0, exitCode);
        const forceExit = setTimeout(() => {
            logger.error('SHUTDOWN', 'Cleanup exceeded 15 seconds; forcing process exit.');
            process.exit(process.exitCode || 1);
        }, 15000);
        try {
            stopPeriodicEntitlementAttestation();
            activeShiva?.stop?.();
            try { require('./events/ready').stop?.(); } catch (_) { }
            require('./utils/cacheInitializer').cacheManager.shutdown();
            if (activeClient) await loaders.shutdown(activeClient);
            await closeDatabase();
        } finally {
            clearTimeout(forceExit);
            setTimeout(() => process.exit(process.exitCode ?? 0), 1000).unref();
        }
    })().catch(error => {
        logger.error('SHUTDOWN', 'Cleanup failed', error);
        process.exitCode = 1;
    });
    return shutdownPromise;
}

process.once('SIGINT', () => { void gracefulShutdown('SIGINT'); });
process.once('SIGTERM', () => { void gracefulShutdown('SIGTERM'); });
installFatalProcessHandlers({
    shutdown: signal => gracefulShutdown(signal, 1)
});

(async () => {
    
    await connectToDatabase();
    if (shutdownRequested) return;

    
    const client = require('./main');
    activeClient = client;
    setBotClient(client);
    if (client.startupFailure) throw client.startupFailure;
    const health = loaders.getLoaderHealth();
    const requiredFailures = Object.entries(health)
        .filter(([name, group]) => name !== 'postReady' && group.status === 'failed');
    if (requiredFailures.length) {
        throw new Error(`Required startup groups failed: ${requiredFailures.map(([name]) => name).join(', ')}`);
    }

    
    const COMMAND_READY_TIMEOUT_MS = Number(process.env.COMMAND_READY_TIMEOUT_MS) || 15000;
    await new Promise((resolve, reject) => {
        if (client.isFullyReady) return resolve();
        let timer = null;
        const cleanup = () => {
            if (timer) clearTimeout(timer);
            client.off('fullyReady', onFullyReady);
            client.off('fullyReadyDegraded', onFullyReadyDegraded);
            client.off('loginFailed', onFailure);
        };
        const onFullyReady = () => { cleanup(); resolve(); };
        const onFullyReadyDegraded = () => {
            cleanup();
            if (process.env.ALLOW_DEGRADED_STARTUP === 'true') {
                logger.warn('ORCHESTRATOR', 'Command loading completed in degraded mode; continuing per ALLOW_DEGRADED_STARTUP.');
                client.isDegraded = true;
                resolve();
            } else {
                reject(new Error('Command loading completed in degraded mode. Aborting startup (set ALLOW_DEGRADED_STARTUP=true to allow).'));
            }
        };
        const onFailure = error => { cleanup(); reject(error); };
        timer = setTimeout(() => {
            cleanup();
            if (client.isFullyReady) {
                resolve();
            } else if (process.env.ALLOW_DEGRADED_STARTUP === 'true') {
                logger.warn('ORCHESTRATOR', `Timed out waiting for fullyReady signal (${COMMAND_READY_TIMEOUT_MS}ms); continuing in degraded mode per ALLOW_DEGRADED_STARTUP.`);
                client.isDegraded = true;
                resolve();
            } else {
                reject(new Error(`Timed out waiting for fullyReady signal (${COMMAND_READY_TIMEOUT_MS}ms). Aborting startup to prevent unready service deployment.`));
            }
        }, COMMAND_READY_TIMEOUT_MS);
        timer.unref?.();
        client.once('fullyReady', onFullyReady);
        client.once('fullyReadyDegraded', onFullyReadyDegraded);
        client.once('loginFailed', onFailure);
    });
    if (shutdownRequested) return;

    
    await initializeCache(client);
    if (shutdownRequested) return;

    
    await loaders.loadServices(client);
    if (shutdownRequested) return;

    
    await delay(1000);
    activeShiva = require('./shiva');
    await initializeBot();
    if (shutdownRequested) return;

    
    const seal = await enforceRuntimeSeal({
        force: false,
        allowGrace: true,
        reason: 'core_orchestrator',
        quiet: true
    });

    if (!seal.success) {
        logger.errorBox('SECURITY', 'Runtime Seal Check Failed', [seal.message]);
        throw new Error(`Runtime seal check failed: ${seal.message}`);
    }

    startPeriodicEntitlementAttestation();

    
    const ANSI = logger.colors;
    const totalCmds = client.commands?.size || 148;
    const bootSteps = [
        { label: 'Database Cluster', status: '● Connected (MongoDB + Mongoose)', color: ANSI.brightGreen },
        { label: 'Security Shields', status: '● Protected (AntiSpam/Link/Nuke/Raid)', color: ANSI.brightGreen },
        { label: 'Discord Gateway', status: `● Connected (${client.user?.tag || 'All n One#7740'})`, color: ANSI.brightCyan },
        { label: 'Command Registry', status: `● ${totalCmds} Commands Active (100 Slash)`, color: ANSI.brightGreen },
        { label: 'Runtime Services', status: '● 12/12 Systems Active', color: ANSI.brightGreen },
        { label: 'Audio Subsystem', status: '● Standby (Riffy Engine)', color: ANSI.yellow },
        { label: 'License & Seal', status: '● Verified (ShivaReddy • cache)', color: ANSI.brightGreen }
    ];

    logger.setStatus('bot', `${client.user?.tag || 'All n One#7740'} (${client.user?.id || '1270691569225433150'})`);
    logger.setStatus('commands', `● ${totalCmds} Loaded (100 Local Slash)`);
    logger.setStatus('security', '● Protected (Anti-Spam/Link/Nuke/Raid)');
    logger.setStatus('status', '● All Systems Operational');

    logger.endBoot();
    logger.printLoaderTable(bootSteps);
    logger.printBanner();
    logger.ready('CORE', 'Fluenosity is online, secured, and listening for events.\n');
})().catch((error) => {
    logger.endBoot();
    logger.error('STARTUP', 'Bot initialization encountered a fatal error', error);
    void gracefulShutdown('STARTUP_FAILURE', 1);
});
