const TicketConfig = require('../../../models/ticket/TicketConfig');
const TicketUserData = require('../../../models/ticket/TicketUserData');
const ticketHandler = require('../../../handlers/ticketHandler');
const colors = require('../../../UI/colors/colors');
const client = require('../../../main');
const cacheManager = require('../../../utils/cacheManager');


function emitTicketUpdate(serverId, ticketConfig, socket) {
    socket.emit('bot_data_update', {
        type: 'ticket_config',
        payload: {
            serverId: ticketConfig.serverId,
            ticketChannelId: ticketConfig.ticketChannelId,
            transcriptChannelId: ticketConfig.transcriptChannelId,
            adminRoleId: ticketConfig.adminRoleId,
            status: ticketConfig.status,
            categoryId: ticketConfig.categoryId,
            ownerId: ticketConfig.ownerId,
            customEmbed: ticketConfig.customEmbed,
            interactionType: ticketConfig.interactionType,
            ticketOptions: ticketConfig.ticketOptions,
            _id: ticketConfig._id
        }
    });
}


async function getTicketConfig(serverId, socket) {
    try {
        const config = await TicketConfig.findOne({ serverId });
        const guild = client.guilds.cache.get(serverId);

        
        let resolvedTicketChannel = null;
        let resolvedTranscriptChannel = null;
        let resolvedCategory = null;
        let resolvedAdminRole = null;
        let resolvedOwner = null;

        if (config && guild) {
            
            const resolveChannel = async (channelId) => {
                if (!channelId) return null;
                const cached = guild.channels.cache.get(channelId);
                if (cached) return { id: channelId, name: cached.name };
                try {
                    const fetched = await guild.channels.fetch(channelId).catch(() => null);
                    if (fetched) return { id: channelId, name: fetched.name };
                } catch (_) {}
                return null;
            };

            const [ticketCh, transcriptCh, categoryCh] = await Promise.all([
                resolveChannel(config.ticketChannelId),
                resolveChannel(config.transcriptChannelId),
                resolveChannel(config.categoryId),
            ]);
            resolvedTicketChannel = ticketCh;
            resolvedTranscriptChannel = transcriptCh;
            resolvedCategory = categoryCh;

            
            if (config.adminRoleId) {
                const role = guild.roles.cache.get(config.adminRoleId);
                if (role) resolvedAdminRole = { id: config.adminRoleId, name: role.name };
            }

            
            if (config.ownerId) {
                try {
                    const member = guild.members.cache.get(config.ownerId) || await guild.members.fetch(config.ownerId).catch(() => null);
                    if (member) resolvedOwner = { id: config.ownerId, username: member.user.username, displayName: member.displayName };
                } catch (_) {}
            }
        }

        const enrichedConfig = config ? {
            ticketChannelId: config.ticketChannelId,
            transcriptChannelId: config.transcriptChannelId,
            adminRoleId: config.adminRoleId,
            status: config.status,
            categoryId: config.categoryId,
            ownerId: config.ownerId,
            customEmbed: config.customEmbed,
            interactionType: config.interactionType,
            ticketOptions: config.ticketOptions,
            _id: config._id,
            serverId: config.serverId,
            
            resolvedTicketChannel,
            resolvedTranscriptChannel,
            resolvedCategory,
            resolvedAdminRole,
            resolvedOwner,
        } : null;

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'server_ticket_config',
                payload: {
                    serverId,
                    config: enrichedConfig
                }
            });
        }

        return enrichedConfig || config;
    } catch (error) {
        console.error(`${colors.red}❌ Error getting ticket config:${colors.reset}`, error);

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'ticket_error',
                payload: {
                    serverId,
                    error: error.message,
                    action: 'get_ticket_config'
                }
            });
        }

        throw error;
    }
}


async function setupTicketSystem(serverId, config, socket) {
    try {
        console.log(`[DEBUG] Setting up ticket system for Guild: ${serverId}`);

        const guild = client.guilds.cache.get(serverId);
        if (!guild) {
            throw new Error('Guild not found');
        }

        let categoryId = config.categoryId;

        
        if (!categoryId) {
            try {
                const category = await guild.channels.create({
                    name: 'Tickets',
                    type: 4, 
                    position: 0
                });
                categoryId = category.id;
                console.log(`${colors.blue}📁 Created ticket category: ${category.id}${colors.reset}`);
            } catch (categoryError) {
                console.warn(`${colors.yellow}⚠️ Could not create category, using provided ID${colors.reset}`);
                categoryId = config.categoryId || null;
            }
        }

        
        let ticketOptions = undefined;
        if (config.ticketOptions?.length > 0) {
            ticketOptions = config.ticketOptions.slice(0, 10).map(opt => ({
                label: (opt.label || '').substring(0, 50).trim(),
                value: (opt.value || '').substring(0, 50).trim().toLowerCase().replace(/\s+/g, '_'),
                description: opt.description ? opt.description.substring(0, 50).trim() : null,
                emoji: opt.emoji || null
            })).filter(opt => opt.label && opt.value); 
        }

        const ticketConfig = await TicketConfig.findOneAndUpdate(
            { serverId },
            {
                serverId,
                ticketChannelId: config.ticketChannelId,
                transcriptChannelId: config.transcriptChannelId,
                adminRoleId: config.adminRoleId,
                status: config.status !== undefined ? config.status : true,
                categoryId,
                ownerId: config.ownerId || guild.ownerId,
                customEmbed: config.customEmbed || null,
                interactionType: config.interactionType || 'dropdown',
                ticketOptions: ticketOptions
            },
            { upsert: true, returnDocument: 'after' }
        );

        
        if (ticketHandler.clearTicketCache) {
            ticketHandler.clearTicketCache(serverId);
        }
        await reinitializeTicketSystem(serverId);

        if (socket) {
            emitTicketUpdate(serverId, ticketConfig, socket);
        }

        console.log(`${colors.green}✅ Ticket system setup for server ${serverId}${colors.reset}`);

        return ticketConfig;
    } catch (error) {
        console.error(`${colors.red}❌ Error setting up ticket system:${colors.reset}`, error);

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'ticket_error',
                payload: {
                    serverId,
                    error: error.message,
                    action: 'setup_ticket_system'
                }
            });
        }

        throw error;
    }
}


async function updateTicketConfig(serverId, config, socket) {
    try {
        
        let ticketOptions = undefined;
        if (config.ticketOptions?.length > 0) {
            ticketOptions = config.ticketOptions.slice(0, 10).map(opt => ({
                label: (opt.label || '').substring(0, 50).trim(),
                value: (opt.value || '').substring(0, 50).trim().toLowerCase().replace(/\s+/g, '_'),
                description: opt.description ? opt.description.substring(0, 50).trim() : null,
                emoji: opt.emoji || null
            })).filter(opt => opt.label && opt.value); 
        }

        const updateData = {
            ticketChannelId: config.ticketChannelId,
            transcriptChannelId: config.transcriptChannelId,
            adminRoleId: config.adminRoleId,
            status: config.status,
            categoryId: config.categoryId,
            ownerId: config.ownerId
        };

        
        if (config.customEmbed !== undefined) {
            updateData.customEmbed = config.customEmbed;
        }
        if (config.interactionType !== undefined) {
            updateData.interactionType = config.interactionType;
        }
        if (ticketOptions !== undefined) {
            updateData.ticketOptions = ticketOptions;
        }

        const updatedConfig = await TicketConfig.findOneAndUpdate(
            { serverId },
            updateData,
            { returnDocument: 'after' }
        );

        if (!updatedConfig) {
            throw new Error('Ticket configuration not found');
        }

        
        if (ticketHandler.clearTicketCache) {
            ticketHandler.clearTicketCache(serverId);
        }
        await reinitializeTicketSystem(serverId);

        if (socket) {
            emitTicketUpdate(serverId, updatedConfig, socket);
        }

        console.log(`${colors.cyan}🔄 Ticket config updated for server ${serverId}${colors.reset}`);

        return updatedConfig;
    } catch (error) {
        console.error(`${colors.red}❌ Error updating ticket config:${colors.reset}`, error);

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'ticket_error',
                payload: {
                    serverId,
                    error: error.message,
                    action: 'update_ticket_config'
                }
            });
        }

        throw error;
    }
}


async function enableTicketSystem(serverId, socket) {
    try {
        const config = await TicketConfig.findOneAndUpdate(
            { serverId },
            { status: true },
            { returnDocument: 'after' }
        );

        if (!config) {
            throw new Error('Ticket configuration not found');
        }

        
        if (ticketHandler.clearTicketCache) {
            ticketHandler.clearTicketCache(serverId);
        }
        await reinitializeTicketSystem(serverId);

        if (socket) {
            emitTicketUpdate(serverId, config, socket);
        }

        console.log(`${colors.green}✅ Ticket system enabled for server ${serverId}${colors.reset}`);

        return config;
    } catch (error) {
        console.error(`${colors.red}❌ Error enabling ticket system:${colors.reset}`, error);

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'ticket_error',
                payload: {
                    serverId,
                    error: error.message,
                    action: 'enable_ticket_system'
                }
            });
        }

        throw error;
    }
}


async function disableTicketSystem(serverId, socket) {
    try {
        const config = await TicketConfig.findOneAndUpdate(
            { serverId },
            { status: false },
            { returnDocument: 'after' }
        );

        if (!config) {
            throw new Error('Ticket configuration not found');
        }

        
        if (ticketHandler.clearTicketCache) {
            ticketHandler.clearTicketCache(serverId);
        }

        if (socket) {
            emitTicketUpdate(serverId, config, socket);
        }

        console.log(`${colors.yellow}⚠️ Ticket system disabled for server ${serverId}${colors.reset}`);

        return config;
    } catch (error) {
        console.error(`${colors.red}❌ Error disabling ticket system:${colors.reset}`, error);

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'ticket_error',
                payload: {
                    serverId,
                    error: error.message,
                    action: 'disable_ticket_system'
                }
            });
        }

        throw error;
    }
}


async function deleteTicketConfig(serverId, socket) {
    try {
        const deletedConfig = await TicketConfig.findOneAndDelete({ serverId });

        if (!deletedConfig) {
            throw new Error('Ticket configuration not found');
        }

        
        const deletedTickets = await TicketUserData.deleteMany({ guildId: serverId });
        console.log(`${colors.blue}🗑️ Purged ${deletedTickets.deletedCount} ticket user records for ${serverId}${colors.reset}`);

        
        if (ticketHandler.clearTicketCache) {
            ticketHandler.clearTicketCache(serverId);
        }
        const ticketUserDataCache = cacheManager.caches?.get('ticketUserData');
        if (ticketUserDataCache) {
            for (const [key] of ticketUserDataCache) {
                if (key.endsWith(`_${serverId}`)) {
                    cacheManager.delete('ticketUserData', key);
                }
            }
        }

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'ticket_deleted',
                payload: {
                    serverId,
                    _id: deletedConfig._id
                }
            });
        }

        console.log(`${colors.red}🗑️ Ticket configuration deleted for server ${serverId}${colors.reset}`);

        return deletedConfig;
    } catch (error) {
        console.error(`${colors.red}❌ Error deleting ticket config:${colors.reset}`, error);

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'ticket_error',
                payload: {
                    serverId,
                    error: error.message,
                    action: 'delete_ticket_config'
                }
            });
        }

        throw error;
    }
}


async function getTicketStats(serverId, socket) {
    try {
        const config = await TicketConfig.findOne({ serverId });
        const guild = client.guilds.cache.get(serverId);

        
        const channelExists = async (channelId) => {
            if (!channelId || !guild) return { exists: false, name: null };
            
            const cached = guild.channels.cache.get(channelId);
            if (cached) return { exists: true, name: cached.name };
            
            try {
                const fetched = await guild.channels.fetch(channelId).catch(() => null);
                if (fetched) return { exists: true, name: fetched.name };
            } catch (_) {}
            return { exists: false, name: null };
        };

        
        const resolveRole = (roleId) => {
            if (!roleId || !guild) return { exists: false, name: null };
            const role = guild.roles.cache.get(roleId);
            return role ? { exists: true, name: role.name } : { exists: false, name: null };
        };

        
        const [ticketCh, transcriptCh, categoryCh] = await Promise.all([
            config?.ticketChannelId ? channelExists(config.ticketChannelId) : { exists: false, name: null },
            config?.transcriptChannelId ? channelExists(config.transcriptChannelId) : { exists: false, name: null },
            config?.categoryId ? channelExists(config.categoryId) : { exists: false, name: null },
        ]);

        const adminRole = config?.adminRoleId ? resolveRole(config.adminRoleId) : { exists: false, name: null };

        
        let ownerInfo = null;
        if (config?.ownerId && guild) {
            try {
                const member = guild.members.cache.get(config.ownerId) || await guild.members.fetch(config.ownerId).catch(() => null);
                if (member) {
                    ownerInfo = { id: config.ownerId, username: member.user.username, displayName: member.displayName };
                }
            } catch (_) {}
        }

        const stats = {
            hasConfig: !!config,
            isActive: config?.status || false,
            guildMemberCount: guild?.memberCount || 0,
            categoryExists: categoryCh.exists,
            ticketChannelExists: ticketCh.exists,
            transcriptChannelExists: transcriptCh.exists,
            interactionType: config?.interactionType || 'dropdown',
            optionsCount: config?.ticketOptions?.length || 0,
            
            resolvedTicketChannel: ticketCh.name ? { id: config?.ticketChannelId, name: ticketCh.name } : null,
            resolvedTranscriptChannel: transcriptCh.name ? { id: config?.transcriptChannelId, name: transcriptCh.name } : null,
            resolvedCategory: categoryCh.name ? { id: config?.categoryId, name: categoryCh.name } : null,
            resolvedAdminRole: adminRole.name ? { id: config?.adminRoleId, name: adminRole.name } : null,
            resolvedOwner: ownerInfo,
        };

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'ticket_stats',
                payload: {
                    serverId,
                    stats
                }
            });
        }

        return stats;
    } catch (error) {
        console.error(`${colors.red}❌ Error getting ticket stats:${colors.reset}`, error);

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'ticket_error',
                payload: {
                    serverId,
                    error: error.message,
                    action: 'get_ticket_stats'
                }
            });
        }

        throw error;
    }
}


async function reinitializeTicketSystem(serverId) {
    console.log(`${colors.blue}🔄 Reinitializing ticket system for ${serverId}${colors.reset}`);
    try {
        if (client.isReady()) {
            await ticketHandler.reloadTicketConfig(serverId, client);
        } else {
            client.once('clientReady', () => ticketHandler.reloadTicketConfig(serverId, client));
        }
        console.log(`${colors.green}✅ Ticket system reloaded for ${serverId}${colors.reset}`);
    } catch (err) {
        console.error(`${colors.red}❌ Failed to reload ticket system for ${serverId}:${colors.reset}`, err);
    }
}


async function sendAllTicketConfigs(socket) {
    try {
        const ticketConfigs = await TicketConfig.find({});

        for (const config of ticketConfigs) {
            socket.emit('bot_data_update', {
                type: 'ticket_config',
                payload: {
                    serverId: config.serverId,
                    ticketChannelId: config.ticketChannelId,
                    transcriptChannelId: config.transcriptChannelId,
                    adminRoleId: config.adminRoleId,
                    status: config.status,
                    categoryId: config.categoryId,
                    ownerId: config.ownerId,
                    customEmbed: config.customEmbed,
                    interactionType: config.interactionType,
                    ticketOptions: config.ticketOptions,
                    _id: config._id
                }
            });
        }

        console.log(`${colors.green}📊 Sent ${ticketConfigs.length} ticket configs to middleware${colors.reset}`);
    } catch (error) {
        console.error(`${colors.red}❌ Error sending all ticket configs:${colors.reset}`, error);
    }
}

module.exports = {
    getTicketConfig,
    setupTicketSystem,
    updateTicketConfig,
    enableTicketSystem,
    disableTicketSystem,
    deleteTicketConfig,
    getTicketStats,
    sendAllTicketConfigs,
    reinitializeTicketSystem
};
