

const { MessageFlags } = require('discord.js');
const mongoose = require('mongoose');
const BoycottBan = require('../models/moderation/boycottBan');
const { buildCard, ACCENT } = require('../UI');
const { getEmoji } = require('../UI/emojis/emoji');
const loadLanguage = require('../events/loadLanguage');
const cacheManager = require('../utils/cacheManager');


async function loadCache(guildId) {
    if (mongoose.connection?.readyState !== 1) return [];
    try {
        const boycotts = await BoycottBan.find({ guildId });
        const result = boycotts || [];
        cacheManager.set('boycottData', guildId, result);
        return result;
    } catch (error) {
        console.error('[BoycottHandler] Cache load error:', error);
        cacheManager.set('boycottData', guildId, []);
        return [];
    }
}


async function getBoycottData(guildId) {
    const cached = cacheManager.get('boycottData', guildId);
    if (cached !== null) return cached;
    return await loadCache(guildId);
}


function isRestricted(member, boycottData) {
    for (const ban of boycottData) {
        if (ban.targetType === 'user' && member.id === ban.targetId) {
            return ban;
        }
        if (ban.targetType === 'role' && member.roles.cache.has(ban.targetId)) {
            return ban;
        }
    }
    return null;
}


function hasProtectedMember(channel, restrictedNearRoleId, excludeMemberId) {
    return channel.members.some(m =>
        m.id !== excludeMemberId &&
        m.roles.cache.has(restrictedNearRoleId)
    );
}

let registeredClient = null;
let voiceListener = null;

module.exports = (client) => {
    registeredClient = client;
    voiceListener = async (oldState, newState) => {
        
        if (!newState.channel) return;
        if (oldState.channelId === newState.channelId) return;

        const member = newState.member;
        const guild = newState.guild;
        const channel = newState.channel;

        try {
            const boycottData = await getBoycottData(guild.id);
            if (boycottData.length === 0) return;

            
            const restriction = isRestricted(member, boycottData);
            if (restriction) {
                
                if (hasProtectedMember(channel, restriction.restrictedNear, member.id)) {
                    await member.voice.disconnect('Boycott Ban: Cannot join VC with protected role present');
                    console.log(`[BoycottHandler] Disconnected ${member.user.tag} from ${channel.name}`);

                    
                    try {
                        const lang = loadLanguage(guild.id);
                        const bb = lang.moderation?.boycottban || {};
                        const card = buildCard({
                            title: `${getEmoji('cross')} ${bb.disconnectedTitle}`,
                            tone: 'danger',
                            sections: [
                                bb.joinedBlocked.replace('{channel}', channel.name)
                            ]
                        });
                        await member.send({ components: [card], flags: MessageFlags.IsComponentsV2 });
                    } catch (dmError) {
                        
                    }
                    return;
                }
            }

            
            for (const ban of boycottData) {
                if (member.roles.cache.has(ban.restrictedNear)) {
                    
                    
                    const restrictedMembers = channel.members.filter(m => {
                        if (m.id === member.id) return false;
                        if (ban.targetType === 'user' && m.id === ban.targetId) return true;
                        if (ban.targetType === 'role' && m.roles.cache.has(ban.targetId)) return true;
                        return false;
                    });

                    
                    for (const [id, restrictedMember] of restrictedMembers) {
                        await restrictedMember.voice.disconnect('Boycott Ban: Protected role joined the channel');
                        console.log(`[BoycottHandler] Disconnected ${restrictedMember.user.tag} - protected role joined`);

                        try {
                            const lang = loadLanguage(guild.id);
                            const bb = lang.moderation?.boycottban || {};
                            const card = buildCard({
                                title: `${getEmoji('cross')} ${bb.disconnectedTitle}`,
                                tone: 'danger',
                                sections: [
                                    bb.protectedJoined.replace('{channel}', channel.name)
                                ]
                            });
                            await restrictedMember.send({ components: [card], flags: MessageFlags.IsComponentsV2 });
                        } catch (dmError) {
                            
                        }
                    }
                }
            }
        } catch (error) {
            console.error('[BoycottHandler] Error:', error);
        }
    };
    if (client) {
        client.on('voiceStateUpdate', voiceListener);
    }
};

function stop(clientInstance) {
    const targetClient = clientInstance || registeredClient;
    if (targetClient && voiceListener) {
        targetClient.off('voiceStateUpdate', voiceListener);
        voiceListener = null;
    }
}


module.exports.invalidateCache = (guildId) => {
    cacheManager.delete('boycottData', guildId);
};
module.exports.stop = stop;
