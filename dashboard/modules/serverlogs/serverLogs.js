const LogConfig = require('../../../models/serverLogs/LogConfig');
const colors = require('../../../UI/colors/colors');
const client = require('../../../main');


const EVENT_TYPES = [
    'messageDelete', 'messageUpdate', 'memberJoin', 'memberLeave',
    'roleCreate', 'roleDelete', 'memberBan', 'memberUnban',
    'voiceJoin', 'voiceLeave', 'channelCreate', 'channelDelete',
    'roleAssigned', 'roleRemoved', 'nicknameChange', 'moderationLogs'
];


function emitLogConfigUpdate(serverId, logConfigs, socket) {
    socket.emit('bot_data_update', {
        type: 'serverlog_config',
        payload: {
            guildId: serverId,
            logConfigs: logConfigs.map(config => ({
                guildId: config.guildId,
                eventType: config.eventType,
                channelId: config.channelId,
                _id: config._id,
                createdAt: config.createdAt,
                updatedAt: config.updatedAt
            }))
        }
    });
}


async function getServerLogConfig(guildId, socket) {
    try {
        const configs = await LogConfig.find({ guildId }).lean();
        
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'server_serverlogs',
                payload: {
                    guildId,
                    logConfigs: configs.map(config => ({
                        guildId: config.guildId,
                        eventType: config.eventType,
                        channelId: config.channelId,
                        _id: config._id,
                        createdAt: config.createdAt,
                        updatedAt: config.updatedAt
                    }))
                }
            });
        }
        
        return configs;
    } catch (error) {
        console.error(`${colors.red}❌ Error getting server log config:${colors.reset}`, error);
        
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'serverlog_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'get_serverlog_config'
                }
            });
        }
        
        throw error;
    }
}


async function setupEventLogging(guildId, eventType, channelId, socket) {
    try {
        console.log(`[DEBUG] Setting up event logging for Guild: ${guildId}, Event: ${eventType}, Channel: ${channelId}`);

        
        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            throw new Error('Guild not found');
        }

        
        const channel = guild.channels.cache.get(channelId);
        if (!channel) {
            throw new Error('Channel not found');
        }

        if (!channel.isTextBased()) {
            throw new Error('Channel must be a text-based channel');
        }

        
        if (!EVENT_TYPES.includes(eventType)) {
            throw new Error(`Invalid event type: ${eventType}`);
        }

        const updatedConfig = await LogConfig.findOneAndUpdate(
            { guildId, eventType },
            { 
                guildId,
                eventType,
                channelId,
                updatedAt: new Date()
            },
            { upsert: true, returnDocument: 'after' }
        );

        
        const allConfigs = await LogConfig.find({ guildId });

        if (socket) {
            emitLogConfigUpdate(guildId, allConfigs, socket);
        }

        console.log(`${colors.green}✅ Setup event logging for ${eventType} in server ${guildId}${colors.reset}`);
        
        return updatedConfig;
    } catch (error) {
        console.error(`${colors.red}❌ Error setting up event logging:${colors.reset}`, error);
        
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'serverlog_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'setup_event_logging'
                }
            });
        }
        
        throw error;
    }
}


async function setupAllEventsLogging(guildId, channelId, socket) {
    try {
        console.log(`[DEBUG] Setting up all events logging for Guild: ${guildId}, Channel: ${channelId}`);

        
        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            throw new Error('Guild not found');
        }

        
        const channel = guild.channels.cache.get(channelId);
        if (!channel) {
            throw new Error('Channel not found');
        }

        if (!channel.isTextBased()) {
            throw new Error('Channel must be a text-based channel');
        }

        
        const updatePromises = EVENT_TYPES.map(eventType =>
            LogConfig.findOneAndUpdate(
                { guildId, eventType },
                { 
                    guildId,
                    eventType,
                    channelId,
                    updatedAt: new Date()
                },
                { upsert: true, returnDocument: 'after' }
            )
        );

        await Promise.all(updatePromises);

        
        const allConfigs = await LogConfig.find({ guildId });

        if (socket) {
            emitLogConfigUpdate(guildId, allConfigs, socket);
        }

        console.log(`${colors.green}✅ Setup all events logging in server ${guildId}${colors.reset}`);
        
        return allConfigs;
    } catch (error) {
        console.error(`${colors.red}❌ Error setting up all events logging:${colors.reset}`, error);
        
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'serverlog_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'setup_all_events_logging'
                }
            });
        }
        
        throw error;
    }
}


async function updateLogConfig(guildId, eventType, channelId, socket) {
    try {
        console.log(`[DEBUG] Updating log config for Guild: ${guildId}, Event: ${eventType}`);

        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            throw new Error('Guild not found');
        }

        
        if (channelId) {
            const channel = guild.channels.cache.get(channelId);
            if (!channel) {
                throw new Error('Channel not found');
            }

            if (!channel.isTextBased()) {
                throw new Error('Channel must be a text-based channel');
            }
        }

        
        if (!EVENT_TYPES.includes(eventType)) {
            throw new Error(`Invalid event type: ${eventType}`);
        }

        const existingConfig = await LogConfig.findOne({ guildId, eventType });
        if (!existingConfig) {
            throw new Error('Log configuration not found');
        }

        const updatedConfig = await LogConfig.findOneAndUpdate(
            { guildId, eventType },
            { 
                channelId,
                updatedAt: new Date()
            },
            { returnDocument: 'after' }
        );

        
        const allConfigs = await LogConfig.find({ guildId });

        if (socket) {
            emitLogConfigUpdate(guildId, allConfigs, socket);
        }

        console.log(`${colors.cyan}🔄 Updated log config for ${eventType} in server ${guildId}${colors.reset}`);
        
        return updatedConfig;
    } catch (error) {
        console.error(`${colors.red}❌ Error updating log config:${colors.reset}`, error);
        
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'serverlog_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'update_log_config'
                }
            });
        }
        
        throw error;
    }
}


async function deleteLogConfig(guildId, eventType, socket) {
    try {
        console.log(`[DEBUG] Deleting log config for Guild: ${guildId}, Event: ${eventType}`);

        
        if (eventType && !EVENT_TYPES.includes(eventType)) {
            throw new Error(`Invalid event type: ${eventType}`);
        }

        let deletedConfigs;
        
        if (eventType) {
            
            deletedConfigs = await LogConfig.findOneAndDelete({ guildId, eventType });
            if (!deletedConfigs) {
                throw new Error('Log configuration not found');
            }
        } else {
            
            deletedConfigs = await LogConfig.deleteMany({ guildId });
        }

        
        const remainingConfigs = await LogConfig.find({ guildId });

        if (socket) {
            if (remainingConfigs.length > 0) {
                emitLogConfigUpdate(guildId, remainingConfigs, socket);
            } else {
                socket.emit('bot_data_update', {
                    type: 'serverlog_deleted',
                    payload: {
                        guildId,
                        eventType
                    }
                });
            }
        }

        console.log(`${colors.red}🗑️ Deleted log config for ${eventType || 'all events'} in server ${guildId}${colors.reset}`);
        
        return deletedConfigs;
    } catch (error) {
        console.error(`${colors.red}❌ Error deleting log config:${colors.reset}`, error);
        
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'serverlog_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'delete_log_config'
                }
            });
        }
        
        throw error;
    }
}


async function getServerLogStats(guildId, socket) {
    try {
        const configs = await LogConfig.find({ guildId });
        const guild = client.guilds.cache.get(guildId);
        
        const configuredEvents = configs.length;
        const totalEvents = EVENT_TYPES.length;
        const uniqueChannels = [...new Set(configs.map(config => config.channelId))].length;
        
        
        let validChannels = 0;
        if (guild) {
            configs.forEach(config => {
                const channel = guild.channels.cache.get(config.channelId);
                if (channel && channel.isTextBased()) {
                    validChannels++;
                }
            });
        }
        
        const stats = {
            guildId,
            configuredEvents,
            totalEvents,
            coveragePercentage: Math.round((configuredEvents / totalEvents) * 100),
            uniqueChannels,
            validChannels,
            invalidChannels: configuredEvents - validChannels
        };

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'serverlog_stats',
                payload: {
                    guildId,
                    stats
                }
            });
        }

        return stats;
    } catch (error) {
        console.error(`${colors.red}❌ Error getting server log stats:${colors.reset}`, error);
        
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'serverlog_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'get_serverlog_stats'
                }
            });
        }
        
        throw error;
    }
}


async function getAvailableEventTypes(socket) {
    try {
        const eventTypes = EVENT_TYPES.map(eventType => {
            
            const readableName = eventType
                .replace(/([A-Z])/g, ' $1')
                .replace(/^./, str => str.toUpperCase());
            
            return {
                value: eventType,
                name: readableName
            };
        });

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'serverlog_event_types',
                payload: {
                    eventTypes
                }
            });
        }

        return eventTypes;
    } catch (error) {
        console.error(`${colors.red}❌ Error getting event types:${colors.reset}`, error);
        throw error;
    }
}


async function clearAllLogConfigs(guildId, socket) {
    try {
        console.log(`[DEBUG] Clearing all log configs for Guild: ${guildId}`);

        const deletedConfigs = await LogConfig.deleteMany({ guildId });

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'serverlog_deleted',
                payload: {
                    guildId,
                    eventType: null, 
                    deletedCount: deletedConfigs.deletedCount
                }
            });
        }

        console.log(`${colors.red}🗑️ Cleared all log configs for server ${guildId} (${deletedConfigs.deletedCount} configs)${colors.reset}`);
        
        return deletedConfigs;
    } catch (error) {
        console.error(`${colors.red}❌ Error clearing log configs:${colors.reset}`, error);
        
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'serverlog_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'clear_all_log_configs'
                }
            });
        }
        
        throw error;
    }
}


async function sendAllServerLogConfigs(socket) {
    try {
        
        const configs = await LogConfig.find({}).lean();
        const configsByGuild = {};
        
        configs.forEach(config => {
            if (!configsByGuild[config.guildId]) {
                configsByGuild[config.guildId] = [];
            }
            configsByGuild[config.guildId].push({
                guildId: config.guildId,
                eventType: config.eventType,
                channelId: config.channelId,
                _id: config._id,
                createdAt: config.createdAt,
                updatedAt: config.updatedAt
            });
        });
        
        
        for (const [guildId, guildConfigs] of Object.entries(configsByGuild)) {
            socket.emit('bot_data_update', {
                type: 'serverlog_config',
                payload: {
                    guildId,
                    logConfigs: guildConfigs
                }
            });
        }
        
        console.log(`${colors.green}📊 Sent ${Object.keys(configsByGuild).length} server log configs to middleware${colors.reset}`);
    } catch (error) {
        console.error(`${colors.red}❌ Error sending all server log configs:${colors.reset}`, error);
    }
}

module.exports = {
    getServerLogConfig,
    setupEventLogging,
    setupAllEventsLogging,
    updateLogConfig,
    deleteLogConfig,
    getServerLogStats,
    getAvailableEventTypes,
    clearAllLogConfigs,
    sendAllServerLogConfigs,
    EVENT_TYPES
};
