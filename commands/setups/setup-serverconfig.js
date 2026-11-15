


'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const serverConfigController = require('../../models/serverConfig/Controller');
const checkPermissions = require('../../utils/checkPermissions');
const { buildCard, cards, sendV2, replyEphemeral, deferReply, ACCENT, createInterpolatableProxy } = require('../../UI');

const rawLang = require('../../events/loadLanguage');
const lang = {
    ...rawLang,
    setups: {
        ...rawLang.setups,
        serverconfig: createInterpolatableProxy(rawLang.setups?.serverconfig),
        common: createInterpolatableProxy(rawLang.setups?.common)
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-serverconfig')
        .setDescription('Manage server configuration')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addSubcommand(sub =>
            sub.setName('set')
                .setDescription('Set bot managers, admin roles, mod roles, and prefix')
                .addStringOption(opt =>
                    opt.setName('botmanagers')
                        .setDescription('Comma-separated user IDs')
                        .setRequired(false))
                .addStringOption(opt =>
                    opt.setName('adminroles')
                        .setDescription('Comma-separated role IDs for admin permissions')
                        .setRequired(false))
                .addStringOption(opt =>
                    opt.setName('modroles')
                        .setDescription('Comma-separated role IDs for moderator permissions')
                        .setRequired(false))
                .addStringOption(opt =>
                    opt.setName('prefix')
                        .setDescription('Custom prefix')
                        .setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('view')
                .setDescription('View current configuration')
        )
        .addSubcommand(sub =>
            sub.setName('edit')
                .setDescription('Remove bot managers, admin roles, mod roles, or reset prefix')
                .addStringOption(opt =>
                    opt.setName('removebotmanagers')
                        .setDescription('Comma-separated user IDs')
                        .setRequired(false))
                .addStringOption(opt =>
                    opt.setName('removeadminroles')
                        .setDescription('Comma-separated role IDs')
                        .setRequired(false))
                .addStringOption(opt =>
                    opt.setName('removemodroles')
                        .setDescription('Comma-separated role IDs')
                        .setRequired(false))
                .addBooleanOption(opt =>
                    opt.setName('resetprefix')
                        .setDescription('Reset prefix to default')
                        .setRequired(false))
        ),

    async execute(interaction) {
        if (!interaction.isCommand || !interaction.isCommand()) {
            return replyEphemeral(interaction, cards.warning(lang.warning, lang.setups.serverconfig.warningUseSlash));
        }

        await deferReply(interaction, true);
        if (!await checkPermissions(interaction)) return;

        const sub = interaction.options.getSubcommand();
        const { guild, user } = interaction;
        const serverId = guild.id;

        const configData = await serverConfigController.getConfig(serverId);
        const botManagers = configData?.botManagers || [];

        if (!botManagers.includes(user.id) && user.id !== guild.ownerId) {
            return sendV2(interaction, cards.error(lang.setups.serverconfig.title, lang.setups.serverconfig.noPermission));
        }

        
        if (sub === 'set') {
            const managerInput = interaction.options.getString('botmanagers');
            const adminRolesInput = interaction.options.getString('adminroles');
            const modRolesInput = interaction.options.getString('modroles');
            const prefix = interaction.options.getString('prefix');

            const newManagers = managerInput?.split(',').map(id => id.trim()).filter(Boolean) || [];
            const newAdminRoles = adminRolesInput?.split(',').map(id => id.trim()).filter(Boolean) || [];
            const newModRoles = modRolesInput?.split(',').map(id => id.trim()).filter(Boolean) || [];

            const updatedManagers = [...new Set([...botManagers, ...newManagers])];
            const updatedAdminRoles = [...new Set([...(configData?.adminRoles || []), ...newAdminRoles])];
            const updatedModRoles = [...new Set([...(configData?.modRoles || []), ...newModRoles])];

            await serverConfigController.updateConfig(serverId, {
                botManagers: updatedManagers,
                adminRoles: updatedAdminRoles,
                modRoles: updatedModRoles,
                prefix: prefix || configData?.prefix || '!'
            });

            return sendV2(interaction, cards.success(lang.setups.serverconfig.title, lang.setups.serverconfig.updated));
        }

        
        if (sub === 'view') {
            if (!configData) {
                return sendV2(interaction, cards.warning(lang.setups.serverconfig.title, lang.setups.serverconfig.notConfigured));
            }

            const adminRoles = configData.adminRoles || [];
            const modRoles = configData.modRoles || [];

            const desc = lang.setups.serverconfig.description({ guild: guild.name });
            const botManagersList = botManagers.length > 0 ? botManagers.map(id => `<@${id}>`).join(', ') : lang.setups.serverconfig.none;
            const adminRolesList = adminRoles.length > 0 ? adminRoles.map(id => `<@&${id}>`).join(', ') : lang.setups.serverconfig.none;
            const modRolesList = modRoles.length > 0 ? modRoles.map(id => `<@&${id}>`).join(', ') : lang.setups.serverconfig.none;

            const card = buildCard({ accent: ACCENT.info })
                .addText(`**${lang.setups.serverconfig.title}**\n${desc}`)
                .addSeparator()
                .addText(
                    `**${lang.setups.serverconfig.botManagersLabel}:** ${botManagersList}\n` +
                    `**${lang.setups.serverconfig.adminRolesLabel}:** ${adminRolesList}\n` +
                    `**${lang.setups.serverconfig.modRolesLabel}:** ${modRolesList}\n` +
                    `**${lang.setups.serverconfig.prefixLabel}:** \`${configData.prefix || '!'}\``
                );

            return sendV2(interaction, card);
        }

        
        if (sub === 'edit') {
            const removeManagersInput = interaction.options.getString('removebotmanagers');
            const removeAdminRolesInput = interaction.options.getString('removeadminroles');
            const removeModRolesInput = interaction.options.getString('removemodroles');
            const resetPrefix = interaction.options.getBoolean('resetprefix');

            let finalPrefix = configData?.prefix;
            if (resetPrefix) finalPrefix = '!';

            if (removeManagersInput) {
                const toRemove = removeManagersInput.split(',').map(id => id.trim()).filter(Boolean);
                await serverConfigController.removeBotManagers(serverId, toRemove);
            }

            if (removeAdminRolesInput) {
                const toRemove = removeAdminRolesInput.split(',').map(id => id.trim()).filter(Boolean);
                await serverConfigController.removeAdminRoles(serverId, toRemove);
            }

            if (removeModRolesInput) {
                const toRemove = removeModRolesInput.split(',').map(id => id.trim()).filter(Boolean);
                await serverConfigController.removeModRoles(serverId, toRemove);
            }

            await serverConfigController.updateConfig(serverId, {
                prefix: finalPrefix
            });

            return sendV2(interaction, cards.success(lang.setups.serverconfig.title, lang.setups.serverconfig.edited));
        }
    }
};
