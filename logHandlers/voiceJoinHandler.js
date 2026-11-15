const { MessageFlags } = require('discord.js');
const { getEmoji } = require('../UI/emojis/emoji');
const loadLanguage = require('../events/loadLanguage');
const logHandlersIcons = require('../UI/icons/loghandlers');
const { getLogConfig } = require('../utils/cacheHelpers');
const { buildCard, ACCENT } = require('../UI');

module.exports = async function voiceJoinHandler(client) {
    client.on('voiceStateUpdate', async (oldState, newState) => {
        if (!newState?.channel || oldState?.channelId === newState?.channelId) return;
        if (!newState.guild) return;

        const config = await getLogConfig(newState.guild.id, 'voiceJoin');
        if (!config || !config.channelId) return;

        const logChannel = client.channels.cache.get(config.channelId)
            || await client.channels.fetch(config.channelId).catch(() => null);
        if (!logChannel) return;

        const lang = await loadLanguage(newState.guild.id);
        const s = lang?.serverlogs || {};

        const member = newState.member;
        const memberUser = member?.user;
        const userAvatar = memberUser?.displayAvatarURL?.({ dynamic: true, size: 256 }) || logHandlersIcons.joinIcon;

        const card = buildCard({
            title: `${getEmoji('voice')} ${s.voiceJoinedTitle || 'Voice Channel Joined'}`,
            accentColor: ACCENT.info,
            thumbnailURL: userAvatar,
            sections: [
                `> **${s.voiceJoinedDesc || 'Voice activity detected'}**\n\n• **${s.memberLabel || 'Member'}:** ${memberUser ? `<@${member.id}> (\`${memberUser.tag || memberUser.username}\`)` : `\`${newState.id}\``}\n• **${s.userIdLabel || 'User ID'}:** \`${member?.id || newState.id}\`\n• **${s.channelLabel || 'Channel'}:** <#${newState.channel.id}> (\`#${newState.channel.name}\`)`,
                `### ${getEmoji('settings')} ${s.voiceDetailsHeader || 'Voice Channel Details'}\n• **${s.channelIdLabel || 'Channel ID'}:** \`${newState.channel.id}\`\n• **${s.categoryLabel || 'Category'}:** ${newState.channel.parent ? `\`${newState.channel.parent.name}\`` : `\`${s.none || 'None'}\``}\n• **${s.activeOccupantsLabel || 'Active Occupants'}:** \`${newState.channel.members?.size || 1}${newState.channel.userLimit ? `/${newState.channel.userLimit}` : ` (${s.unlimited || 'Unlimited'})`}\`\n• **${s.bitrateLabel || 'Bitrate'}:** \`${newState.channel.bitrate ? `${newState.channel.bitrate / 1000}kbps` : 'N/A'}\`\n\n• **${s.connectedLabel || 'Connected At'}:** <t:${Math.floor(Date.now() / 1000)}:F> (<t:${Math.floor(Date.now() / 1000)}:R>)`
            ],
            footer: (s.footers?.voiceLogs || 'Voice Activity • {time}').replace('{time}', `<t:${Math.floor(Date.now() / 1000)}:R>`)
        });

        logChannel.send({
            components: [card],
            flags: MessageFlags.IsComponentsV2
        }).catch(err => {
            console.error('[VoiceJoinHandler] Error sending log:', err);
        });
    });
};
