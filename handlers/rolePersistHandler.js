

const mongoose = require('mongoose');
const RolePersist = require('../models/moderation/rolePersist');
const ServerConfig = require('../models/serverConfig/schema');
const cacheManager = require('../utils/cacheManager');
const { PermissionFlagsBits } = require('discord.js');


async function isRolePersistEnabled(guildId) {
    const cached = cacheManager.get('rolePersistEnabled', guildId);
    if (cached !== null) return cached === true;

    if (mongoose.connection?.readyState !== 1) return false;
    try {
        const config = await ServerConfig.findOne({ serverId: guildId });
        const isEnabled = config?.rolePersistEnabled === true;
        cacheManager.set('rolePersistEnabled', guildId, isEnabled);
        return isEnabled;
    } catch (error) {
        cacheManager.set('rolePersistEnabled', guildId, false);
        return false;
    }
}

let registeredClient = null;
let memberAddListener = null;

module.exports = (client) => {
    registeredClient = client;
    memberAddListener = async (member) => {
        const guild = member.guild;

        
        if (!await isRolePersistEnabled(guild.id)) return;
        if (mongoose.connection?.readyState !== 1) return;

        const botMember = guild.members.me;
        if (!botMember?.permissions?.has(PermissionFlagsBits.ManageRoles) ||
            member.id === guild.ownerId ||
            member.roles.highest.position >= botMember.roles.highest.position) {
            console.warn(`[RolePersistHandler] Cannot safely restore persistent roles for ${member.id} in guild ${guild.id}`);
            return;
        }

        try {
            
            const userData = await RolePersist.findOne({
                guildId: guild.id,
                userId: member.id
            });

            if (!userData || userData.roles.length === 0) return;

            
            const validRoles = userData.roles.filter(roleId => {
                const role = guild.roles.cache.get(roleId);
                return role && role.position < botMember.roles.highest.position;
            });

            if (validRoles.length === 0) return;

            
            await member.roles.add(validRoles, 'Role Persist: Re-applying persistent roles');
            console.log(`[RolePersistHandler] Applied ${validRoles.length} roles to ${member.user.tag}`);
        } catch (error) {
            console.error('[RolePersistHandler] Error:', error);
        }
    };

    if (client) {
        client.on('guildMemberAdd', memberAddListener);
    }
};

function stop(clientInstance) {
    const targetClient = clientInstance || registeredClient;
    if (targetClient && memberAddListener) {
        targetClient.off('guildMemberAdd', memberAddListener);
        memberAddListener = null;
    }
}

module.exports.invalidateCache = (guildId) => {
    cacheManager.delete('rolePersistEnabled', guildId);
};
module.exports.stop = stop;
