const colors = require('../../../UI/colors/colors');
const CommandLogsConfig = require('../../../models/commandLogs/commandlogs');
const cacheManager = require('../../../utils/cacheManager');


function invalidateCommandLogCache(serverId) {
    try {
        cacheManager.delete('commandLogConfig', serverId);
    } catch (_) {   }
}


async function sendAllCommandLogsConfigs(socket) {
    try {
        console.log(`${colors.blue}📊 Sending all command logs configs to middleware${colors.reset}`);

        const allConfigs = await CommandLogsConfig.find({});

        for (const config of allConfigs) {
            emitCommandLogsUpdate(config.guildId, config, socket, 'server_commandlogs_config');
        }

        console.log(`${colors.green}✅ Sent ${allConfigs.length} command logs configs to middleware${colors.reset}`);

    } catch (error) {
        console.error(`${colors.red}❌ Error sending all command logs configs:${colors.reset}`, error);
    }
}


function emitCommandLogsUpdate(serverId, config, socket, eventType = 'commandlogs_config') {
    if (socket && socket.emit) {
        socket.emit('bot_data_update', {
            type: eventType,
            payload: {
                serverId: serverId,
                config: config,
                timestamp: Date.now()
            }
        });
    }
}


async function setupCommandLogsSystem(serverId, config, socket) {
    try {
        console.log(`${colors.blue}📋 Setting up command logs system for server ${serverId}${colors.reset}`);

        const commandLogsConfig = await CommandLogsConfig.findOneAndUpdate(
            { guildId: serverId },
            {
                guildId: serverId,
                channelId: config.channelId || null,
                enabled: config.enabled
            },
            {
                upsert: true,
                returnDocument: 'after',
                setDefaultsOnInsert: true
            }
        );

        console.log(`${colors.green}✅ Command logs system setup completed for server ${serverId}${colors.reset}`);
        invalidateCommandLogCache(serverId);
        emitCommandLogsUpdate(serverId, commandLogsConfig, socket, 'commandlogs_config');

        return commandLogsConfig;

    } catch (error) {
        console.error(`${colors.red}❌ Error setting up command logs system for server ${serverId}:${colors.reset}`, error);

        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'commandlogs_error',
                payload: {
                    serverId: serverId,
                    error: error.message,
                    action: 'setup_commandlogs_system',
                    timestamp: Date.now()
                }
            });
        }

        throw error;
    }
}


async function updateCommandLogsConfig(serverId, config, socket) {
    try {
        console.log(`${colors.blue}🔄 Updating command logs system for server ${serverId}${colors.reset}`);

        const commandLogsConfig = await CommandLogsConfig.findOneAndUpdate(
            { guildId: serverId },
            {
                guildId: serverId,
                channelId: config.channelId || null,
                enabled: config.enabled
            },
            {
                returnDocument: 'after',
                upsert: true
            }
        );

        console.log(`${colors.green}✅ Command logs system updated for server ${serverId}${colors.reset}`);
        invalidateCommandLogCache(serverId);
        emitCommandLogsUpdate(serverId, commandLogsConfig, socket, 'commandlogs_config');

        return commandLogsConfig;

    } catch (error) {
        console.error(`${colors.red}❌ Error updating command logs system for server ${serverId}:${colors.reset}`, error);

        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'commandlogs_error',
                payload: {
                    serverId: serverId,
                    error: error.message,
                    action: 'update_commandlogs_config',
                    timestamp: Date.now()
                }
            });
        }

        throw error;
    }
}


async function getCommandLogsConfig(serverId, socket) {
    try {
        console.log(`${colors.blue}📋 Getting command logs config for server ${serverId}${colors.reset}`);

        const config = await CommandLogsConfig.findOne({ guildId: serverId });

        console.log(`${colors.green}✅ Command logs config retrieved for server ${serverId}${colors.reset}`);

        emitCommandLogsUpdate(serverId, config, socket, 'server_commandlogs_config');

        return config;

    } catch (error) {
        console.error(`${colors.red}❌ Error getting command logs config for server ${serverId}:${colors.reset}`, error);

        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'commandlogs_error',
                payload: {
                    serverId: serverId,
                    error: error.message,
                    action: 'get_commandlogs_config',
                    timestamp: Date.now()
                }
            });
        }

        throw error;
    }
}


async function toggleCommandLogsStatus(serverId, socket) {
    try {
        console.log(`${colors.blue}🔄 Toggling command logs status for server ${serverId}${colors.reset}`);

        const currentConfig = await CommandLogsConfig.findOne({ guildId: serverId });
        if (!currentConfig) {
            throw new Error('Command logs configuration not found');
        }

        const updatedConfig = await CommandLogsConfig.findOneAndUpdate(
            { guildId: serverId },
            { enabled: !currentConfig.enabled },
            { returnDocument: 'after' }
        );

        console.log(`${colors.green}✅ Command logs status toggled for server ${serverId}${colors.reset}`);
        invalidateCommandLogCache(serverId);
        emitCommandLogsUpdate(serverId, updatedConfig, socket, 'commandlogs_config');

        return updatedConfig;

    } catch (error) {
        console.error(`${colors.red}❌ Error toggling command logs status for server ${serverId}:${colors.reset}`, error);

        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'commandlogs_error',
                payload: {
                    serverId: serverId,
                    error: error.message,
                    action: 'toggle_commandlogs_status',
                    timestamp: Date.now()
                }
            });
        }

        throw error;
    }
}


async function deleteCommandLogsConfig(serverId, socket) {
    try {
        console.log(`${colors.blue}🗑️ Deleting command logs config for server ${serverId}${colors.reset}`);

        await CommandLogsConfig.findOneAndDelete({ guildId: serverId });
        invalidateCommandLogCache(serverId);
        console.log(`${colors.green}✅ Command logs config deleted for server ${serverId}${colors.reset}`);

        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'commandlogs_deleted',
                payload: {
                    serverId: serverId,
                    timestamp: Date.now()
                }
            });
        }

        return { deleted: true };

    } catch (error) {
        console.error(`${colors.red}❌ Error deleting command logs config for server ${serverId}:${colors.reset}`, error);

        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'commandlogs_error',
                payload: {
                    serverId: serverId,
                    error: error.message,
                    action: 'delete_commandlogs_config',
                    timestamp: Date.now()
                }
            });
        }

        throw error;
    }
}

module.exports = {
    setupCommandLogsSystem,
    updateCommandLogsConfig,
    getCommandLogsConfig,
    toggleCommandLogsStatus,
    deleteCommandLogsConfig,
    sendAllCommandLogsConfigs
};
