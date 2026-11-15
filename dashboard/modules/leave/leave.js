const colors = require('../../../UI/colors/colors');
const LeaveSettings = require('../../../models/leave/LeaveSettings');
const client = require('../../../main');


async function sendAllLeaveConfigs(socket) {
    try {
        console.log(`${colors.blue}📊 Sending all leave configs to middleware${colors.reset}`);

        const allConfigs = await LeaveSettings.find({});

        for (const config of allConfigs) {
            emitLeaveUpdate(config.serverId, config, socket, 'server_leave_config');
        }

        console.log(`${colors.green}✅ Sent ${allConfigs.length} leave configs to middleware${colors.reset}`);

    } catch (error) {
        console.error(`${colors.red}❌ Error sending all leave configs:${colors.reset}`, error);
    }
}


function emitLeaveUpdate(serverId, config, socket, eventType = 'leave_config') {
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


async function setupLeaveSystem(serverId, config, socket) {
    try {
        console.log(`${colors.blue}🚪 Setting up leave system for server ${serverId}${colors.reset}`);

        
        const guild = client.guilds.cache.get(serverId);
        const ownerId = config.ownerId || guild?.ownerId;
        if (!ownerId) {
            throw new Error('Could not determine guild owner. Please try again.');
        }

        const leaveConfig = await LeaveSettings.findOneAndUpdate(
            { serverId: serverId },
            {
                serverId: serverId,
                ownerId: ownerId,
                leaveChannelId: config.leaveChannelId,
                channelStatus: config.channelStatus,
                dmStatus: config.dmStatus,
                channelEmbed: config.channelEmbed,
                dmEmbed: config.dmEmbed
            },
            {
                upsert: true,
                returnDocument: 'after',
                setDefaultsOnInsert: true
            }
        );

        console.log(`${colors.green}✅ Leave system setup completed for server ${serverId}${colors.reset}`);

        emitLeaveUpdate(serverId, leaveConfig, socket, 'leave_config');

        return leaveConfig;

    } catch (error) {
        console.error(`${colors.red}❌ Error setting up leave system for server ${serverId}:${colors.reset}`, error);

        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'leave_error',
                payload: {
                    serverId: serverId,
                    error: error.message,
                    action: 'setup_leave_system',
                    timestamp: Date.now()
                }
            });
        }

        throw error;
    }
}


async function updateLeaveConfig(serverId, config, socket) {
    try {
        console.log(`${colors.blue}🔄 Updating leave system for server ${serverId}${colors.reset}`);

        const leaveConfig = await LeaveSettings.findOneAndUpdate(
            { serverId: serverId },
            {
                serverId: serverId,
                ownerId: config.ownerId,
                leaveChannelId: config.leaveChannelId,
                channelStatus: config.channelStatus,
                dmStatus: config.dmStatus,
                channelEmbed: config.channelEmbed,
                dmEmbed: config.dmEmbed
            },
            {
                returnDocument: 'after',
                upsert: true
            }
        );

        console.log(`${colors.green}✅ Leave system updated for server ${serverId}${colors.reset}`);

        emitLeaveUpdate(serverId, leaveConfig, socket, 'leave_config');

        return leaveConfig;

    } catch (error) {
        console.error(`${colors.red}❌ Error updating leave system for server ${serverId}:${colors.reset}`, error);

        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'leave_error',
                payload: {
                    serverId: serverId,
                    error: error.message,
                    action: 'update_leave_config',
                    timestamp: Date.now()
                }
            });
        }

        throw error;
    }
}


async function getLeaveConfig(serverId, socket) {
    try {
        console.log(`${colors.blue}📋 Getting leave config for server ${serverId}${colors.reset}`);

        const config = await LeaveSettings.findOne({ serverId: serverId });

        console.log(`${colors.green}✅ Leave config retrieved for server ${serverId}${colors.reset}`);

        emitLeaveUpdate(serverId, config, socket, 'server_leave_config');

        return config;

    } catch (error) {
        console.error(`${colors.red}❌ Error getting leave config for server ${serverId}:${colors.reset}`, error);

        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'leave_error',
                payload: {
                    serverId: serverId,
                    error: error.message,
                    action: 'get_leave_config',
                    timestamp: Date.now()
                }
            });
        }

        throw error;
    }
}


async function toggleLeaveChannelStatus(serverId, status, socket) {
    try {
        console.log(`${colors.blue}🔄 Toggling leave channel status for server ${serverId}${colors.reset}`);

        const currentConfig = await LeaveSettings.findOne({ serverId: serverId });
        if (!currentConfig) {
            throw new Error('Leave configuration not found');
        }

        
        const newStatus = (status !== undefined && status !== null) ? !!status : !currentConfig.channelStatus;

        const updatedConfig = await LeaveSettings.findOneAndUpdate(
            { serverId: serverId },
            { channelStatus: newStatus },
            { returnDocument: 'after' }
        );

        console.log(`${colors.green}✅ Leave channel status toggled for server ${serverId}${colors.reset}`);

        emitLeaveUpdate(serverId, updatedConfig, socket, 'leave_config');

        return updatedConfig;

    } catch (error) {
        console.error(`${colors.red}❌ Error toggling leave channel status for server ${serverId}:${colors.reset}`, error);

        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'leave_error',
                payload: {
                    serverId: serverId,
                    error: error.message,
                    action: 'toggle_leave_channel_status',
                    timestamp: Date.now()
                }
            });
        }

        throw error;
    }
}


async function toggleLeaveDMStatus(serverId, status, socket) {
    try {
        console.log(`${colors.blue}🔄 Toggling leave DM status for server ${serverId}${colors.reset}`);

        const currentConfig = await LeaveSettings.findOne({ serverId: serverId });
        if (!currentConfig) {
            throw new Error('Leave configuration not found');
        }

        
        const newStatus = (status !== undefined && status !== null) ? !!status : !currentConfig.dmStatus;

        const updatedConfig = await LeaveSettings.findOneAndUpdate(
            { serverId: serverId },
            { dmStatus: newStatus },
            { returnDocument: 'after' }
        );

        console.log(`${colors.green}✅ Leave DM status toggled for server ${serverId}${colors.reset}`);

        emitLeaveUpdate(serverId, updatedConfig, socket, 'leave_config');

        return updatedConfig;

    } catch (error) {
        console.error(`${colors.red}❌ Error toggling leave DM status for server ${serverId}:${colors.reset}`, error);

        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'leave_error',
                payload: {
                    serverId: serverId,
                    error: error.message,
                    action: 'toggle_leave_dm_status',
                    timestamp: Date.now()
                }
            });
        }

        throw error;
    }
}


async function deleteLeaveConfig(serverId, socket) {
    try {
        console.log(`${colors.blue}🗑️ Deleting leave config for server ${serverId}${colors.reset}`);

        await LeaveSettings.findOneAndDelete({ serverId: serverId });

        console.log(`${colors.green}✅ Leave config deleted for server ${serverId}${colors.reset}`);

        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'leave_deleted',
                payload: {
                    serverId: serverId,
                    timestamp: Date.now()
                }
            });
        }

        return { deleted: true };

    } catch (error) {
        console.error(`${colors.red}❌ Error deleting leave config for server ${serverId}:${colors.reset}`, error);

        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'leave_error',
                payload: {
                    serverId: serverId,
                    error: error.message,
                    action: 'delete_leave_config',
                    timestamp: Date.now()
                }
            });
        }

        throw error;
    }
}

module.exports = {
    setupLeaveSystem,
    updateLeaveConfig,
    getLeaveConfig,
    toggleLeaveChannelStatus,
    toggleLeaveDMStatus,
    deleteLeaveConfig,
    sendAllLeaveConfigs
};
