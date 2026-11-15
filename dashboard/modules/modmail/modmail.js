const colors = require('../../../UI/colors/colors');
const ModMailConfig = require('../../../models/modmail/ModMailConfig');
const client = require('../../../main');
const { invalidateModMailConfig } = require('../../../utils/cacheHelpers');

async function sendAllModmailConfigs(socket) {
    try {
        console.log(`${colors.blue}📊 Sending all modmail configs to middleware${colors.reset}`);
        const allConfigs = await ModMailConfig.find({});
        for (const config of allConfigs) {
            emitModmailUpdate(config.guildId, config, socket, 'server_modmail_config');
        }
        console.log(`${colors.green}✅ Sent ${allConfigs.length} modmail configs to middleware${colors.reset}`);
    } catch (error) {
        console.error(`${colors.red}❌ Error sending all modmail configs:${colors.reset}`, error);
    }
}

function emitModmailUpdate(serverId, config, socket, eventType = 'modmail_config') {
    if (socket && socket.emit) {
        socket.emit('bot_data_update', {
            type: eventType,
            payload: { serverId, config, timestamp: Date.now() }
        });
    }
}

async function getModmailConfig(serverId, socket) {
    try {
        const config = await ModMailConfig.findOne({ guildId: serverId });
        emitModmailUpdate(serverId, config, socket, 'server_modmail_config');
        return config;
    } catch (error) {
        console.error(`${colors.red}❌ Error getting modmail config:${colors.reset}`, error);
        throw error;
    }
}

async function setupModmailSystem(serverId, config, socket) {
    try {
        
        const guild = client.guilds.cache.get(serverId);
        const ownerId = config.ownerId || guild?.ownerId;
        if (!ownerId) {
            throw new Error('Could not determine guild owner. Please try again.');
        }

        
        let cooldownTime = config.cooldownTime || 300000;
        if (cooldownTime > 0 && cooldownTime < 1000) {
            cooldownTime = cooldownTime * 1000;
        }

        const modmailConfig = await ModMailConfig.findOneAndUpdate(
            { guildId: serverId },
            {
                guildId: serverId,
                logChannelId: config.logChannelId,
                adminRoleId: config.adminRoleId,
                categoryId: config.categoryId || null,
                status: config.status !== false,
                ownerId: ownerId,
                welcomeMessage: config.welcomeMessage || undefined,
                autoResponse: config.autoResponse !== false,
                allowAttachments: config.allowAttachments !== false,
                maxOpenTickets: config.maxOpenTickets || 3,
                cooldownTime: cooldownTime
            },
            { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        );
        console.log(`${colors.green}✅ Modmail system setup for server ${serverId}${colors.reset}`);
        invalidateModMailConfig(serverId);
        invalidateModMailConfig(serverId);
        emitModmailUpdate(serverId, modmailConfig, socket, 'modmail_config');
        return modmailConfig;
    } catch (error) {
        console.error(`${colors.red}❌ Error setting up modmail system:${colors.reset}`, error);
        emitError(serverId, error, 'setup_modmail_system', socket);
        throw error;
    }
}

async function updateModmailConfig(serverId, updates, socket) {
    try {
        console.log(`${colors.blue}🔄 Updating modmail config for server ${serverId}${colors.reset}`);
        const modmailConfig = await ModMailConfig.findOneAndUpdate(
            { guildId: serverId },
            updates,
            { returnDocument: 'after', upsert: true }
        );
        console.log(`${colors.green}✅ Modmail config updated for server ${serverId}${colors.reset}`);
        emitModmailUpdate(serverId, modmailConfig, socket, 'modmail_config');
        return modmailConfig;
    } catch (error) {
        console.error(`${colors.red}❌ Error updating modmail config:${colors.reset}`, error);
        emitError(serverId, error, 'update_modmail_config', socket);
        throw error;
    }
}

async function toggleModmailStatus(serverId, socket) {
    try {
        const config = await ModMailConfig.findOne({ guildId: serverId });
        if (!config) throw new Error('No modmail config found');
        config.status = !config.status;
        await config.save();
        invalidateModMailConfig(serverId);
        emitModmailUpdate(serverId, config, socket, 'modmail_config');
        return config;
    } catch (error) {
        console.error(`${colors.red}❌ Error toggling modmail status:${colors.reset}`, error);
        throw error;
    }
}

async function deleteModmailConfig(serverId, socket) {
    try {
        await ModMailConfig.findOneAndDelete({ guildId: serverId });
        invalidateModMailConfig(serverId);
        console.log(`${colors.green}✅ Modmail config deleted for server ${serverId}${colors.reset}`);
        socket && socket.emit('bot_data_update', {
            type: 'modmail_deleted',
            payload: { serverId, timestamp: Date.now() }
        });
        return { deleted: true };
    } catch (error) {
        console.error(`${colors.red}❌ Error deleting modmail config:${colors.reset}`, error);
        throw error;
    }
}

function emitError(serverId, error, action, socket) {
    if (socket && socket.emit) {
        socket.emit('bot_data_update', {
            type: 'modmail_error',
            payload: { serverId, error: error.message, action, timestamp: Date.now() }
        });
    }
}

module.exports = {
    sendAllModmailConfigs,
    getModmailConfig,
    setupModmailSystem,
    updateModmailConfig,
    toggleModmailStatus,
    deleteModmailConfig
};
