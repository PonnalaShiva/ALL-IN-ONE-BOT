const { MessageFlags } = require('discord.js');
const { getEmoji } = require('../UI/emojis/emoji');
const loadLanguage = require('../events/loadLanguage');
const logHandlersIcons = require('../UI/icons/loghandlers');
const { getLogConfig } = require('../utils/cacheHelpers');
const { buildCard, ACCENT } = require('../UI');

module.exports = async function roleCreateHandler(client) {
    client.on('roleCreate', async (role) => {
        if (!role?.guild) return;

        const config = await getLogConfig(role.guild.id, 'roleCreate');
        if (!config || !config.channelId) return;

        const logChannel = client.channels.cache.get(config.channelId)
            || await client.channels.fetch(config.channelId).catch(() => null);
        if (!logChannel) return;

        const lang = await loadLanguage(role.guild.id);
        const s = lang?.serverlogs || {};

        const roleIcon = role.iconURL?.({ dynamic: true, size: 256 }) || logHandlersIcons.badgeIcon;

        const card = buildCard({
            title: `${getEmoji('tick')} ${s.roleCreatedTitle || 'Role Created'}`,
            accentColor: role.color || ACCENT.success,
            thumbnailURL: roleIcon,
            sections: [
                `> **${s.roleCreatedDesc || 'Role management event detected'}**\n\n• **${s.roleLabel || 'Role'}:** <@&${role.id}> (\`${role.name}\`)\n• **${s.roleIdLabel || 'Role ID'}:** \`${role.id}\`\n• **${s.roleColorLabel || 'Role Color'}:** \`${role.hexColor || '#000000'}\``,
                `### ${getEmoji('settings')} ${s.configurationHeader || 'Configuration & Settings'}\n• **${s.positionLabel || 'Position'}:** \`${role.position} of ${role.guild.roles.cache.size}\`\n• **${s.mentionableLabel || 'Mentionable'}:** ${role.mentionable ? `${getEmoji('tick')} ${s.yes || 'Yes'}` : `${getEmoji('cross')} ${s.no || 'No'}`}\n• **${s.hoistedLabel || 'Hoisted'}:** ${role.hoist ? `${getEmoji('tick')} ${s.hoistedSeparately || 'Yes (Displayed Separately)'}` : `${getEmoji('cross')} ${s.no || 'No'}`}\n• **${s.managedLabel || 'Managed (Integration/Bot)'}:** ${role.managed ? `\`${s.yes || 'Yes'}\`` : `\`${s.no || 'No'}\``}\n\n• **${s.createdLabel || 'Created At'}:** <t:${Math.floor(role.createdTimestamp / 1000)}:F> (<t:${Math.floor(role.createdTimestamp / 1000)}:R>)`
            ],
            footer: (s.footers?.roleLogs || 'Role Audit • {time}').replace('{time}', `<t:${Math.floor(Date.now() / 1000)}:R>`)
        });

        logChannel.send({
            components: [card],
            flags: MessageFlags.IsComponentsV2
        }).catch(err => {
            console.error('[RoleCreateHandler] Error sending log:', err);
        });
    });
};
