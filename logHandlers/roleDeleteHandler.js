const { MessageFlags } = require('discord.js');
const { getEmoji } = require('../UI/emojis/emoji');
const loadLanguage = require('../events/loadLanguage');
const logHandlersIcons = require('../UI/icons/loghandlers');
const { getLogConfig } = require('../utils/cacheHelpers');
const { buildCard, ACCENT } = require('../UI');

module.exports = async function roleDeleteHandler(client) {
    client.on('roleDelete', async (role) => {
        if (!role?.guild) return;

        const config = await getLogConfig(role.guild.id, 'roleDelete');
        if (!config || !config.channelId) return;

        const logChannel = client.channels.cache.get(config.channelId)
            || await client.channels.fetch(config.channelId).catch(() => null);
        if (!logChannel) return;

        const lang = await loadLanguage(role.guild.id);
        const s = lang?.serverlogs || {};

        const card = buildCard({
            title: `${getEmoji('cross')} ${s.roleDeletedTitle || 'Role Deleted'}`,
            accentColor: ACCENT.danger,
            thumbnailURL: logHandlersIcons.badgeIcon,
            sections: [
                `> **${s.roleDeletedDesc || 'Role management event detected'}**\n\n• **${s.roleNameLabel || 'Role Name'}:** \`${role.name}\`\n• **${s.roleIdLabel || 'Role ID'}:** \`${role.id}\`\n• **${s.formerColorLabel || 'Former Color'}:** \`${role.hexColor || '#000000'}\``,
                `### ${getEmoji('settings')} ${s.historicalHeader || 'Historical Details'}\n• **${s.formerPositionLabel || 'Former Position'}:** \`${role.position}\`\n• **${s.mentionableLabel || 'Mentionable'}:** ${role.mentionable ? `\`${s.yes || 'Yes'}\`` : `\`${s.no || 'No'}\``}\n• **${s.hoistedLabel || 'Hoisted'}:** ${role.hoist ? `\`${s.yes || 'Yes'}\`` : `\`${s.no || 'No'}\``}\n\n• **${s.deletedLabel || 'Deleted At'}:** <t:${Math.floor(Date.now() / 1000)}:F> (<t:${Math.floor(Date.now() / 1000)}:R>)`
            ],
            footer: (s.footers?.roleLogs || 'Role Audit • {time}').replace('{time}', `<t:${Math.floor(Date.now() / 1000)}:R>`)
        });

        logChannel.send({
            components: [card],
            flags: MessageFlags.IsComponentsV2
        }).catch(err => {
            console.error('[RoleDeleteHandler] Error sending log:', err);
        });
    });
};
