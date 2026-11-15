


'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const AiChat = require('../../models/aichat/aiModel');
const checkPermissions = require('../../utils/checkPermissions');
const { buildCard, cards, sendV2, replyEphemeral, deferReply, ACCENT, createInterpolatableProxy } = require('../../UI');

const rawLang = require('../../events/loadLanguage');
const lang = {
    ...rawLang,
    setups: {
        ...rawLang.setups,
        aichat: createInterpolatableProxy(rawLang.setups?.aichat),
        ai: createInterpolatableProxy(rawLang.setups?.aichat),
        common: createInterpolatableProxy(rawLang.setups?.common)
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-aichat')
        .setDescription('Configure AI chat features for your server')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Set a channel for AI chat and toggle it on/off')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('The channel to use for AI chat')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('status')
                        .setDescription('Enable or disable AI chat')
                        .setRequired(true)
                        .addChoices(
                            { name: 'On', value: 'on' },
                            { name: 'Off', value: 'off' }
                        ))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('View current AI chat settings')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('disable')
                .setDescription('Disable AI chat for your server')
        ),

    async execute(interaction) {
        if (!interaction.isCommand || !interaction.isCommand()) {
            return replyEphemeral(interaction, cards.warning(lang.warning, lang.setups.aichat.warningUseSlash));
        }

        await deferReply(interaction, true);
        const { guild } = interaction;
        const guildId = guild.id;

        if (!await checkPermissions(interaction)) return;

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'set') {
            const channel = interaction.options.getChannel('channel');
            const status = interaction.options.getString('status');
            const isEnabled = status === 'on';

            try {
                const existingConfig = await AiChat.getConfig(guildId);
                await AiChat.setConfig(guildId, channel.id, isEnabled, interaction.user.id);

                let updateMessage;
                if (existingConfig && existingConfig.channelId !== channel.id) {
                    updateMessage = isEnabled
                        ? lang.setups.aichat.enabledMoved({ channel: channel.toString() })
                        : lang.setups.aichat.disabledMoved({ channel: channel.toString() });
                } else {
                    updateMessage = isEnabled
                        ? lang.setups.aichat.enabled({ channel: channel.toString() })
                        : lang.setups.aichat.disabled({ channel: channel.toString() });
                }

                const card = cards[isEnabled ? 'success' : 'warning'](lang.setups.aichat.title, updateMessage);
                return sendV2(interaction, card);
            } catch (error) {
                console.error(`[Setup-AiChat] Error setting up AI chat for guild ${guildId}:`, error);
                return sendV2(interaction, cards.error(lang.setups.aichat.title, lang.setups.aichat.saveError));
            }
        }

        if (subcommand === 'view') {
            try {
                const config = await AiChat.getConfig(guildId);

                if (!config) {
                    return sendV2(interaction, cards.info(lang.setups.aichat.title, lang.setups.aichat.noConfig));
                }

                const channel = guild.channels.cache.get(config.channelId);
                const channelText = channel ? channel.toString() : lang.setups.aichat.unknownChannel;
                const statusText = config.isEnabled ? lang.setups.aichat.statusEnabled : lang.setups.aichat.statusDisabled;
                const updatedTime = config.updatedAt ? config.updatedAt.toLocaleString() : lang.setups.aichat.unknownDate;

                const card = buildCard({ accent: config.isEnabled ? ACCENT.success : ACCENT.warning })
                    .addText(`**${lang.setups.aichat.title}**`)
                    .addSeparator()
                    .addText(`**${lang.setups.aichat.channelLabel}:** ${channelText}\n**${lang.setups.aichat.statusLabel}:** ${statusText}\n**${lang.setups.aichat.updatedLabel}:** ${updatedTime}`);

                return sendV2(interaction, card);
            } catch (error) {
                console.error(`[Setup-AiChat] Error fetching AI chat config for guild ${guildId}:`, error);
                return sendV2(interaction, cards.error(lang.setups.aichat.title, lang.setups.aichat.fetchError));
            }
        }

        if (subcommand === 'disable') {
            try {
                const config = await AiChat.getConfig(guildId);

                if (!config) {
                    return sendV2(interaction, cards.info(lang.setups.aichat.title, lang.setups.aichat.noConfig));
                }

                await AiChat.disableChat(guildId, interaction.user.id);
                return sendV2(interaction, cards.success(lang.setups.aichat.title, lang.setups.aichat.disabledSuccess));
            } catch (error) {
                console.error(`[Setup-AiChat] Error disabling AI chat for guild ${guildId}:`, error);
                return sendV2(interaction, cards.error(lang.setups.aichat.title, lang.setups.aichat.saveError));
            }
        }
    }
};
