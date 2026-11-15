const colors = require('../../../UI/colors/colors');
const BoostSettings = require('../../../models/boost/BoostSettings');
const { invalidateBoostSettings } = require('../../../utils/cacheHelpers');


async function sendAllBoostConfigs(socket) {
    try {
        console.log(`${colors.blue}📊 Sending all boost configs to middleware${colors.reset}`);
        const allConfigs = await BoostSettings.find({});
        for (const config of allConfigs) {
            emitBoostUpdate(config.serverId, config, socket, 'server_boost_config');
        }
        console.log(`${colors.green}✅ Sent ${allConfigs.length} boost configs to middleware${colors.reset}`);
    } catch (error) {
        console.error(`${colors.red}❌ Error sending all boost configs:${colors.reset}`, error);
    }
}

function emitBoostUpdate(serverId, config, socket, eventType = 'boost_config') {
    if (socket && socket.emit) {
        socket.emit('bot_data_update', {
            type: eventType,
            payload: { serverId, config, timestamp: Date.now() }
        });
    }
}

async function getBoostConfig(serverId, socket) {
    try {
        const config = await BoostSettings.findOne({ serverId });
        emitBoostUpdate(serverId, config, socket, 'server_boost_config');
        return config;
    } catch (error) {
        console.error(`${colors.red}❌ Error getting boost config:${colors.reset}`, error);
        throw error;
    }
}

async function setupBoostSystem(serverId, config, socket) {
    try {
        console.log(`${colors.blue}🚀 Setting up boost system for server ${serverId}${colors.reset}`);
        const boostConfig = await BoostSettings.findOneAndUpdate(
            { serverId },
            {
                serverId,
                ownerId: config.ownerId,
                boostChannelId: config.boostChannelId,
                boostStatus: config.boostStatus || false,
                boostMessage: config.boostMessage || undefined,
                removeMessage: config.removeMessage || undefined
            },
            { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        );
        console.log(`${colors.green}✅ Boost system setup for server ${serverId}${colors.reset}`);
        invalidateBoostSettings(serverId);
        emitBoostUpdate(serverId, boostConfig, socket, 'boost_config');
        return boostConfig;
    } catch (error) {
        console.error(`${colors.red}❌ Error setting up boost system:${colors.reset}`, error);
        emitError(serverId, error, 'setup_boost_system', socket);
        throw error;
    }
}

async function updateBoostConfig(serverId, updates, socket) {
    try {
        console.log(`${colors.blue}🔄 Updating boost config for server ${serverId}${colors.reset}`);
        const boostConfig = await BoostSettings.findOneAndUpdate(
            { serverId },
            updates,
            { returnDocument: 'after', upsert: true }
        );
        console.log(`${colors.green}✅ Boost config updated for server ${serverId}${colors.reset}`);
        invalidateBoostSettings(serverId);
        emitBoostUpdate(serverId, boostConfig, socket, 'boost_config');
        return boostConfig;
    } catch (error) {
        console.error(`${colors.red}❌ Error updating boost config:${colors.reset}`, error);
        emitError(serverId, error, 'update_boost_config', socket);
        throw error;
    }
}

async function deleteBoostConfig(serverId, socket) {
    try {
        await BoostSettings.findOneAndDelete({ serverId });
        console.log(`${colors.green}✅ Boost config deleted for server ${serverId}${colors.reset}`);
        invalidateBoostSettings(serverId);
        socket && socket.emit('bot_data_update', {
            type: 'boost_deleted',
            payload: { serverId, timestamp: Date.now() }
        });
        return { deleted: true };
    } catch (error) {
        console.error(`${colors.red}❌ Error deleting boost config:${colors.reset}`, error);
        throw error;
    }
}

function emitError(serverId, error, action, socket) {
    if (socket && socket.emit) {
        socket.emit('bot_data_update', {
            type: 'boost_error',
            payload: { serverId, error: error.message, action, timestamp: Date.now() }
        });
    }
}

module.exports = {
    sendAllBoostConfigs,
    getBoostConfig,
    setupBoostSystem,
    updateBoostConfig,
    deleteBoostConfig
};
