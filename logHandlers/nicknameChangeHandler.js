const { MessageFlags } = require('discord.js');
const { getEmoji } = require('../UI/emojis/emoji');
const loadLanguage = require('../events/loadLanguage');
const logHandlersIcons = require('../UI/icons/loghandlers');
const { getLogConfig } = require('../utils/cacheHelpers');
const { buildCard, ACCENT } = require('../UI');

module.exports = async function nicknameChangeHandler(client) {
    client.on('guildMemberUpdate', async (oldMember, newMember) => {
        if (!newMember?.guild || oldMember.nickname === newMember.nickname) return;

        const guildId = newMember.guild.id;
        const config = await getLogConfig(guildId, 'nicknameChange');
        if (!config || !config.channelId) return;

        const logChannel = client.channels.cache.get(config.channelId)
            || await client.channels.fetch(config.channelId).catch(() => null);
        if (!logChannel) return;

        const lang = await loadLanguage(guildId);
        const s = lang?.serverlogs || {};

        const memberUser = newMember.user;
        const userAvatar = memberUser?.displayAvatarURL?.({ dynamic: true, size: 256 }) || logHandlersIcons.nickIcon;

        const card = buildCard({
            title: `${getEmoji('user')} ${s.nicknameChangedTitle || 'Nickname Changed'}`,
            accentColor: ACCENT.info,
            thumbnailURL: userAvatar,
            sections: [
                `> **${s.nicknameChangedDesc || 'Profile customization event'}**\n\n• **${s.memberLabel || 'Member'}:** <@${newMember.id}> (\`${memberUser?.tag || memberUser?.username || (s.unknown || 'Unknown')}\`)\n• **${s.userIdLabel || 'User ID'}:** \`${newMember.id}\`\n• **${s.currentDisplayNameLabel || 'Current Display Name'}:** \`${newMember.displayName}\``,
                `### ${getEmoji('settings')} ${s.nicknameHistoryHeader || 'Modification History'}\n• **${s.previousNicknameLabel || 'Previous Nickname'}:** \`${oldMember.nickname || (s.noneNickname || 'None (Default Username)')}\`\n• **${s.newNicknameLabel || 'New Nickname'}:** \`${newMember.nickname || (s.resetNickname || 'None (Reset to Username)')}\`\n\n• **${s.changedLabel || 'Changed At'}:** <t:${Math.floor(Date.now() / 1000)}:F> (<t:${Math.floor(Date.now() / 1000)}:R>)`
            ],
            footer: (s.footers?.memberLogs || 'Member Logs • {time}').replace('{time}', `<t:${Math.floor(Date.now() / 1000)}:R>`)
        });

        logChannel.send({
            components: [card],
            flags: MessageFlags.IsComponentsV2
        }).catch(err => {
            console.error('[NicknameChangeHandler] Error sending log:', err);
        });
    });
};
