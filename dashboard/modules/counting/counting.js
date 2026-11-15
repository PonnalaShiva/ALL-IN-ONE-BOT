const colors = require('../../../UI/colors/colors');
const CountingConfig = require('../../../models/counting/Schema');
const { invalidateCountingConfig } = require('../../../utils/cacheHelpers');

async function sendAllCountingConfigs(socket) {
    try {
        console.log(`${colors.blue}📊 Sending all counting configs to middleware${colors.reset}`);
        const allConfigs = await CountingConfig.find({});
        for (const config of allConfigs) {
            emitCountingUpdate(config.serverId, config, socket, 'server_counting_config');
        }
        console.log(`${colors.green}✅ Sent ${allConfigs.length} counting configs to middleware${colors.reset}`);
    } catch (error) {
        console.error(`${colors.red}❌ Error sending all counting configs:${colors.reset}`, error);
    }
}

function emitCountingUpdate(serverId, config, socket, eventType = 'counting_config') {
    if (socket && socket.emit) {
        socket.emit('bot_data_update', {
            type: eventType,
            payload: { serverId, config, timestamp: Date.now() }
        });
    }
}

function normalizeErrorDuration(value) {
    const num = Number(value);
    if (!num || num <= 0) return 5000;
    
    
    return num < 60 ? num * 1000 : num;
}

async function getCountingConfig(serverId, socket) {
    try {
        const config = await CountingConfig.findOne({ serverId });
        emitCountingUpdate(serverId, config, socket, 'server_counting_config');
        return config;
    } catch (error) {
        console.error(`${colors.red}❌ Error getting counting config:${colors.reset}`, error);
        throw error;
    }
}

async function setupCountingSystem(serverId, config, socket) {
    try {
        console.log(`${colors.blue}🔢 Setting up counting system for server ${serverId}${colors.reset}`);

        
        const oldConfig = await CountingConfig.findOne({ serverId });
        const oldChannelId = oldConfig?.channelId;

        const countingConfig = await CountingConfig.findOneAndUpdate(
            { serverId },
            {
                serverId,
                channelId: config.channelId,
                status: config.status !== false,
                allowSameUser: config.allowSameUser || false,
                deleteWrongMessages: config.deleteWrongMessages !== false,
                showErrorMessages: config.showErrorMessages !== false,
                errorMessageDuration: normalizeErrorDuration(config.errorMessageDuration),
                currentCount: oldConfig ? undefined : 0,
                lastUserId: oldConfig ? undefined : null
            },
            { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        );

        
        if (oldChannelId && oldChannelId !== config.channelId) {
            invalidateCountingConfig(serverId, oldChannelId);
        }
        invalidateCountingConfig(serverId, config.channelId);

        console.log(`${colors.green}✅ Counting system setup for server ${serverId} | Channel: ${config.channelId}${colors.reset}`);
        emitCountingUpdate(serverId, countingConfig, socket, 'counting_config');
        return countingConfig;
    } catch (error) {
        console.error(`${colors.red}❌ Error setting up counting system:${colors.reset}`, error);
        emitError(serverId, error, 'setup_counting_system', socket);
        throw error;
    }
}

async function updateCountingConfig(serverId, updates, socket) {
    try {
        console.log(`${colors.blue}🔄 Updating counting config for server ${serverId}${colors.reset}`);

        
        const oldConfig = await CountingConfig.findOne({ serverId });
        const oldChannelId = oldConfig?.channelId;

        
        if (updates.errorMessageDuration !== undefined) {
            updates.errorMessageDuration = normalizeErrorDuration(updates.errorMessageDuration);
        }

        const countingConfig = await CountingConfig.findOneAndUpdate(
            { serverId },
            updates,
            { returnDocument: 'after', upsert: true }
        );

        
        if (oldChannelId) {
            invalidateCountingConfig(serverId, oldChannelId);
        }
        if (countingConfig.channelId && countingConfig.channelId !== oldChannelId) {
            invalidateCountingConfig(serverId, countingConfig.channelId);
        }

        console.log(`${colors.green}✅ Counting config updated for server ${serverId}${colors.reset}`);
        emitCountingUpdate(serverId, countingConfig, socket, 'counting_config');
        return countingConfig;
    } catch (error) {
        console.error(`${colors.red}❌ Error updating counting config:${colors.reset}`, error);
        emitError(serverId, error, 'update_counting_config', socket);
        throw error;
    }
}

async function deleteCountingConfig(serverId, socket) {
    try {
        
        const config = await CountingConfig.findOne({ serverId });
        const channelId = config?.channelId;

        await CountingConfig.findOneAndDelete({ serverId });

        
        if (channelId) {
            invalidateCountingConfig(serverId, channelId);
        }

        console.log(`${colors.green}✅ Counting config deleted for server ${serverId}${colors.reset}`);
        socket && socket.emit('bot_data_update', {
            type: 'counting_deleted',
            payload: { serverId, timestamp: Date.now() }
        });
        return { deleted: true };
    } catch (error) {
        console.error(`${colors.red}❌ Error deleting counting config:${colors.reset}`, error);
        throw error;
    }
}

async function toggleCountingStatus(serverId, socket) {
    try {
        const config = await CountingConfig.findOne({ serverId });
        if (!config) throw new Error('No counting config found');
        config.status = !config.status;
        await config.save();

        
        if (config.channelId) {
            invalidateCountingConfig(serverId, config.channelId);
        }

        emitCountingUpdate(serverId, config, socket, 'counting_config');
        return config;
    } catch (error) {
        console.error(`${colors.red}❌ Error toggling counting status:${colors.reset}`, error);
        throw error;
    }
}

function emitError(serverId, error, action, socket) {
    if (socket && socket.emit) {
        socket.emit('bot_data_update', {
            type: 'counting_error',
            payload: { serverId, error: error.message, action, timestamp: Date.now() }
        });
    }
}

module.exports = {
    sendAllCountingConfigs,
    getCountingConfig,
    setupCountingSystem,
    updateCountingConfig,
    deleteCountingConfig,
    toggleCountingStatus
};
