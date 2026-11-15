const { ChannelType, MessageFlags } = require('discord.js');
const { getEmoji } = require('../UI/emojis/emoji');
const loadLanguage = require('../events/loadLanguage');
const { getLogConfig } = require('../utils/cacheHelpers');
const { buildCard, ACCENT } = require('../UI');
const logHandlersIcons = require('../UI/icons/loghandlers');

module.exports = async function channelCreateHandler(client) {
    client.on('channelCreate', async (channel) => {
        if (!channel?.guild) return;

        const config = await getLogConfig(channel.guild.id, 'channelCreate');
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

        const isVoiceOrStage = channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildStageVoice;
        const isTextLike = channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement || channel.type === ChannelType.GuildForum;

        const details = [];
        details.push(`• **${s.positionLabel || 'Position'}:** \`${channel.position ?? 'N/A'}\``);
        if (isTextLike) {
            details.push(`• **${s.slowmodeLabel || 'Slowmode'}:** ${channel.rateLimitPerUser ? `\`${channel.rateLimitPerUser}s\`` : `\`${s.disabled || 'Disabled'}\``}`);
            details.push(`• **${s.nsfwLabel || 'Age-Restricted (NSFW)'}:** ${channel.nsfw ? `${getEmoji('tick')} ${s.yes || 'Yes'}` : `${getEmoji('cross')} ${s.no || 'No'}`}`);
            if (channel.topic) {
                details.push(`• **${s.topicLabel || 'Topic'}:**\n> ${channel.topic.slice(0, 300)}`);
            }
        }
        if (isVoiceOrStage) {
            details.push(`• **${s.bitrateLabel || 'Bitrate'}:** \`${channel.bitrate ? `${channel.bitrate / 1000}kbps` : 'N/A'}\``);
            details.push(`• **${s.userLimitLabel || 'User Limit'}:** \`${channel.userLimit ? `${channel.userLimit}` : (s.unlimited || 'Unlimited')}\``);
        }
        details.push(`• **${s.createdLabel || 'Created At'}:** <t:${Math.floor(channel.createdTimestamp / 1000)}:F> (<t:${Math.floor(channel.createdTimestamp / 1000)}:R>)`);

        const card = buildCard({
            title: `${getEmoji('chat')} ${s.channelCreatedTitle || 'Channel Created'}`,
            accentColor: ACCENT.success,
            thumbnailURL: logHandlersIcons.staffIcon,
            sections: [
                `> **${(s.newChannelAdded || 'New {type} Added').replace('{type}', channelTypeName)}**\n> ${s.channelCreatedDesc || 'Channel creation event detected'}\n\n• **${s.channelLabel || 'Channel'}:** ${channel.toString()}\n• **${s.nameLabel || 'Name'}:** \`#${channel.name}\`\n• **${s.channelIdLabel || 'Channel ID'}:** \`${channel.id}\`\n• **${s.channelTypeLabel || 'Channel Type'}:** \`${channelTypeName}\`\n• **${s.categoryLabel || 'Category'}:** ${channel.parent ? `\`${channel.parent.name}\` (\`${channel.parentId}\`)` : `\`${s.none || 'None'}\``}`,
                `### ${getEmoji('settings')} ${s.configurationHeader || 'Configuration & Settings'}\n${details.join('\n')}`
            ],
            footer: (s.footers?.serverLogs || 'Server Logs • {time}').replace('{time}', `<t:${Math.floor(Date.now() / 1000)}:R>`)
        });

        logChannel.send({
            components: [card],
            flags: MessageFlags.IsComponentsV2
        }).catch(err => {
            console.error('[ChannelCreateHandler] Error sending log:', err);
        });
    });
};
