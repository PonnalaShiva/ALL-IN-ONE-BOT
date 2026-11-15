const colors = require('../../../UI/colors/colors');
const FaqConfig = require('../../../models/faq/faqModel');

async function sendAllFaqConfigs(socket) {
    try {
        console.log(`${colors.blue}📊 Sending all FAQ configs to middleware${colors.reset}`);
        const allConfigs = await FaqConfig.find({});
        for (const config of allConfigs) {
            emitFaqUpdate(config.guildId, config, socket, 'server_faq_config');
        }
        console.log(`${colors.green}✅ Sent ${allConfigs.length} FAQ configs to middleware${colors.reset}`);
    } catch (error) {
        console.error(`${colors.red}❌ Error sending all FAQ configs:${colors.reset}`, error);
    }
}

function emitFaqUpdate(serverId, config, socket, eventType = 'faq_config') {
    if (socket && socket.emit) {
        socket.emit('bot_data_update', {
            type: eventType,
            payload: { serverId, config, timestamp: Date.now() }
        });
    }
}

async function getFaqConfig(serverId, socket) {
    try {
        const config = await FaqConfig.findOne({ guildId: serverId });
        emitFaqUpdate(serverId, config, socket, 'server_faq_config');
        return config;
    } catch (error) {
        console.error(`${colors.red}❌ Error getting FAQ config:${colors.reset}`, error);
        throw error;
    }
}

async function setupFaqSystem(serverId, config, socket) {
    try {
        console.log(`${colors.blue}❓ Setting up FAQ system for server ${serverId}${colors.reset}`);
        const faqConfig = await FaqConfig.findOneAndUpdate(
            { guildId: serverId },
            {
                guildId: serverId,
                enabled: config.enabled !== false,
                channels: config.channels || 'ALL',
                prefix: config.prefix || '?',
                
                context: {
                    serverDescription: config.context?.serverDescription || config.serverDescription || '',
                    customInstructions: config.context?.customInstructions || config.customInstructions || ''
                },
                links: config.links || []
            },
            { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        );
        console.log(`${colors.green}✅ FAQ system setup for server ${serverId}${colors.reset}`);
        emitFaqUpdate(serverId, faqConfig, socket, 'faq_config');
        return faqConfig;
    } catch (error) {
        console.error(`${colors.red}❌ Error setting up FAQ system:${colors.reset}`, error);
        emitError(serverId, error, 'setup_faq_system', socket);
        throw error;
    }
}

async function updateFaqConfig(serverId, updates, socket) {
    try {
        console.log(`${colors.blue}🔄 Updating FAQ config for server ${serverId}${colors.reset}`);
        const faqConfig = await FaqConfig.findOneAndUpdate(
            { guildId: serverId },
            updates,
            { returnDocument: 'after', upsert: true }
        );
        console.log(`${colors.green}✅ FAQ config updated for server ${serverId}${colors.reset}`);
        emitFaqUpdate(serverId, faqConfig, socket, 'faq_config');
        return faqConfig;
    } catch (error) {
        console.error(`${colors.red}❌ Error updating FAQ config:${colors.reset}`, error);
        emitError(serverId, error, 'update_faq_config', socket);
        throw error;
    }
}

async function toggleFaqStatus(serverId, socket) {
    try {
        const config = await FaqConfig.findOne({ guildId: serverId });
        if (!config) throw new Error('No FAQ config found');
        config.enabled = !config.enabled;
        await config.save();
        emitFaqUpdate(serverId, config, socket, 'faq_config');
        return config;
    } catch (error) {
        console.error(`${colors.red}❌ Error toggling FAQ status:${colors.reset}`, error);
        throw error;
    }
}

async function deleteFaqConfig(serverId, socket) {
    try {
        await FaqConfig.findOneAndDelete({ guildId: serverId });
        console.log(`${colors.green}✅ FAQ config deleted for server ${serverId}${colors.reset}`);
        socket && socket.emit('bot_data_update', {
            type: 'faq_deleted',
            payload: { serverId, timestamp: Date.now() }
        });
        return { deleted: true };
    } catch (error) {
        console.error(`${colors.red}❌ Error deleting FAQ config:${colors.reset}`, error);
        throw error;
    }
}

function emitError(serverId, error, action, socket) {
    if (socket && socket.emit) {
        socket.emit('bot_data_update', {
            type: 'faq_error',
            payload: { serverId, error: error.message, action, timestamp: Date.now() }
        });
    }
}

module.exports = {
    sendAllFaqConfigs,
    getFaqConfig,
    setupFaqSystem,
    updateFaqConfig,
    toggleFaqStatus,
    deleteFaqConfig
};
