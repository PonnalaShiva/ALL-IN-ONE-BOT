const colors = require('../../../UI/colors/colors');
const GuildBirthdaySettings = require('../../../models/birthday/setup');
const Birthday = require('../../../models/birthday/Schema');
const { invalidateBirthdaySettings } = require('../../../utils/cacheHelpers');


async function sendAllBirthdayConfigs(socket) {
    try {
        console.log(`${colors.blue}📊 Sending all birthday configs to middleware${colors.reset}`);
        const allConfigs = await GuildBirthdaySettings.find({});
        for (const config of allConfigs) {
            emitBirthdayUpdate(config.guildId, config, socket, 'server_birthday_config');
        }
        console.log(`${colors.green}✅ Sent ${allConfigs.length} birthday configs to middleware${colors.reset}`);
    } catch (error) {
        console.error(`${colors.red}❌ Error sending all birthday configs:${colors.reset}`, error);
    }
}


function emitBirthdayUpdate(serverId, config, socket, eventType = 'birthday_config') {
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


async function getBirthdayConfig(serverId, socket) {
    try {
        const config = await GuildBirthdaySettings.findOne({ guildId: serverId });
        emitBirthdayUpdate(serverId, config, socket, 'server_birthday_config');
        return config;
    } catch (error) {
        console.error(`${colors.red}❌ Error getting birthday config:${colors.reset}`, error);
        throw error;
    }
}


async function setupBirthdaySystem(serverId, config, socket) {
    try {
        console.log(`${colors.blue}🎂 Setting up birthday system for server ${serverId}${colors.reset}`);
        
        const s = config.settings || config;
        const p = config.permissions || config;

        const birthdayConfig = await GuildBirthdaySettings.findOneAndUpdate(
            { guildId: serverId },
            {
                guildId: serverId,
                settings: {
                    announcementChannelId: s.announcementChannelId || null,
                    enableDailyAnnouncements: s.enableDailyAnnouncements !== false,
                    enableWeeklyReminders: s.enableWeeklyReminders !== false,
                    enableMonthlyStats: s.enableMonthlyStats || false,
                    announcementTime: s.announcementTime || '09:00',
                    mentionRole: s.mentionRole || null,
                    customMessage: s.customMessage || null,
                    timezone: s.timezone || 'UTC'
                },
                permissions: {
                    adminRoles: p.adminRoles || [],
                    moderatorRoles: p.moderatorRoles || []
                }
            },
            { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        );
        invalidateBirthdaySettings(serverId);
        console.log(`${colors.green}✅ Birthday system setup completed for server ${serverId}${colors.reset}`);
        emitBirthdayUpdate(serverId, birthdayConfig, socket, 'birthday_config');
        return birthdayConfig;
    } catch (error) {
        console.error(`${colors.red}❌ Error setting up birthday system:${colors.reset}`, error);
        emitError(serverId, error, 'setup_birthday_system', socket);
        throw error;
    }
}


async function updateBirthdayConfig(serverId, updates, socket) {
    try {
        console.log(`${colors.blue}🔄 Updating birthday config for server ${serverId}${colors.reset}`);
        const birthdayConfig = await GuildBirthdaySettings.findOneAndUpdate(
            { guildId: serverId },
            updates,
            { returnDocument: 'after', upsert: true }
        );
        invalidateBirthdaySettings(serverId);
        console.log(`${colors.green}✅ Birthday config updated for server ${serverId}${colors.reset}`);
        emitBirthdayUpdate(serverId, birthdayConfig, socket, 'birthday_config');
        return birthdayConfig;
    } catch (error) {
        console.error(`${colors.red}❌ Error updating birthday config:${colors.reset}`, error);
        emitError(serverId, error, 'update_birthday_config', socket);
        throw error;
    }
}


async function deleteBirthdayConfig(serverId, socket) {
    try {
        console.log(`${colors.blue}🗑️ Deleting birthday config for server ${serverId}${colors.reset}`);
        await GuildBirthdaySettings.findOneAndDelete({ guildId: serverId });
        invalidateBirthdaySettings(serverId);
        console.log(`${colors.green}✅ Birthday config deleted for server ${serverId}${colors.reset}`);
        socket && socket.emit('bot_data_update', {
            type: 'birthday_deleted',
            payload: { serverId, timestamp: Date.now() }
        });
        return { deleted: true };
    } catch (error) {
        console.error(`${colors.red}❌ Error deleting birthday config:${colors.reset}`, error);
        throw error;
    }
}


async function getUpcomingBirthdays(serverId, days, socket) {
    try {
        const upcoming = await Birthday.getUpcoming(serverId, days || 30);
        emitBirthdayUpdate(serverId, { upcoming }, socket, 'birthday_upcoming');
        return upcoming;
    } catch (error) {
        console.error(`${colors.red}❌ Error getting upcoming birthdays:${colors.reset}`, error);
        throw error;
    }
}

function emitError(serverId, error, action, socket) {
    if (socket && socket.emit) {
        socket.emit('bot_data_update', {
            type: 'birthday_error',
            payload: { serverId, error: error.message, action, timestamp: Date.now() }
        });
    }
}

module.exports = {
    sendAllBirthdayConfigs,
    getBirthdayConfig,
    setupBirthdaySystem,
    updateBirthdayConfig,
    deleteBirthdayConfig,
    getUpcomingBirthdays
};
