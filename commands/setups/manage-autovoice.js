


'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { VoiceChannelModel } = require('../../models/autoVoice/schema');
const { invalidateVoiceChannelConfig, sendOrUpdateCentralizedEmbed } = require('../../handlers/voiceChannelHandler');
const checkPermissions = require('../../utils/checkPermissions');
const { buildCard, cards, sendV2, replyEphemeral, deferReply, ACCENT, createInterpolatableProxy } = require('../../UI');

const rawLang = require('../../events/loadLanguage');
const lang = {
    ...rawLang,
    setups: {
        ...rawLang.setups,
        manageautovoice: createInterpolatableProxy(rawLang.setups?.manageautovoice),
        common: createInterpolatableProxy(rawLang.setups?.common)
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('manage-autovoice')
        .setDescription('Manage auto voice channel settings')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addSubcommand(sub =>
            sub.setName('add-role')
                .setDescription('Add a role that can create voice channels')
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('The role to add')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('remove-role')
                .setDescription('Remove a role from being able to create voice channels')
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('The role to remove')
                        .setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('list-roles')
                .setDescription('List all roles that can create voice channels'))
        .addSubcommand(sub =>
            sub.setName('clear-roles')
                .setDescription('Clear all required roles (allows everyone to create channels)'))
        .addSubcommand(sub =>
            sub.setName('refresh')
                .setDescription('Refresh/resend the manager control panel')),

    async execute(interaction) {
        if (!interaction.isCommand || !interaction.isCommand()) {
            return replyEphemeral(interaction, cards.warning(lang.warning, lang.setups.manageautovoice.warningUseSlash));
        }

        await deferReply(interaction, true);
        const { guild } = interaction;
        const serverID = guild.id;

        if (!await checkPermissions(interaction)) return;

        const config = await VoiceChannelModel.findOne({ serverId: serverID });
        if (!config) {
            return sendV2(interaction, cards.error(lang.setups.manageautovoice.title, lang.setups.manageautovoice.notConfigured));
        }

        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'add-role': {
                const role = interaction.options.getRole('role');
                const allowedRoleIds = config.allowedRoleIds || [];

                if (allowedRoleIds.includes(role.id)) {
                    return sendV2(interaction, cards.info(
                        lang.setups.manageautovoice.title,
                        lang.setups.manageautovoice.roleAlreadyAllowed({ role: role.name })
                    ));
                }

                allowedRoleIds.push(role.id);

                await VoiceChannelModel.updateOne(
                    { serverId: serverID },
                    { $set: { allowedRoleIds } }
                );

                invalidateVoiceChannelConfig(serverID);

                return sendV2(interaction, cards.success(
                    lang.setups.manageautovoice.title,
                    lang.setups.manageautovoice.roleAdded({ role: role.name })
                ));
            }

            case 'remove-role': {
                const role = interaction.options.getRole('role');
                const allowedRoleIds = config.allowedRoleIds || [];

                if (!allowedRoleIds.includes(role.id)) {
                    return sendV2(interaction, cards.error(
                        lang.setups.manageautovoice.title,
                        lang.setups.manageautovoice.roleNotInList({ role: role.name })
                    ));
                }

                const updatedRoles = allowedRoleIds.filter(id => id !== role.id);

                await VoiceChannelModel.updateOne(
                    { serverId: serverID },
                    { $set: { allowedRoleIds: updatedRoles } }
                );

                invalidateVoiceChannelConfig(serverID);

                return sendV2(interaction, cards.success(
                    lang.setups.manageautovoice.title,
                    lang.setups.manageautovoice.roleRemoved({ role: role.name })
                ));
            }

            case 'list-roles': {
                const allowedRoleIds = config.allowedRoleIds || [];

                if (allowedRoleIds.length === 0) {
                    return sendV2(interaction, cards.info(
                        lang.setups.manageautovoice.title,
                        lang.setups.manageautovoice.noRolesRequired
                    ));
                }

                const rolesList = allowedRoleIds.map(roleId => {
                    const role = guild.roles.cache.get(roleId);
                    return role ? `• ${role.name}` : `• Unknown Role (${roleId})`;
                }).join('\n');

                const card = buildCard({ accent: ACCENT.info })
                    .addText(`**${lang.setups.manageautovoice.listTitle}**`)
                    .addSeparator()
                    .addText(rolesList);

                return sendV2(interaction, card);
            }

            case 'clear-roles': {
                await VoiceChannelModel.updateOne(
                    { serverId: serverID },
                    { $set: { allowedRoleIds: [] } }
                );

                invalidateVoiceChannelConfig(serverID);

                return sendV2(interaction, cards.success(
                    lang.setups.manageautovoice.title,
                    lang.setups.manageautovoice.rolesCleared
                ));
            }

            case 'refresh': {
                if (!config.status) {
                    return sendV2(interaction, cards.warning(
                        lang.warning, 
                        'Auto voice is currently disabled. Enable it first with `/setup-autovoice set status:true`.'
                    ));
                }

                try {
                    
                    await sendOrUpdateCentralizedEmbed(interaction.client, guild);
                    
                    return sendV2(interaction, cards.success(
                        lang.setups.manageautovoice.title, 
                        '✅ Manager panel refreshed successfully! Check the manager channel for the updated control panel.'
                    ));
                } catch (error) {
                    console.error('[Manage-AutoVoice] Error refreshing panel:', error);
                    return sendV2(interaction, cards.error(
                        lang.errorTitle, 
                        'Failed to refresh the manager panel. Make sure the bot has permissions in the manager channel.'
                    ));
                }
            }
        }
    }
};