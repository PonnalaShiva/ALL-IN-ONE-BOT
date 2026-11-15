


'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const CommandLogsConfig = require('../../models/commandLogs/commandlogs');
const checkPermissions = require('../../utils/checkPermissions');
const cacheManager = require('../../utils/cacheManager');
const { buildCard, cards, sendV2, replyEphemeral, deferReply, ACCENT, createInterpolatableProxy } = require('../../UI');

const rawLang = require('../../events/loadLanguage');
const lang = {
    ...rawLang,
    setups: {
        ...rawLang.setups,
        commandlogs: createInterpolatableProxy(rawLang.setups?.commandlogs),
        common: createInterpolatableProxy(rawLang.setups?.common)
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-commandlogs')
        .setDescription('Manage command logging configuration.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Enable or disable command logging.')
                .addBooleanOption(option =>
                    option
                        .setName('enabled')
                        .setDescription('Set to true to enable logging, false to disable.')
                        .setRequired(true)
                )
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('The channel to send command execution logs (required when enabling).')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('View the current command logging configuration.')
        ),

    async execute(interaction) {
        if (!interaction.isCommand || !interaction.isCommand()) {
            return replyEphemeral(interaction, cards.warning(lang.warning, lang.setups.commandlogs.warningUseSlash));
        }

        await deferReply(interaction, true);
        const { guild } = interaction;
        if (!guild) {
            return sendV2(interaction, cards.error(lang.setups.commandlogs.title, lang.serverRequired));
        }

        const guildId = guild.id;
        if (!await checkPermissions(interaction)) return;

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'set') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return sendV2(interaction, cards.error(lang.setups.commandlogs.title, lang.noPermission));
            }

            const enabled = interaction.options.getBoolean('enabled');
            const channel = interaction.options.getChannel('channel');

            if (enabled && !channel) {
                return sendV2(interaction, cards.error(lang.setups.commandlogs.title, lang.setups.commandlogs.channelRequired));
            }

            try {
                let config = await CommandLogsConfig.findOne({
                    $or: [{ guildId }, { serverId: guildId }]
                });
                if (!config) {
                    config = new CommandLogsConfig({
                        guildId,
                        serverId: guildId,
                        channelId: channel ? channel.id : null,
                        logChannelId: channel ? channel.id : null,
                        enabled,
                        isEnabled: enabled,
                    });
                } else {
                    config.guildId = guildId;
                    config.serverId = guildId;
                    config.enabled = enabled;
                    config.isEnabled = enabled;
                    if (channel) {
                        config.channelId = channel.id;
                        config.logChannelId = channel.id;
                    }
                }

                await config.save();
                try {
                    cacheManager.delete('commandLogConfig', guildId);
                } catch (_) {}

                const desc = enabled
                    ? lang.setups.commandlogs.enabled({ channel })
                    : lang.setups.commandlogs.disabled;

                const card = cards[enabled ? 'success' : 'warning'](lang.setups.commandlogs.title, desc);
                return sendV2(interaction, card);
            } catch (error) {
                console.error('[Setup-CommandLogs] Error saving command logs config:', error);
                return sendV2(interaction, cards.error(lang.setups.commandlogs.title, lang.setups.commandlogs.saveError));
            }
        }

        if (subcommand === 'view') {
            try {
                const config = await CommandLogsConfig.findOne({
                    $or: [{ guildId }, { serverId: guildId }]
                });
                if (!config) {
                    return sendV2(interaction, cards.info(lang.setups.commandlogs.title, lang.setups.commandlogs.noConfig));
                }

                const channelId = config.channelId || config.logChannelId;
                const channel = channelId ? guild.channels.cache.get(channelId) : null;
                const isEnabled = Boolean(config.enabled ?? config.isEnabled);
                const statusText = isEnabled ? lang.setups.commandlogs.statusEnabled : lang.setups.commandlogs.statusDisabled;
                const channelText = channel ? channel.toString() : lang.setups.commandlogs.notConfigured;

                const card = buildCard({ accent: ACCENT.info })
                    .addText(`**${lang.setups.commandlogs.title}**`)
                    .addSeparator()
                    .addText(`**${lang.setups.commandlogs.statusLabel}:** ${statusText}\n**${lang.setups.commandlogs.channelLabel}:** ${channelText}`);

                return sendV2(interaction, card);
            } catch (error) {
                console.error('[Setup-CommandLogs] Error fetching command logs config:', error);
                return sendV2(interaction, cards.error(lang.setups.commandlogs.title, lang.setups.commandlogs.fetchError));
            }
        }
    }
};
