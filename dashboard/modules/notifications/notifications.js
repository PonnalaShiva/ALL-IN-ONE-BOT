const colors = require('../../../UI/colors/colors');
const Notification = require('../../../models/notifications/Schema');

function emitNotificationUpdate(serverId, configs, socket, eventType = 'notification_config') {
    if (socket && socket.emit) {
        socket.emit('bot_data_update', {
            type: eventType,
            payload: { serverId, configs, timestamp: Date.now() }
        });
    }
}

function emitError(serverId, error, action, socket) {
    if (socket && socket.emit) {
        socket.emit('bot_data_update', {
            type: 'notification_error',
            payload: { serverId, error: error.message || error, action, timestamp: Date.now() }
        });
    }
}

async function sendAllNotificationConfigs(socket) {
    try {
        console.log(`${colors.blue}📊 Sending all notification configs to middleware${colors.reset}`);
        const allConfigs = await Notification.find({}).lean();

        const guildGroups = {};
        allConfigs.forEach(config => {
            const gid = config.serverId;
            if (!guildGroups[gid]) guildGroups[gid] = [];
            guildGroups[gid].push(config);
        });

        for (const [serverId, configs] of Object.entries(guildGroups)) {
            emitNotificationUpdate(serverId, configs, socket, 'server_notification_config');
        }
        console.log(`${colors.green}✅ Sent notification configs for ${Object.keys(guildGroups).length} servers${colors.reset}`);
    } catch (error) {
        console.error(`${colors.red}❌ Error sending all notification configs:${colors.reset}`, error);
    }
}

async function getNotificationConfigs(serverId, socket) {
    try {
        const configs = await Notification.findByServer(serverId).lean();
        emitNotificationUpdate(serverId, configs, socket, 'server_notification_config');
        return configs;
    } catch (error) {
        console.error(`${colors.red}❌ Error getting notification configs:${colors.reset}`, error);
        throw error;
    }
}

async function setupNotification(serverId, config, socket) {
    try {
        console.log(`${colors.blue}🔔 Setting up notification for server ${serverId}${colors.reset}`);

        const notif = await Notification.findOneAndUpdate(
            { serverId, platform: config.platform, platformId: config.platformId },
            {
                $set: {
                    channelId: config.channelId,
                    mentionRoleId: config.mentionRoleId || null,
                    customMessage: config.customMessage || null,
                    enabled: config.enabled !== undefined ? config.enabled : true,
                    platformName: config.platformName || null
                },
                $setOnInsert: {
                    serverId,
                    platform: config.platform,
                    platformId: config.platformId,
                    failCount: 0,
                    lastError: null,
                    notifiedIds: [],
                    lastNotifiedId: null,
                    lastChecked: null
                }
            },
            { upsert: true, returnDocument: 'after', runValidators: true }
        );

        console.log(`${colors.green}✅ Notification setup for server ${serverId} (${config.platform}/${config.platformId})${colors.reset}`);
        const allConfigs = await Notification.findByServer(serverId).lean();
        emitNotificationUpdate(serverId, allConfigs, socket, 'notification_config');
        return notif.toObject();
    } catch (error) {
        console.error(`${colors.red}❌ Error setting up notification:${colors.reset}`, error);
        emitError(serverId, error, 'setup_notification', socket);
        throw error;
    }
}

async function updateNotification(serverId, notificationId, updates, socket) {
    try {
        console.log(`${colors.blue}🔄 Updating notification ${notificationId} for server ${serverId}${colors.reset}`);

        
        const allowedFields = ['channelId', 'mentionRoleId', 'customMessage', 'enabled', 'platformName'];
        const safeUpdates = {};
        for (const key of allowedFields) {
            if (updates[key] !== undefined) {
                safeUpdates[key] = updates[key];
            }
        }

        
        if (safeUpdates.enabled === true) {
            safeUpdates.failCount = 0;
            safeUpdates.lastError = null;
        }

        await Notification.findByIdAndUpdate(notificationId, { $set: safeUpdates }, { runValidators: true });

        const allConfigs = await Notification.findByServer(serverId).lean();
        emitNotificationUpdate(serverId, allConfigs, socket, 'notification_config');
        return allConfigs;
    } catch (error) {
        console.error(`${colors.red}❌ Error updating notification:${colors.reset}`, error);
        emitError(serverId, error, 'update_notification', socket);
        throw error;
    }
}

async function deleteNotification(serverId, notificationId, socket) {
    try {
        await Notification.findByIdAndDelete(notificationId);
        console.log(`${colors.green}✅ Notification ${notificationId} deleted for server ${serverId}${colors.reset}`);

        const allConfigs = await Notification.findByServer(serverId).lean();
        emitNotificationUpdate(serverId, allConfigs, socket, 'notification_config');
        return allConfigs;
    } catch (error) {
        console.error(`${colors.red}❌ Error deleting notification:${colors.reset}`, error);
        throw error;
    }
}

async function deleteAllNotifications(serverId, socket) {
    try {
        await Notification.deleteMany({ serverId });
        console.log(`${colors.green}✅ All notifications deleted for server ${serverId}${colors.reset}`);

        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'notification_deleted',
                payload: { serverId, timestamp: Date.now() }
            });
        }
        return { deleted: true };
    } catch (error) {
        console.error(`${colors.red}❌ Error deleting all notifications:${colors.reset}`, error);
        throw error;
    }
}

module.exports = {
    sendAllNotificationConfigs,
    getNotificationConfigs,
    setupNotification,
    updateNotification,
    deleteNotification,
    deleteAllNotifications
};
