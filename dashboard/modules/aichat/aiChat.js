const AiChat = require('../../../models/aichat/aiModel');
const colors = require('../../../UI/colors/colors');
const client = require('../../../main');
const cacheManager = require('../../../utils/cacheManager');


function invalidateAiChatCache(guildId) {
    try {
        
        
        const cache = cacheManager.caches.get('aiChatConfig');
        if (cache && cache.data) {
            for (const [key] of cache.data.entries()) {
                if (key.startsWith(`${guildId}:`)) {
                    cacheManager.delete('aiChatConfig', key);
                }
            }
        }
    } catch (err) {
        console.debug('[AI Chat] Cache invalidation error:', err.message);
    }
}


function emitAiChatUpdate(serverId, aiChatConfig, socket) {
    socket.emit('bot_data_update', {
        type: 'aichat_config',
        payload: {
            guildId: serverId,
            channelId: aiChatConfig.channelId,
            isEnabled: aiChatConfig.isEnabled,
            createdAt: aiChatConfig.createdAt,
            updatedAt: aiChatConfig.updatedAt,
            updatedBy: aiChatConfig.updatedBy,
            _id: aiChatConfig._id
        }
    });
}


async function getAiChatConfig(guildId, socket) {
    try {
        const config = await AiChat.getConfig(guildId);

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'server_aichat',
                payload: {
                    guildId,
                    config: config ? {
                        channelId: config.channelId,
                        isEnabled: config.isEnabled,
                        createdAt: config.createdAt,
                        updatedAt: config.updatedAt,
                        updatedBy: config.updatedBy,
                        _id: config._id,
                        guildId: config.guildId
                    } : null
                }
            });
        }

        return config;
    } catch (error) {
        console.error(`${colors.red}❌ Error getting AI chat config:${colors.reset}`, error);

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'aichat_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'get_aichat_config'
                }
            });
        }

        throw error;
    }
}


async function setupAiChat(guildId, channelId, isEnabled, userId, socket) {
    try {
        console.log(`[DEBUG] Setting up AI chat for Guild: ${guildId}, Channel: ${channelId}`);

        
        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            throw new Error('Guild not found');
        }

        const channel = guild.channels.cache.get(channelId);
        if (!channel) {
            throw new Error('Channel not found');
        }

        await AiChat.setConfig(guildId, channelId, isEnabled, userId);
        const config = await AiChat.getConfig(guildId);

        if (socket) {
            emitAiChatUpdate(guildId, config, socket);
        }

        console.log(`${colors.green}✅ AI chat ${isEnabled ? 'enabled' : 'setup'} for server ${guildId} in channel ${channelId}${colors.reset}`);
        invalidateAiChatCache(guildId);

        return config;
    } catch (error) {
        console.error(`${colors.red}❌ Error setting up AI chat:${colors.reset}`, error);

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'aichat_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'setup_aichat'
                }
            });
        }

        throw error;
    }
}


async function updateAiChat(guildId, updateData, userId, socket) {
    try {
        const existingConfig = await AiChat.getConfig(guildId);
        if (!existingConfig) {
            throw new Error('AI chat configuration not found');
        }

        
        if (updateData.channelId) {
            const guild = client.guilds.cache.get(guildId);
            if (!guild) {
                throw new Error('Guild not found');
            }

            const channel = guild.channels.cache.get(updateData.channelId);
            if (!channel) {
                throw new Error('Channel not found');
            }
        }

        await AiChat.setConfig(
            guildId,
            updateData.channelId || existingConfig.channelId,
            updateData.isEnabled !== undefined ? updateData.isEnabled : existingConfig.isEnabled,
            userId
        );

        const updatedConfig = await AiChat.getConfig(guildId);

        if (socket) {
            emitAiChatUpdate(guildId, updatedConfig, socket);
        }

        console.log(`${colors.cyan}🔄 Updated AI chat config for server ${guildId}${colors.reset}`);
        invalidateAiChatCache(guildId);

        return updatedConfig;
    } catch (error) {
        console.error(`${colors.red}❌ Error updating AI chat:${colors.reset}`, error);

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'aichat_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'update_aichat'
                }
            });
        }

        throw error;
    }
}


async function enableAiChat(guildId, userId, socket) {
    try {
        const config = await AiChat.getConfig(guildId);
        if (!config) {
            throw new Error('AI chat configuration not found. Please set up AI chat first.');
        }

        await AiChat.setConfig(guildId, config.channelId, true, userId);
        const updatedConfig = await AiChat.getConfig(guildId);

        if (socket) {
            emitAiChatUpdate(guildId, updatedConfig, socket);
        }

        console.log(`${colors.green}✅ Enabled AI chat for server ${guildId}${colors.reset}`);
        invalidateAiChatCache(guildId);

        return updatedConfig;
    } catch (error) {
        console.error(`${colors.red}❌ Error enabling AI chat:${colors.reset}`, error);

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'aichat_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'enable_aichat'
                }
            });
        }

        throw error;
    }
}


async function disableAiChat(guildId, userId, socket) {
    try {
        const config = await AiChat.getConfig(guildId);
        if (!config) {
            throw new Error('AI chat configuration not found');
        }

        await AiChat.disableChat(guildId, userId);
        const updatedConfig = await AiChat.getConfig(guildId);

        if (socket) {
            emitAiChatUpdate(guildId, updatedConfig, socket);
        }

        console.log(`${colors.yellow}⚠️ Disabled AI chat for server ${guildId}${colors.reset}`);
        invalidateAiChatCache(guildId);

        return updatedConfig;
    } catch (error) {
        console.error(`${colors.red}❌ Error disabling AI chat:${colors.reset}`, error);

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'aichat_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'disable_aichat'
                }
            });
        }

        throw error;
    }
}


async function deleteAiChat(guildId, socket) {
    try {
        const deletedConfig = await AiChat.findOneAndDelete({ guildId });

        if (!deletedConfig) {
            throw new Error('AI chat configuration not found');
        }

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'aichat_deleted',
                payload: {
                    guildId,
                    _id: deletedConfig._id
                }
            });
        }

        console.log(`${colors.red}🗑️ Deleted AI chat configuration for server ${guildId}${colors.reset}`);
        invalidateAiChatCache(guildId);

        return deletedConfig;
    } catch (error) {
        console.error(`${colors.red}❌ Error deleting AI chat:${colors.reset}`, error);

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'aichat_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'delete_aichat'
                }
            });
        }

        throw error;
    }
}


async function toggleAiChat(guildId, userId, socket) {
    try {
        const config = await AiChat.getConfig(guildId);
        if (!config) {
            throw new Error('AI chat configuration not found');
        }

        const newStatus = !config.isEnabled;
        await AiChat.setConfig(guildId, config.channelId, newStatus, userId);
        const updatedConfig = await AiChat.getConfig(guildId);

        if (socket) {
            emitAiChatUpdate(guildId, updatedConfig, socket);
        }

        console.log(`${newStatus ? colors.green : colors.yellow}${newStatus ? '✅' : '⚠️'} ${newStatus ? 'Enabled' : 'Disabled'} AI chat for server ${guildId}${colors.reset}`);
        invalidateAiChatCache(guildId);

        return updatedConfig;
    } catch (error) {
        console.error(`${colors.red}❌ Error toggling AI chat:${colors.reset}`, error);

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'aichat_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'toggle_aichat'
                }
            });
        }

        throw error;
    }
}


async function getAiChatStats(guildId, socket) {
    try {
        const config = await AiChat.getConfig(guildId);
        const guild = client.guilds.cache.get(guildId);

        const stats = {
            hasConfig: !!config,
            isEnabled: config?.isEnabled || false,
            channelExists: config?.channelId ? !!guild?.channels?.cache?.get(config.channelId) : false,
            guildMemberCount: guild?.memberCount || 0,
            lastUpdated: config?.updatedAt || null,
            updatedBy: config?.updatedBy || null
        };

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'aichat_stats',
                payload: {
                    guildId,
                    stats
                }
            });
        }

        return stats;
    } catch (error) {
        console.error(`${colors.red}❌ Error getting AI chat stats:${colors.reset}`, error);

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'aichat_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'get_aichat_stats'
                }
            });
        }

        throw error;
    }
}


async function checkAiChatActive(guildId, channelId, socket) {
    try {
        const activeChannel = await AiChat.findActiveChannel(guildId, channelId);
        const isActive = !!activeChannel;

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'aichat_active_check',
                payload: {
                    guildId,
                    channelId,
                    isActive,
                    config: activeChannel
                }
            });
        }

        return isActive;
    } catch (error) {
        console.error(`${colors.red}❌ Error checking AI chat active status:${colors.reset}`, error);

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'aichat_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'check_aichat_active'
                }
            });
        }

        throw error;
    }
}


async function sendAllAiChatConfigs(socket) {
    try {
        const configs = await AiChat.find({});

        for (const config of configs) {
            socket.emit('bot_data_update', {
                type: 'aichat_config',
                payload: {
                    guildId: config.guildId,
                    channelId: config.channelId,
                    isEnabled: config.isEnabled,
                    createdAt: config.createdAt,
                    updatedAt: config.updatedAt,
                    updatedBy: config.updatedBy,
                    _id: config._id
                }
            });
        }

        console.log(`${colors.green}📊 Sent ${configs.length} AI chat configs to middleware${colors.reset}`);
    } catch (error) {
        console.error(`${colors.red}❌ Error sending all AI chat configs:${colors.reset}`, error);
    }
}


async function getAllEnabledChannels(socket) {
    try {
        const enabledConfigs = await AiChat.find({ isEnabled: true });
        const channels = enabledConfigs.map(config => ({
            guildId: config.guildId,
            channelId: config.channelId,
            updatedAt: config.updatedAt
        }));

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'aichat_enabled_channels',
                payload: {
                    channels,
                    count: channels.length
                }
            });
        }

        console.log(`${colors.blue}📊 Found ${channels.length} enabled AI chat channels${colors.reset}`);

        return channels;
    } catch (error) {
        console.error(`${colors.red}❌ Error getting enabled AI chat channels:${colors.reset}`, error);

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'aichat_error',
                payload: {
                    error: error.message,
                    action: 'get_enabled_channels'
                }
            });
        }

        throw error;
    }
}

module.exports = {
    getAiChatConfig,
    setupAiChat,
    updateAiChat,
    enableAiChat,
    disableAiChat,
    deleteAiChat,
    toggleAiChat,
    getAiChatStats,
    checkAiChatActive,
    sendAllAiChatConfigs,
    getAllEnabledChannels
};
