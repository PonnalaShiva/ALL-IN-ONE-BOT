


const cacheManager = require('./cacheManager');
const inflightLoads = new Map();
const cacheVersions = new Map();

function versionKey(cacheName, key) {
    return `${cacheName}:${key}`;
}

async function getCached(cacheName, key, loader) {
    const cached = cacheManager.get(cacheName, key);
    if (cached !== null) {
        return cached === false ? null : cached;
    }

    const inflightKey = versionKey(cacheName, key);
    if (inflightLoads.has(inflightKey)) return inflightLoads.get(inflightKey);

    const version = cacheVersions.get(inflightKey) || 0;
    const pending = Promise.resolve().then(loader).then(value => {
        if ((cacheVersions.get(inflightKey) || 0) === version) {
            cacheManager.set(cacheName, key, value == null ? false : value);
        }
        return value == null ? null : value;
    }).finally(() => {
        if (inflightLoads.get(inflightKey) === pending) inflightLoads.delete(inflightKey);
    });
    inflightLoads.set(inflightKey, pending);
    return pending;
}

function invalidateCached(cacheName, key) {
    const inflightKey = versionKey(cacheName, key);
    cacheVersions.set(inflightKey, (cacheVersions.get(inflightKey) || 0) + 1);
    inflightLoads.delete(inflightKey);
    cacheManager.delete(cacheName, key);
}

async function getServerConfig(guildId) {
    return getCached('serverConfig', guildId, () => {
        const ServerConfig = require('../models/serverConfig/schema');
        return ServerConfig.findOne({ serverId: guildId });
    });
}

async function getCountingConfig(guildId, channelId) {
    const key = `${guildId}_${channelId}`;

    return getCached('countingConfig', key, () => {
        const CountingConfig = require('../models/counting/Schema');
        return CountingConfig.findOne({ serverId: guildId, channelId, status: true });
    });
}

async function getStickyMessage(guildId, channelId) {
    const key = `${guildId}_${channelId}`;

    return getCached('stickyMessage', key, () => {
        const StickyMessage = require('../models/stickymessage/Schema');
        return StickyMessage.findOne({ serverId: guildId, channelId, active: true });
    });
}

async function getAutoResponders(guildId) {
    return getCached('autoResponder', guildId, () => {
        const AutoResponderModel = require('../models/autoresponses/schema');
        return AutoResponderModel.find({ guildId, status: true });
    });
}

async function getAntiConfig(guildId) {
    
    const cached = cacheManager.get('antiConfig', guildId);
    if (cached) return cached;

    
    const AntiConfig = require('../models/antiSystem/AntiConfig');
    const config = await AntiConfig.findOne({ guildId: guildId });

    
    if (config) {
        cacheManager.set('antiConfig', guildId, config);
    }

    return config;
}

async function getHentaiConfig(guildId) {
    
    const cached = cacheManager.get('hentaiConfig', guildId);
    if (cached) return cached;

    
    const HentaiConfig = require('../models/hentai/hentaiSchema');
    const config = await HentaiConfig.findOne({ serverId: guildId });

    
    if (config) {
        cacheManager.set('hentaiConfig', guildId, config);
    }

    return config;
}

async function isCommandDisabled(guildId, commandName, subcommandName = null) {
    
    let cached = cacheManager.get('disabledCommands', guildId);

    if (!cached) {
        
        const DisabledCommand = require('../models/commands/DisabledCommands');
        const disabled = await DisabledCommand.find({ guildId: guildId });

        
        cached = disabled.map(cmd => {
            return cmd.subcommandName
                ? `${cmd.commandName}_${cmd.subcommandName}`
                : cmd.commandName;
        });

        
        cacheManager.set('disabledCommands', guildId, cached);
    }

    
    const key = subcommandName ? `${commandName}_${subcommandName}` : commandName;
    return cached.includes(key);
}

function invalidateServerConfig(guildId) {
    invalidateCached('serverConfig', guildId);
}

function invalidateCountingConfig(guildId, channelId) {
    if (channelId) {
        invalidateCached('countingConfig', `${guildId}_${channelId}`);
    } else {
        const cache = cacheManager.caches.get('countingConfig');
        const prefix = `${guildId}_`;
        for (const key of cache?.data.keys() || []) {
            if (String(key).startsWith(prefix)) invalidateCached('countingConfig', key);
        }
        for (const pendingKey of inflightLoads.keys()) {
            const pendingPrefix = `countingConfig:${prefix}`;
            if (pendingKey.startsWith(pendingPrefix)) {
                cacheVersions.set(pendingKey, (cacheVersions.get(pendingKey) || 0) + 1);
                inflightLoads.delete(pendingKey);
            }
        }
    }
}

function invalidateStickyMessage(guildId, channelId) {
    invalidateCached('stickyMessage', `${guildId}_${channelId}`);
}

function invalidateAutoResponders(guildId) {
    invalidateCached('autoResponder', guildId);
}

function invalidateAntiConfig(guildId) {
    cacheManager.delete('antiConfig', guildId);
}

function invalidateHentaiConfig(guildId) {
    cacheManager.delete('hentaiConfig', guildId);
}

function invalidateDisabledCommands(guildId) {
    cacheManager.delete('disabledCommands', guildId);
}

async function getUserCustomCommands(userId) {
    
    const cached = cacheManager.get('userCustomCommands', userId);
    if (cached) return cached;

    
    const { getUserCommands } = require('../models/customCommands/controller');
    const commands = await getUserCommands(userId);

    
    cacheManager.set('userCustomCommands', userId, commands);

    return commands;
}

async function getCustomCommands(guildId) {
    const cached = cacheManager.get('customCommands', guildId);
    if (cached) return cached;

    const CustomCommand = require('../models/customCommands/schema');
    const commands = await CustomCommand.find({ serverId: guildId }).lean();
    cacheManager.set('customCommands', guildId, commands);
    return commands;
}

function invalidateCustomCommands(guildId) {
    cacheManager.delete('customCommands', guildId);
}

async function getFaqConfig(guildId) {
    
    const cached = cacheManager.get('faqConfig', guildId);
    if (cached) return cached;

    
    const FaqConfig = require('../models/faq/faqModel');
    const config = await FaqConfig.findByGuild(guildId);

    
    if (config) {
        cacheManager.set('faqConfig', guildId, config);
    }

    return config;
}

async function getLevelingConfig(guildId) {
    
    const cached = cacheManager.get('levelingConfig', guildId);
    if (cached !== null && cached !== undefined) return cached || null;

    
    const GuildLevel = require('../models/leveling/guildLevelSchema');
    const config = await GuildLevel.findOne({ guildId: guildId });

    
    cacheManager.set('levelingConfig', guildId, config || false);

    return config;
}

async function getModMailConfig(guildId) {
    
    const cached = cacheManager.get('modMailConfig', guildId);
    if (cached !== null && cached !== undefined) return cached || null;

    
    const ModMailConfig = require('../models/modmail/ModMailConfig');
    const config = await ModMailConfig.findOne({ guildId: guildId, status: true });

    
    cacheManager.set('modMailConfig', guildId, config || false);

    return config;
}

function invalidateUserCustomCommands(userId) {
    cacheManager.delete('userCustomCommands', userId);
}

function invalidateFaqConfig(guildId) {
    cacheManager.delete('faqConfig', guildId);
}

function invalidateLevelingConfig(guildId) {
    cacheManager.delete('levelingConfig', guildId);
}

function invalidateModMailConfig(guildId) {
    cacheManager.delete('modMailConfig', guildId);
}

async function getReactionRoleConfig(guildId) {
    if (!guildId) return [];
    
    const cached = cacheManager.get('reactionRole', guildId);
    if (cached !== null && cached !== undefined) return cached || [];

    
    const ReactionRole = require('../models/reactionroles/schema');
    const configs = await ReactionRole.find({ guildId: guildId }).lean();

    
    cacheManager.set('reactionRole', guildId, configs || []);

    return configs || [];
}

async function getReactionRoleByMessage(messageId) {
    if (!messageId) return null;
    const cacheKey = `msg:${messageId}`;
    const cached = cacheManager.get('reactionRole', cacheKey);
    if (cached !== null && cached !== undefined) return cached || null;

    try {
        const ReactionRole = require('../models/reactionroles/schema');
        const setup = await ReactionRole.findOne({ messageId }).lean();
        cacheManager.set('reactionRole', cacheKey, setup || false);
        return setup || null;
    } catch (error) {
        console.error(`[ReactionRole] Error loading setup by message ${messageId}:`, error);
        return null;
    }
}

async function getReactionRoleBySetupId(setupId) {
    if (!setupId) return null;
    const cacheKey = `setup:${setupId}`;
    const cached = cacheManager.get('reactionRole', cacheKey);
    if (cached !== null && cached !== undefined) return cached || null;

    try {
        const ReactionRole = require('../models/reactionroles/schema');
        const setup = await ReactionRole.findOne({ setupId }).lean();
        cacheManager.set('reactionRole', cacheKey, setup || false);
        return setup || null;
    } catch (error) {
        console.error(`[ReactionRole] Error loading setup by setupId ${setupId}:`, error);
        return null;
    }
}

async function getBoostSettings(guildId) {
    
    const cached = cacheManager.get('boostSettings', guildId);
    if (cached !== null && cached !== undefined) return cached || null;

    
    const BoostSettings = require('../models/boost/BoostSettings');
    const settings = await BoostSettings.findOne({ serverId: guildId });

    
    if (settings) {
        cacheManager.set('boostSettings', guildId, settings);
    } else {
        cacheManager.set('boostSettings', guildId, false);
    }

    return settings;
}

async function getServerStatsConfig(guildId) {
    
    const cached = cacheManager.get('serverStats', guildId);
    if (cached !== null && cached !== undefined) return cached || null;

    
    const ServerStats = require('../models/serverstats/Schema');
    const stats = await ServerStats.findByGuildId(guildId);

    
    if (stats) {
        cacheManager.set('serverStats', guildId, stats);
    } else {
        cacheManager.set('serverStats', guildId, false);
    }

    return stats;
}

async function getBirthdaySettings(guildId) {
    if (!guildId) return null;
    
    const cached = cacheManager.get('birthdaySettings', guildId);
    if (cached !== null && cached !== undefined) return cached || null;

    try {
        
        const GuildBirthdaySettings = require('../models/birthday/setup');
        const settings = await GuildBirthdaySettings.findOne({ guildId: guildId }).lean();

        
        cacheManager.set('birthdaySettings', guildId, settings || false);
        return settings || null;
    } catch (error) {
        console.error(`[BirthdaySettings] Error loading birthday settings for ${guildId}:`, error);
        return null;
    }
}

async function getReportSettings(guildId) {
    
    const cached = cacheManager.get('reportSettings', guildId);
    if (cached !== null && cached !== undefined) return cached || null;

    
    const ReportSettings = require('../models/reportSystem/ReportSettings');
    const settings = await ReportSettings.findOne({ guildId: guildId });

    
    cacheManager.set('reportSettings', guildId, settings || false);

    return settings;
}

async function getReportCache(reportId, guildId) {
    const key = `${guildId}_${reportId}`;
    const cached = cacheManager.get('report', key);
    if (cached !== null && cached !== undefined) return cached || null;

    const Report = require('../models/reportSystem/Report');
    const report = await Report.findOne({ reportId, guildId });

    cacheManager.set('report', key, report || false);
    return report;
}

function invalidateReactionRole(guildId, messageId = null, setupId = null) {
    if (guildId) cacheManager.delete('reactionRole', guildId);
    if (messageId) cacheManager.delete('reactionRole', `msg:${messageId}`);
    if (setupId) cacheManager.delete('reactionRole', `setup:${setupId}`);
}

function invalidateBoostSettings(guildId) {
    cacheManager.delete('boostSettings', guildId);
}

function invalidateServerStatsConfig(guildId) {
    cacheManager.delete('serverStats', guildId);
}

function invalidateBirthdaySettings(guildId) {
    cacheManager.delete('birthdaySettings', guildId);
}

function invalidateReportSettings(guildId) {
    cacheManager.delete('reportSettings', guildId);
}

function invalidateReport(reportId, guildId) {
    if (guildId && reportId) {
        cacheManager.delete('report', `${guildId}_${reportId}`);
    }
}

async function getTicketConfig(guildId) {
    
    const cached = cacheManager.get('ticketConfig', guildId);
    if (cached) return cached;

    
    const TicketConfig = require('../models/ticket/TicketConfig');
    const config = await TicketConfig.findOne({ serverId: guildId });

    
    if (config) {
        cacheManager.set('ticketConfig', guildId, config);
    }

    return config;
}

function invalidateTicketConfig(guildId) {
    cacheManager.delete('ticketConfig', guildId);
}

async function getTicketUserData(userId, guildId) {
    const key = `${userId}_${guildId}`;

    
    const cached = cacheManager.get('ticketUserData', key);
    if (cached) return cached;

    
    const TicketUserData = require('../models/ticket/TicketUserData');
    const data = await TicketUserData.findOne({ userId, guildId });

    
    if (data) {
        cacheManager.set('ticketUserData', key, data);
    }

    return data;
}

function invalidateTicketUserData(userId, guildId) {
    const key = `${userId}_${guildId}`;
    cacheManager.delete('ticketUserData', key);
}

async function getLogConfig(guildId, eventType) {
    const key = `${guildId}_${eventType}`;

    
    const cached = cacheManager.get('logConfig', key);
    if (cached !== null) {
        return cached;
    }

    try {
        const LogConfig = require('../models/serverLogs/LogConfig');
        const config = await LogConfig.findOne({ guildId, eventType });

        
        const result = config || false;
        cacheManager.set('logConfig', key, result);
        return result;
    } catch (error) {
        console.error(`[LogConfig] Error loading config for ${guildId}/${eventType}:`, error);
        
        cacheManager.set('logConfig', key, false);
        return false;
    }
}

function invalidateLogConfig(guildId, eventType = null) {
    if (eventType) {
        const key = `${guildId}_${eventType}`;
        cacheManager.delete('logConfig', key);
    } else {
        
        const eventTypes = [
            'messageDelete', 'messageUpdate', 'memberJoin', 'memberLeave',
            'roleCreate', 'roleDelete', 'memberBan', 'memberUnban',
            'voiceJoin', 'voiceLeave', 'channelCreate', 'channelDelete',
            'roleAssigned', 'roleRemoved', 'nicknameChange', 'moderationLogs'
        ];
        eventTypes.forEach(et => {
            const key = `${guildId}_${et}`;
            cacheManager.delete('logConfig', key);
        });
    }
}

async function getWelcomeSettings(guildId) {
    
    const cached = cacheManager.get('welcomeSettings', guildId);
    if (cached !== null) {
        return cached;
    }

    try {
        const WelcomeSettings = require('../models/welcome/WelcomeSettings');
        const settings = await WelcomeSettings.findOne({ serverId: guildId });

        
        const result = settings || false;
        cacheManager.set('welcomeSettings', guildId, result);
        return result;
    } catch (error) {
        console.error(`[WelcomeSettings] Error loading settings for ${guildId}:`, error);
        
        cacheManager.set('welcomeSettings', guildId, false);
        return false;
    }
}

function invalidateWelcomeSettings(guildId) {
    cacheManager.delete('welcomeSettings', guildId);
}

async function getVerificationConfig(guildId) {
    
    const cached = cacheManager.get('verificationConfig', guildId);
    if (cached !== null) {
        return cached;
    }

    try {
        const VerificationConfig = require('../models/gateVerification/verificationConfig');
        const config = await VerificationConfig.findOne({ guildId });

        
        const result = config || false;
        cacheManager.set('verificationConfig', guildId, result);
        return result;
    } catch (error) {
        console.error(`[VerificationConfig] Error loading config for ${guildId}:`, error);
        
        cacheManager.set('verificationConfig', guildId, false);
        return false;
    }
}

function invalidateVerificationConfig(guildId) {
    cacheManager.delete('verificationConfig', guildId);
}

async function getTruthOrDareConfig(guildId) {
    
    const cached = cacheManager.get('truthOrDareConfig', guildId);
    if (cached !== null) {
        return cached;
    }

    try {
        const TruthOrDareConfig = require('../models/truthordare/TruthOrDareConfig');
        const config = await TruthOrDareConfig.findOne({ serverId: guildId });

        
        const result = config || false;
        cacheManager.set('truthOrDareConfig', guildId, result);
        return result;
    } catch (error) {
        console.error(`[TruthOrDareConfig] Error loading config for ${guildId}:`, error);
        
        cacheManager.set('truthOrDareConfig', guildId, false);
        return false;
    }
}

function invalidateTruthOrDareConfig(guildId) {
    cacheManager.delete('truthOrDareConfig', guildId);
}

async function getSuggestionConfig(guildId) {
    
    const cached = cacheManager.get('suggestionConfig', guildId);
    if (cached !== null) {
        return cached;
    }

    try {
        const SuggestionConfig = require('../models/suggestions/SuggestionConfig');
        const config = await SuggestionConfig.findOne({ guildId });

        
        const result = config || false;
        cacheManager.set('suggestionConfig', guildId, result);
        return result;
    } catch (error) {
        console.error(`[SuggestionConfig] Error loading config for ${guildId}:`, error);
        
        cacheManager.set('suggestionConfig', guildId, false);
        return false;
    }
}

function invalidateSuggestionConfig(guildId) {
    cacheManager.delete('suggestionConfig', guildId);
}

async function getAFKStatus(userId, guildId) {
    const cacheKey = `${userId}:${guildId}`;

    
    const cached = cacheManager.get('afkStatus', cacheKey);
    if (cached !== null) {
        return cached;
    }

    try {
        const AFK = require('../models/afk/schema');
        const afk = await AFK.findActiveAFK(userId, guildId);

        
        const result = afk || false;
        cacheManager.set('afkStatus', cacheKey, result);
        return result;
    } catch (error) {
        console.error(`[AFK] Error loading AFK status for ${userId} in ${guildId}:`, error);
        
        cacheManager.set('afkStatus', cacheKey, false);
        return false;
    }
}

function invalidateAFKStatus(userId, guildId) {
    const cacheKey = `${userId}:${guildId}`;
    cacheManager.delete('afkStatus', cacheKey);
}

async function invalidateGuildAFKStatuses(guildId) {
    
    
    try {
        const cache = cacheManager.caches.get('afkStatus');
        if (cache && cache.data) {
            for (const [key] of cache.data.entries()) {
                if (key.endsWith(`:${guildId}`)) {
                    cacheManager.delete('afkStatus', key);
                }
            }
        }
    } catch (error) {
        console.error('[AFK] Error invalidating guild AFK statuses:', error);
    }
}

async function getApplication(guildId, appName) {
    if (!guildId || !appName) return null;
    const cacheKey = `${guildId}:${appName}`;

    
    const cached = cacheManager.get('applications', cacheKey);
    if (cached !== null && cached !== undefined) return cached || null;

    try {
        const Application = require('../models/applications/applications');
        const application = await Application.findOne({ guildId, appName });

        
        cacheManager.set('applications', cacheKey, application || false);
        return application || null;
    } catch (error) {
        console.error(`[Applications] Error loading application ${appName} for ${guildId}:`, error);
        return null;
    }
}

async function getAllApplications(guildId) {
    
    const cached = cacheManager.get('applications', guildId);
    if (cached !== null) {
        return cached;
    }

    try {
        const Application = require('../models/applications/applications');
        const applications = await Application.find({ guildId });

        
        cacheManager.set('applications', guildId, applications);
        return applications;
    } catch (error) {
        console.error(`[Applications] Error loading applications for ${guildId}:`, error);
        
        cacheManager.set('applications', guildId, []);
        return [];
    }
}

function invalidateApplication(guildId, appName) {
    const cacheKey = `${guildId}:${appName}`;
    cacheManager.delete('applications', cacheKey);
    
    cacheManager.delete('applications', guildId);
}

function invalidateGuildApplications(guildId) {
    cacheManager.delete('applications', guildId);
    
}

async function getRoleNickConfig(guildId) {
    const cached = cacheManager.get('roleNickConfig', guildId);
    if (cached) return cached;

    const RoleNickConfig = require('../models/rolenick/RoleNickConfig');
    const config = await RoleNickConfig.findOne({ guildId });

    if (config) {
        cacheManager.set('roleNickConfig', guildId, config);
    }
    return config;
}

function invalidateRoleNickConfig(guildId) {
    cacheManager.delete('roleNickConfig', guildId);
}

async function getGiveawayCache(messageId) {
    const cached = cacheManager.get('giveaway', messageId) ?? cacheManager.get('giveaway', `giveaway_${messageId}`);
    if (cached !== null && cached !== undefined) {
        return cached || null;
    }

    try {
        const Giveaway = require('../models/giveaway/schema');
        const giveaway = await Giveaway.findOne({ messageId });
        cacheManager.set('giveaway', messageId, giveaway || false);
        return giveaway;
    } catch (error) {
        console.error(`[Giveaway] Error loading giveaway cache for ${messageId}:`, error);
        return null;
    }
}

function invalidateGiveaway(messageId) {
    cacheManager.delete('giveaway', messageId);
    cacheManager.delete('giveaway', `giveaway_${messageId}`);
}

module.exports = {
    
    getServerConfig,
    getCountingConfig,
    getStickyMessage,
    getAutoResponders,
    getAntiConfig,
    getHentaiConfig,
    isCommandDisabled,
    getUserCustomCommands,
    getCustomCommands,
    getFaqConfig,
    getLevelingConfig,
    getModMailConfig,
    getReactionRoleConfig,
    getReactionRoleByMessage,
    getReactionRoleBySetupId,
    getBoostSettings,
    getServerStatsConfig,
    getBirthdaySettings,
    getReportSettings,
    getReportCache,
    getTicketConfig,
    getTicketUserData,
    getLogConfig,
    getWelcomeSettings,
    getVerificationConfig,
    getTruthOrDareConfig,
    getSuggestionConfig,
    getAFKStatus,
    getApplication,
    getAllApplications,
    getRoleNickConfig,
    getGiveawayCache,

    
    invalidateServerConfig,
    invalidateCountingConfig,
    invalidateStickyMessage,
    invalidateAutoResponders,
    invalidateAntiConfig,
    invalidateHentaiConfig,
    invalidateDisabledCommands,
    invalidateUserCustomCommands,
    invalidateCustomCommands,
    invalidateFaqConfig,
    invalidateLevelingConfig,
    invalidateModMailConfig,
    invalidateReactionRole,
    invalidateBoostSettings,
    invalidateServerStatsConfig,
    invalidateBirthdaySettings,
    invalidateReportSettings,
    invalidateReport,
    invalidateTicketConfig,
    invalidateTicketUserData,
    invalidateLogConfig,
    invalidateWelcomeSettings,
    invalidateVerificationConfig,
    invalidateTruthOrDareConfig,
    invalidateSuggestionConfig,
    invalidateAFKStatus,
    invalidateGuildAFKStatuses,
    invalidateApplication,
    invalidateGuildApplications,
    invalidateRoleNickConfig,
    invalidateGiveaway
};
