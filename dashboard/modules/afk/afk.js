const colors = require('../../../UI/colors/colors');
const AFK = require('../../../models/afk/schema');
const { invalidateAFKStatus } = require('../../../utils/cacheHelpers');
const client = require('../../../main');


async function enrichAFKData(afks) {
    return Promise.all(afks.map(async (afk) => {
        const afkObj = afk.toObject ? afk.toObject() : { ...afk };
        try {
            const guild = client.guilds.cache.get(afkObj.guildId);
            if (guild) {
                const member = guild.members.cache.get(afkObj.userId) ||
                    await guild.members.fetch(afkObj.userId).catch(() => null);
                if (member) {
                    afkObj.username = member.user.username;
                    afkObj.displayName = member.displayName;
                    afkObj.avatarURL = member.user.displayAvatarURL({ size: 64 });
                }
            }
        } catch (e) {   }
        if (!afkObj.username) {
            afkObj.username = 'Unknown User';
            afkObj.displayName = 'Unknown User';
        }
        return afkObj;
    }));
}


async function sendAllAFKData(socket, guildId = null) {
    try {
        console.log(`${colors.blue}📊 Sending AFK data to middleware${colors.reset}`);
        
        let query = { status: 'active' };
        if (guildId) {
            query.guildId = guildId;
        }
        
       
        await AFK.updateMany(
            { status: 'active', expiresAt: { $ne: null, $lte: new Date() } },
            { status: 'expired' }
        );
        
        const allAFKs = await AFK.find(query).sort({ setAt: -1 }).limit(100);
        const enriched = await enrichAFKData(allAFKs);
        
    
        const guildGroups = {};
        enriched.forEach(afk => {
            if (!guildGroups[afk.guildId]) {
                guildGroups[afk.guildId] = [];
            }
            guildGroups[afk.guildId].push(afk);
        });

        for (const [gid, afks] of Object.entries(guildGroups)) {
            emitAFKUpdate(gid, { afks, stats: await getAFKStats(gid) }, socket, 'server_afk_data');
        }
        
        console.log(`${colors.green}✅ Sent AFK data for ${Object.keys(guildGroups).length} servers to middleware${colors.reset}`);
        
    } catch (error) {
        console.error(`${colors.red}❌ Error sending AFK data:${colors.reset}`, error);
    }
}


function emitAFKUpdate(serverId, data, socket, eventType = 'afk_update') {
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


async function setUserAFK(userId, guildId, reason, options = {}, socket) {
    try {
        console.log(`${colors.blue}🌙 Setting AFK for user ${userId} in server ${guildId}${colors.reset}`);
        
        const {
            duration = null,
            dmNotifications = true,
            publicNotifications = true,
            showDuration = true,
            allowMentionTracking = true
        } = options;

       
        await AFK.findOneAndDelete({ userId, guildId });

        const afkData = {
            userId,
            guildId,
            reason,
            status: 'active',
            settings: {
                dmNotifications,
                publicNotifications,
                showDuration,
                allowMentionTracking
            }
        };

        if (duration) {
            afkData.expiresAt = new Date(Date.now() + duration);
        }

        const afk = new AFK(afkData);
        await afk.save();
        invalidateAFKStatus(userId, guildId);

   
        const enriched = (await enrichAFKData([afk]))[0];

        console.log(`${colors.green}✅ AFK set for user ${userId} in server ${guildId}${colors.reset}`);
        
       
        emitAFKUpdate(guildId, { 
            type: 'user_set_afk', 
            userId, 
            afk: enriched,
            stats: await getAFKStats(guildId)
        }, socket, 'afk_user_update');
        
        return afk;
        
    } catch (error) {
        console.error(`${colors.red}❌ Error setting AFK for user ${userId}:${colors.reset}`, error);
        
        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'afk_error',
                payload: {
                    serverId: guildId,
                    error: error.message,
                    action: 'set_user_afk',
                    userId,
                    timestamp: Date.now()
                }
            });
        }
        
        throw error;
    }
}


async function removeUserAFK(userId, guildId, socket) {
    try {
        console.log(`${colors.blue}🔄 Removing AFK for user ${userId} in server ${guildId}${colors.reset}`);
        
        const afk = await AFK.findOneAndUpdate(
            { userId, guildId, status: 'active' },
            { 
                status: 'removed',
                'metadata.lastActivity': new Date()
            },
            { returnDocument: 'after' }
        );

        if (!afk) {
            throw new Error('User is not AFK');
        }

    
        await afk.calculateTotalAfkTime();
        invalidateAFKStatus(userId, guildId);

        console.log(`${colors.green}✅ AFK removed for user ${userId} in server ${guildId}${colors.reset}`);
        
      
        emitAFKUpdate(guildId, { 
            type: 'user_remove_afk', 
            userId, 
            afk,
            stats: await getAFKStats(guildId)
        }, socket, 'afk_user_update');
        
        return afk;
        
    } catch (error) {
        console.error(`${colors.red}❌ Error removing AFK for user ${userId}:${colors.reset}`, error);
        
        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'afk_error',
                payload: {
                    serverId: guildId,
                    error: error.message,
                    action: 'remove_user_afk',
                    userId,
                    timestamp: Date.now()
                }
            });
        }
        
        throw error;
    }
}


async function getUserAFK(userId, guildId, socket) {
    try {
        console.log(`${colors.blue}📋 Getting AFK status for user ${userId} in server ${guildId}${colors.reset}`);
        
        const afk = await AFK.findActiveAFK(userId, guildId);
        
        console.log(`${colors.green}✅ AFK status retrieved for user ${userId} in server ${guildId}${colors.reset}`);
        
   
        emitAFKUpdate(guildId, { 
            type: 'user_afk_status', 
            userId, 
            afk 
        }, socket, 'afk_user_status');
        
        return afk;
        
    } catch (error) {
        console.error(`${colors.red}❌ Error getting AFK status for user ${userId}:${colors.reset}`, error);
        
        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'afk_error',
                payload: {
                    serverId: guildId,
                    error: error.message,
                    action: 'get_user_afk',
                    userId,
                    timestamp: Date.now()
                }
            });
        }
        
        throw error;
    }
}


async function getAllServerAFK(guildId, options = {}, socket) {
    try {
        console.log(`${colors.blue}📋 Getting all AFK users for server ${guildId}${colors.reset}`);
        
        const { page = 1, limit = 10, status = 'active' } = options;
        const skip = (page - 1) * limit;

        const query = { guildId };
        if (status !== 'all') {
            query.status = status;
        }

        const [afks, total] = await Promise.all([
            AFK.find(query)
                .sort({ setAt: -1 })
                .skip(skip)
                .limit(limit),
            AFK.countDocuments(query)
        ]);

        
        const enriched = await enrichAFKData(afks);

        const pagination = {
            current: page,
            total: Math.ceil(total / limit),
            hasNext: page * limit < total,
            hasPrev: page > 1,
            totalItems: total
        };

        console.log(`${colors.green}✅ Retrieved ${enriched.length} AFK users for server ${guildId}${colors.reset}`);
        
      
        emitAFKUpdate(guildId, { 
            type: 'server_afk_list', 
            afks: enriched, 
            pagination,
            stats: await getAFKStats(guildId)
        }, socket, 'afk_server_data');
        
        return { afks, pagination };
        
    } catch (error) {
        console.error(`${colors.red}❌ Error getting server AFK users:${colors.reset}`, error);
        
        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'afk_error',
                payload: {
                    serverId: guildId,
                    error: error.message,
                    action: 'get_all_server_afk',
                    timestamp: Date.now()
                }
            });
        }
        
        throw error;
    }
}


async function getAFKStats(guildId, socket = null) {
    try {
        const stats = await AFK.getGuildAFKStats(guildId);
        
       
        const processedStats = {
            active: 0,
            expired: 0,
            removed: 0,
            totalMentions: 0
        };

        stats.forEach(stat => {
            processedStats[stat._id] = stat.count;
            processedStats.totalMentions += stat.totalMentions;
        });

     
        const [totalUsers, usersWithAutoResponse, recentAFK] = await Promise.all([
            AFK.countDocuments({ guildId }),
            AFK.countDocuments({ guildId, 'autoResponses.enabled': true }),
            AFK.countDocuments({ 
                guildId, 
                setAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } 
            })
        ]);

        const finalStats = {
            ...processedStats,
            totalUsers,
            usersWithAutoResponse,
            recentAFK
        };

        if (socket) {
            emitAFKUpdate(guildId, { 
                type: 'server_afk_stats', 
                stats: finalStats 
            }, socket, 'afk_stats_update');
        }
        
        return finalStats;
        
    } catch (error) {
        console.error(`${colors.red}❌ Error getting AFK stats:${colors.reset}`, error);
        return {
            active: 0,
            expired: 0,
            removed: 0,
            totalMentions: 0,
            totalUsers: 0,
            usersWithAutoResponse: 0,
            recentAFK: 0
        };
    }
}


async function updateAutoResponse(userId, guildId, settings, socket) {
    try {
        console.log(`${colors.blue}🤖 Updating auto-response for user ${userId} in server ${guildId}${colors.reset}`);
        
        const afk = await AFK.findOne({ userId, guildId, status: 'active' });
        if (!afk) {
            throw new Error('User is not AFK');
        }

        afk.autoResponses = {
            ...afk.autoResponses,
            ...settings
        };

        await afk.save();

        console.log(`${colors.green}✅ Auto-response updated for user ${userId} in server ${guildId}${colors.reset}`);
        
        
        emitAFKUpdate(guildId, { 
            type: 'user_auto_response_update', 
            userId, 
            afk 
        }, socket, 'afk_user_update');
        
        return afk;
        
    } catch (error) {
        console.error(`${colors.red}❌ Error updating auto-response for user ${userId}:${colors.reset}`, error);
        
        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'afk_error',
                payload: {
                    serverId: guildId,
                    error: error.message,
                    action: 'update_auto_response',
                    userId,
                    timestamp: Date.now()
                }
            });
        }
        
        throw error;
    }
}


async function addMentionToAFK(userId, guildId, mentionedBy, socket) {
    try {
        const afk = await AFK.findOne({ userId, guildId, status: 'active' });
        if (!afk) {
            throw new Error('User is not AFK');
        }

        await afk.addMention(mentionedBy);

     
        emitAFKUpdate(guildId, { 
            type: 'user_mention_added', 
            userId, 
            mentionedBy: mentionedBy.id,
            afk 
        }, socket, 'afk_mention_update');
        
        return { afk, canAutoRespond: afk.canSendAutoResponse() };
        
    } catch (error) {
        console.error(`${colors.red}❌ Error adding mention to AFK user ${userId}:${colors.reset}`, error);
        throw error;
    }
}


async function markAutoResponseSent(userId, guildId, socket) {
    try {
        const afk = await AFK.findOne({ userId, guildId, status: 'active' });
        if (!afk) {
            throw new Error('User is not AFK');
        }

        await afk.markAutoResponseSent();
        
        return { marked: true };
        
    } catch (error) {
        console.error(`${colors.red}❌ Error marking auto-response sent for user ${userId}:${colors.reset}`, error);
        throw error;
    }
}


async function cleanupExpiredAFK(socket) {
    try {

        
        const expiredAFKs = await AFK.findExpiredAFKs();
        
        for (const afk of expiredAFKs) {
            afk.status = 'expired';
            await afk.calculateTotalAfkTime();
            await afk.save();

            
            emitAFKUpdate(afk.guildId, { 
                type: 'user_afk_expired', 
                userId: afk.userId, 
                afk 
            }, socket, 'afk_user_update');
        }

        return { cleaned: expiredAFKs.length };
        
    } catch (error) {

        throw error;
    }
}


function parseDuration(durationStr) {
    const regex = /^(\d+)([smhd])$/i;
    const match = durationStr.match(regex);
    
    if (!match) return null;
    
    const amount = parseInt(match[1]);
    const unit = match.toLowerCase();
    
    const multipliers = {
        s: 1000,           
        m: 60 * 1000,      
        h: 60 * 60 * 1000, 
        d: 24 * 60 * 60 * 1000 
    };
    
    return amount * multipliers[unit];
}

module.exports = {
    sendAllAFKData,
    setUserAFK,
    removeUserAFK,
    getUserAFK,
    getAllServerAFK,
    getAFKStats,
    updateAutoResponse,
    addMentionToAFK,
    markAutoResponseSent,
    cleanupExpiredAFK,
    parseDuration
};
