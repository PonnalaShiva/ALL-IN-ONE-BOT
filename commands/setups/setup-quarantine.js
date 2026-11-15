


'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { cards, sendV2, replyEphemeral, deferReply, createInterpolatableProxy } = require('../../UI');
const QuarantineConfig = require('../../models/qurantine/quarantineConfig');
const checkPermissions = require('../../utils/checkPermissions');

const rawLang = require('../../events/loadLanguage');
const lang = {
    ...rawLang,
    setups: {
        ...rawLang.setups,
        quarantine: createInterpolatableProxy(rawLang.setups?.quarantine),
        common: createInterpolatableProxy(rawLang.setups?.common)
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-quarantine')
        .setDescription('Setup server configurations.')
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageGuild |
            PermissionFlagsBits.ManageRoles |
            PermissionFlagsBits.ManageChannels
        )
        .addSubcommand(subcommand =>
            subcommand.setName('enable')
                .setDescription('Enable the quarantine system.'))
        .addSubcommand(subcommand =>
            subcommand.setName('disable')
                .setDescription('Disable the quarantine system.')),

    async execute(interaction) {
        if (!interaction.isCommand || !interaction.isCommand()) {
            return replyEphemeral(interaction, cards.warning(lang.warning, lang.setups.quarantine.warningUseSlash));
        }

        await deferReply(interaction, true);
        if (!await checkPermissions(interaction)) return;

        const requiredPermissions = [
            PermissionFlagsBits.ManageGuild,
            PermissionFlagsBits.ManageRoles,
            PermissionFlagsBits.ManageChannels
        ];
        if (!requiredPermissions.every(permission => interaction.member?.permissions?.has(permission))) {
            return sendV2(interaction, cards.error(
                lang.setups.quarantine.permissionDeniedTitle || 'Access Denied',
                'You need Manage Server, Manage Roles, and Manage Channels to configure quarantine.'
            ));
        }

        const guild = interaction.guild;
        const guildId = guild.id;
        let config = await QuarantineConfig.findOne({ guildId }) || new QuarantineConfig({ guildId });

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'enable') {
            if (config.quarantineEnabled) {
                const card = cards.warning(lang.setups.quarantine.title, lang.setups.quarantine.alreadyEnabled);
                return sendV2(interaction, card);
            }

            
            const quarantineRole = await guild.roles.create({
                name: 'Quarantine',
                color: '#FF00FF',
                permissions: []
            });

            for (const channel of guild.channels.cache.values()) {
                if (!channel.permissionOverwrites) continue;
                try {
                    await channel.permissionOverwrites.edit(quarantineRole, { ViewChannel: false });
                } catch (err) {
                    console.warn(`[Setup-Quarantine] Failed to set permissions in ${channel.name}:`, err.message);
                }
            }

            
            const quarantineChannel = await guild.channels.create({
                name: 'quarantine-zone',
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: quarantineRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
                ]
            });

            
            config.quarantineEnabled = true;
            config.quarantineRoleId = quarantineRole.id;
            config.quarantineChannelId = quarantineChannel.id;
            await config.save();

            const card = cards.success(lang.setups.quarantine.title, lang.setups.quarantine.enabledSuccess);
            return sendV2(interaction, card);
        }

        if (subcommand === 'disable') {
            if (!config.quarantineEnabled) {
                const card = cards.warning(lang.setups.quarantine.title, lang.setups.quarantine.notEnabled);
                return sendV2(interaction, card);
            }

            const quarantineRole = guild.roles.cache.get(config.quarantineRoleId);
            if (quarantineRole) {
                await quarantineRole.delete().catch(() => {});
            }

            const quarantineChannel = guild.channels.cache.get(config.quarantineChannelId);
            if (quarantineChannel) {
                await quarantineChannel.delete().catch(() => {});
            }

            await QuarantineConfig.deleteOne({ guildId });

            const card = cards.info(lang.setups.quarantine.title, lang.setups.quarantine.disabledSuccess);
            return sendV2(interaction, card);
        }
    }
};
