const colors = require('../../../UI/colors/colors');
const WelcomeSettings = require('../../../models/welcome/WelcomeSettings');
const client = require('../../../main');

async function sendAllWelcomeConfigs(socket) {
    try {
        console.log(`${colors.blue}📊 Sending all welcome configs to middleware${colors.reset}`);

        const allWelcomeConfigs = await WelcomeSettings.find({});

        for (const config of allWelcomeConfigs) {
            emitWelcomeUpdate(config.serverId, config, socket, 'server_welcome_config');
        }

        console.log(`${colors.green}✅ Sent ${allWelcomeConfigs.length} welcome configs to middleware${colors.reset}`);

    } catch (error) {
        console.error(`${colors.red}❌ Error sending all welcome configs:${colors.reset}`, error);
    }
}


function emitWelcomeUpdate(serverId, welcomeConfig, socket, eventType = 'welcome_config') {
    if (socket && socket.emit) {
        socket.emit('bot_data_update', {
            type: eventType,
            payload: {                    
                serverId: serverId,
                config: welcomeConfig,
                timestamp: Date.now()
            }
        });
    }
}


async function setupWelcomeSystem(serverId, config, socket) {
    try {
        console.log(`${colors.blue}🚀 Setting up welcome system for server ${serverId}${colors.reset}`);

        
        const guild = client.guilds.cache.get(serverId);
        const ownerId = config.ownerId || guild?.ownerId;
        if (!ownerId) {
            throw new Error('Could not determine guild owner. Please try again.');
        }

        const welcomeConfig = await WelcomeSettings.findOneAndUpdate(
            { serverId: serverId },
            {
                serverId: serverId,
                ownerId: ownerId,
                welcomeChannelId: config.welcomeChannelId,
                channelStatus: config.channelStatus || false,
                dmStatus: config.dmStatus || false,
                ...config
            },
            {
                upsert: true,
                returnDocument: 'after',
                setDefaultsOnInsert: true
            }
        );

        console.log(`${colors.green}✅ Welcome system setup completed for server ${serverId}${colors.reset}`);

        emitWelcomeUpdate(serverId, welcomeConfig, socket, 'welcome_config');

        return welcomeConfig;

    } catch (error) {
        console.error(`${colors.red}❌ Error setting up welcome system for server ${serverId}:${colors.reset}`, error);

        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'welcome_error',
                payload: {                
                    serverId: serverId,
                    error: error.message,
                    action: 'setup_welcome_system',
                    timestamp: Date.now()
                }
            });
        }

        throw error;
    }
}


async function updateWelcomeConfig(serverId, updates, socket) {
    try {
        console.log(`${colors.blue}🔄 Updating welcome config for server ${serverId}${colors.reset}`);

        const welcomeConfig = await WelcomeSettings.findOneAndUpdate(
            { serverId: serverId },
            updates,
            {
                upsert: true,
                returnDocument: 'after',
                setDefaultsOnInsert: true
            }
        );

        console.log(`${colors.green}✅ Welcome config updated for server ${serverId}${colors.reset}`);

        emitWelcomeUpdate(serverId, welcomeConfig, socket, 'welcome_config');

        return welcomeConfig;

    } catch (error) {
        console.error(`${colors.red}❌ Error updating welcome config for server ${serverId}:${colors.reset}`, error);

        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'welcome_error',
                payload: {                
                    serverId: serverId,
                    error: error.message,
                    action: 'update_welcome_config',
                    timestamp: Date.now()
                }
            });
        }

        throw error;
    }
}


async function getWelcomeConfig(serverId, socket) {
    try {
        console.log(`${colors.blue}📋 Getting welcome config for server ${serverId}${colors.reset}`);

        const welcomeConfig = await WelcomeSettings.findOne({ serverId: serverId });

        console.log(`${colors.green}✅ Welcome config retrieved for server ${serverId}${colors.reset}`);

        emitWelcomeUpdate(serverId, welcomeConfig, socket, 'server_welcome_config');

        return welcomeConfig;

    } catch (error) {
        console.error(`${colors.red}❌ Error getting welcome config for server ${serverId}:${colors.reset}`, error);

        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'welcome_error',
                payload: {                
                    serverId: serverId,
                    error: error.message,
                    action: 'get_welcome_config',
                    timestamp: Date.now()
                }
            });
        }

        throw error;
    }
}


async function deleteWelcomeConfig(serverId, socket) {
    try {
        console.log(`${colors.blue}🗑️ Deleting welcome config for server ${serverId}${colors.reset}`);

        await WelcomeSettings.findOneAndDelete({ serverId: serverId });

        console.log(`${colors.green}✅ Welcome config deleted for server ${serverId}${colors.reset}`);

        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'welcome_deleted',
                payload: {                
                    serverId: serverId,
                    timestamp: Date.now()
                }
            });
        }

        return { deleted: true };

    } catch (error) {
        console.error(`${colors.red}❌ Error deleting welcome config for server ${serverId}:${colors.reset}`, error);

        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'welcome_error',
                payload: {                
                    serverId: serverId,
                    error: error.message,
                    action: 'delete_welcome_config',
                    timestamp: Date.now()
                }
            });
        }

        throw error;
    }
}


async function enableWelcomeSystem(serverId, socket) {
    try {
        console.log(`${colors.blue}✅ Enabling welcome system for server ${serverId}${colors.reset}`);

        const welcomeConfig = await WelcomeSettings.findOneAndUpdate(
            { serverId: serverId },
            { channelStatus: true },
            { returnDocument: 'after' }
        );

        console.log(`${colors.green}✅ Welcome system enabled for server ${serverId}${colors.reset}`);

        emitWelcomeUpdate(serverId, welcomeConfig, socket, 'welcome_config');

        return welcomeConfig;

    } catch (error) {
        console.error(`${colors.red}❌ Error enabling welcome system for server ${serverId}:${colors.reset}`, error);

        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'welcome_error',
                payload: {                
                    serverId: serverId,
                    error: error.message,
                    action: 'enable_welcome_system',
                    timestamp: Date.now()
                }
            });
        }

        throw error;
    }
}


async function disableWelcomeSystem(serverId, socket) {
    try {
        console.log(`${colors.blue}❌ Disabling welcome system for server ${serverId}${colors.reset}`);

        const welcomeConfig = await WelcomeSettings.findOneAndUpdate(
            { serverId: serverId },
            { channelStatus: false, dmStatus: false },
            { returnDocument: 'after' }
        );

        console.log(`${colors.green}✅ Welcome system disabled for server ${serverId}${colors.reset}`);

        emitWelcomeUpdate(serverId, welcomeConfig, socket, 'welcome_config');

        return welcomeConfig;

    } catch (error) {
        console.error(`${colors.red}❌ Error disabling welcome system for server ${serverId}:${colors.reset}`, error);

        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'welcome_error',
                payload: {                
                    serverId: serverId,
                    error: error.message,
                    action: 'disable_welcome_system',
                    timestamp: Date.now()
                }
            });
        }

        throw error;
    }
}


async function toggleWelcomeChannel(serverId, status, socket) {
    try {
        console.log(`${colors.blue}🔄 Toggling welcome channel status for server ${serverId} to ${status}${colors.reset}`);

        const welcomeConfig = await WelcomeSettings.findOneAndUpdate(
            { serverId: serverId },
            { channelStatus: status },
            { returnDocument: 'after' }
        );

        console.log(`${colors.green}✅ Welcome channel status toggled for server ${serverId}${colors.reset}`);

        emitWelcomeUpdate(serverId, welcomeConfig, socket, 'welcome_config');

        return welcomeConfig;

    } catch (error) {
        console.error(`${colors.red}❌ Error toggling welcome channel for server ${serverId}:${colors.reset}`, error);

        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'welcome_error',
                payload: {                
                    serverId: serverId,
                    error: error.message,
                    action: 'toggle_welcome_channel',
                    timestamp: Date.now()
                }
            });
        }

        throw error;
    }
}


async function toggleWelcomeDM(serverId, status, socket) {
    try {
        console.log(`${colors.blue}🔄 Toggling welcome DM status for server ${serverId} to ${status}${colors.reset}`);

        const welcomeConfig = await WelcomeSettings.findOneAndUpdate(
            { serverId: serverId },
            { dmStatus: status },
            { returnDocument: 'after' }
        );

        console.log(`${colors.green}✅ Welcome DM status toggled for server ${serverId}${colors.reset}`);

        emitWelcomeUpdate(serverId, welcomeConfig, socket, 'welcome_config');

        return welcomeConfig;

    } catch (error) {
        console.error(`${colors.red}❌ Error toggling welcome DM for server ${serverId}:${colors.reset}`, error);

        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'welcome_error',
                payload: {                
                    serverId: serverId,
                    error: error.message,
                    action: 'toggle_welcome_dm',
                    timestamp: Date.now()
                }
            });
        }

        throw error;
    }
}

module.exports = {
    setupWelcomeSystem,
    updateWelcomeConfig,
    getWelcomeConfig,
    deleteWelcomeConfig,
    enableWelcomeSystem,
    disableWelcomeSystem,
    toggleWelcomeChannel,
    toggleWelcomeDM,
    sendAllWelcomeConfigs
};
