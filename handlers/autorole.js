const mongoose = require('mongoose');
const Autorole = require('../models/autorole/autorole');
const cacheManager = require('../utils/cacheManager');
const { PermissionFlagsBits } = require('discord.js');
const { isSafeSelfAssignableRole } = require('../utils/roleAuthorization');

async function getAutoroleConfig(guildId) {
    
    const cached = cacheManager.get('autoroleConfig', guildId);
    if (cached !== null) {
        return cached;
    }

    if (mongoose.connection?.readyState !== 1) return false;
    try {
        const config = await Autorole.findOne({ serverId: guildId });
        
        
        const result = config ? {
            roleId: config.roleId,
            status: config.status,
            ownerId: config.ownerId
        } : false;
        
        cacheManager.set('autoroleConfig', guildId, result);
        return result;
    } catch (error) {
        console.error(`[Autorole] Error loading config for ${guildId}:`, error);
        
        cacheManager.set('autoroleConfig', guildId, false);
        return false;
    }
}

function invalidateAutoroleConfig(guildId) {
    cacheManager.delete('autoroleConfig', guildId);
}

let registeredClient = null;
let memberAddListener = null;

module.exports = (client) => {
    registeredClient = client;
    memberAddListener = async member => {
        
        if (member.user.bot) return;

        try {
            const guildId = member.guild.id;
            
            
            const settings = await getAutoroleConfig(guildId);

            if (!settings || settings.status !== true) {
                return;
            }

            const role = member.guild.roles.cache.get(settings.roleId);

            if (!role) {
                console.error(`[Autorole] Role with ID ${settings.roleId} not found in guild ${member.guild.name} (${guildId})`);
                return;
            }

            const botMember = member.guild.members.me;
            if (!botMember?.permissions?.has(PermissionFlagsBits.ManageRoles) || !isSafeSelfAssignableRole(role)) {
                console.error(`[Autorole] Refusing unsafe or unauthorized role assignment for ${role.name} in guild ${member.guild.name} (${guildId})`);
                return;
            }

            if (role.position >= botMember.roles.highest.position) {
                console.error(`[Autorole] Cannot assign role ${role.name} in guild ${member.guild.name} - role hierarchy issue`);
                return;
            }

            if (!role.editable) {
                console.error(`[Autorole] Role ${role.name} in guild ${member.guild.name} is not editable by the bot`);
                return;
            }

            await member.roles.add(role, 'Auto-role assignment');

        } catch (error) {
            
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

module.exports.getAutoroleConfig = getAutoroleConfig;
module.exports.invalidateAutoroleConfig = invalidateAutoroleConfig;
module.exports.stop = stop;
