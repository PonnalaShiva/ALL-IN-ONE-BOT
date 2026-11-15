const colors = require('../../../UI/colors/colors');
const SuggestionConfig = require('../../../models/suggestions/SuggestionConfig');
const { invalidateSuggestionConfig } = require('../../../utils/cacheHelpers');


async function sendAllSuggestionConfigs(socket) {
    try {
        console.log(`${colors.blue}📊 Sending all suggestion configs to middleware${colors.reset}`);
        
        const allConfigs = await SuggestionConfig.find({});
        
        for (const config of allConfigs) {
            emitSuggestionUpdate(config.guildId, config, socket, 'server_suggestion_config');
        }
        
        console.log(`${colors.green}✅ Sent ${allConfigs.length} suggestion configs to middleware${colors.reset}`);
        
    } catch (error) {
        console.error(`${colors.red}❌ Error sending all suggestion configs:${colors.reset}`, error);
    }
}


function emitSuggestionUpdate(serverId, config, socket, eventType = 'suggestion_config') {
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


async function setupSuggestionSystem(serverId, config, socket) {
    try {
        console.log(`${colors.blue}💡 Setting up suggestion system for server ${serverId}${colors.reset}`);
        
        const suggestionConfig = await SuggestionConfig.findOneAndUpdate(
            { guildId: serverId },
            {
                guildId: serverId,
                suggestionChannelId: config.suggestionChannelId,
                allowedRoleId: config.allowedRoleId || null
            },
            { 
                upsert: true, 
                returnDocument: 'after',
                setDefaultsOnInsert: true
            }
        );

        invalidateSuggestionConfig(serverId);

        console.log(`${colors.green}✅ Suggestion system setup completed for server ${serverId}${colors.reset}`);
        
        emitSuggestionUpdate(serverId, suggestionConfig, socket, 'suggestion_config');
        
        return suggestionConfig;
        
    } catch (error) {
        console.error(`${colors.red}❌ Error setting up suggestion system for server ${serverId}:${colors.reset}`, error);
        
        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'suggestion_error',
                payload: {
                    serverId: serverId,
                    error: error.message,
                    action: 'setup_suggestion_system',
                    timestamp: Date.now()
                }
            });
        }
        
        throw error;
    }
}


async function updateSuggestionConfig(serverId, config, socket) {
    try {
        console.log(`${colors.blue}🔄 Updating suggestion system for server ${serverId}${colors.reset}`);
        
        const suggestionConfig = await SuggestionConfig.findOneAndUpdate(
            { guildId: serverId },
            {
                guildId: serverId,
                suggestionChannelId: config.suggestionChannelId,
                allowedRoleId: config.allowedRoleId || null
            },
            { 
                returnDocument: 'after',
                upsert: true
            }
        );

        invalidateSuggestionConfig(serverId);

        console.log(`${colors.green}✅ Suggestion system updated for server ${serverId}${colors.reset}`);
        
        emitSuggestionUpdate(serverId, suggestionConfig, socket, 'suggestion_config');
        
        return suggestionConfig;
        
    } catch (error) {
        console.error(`${colors.red}❌ Error updating suggestion system for server ${serverId}:${colors.reset}`, error);
        
        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'suggestion_error',
                payload: {
                    serverId: serverId,
                    error: error.message,
                    action: 'update_suggestion_config',
                    timestamp: Date.now()
                }
            });
        }
        
        throw error;
    }
}


async function getSuggestionConfig(serverId, socket) {
    try {
        console.log(`${colors.blue}📋 Getting suggestion config for server ${serverId}${colors.reset}`);
        
        const config = await SuggestionConfig.findOne({ guildId: serverId });
        
        console.log(`${colors.green}✅ Suggestion config retrieved for server ${serverId}${colors.reset}`);
        
        emitSuggestionUpdate(serverId, config, socket, 'server_suggestion_config');
        
        return config;
        
    } catch (error) {
        console.error(`${colors.red}❌ Error getting suggestion config for server ${serverId}:${colors.reset}`, error);
        
        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'suggestion_error',
                payload: {
                    serverId: serverId,
                    error: error.message,
                    action: 'get_suggestion_config',
                    timestamp: Date.now()
                }
            });
        }
        
        throw error;
    }
}


async function deleteSuggestionConfig(serverId, socket) {
    try {
        console.log(`${colors.blue}🗑️ Deleting suggestion config for server ${serverId}${colors.reset}`);
        
        await SuggestionConfig.findOneAndDelete({ guildId: serverId });
        invalidateSuggestionConfig(serverId);
        
        console.log(`${colors.green}✅ Suggestion config deleted for server ${serverId}${colors.reset}`);
        
        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'suggestion_deleted',
                payload: {
                    serverId: serverId,
                    timestamp: Date.now()
                }
            });
        }
        
        return { deleted: true };
        
    } catch (error) {
        console.error(`${colors.red}❌ Error deleting suggestion config for server ${serverId}:${colors.reset}`, error);
        
        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'suggestion_error',
                payload: {
                    serverId: serverId,
                    error: error.message,
                    action: 'delete_suggestion_config',
                    timestamp: Date.now()
                }
            });
        }
        
        throw error;
    }
}

module.exports = {
    setupSuggestionSystem,
    updateSuggestionConfig,
    getSuggestionConfig,
    deleteSuggestionConfig,
    sendAllSuggestionConfigs
};
