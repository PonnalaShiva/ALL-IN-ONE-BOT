const { VoiceChannelModel, TemporaryChannelModel, CentralizedControlModel } = require('../../../models/autoVoice/schema');
const colors = require('../../../UI/colors/colors');
const client = require('../../../main'); 
const { sendOrUpdateCentralizedEmbed, loadConfig } = require('../../../handlers/voiceChannelHandler');


function emitAutoVoiceUpdate(serverId, voiceConfig, socket) {
    socket.emit('bot_data_update', {
        type: 'autovoice_config',
        payload: {
            guildId: serverId,
            voiceChannelId: voiceConfig.voiceChannelId,
            managerChannelId: voiceConfig.managerChannelId,
            allowedRoleIds: voiceConfig.allowedRoleIds,
            status: voiceConfig.status,
            ownerId: voiceConfig.ownerId,
            _id: voiceConfig._id,
            createdAt: voiceConfig.createdAt,
            updatedAt: voiceConfig.updatedAt
        }
    });
}


async function createOrUpdateAutoVoice(guildId, voiceChannelId, managerChannelId, allowedRoleIds, status, ownerId, socket) {
    try {
        console.log(`[DEBUG] Saving AutoVoice config for Guild: ${guildId}`);

        const update = {
            serverId: guildId,
            voiceChannelId,
            managerChannelId,
            allowedRoleIds: allowedRoleIds || [],
            status,
            ownerId
        };

        const voiceConfig = await VoiceChannelModel.findOneAndUpdate(
            { serverId: guildId }, 
            { $set: update }, 
            { upsert: true, returnDocument: 'after' }
        );

        
        await loadConfig();
        const guild = client.guilds.cache.get(guildId);
        if (guild) {
            await sendOrUpdateCentralizedEmbed(client, guild);
        }

        if (socket) {
            emitAutoVoiceUpdate(guildId, voiceConfig, socket);
        }

        console.log(`${colors.green}✅ Created/Updated AutoVoice config for server ${guildId}${colors.reset}`);
        
        return voiceConfig;
    } catch (error) {
        console.error(`${colors.red}❌ Error creating/updating AutoVoice:${colors.reset}`, error);
        
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'autovoice_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'create_or_update_autovoice'
                }
            });
        }
        
        throw error;
    }
}


async function deleteAutoVoice(guildId, socket) {
    try {
        const deletedConfig = await VoiceChannelModel.findOneAndDelete({ 
            serverId: guildId 
        });
        
        if (!deletedConfig) {
            throw new Error(`AutoVoice configuration not found.`);
        }

        
        await TemporaryChannelModel.deleteMany({ guildId });
        await CentralizedControlModel.deleteOne({ guildId });

        
        await loadConfig();

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'autovoice_deleted',
                payload: { 
                    guildId,
                    _id: deletedConfig._id
                }
            });
        }

        console.log(`${colors.red}🗑️ Deleted AutoVoice configuration for server: ${guildId}${colors.reset}`);
        
        return deletedConfig;
    } catch (error) {
        console.error(`${colors.red}❌ Error deleting AutoVoice:${colors.reset}`, error);
        
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'autovoice_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'delete_autovoice'
                }
            });
        }
        
        throw error;
    }
}


async function activateAutoVoice(guildId, socket) {
    try {
        const voiceConfig = await VoiceChannelModel.findOneAndUpdate(
            { serverId: guildId },
            { status: true },
            { returnDocument: 'after' }
        );

        if (!voiceConfig) {
            throw new Error(`AutoVoice configuration not found.`);
        }

        
        await loadConfig();
        const guild = client.guilds.cache.get(guildId);
        if (guild) {
            await sendOrUpdateCentralizedEmbed(client, guild);
        }

        if (socket) {
            emitAutoVoiceUpdate(guildId, voiceConfig, socket);
        }

        console.log(`${colors.green}✅ Activated AutoVoice system for server: ${guildId}${colors.reset}`);
        
        return voiceConfig;
    } catch (error) {
        console.error(`${colors.red}❌ Error activating AutoVoice:${colors.reset}`, error);
        
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'autovoice_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'activate_autovoice'
                }
            });
        }
        
        throw error;
    }
}


async function deactivateAutoVoice(guildId, socket) {
    try {
        const voiceConfig = await VoiceChannelModel.findOneAndUpdate(
            { serverId: guildId },
            { status: false },
            { returnDocument: 'after' }
        );

        if (!voiceConfig) {
            throw new Error(`AutoVoice configuration not found.`);
        }

        
        await loadConfig();

        if (socket) {
            emitAutoVoiceUpdate(guildId, voiceConfig, socket);
        }

        console.log(`${colors.yellow}⚠️ Deactivated AutoVoice system for server: ${guildId}${colors.reset}`);
        
        return voiceConfig;
    } catch (error) {
        console.error(`${colors.red}❌ Error deactivating AutoVoice:${colors.reset}`, error);
        
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'autovoice_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'deactivate_autovoice'
                }
            });
        }
        
        throw error;
    }
}


async function updateAutoVoice(guildId, updateData, socket) {
    try {
        const voiceConfig = await VoiceChannelModel.findOneAndUpdate(
            { serverId: guildId },
            { $set: updateData },
            { returnDocument: 'after' }
        );

        if (!voiceConfig) {
            throw new Error(`AutoVoice configuration not found.`);
        }

        
        await loadConfig();
        const guild = client.guilds.cache.get(guildId);
        if (guild) {
            await sendOrUpdateCentralizedEmbed(client, guild);
        }

        if (socket) {
            emitAutoVoiceUpdate(guildId, voiceConfig, socket);
        }

        console.log(`${colors.cyan}🔄 Updated AutoVoice configuration for server: ${guildId}${colors.reset}`);
        
        return voiceConfig;
    } catch (error) {
        console.error(`${colors.red}❌ Error updating AutoVoice:${colors.reset}`, error);
        
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'autovoice_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'update_autovoice'
                }
            });
        }
        
        throw error;
    }
}


async function getAutoVoiceConfig(guildId, socket) {
    try {
        const voiceConfig = await VoiceChannelModel.findOne({ serverId: guildId });
        
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'server_autovoice',
                payload: {
                    guildId,
                    config: voiceConfig ? {
                        voiceChannelId: voiceConfig.voiceChannelId,
                        managerChannelId: voiceConfig.managerChannelId,
                        allowedRoleIds: voiceConfig.allowedRoleIds,
                        status: voiceConfig.status,
                        ownerId: voiceConfig.ownerId,
                        _id: voiceConfig._id,
                        createdAt: voiceConfig.createdAt,
                        updatedAt: voiceConfig.updatedAt
                    } : null
                }
            });
        }
        
        return voiceConfig;
    } catch (error) {
        console.error(`${colors.red}❌ Error getting AutoVoice config:${colors.reset}`, error);
        
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'autovoice_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'get_autovoice_config'
                }
            });
        }
        
        throw error;
    }
}


async function getTemporaryChannels(guildId, socket) {
    try {
        const tempChannels = await TemporaryChannelModel.find({ guildId });
        
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'temporary_channels',
                payload: {
                    guildId,
                    channels: tempChannels.map(tc => ({
                        channelId: tc.channelId,
                        userId: tc.userId,
                        name: tc.name,
                        description: tc.description,
                        createdAt: tc.createdAt,
                        _id: tc._id
                    }))
                }
            });
        }
        
        return tempChannels;
    } catch (error) {
        console.error(`${colors.red}❌ Error getting temporary channels:${colors.reset}`, error);
        
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'autovoice_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'get_temporary_channels'
                }
            });
        }
        
        throw error;
    }
}


async function forceDeleteTemporaryChannel(guildId, channelId, socket) {
    try {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            throw new Error('Guild not found');
        }

        const channel = guild.channels.cache.get(channelId);
        if (channel) {
            await channel.delete();
        }

        const deletedChannel = await TemporaryChannelModel.findOneAndDelete({ 
            channelId, 
            guildId 
        });

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'temporary_channel_deleted',
                payload: {
                    guildId,
                    channelId,
                    _id: deletedChannel?._id
                }
            });
        }

        console.log(`${colors.red}🗑️ Force deleted temporary channel: ${channelId}${colors.reset}`);
        
        return deletedChannel;
    } catch (error) {
        console.error(`${colors.red}❌ Error force deleting temporary channel:${colors.reset}`, error);
        
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'autovoice_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'force_delete_temporary_channel'
                }
            });
        }
        
        throw error;
    }
}


async function refreshControlPanel(guildId, socket) {
    try {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            throw new Error('Guild not found');
        }

        await sendOrUpdateCentralizedEmbed(client, guild);

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'control_panel_refreshed',
                payload: {
                    guildId,
                    timestamp: Date.now()
                }
            });
        }

        console.log(`${colors.green}🔄 Refreshed control panel for server: ${guildId}${colors.reset}`);
        
        return true;
    } catch (error) {
        console.error(`${colors.red}❌ Error refreshing control panel:${colors.reset}`, error);
        
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'autovoice_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'refresh_control_panel'
                }
            });
        }
        
        throw error;
    }
}


async function sendAllAutoVoiceConfigs(socket) {
    try {
        const voiceConfigs = await VoiceChannelModel.find({});
        
        for (const config of voiceConfigs) {
            socket.emit('bot_data_update', {
                type: 'autovoice_config',
                payload: {
                    guildId: config.serverId,
                    voiceChannelId: config.voiceChannelId,
                    managerChannelId: config.managerChannelId,
                    allowedRoleIds: config.allowedRoleIds,
                    status: config.status,
                    ownerId: config.ownerId,
                    _id: config._id,
                    createdAt: config.createdAt,
                    updatedAt: config.updatedAt
                }
            });
        }
        
        console.log(`${colors.green}📊 Sent ${voiceConfigs.length} AutoVoice configs to middleware${colors.reset}`);
    } catch (error) {
        console.error(`${colors.red}❌ Error sending all AutoVoice configs:${colors.reset}`, error);
    }
}


async function cleanupTemporaryChannels(guildId, socket) {
    try {
        const now = Date.now();
        const outdatedChannels = await TemporaryChannelModel.find({
            guildId,
            isTemporary: true,
            createdAt: { $lt: new Date(now - 6 * 60 * 60 * 1000) } 
        });

        const guild = client.guilds.cache.get(guildId);
        if (!guild) return;

        let cleanedCount = 0;
        for (const tempChannel of outdatedChannels) {
            const channelObj = guild.channels.cache.get(tempChannel.channelId);
            if (channelObj) {
                await channelObj.delete();
                cleanedCount++;
            }
            await TemporaryChannelModel.deleteOne({ channelId: tempChannel.channelId });
        }

        if (socket && cleanedCount > 0) {
            socket.emit('bot_data_update', {
                type: 'temporary_channels_cleaned',
                payload: {
                    guildId,
                    cleanedCount
                }
            });
        }

        console.log(`${colors.yellow}🧹 Cleaned up ${cleanedCount} outdated temporary channels for server: ${guildId}${colors.reset}`);
        
        return cleanedCount;
    } catch (error) {
        console.error(`${colors.red}❌ Error cleaning up temporary channels:${colors.reset}`, error);
        
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'autovoice_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'cleanup_temporary_channels'
                }
            });
        }
        
        throw error;
    }
}


async function getAutoVoiceStats(guildId, socket) {
    try {
        const config = await VoiceChannelModel.findOne({ serverId: guildId });
        const tempChannelCount = await TemporaryChannelModel.countDocuments({ guildId });
        const controlMessage = await CentralizedControlModel.findOne({ guildId });

        const stats = {
            hasConfig: !!config,
            isActive: config?.status || false,
            tempChannelCount,
            hasControlPanel: !!controlMessage,
            voiceChannelId: config?.voiceChannelId,
            managerChannelId: config?.managerChannelId,
            allowedRoleCount: config?.allowedRoleIds?.length || 0
        };

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'autovoice_stats',
                payload: {
                    guildId,
                    stats
                }
            });
        }

        return stats;
    } catch (error) {
        console.error(`${colors.red}❌ Error getting AutoVoice stats:${colors.reset}`, error);
        
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'autovoice_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'get_autovoice_stats'
                }
            });
        }
        
        throw error;
    }
}

module.exports = {
    createOrUpdateAutoVoice,
    deleteAutoVoice,
    activateAutoVoice,
    deactivateAutoVoice,
    updateAutoVoice,
    getAutoVoiceConfig,
    getTemporaryChannels,
    forceDeleteTemporaryChannel,
    refreshControlPanel,
    sendAllAutoVoiceConfigs,
    cleanupTemporaryChannels,
    getAutoVoiceStats
};
