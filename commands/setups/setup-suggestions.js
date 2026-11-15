


'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const SuggestionConfig = require('../../models/suggestions/SuggestionConfig');
const { invalidateSuggestionConfig } = require('../../utils/cacheHelpers');
const checkPermissions = require('../../utils/checkPermissions');
const { buildCard, cards, sendV2, replyEphemeral, deferReply, ACCENT, createInterpolatableProxy } = require('../../UI');

const rawLang = require('../../events/loadLanguage');
const lang = {
    ...rawLang,
    setups: {
        ...rawLang.setups,
        suggestions: createInterpolatableProxy(rawLang.setups?.suggestions),
        common: createInterpolatableProxy(rawLang.setups?.common)
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-suggestions')
        .setDescription('Set up the suggestion system for your server.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName('set')
                .setDescription('Set up the suggestion system')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('The channel where suggestions will be sent.')
                        .setRequired(true)
                )
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('Only members with this role can use the /suggestion command (optional).')
                )
        )
        .addSubcommand(sub =>
            sub.setName('view')
                .setDescription('View the current suggestion configuration')
        )
        .addSubcommand(sub =>
            sub.setName('delete')
                .setDescription('Delete all suggestion configuration for this server.')
        ),

    async execute(interaction) {
        if (!interaction.isCommand || !interaction.isCommand()) {
            return replyEphemeral(interaction, cards.warning(lang.warning, lang.setups.suggestions.warningUseSlash));
        }

        await deferReply(interaction, true);

        try {
            const guildId = interaction.guild.id;
            if (!await checkPermissions(interaction)) return;
            if (!interaction.member?.permissions?.has(PermissionFlagsBits.Administrator)) {
                return sendV2(interaction, cards.error(lang.errorTitle, lang.setups.common?.adminRequired || 'Administrator permission is required.'));
            }
            
            const subcommand = interaction.options.getSubcommand();
            
            if (subcommand === 'set') {
                const channel = interaction.options.getChannel('channel');
                const role = interaction.options.getRole('role');

                if (!channel.isTextBased()) {
                    return sendV2(interaction, cards.error(lang.errorTitle, lang.setups.suggestions.invalidChannel));
                }

                await SuggestionConfig.findOneAndUpdate(
                    { guildId },
                    {
                        guildId,
                        suggestionChannelId: channel.id,
                        allowedRoleId: role?.id || null
                    },
                    { upsert: true }
                );

                invalidateSuggestionConfig(guildId);

                const roleDisplay = role ? `<@&${role.id}>` : lang.setups.suggestions.everyone;
                const card = buildCard({ accent: ACCENT.success })
                    .addText(`**${lang.setups.suggestions.title}**`)
                    .addSeparator()
                    .addText(lang.setups.suggestions.configured)
                    .addSeparator()
                    .addText(lang.setups.suggestions.configuredDesc({ channel: `<#${channel.id}>`, role: roleDisplay }));

                return sendV2(interaction, card);
            }

            if (subcommand === 'view') {
                const config = await SuggestionConfig.findOne({ guildId });
                if (!config) {
                    return sendV2(interaction, cards.info(lang.setups.suggestions.title, lang.setups.suggestions.noConfig));
                }

                const roleDisplay = config.allowedRoleId ? `<@&${config.allowedRoleId}>` : lang.setups.suggestions.everyone;
                const card = buildCard({ accent: ACCENT.info })
                    .addText(`**${lang.setups.suggestions.viewTitle}**`)
                    .addSeparator()
                    .addText(lang.setups.suggestions.viewDesc({ channel: `<#${config.suggestionChannelId}>`, role: roleDisplay }));

                return sendV2(interaction, card);
            }

            if (subcommand === 'delete') {
                const deleted = await SuggestionConfig.deleteOne({ guildId });
                invalidateSuggestionConfig(guildId);

                if (deleted.deletedCount > 0) {
                    return sendV2(interaction, cards.success(lang.setups.suggestions.title, lang.setups.suggestions.deleted));
                }
                return sendV2(interaction, cards.warning(lang.setups.suggestions.title, lang.setups.suggestions.noConfigToDelete));
            }

        } catch (error) {
            console.error('[Setup-Suggestions] Error in setup-suggestions command:', error);
            return sendV2(interaction, cards.error(lang.errorTitle, lang.setups.suggestions.processError));
        }
    }
};
