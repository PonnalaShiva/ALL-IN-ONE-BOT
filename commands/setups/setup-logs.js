


'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const LogConfig = require('../../models/serverLogs/LogConfig');
const { invalidateLogConfig } = require('../../utils/cacheHelpers');
const checkPermissions = require('../../utils/checkPermissions');
const { buildCard, cards, sendV2, replyEphemeral, deferReply, ACCENT, createInterpolatableProxy } = require('../../UI');

const rawLang = require('../../events/loadLanguage');
const lang = {
    ...rawLang,
    setups: {
        ...rawLang.setups,
        logs: createInterpolatableProxy(rawLang.setups?.logs),
        common: createInterpolatableProxy(rawLang.setups?.common)
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-logs')
        .setDescription('Configure server logging channels for specific or all events.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('event')
                .setDescription('Set a logging channel for a specific event.')
                .addStringOption(option =>
                    option.setName('event')
                        .setDescription('The event to log.')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Message Deleted', value: 'messageDelete' },
                            { name: 'Message Updated', value: 'messageUpdate' },
                            { name: 'Member Joined', value: 'memberJoin' },
                            { name: 'Member Left', value: 'memberLeave' },
                            { name: 'Role Created', value: 'roleCreate' },
                            { name: 'Role Deleted', value: 'roleDelete' },
                            { name: 'Member Banned', value: 'memberBan' },
                            { name: 'Member Unbanned', value: 'memberUnban' },
                            { name: 'Voice Channel Joined', value: 'voiceJoin' },
                            { name: 'Voice Channel Left', value: 'voiceLeave' },
                            { name: 'Channel Created', value: 'channelCreate' },
                            { name: 'Channel Deleted', value: 'channelDelete' },
                            { name: 'Role Assigned to User', value: 'roleAssigned' },
                            { name: 'Role Removed from User', value: 'roleRemoved' },
                            { name: 'Nickname Changed', value: 'nicknameChange' },
                            { name: 'Moderation Logs', value: 'moderationLogs' },
                        ))
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('The channel to log the event in.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('all')
                .setDescription('Set a logging channel for all events.')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('The channel to log all events in.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('View all configured logging channels.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('clear-event')
                .setDescription('Clear the logging channel for a specific event.')
                .addStringOption(option =>
                    option.setName('event')
                        .setDescription('The event to clear logs for.')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Message Deleted', value: 'messageDelete' },
                            { name: 'Message Updated', value: 'messageUpdate' },
                            { name: 'Member Joined', value: 'memberJoin' },
                            { name: 'Member Left', value: 'memberLeave' },
                            { name: 'Role Created', value: 'roleCreate' },
                            { name: 'Role Deleted', value: 'roleDelete' },
                            { name: 'Member Banned', value: 'memberBan' },
                            { name: 'Member Unbanned', value: 'memberUnban' },
                            { name: 'Voice Channel Joined', value: 'voiceJoin' },
                            { name: 'Voice Channel Left', value: 'voiceLeave' },
                            { name: 'Channel Created', value: 'channelCreate' },
                            { name: 'Channel Deleted', value: 'channelDelete' },
                            { name: 'Role Assigned to User', value: 'roleAssigned' },
                            { name: 'Role Removed from User', value: 'roleRemoved' },
                            { name: 'Nickname Changed', value: 'nicknameChange' },
                            { name: 'Moderation Logs', value: 'moderationLogs' },
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('clear-all')
                .setDescription('Clear all logging channels for this server.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Delete all logging configuration for this server.')),

    async execute(interaction) {
        if (!interaction.isCommand || !interaction.isCommand()) {
            return replyEphemeral(interaction, cards.warning(lang.warning, lang.setups.logs.warningUseSlash));
        }

        await deferReply(interaction, true);
        if (!await checkPermissions(interaction)) return;

        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (subcommand === 'event') {
            const eventType = interaction.options.getString('event');
            const channel = interaction.options.getChannel('channel');

            if (!channel.isTextBased()) {
                return sendV2(interaction, cards.error(lang.errorTitle, lang.setups.logs.invalidChannel));
            }

            await LogConfig.findOneAndUpdate(
                { guildId, eventType },
                { channelId: channel.id },
                { upsert: true, returnDocument: 'after' }
            );

            invalidateLogConfig(guildId, eventType);

            const card = cards.success(
                lang.setups.logs.title,
                lang.setups.logs.eventConfigured({ event: eventType, channel: `<#${channel.id}>` })
            );
            return sendV2(interaction, card);
        }

        if (subcommand === 'all') {
            const channel = interaction.options.getChannel('channel');

            if (!channel.isTextBased()) {
                return sendV2(interaction, cards.error(lang.errorTitle, lang.setups.logs.invalidChannel));
            }

            const eventTypes = [
                'messageDelete', 'messageUpdate', 'memberJoin', 'memberLeave',
                'roleCreate', 'roleDelete', 'memberBan', 'memberUnban',
                'voiceJoin', 'voiceLeave', 'channelCreate', 'channelDelete',
                'roleAssigned', 'roleRemoved', 'nicknameChange', 'moderationLogs',
            ];

            await Promise.all(eventTypes.map(eventType =>
                LogConfig.findOneAndUpdate(
                    { guildId, eventType },
                    { channelId: channel.id },
                    { upsert: true, returnDocument: 'after' }
                )
            ));

            invalidateLogConfig(guildId);

            const card = cards.success(
                lang.setups.logs.title,
                lang.setups.logs.allConfigured({ channel: `<#${channel.id}>` })
            );
            return sendV2(interaction, card);
        }

        if (subcommand === 'view') {
            const configs = await LogConfig.find({ guildId });

            if (configs.length === 0) {
                return sendV2(interaction, cards.info(lang.setups.logs.title, lang.setups.logs.noConfig));
            }

            const formattedChannels = configs.map(cfg => `• **${cfg.eventType}:** <#${cfg.channelId}>`).join('\n');

            const card = buildCard({ accent: ACCENT.info })
                .addText(`**${lang.setups.logs.viewTitle}**`)
                .addSeparator()
                .addText(formattedChannels);

            return sendV2(interaction, card);
        }

        if (subcommand === 'clear-event') {
            const eventType = interaction.options.getString('event');

            const deleted = await LogConfig.deleteOne({ guildId, eventType });

            if (deleted.deletedCount === 0) {
                return sendV2(interaction, cards.warning(
                    lang.setups.logs.title,
                    lang.setups.logs.eventNotFound({ event: eventType })
                ));
            }

            invalidateLogConfig(guildId, eventType);

            return sendV2(interaction, cards.success(
                lang.setups.logs.title,
                lang.setups.logs.eventCleared({ event: eventType })
            ));
        }

        if (subcommand === 'clear-all') {
            const deleted = await LogConfig.deleteMany({ guildId });

            if (deleted.deletedCount === 0) {
                return sendV2(interaction, cards.warning(lang.setups.logs.title, lang.setups.logs.noLogsToClear));
            }

            invalidateLogConfig(guildId);

            return sendV2(interaction, cards.success(lang.setups.logs.title, lang.setups.logs.allCleared));
        }

        if (subcommand === 'delete') {
            const deleted = await LogConfig.deleteMany({ guildId });
            invalidateLogConfig(guildId);

            if (deleted.deletedCount > 0) {
                return sendV2(interaction, cards.success(lang.setups.logs.title, lang.setups.logs.deleted));
            }
            return sendV2(interaction, cards.warning(lang.setups.logs.title, lang.setups.logs.noConfigToDelete));
        }
    }
};
