const colors = require('../../../UI/colors/colors');
const StickyMessage = require('../../../models/stickymessage/Schema');

async function sendAllStickyMessageConfigs(socket) {
    try {
        console.log(`${colors.blue}📊 Sending all sticky message configs to middleware${colors.reset}`);
        const allConfigs = await StickyMessage.find({});

        
        const guildGroups = {};
        allConfigs.forEach(config => {
            if (!guildGroups[config.serverId]) guildGroups[config.serverId] = [];
            guildGroups[config.serverId].push(config);
        });

        for (const [serverId, configs] of Object.entries(guildGroups)) {
            emitStickyUpdate(serverId, configs, socket, 'server_stickymessage_config');
        }
        console.log(`${colors.green}✅ Sent sticky message configs for ${Object.keys(guildGroups).length} servers${colors.reset}`);
    } catch (error) {
        console.error(`${colors.red}❌ Error sending all sticky message configs:${colors.reset}`, error);
    }
}

function emitStickyUpdate(serverId, configs, socket, eventType = 'stickymessage_config') {
    if (socket && socket.emit) {
        socket.emit('bot_data_update', {
            type: eventType,
            payload: { serverId, configs, timestamp: Date.now() }
        });
    }
}

async function getStickyMessageConfigs(serverId, socket) {
    try {
        const configs = await StickyMessage.find({ serverId });
        emitStickyUpdate(serverId, configs, socket, 'server_stickymessage_config');
        return configs;
    } catch (error) {
        console.error(`${colors.red}❌ Error getting sticky message configs:${colors.reset}`, error);
        throw error;
    }
}

async function createStickyMessage(serverId, config, socket) {
    try {
        console.log(`${colors.blue}📌 Creating sticky message for server ${serverId}${colors.reset}`);
        const sticky = new StickyMessage({
            serverId,
            channelId: config.channelId,
            messageType: config.messageType || 'embed',
            textContent: config.textContent || '',
            embed: config.embed || {},
            timerMode: config.timerMode || 'message',
            messageCount: config.messageCount || 1,
            timerInterval: config.timerInterval || 300,
            active: config.active !== false,
            deleteOldMessage: config.deleteOldMessage !== false,
            ignoreBots: config.ignoreBots !== false,
            allowedRoles: config.allowedRoles || [],
            blockedRoles: config.blockedRoles || [],
            createdBy: config.createdBy
        });
        await sticky.save();
        console.log(`${colors.green}✅ Sticky message created for server ${serverId}${colors.reset}`);
        const allConfigs = await StickyMessage.find({ serverId });
        emitStickyUpdate(serverId, allConfigs, socket, 'stickymessage_config');
        return sticky;
    } catch (error) {
        console.error(`${colors.red}❌ Error creating sticky message:${colors.reset}`, error);
        emitError(serverId, error, 'create_stickymessage', socket);
        throw error;
    }
}

async function updateStickyMessage(serverId, stickyId, updates, socket) {
    try {
        console.log(`${colors.blue}🔄 Updating sticky message for server ${serverId}${colors.reset}`);
        await StickyMessage.findOneAndUpdate({ _id: stickyId, serverId }, updates);
        const allConfigs = await StickyMessage.find({ serverId });
        emitStickyUpdate(serverId, allConfigs, socket, 'stickymessage_config');
        return allConfigs;
    } catch (error) {
        console.error(`${colors.red}❌ Error updating sticky message:${colors.reset}`, error);
        emitError(serverId, error, 'update_stickymessage', socket);
        throw error;
    }
}

async function deleteStickyMessage(serverId, stickyId, socket) {
    try {
        await StickyMessage.findOneAndDelete({ _id: stickyId, serverId });
        console.log(`${colors.green}✅ Sticky message deleted for server ${serverId}${colors.reset}`);
        const allConfigs = await StickyMessage.find({ serverId });
        emitStickyUpdate(serverId, allConfigs, socket, 'stickymessage_config');
        return { deleted: true };
    } catch (error) {
        console.error(`${colors.red}❌ Error deleting sticky message:${colors.reset}`, error);
        throw error;
    }
}

async function deleteAllStickyMessages(serverId, socket) {
    try {
        await StickyMessage.deleteMany({ serverId });
        console.log(`${colors.green}✅ All sticky messages deleted for server ${serverId}${colors.reset}`);
        socket && socket.emit('bot_data_update', {
            type: 'stickymessage_deleted',
            payload: { serverId, timestamp: Date.now() }
        });
        return { deleted: true };
    } catch (error) {
        console.error(`${colors.red}❌ Error deleting all sticky messages:${colors.reset}`, error);
        throw error;
    }
}

async function toggleStickyMessage(serverId, stickyId, socket) {
    try {
        const msg = await StickyMessage.findOne({ _id: stickyId, serverId });
        if (!msg) throw new Error('Sticky message not found');
        msg.active = !msg.active;
        await msg.save();
        const allConfigs = await StickyMessage.find({ serverId });
        emitStickyUpdate(serverId, allConfigs, socket, 'stickymessage_config');
        return msg;
    } catch (error) {
        console.error(`${colors.red}❌ Error toggling sticky message:${colors.reset}`, error);
        throw error;
    }
}

function emitError(serverId, error, action, socket) {
    if (socket && socket.emit) {
        socket.emit('bot_data_update', {
            type: 'stickymessage_error',
            payload: { serverId, error: error.message, action, timestamp: Date.now() }
        });
    }
}

module.exports = {
    sendAllStickyMessageConfigs,
    getStickyMessageConfigs,
    createStickyMessage,
    updateStickyMessage,
    deleteStickyMessage,
    deleteAllStickyMessages,
    toggleStickyMessage
};
