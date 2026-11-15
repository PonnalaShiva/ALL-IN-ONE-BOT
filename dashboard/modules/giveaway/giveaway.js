const colors = require('../../../UI/colors/colors');
const { invalidateGiveaway } = require('../../../utils/cacheHelpers');
const GiveawayController = require('../../../models/giveaway/Controller'); 
const Giveaway = require('../../../models/giveaway/schema'); 
const client = require('../../../main');

async function sendAllGiveawayData(socket, guildId = null) {
    try {
        console.log(`${colors.blue}📊 Sending giveaway data to middleware${colors.reset}`);

        let query = {};
        if (guildId) {
            query.guildId = guildId;
        }

        const allGiveaways = await Giveaway.find(query).sort({ createdAt: -1 }).limit(100);

        
        const guildGroups = {};
        allGiveaways.forEach(giveaway => {
            if (!guildGroups[giveaway.guildId]) {
                guildGroups[giveaway.guildId] = [];
            }
            guildGroups[giveaway.guildId].push(giveaway);
        });

        for (const [guildId, giveaways] of Object.entries(guildGroups)) {
            emitGiveawayUpdate(guildId, {
                giveaways,
                stats: await getGiveawayStats(guildId)
            }, socket, 'server_giveaway_data');
        }

        console.log(`${colors.green}✅ Sent giveaway data for ${Object.keys(guildGroups).length} servers to middleware${colors.reset}`);

    } catch (error) {
        console.error(`${colors.red}❌ Error sending giveaway data:${colors.reset}`, error);
    }
}


function emitGiveawayUpdate(serverId, data, socket, eventType = 'giveaway_update') {
    if (socket && socket.emit) {
        socket.emit('bot_data_update', {
            type: eventType,
            payload: {
                serverId: serverId,
                data: data,
                timestamp: Date.now()
            }
        });
    }
}

async function createGiveaway(serverId, options, socket) {
    try {
        console.log(`${colors.blue}🎉 Creating giveaway for server ${serverId}${colors.reset}`);

        if (!client) {
            throw new Error('Discord client not available');
        }

        
        const ms = require('ms');
        const durationMs = ms(options.duration);
        if (!durationMs || durationMs < 60000) {
            throw new Error('Invalid duration! Minimum duration is 1 minute.');
        }

        
        const channel = await client.channels.fetch(options.channelId);
        if (!channel) {
            throw new Error('Channel not found');
        }

        
        const giveawayData = {
            guildId: serverId,
            channelId: options.channelId,
            hostId: options.hostId,
            title: options.title,
            description: options.description,
            prize: options.prize,
            duration: options.duration,
            winners: options.winners || 1,
            requirements: options.requirements || {
                roles: [],
                minAccountAge: 0,
                minServerAge: 0,
                blacklistedRoles: []
            },
            settings: options.settings || {
                dmWinners: true,
                showParticipants: true,
                allowMultipleEntries: false,
                autoDelete: false,
                autoDeleteDelay: 24
            }
        };

        
        const tempContainer = GiveawayController.createGiveawayContainer({
            ...giveawayData,
            entries: [],
            status: 'active',
            endTime: new Date(Date.now() + durationMs)
        });

        
        const { MessageFlags } = require('discord.js');
        const message = await channel.send({
            components: [tempContainer],
            flags: MessageFlags.IsComponentsV2
        });

        
        giveawayData.messageId = message.id;

        
        const result = await GiveawayController.createGiveaway(giveawayData);

        if (!result.success) {
            
            await message.delete().catch(() => { });
            throw new Error(result.error);
        }

        
        await GiveawayController.updateGiveawayMessage(client, result.giveaway);

        console.log(`${colors.green}✅ Giveaway created for server ${serverId}${colors.reset}`);

        
        emitGiveawayUpdate(serverId, {
            type: 'giveaway_created',
            giveaway: result.giveaway,
            stats: await getGiveawayStats(serverId)
        }, socket, 'giveaway_update');

        return result.giveaway;

    } catch (error) {
        console.error(`${colors.red}❌ Error creating giveaway for server ${serverId}:${colors.reset}`, error);

        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'giveaway_error',
                payload: {
                    serverId: serverId,
                    error: error.message,
                    action: 'create_giveaway',
                    timestamp: Date.now()
                }
            });
        }

        throw error;
    }
}

async function updateGiveaway(serverId, messageId, updates, client, socket) {
    try {
        console.log(`${colors.blue}🔄 Updating giveaway ${messageId} in server ${serverId}${colors.reset}`);

        const result = await GiveawayController.updateGiveaway(messageId, updates, client);

        if (!result.success) {
            throw new Error(result.error);
        }

        console.log(`${colors.green}✅ Giveaway updated for server ${serverId}${colors.reset}`);

        
        emitGiveawayUpdate(serverId, {
            type: 'giveaway_updated',
            messageId,
            giveaway: result.giveaway,
            stats: await getGiveawayStats(serverId)
        }, socket, 'giveaway_update');

        return result.giveaway;

    } catch (error) {
        console.error(`${colors.red}❌ Error updating giveaway ${messageId}:${colors.reset}`, error);

        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'giveaway_error',
                payload: {
                    serverId: serverId,
                    error: error.message,
                    action: 'update_giveaway',
                    messageId,
                    timestamp: Date.now()
                }
            });
        }

        throw error;
    }
}


async function deleteGiveaway(serverId, messageId, socket) {
    try {
        console.log(`${colors.blue}🗑️ Deleting giveaway ${messageId} in server ${serverId}${colors.reset}`);

        const result = await GiveawayController.deleteGiveaway(messageId);
        invalidateGiveaway(messageId);

        if (!result.success) {
            throw new Error(result.error);
        }

        console.log(`${colors.green}✅ Giveaway deleted for server ${serverId}${colors.reset}`);

        
        emitGiveawayUpdate(serverId, {
            type: 'giveaway_deleted',
            messageId,
            stats: await getGiveawayStats(serverId)
        }, socket, 'giveaway_update');

        return { deleted: true };

    } catch (error) {
        console.error(`${colors.red}❌ Error deleting giveaway ${messageId}:${colors.reset}`, error);

        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'giveaway_error',
                payload: {
                    serverId: serverId,
                    error: error.message,
                    action: 'delete_giveaway',
                    messageId,
                    timestamp: Date.now()
                }
            });
        }

        throw error;
    }
}


async function endGiveaway(serverId, messageId, client, socket) {
    try {
        console.log(`${colors.blue}🏁 Ending giveaway ${messageId} in server ${serverId}${colors.reset}`);

        const result = await GiveawayController.endGiveaway(messageId, client);
        invalidateGiveaway(messageId);

        if (!result.success) {
            throw new Error(result.error);
        }

        console.log(`${colors.green}✅ Giveaway ended for server ${serverId}${colors.reset}`);

        
        emitGiveawayUpdate(serverId, {
            type: 'giveaway_ended',
            messageId,
            giveaway: result.giveaway,
            winners: result.winners,
            stats: await getGiveawayStats(serverId)
        }, socket, 'giveaway_update');

        return { giveaway: result.giveaway, winners: result.winners };

    } catch (error) {
        console.error(`${colors.red}❌ Error ending giveaway ${messageId}:${colors.reset}`, error);

        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'giveaway_error',
                payload: {
                    serverId: serverId,
                    error: error.message,
                    action: 'end_giveaway',
                    messageId,
                    timestamp: Date.now()
                }
            });
        }

        throw error;
    }
}


async function rerollWinners(serverId, messageId, count, client, socket) {
    try {
        console.log(`${colors.blue}🎲 Rerolling winners for giveaway ${messageId} in server ${serverId}${colors.reset}`);

        const result = await GiveawayController.rerollWinners(messageId, count, client);
        invalidateGiveaway(messageId);

        if (!result.success) {
            throw new Error(result.error);
        }

        console.log(`${colors.green}✅ Winners rerolled for giveaway ${messageId}${colors.reset}`);

        
        emitGiveawayUpdate(serverId, {
            type: 'giveaway_rerolled',
            messageId,
            giveaway: result.giveaway,
            winners: result.winners,
            stats: await getGiveawayStats(serverId)
        }, socket, 'giveaway_update');

        return { giveaway: result.giveaway, winners: result.winners };

    } catch (error) {
        console.error(`${colors.red}❌ Error rerolling winners for giveaway ${messageId}:${colors.reset}`, error);

        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'giveaway_error',
                payload: {
                    serverId: serverId,
                    error: error.message,
                    action: 'reroll_winners',
                    messageId,
                    timestamp: Date.now()
                }
            });
        }

        throw error;
    }
}


async function addParticipant(serverId, messageId, userId, username, client, socket) {
    try {
        console.log(`${colors.blue}➕ Adding participant ${userId} to giveaway ${messageId}${colors.reset}`);

        const result = await GiveawayController.addParticipant(messageId, userId, username, client);
        invalidateGiveaway(messageId);

        if (!result.success) {
            throw new Error(result.error);
        }

        console.log(`${colors.green}✅ Participant added to giveaway ${messageId}${colors.reset}`);

        
        emitGiveawayUpdate(serverId, {
            type: 'participant_added',
            messageId,
            userId,
            giveaway: result.giveaway,
            stats: await getGiveawayStats(serverId)
        }, socket, 'giveaway_participant_update');

        return result.giveaway;

    } catch (error) {
        console.error(`${colors.red}❌ Error adding participant to giveaway ${messageId}:${colors.reset}`, error);

        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'giveaway_error',
                payload: {
                    serverId: serverId,
                    error: error.message,
                    action: 'add_participant',
                    messageId,
                    userId,
                    timestamp: Date.now()
                }
            });
        }

        throw error;
    }
}


async function removeParticipant(serverId, messageId, userId, client, socket) {
    try {
        console.log(`${colors.blue}➖ Removing participant ${userId} from giveaway ${messageId}${colors.reset}`);

        const result = await GiveawayController.removeParticipant(messageId, userId, client);
        invalidateGiveaway(messageId);

        if (!result.success) {
            throw new Error(result.error);
        }

        console.log(`${colors.green}✅ Participant removed from giveaway ${messageId}${colors.reset}`);

        
        emitGiveawayUpdate(serverId, {
            type: 'participant_removed',
            messageId,
            userId,
            giveaway: result.giveaway,
            stats: await getGiveawayStats(serverId)
        }, socket, 'giveaway_participant_update');

        return result.giveaway;

    } catch (error) {
        console.error(`${colors.red}❌ Error removing participant from giveaway ${messageId}:${colors.reset}`, error);

        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'giveaway_error',
                payload: {
                    serverId: serverId,
                    error: error.message,
                    action: 'remove_participant',
                    messageId,
                    userId,
                    timestamp: Date.now()
                }
            });
        }

        throw error;
    }
}


async function clearParticipants(serverId, messageId, client, socket) {
    try {
        console.log(`${colors.blue}🧹 Clearing all participants from giveaway ${messageId}${colors.reset}`);

        const result = await GiveawayController.clearParticipants(messageId, client);
        invalidateGiveaway(messageId);

        if (!result.success) {
            throw new Error(result.error);
        }

        console.log(`${colors.green}✅ All participants cleared from giveaway ${messageId}${colors.reset}`);

        
        emitGiveawayUpdate(serverId, {
            type: 'participants_cleared',
            messageId,
            giveaway: result.giveaway,
            stats: await getGiveawayStats(serverId)
        }, socket, 'giveaway_update');

        return result.giveaway;

    } catch (error) {
        console.error(`${colors.red}❌ Error clearing participants from giveaway ${messageId}:${colors.reset}`, error);

        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'giveaway_error',
                payload: {
                    serverId: serverId,
                    error: error.message,
                    action: 'clear_participants',
                    messageId,
                    timestamp: Date.now()
                }
            });
        }

        throw error;
    }
}


async function toggleGiveawayStatus(serverId, messageId, status, client, socket) {
    try {
        console.log(`${colors.blue}🔄 Toggling giveaway ${messageId} status to ${status}${colors.reset}`);

        const result = await GiveawayController.toggleGiveawayStatus(messageId, status, client);
        invalidateGiveaway(messageId);

        if (!result.success) {
            throw new Error(result.error);
        }

        console.log(`${colors.green}✅ Giveaway status changed to ${status}${colors.reset}`);

        
        emitGiveawayUpdate(serverId, {
            type: 'giveaway_status_changed',
            messageId,
            status,
            giveaway: result.giveaway,
            stats: await getGiveawayStats(serverId)
        }, socket, 'giveaway_update');

        return result.giveaway;

    } catch (error) {
        console.error(`${colors.red}❌ Error toggling giveaway status:${colors.reset}`, error);

        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'giveaway_error',
                payload: {
                    serverId: serverId,
                    error: error.message,
                    action: 'toggle_status',
                    messageId,
                    timestamp: Date.now()
                }
            });
        }

        throw error;
    }
}


async function getAllServerGiveaways(serverId, options = {}, socket) {
    try {
        console.log(`${colors.blue}📋 Getting giveaways for server ${serverId}${colors.reset}`);

        const { status = null, page = 1, limit = 10 } = options;

        const result = await GiveawayController.getGuildGiveaways(serverId, status);

        if (!result.success) {
            throw new Error(result.error);
        }

        
        const startIndex = (page - 1) * limit;
        const paginatedGiveaways = result.giveaways.slice(startIndex, startIndex + limit);

        const pagination = {
            current: page,
            total: Math.ceil(result.giveaways.length / limit),
            hasNext: startIndex + limit < result.giveaways.length,
            hasPrev: page > 1,
            totalItems: result.giveaways.length
        };

        console.log(`${colors.green}✅ Retrieved ${paginatedGiveaways.length} giveaways for server ${serverId}${colors.reset}`);

        
        emitGiveawayUpdate(serverId, {
            type: 'server_giveaway_list',
            giveaways: paginatedGiveaways,
            pagination,
            stats: await getGiveawayStats(serverId)
        }, socket, 'giveaway_server_data');

        return { giveaways: paginatedGiveaways, pagination };

    } catch (error) {
        console.error(`${colors.red}❌ Error getting server giveaways:${colors.reset}`, error);

        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'giveaway_error',
                payload: {
                    serverId: serverId,
                    error: error.message,
                    action: 'get_all_server_giveaways',
                    timestamp: Date.now()
                }
            });
        }

        throw error;
    }
}


async function getGiveaway(serverId, messageId, socket) {
    try {
        console.log(`${colors.blue}📋 Getting giveaway ${messageId} for server ${serverId}${colors.reset}`);

        const result = await GiveawayController.getGiveaway(messageId);

        if (!result.success) {
            throw new Error(result.error);
        }

        console.log(`${colors.green}✅ Retrieved giveaway ${messageId}${colors.reset}`);

        
        emitGiveawayUpdate(serverId, {
            type: 'single_giveaway',
            messageId,
            giveaway: result.giveaway
        }, socket, 'giveaway_data');

        return result.giveaway;

    } catch (error) {
        console.error(`${colors.red}❌ Error getting giveaway ${messageId}:${colors.reset}`, error);

        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'giveaway_error',
                payload: {
                    serverId: serverId,
                    error: error.message,
                    action: 'get_giveaway',
                    messageId,
                    timestamp: Date.now()
                }
            });
        }

        throw error;
    }
}


async function getGiveawayStats(serverId, socket = null) {
    try {
        const [
            totalGiveaways,
            activeGiveaways,
            endedGiveaways,
            totalParticipants,
            totalWinners,
            recentGiveaways
        ] = await Promise.all([
            Giveaway.countDocuments({ guildId: serverId }),
            Giveaway.countDocuments({ guildId: serverId, status: 'active' }),
            Giveaway.countDocuments({ guildId: serverId, status: 'ended' }),
            Giveaway.aggregate([
                { $match: { guildId: serverId } },
                { $group: { _id: null, total: { $sum: { $size: '$entries' } } } }
            ]),
            Giveaway.aggregate([
                { $match: { guildId: serverId } },
                { $group: { _id: null, total: { $sum: { $size: '$winnersList' } } } }
            ]),
            Giveaway.countDocuments({
                guildId: serverId,
                createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            })
        ]);

        const stats = {
            totalGiveaways,
            activeGiveaways,
            endedGiveaways,
            pausedGiveaways: await Giveaway.countDocuments({ guildId: serverId, status: 'paused' }),
            cancelledGiveaways: await Giveaway.countDocuments({ guildId: serverId, status: 'cancelled' }),
            totalParticipants: totalParticipants[0]?.total || 0,
            totalWinners: totalWinners[0]?.total || 0,
            recentGiveaways
        };

        if (socket) {
            emitGiveawayUpdate(serverId, {
                type: 'server_giveaway_stats',
                stats
            }, socket, 'giveaway_stats_update');
        }

        return stats;

    } catch (error) {
        console.error(`${colors.red}❌ Error getting giveaway stats:${colors.reset}`, error);
        return {
            totalGiveaways: 0,
            activeGiveaways: 0,
            endedGiveaways: 0,
            pausedGiveaways: 0,
            cancelledGiveaways: 0,
            totalParticipants: 0,
            totalWinners: 0,
            recentGiveaways: 0
        };
    }
}


async function handleExpiredGiveaways(client, socket) {
    try {


        const expiredGiveaways = await Giveaway.findExpiredGiveaways();

        for (const giveaway of expiredGiveaways) {
            const result = await GiveawayController.endGiveaway(giveaway.messageId, client);

            if (result.success) {
                
                emitGiveawayUpdate(giveaway.guildId, {
                    type: 'giveaway_auto_ended',
                    messageId: giveaway.messageId,
                    giveaway: result.giveaway,
                    winners: result.winners,
                    stats: await getGiveawayStats(giveaway.guildId)
                }, socket, 'giveaway_update');
            }
        }

        return { processed: expiredGiveaways.length };

    } catch (error) {
        throw error;
    }
}

module.exports = {
    sendAllGiveawayData,
    createGiveaway,
    updateGiveaway,
    deleteGiveaway,
    endGiveaway,
    rerollWinners,
    addParticipant,
    removeParticipant,
    clearParticipants,
    toggleGiveawayStatus,
    getAllServerGiveaways,
    getGiveaway,
    getGiveawayStats,
    handleExpiredGiveaways
};
