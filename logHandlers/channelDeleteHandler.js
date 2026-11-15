const { ChannelType, MessageFlags } = require('discord.js');
const { getEmoji } = require('../UI/emojis/emoji');
const loadLanguage = require('../events/loadLanguage');
const { getLogConfig } = require('../utils/cacheHelpers');
const { buildCard, ACCENT } = require('../UI');
const logHandlersIcons = require('../UI/icons/loghandlers');

module.exports = async function channelDeleteHandler(client) {
    client.on('channelDelete', async (channel) => {
        if (!channel?.guild) return;

        const config = await getLogConfig(channel.guild.id, 'channelDelete');
        if (!config || !config.channelId) return;

        const logChannel = client.channels.cache.get(config.channelId)
            || await client.channels.fetch(config.channelId).catch(() => null);
        if (!logChannel) return;

        const lang = loadLanguage(channel.guild.id);
        const s = lang?.serverlogs || {};

        const channelTypeNames = {
            [ChannelType.GuildText]: s.types?.text || 'Text Channel',
            [ChannelType.GuildVoice]: s.types?.voice || 'Voice Channel',
            [ChannelType.GuildCategory]: s.types?.category || 'Category',
            [ChannelType.GuildAnnouncement]: s.types?.announcement || 'Announcement Channel',
            [ChannelType.GuildStageVoice]: s.types?.stage || 'Stage Channel',
            [ChannelType.GuildForum]: s.types?.forum || 'Forum Channel',
            [ChannelType.PublicThread]: s.types?.publicThread || 'Public Thread',
            [ChannelType.PrivateThread]: s.types?.privateThread || 'Private Thread',
            [ChannelType.GuildDirectory]: s.types?.directory || 'Directory Channel',
            [ChannelType.GuildMedia]: s.types?.media || 'Media Channel',
        };
        const channelTypeName = channelTypeNames[channel.type] || s.types?.unknown || 'Unknown Type';

        const details = [
            `• **${s.formerPositionLabel || 'Former Position'}:** \`${channel.position ?? 'N/A'}\``,
            `• **${s.nsfwLabel || 'Age-Restricted (NSFW)'}:** ${channel.nsfw ? `${getEmoji('tick')} ${s.yes || 'Yes'}` : `${getEmoji('cross')} ${s.no || 'No'}`}`,
            `• **${s.createdLabel || 'Created At'}:** ${channel.createdTimestamp ? `<t:${Math.floor(channel.createdTimestamp / 1000)}:F>` : `\`${s.unknown || 'Unknown'}\``}`,
            `• **${s.deletedLabel || 'Deleted At'}:** <t:${Math.floor(Date.now() / 1000)}:F> (<t:${Math.floor(Date.now() / 1000)}:R>)`
        ];

        const card = buildCard({
            title: `${getEmoji('delete')} ${s.channelDeletedTitle || 'Channel Deleted'}`,
            accentColor: ACCENT.danger,
            thumbnailURL: logHandlersIcons.staffIcon,
            sections: [
                `> **${(s.channelRemoved || '{type} Removed').replace('{type}', channelTypeName)}**\n> ${s.channelDeletedDesc || 'Channel deletion event detected'}\n\n• **${s.nameLabel || 'Name'}:** \`#${channel.name}\`\n• **${s.channelIdLabel || 'Channel ID'}:** \`${channel.id}\`\n• **${s.channelTypeLabel || 'Channel Type'}:** \`${channelTypeName}\`\n• **${s.formerCategoryLabel || 'Former Category'}:** ${channel.parent ? `\`${channel.parent.name}\`` : `\`${s.none || 'None'}\``}`,
                `### ${getEmoji('settings')} ${s.historicalHeader || 'Historical Details'}\n${details.join('\n')}`
            ],
            footer: (s.footers?.serverLogs || 'Server Logs • {time}').replace('{time}', `<t:${Math.floor(Date.now() / 1000)}:R>`)
        });

        logChannel.send({
            components: [card],
            flags: MessageFlags.IsComponentsV2
        }).catch(err => {
            console.error('[ChannelDeleteHandler] Error sending log:', err);
        });
    });
};
