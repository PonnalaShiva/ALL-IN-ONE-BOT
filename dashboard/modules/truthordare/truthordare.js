const colors = require('../../../UI/colors/colors');
const TruthOrDareConfig = require('../../../models/truthordare/TruthOrDareConfig');
const { sendTruthOrDareEmbed } = require('./activation');
const client = require('../../../main');
async function sendAllTruthOrDareConfigs(socket) {
    try {
        console.log(`${colors.blue}📊 Sending all truth or dare configs to middleware${colors.reset}`);
        
        const allConfigs = await TruthOrDareConfig.find({});
        
        for (const config of allConfigs) {
            emitTruthOrDareUpdate(config.serverId, config, socket, 'server_truthordare_config');
        }
        
        console.log(`${colors.green}✅ Sent ${allConfigs.length} truth or dare configs to middleware${colors.reset}`);
        
    } catch (error) {
        console.error(`${colors.red}❌ Error sending all truth or dare configs:${colors.reset}`, error);
    }
}


function emitTruthOrDareUpdate(serverId, config, socket, eventType = 'truthordare_config') {
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


async function setupTruthOrDareSystem(serverId, config, socket) {
    try {
        console.log(`${colors.blue}🎭 Setting up truth or dare system for server ${serverId}${colors.reset}`);
        
        const truthOrDareConfig = await TruthOrDareConfig.findOneAndUpdate(
            { serverId: serverId },
            {
                serverId: serverId,
                channelId: config.channelId
            },
            { 
                upsert: true, 
                returnDocument: 'after',
                setDefaultsOnInsert: true
            }
        );

        console.log(`${colors.green}✅ Truth or dare system setup completed for server ${serverId}${colors.reset}`);
         
         const guild = await client.guilds.fetch(serverId).catch(() => null);
         if (!guild) {
             console.warn(`⚠️ Could not find guild with ID ${serverId}`);
         } else {
             const channel = guild.channels.cache.get(config.channelId);
             if (!channel || !channel.isTextBased()) {
                 console.warn(`⚠️ Channel ${config.channelId} not found or not text-based`);
             } else {
                 await sendTruthOrDareEmbed(channel);
             }
         }
 
        emitTruthOrDareUpdate(serverId, truthOrDareConfig, socket, 'truthordare_config');
        
        return truthOrDareConfig;
        
    } catch (error) {
        console.error(`${colors.red}❌ Error setting up truth or dare system for server ${serverId}:${colors.reset}`, error);
        
        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'truthordare_error',
                payload: {
                    serverId: serverId,
                    error: error.message,
                    action: 'setup_truthordare_system',
                    timestamp: Date.now()
                }
            });
        }
        
        throw error;
    }
}


async function getTruthOrDareConfig(serverId, socket) {
    try {
        console.log(`${colors.blue}📋 Getting truth or dare config for server ${serverId}${colors.reset}`);
        
        const config = await TruthOrDareConfig.findOne({ serverId: serverId });
        
        console.log(`${colors.green}✅ Truth or dare config retrieved for server ${serverId}${colors.reset}`);
        
        emitTruthOrDareUpdate(serverId, config, socket, 'server_truthordare_config');
        
        return config;
        
    } catch (error) {
        console.error(`${colors.red}❌ Error getting truth or dare config for server ${serverId}:${colors.reset}`, error);
        
        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'truthordare_error',
                payload: {
                    serverId: serverId,
                    error: error.message,
                    action: 'get_truthordare_config',
                    timestamp: Date.now()
                }
            });
        }
        
        throw error;
    }
}

async function updateTruthOrDareConfig(serverId, config, socket) {
    try {
        console.log(`${colors.blue}🔄 Updating truth or dare system for server ${serverId}${colors.reset}`);
        
        const truthOrDareConfig = await TruthOrDareConfig.findOneAndUpdate(
            { serverId: serverId },
            {
                serverId: serverId,
                channelId: config.channelId
            },
            { 
                returnDocument: 'after',
                upsert: true 
            }
        );

        console.log(`${colors.green}✅ Truth or dare system updated for server ${serverId}${colors.reset}`);
        const guild = await client.guilds.fetch(serverId).catch(() => null);
        if (!guild) {
            console.warn(`⚠️ Could not find guild with ID ${serverId}`);
        } else {
            const channel = guild.channels.cache.get(config.channelId);
            if (!channel || !channel.isTextBased()) {
                console.warn(`⚠️ Channel ${config.channelId} not found or not text-based`);
            } else {
                await sendTruthOrDareEmbed(channel);
            }
        }
        emitTruthOrDareUpdate(serverId, truthOrDareConfig, socket, 'truthordare_config');
        
        return truthOrDareConfig;
        
    } catch (error) {
        console.error(`${colors.red}❌ Error updating truth or dare system for server ${serverId}:${colors.reset}`, error);
        
        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'truthordare_error',
                payload: {
                    serverId: serverId,
                    error: error.message,
                    action: 'update_truthordare_config',
                    timestamp: Date.now()
                }
            });
        }
        
        throw error;
    }
}

async function deleteTruthOrDareConfig(serverId, socket) {
    try {
        console.log(`${colors.blue}🗑️ Deleting truth or dare config for server ${serverId}${colors.reset}`);
        
        await TruthOrDareConfig.findOneAndDelete({ serverId: serverId });
        
        console.log(`${colors.green}✅ Truth or dare config deleted for server ${serverId}${colors.reset}`);
        
        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'truthordare_deleted',
                payload: {
                    serverId: serverId,
                    timestamp: Date.now()
                }
            });
        }
        
        return { deleted: true };
        
    } catch (error) {
        console.error(`${colors.red}❌ Error deleting truth or dare config for server ${serverId}:${colors.reset}`, error);
        
        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'truthordare_error',
                payload: {
                    serverId: serverId,
                    error: error.message,
                    action: 'delete_truthordare_config',
                    timestamp: Date.now()
                }
            });
        }
        
        throw error;
    }
}

module.exports = {
    setupTruthOrDareSystem,
    getTruthOrDareConfig,
    deleteTruthOrDareConfig,
    updateTruthOrDareConfig,
    sendAllTruthOrDareConfigs
};
