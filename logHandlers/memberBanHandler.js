const { MessageFlags } = require('discord.js');
const { getEmoji } = require('../UI/emojis/emoji');
const loadLanguage = require('../events/loadLanguage');
const { getLogConfig } = require('../utils/cacheHelpers');
const { buildCard, ACCENT } = require('../UI');
const logHandlersIcons = require('../UI/icons/loghandlers');

module.exports = async function memberBanHandler(client) {
    client.on('guildBanAdd', async (ban) => {
        if (!ban?.guild) return;

        const config = await getLogConfig(ban.guild.id, 'memberBan');
        if (!config || !config.channelId) return;

        const logChannel = client.channels.cache.get(config.channelId)
            || await client.channels.fetch(config.channelId).catch(() => null);
        if (!logChannel) return;

        const lang = await loadLanguage(ban.guild.id);
        const s = lang?.serverlogs || {};

        const user = ban.user;
        const accountAgeDays = user?.createdTimestamp
            ? Math.floor((Date.now() - user.createdTimestamp) / (1000 * 60 * 60 * 24))
            : (s.unknown || 'Unknown');
        const userAvatar = user?.displayAvatarURL?.({ dynamic: true, size: 256 }) || logHandlersIcons.staffIcon;

        const card = buildCard({
            title: `${getEmoji('mod')} ${s.memberBannedTitle || 'Member Banned'}`,
            accentColor: ACCENT.danger,
            thumbnailURL: userAvatar,
            sections: [
                `> **${s.memberBannedDesc || 'Ban enforcement action executed'}**\n\n• **${s.userLabel || 'User'}:** ${user ? `<@${user.id}> (\`${user.tag || user.username}\`)` : `\`${s.unknown || 'Unknown'}\``}\n• **${s.userIdLabel || 'User ID'}:** \`${user?.id || (s.unknown || 'Unknown')}\`\n• **${s.accountCreatedLabel || 'Account Created'}:** ${user?.createdTimestamp ? `<t:${Math.floor(user.createdTimestamp / 1000)}:F> (<t:${Math.floor(user.createdTimestamp / 1000)}:R>)` : `\`${s.unknown || 'Unknown'}\``}\n• **${s.accountAgeLabel || 'Account Age'}:** \`${accountAgeDays} ${s.daysOldSuffix || 'days old'}\``,
                `### ${getEmoji('document')} ${s.banReasonHeader || 'Ban Reason'}\n\`\`\`\n${ban.reason || (s.noReasonProvided || 'No reason provided')}\n\`\`\`\n• **${s.enforcedLabel || 'Enforced At'}:** <t:${Math.floor(Date.now() / 1000)}:F> (<t:${Math.floor(Date.now() / 1000)}:R>)`
            ],
            footer: (s.footers?.moderationLogs || 'Moderation Audit • {time}').replace('{time}', `<t:${Math.floor(Date.now() / 1000)}:R>`)
        });

        logChannel.send({
            components: [card],
            flags: MessageFlags.IsComponentsV2
        }).catch(err => {
            console.error('[MemberBanHandler] Error sending log:', err);
        });
    });
};
