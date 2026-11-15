const cacheManager = require('./cacheManager');
const ServerConfig = require('../models/serverConfig/schema');
const CountingConfig = require('../models/counting/Schema');
const StickyMessage = require('../models/stickymessage/Schema');
const AutoResponderModel = require('../models/autoresponses/schema');
const AntiConfig = require('../models/antiSystem/AntiConfig');
const HentaiConfig = require('../models/hentai/hentaiSchema');
const DisabledCommand = require('../models/commands/DisabledCommands');
const CACHE_VERBOSE = process.env.CACHE_VERBOSE === 'true';

function cacheLog(message) {
    if (CACHE_VERBOSE) {
        console.log(message);
    }
}


function initializeCacheTypes() {
    
    cacheManager.createCache('serverConfig', {
        ttl: 5 * 60 * 1000, 
        maxSize: 5000,
        enableLRU: true
    });

    
    cacheManager.createCache('countingConfig', {
        ttl: 10 * 60 * 1000, 
        maxSize: 2000,
        enableLRU: true
    });

    
    cacheManager.createCache('stickyMessage', {
        ttl: 5 * 60 * 1000, 
        maxSize: 2000,
        enableLRU: true
    });

    
    cacheManager.createCache('autoResponder', {
        ttl: 10 * 60 * 1000, 
        maxSize: 1000,
        enableLRU: true
    });

    
    cacheManager.createCache('customCommands', {
        ttl: 15 * 60 * 1000, 
        maxSize: 2000,
        enableLRU: true
    });

    
    cacheManager.createCache('antiConfig', {
        ttl: 5 * 60 * 1000, 
        maxSize: 5000,
        enableLRU: true
    });

    
    cacheManager.createCache('hentaiConfig', {
        ttl: 10 * 60 * 1000, 
        maxSize: 2000,
        enableLRU: true
    });

    
    cacheManager.createCache('disabledCommands', {
        ttl: 5 * 60 * 1000, 
        maxSize: 2000,
        enableLRU: true
    });

    
    cacheManager.createCache('threatScore', {
        ttl: 2 * 60 * 1000, 
        maxSize: 10000,
        enableLRU: true
    });

    
    cacheManager.createCache('faqConfig', {
        ttl: 5 * 60 * 1000, 
        maxSize: 2000,
        enableLRU: true
    });

    
    cacheManager.createCache('userCustomCommands', {
        ttl: 10 * 60 * 1000, 
        maxSize: 5000,
        enableLRU: true
    });

    
    cacheManager.createCache('levelingConfig', {
        ttl: 10 * 60 * 1000, 
        maxSize: 2000,
        enableLRU: true
    });

    
    cacheManager.createCache('modMailConfig', {
        ttl: 5 * 60 * 1000, 
        maxSize: 2000,
        enableLRU: true
    });

    
    cacheManager.createCache('reactionRole', {
        ttl: 5 * 60 * 1000, 
        maxSize: 3000,
        enableLRU: true
    });

    
    cacheManager.createCache('embed', {
        ttl: 10 * 60 * 1000, 
        maxSize: 2000,
        enableLRU: true
    });

    
    cacheManager.createCache('boostSettings', {
        ttl: 15 * 60 * 1000, 
        maxSize: 1000,
        enableLRU: true
    });

    
    cacheManager.createCache('birthdaySettings', {
        ttl: 15 * 60 * 1000, 
        maxSize: 1000,
        enableLRU: true
    });

    
    cacheManager.createCache('reportSettings', {
        ttl: 5 * 60 * 1000, 
        maxSize: 2000,
        enableLRU: true
    });

    
    cacheManager.createCache('userProfile', {
        ttl: 10 * 60 * 1000, 
        maxSize: 5000,
        enableLRU: true
    });

    
    cacheManager.createCache('applications', {
        ttl: 5 * 60 * 1000, 
        maxSize: 2000,
        enableLRU: true
    });

    
    cacheManager.createCache('roleNickConfig', {
        ttl: 5 * 60 * 1000, 
        maxSize: 2000,
        enableLRU: true
    });

    
    cacheManager.createCache('ticketConfig', {
        ttl: 5 * 60 * 1000, 
        maxSize: 2000,
        enableLRU: true
    });

    
    cacheManager.createCache('ticketUserData', {
        ttl: 2 * 60 * 1000, 
        maxSize: 5000,
        enableLRU: true
    });

    
    cacheManager.createCache('aiChatConfig', {
        ttl: 5 * 60 * 1000, 
        maxSize: 2000,
        enableLRU: true
    });

    
    cacheManager.createCache('nqnConfig', {
        ttl: 5 * 60 * 1000, 
        maxSize: 2000,
        enableLRU: true
    });

    
    cacheManager.createCache('voiceChannelConfig', {
        ttl: 5 * 60 * 1000, 
        maxSize: 2000,
        enableLRU: true
    });

    
    cacheManager.createCache('nicknameConfig', {
        ttl: 5 * 60 * 1000, 
        maxSize: 2000,
        enableLRU: true
    });

    
    cacheManager.createCache('autoroleConfig', {
        ttl: 5 * 60 * 1000, 
        maxSize: 2000,
        enableLRU: true
    });

    
    cacheManager.createCache('inviteSettings', {
        ttl: 5 * 60 * 1000, 
        maxSize: 2000,
        enableLRU: true
    });

    
    cacheManager.createCache('giveaway', {
        ttl: 2 * 60 * 1000, 
        maxSize: 1000,
        enableLRU: true
    });

    
    cacheManager.createCache('logConfig', {
        ttl: 5 * 60 * 1000, 
        maxSize: 3000,
        enableLRU: true
    });

    
    cacheManager.createCache('commandLogConfig', {
        ttl: 5 * 60 * 1000,
        maxSize: 3000,
        enableLRU: true
    });

    
    cacheManager.createCache('welcomeSettings', {
        ttl: 5 * 60 * 1000, 
        maxSize: 2000,
        enableLRU: true
    });

    
    cacheManager.createCache('verificationConfig', {
        ttl: 5 * 60 * 1000, 
        maxSize: 2000,
        enableLRU: true
    });

    
    cacheManager.createCache('truthOrDareConfig', {
        ttl: 5 * 60 * 1000, 
        maxSize: 2000,
        enableLRU: true
    });

    
    cacheManager.createCache('suggestionConfig', {
        ttl: 5 * 60 * 1000, 
        maxSize: 2000,
        enableLRU: true
    });

    
    cacheManager.createCache('afkStatus', {
        ttl: 2 * 60 * 1000, 
        maxSize: 5000,
        enableLRU: true
    });

    cacheLog('[CACHE] ✅ All cache types initialized');
}

async function warmupCache(client) {
    cacheLog('\n' + '─'.repeat(60));
    cacheLog('🔥 CACHE WARMUP STARTING...');
    cacheLog('─'.repeat(60));

    const startTime = Date.now();
    let loadedCount = 0;

    try {
        
        const guildIds = Array.from(client.guilds.cache.keys());
        cacheLog(`[CACHE] Warming up cache for ${guildIds.length} guilds...`);

        
        const serverConfigs = await ServerConfig.find({
            serverId: { $in: guildIds }
        }).limit(1000); 

        for (const config of serverConfigs) {
            cacheManager.set('serverConfig', config.serverId, config);
            loadedCount++;
        }
        cacheLog(`[CACHE] ✅ Loaded ${serverConfigs.length} server configs`);

        
        const countingConfigs = await CountingConfig.find({
            serverId: { $in: guildIds },
            status: true
        }).limit(500);

        for (const config of countingConfigs) {
            const key = `${config.serverId}_${config.channelId}`;
            cacheManager.set('countingConfig', key, config);
            loadedCount++;
        }
        cacheLog(`[CACHE] ✅ Loaded ${countingConfigs.length} counting configs`);

        
        const stickyMessages = await StickyMessage.find({
            serverId: { $in: guildIds },
            active: true
        }).limit(500);

        for (const message of stickyMessages) {
            const key = `${message.serverId}_${message.channelId}`;
            cacheManager.set('stickyMessage', key, message);
            loadedCount++;
        }
        cacheLog(`[CACHE] ✅ Loaded ${stickyMessages.length} sticky messages`);

        
        const autoResponders = await AutoResponderModel.find({
            guildId: { $in: guildIds },
            status: true
        }).limit(500);

        
        const respondersByGuild = {};
        for (const responder of autoResponders) {
            if (!respondersByGuild[responder.guildId]) {
                respondersByGuild[responder.guildId] = [];
            }
            respondersByGuild[responder.guildId].push(responder);
        }

        for (const [guildId, responders] of Object.entries(respondersByGuild)) {
            cacheManager.set('autoResponder', guildId, responders);
            loadedCount++;
        }
        cacheLog(`[CACHE] ✅ Loaded auto responders for ${Object.keys(respondersByGuild).length} guilds`);

        
        const antiConfigs = await AntiConfig.find({
            guildId: { $in: guildIds }
        }).limit(1000);

        for (const config of antiConfigs) {
            cacheManager.set('antiConfig', config.guildId, config);
            loadedCount++;
        }
        cacheLog(`[CACHE] ✅ Loaded ${antiConfigs.length} anti configs`);

        
        const hentaiConfigs = await HentaiConfig.find({
            serverId: { $in: guildIds }
        }).limit(500);

        for (const config of hentaiConfigs) {
            cacheManager.set('hentaiConfig', config.serverId, config);
            loadedCount++;
        }
        cacheLog(`[CACHE] ✅ Loaded ${hentaiConfigs.length} hentai configs`);

        
        const disabledCommands = await DisabledCommand.find({
            guildId: { $in: guildIds }
        }).limit(1000);

        const commandsByGuild = {};
        for (const cmd of disabledCommands) {
            if (!commandsByGuild[cmd.guildId]) {
                commandsByGuild[cmd.guildId] = new Set();
            }
            const key = cmd.subcommandName 
                ? `${cmd.commandName}_${cmd.subcommandName}` 
                : cmd.commandName;
            commandsByGuild[cmd.guildId].add(key);
        }

        for (const [guildId, commands] of Object.entries(commandsByGuild)) {
            cacheManager.set('disabledCommands', guildId, Array.from(commands));
            loadedCount++;
        }
        cacheLog(`[CACHE] ✅ Loaded disabled commands for ${Object.keys(commandsByGuild).length} guilds`);

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        cacheManager.warmupStatus = {
            success: true,
            loadedCount,
            durationSeconds: parseFloat(duration),
            guildsCount: guildIds.length,
            completedAt: new Date().toISOString()
        };
        cacheLog('─'.repeat(60));
        cacheLog(`[CACHE] ✅ Warmup complete! Loaded ${loadedCount} cache entries in ${duration}s`);
        cacheLog('─'.repeat(60) + '\n');

    } catch (error) {
        cacheManager.warmupStatus = {
            success: false,
            loadedCount,
            error: error.message,
            completedAt: new Date().toISOString()
        };
        console.error('[CACHE] ❌ Error during cache warmup:', error);
        cacheLog('─'.repeat(60) + '\n');
    }
}

async function initializeCache(client) {
    
    cacheManager.initialize();

    
    initializeCacheTypes();

    
    await warmupCache(client);

    
    cacheManager.printStats();
}


function invalidateGuildCache(guildId) {
    cacheManager.delete('serverConfig', guildId);
    cacheManager.delete('antiConfig', guildId);
    cacheManager.delete('hentaiConfig', guildId);
    cacheManager.delete('disabledCommands', guildId);
    cacheManager.delete('autoResponder', guildId);
}


function invalidateChannelCache(guildId, channelId) {
    cacheManager.delete('countingConfig', `${guildId}_${channelId}`);
    cacheManager.delete('stickyMessage', `${guildId}_${channelId}`);
}

function getWarmupStatus() {
    return cacheManager.warmupStatus || { success: false, pending: true };
}

module.exports = {
    initializeCache,
    invalidateGuildCache,
    invalidateChannelCache,
    getWarmupStatus,
    cacheManager
};

