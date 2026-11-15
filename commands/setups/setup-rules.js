


'use strict';

const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const ruleEmbeds = require('../../data/rules/rulesEmbed');
const checkPermissions = require('../../utils/checkPermissions');
const { cards, sendV2, replyEphemeral, deferReply, createInterpolatableProxy } = require('../../UI');

const rawLang = require('../../events/loadLanguage');
const lang = {
    ...rawLang,
    setups: {
        ...rawLang.setups,
        rules: createInterpolatableProxy(rawLang.setups?.rules),
        common: createInterpolatableProxy(rawLang.setups?.common)
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-rules')
        .setDescription('Set a rules channel and send specific rules.')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Select the channel to send rules')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('category')
                .setDescription('Select a rule category or "all" for all rules')
                .setRequired(true)
                .addChoices(
                    { name: 'All Rules', value: 'all' },
                    { name: 'Spam', value: 'spam' },
                    { name: 'NSFW', value: 'nsfw' },
                    { name: 'Discord Terms', value: 'discord_terms' },
                    { name: 'Harassment', value: 'harassment' },
                    { name: 'Links', value: 'links' },
                    { name: 'Images', value: 'images' },
                    { name: 'Hacking', value: 'hacking' },
                    { name: 'Mic Spam', value: 'mic_spam' },
                    { name: 'Bot Usage', value: 'bot_usage' },
                    { name: 'Trading & Selling', value: 'trading_selling' },
                    { name: 'Language', value: 'language' },
                    { name: 'Spoilers', value: 'spoilers' },
                    { name: 'Self-Promotion', value: 'self_promotion' },
                    { name: 'Moderation', value: 'moderation' }
                )
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (!interaction.isCommand || !interaction.isCommand()) {
            return replyEphemeral(interaction, cards.warning(lang.warning, lang.setups.rules.warningUseSlash));
        }

        await deferReply(interaction, true);
        if (!await checkPermissions(interaction)) return;
        if (!interaction.member?.permissions?.has(PermissionFlagsBits.Administrator)) {
            return sendV2(interaction, cards.error(lang.errorTitle, lang.setups.common?.adminRequired || 'Administrator permission is required.'));
        }
        const channel = interaction.options.getChannel('channel');
        const category = interaction.options.getString('category');

        try {
            if (category === 'all') {
                const allCards = Object.values(ruleEmbeds);

                for (const card of allCards) {
                    await channel.send({
                        components: [card],
                        flags: MessageFlags.IsComponentsV2
                    });
                }

                const card = cards.success(lang.setups.rules.title, lang.setups.rules.success({ channel }));
                return sendV2(interaction, card);
            }

            if (ruleEmbeds[category]) {
                await channel.send({
                    components: [ruleEmbeds[category]],
                    flags: MessageFlags.IsComponentsV2
                });
                const card = cards.success(lang.setups.rules.title, lang.setups.rules.success({ channel }));
                return sendV2(interaction, card);
            }

            const card = cards.error(lang.errorTitle, lang.setups.rules.invalidCategory);
            return sendV2(interaction, card);
        } catch (error) {
            console.error('[Setup-Rules] Error sending rules:', error);
            const card = cards.error(lang.errorTitle, lang.setups.rules.failed);
            return sendV2(interaction, card);
        }
    }
};
