const { MessageFlags } = require('discord.js');
const { getEmoji } = require('../UI/emojis/emoji');
const loadLanguage = require('../events/loadLanguage');
const logHandlersIcons = require('../UI/icons/loghandlers');
const { getLogConfig } = require('../utils/cacheHelpers');
const { buildCard, ACCENT } = require('../UI');

module.exports = async function voiceLeaveHandler(client) {
    client.on('voiceStateUpdate', async (oldState, newState) => {
        if (!oldState?.channel || oldState?.channelId === newState?.channelId) return;
        if (!oldState.guild) return;

        const config = await getLogConfig(oldState.guild.id, 'voiceLeave');
        if (!config || !config.channelId) return;

        const logChannel = client.channels.cache.get(config.channelId)
            || await client.channels.fetch(config.channelId).catch(() => null);
        if (!logChannel) return;

        const lang = await loadLanguage(oldState.guild.id);
        const s = lang?.serverlogs || {};

        const member = oldState.member;
        const memberUser = member?.user;
        const userAvatar = memberUser?.displayAvatarURL?.({ dynamic: true, size: 256 }) || logHandlersIcons.leaveIcon;

        const card = buildCard({
            title: `${getEmoji('voice')} ${s.voiceLeftTitle || 'Voice Channel Left'}`,
            accentColor: ACCENT.warning,
            thumbnailURL: userAvatar,
            sections: [
                `> **${s.voiceLeftDesc || 'Voice activity ended'}**\n\n• **${s.memberLabel || 'Member'}:** ${memberUser ? `<@${member.id}> (\`${memberUser.tag || memberUser.username}\`)` : `\`${oldState.id}\``}\n• **${s.userIdLabel || 'User ID'}:** \`${member?.id || oldState.id}\`\n• **${s.channelLabel || 'Channel'}:** <#${oldState.channel.id}> (\`#${oldState.channel.name}\`)`,
                `### ${getEmoji('settings')} ${s.voiceDetailsHeader || 'Voice Channel Details'}\n• **${s.channelIdLabel || 'Channel ID'}:** \`${oldState.channel.id}\`\n• **${s.categoryLabel || 'Category'}:** ${oldState.channel.parent ? `\`${oldState.channel.parent.name}\`` : `\`${s.none || 'None'}\``}\n• **${s.remainingOccupantsLabel || 'Remaining Occupants'}:** \`${oldState.channel.members?.size || 0}${oldState.channel.userLimit ? `/${oldState.channel.userLimit}` : ` (${s.unlimited || 'Unlimited'})`}\`\n\n• **${s.disconnectedLabel || 'Disconnected At'}:** <t:${Math.floor(Date.now() / 1000)}:F> (<t:${Math.floor(Date.now() / 1000)}:R>)`
            ],
            footer: (s.footers?.voiceLogs || 'Voice Activity • {time}').replace('{time}', `<t:${Math.floor(Date.now() / 1000)}:R>`)
        });

        logChannel.send({
            components: [card],
            flags: MessageFlags.IsComponentsV2
        }).catch(err => {
            console.error('[VoiceLeaveHandler] Error sending log:', err);
        });
    });
};
