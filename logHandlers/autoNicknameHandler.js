const cacheManager = require('../utils/cacheManager');
const { nicknameConfigs } = require('../mongodb');
const { PermissionFlagsBits } = require('discord.js');

async function getNicknameConfig(guildId) {
    
    const cached = cacheManager.get('nicknameConfig', guildId);
    if (cached !== null) {
        return cached;
    }

    try {
        const config = await nicknameConfigs.findOne({ guildId });

        
        const result = config ? {
            nicknamePrefix: config.nicknamePrefix,
            status: config.status
        } : false;

        cacheManager.set('nicknameConfig', guildId, result);
        return result;
    } catch (error) {
        console.error(`[AutoNickname] Error loading config for ${guildId}:`, error);
        
        cacheManager.set('nicknameConfig', guildId, false);
        return false;
    }
}

function invalidateNicknameConfig(guildId) {
    cacheManager.delete('nicknameConfig', guildId);
}

module.exports = async function autoNicknameHandler(client) {
    client.on('guildMemberAdd', async (member) => {
        
        if (member.user.bot) return;

        const guildId = member.guild.id;

        
        const config = await getNicknameConfig(guildId);

        if (!config || !config.status) return;

        const prefix = config.nicknamePrefix;
        const newNickname = `${prefix} ${member.user.username}`.substring(0, 32);
        const botMember = member.guild.members.me;
        if (!botMember?.permissions?.has(PermissionFlagsBits.ManageNicknames) ||
            member.id === member.guild.ownerId ||
            member.roles.highest.position >= botMember.roles.highest.position) {
            console.warn(`[AutoNickname] Cannot safely set nickname for ${member.user.tag} in ${member.guild.name}: missing permission or role hierarchy`);
            return;
        }

        try {
            await member.setNickname(newNickname);
        } catch (error) {
            console.debug(`[AutoNickname] Failed to set nickname for ${member.user.tag} in ${member.guild.name}: ${error.message}`);
        }
    });
};

module.exports.getNicknameConfig = getNicknameConfig;
module.exports.invalidateNicknameConfig = invalidateNicknameConfig;
