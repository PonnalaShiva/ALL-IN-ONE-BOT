

const LockRole = require('../models/moderation/lockRole');
const ServerConfig = require('../models/serverConfig/schema');
const { AuditLogEvent } = require('discord.js');
const mongoose = require('mongoose');
const cacheManager = require('../utils/cacheManager');


const lockRoleCache = new Map();


async function loadCache(guildId) {
    if (mongoose.connection?.readyState !== 1) return;
    try {
        const lockedRoles = await LockRole.find({ guildId, enabled: true });
        const roleMap = new Map();
        lockedRoles.forEach(lr => roleMap.set(lr.roleId, lr));
        lockRoleCache.set(guildId, roleMap);
    } catch (error) {
        console.error('[ProtectionHandler] Cache load error:', error);
    }
}


async function isLockRoleEnabled(guildId) {
    const cached = cacheManager.get('lockRoleEnabled', guildId);
    if (cached !== null) return cached === true;

    if (mongoose.connection?.readyState !== 1) return false;
    try {
        const config = await ServerConfig.findOne({ serverId: guildId });
        const isEnabled = config?.lockRoleEnabled === true;
        cacheManager.set('lockRoleEnabled', guildId, isEnabled);
        return isEnabled;
    } catch (error) {
        cacheManager.set('lockRoleEnabled', guildId, false);
        return false;
    }
}


async function getLockData(guildId, roleId) {
    if (!lockRoleCache.has(guildId)) {
        await loadCache(guildId);
    }
    return lockRoleCache.get(guildId)?.get(roleId);
}


async function applyPunishment(guild, userId, lockData, reason) {
    try {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) return;

        switch (lockData.punishment) {
            case 'kick':
                await member.kick(reason);
                console.log(`[ProtectionHandler] Kicked ${member.user.tag} for: ${reason}`);
                break;
            case 'ban':
                await member.ban({ reason });
                console.log(`[ProtectionHandler] Banned ${member.user.tag} for: ${reason}`);
                break;
            case 'log':
            default:
                console.log(`[ProtectionHandler] Logged violation by ${member.user.tag}: ${reason}`);
                break;
        }
    } catch (error) {
        console.error('[ProtectionHandler] Punishment error:', error);
    }
}


async function getExecutor(guild, auditType, targetId) {
    try {
        const auditLogs = await guild.fetchAuditLogs({ type: auditType, limit: 5 });
        const entry = auditLogs.entries.find(e =>
            e.target?.id === targetId &&
            Date.now() - e.createdTimestamp < 5000
        );
        return entry?.executor;
    } catch (error) {
        return null;
    }
}

let registeredClient = null;
const listeners = {};

module.exports = (client) => {
    registeredClient = client;
    
    listeners.guildMemberUpdate = async (oldMember, newMember) => {
        const guild = newMember.guild;

        if (!await isLockRoleEnabled(guild.id)) return;

        const oldRoles = oldMember.roles.cache;
        const newRoles = newMember.roles.cache;

        
        const addedRoles = newRoles.filter(r => !oldRoles.has(r.id));
        
        const removedRoles = oldRoles.filter(r => !newRoles.has(r.id));

        for (const [roleId, role] of [...addedRoles, ...removedRoles]) {
            const lockData = await getLockData(guild.id, roleId);
            if (!lockData) continue;

            
            const executor = await getExecutor(guild, AuditLogEvent.MemberRoleUpdate, newMember.id);
            if (!executor) continue;

            
            if (lockData.whitelistedUsers.includes(executor.id)) continue;

            
            try {
                if (addedRoles.has(roleId)) {
                    await newMember.roles.remove(roleId, 'Lock Role protection: unauthorized add');
                    console.log(`[ProtectionHandler] Reverted add of ${role.name} to ${newMember.user.tag}`);
                } else {
                    await newMember.roles.add(roleId, 'Lock Role protection: unauthorized remove');
                    console.log(`[ProtectionHandler] Reverted remove of ${role.name} from ${newMember.user.tag}`);
                }

                await applyPunishment(guild, executor.id, lockData, `Unauthorized modification of locked role: ${role.name}`);
            } catch (error) {
                console.error('[ProtectionHandler] Revert error:', error);
            }
        }
    };

    listeners.roleUpdate = async (oldRole, newRole) => {
        const guild = newRole.guild;

        if (!await isLockRoleEnabled(guild.id)) return;

        const lockData = await getLockData(guild.id, newRole.id);
        if (!lockData) return;

        
        const hasChanges = oldRole.name !== newRole.name ||
            oldRole.color !== newRole.color ||
            oldRole.permissions.bitfield !== newRole.permissions.bitfield ||
            oldRole.position !== newRole.position;

        if (!hasChanges) return;

        
        const executor = await getExecutor(guild, AuditLogEvent.RoleUpdate, newRole.id);
        if (!executor) return;

        if (lockData.whitelistedUsers.includes(executor.id)) return;

        
        try {
            await newRole.edit({
                name: oldRole.name,
                color: oldRole.color,
                permissions: oldRole.permissions,
                position: oldRole.position
            }, 'Lock Role protection: unauthorized edit');

            console.log(`[ProtectionHandler] Reverted edit of ${newRole.name}`);
            await applyPunishment(guild, executor.id, lockData, `Unauthorized edit of locked role: ${newRole.name}`);
        } catch (error) {
            console.error('[ProtectionHandler] Role revert error:', error);
        }
    };

    listeners.roleDelete = async (role) => {
        const guild = role.guild;

        if (!await isLockRoleEnabled(guild.id)) return;

        const lockData = await getLockData(guild.id, role.id);
        if (!lockData) return;

        
        const executor = await getExecutor(guild, AuditLogEvent.RoleDelete, role.id);
        if (!executor) return;

        if (lockData.whitelistedUsers.includes(executor.id)) return;

        console.log(`[ProtectionHandler] Locked role ${role.name} was deleted by ${executor.tag}`);
        await applyPunishment(guild, executor.id, lockData, `Deleted locked role: ${role.name}`);

        
        await LockRole.deleteOne({ guildId: guild.id, roleId: role.id });
        lockRoleCache.get(guild.id)?.delete(role.id);
    };

    if (client) {
        client.on('guildMemberUpdate', listeners.guildMemberUpdate);
        client.on('roleUpdate', listeners.roleUpdate);
        client.on('roleDelete', listeners.roleDelete);
    }
};

function stop(clientInstance) {
    const targetClient = clientInstance || registeredClient;
    if (targetClient && listeners.guildMemberUpdate) {
        targetClient.off('guildMemberUpdate', listeners.guildMemberUpdate);
        targetClient.off('roleUpdate', listeners.roleUpdate);
        targetClient.off('roleDelete', listeners.roleDelete);
    }
    lockRoleCache.clear();
}


module.exports.invalidateCache = (guildId) => {
    lockRoleCache.delete(guildId);
    cacheManager.delete('lockRoleEnabled', guildId);
};
module.exports.stop = stop;
