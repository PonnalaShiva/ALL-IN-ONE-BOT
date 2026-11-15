const { MessageFlags } = require('discord.js');
const { getEmoji } = require('../UI/emojis/emoji');
const loadLanguage = require('../events/loadLanguage');
const { getLogConfig } = require('../utils/cacheHelpers');
const { buildCard, ACCENT } = require('../UI');
const logHandlersIcons = require('../UI/icons/loghandlers');

module.exports = async function roleRemovedHandler(client) {
    client.on('guildMemberUpdate', async (oldMember, newMember) => {
        if (!newMember?.guild) return;

        const removedRoles = typeof oldMember.roles.cache.filter === 'function'
            ? oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id))
            : new Map(Array.from(oldMember.roles.cache.entries()).filter(([id]) => !newMember.roles.cache.has(id)));

        if (removedRoles.size === 0) return;

        const config = await getLogConfig(newMember.guild.id, 'roleRemoved');
        if (!config || !config.channelId) return;

        const logChannel = client.channels.cache.get(config.channelId)
            || await client.channels.fetch(config.channelId).catch(() => null);
        if (!logChannel) return;

        const lang = await loadLanguage(newMember.guild.id);
        const s = lang?.serverlogs || {};
        const memberUser = newMember.user;
        const userAvatar = memberUser?.displayAvatarURL?.({ dynamic: true, size: 256 }) || logHandlersIcons.removedIcon;

        for (const [, role] of removedRoles) {
            const card = buildCard({
                title: `${getEmoji('cross')} ${s.roleRemovedTitle || 'Role Removed'}`,
                accentColor: ACCENT.danger,
                thumbnailURL: userAvatar,
                sections: [
                    `> **${s.roleRemovedDesc || 'Role assignment changed'}**\n\n• **${s.memberLabel || 'Member'}:** <@${newMember.id}> (\`${memberUser?.tag || memberUser?.username || (s.unknown || 'Unknown')}\`)\n• **${s.userIdLabel || 'User ID'}:** \`${newMember.id}\`\n• **${s.removedRoleLabel || 'Removed Role'}:** <@&${role.id}> (\`${role.name}\`)`,
                    `### ${getEmoji('settings')} ${s.roleSpecsHeader || 'Role Specifications'}\n• **${s.roleIdLabel || 'Role ID'}:** \`${role.id}\`\n• **${s.roleColorLabel || 'Role Color'}:** \`${role.hexColor || '#000000'}\`\n• **${s.formerPositionLabel || 'Former Position'}:** \`${role.position}\`\n\n• **${s.removedLabel || 'Removed At'}:** <t:${Math.floor(Date.now() / 1000)}:F> (<t:${Math.floor(Date.now() / 1000)}:R>)`
                ],
                footer: (s.footers?.roleLogs || 'Role Audit • {time}').replace('{time}', `<t:${Math.floor(Date.now() / 1000)}:R>`)
            });

            logChannel.send({
                components: [card],
                flags: MessageFlags.IsComponentsV2
            }).catch(err => {
                console.error('[RoleRemovedHandler] Error sending log:', err);
            });
        }
    });
};
