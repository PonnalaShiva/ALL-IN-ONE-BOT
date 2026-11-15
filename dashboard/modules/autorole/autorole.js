const colors = require('../../../UI/colors/colors');
const Autorole = require('../../../models/autorole/autorole');


async function sendAllAutoroleConfigs(socket) {
    try {
        console.log(`${colors.blue}📊 Sending all autorole configs to middleware${colors.reset}`);
        
        const allConfigs = await Autorole.find({});
        
        for (const config of allConfigs) {
            
            emitAutoroleUpdate(config.serverId, config, socket, 'server_autorole_config');
        }
        
        console.log(`${colors.green}✅ Sent ${allConfigs.length} autorole configs to middleware${colors.reset}`);
        
    } catch (error) {
        console.error(`${colors.red}❌ Error sending all autorole configs:${colors.reset}`, error);
    }
}


function emitAutoroleUpdate(serverId, config, socket, eventType = 'autorole_config') {
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


async function setupAutoroleSystem(serverId, config, socket) {
    try {
        console.log(`${colors.blue}🎭 Setting up autorole system for server ${serverId}${colors.reset}`);
        
        const autoroleConfig = await Autorole.findOneAndUpdate(
            { serverId: serverId },  
            {
                serverId: serverId,   
                roleId: config.roleId,
                status: config.status,
                ownerId: config.ownerId
            },
            { 
                upsert: true, 
                returnDocument: 'after',
                setDefaultsOnInsert: true
            }
        );

        console.log(`${colors.green}✅ Autorole system setup completed for server ${serverId}${colors.reset}`);
        
        emitAutoroleUpdate(serverId, autoroleConfig, socket, 'autorole_config');
        
        return autoroleConfig;
        
    } catch (error) {
        console.error(`${colors.red}❌ Error setting up autorole system for server ${serverId}:${colors.reset}`, error);
        
        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'autorole_error',
                payload: {
                    serverId: serverId,
                    error: error.message,
                    action: 'setup_autorole_system',
                    timestamp: Date.now()
                }
            });
        }
        
        throw error;
    }
}


async function updateAutoroleConfig(serverId, config, socket) {
    try {
        console.log(`${colors.blue}🔄 Updating autorole system for server ${serverId}${colors.reset}`);
        
        const autoroleConfig = await Autorole.findOneAndUpdate(
            { serverId: serverId },
            {
                serverId: serverId,
                roleId: config.roleId,
                status: config.status,
                ownerId: config.ownerId
            },
            { 
                returnDocument: 'after',
                upsert: true
            }
        );

        console.log(`${colors.green}✅ Autorole system updated for server ${serverId}${colors.reset}`);
        
        emitAutoroleUpdate(serverId, autoroleConfig, socket, 'autorole_config');
        
        return autoroleConfig;
        
    } catch (error) {
        console.error(`${colors.red}❌ Error updating autorole system for server ${serverId}:${colors.reset}`, error);
        
        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'autorole_error',
                payload: {
                    serverId: serverId,
                    error: error.message,
                    action: 'update_autorole_config',
                    timestamp: Date.now()
                }
            });
        }
        
        throw error;
    }
}

async function getAutoroleConfig(serverId, socket) {
    try {
        console.log(`${colors.blue}📋 Getting autorole config for server ${serverId}${colors.reset}`);
        
        const config = await Autorole.findOne({ serverId: serverId });
        
        console.log(`${colors.green}✅ Autorole config retrieved for server ${serverId}${colors.reset}`);
        
        emitAutoroleUpdate(serverId, config, socket, 'server_autorole_config');
        
        return config;
        
    } catch (error) {
        console.error(`${colors.red}❌ Error getting autorole config for server ${serverId}:${colors.reset}`, error);
        
        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'autorole_error',
                payload: {
                    serverId: serverId,
                    error: error.message,
                    action: 'get_autorole_config',
                    timestamp: Date.now()
                }
            });
        }
        
        throw error;
    }
}

async function toggleAutoroleStatus(serverId, socket) {
    try {
        console.log(`${colors.blue}🔄 Toggling autorole status for server ${serverId}${colors.reset}`);
        
        const currentConfig = await Autorole.findOne({ serverId: serverId });
        if (!currentConfig) {
            throw new Error('Autorole configuration not found');
        }

        const updatedConfig = await Autorole.findOneAndUpdate(
            { serverId: serverId },
            { status: !currentConfig.status },
            { returnDocument: 'after' }
        );

        console.log(`${colors.green}✅ Autorole status toggled for server ${serverId}${colors.reset}`);
        
        emitAutoroleUpdate(serverId, updatedConfig, socket, 'autorole_config');
        
        return updatedConfig;
        
    } catch (error) {
        console.error(`${colors.red}❌ Error toggling autorole status for server ${serverId}:${colors.reset}`, error);
        
        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'autorole_error',
                payload: {
                    serverId: serverId,
                    error: error.message,
                    action: 'toggle_autorole_status',
                    timestamp: Date.now()
                }
            });
        }
        
        throw error;
    }
}

async function deleteAutoroleConfig(serverId, socket) {
    try {
        console.log(`${colors.blue}🗑️ Deleting autorole config for server ${serverId}${colors.reset}`);
        
        await Autorole.findOneAndDelete({ serverId: serverId });
        
        console.log(`${colors.green}✅ Autorole config deleted for server ${serverId}${colors.reset}`);
        
        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'autorole_deleted',
                payload: {
                    serverId: serverId,
                    timestamp: Date.now()
                }
            });
        }
        
        return { deleted: true };
        
    } catch (error) {
        console.error(`${colors.red}❌ Error deleting autorole config for server ${serverId}:${colors.reset}`, error);
        
        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'autorole_error',
                payload: {
                    serverId: serverId,
                    error: error.message,
                    action: 'delete_autorole_config',
                    timestamp: Date.now()
                }
            });
        }
        
        throw error;
    }
}

module.exports = {
    setupAutoroleSystem,
    updateAutoroleConfig,
    getAutoroleConfig,
    toggleAutoroleStatus,
    deleteAutoroleConfig,
    sendAllAutoroleConfigs
};
