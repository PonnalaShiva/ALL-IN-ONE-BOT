const colors = require('../../../UI/colors/colors');
const GuildLevel = require('../../../models/leveling/guildLevelSchema');
const { invalidateLevelingConfig } = require('../../../utils/cacheHelpers');

async function sendAllLevelingConfigs(socket) {
    try {
        console.log(`${colors.blue}📊 Sending all leveling configs to middleware${colors.reset}`);
        const allConfigs = await GuildLevel.find({});
        for (const config of allConfigs) {
            emitLevelingUpdate(config.guildId, config, socket, 'server_leveling_config');
        }
        console.log(`${colors.green}✅ Sent ${allConfigs.length} leveling configs to middleware${colors.reset}`);
    } catch (error) {
        console.error(`${colors.red}❌ Error sending all leveling configs:${colors.reset}`, error);
    }
}

function emitLevelingUpdate(serverId, config, socket, eventType = 'leveling_config') {
    if (socket && socket.emit) {
        socket.emit('bot_data_update', {
            type: eventType,
            payload: { serverId, config, timestamp: Date.now() }
        });
    }
}

async function getLevelingConfig(serverId, socket) {
    try {
        const config = await GuildLevel.findOne({ guildId: serverId });
        emitLevelingUpdate(serverId, config, socket, 'server_leveling_config');
        return config;
    } catch (error) {
        console.error(`${colors.red}❌ Error getting leveling config:${colors.reset}`, error);
        throw error;
    }
}

async function setupLevelingSystem(serverId, config, socket) {
    try {
        console.log(`${colors.blue}⬆️ Setting up leveling system for server ${serverId}${colors.reset}`);

        
        const s = config.settings || {};
        const logChannel = config.logChannel || s.logChannel || null;
        const levelUpMessage = config.levelUpMessage || s.levelUpMessage || undefined;
        const xpMin = config.xpMin || s.xpRange?.min || s.xpMin || 15;
        const xpMax = config.xpMax || s.xpRange?.max || s.xpMax || 25;
        const multipliers = config.multipliers || s.multipliers || {};
        const restrictions = config.restrictions || s.restrictions || {};

        
        let xpCooldown = config.xpCooldown || s.xpCooldown || 60000;
        if (xpCooldown > 0 && xpCooldown < 1000) {
            xpCooldown = xpCooldown * 1000;
        }

        const levelConfig = await GuildLevel.findOneAndUpdate(
            { guildId: serverId },
            {
                guildId: serverId,
                enabled: config.enabled !== false,
                settings: {
                    logChannel: logChannel,
                    levelUpMessage: levelUpMessage,
                    xpCooldown: xpCooldown,
                    xpRange: {
                        min: xpMin,
                        max: xpMax
                    },
                    multipliers: multipliers,
                    restrictions: restrictions
                },
                voiceSettings: config.voiceSettings || s.voiceSettings || {},
                levelRoles: config.levelRoles || [],
                leaderboard: config.leaderboard || {}
            },
            { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        );
        console.log(`${colors.green}✅ Leveling system setup for server ${serverId}${colors.reset}`);
        invalidateLevelingConfig(serverId);
        invalidateLevelingConfig(serverId);
        emitLevelingUpdate(serverId, levelConfig, socket, 'leveling_config');
        return levelConfig;
    } catch (error) {
        console.error(`${colors.red}❌ Error setting up leveling system:${colors.reset}`, error);
        emitError(serverId, error, 'setup_leveling_system', socket);
        throw error;
    }
}

async function updateLevelingConfig(serverId, updates, socket) {
    try {
        console.log(`${colors.blue}🔄 Updating leveling config for server ${serverId}${colors.reset}`);
        const levelConfig = await GuildLevel.findOneAndUpdate(
            { guildId: serverId },
            updates,
            { returnDocument: 'after', upsert: true }
        );
        console.log(`${colors.green}✅ Leveling config updated for server ${serverId}${colors.reset}`);
        emitLevelingUpdate(serverId, levelConfig, socket, 'leveling_config');
        return levelConfig;
    } catch (error) {
        console.error(`${colors.red}❌ Error updating leveling config:${colors.reset}`, error);
        emitError(serverId, error, 'update_leveling_config', socket);
        throw error;
    }
}

async function toggleLevelingStatus(serverId, socket) {
    try {
        const config = await GuildLevel.findOne({ guildId: serverId });
        if (!config) throw new Error('No leveling config found');
        config.enabled = !config.enabled;
        await config.save();
        invalidateLevelingConfig(serverId);
        emitLevelingUpdate(serverId, config, socket, 'leveling_config');
        return config;
    } catch (error) {
        console.error(`${colors.red}❌ Error toggling leveling status:${colors.reset}`, error);
        throw error;
    }
}

async function deleteLevelingConfig(serverId, socket) {
    try {
        await GuildLevel.findOneAndDelete({ guildId: serverId });
        invalidateLevelingConfig(serverId);
        console.log(`${colors.green}✅ Leveling config deleted for server ${serverId}${colors.reset}`);
        socket && socket.emit('bot_data_update', {
            type: 'leveling_deleted',
            payload: { serverId, timestamp: Date.now() }
        });
        return { deleted: true };
    } catch (error) {
        console.error(`${colors.red}❌ Error deleting leveling config:${colors.reset}`, error);
        throw error;
    }
}

function emitError(serverId, error, action, socket) {
    if (socket && socket.emit) {
        socket.emit('bot_data_update', {
            type: 'leveling_error',
            payload: { serverId, error: error.message, action, timestamp: Date.now() }
        });
    }
}

module.exports = {
    sendAllLevelingConfigs,
    getLevelingConfig,
    setupLevelingSystem,
    updateLevelingConfig,
    toggleLevelingStatus,
    deleteLevelingConfig
};
