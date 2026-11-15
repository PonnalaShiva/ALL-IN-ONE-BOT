


'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const Autorole = require('../../models/autorole/autorole');
const { invalidateAutoroleConfig } = require('../../handlers/autorole');
const checkPermissions = require('../../utils/checkPermissions');
const { canManageRole, isSafeSelfAssignableRole } = require('../../utils/roleAuthorization');
const { buildCard, cards, sendV2, replyEphemeral, deferReply, ACCENT, createInterpolatableProxy } = require('../../UI');

const rawLang = require('../../events/loadLanguage');
const lang = {
    ...rawLang,
    setups: {
        ...rawLang.setups,
        autorole: createInterpolatableProxy(rawLang.setups?.autorole),
        common: createInterpolatableProxy(rawLang.setups?.common)
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-autorole')
        .setDescription('Set or view the auto-role for a server')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addSubcommand(sub =>
            sub
                .setName('set')
                .setDescription('Configure the auto-role for the server')
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('The role to be assigned to new members')
                        .setRequired(true))
                .addBooleanOption(option =>
                    option.setName('status')
                        .setDescription('Enable or disable the auto-role')
                        .setRequired(true))
        )
        .addSubcommand(sub =>
            sub
                .setName('view')
                .setDescription('View the auto-role configuration for the server')
        )
        .addSubcommand(sub =>
            sub
                .setName('delete')
                .setDescription('Delete auto-role setup for this server')
        ),

    async execute(interaction) {
        if (!interaction.isCommand || !interaction.isCommand()) {
            return replyEphemeral(interaction, cards.warning(lang.warning, lang.setups.autorole.warningUseSlash));
        }

        await deferReply(interaction, true);
        if (!await checkPermissions(interaction)) return;

        if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageRoles)) {
            return sendV2(interaction, cards.error(lang.errorTitle, lang.setups.autorole.deletePermissionError));
        }

        const subcommand = interaction.options.getSubcommand();
        const guild = interaction.guild;
        const serverId = guild.id;

        if (subcommand === 'set') {
            const role = interaction.options.getRole('role');
            const status = interaction.options.getBoolean('status');
            const serverOwnerId = guild.ownerId;
            const memberId = interaction.user.id;

            try {
                const storedConfig = await Autorole.findOne({ serverId });
                const designatedOwnerId = storedConfig?.ownerId;

                if (memberId !== serverOwnerId && memberId !== designatedOwnerId) {
                    return sendV2(interaction, cards.error(lang.errorTitle, lang.setups.autorole.ownerPermissionError));
                }

                const botMember = guild.members.me;
                if (!isSafeSelfAssignableRole(role) ||
                    !botMember?.permissions?.has(PermissionFlagsBits.ManageRoles) ||
                    role.position >= botMember.roles.highest.position ||
                    !canManageRole(interaction.member, role, guild)) {
                    return sendV2(interaction, cards.error(lang.errorTitle, lang.setups.autorole.hierarchyError));
                }

                await Autorole.findOneAndUpdate(
                    { serverId },
                    {
                        serverId,
                        roleId: role.id,
                        status,
                        ownerId: serverOwnerId
                    },
                    { upsert: true, returnDocument: 'after' }
                );

                invalidateAutoroleConfig(serverId);

                const statusText = status ? lang.setups.autorole.statusEnabled : lang.setups.autorole.statusDisabled;
                const card = cards[status ? 'success' : 'warning'](
                    lang.setups.autorole.title,
                    lang.setups.autorole.updated({ status: statusText.toLowerCase(), role: role.toString() })
                );

                return sendV2(interaction, card);
            } catch (error) {
                console.error('[Setup-Autorole] Error updating autorole configuration:', error);
                return sendV2(interaction, cards.error(lang.errorTitle, lang.setups.autorole.updateError));
            }
        }

        if (subcommand === 'view') {
            try {
                const configData = await Autorole.findOne({ serverId });

                if (!configData) {
                    return sendV2(interaction, cards.warning(lang.setups.autorole.title, lang.setups.autorole.noConfig));
                }

                const role = guild.roles.cache.get(configData.roleId);
                const roleDisplay = role ? role.toString() : lang.setups.autorole.roleNotFound({ roleId: configData.roleId });
                const statusDisplay = configData.status ? lang.setups.autorole.statusEnabled : lang.setups.autorole.statusDisabled;

                const card = buildCard({ accent: configData.status ? ACCENT.success : ACCENT.warning })
                    .addText(`**${lang.setups.autorole.title}**`)
                    .addSeparator()
                    .addText(
                        `**${lang.setups.autorole.statusLabel}:** ${statusDisplay}\n` +
                        `**${lang.setups.autorole.roleLabel}:** ${roleDisplay}\n` +
                        `**${lang.setups.autorole.ownerLabel}:** <@${configData.ownerId}>`
                    );

                return sendV2(interaction, card);
            } catch (error) {
                console.error('[Setup-Autorole] Error fetching autorole configuration:', error);
                return sendV2(interaction, cards.error(lang.errorTitle, lang.setups.autorole.fetchError));
            }
        }

        if (subcommand === 'delete') {
            const hasPermission = interaction.member.permissions.has(PermissionFlagsBits.ManageRoles) ||
                               interaction.member.id === guild.ownerId;

            if (!hasPermission) {
                return sendV2(interaction, cards.error(lang.errorTitle, lang.setups.autorole.deletePermissionError));
            }

            const configData = await Autorole.findOne({ serverId });
            if (!configData) {
                return sendV2(interaction, cards.error(lang.errorTitle, lang.setups.autorole.noConfig));
            }

            const serverOwnerId = guild.ownerId;
            const memberId = interaction.user.id;
            if (memberId !== serverOwnerId && memberId !== configData.ownerId) {
                return sendV2(interaction, cards.error(lang.errorTitle, lang.setups.autorole.ownerPermissionError));
            }

            try {
                await Autorole.deleteOne({ serverId });
                invalidateAutoroleConfig(serverId);

                return sendV2(interaction, cards.success(lang.setups.autorole.title, lang.setups.autorole.deleted));
            } catch (error) {
                console.error('[Setup-Autorole] Error deleting setup:', error);
                return sendV2(interaction, cards.error(lang.errorTitle, lang.setups.autorole.deleteError));
            }
        }
    }
};
