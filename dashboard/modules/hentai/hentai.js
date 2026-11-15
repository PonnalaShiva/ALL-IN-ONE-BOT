const colors = require('../../../UI/colors/colors');
const HentaiConfig = require('../../../models/hentai/hentaiSchema');


async function sendAllHentaiConfigs(socket) {
    try {
        console.log(`${colors.blue}📊 Sending all hentai configs to middleware${colors.reset}`);
        
        const allConfigs = await HentaiConfig.find({});
        
        for (const config of allConfigs) {
            emitHentaiUpdate(config.serverId, config, socket, 'server_hentai_config');
        }
        
        console.log(`${colors.green}✅ Sent ${allConfigs.length} hentai configs to middleware${colors.reset}`);
        
    } catch (error) {
        console.error(`${colors.red}❌ Error sending all hentai configs:${colors.reset}`, error);
    }
}


function emitHentaiUpdate(serverId, config, socket, eventType = 'hentai_config') {
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


async function setupHentaiSystem(serverId, config, socket) {
    try {
        console.log(`${colors.blue}🔞 Setting up hentai system for server ${serverId}${colors.reset}`);
        
        const hentaiConfig = await HentaiConfig.findOneAndUpdate(
            { serverId: serverId },
            {
                serverId: serverId,
                status: config.status,
                ownerId: config.ownerId
            },
            { 
                upsert: true, 
                returnDocument: 'after',
                setDefaultsOnInsert: true
            }
        );

        console.log(`${colors.green}✅ Hentai system setup completed for server ${serverId}${colors.reset}`);
        
        emitHentaiUpdate(serverId, hentaiConfig, socket, 'hentai_config');
        
        return hentaiConfig;
        
    } catch (error) {
        console.error(`${colors.red}❌ Error setting up hentai system for server ${serverId}:${colors.reset}`, error);
        
        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'hentai_error',
                payload: {
                    serverId: serverId,
                    error: error.message,
                    action: 'setup_hentai_system',
                    timestamp: Date.now()
                }
            });
        }
        
        throw error;
    }
}


async function updateHentaiConfig(serverId, config, socket) {
    try {
        console.log(`${colors.blue}🔄 Updating hentai system for server ${serverId}${colors.reset}`);
        
        const hentaiConfig = await HentaiConfig.findOneAndUpdate(
            { serverId: serverId },
            {
                serverId: serverId,
                status: config.status,
                ownerId: config.ownerId
            },
            { 
                returnDocument: 'after',
                upsert: true
            }
        );

        console.log(`${colors.green}✅ Hentai system updated for server ${serverId}${colors.reset}`);
        
        emitHentaiUpdate(serverId, hentaiConfig, socket, 'hentai_config');
        
        return hentaiConfig;
        
    } catch (error) {
        console.error(`${colors.red}❌ Error updating hentai system for server ${serverId}:${colors.reset}`, error);
        
        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'hentai_error',
                payload: {
                    serverId: serverId,
                    error: error.message,
                    action: 'update_hentai_config',
                    timestamp: Date.now()
                }
            });
        }
        
        throw error;
    }
}


async function getHentaiConfig(serverId, socket) {
    try {
        console.log(`${colors.blue}📋 Getting hentai config for server ${serverId}${colors.reset}`);
        
        const config = await HentaiConfig.findOne({ serverId: serverId });
        
        console.log(`${colors.green}✅ Hentai config retrieved for server ${serverId}${colors.reset}`);
        
        emitHentaiUpdate(serverId, config, socket, 'server_hentai_config');
        
        return config;
        
    } catch (error) {
        console.error(`${colors.red}❌ Error getting hentai config for server ${serverId}:${colors.reset}`, error);
        
        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'hentai_error',
                payload: {
                    serverId: serverId,
                    error: error.message,
                    action: 'get_hentai_config',
                    timestamp: Date.now()
                }
            });
        }
        
        throw error;
    }
}


async function toggleHentaiStatus(serverId, socket) {
    try {
        console.log(`${colors.blue}🔄 Toggling hentai status for server ${serverId}${colors.reset}`);
        
        const currentConfig = await HentaiConfig.findOne({ serverId: serverId });
        if (!currentConfig) {
            throw new Error('Hentai configuration not found');
        }

        const updatedConfig = await HentaiConfig.findOneAndUpdate(
            { serverId: serverId },
            { status: !currentConfig.status },
            { returnDocument: 'after' }
        );

        console.log(`${colors.green}✅ Hentai status toggled for server ${serverId}${colors.reset}`);
        
        emitHentaiUpdate(serverId, updatedConfig, socket, 'hentai_config');
        
        return updatedConfig;
        
    } catch (error) {
        console.error(`${colors.red}❌ Error toggling hentai status for server ${serverId}:${colors.reset}`, error);
        
        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'hentai_error',
                payload: {
                    serverId: serverId,
                    error: error.message,
                    action: 'toggle_hentai_status',
                    timestamp: Date.now()
                }
            });
        }
        
        throw error;
    }
}


async function deleteHentaiConfig(serverId, socket) {
    try {
        console.log(`${colors.blue}🗑️ Deleting hentai config for server ${serverId}${colors.reset}`);
        
        await HentaiConfig.findOneAndDelete({ serverId: serverId });
        
        console.log(`${colors.green}✅ Hentai config deleted for server ${serverId}${colors.reset}`);
        
        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'hentai_deleted',
                payload: {
                    serverId: serverId,
                    timestamp: Date.now()
                }
            });
        }
        
        return { deleted: true };
        
    } catch (error) {
        console.error(`${colors.red}❌ Error deleting hentai config for server ${serverId}:${colors.reset}`, error);
        
        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'hentai_error',
                payload: {
                    serverId: serverId,
                    error: error.message,
                    action: 'delete_hentai_config',
                    timestamp: Date.now()
                }
            });
        }
        
        throw error;
    }
}

module.exports = {
    setupHentaiSystem,
    updateHentaiConfig,
    getHentaiConfig,
    toggleHentaiStatus,
    deleteHentaiConfig,
    sendAllHentaiConfigs
};
