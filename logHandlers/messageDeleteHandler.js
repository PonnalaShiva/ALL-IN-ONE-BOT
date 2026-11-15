const { MessageFlags } = require('discord.js');
const { getEmoji } = require('../UI/emojis/emoji');
const loadLanguage = require('../events/loadLanguage');
const { getLogConfig } = require('../utils/cacheHelpers');
const { buildCard, ACCENT } = require('../UI');
const logHandlersIcons = require('../UI/icons/loghandlers');

module.exports = async function messageDeleteHandler(client) {
    client.on('messageDelete', async (message) => {
        if (!message?.guild) return;

        const config = await getLogConfig(message.guild.id, 'messageDelete');
        if (!config || !config.channelId) return;

        const logChannel = client.channels.cache.get(config.channelId)
            || await client.channels.fetch(config.channelId).catch(() => null);
        if (!logChannel) return;

        const lang = await loadLanguage(message.guild.id);
        const s = lang?.serverlogs || {};

        const truncateContent = (content, maxLength = 1000) => {
            if (!content) return `*${s.noTextContent || 'No text content'}*`;
            const clean = String(content).replace(/```/g, '`\u200b`\u200b`');
            return clean.length > maxLength ? clean.substring(0, maxLength) + '...' : clean;
        };

        const author = message.author;
        const authorDisplay = author ? `<@${author.id}> (\`${author.tag || author.username}\`)` : `\`${s.unknown || 'Unknown'}\``;
        const authorId = author?.id || (s.unknown || 'Unknown');
        const authorAvatar = author?.displayAvatarURL?.({ dynamic: true, size: 256 }) || logHandlersIcons.msgIcon;

        const rawAttachments = message.attachments?.size > 0
            ? (typeof message.attachments.map === 'function'
                ? message.attachments.map(att => `• \`${att.name || 'file'}\` (${att.size ? `${Math.round(att.size / 1024)} KB` : 'N/A'})`)
                : Array.from(message.attachments.values()).map(att => `• \`${att.name || 'file'}\` (${att.size ? `${Math.round(att.size / 1024)} KB` : 'N/A'})`))
            : [];
        const attachmentsList = rawAttachments.length > 0
            ? (rawAttachments.length > 5 ? rawAttachments.slice(0, 5).join('\n') + `\n*+${rawAttachments.length - 5} more*` : rawAttachments.join('\n'))
            : `*${s.noAttachments || 'None'}*`;

        const card = buildCard({
            title: `${getEmoji('delete')} ${s.messageDeletedTitle || 'Message Deleted'}`,
            accentColor: ACCENT.danger,
            thumbnailURL: authorAvatar,
            sections: [
                `> **${s.messageDeletedDesc || 'Message permanently removed'}**\n\n• **${s.authorLabel || 'Author'}:** ${authorDisplay}\n• **${s.authorIdLabel || 'Author ID'}:** \`${authorId}\`\n• **${s.channelLabel || 'Channel'}:** <#${message.channel.id}> (\`${message.channel.id}\`)\n• **${s.messageIdLabel || 'Message ID'}:** \`${message.id}\`\n• **${s.createdLabel || 'Created At'}:** ${message.createdTimestamp ? `<t:${Math.floor(message.createdTimestamp / 1000)}:F> (<t:${Math.floor(message.createdTimestamp / 1000)}:R>)` : `\`${s.unknown || 'Unknown'}\``}\n• **${s.deletedLabel || 'Deleted At'}:** <t:${Math.floor(Date.now() / 1000)}:F> (<t:${Math.floor(Date.now() / 1000)}:R>)`,
                `### ${getEmoji('document')} ${s.deletedContentHeader || 'Deleted Content'}\n\`\`\`\n${truncateContent(message.content)}\n\`\`\`\n• **${s.charCountLabel || 'Character Count'}:** \`${message.content?.length || 0}\`\n• **${s.attachmentsLabel || 'Attachments'} (${message.attachments?.size || 0}):**\n${attachmentsList}`
            ],
            footer: (s.footers?.messageLogs || 'Message Audit • {time}').replace('{time}', `<t:${Math.floor(Date.now() / 1000)}:R>`)
        });

        logChannel.send({
            components: [card],
            flags: MessageFlags.IsComponentsV2
        }).catch(err => {
            console.error('[MessageDeleteHandler] Error sending log:', err);
        });
    });
};
