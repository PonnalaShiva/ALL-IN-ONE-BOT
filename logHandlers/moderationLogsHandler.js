const { MessageFlags } = require('discord.js');
const { getEmoji } = require('../UI/emojis/emoji');
const loadLanguage = require('../events/loadLanguage');
const logHandlersIcons = require('../UI/icons/loghandlers');
const { getLogConfig } = require('../utils/cacheHelpers');
const { buildCard, ACCENT } = require('../UI');

module.exports = async function moderationLogsHandler(client) {
    client.on('guildMemberUpdate', async (oldMember, newMember) => {
        if (!newMember?.guild) return;
        const guildId = newMember.guild.id;

        const config = await getLogConfig(guildId, 'moderationLogs');
        if (!config || !config.channelId) return;

        const logChannel = client.channels.cache.get(config.channelId)
            || await client.channels.fetch(config.channelId).catch(() => null);
        if (!logChannel) return;

        
        if (oldMember.communicationDisabledUntilTimestamp !== newMember.communicationDisabledUntilTimestamp) {
            const isTimedOut = newMember.communicationDisabledUntilTimestamp > Date.now();
            const wasTimedOut = oldMember.communicationDisabledUntilTimestamp > Date.now();

            const lang = await loadLanguage(guildId);
            const s = lang?.serverlogs || {};

            let actionType = s.modified || 'Modified';
            let actionAccent = ACCENT.warning;

            if (isTimedOut && !wasTimedOut) {
                actionType = s.applied || 'Applied';
                actionAccent = ACCENT.danger;
            } else if (!isTimedOut && wasTimedOut) {
                actionType = s.removed || 'Removed';
                actionAccent = ACCENT.success;
            }

            const memberUser = newMember.user;
            const userAvatar = memberUser?.displayAvatarURL?.({ dynamic: true, size: 256 }) || logHandlersIcons.modIcon;

            const prevTimeoutStr = oldMember.communicationDisabledUntil
                ? `<t:${Math.floor(oldMember.communicationDisabledUntilTimestamp / 1000)}:F> (<t:${Math.floor(oldMember.communicationDisabledUntilTimestamp / 1000)}:R>)`
                : `*${s.noTimeoutActive || 'No timeout active'}*`;
            const currTimeoutStr = newMember.communicationDisabledUntil
                ? `<t:${Math.floor(newMember.communicationDisabledUntilTimestamp / 1000)}:F> (<t:${Math.floor(newMember.communicationDisabledUntilTimestamp / 1000)}:R>)`
                : `*${s.timeoutRemoved || 'No timeout active (Removed)'}*`;

            const card = buildCard({
                title: `${getEmoji('time')} ${(s.timeoutTitle || 'Timeout {action}').replace('{action}', actionType)}`,
                accentColor: actionAccent,
                thumbnailURL: userAvatar,
                sections: [
                    `> **${s.timeoutDesc || 'Member communication status updated'}**\n\n• **${s.memberLabel || 'Member'}:** <@${newMember.id}> (\`${memberUser?.tag || memberUser?.username || (s.unknown || 'Unknown')}\`)\n• **${s.userIdLabel || 'User ID'}:** \`${newMember.id}\`\n• **${s.actionTypeLabel || 'Action Type'}:** \`${actionType}\`\n• **${s.statusLabel || 'Status'}:** ${isTimedOut ? `${getEmoji('mute')} ${s.commRestricted || 'Communication Restricted'}` : `${getEmoji('volume_high')} ${s.commAllowed || 'Communication Allowed'}`}`,
                    `### ${getEmoji('settings')} ${s.timeoutDetailsHeader || 'Timeout Duration Details'}\n• **${s.previousTimeoutLabel || 'Previous Timeout'}:**\n${prevTimeoutStr}\n\n• **${s.currentTimeoutLabel || 'Current Timeout'}:**\n${currTimeoutStr}\n\n• **${s.changedLabel || 'Updated At'}:** <t:${Math.floor(Date.now() / 1000)}:F> (<t:${Math.floor(Date.now() / 1000)}:R>)`
                ],
                footer: (s.footers?.moderationLogs || 'Moderation Audit • {time}').replace('{time}', `<t:${Math.floor(Date.now() / 1000)}:R>`)
            });

            logChannel.send({
                components: [card],
                flags: MessageFlags.IsComponentsV2
            }).catch(err => {
                console.error('[ModerationLogsHandler] Error sending log:', err);
            });
        }
    });
};
