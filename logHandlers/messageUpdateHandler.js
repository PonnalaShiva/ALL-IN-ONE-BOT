const { MessageFlags } = require('discord.js');
const { getEmoji } = require('../UI/emojis/emoji');
const loadLanguage = require('../events/loadLanguage');
const { getLogConfig } = require('../utils/cacheHelpers');
const { buildCard, ACCENT } = require('../UI');
const logHandlersIcons = require('../UI/icons/loghandlers');

module.exports = async function messageUpdateHandler(client) {
    client.on('messageUpdate', async (oldMessage, newMessage) => {
        if (!oldMessage?.guild || oldMessage.partial || newMessage.partial) return;

        
        if (oldMessage.author?.bot || newMessage.author?.bot) return;

        
        if (oldMessage.content === newMessage.content) return;

        const config = await getLogConfig(oldMessage.guild.id, 'messageUpdate');
        if (!config || !config.channelId) return;

        const logChannel = client.channels.cache.get(config.channelId)
            || await client.channels.fetch(config.channelId).catch(() => null);
        if (!logChannel) return;

        const lang = await loadLanguage(oldMessage.guild.id);
        const s = lang?.serverlogs || {};

        const truncateContent = (content, maxLength = 800) => {
            if (!content) return `*${s.noTextContent || 'No text content'}*`;
            const clean = String(content).replace(/```/g, '`\u200b`\u200b`');
            return clean.length > maxLength ? clean.substring(0, maxLength) + '...' : clean;
        };

        const author = oldMessage.author || newMessage.author;
        const authorDisplay = author ? `<@${author.id}> (\`${author.tag || author.username}\`)` : `\`${s.unknown || 'Unknown'}\``;
        const authorId = author?.id || (s.unknown || 'Unknown');
        const authorAvatar = author?.displayAvatarURL?.({ dynamic: true, size: 256 }) || logHandlersIcons.msgIcon;

        const charDelta = (newMessage.content?.length || 0) - (oldMessage.content?.length || 0);
        const deltaFormatted = charDelta > 0 ? `+${charDelta}` : `${charDelta}`;

        const card = buildCard({
            title: `${getEmoji('edit')} ${s.messageEditedTitle || 'Message Edited'}`,
            accentColor: ACCENT.warning,
            thumbnailURL: authorAvatar,
            sections: [
                `> **${s.messageEditedDesc || 'Message content updated'}**\n\n• **${s.authorLabel || 'Author'}:** ${authorDisplay}\n• **${s.authorIdLabel || 'Author ID'}:** \`${authorId}\`\n• **${s.channelLabel || 'Channel'}:** <#${oldMessage.channel.id}> (\`${oldMessage.channel.id}\`)\n• **${s.messageIdLabel || 'Message ID'}:** \`${oldMessage.id}\`\n• **${s.jumpLinkLabel || 'Jump Link'}:** [${s.openMessage || 'Open Message'}](https://discord.com/channels/${oldMessage.guild.id}/${oldMessage.channel.id}/${oldMessage.id})\n• **${s.editedLabel || 'Edited At'}:** <t:${Math.floor(Date.now() / 1000)}:F> (<t:${Math.floor(Date.now() / 1000)}:R>)`,
                `### ${getEmoji('document')} ${s.contentComparisonHeader || 'Content Comparison'}\n**${s.originalContentLabel || 'Original Content'}:**\n\`\`\`\n${truncateContent(oldMessage.content)}\n\`\`\`\n**${s.updatedContentLabel || 'Updated Content'}:**\n\`\`\`\n${truncateContent(newMessage.content)}\n\`\`\`\n• **${s.charDeltaLabel || 'Character Difference'}:** \`${deltaFormatted} ${s.charsSuffix || 'chars'}\` (${s.beforeLabel || 'Before'}: \`${oldMessage.content?.length || 0}\` -> ${s.afterLabel || 'After'}: \`${newMessage.content?.length || 0}\`)`
            ],
            footer: (s.footers?.messageLogs || 'Message Audit • {time}').replace('{time}', `<t:${Math.floor(Date.now() / 1000)}:R>`)
        });

        logChannel.send({
            components: [card],
            flags: MessageFlags.IsComponentsV2
        }).catch(err => {
            console.error('[MessageUpdateHandler] Error sending log:', err);
        });
    });
};
