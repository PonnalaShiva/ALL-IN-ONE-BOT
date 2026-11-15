


'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { VoiceChannelModel } = require('../../models/autoVoice/schema');
const { sendOrUpdateCentralizedEmbed, invalidateVoiceChannelConfig } = require('../../handlers/voiceChannelHandler');
const checkPermissions = require('../../utils/checkPermissions');
const { buildCard, cards, sendV2, replyEphemeral, deferReply, ACCENT, createInterpolatableProxy } = require('../../UI');

const rawLang = require('../../events/loadLanguage');
const lang = {
    ...rawLang,
    setups: {
        ...rawLang.setups,
        autovoice: createInterpolatableProxy(rawLang.setups?.autovoice),
        common: createInterpolatableProxy(rawLang.setups?.common)
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-autovoice')
        .setDescription('Set up or manage auto voice channels')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addSubcommand(sub =>
            sub.setName('set')
                .setDescription('Set up auto voice channels')
                .addChannelOption(option =>
                    option.setName('voice_channel')
                        .setDescription('The main voice channel users will join to create their own channel')
                        .addChannelTypes(ChannelType.GuildVoice)
                        .setRequired(true))
                .addChannelOption(option =>
                    option.setName('manager_channel')
                        .setDescription('The text channel where management controls will be displayed')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true))
                .addBooleanOption(option =>
                    option.setName('status')
                        .setDescription('Enable or disable auto voice channels')
                        .setRequired(true))
                .addRoleOption(option =>
                    option.setName('required_role')
                        .setDescription('Role required to create voice channels (leave empty for everyone)')
                        .setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('view')
                .setDescription('View current auto voice channel settings'))
        .addSubcommand(sub =>
            sub.setName('delete')
                .setDescription('Delete auto voice channel setup for this server')),

    async execute(interaction) {
        if (!interaction.isCommand || !interaction.isCommand()) {
            return replyEphemeral(interaction, cards.warning(lang.warning, lang.setups.autovoice.warningUseSlash));
        }

        await deferReply(interaction, true);
        if (!await checkPermissions(interaction)) return;

        const { guild } = interaction;
        const serverID = guild.id;
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'set') {
            const voiceChannel = interaction.options.getChannel('voice_channel');
            const managerChannel = interaction.options.getChannel('manager_channel');
            const requiredRole = interaction.options.getRole('required_role');
            const status = interaction.options.getBoolean('status');

            const allowedRoleIds = requiredRole ? [requiredRole.id] : [];

            await VoiceChannelModel.findOneAndUpdate(
                { serverId: serverID },
                {
                    serverId: serverID,
                    voiceChannelId: voiceChannel.id,
                    managerChannelId: managerChannel.id,
                    allowedRoleIds,
                    status,
                    ownerId: guild.ownerId
                },
                { upsert: true, returnDocument: 'after' }
            );

            invalidateVoiceChannelConfig(serverID);
            await sendOrUpdateCentralizedEmbed(interaction.client, guild);

            const roleText = requiredRole
                ? lang.setups.autovoice.requiredRoleText({ role: requiredRole.name })
                : lang.setups.autovoice.noRequiredRole;

            const statusText = status ? lang.setups.autovoice.statusEnabled : lang.setups.autovoice.statusDisabled;
            const card = cards[status ? 'success' : 'warning'](
                lang.setups.autovoice.title,
                lang.setups.autovoice.configured({
                    status: statusText.toLowerCase(),
                    voiceChannel: voiceChannel.name,
                    managerChannel: managerChannel.name,
                    roles: roleText
                })
            );

            return sendV2(interaction, card);
        }

        if (subcommand === 'view') {
            const config = await VoiceChannelModel.findOne({ serverId: serverID });

            if (!config) {
                return sendV2(interaction, cards.info(lang.setups.autovoice.title, lang.setups.autovoice.noConfig));
            }

            const voiceChannel = guild.channels.cache.get(config.voiceChannelId);
            const managerChannel = guild.channels.cache.get(config.managerChannelId);
            const voiceDisplay = voiceChannel ? voiceChannel.toString() : lang.setups.autovoice.channelNotFound;
            const managerDisplay = managerChannel ? managerChannel.toString() : lang.setups.autovoice.channelNotFound;

            let roleText = lang.setups.autovoice.noRequiredRole;
            if (config.allowedRoleIds && config.allowedRoleIds.length > 0) {
                const roles = config.allowedRoleIds.map(roleId => {
                    const role = guild.roles.cache.get(roleId);
                    return role ? role.name : lang.setups.autovoice.unknownRole;
                }).join(', ');
                if (roles) roleText = roles;
            }

            const statusDisplay = config.status ? lang.setups.autovoice.statusEnabled : lang.setups.autovoice.statusDisabled;

            const card = buildCard({ accent: config.status ? ACCENT.success : ACCENT.warning })
                .addText(`**${lang.setups.autovoice.title}**`)
                .addSeparator()
                .addText(
                    `**${lang.setups.autovoice.statusLabel}:** ${statusDisplay}\n` +
                    `**${lang.setups.autovoice.voiceChannelLabel}:** ${voiceDisplay}\n` +
                    `**${lang.setups.autovoice.managerChannelLabel}:** ${managerDisplay}\n` +
                    `**${lang.setups.autovoice.allowedRolesLabel}:** ${roleText}`
                );

            return sendV2(interaction, card);
        }

        if (subcommand === 'delete') {
            const hasPermission = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) ||
                               interaction.member.id === guild.ownerId;

            if (!hasPermission) {
                return sendV2(interaction, cards.error(lang.errorTitle, lang.setups.autovoice.deletePermissionError));
            }

            const config = await VoiceChannelModel.findOne({ serverId: serverID });
            if (!config) {
                return sendV2(interaction, cards.error(lang.errorTitle, lang.setups.autovoice.noConfig));
            }

            try {
                await VoiceChannelModel.deleteOne({ serverId: serverID });
                invalidateVoiceChannelConfig(serverID);

                return sendV2(interaction, cards.success(lang.setups.autovoice.title, lang.setups.autovoice.deleted));
            } catch (error) {
                console.error('[Setup-AutoVoice] Error deleting setup:', error);
                return sendV2(interaction, cards.error(lang.errorTitle, lang.setups.autovoice.deleteError));
            }
        }
    }
};
