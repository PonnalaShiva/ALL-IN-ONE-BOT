const colors = require('../../../UI/colors/colors');
const ServerStats = require('../../../models/serverstats/Schema');
const ServerStatsService = require('../../../services/serverStatsService');
const { invalidateServerStatsConfig } = require('../../../utils/cacheHelpers');
class ServerStatsManager {
    constructor(client) {
        this.client = client;
        this.service = new ServerStatsService(client);

        this.service.startStatsUpdater();
    }


    async getServerStatsConfig(guildId) {
        try {
            console.log(`${colors.blue}🔍 Getting server stats config for guild ${guildId}${colors.reset}`);

            const dbConfig = await ServerStats.findByGuildId(guildId);
            console.log(`${colors.blue}📊 Database config found:${colors.reset}`, !!dbConfig);
            if (dbConfig) {
                console.log(`${colors.blue}📊 Stats channels in DB:${colors.reset}`, dbConfig.statsChannels.length);
            }

            const dashboardData = await this.service.getDashboardData(guildId);
            console.log(`${colors.blue}📊 Dashboard data:${colors.reset}`, !!dashboardData);

            return { config: dashboardData, guildId };
        } catch (error) {
            console.error(`${colors.red}❌ Error getting server stats config:${colors.reset}`, error);
            throw error;
        }
    }

}


async function sendServerStatsData(guildId, socket = null) {
    try {
        console.log(`${colors.blue}📊 Sending server stats data for guild ${guildId}${colors.reset}`);

        const config = await global.serverStatsManager.getServerStatsConfig(guildId);

        
        console.log(`${colors.blue}📊 Config data:${colors.reset}`, !!config.config);
        if (config.config) {
            console.log(`${colors.blue}📊 Guild info:${colors.reset}`, config.config.guild?.name);
            console.log(`${colors.blue}📊 Stats channels:${colors.reset}`, config.config.statsChannels?.length || 0);
        }

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'serverstats_data',
                payload: {
                    guildId,
                    data: config.config || null
                }
            });
        }

        console.log(`${colors.green}✅ Sent server stats data for guild ${guildId}${colors.reset}`);

        return config.config || null;

    } catch (error) {
        console.error(`${colors.red}❌ Error sending server stats data:${colors.reset}`, error);
        throw error;
    }
}


async function sendAllServerStatsData(socket, userId = null) {
    try {
        console.log(`${colors.blue}📊 Sending all server stats data to middleware${colors.reset}`);


        const allServerStats = await ServerStats.find({ isActive: true });
        console.log(`${colors.blue}📊 Found ${allServerStats.length} server stats configs in database${colors.reset}`);

        if (allServerStats.length === 0) {
            console.log(`${colors.yellow}⚠️ No server stats configurations found in database${colors.reset}`);
        }

        for (const serverStat of allServerStats) {
            try {
                console.log(`${colors.blue}📊 Processing guild ${serverStat.guildId} (${serverStat.guildName})${colors.reset}`);

            
                let guild = global.serverStatsManager.client.guilds.cache.get(serverStat.guildId);
                if (!guild) {
                    console.log(`${colors.yellow}⚠️ Guild ${serverStat.guildId} not in cache, trying to fetch...${colors.reset}`);
                    try {
                        guild = await global.serverStatsManager.client.guilds.fetch(serverStat.guildId);
                        console.log(`${colors.green}✅ Successfully fetched guild ${serverStat.guildId}${colors.reset}`);
                    } catch (fetchError) {
                        console.log(`${colors.red}❌ Failed to fetch guild ${serverStat.guildId}:${colors.reset}`, fetchError.message);
                        continue;
                    }
                }

                if (guild) {
                    console.log(`${colors.blue}📊 Sending data for guild ${guild.name}${colors.reset}`);
                    await sendServerStatsData(serverStat.guildId, socket);
                    await new Promise(resolve => setTimeout(resolve, 100));
                } else {
                    console.log(`${colors.yellow}⚠️ Guild ${serverStat.guildId} not accessible, skipping${colors.reset}`);
                }
            } catch (error) {
                console.error(`${colors.red}❌ Error sending stats for guild ${serverStat.guildId}:${colors.reset}`, error);
            }
        }

        console.log(`${colors.green}✅ Sent server stats data for ${allServerStats.length} configured servers${colors.reset}`);

    } catch (error) {
        console.error(`${colors.red}❌ Error sending all server stats data:${colors.reset}`, error);
    }
}

async function setupServerStats(serverId, options, socket) {
    try {
        const guild = global.serverStatsManager.client.guilds.cache.get(serverId);
        if (!guild) {
            throw new Error('Guild not found');
        }

        console.log(`${colors.blue}📊 Setting up server stats for ${guild.name}${colors.reset}`);

        const results = await global.serverStatsManager.service.setupStatsChannels(guild, options.statsTypes, {
            categoryId: options.categoryId,
            customFormats: options.customFormats,
            active: options.active
        });

     
        await global.serverStatsManager.service.updateGuildStats(guild);

      
        const freshConfig = await sendServerStatsData(serverId, socket);

        invalidateServerStatsConfig(serverId);
        console.log(`${colors.green}✅ Server stats setup completed for ${guild.name}${colors.reset}`);

        return freshConfig;

    } catch (error) {
        console.error(`${colors.red}❌ Error setting up server stats:${colors.reset}`, error);

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'serverstats_data',
                payload: {
                    guildId: serverId,
                    data: { error: error.message }
                }
            });
        }

        throw error;
    }
}


async function removeServerStatsChannel(serverId, type, socket) {
    try {
    
        const guild = global.serverStatsManager.client.guilds.cache.get(serverId);
        if (!guild) {
            throw new Error('Guild not found');
        }

        const serverStats = await ServerStats.findByGuildId(serverId);
        if (!serverStats) {
            throw new Error('No server stats configuration found');
        }

        const channelToRemove = serverStats.statsChannels.find(ch => ch.type === type);
        if (!channelToRemove) {
            throw new Error(`No stats channel found for type: ${type}`);
        }

     
        const discordChannel = guild.channels.cache.get(channelToRemove.channelId);
        if (discordChannel) {
            await discordChannel.delete(`Server stats channel removed via dashboard`);
            console.log(`${colors.yellow}🗑️ Deleted ${type} stats channel for ${guild.name}${colors.reset}`);
        }


        await serverStats.removeStatsChannel(channelToRemove.channelId);
        invalidateServerStatsConfig(serverId);

        const response = {
            message: `${type} stats channel removed successfully`,
            type,
            guildId: serverId,
            guildName: guild.name
        };

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'serverstats_data',
                payload: {
                    guildId: serverId,
                    data: response
                }
            });
        }

   
        setTimeout(() => sendServerStatsData(serverId, socket), 1000);

        return response;

    } catch (error) {
        console.error(`${colors.red}❌ Error removing server stats channel:${colors.reset}`, error);

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'serverstats_data',
                payload: {
                    guildId: serverId,
                    data: { error: error.message }
                }
            });
        }

        throw error;
    }
}


async function clearServerStats(serverId, socket) {
    try {

        const guild = global.serverStatsManager.client.guilds.cache.get(serverId);
        if (!guild) {
            throw new Error('Guild not found');
        }

        const serverStats = await ServerStats.findByGuildId(serverId);
        if (!serverStats || !serverStats.statsChannels.length) {
            throw new Error('No server stats channels to remove');
        }

        let deletedCount = 0;
        let failedCount = 0;

  
        for (const statsChannel of serverStats.statsChannels) {
            try {
                const discordChannel = guild.channels.cache.get(statsChannel.channelId);
                if (discordChannel) {
                    await discordChannel.delete(`All stats channels cleared via dashboard`);
                    deletedCount++;
                }
            } catch (error) {
                console.error(`Failed to delete channel ${statsChannel.channelId}:`, error);
                failedCount++;
            }
        }

  
        await ServerStats.findOneAndDelete({ guildId: serverId });

        invalidateServerStatsConfig(serverId);
        console.log(`${colors.green}✅ Cleared all server stats for ${guild.name}${colors.reset}`);

        const response = {
            message: 'All server stats channels cleared successfully',
            results: { deleted: deletedCount, failed: failedCount },
            guildId: serverId,
            guildName: guild.name
        };

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'serverstats_data',
                payload: {
                    guildId: serverId,
                    data: response
                }
            });
        }

        return response;

    } catch (error) {
        console.error(`${colors.red}❌ Error clearing server stats:${colors.reset}`, error);

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'serverstats_data',
                payload: {
                    guildId: serverId,
                    data: { error: error.message }
                }
            });
        }

        throw error;
    }
}


async function forceUpdateServerStats(serverId, socket) {
    try {

        const guild = global.serverStatsManager.client.guilds.cache.get(serverId);
        if (!guild) {
            throw new Error('Guild not found');
        }

        console.log(`${colors.blue}🔄 Force updating server stats for ${guild.name}${colors.reset}`);

        const results = await global.serverStatsManager.service.updateGuildStats(guild);

        const response = {
            message: 'Server stats updated successfully',
            results,
            guildId: serverId,
            guildName: guild.name
        };

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'serverstats_data',
                payload: {
                    guildId: serverId,
                    data: response
                }
            });
        }

    
        setTimeout(() => sendServerStatsData(serverId, socket), 1000);

        return response;

    } catch (error) {
        console.error(`${colors.red}❌ Error updating server stats:${colors.reset}`, error);

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'serverstats_data',
                payload: {
                    guildId: serverId,
                    data: { error: error.message }
                }
            });
        }

        throw error;
    }
}

async function updateServerStatsSettings(serverId, settings, socket) {
    try {

        const guild = global.serverStatsManager.client.guilds.cache.get(serverId);
        if (!guild) {
            throw new Error('Guild not found');
        }

        let serverStats = await ServerStats.findByGuildId(serverId);
        if (!serverStats) {
            serverStats = new ServerStats({
                guildId: serverId,
                guildName: guild.name,
                statsChannels: []
            });
        }

     
        if (settings.updateInterval) {
            serverStats.settings.updateInterval = settings.updateInterval * 60000; 
        }
        if (settings.autoUpdate !== undefined) {
            serverStats.settings.autoUpdate = settings.autoUpdate;
        }
        if (settings.timezone) {
            serverStats.settings.timezone = settings.timezone;
        }
        if (settings.locale) {
            serverStats.settings.locale = settings.locale;
        }

        await serverStats.save();
        invalidateServerStatsConfig(serverId);

        console.log(`${colors.green}⚙️ Updated server stats settings for ${guild.name}${colors.reset}`);

        const response = {
            message: 'Server stats settings updated successfully',
            settings: serverStats.settings,
            guildId: serverId,
            guildName: guild.name
        };

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'serverstats_data',
                payload: {
                    guildId: serverId,
                    data: response
                }
            });
        }

     
        setTimeout(() => sendServerStatsData(serverId, socket), 1000);

        return response;

    } catch (error) {
        console.error(`${colors.red}❌ Error updating server stats settings:${colors.reset}`, error);

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'serverstats_data',
                payload: {
                    guildId: serverId,
                    data: { error: error.message }
                }
            });
        }

        throw error;
    }
}


async function initializeServerStatsManager(client) {
    if (!global.serverStatsManager) {
        global.serverStatsManager = new ServerStatsManager(client);
    }
    return global.serverStatsManager;
}

module.exports = {
    ServerStatsManager,
    sendServerStatsData,
    sendAllServerStatsData,
    setupServerStats,
    removeServerStatsChannel,
    clearServerStats,
    forceUpdateServerStats,
    updateServerStatsSettings,
    initializeServerStatsManager
};
