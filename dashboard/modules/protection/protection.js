const LockRole = require('../../../models/moderation/lockRole');
const RolePersist = require('../../../models/moderation/rolePersist');
const BoycottBan = require('../../../models/moderation/boycottBan');
const ServerConfig = require('../../../models/serverConfig/schema');
const colors = require('../../../UI/colors/colors');
const client = require('../../../main');

let protectionHandler;
try { protectionHandler = require('../../../handlers/protectionHandler'); } catch {}
let boycottHandler;
try { boycottHandler = require('../../../handlers/boycottHandler'); } catch {}
let cacheHelpers;
try { cacheHelpers = require('../../../utils/cacheHelpers'); } catch {}

async function getLockRoles(guildId, socket) {
    try {
        const lockRoles = await LockRole.find({ guildId });
        const serverConfig = await ServerConfig.findOne({ serverId: guildId });

        const guild = client.guilds.cache.get(guildId);
        const rolesWithDetails = lockRoles.map(lr => {
            const role = guild?.roles.cache.get(lr.roleId);
            return {
                _id: lr._id,
                roleId: lr.roleId,
                roleName: role?.name || 'Unknown Role',
                roleColor: role?.hexColor || '#000000',
                addedAt: lr.createdAt,
                addedBy: lr.addedBy
            };
        });

        const enabled = serverConfig?.lockRoleEnabled || false;

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'lock_roles_data',
                payload: {
                    guildId,
                    enabled,
                    roles: rolesWithDetails
                }
            });
        }

        console.log(`${colors.green}✅ Sent ${lockRoles.length} lock roles for ${guildId}${colors.reset}`);
        return { enabled, roles: rolesWithDetails };
    } catch (error) {
        console.error(`${colors.red}❌ Error getting lock roles:${colors.reset}`, error);
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'lock_role_error',
                payload: { guildId, error: error.message, action: 'get_lock_roles' }
            });
        }
        throw error;
    }
}

async function addLockRole(guildId, roleId, addedBy, socket) {
    try {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) throw new Error('Guild not found');

        const role = guild.roles.cache.get(roleId);
        if (!role) throw new Error('Role not found');

        const existing = await LockRole.findOne({ guildId, roleId });
        if (existing) throw new Error('Role is already protected');

        const lockRole = new LockRole({ guildId, roleId, addedBy });
        await lockRole.save();

        
        await ServerConfig.findOneAndUpdate(
            { serverId: guildId },
            { $set: { lockRoleEnabled: true } },
            { upsert: true }
        );

        if (cacheHelpers?.invalidateServerConfig) {
            cacheHelpers.invalidateServerConfig(guildId);
        }
        if (protectionHandler?.invalidateCache) {
            protectionHandler.invalidateCache(guildId);
        }

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'lock_role_added',
                payload: {
                    guildId,
                    role: {
                        _id: lockRole._id,
                        roleId,
                        roleName: role.name,
                        roleColor: role.hexColor,
                        addedAt: lockRole.createdAt,
                        addedBy
                    }
                }
            });
        }

        console.log(`${colors.green}🔒 Added lock role ${role.name} for ${guildId}${colors.reset}`);

        
        return await getLockRoles(guildId, socket);
    } catch (error) {
        console.error(`${colors.red}❌ Error adding lock role:${colors.reset}`, error);
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'lock_role_error',
                payload: { guildId, error: error.message, action: 'add_lock_role' }
            });
        }
        throw error;
    }
}

async function removeLockRole(guildId, roleId, socket) {
    try {
        const result = await LockRole.findOneAndDelete({ guildId, roleId });
        if (!result) throw new Error('Role protection not found');

        if (protectionHandler?.invalidateCache) {
            protectionHandler.invalidateCache(guildId);
        }

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'lock_role_removed',
                payload: { guildId, roleId }
            });
        }

        console.log(`${colors.yellow}🔓 Removed lock role ${roleId} for ${guildId}${colors.reset}`);

        
        return await getLockRoles(guildId, socket);
    } catch (error) {
        console.error(`${colors.red}❌ Error removing lock role:${colors.reset}`, error);
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'lock_role_error',
                payload: { guildId, error: error.message, action: 'remove_lock_role' }
            });
        }
        throw error;
    }
}

async function toggleLockRoleSystem(guildId, enabled, socket) {
    try {
        await ServerConfig.findOneAndUpdate(
            { serverId: guildId },
            { $set: { lockRoleEnabled: enabled } },
            { upsert: true }
        );

        if (cacheHelpers?.invalidateServerConfig) {
            cacheHelpers.invalidateServerConfig(guildId);
        }

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'lock_role_toggled',
                payload: { guildId, enabled }
            });
        }

        console.log(`${colors.cyan}⚙️ Lock role system ${enabled ? 'enabled' : 'disabled'} for ${guildId}${colors.reset}`);

        
        return await getLockRoles(guildId, socket);
    } catch (error) {
        console.error(`${colors.red}❌ Error toggling lock role system:${colors.reset}`, error);
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'lock_role_error',
                payload: { guildId, error: error.message, action: 'toggle_lock_role' }
            });
        }
        throw error;
    }
}

async function getRolePersistConfig(guildId, socket) {
    try {
        const serverConfig = await ServerConfig.findOne({ serverId: guildId });
        const persistedMembers = await RolePersist.find({ guildId });

        const guild = client.guilds.cache.get(guildId);
        const membersWithDetails = persistedMembers.map(pm => {
            const targetUserId = pm.userId || pm.oderId;
            const member = guild?.members.cache.get(targetUserId);
            const roles = (pm.roles || []).map(roleId => {
                const role = guild?.roles.cache.get(roleId);
                return { roleId, roleName: role?.name || 'Unknown', roleColor: role?.hexColor || '#000000' };
            });
            return {
                _id: pm._id,
                userId: targetUserId,
                oderId: targetUserId, 
                username: member?.user.username || 'Unknown User',
                roles,
                createdAt: pm.createdAt
            };
        });

        const enabled = serverConfig?.rolePersistEnabled || false;

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'role_persist_data',
                payload: {
                    guildId,
                    enabled,
                    members: membersWithDetails
                }
            });
        }

        console.log(`${colors.green}✅ Sent role persist config for ${guildId}${colors.reset}`);
        return { enabled, members: membersWithDetails };
    } catch (error) {
        console.error(`${colors.red}❌ Error getting role persist config:${colors.reset}`, error);
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'role_persist_error',
                payload: { guildId, error: error.message, action: 'get_role_persist' }
            });
        }
        throw error;
    }
}

async function toggleRolePersistSystem(guildId, enabled, socket) {
    try {
        await ServerConfig.findOneAndUpdate(
            { serverId: guildId },
            { $set: { rolePersistEnabled: enabled } },
            { upsert: true }
        );

        if (cacheHelpers?.invalidateServerConfig) {
            cacheHelpers.invalidateServerConfig(guildId);
        }

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'role_persist_toggled',
                payload: { guildId, enabled }
            });
        }

        console.log(`${colors.cyan}⚙️ Role persist system ${enabled ? 'enabled' : 'disabled'} for ${guildId}${colors.reset}`);

        
        return await getRolePersistConfig(guildId, socket);
    } catch (error) {
        console.error(`${colors.red}❌ Error toggling role persist:${colors.reset}`, error);
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'role_persist_error',
                payload: { guildId, error: error.message, action: 'toggle_role_persist' }
            });
        }
        throw error;
    }
}

async function removeRolePersist(guildId, targetUserId, socket) {
    try {
        const result = await RolePersist.findOneAndDelete({
            guildId,
            $or: [{ userId: targetUserId }, { oderId: targetUserId }]
        });
        if (!result) throw new Error('Role persist entry not found');

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'role_persist_removed',
                payload: { guildId, userId: targetUserId, oderId: targetUserId }
            });
        }

        console.log(`${colors.yellow}🗑️ Removed role persist for user ${targetUserId} in ${guildId}${colors.reset}`);

        
        return await getRolePersistConfig(guildId, socket);
    } catch (error) {
        console.error(`${colors.red}❌ Error removing role persist:${colors.reset}`, error);
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'role_persist_error',
                payload: { guildId, error: error.message, action: 'remove_role_persist' }
            });
        }
        throw error;
    }
}

async function getBoycottBans(guildId, socket) {
    try {
        const boycottBans = await BoycottBan.find({ guildId });

        const guild = client.guilds.cache.get(guildId);
        const bansWithDetails = await Promise.all(boycottBans.map(async bb => {
            const targetUserId = bb.userId || bb.targetId;
            let username = 'Unknown User';
            try {
                const member = guild?.members.cache.get(targetUserId);
                if (member) {
                    username = member.user.username;
                } else {
                    const user = await client.users.fetch(targetUserId).catch(() => null);
                    if (user) username = user.username;
                }
            } catch { }

            const roleList = (Array.isArray(bb.protectedRoles) && bb.protectedRoles.length > 0)
                ? bb.protectedRoles
                : (bb.restrictedNear ? [bb.restrictedNear] : []);

            const protectedRoles = roleList.map(roleId => {
                const role = guild?.roles.cache.get(roleId);
                return { roleId, roleName: role?.name || 'Unknown', roleColor: role?.hexColor || '#000000' };
            });

            return {
                _id: bb._id,
                userId: targetUserId,
                targetId: targetUserId,
                oderId: targetUserId, 
                username,
                protectedRoles,
                reason: bb.reason || 'No reason provided',
                addedBy: bb.addedBy,
                createdAt: bb.createdAt
            };
        }));

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'boycott_bans_data',
                payload: { guildId, bans: bansWithDetails }
            });
        }

        console.log(`${colors.green}✅ Sent ${boycottBans.length} boycott bans for ${guildId}${colors.reset}`);
        return bansWithDetails;
    } catch (error) {
        console.error(`${colors.red}❌ Error getting boycott bans:${colors.reset}`, error);
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'boycott_ban_error',
                payload: { guildId, error: error.message, action: 'get_boycott_bans' }
            });
        }
        throw error;
    }
}

async function addBoycottBan(guildId, data, socket) {
    try {
        const { userId, targetId, protectedRoles, restrictedNear, reason, addedBy } = data;
        const targetUserId = userId || targetId;
        const rolesArray = (Array.isArray(protectedRoles) && protectedRoles.length > 0)
            ? protectedRoles
            : (restrictedNear ? [restrictedNear] : []);

        if (!targetUserId) throw new Error('Target user ID is required');
        if (rolesArray.length === 0) throw new Error('At least one protected role is required');

        const guild = client.guilds.cache.get(guildId);
        if (!guild) throw new Error('Guild not found');

        const existing = await BoycottBan.findOne({
            guildId,
            $or: [{ targetId: targetUserId }, { userId: targetUserId }]
        });
        if (existing) throw new Error('User is already boycott banned');

        const boycottBan = new BoycottBan({
            guildId,
            targetId: targetUserId,
            targetType: 'user',
            restrictedNear: rolesArray[0],
            userId: targetUserId,
            protectedRoles: rolesArray,
            reason: reason || 'No reason provided',
            addedBy
        });
        await boycottBan.save();

        if (boycottHandler?.invalidateCache) {
            boycottHandler.invalidateCache(guildId);
        }

        let username = 'Unknown User';
        try {
            const user = await client.users.fetch(targetUserId).catch(() => null);
            if (user) username = user.username;
        } catch { }

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'boycott_ban_added',
                payload: {
                    guildId,
                    ban: {
                        _id: boycottBan._id,
                        userId: targetUserId,
                        targetId: targetUserId,
                        username,
                        protectedRoles: rolesArray.map(roleId => {
                            const role = guild.roles.cache.get(roleId);
                            return { roleId, roleName: role?.name || 'Unknown', roleColor: role?.hexColor || '#000000' };
                        }),
                        reason: boycottBan.reason,
                        addedBy,
                        createdAt: boycottBan.createdAt
                    }
                }
            });
        }

        console.log(`${colors.green}🚫 Added boycott ban for user ${targetUserId} in ${guildId}${colors.reset}`);

        
        return await getBoycottBans(guildId, socket);
    } catch (error) {
        console.error(`${colors.red}❌ Error adding boycott ban:${colors.reset}`, error);
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'boycott_ban_error',
                payload: { guildId, error: error.message, action: 'add_boycott_ban' }
            });
        }
        throw error;
    }
}

async function removeBoycottBan(guildId, targetUserId, socket) {
    try {
        const result = await BoycottBan.findOneAndDelete({
            guildId,
            $or: [{ targetId: targetUserId }, { userId: targetUserId }]
        });
        if (!result) throw new Error('Boycott ban not found');

        if (boycottHandler?.invalidateCache) {
            boycottHandler.invalidateCache(guildId);
        }

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'boycott_ban_removed',
                payload: { guildId, userId: targetUserId }
            });
        }

        console.log(`${colors.yellow}✅ Removed boycott ban for user ${targetUserId} in ${guildId}${colors.reset}`);

        
        return await getBoycottBans(guildId, socket);
    } catch (error) {
        console.error(`${colors.red}❌ Error removing boycott ban:${colors.reset}`, error);
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'boycott_ban_error',
                payload: { guildId, error: error.message, action: 'remove_boycott_ban' }
            });
        }
        throw error;
    }
}

async function sendAllProtectionData(socket) {
    try {
        
        const lockRoles = await LockRole.distinct('guildId');
        const rolePersists = await RolePersist.distinct('guildId');
        const boycottBans = await BoycottBan.distinct('guildId');

        const allGuildIds = [...new Set([...lockRoles, ...rolePersists, ...boycottBans])];

        for (const guildId of allGuildIds) {
            try {
                await getLockRoles(guildId, socket);
                await getRolePersistConfig(guildId, socket);
                await getBoycottBans(guildId, socket);
                await new Promise(resolve => setTimeout(resolve, 50));
            } catch (err) {
                console.error(`Error sending protection data for ${guildId}:`, err);
            }
        }

        console.log(`${colors.green}📊 Sent protection data for ${allGuildIds.length} guilds${colors.reset}`);
    } catch (error) {
        console.error(`${colors.red}❌ Error sending all protection data:${colors.reset}`, error);
    }
}

module.exports = {
    
    getLockRoles,
    addLockRole,
    removeLockRole,
    toggleLockRoleSystem,
    
    getRolePersistConfig,
    toggleRolePersistSystem,
    removeRolePersist,
    
    getBoycottBans,
    addBoycottBan,
    removeBoycottBan,
    
    sendAllProtectionData
};
