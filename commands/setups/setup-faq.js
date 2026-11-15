


'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { buildCard, cards, sendV2, replyEphemeral, deferReply, ACCENT, createInterpolatableProxy } = require('../../UI');
const FaqConfig = require('../../models/faq/faqModel');
const checkPermissions = require('../../utils/checkPermissions');
const { invalidateFaqConfig } = require('../../utils/cacheHelpers');

const rawLang = require('../../events/loadLanguage');
const lang = {
    ...rawLang,
    setups: {
        ...rawLang.setups,
        faq: createInterpolatableProxy(rawLang.setups?.faq),
        common: createInterpolatableProxy(rawLang.setups?.common)
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-faq')
        .setDescription('Configure FAQ system for this server')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('enable')
                .setDescription('Enable/disable FAQ system')
                .addBooleanOption(option =>
                    option.setName('enabled')
                        .setDescription('Enable or disable FAQ')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('channels')
                .setDescription('Set FAQ channels')
                .addStringOption(option =>
                    option.setName('channels')
                        .setDescription('Use "ALL" for all channels or comma-separated channel IDs')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('context')
                .setDescription('Set server context for AI responses')
                .addStringOption(option =>
                    option.setName('description')
                        .setDescription('Detailed server description (max 5000 chars)')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('custom_instructions')
                        .setDescription('Custom instructions for AI responses (max 2000 chars)')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('addlink')
                .setDescription('Add a server link')
                .addStringOption(option =>
                    option.setName('type')
                        .setDescription('Link type')
                        .setRequired(true)
                        .addChoices(
                            { name: 'YouTube', value: 'youtube' },
                            { name: 'Website', value: 'website' },
                            { name: 'Discord', value: 'discord' },
                            { name: 'Social Media', value: 'social' },
                            { name: 'Documentation', value: 'documentation' },
                            { name: 'Guide', value: 'guide' },
                            { name: 'Other', value: 'other' }
                        ))
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Link name/title')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('url')
                        .setDescription('URL')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('description')
                        .setDescription('Link description')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Show current FAQ configuration'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Delete all FAQ configuration for this server')),

    async execute(interaction) {
        if (!interaction.isCommand || !interaction.isCommand()) {
            return replyEphemeral(interaction, cards.warning(lang.warning, lang.setups.faq.warningUseSlash));
        }

        await deferReply(interaction, true);
        if (!await checkPermissions(interaction)) return;
        if (!interaction.member?.permissions?.has(PermissionFlagsBits.Administrator)) {
            return sendV2(interaction, cards.error(lang.errorTitle, lang.setups.common?.adminRequired || 'Administrator permission is required.'));
        }

        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        try {
            switch (subcommand) {
                case 'enable': {
                    const enabled = interaction.options.getBoolean('enabled');
                    await FaqConfig.createOrUpdate(guildId, { enabled });
                    invalidateFaqConfig(guildId);

                    const statusText = enabled ? lang.setups.faq.statusEnabled : lang.setups.faq.statusDisabled;
                    const card = cards[enabled ? 'success' : 'warning'](
                        lang.setups.faq.title,
                        lang.setups.faq.updated({ status: statusText.toLowerCase() })
                    );
                    return sendV2(interaction, card);
                }

                case 'channels': {
                    const channels = interaction.options.getString('channels');
                    await FaqConfig.createOrUpdate(guildId, { channels });
                    invalidateFaqConfig(guildId);

                    const card = cards.info(
                        lang.setups.faq.title,
                        lang.setups.faq.channelsUpdated({ channels })
                    );
                    return sendV2(interaction, card);
                }

                case 'context': {
                    const description = interaction.options.getString('description');
                    const customInstructions = interaction.options.getString('custom_instructions') || '';

                    if (description.length > 5000) {
                        return sendV2(interaction, cards.error(lang.errorTitle, lang.setups.faq.descTooLong));
                    }

                    if (customInstructions && customInstructions.length > 2000) {
                        return sendV2(interaction, cards.error(lang.errorTitle, lang.setups.faq.instructionsTooLong));
                    }

                    try {
                        const updateData = {
                            'context.serverDescription': description
                        };

                        if (customInstructions) {
                            updateData['context.customInstructions'] = customInstructions;
                        }

                        await FaqConfig.createOrUpdate(guildId, updateData);
                        invalidateFaqConfig(guildId);

                        try {
                            const contextConfig = await FaqConfig.findByGuild(guildId);
                            if (contextConfig) {
                                await contextConfig.updateServerMetadata(interaction.guild);
                            }
                        } catch (metadataError) {
                            console.error('[Setup-FAQ] Error updating server metadata:', metadataError);
                        }

                        const extraText = customInstructions ? `\n${lang.setups.faq.customInstructionsLabel}: ${customInstructions.length} characters` : '';
                        const card = cards.success(
                            lang.setups.faq.title,
                            lang.setups.faq.contextUpdated({
                                descLength: description.length,
                                extraInstructions: extraText
                            })
                        );
                        return sendV2(interaction, card);
                    } catch (error) {
                        console.error('[Setup-FAQ] Error updating context:', error);
                        return sendV2(interaction, cards.error(lang.errorTitle, lang.setups.faq.contextError));
                    }
                }

                case 'addlink': {
                    const linkType = interaction.options.getString('type');
                    const linkName = interaction.options.getString('name');
                    const linkUrl = interaction.options.getString('url');
                    const linkDesc = interaction.options.getString('description') || '';

                    if (!/^https?:\/\/.+/.test(linkUrl)) {
                        return sendV2(interaction, cards.error(lang.errorTitle, lang.setups.faq.invalidUrl));
                    }

                    let linkConfig = await FaqConfig.findByGuild(guildId);
                    if (!linkConfig) {
                        linkConfig = await FaqConfig.createOrUpdate(guildId, {});
                    }

                    await linkConfig.addLink({
                        type: linkType,
                        name: linkName,
                        url: linkUrl,
                        description: linkDesc
                    });

                    invalidateFaqConfig(guildId);

                    const card = buildCard({ accent: ACCENT.success })
                        .addText(`**${lang.setups.faq.title}**`)
                        .addSeparator()
                        .addText(lang.setups.faq.linkAdded({ name: linkName, type: linkType }))
                        .addSeparator()
                        .addText(`**${lang.setups.faq.urlLabel}:** ${linkUrl}`);

                    return sendV2(interaction, card);
                }

                case 'status': {
                    const statusConfig = await FaqConfig.findByGuild(guildId);

                    if (!statusConfig) {
                        return sendV2(interaction, cards.warning(lang.setups.faq.title, lang.setups.faq.noConfig));
                    }

                    const card = buildCard({ accent: ACCENT.info })
                        .addText(`**${lang.setups.faq.statusTitle}**`)
                        .addSeparator()
                        .addText(
                            `• **${lang.setups.faq.enabledLabel}:** ${statusConfig.enabled ? lang.setups.faq.yes : lang.setups.faq.no}\n` +
                            `• **${lang.setups.faq.channelsLabel}:** ${String(statusConfig.channels)}\n` +
                            `• **${lang.setups.faq.languageLabel}:** ${lang.setups.faq.languageValue}\n` +
                            `• **${lang.setups.faq.contextLengthLabel}:** ${lang.setups.faq.charsCount({ count: statusConfig.context?.serverDescription?.length || 0 })}\n` +
                            `• **${lang.setups.faq.customInstructionsLabel}:** ${statusConfig.context?.customInstructions ? lang.setups.faq.charsCount({ count: statusConfig.context.customInstructions.length }) : lang.setups.faq.none}\n` +
                            `• **${lang.setups.faq.linksLabel}:** ${lang.setups.faq.linksCount({ count: statusConfig.links?.length || 0 })}\n` +
                            `• **${lang.setups.faq.aiManagerLabel}:** ${lang.setups.faq.aiManagerValue}\n` +
                            `• **${lang.setups.faq.totalQueriesLabel}:** ${(statusConfig.usage?.totalQueries || 0).toLocaleString()}\n` +
                            `• **${lang.setups.faq.dailyQueriesLabel}:** ${(statusConfig.usage?.dailyQueries || 0).toLocaleString()}\n\n` +
                            `*${lang.setups.faq.footerTip}*`
                        );

                    return sendV2(interaction, card);
                }

                case 'delete': {
                    try {
                        const deleteConfig = await FaqConfig.findByGuild(guildId);
                        if (!deleteConfig) {
                            return sendV2(interaction, cards.error(lang.errorTitle, lang.setups.faq.noConfig));
                        }

                        await FaqConfig.deleteOne({ guildId });
                        invalidateFaqConfig(guildId);

                        return sendV2(interaction, cards.success(lang.setups.faq.title, lang.setups.faq.deleted));
                    } catch (error) {
                        console.error('[Setup-FAQ] Error deleting FAQ config:', error);
                        return sendV2(interaction, cards.error(lang.errorTitle, lang.setups.faq.deleteError));
                    }
                }
            }
        } catch (error) {
            console.error('[Setup-FAQ] Error in FAQ setup:', error);
            return sendV2(interaction, cards.error(lang.errorTitle, lang.setups.faq.processError));
        }
    }
};
