


'use strict';

const { SlashCommandBuilder } = require('discord.js');
const config = require('../../config.js');
const checkPermissions = require('../../utils/checkPermissions');
const { buildCard, cards, sendV2, replyEphemeral, deferReply, ACCENT, createInterpolatableProxy } = require('../../UI');

const restartConfirmations = new Map();

const rawLang = require('../../events/loadLanguage');
const lang = {
    ...rawLang,
    setups: {
        ...rawLang.setups,
        managebot: createInterpolatableProxy(rawLang.setups?.managebot),
        common: createInterpolatableProxy(rawLang.setups?.common)
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('manage-bot')
        .setDescription('Bot customization and management (Owner Only)')
        .addSubcommand(sub => sub
            .setName('pfp')
            .setDescription('Change bot profile picture')
            .addStringOption(option =>
                option.setName('url')
                    .setDescription('Direct image URL for new profile picture')
                    .setRequired(true)))
        .addSubcommand(sub => sub
            .setName('banner')
            .setDescription('Update bot profile banner')
            .addStringOption(option =>
                option.setName('url')
                    .setDescription('Direct image URL for new banner')
                    .setRequired(true)))
        .addSubcommand(sub => sub
            .setName('username')
            .setDescription('Change bot username')
            .addStringOption(option =>
                option.setName('name')
                    .setDescription('New username for the bot')
                    .setRequired(true)))
        .addSubcommand(sub => sub
            .setName('restart')
            .setDescription('Restart bot processes (WARNING: Causes downtime)')),

    async execute(interaction) {
        if (!await checkPermissions(interaction)) return;

        if (!interaction.isChatInputCommand || !interaction.isChatInputCommand()) {
            return replyEphemeral(interaction, cards.warning(lang.warning, lang.setups.managebot.warningUseSlash));
        }

        await deferReply(interaction, true);

        const sender = interaction.user;
        const ownerId = config.ownerId;

        if (sender.id !== ownerId) {
            return sendV2(interaction, cards.error(
                lang.setups.managebot.title,
                lang.setups.managebot.accessDenied
            ));
        }

        const subcommand = interaction.options.getSubcommand();
        const client = interaction.client;

        try {
            if (subcommand === 'pfp') {
                const imageUrl = interaction.options.getString('url');

                if (!imageUrl) {
                    return sendV2(interaction, cards.error(
                        lang.setups.managebot.title,
                        lang.setups.managebot.missingPfpUrl
                    ));
                }

                try {
                    await client.user.setAvatar(imageUrl);

                    const card = buildCard({ accent: ACCENT.success })
                        .addText(`**${lang.setups.managebot.title}**`)
                        .addSeparator()
                        .addText(lang.setups.managebot.pfpUpdated)
                        .addSeparator()
                        .addText(lang.setups.managebot.pfpDetails({ url: imageUrl }));

                    return sendV2(interaction, card);
                } catch (error) {
                    return sendV2(interaction, cards.error(
                        lang.setups.managebot.title,
                        lang.setups.managebot.pfpError({ error: error.message })
                    ));
                }
            }

            if (subcommand === 'banner') {
                const imageUrl = interaction.options.getString('url');

                if (!imageUrl) {
                    return sendV2(interaction, cards.error(
                        lang.setups.managebot.title,
                        lang.setups.managebot.missingBannerUrl
                    ));
                }

                try {
                    await client.user.setBanner(imageUrl);

                    const card = buildCard({ accent: ACCENT.primary })
                        .addText(`**${lang.setups.managebot.title}**`)
                        .addSeparator()
                        .addText(lang.setups.managebot.bannerUpdated)
                        .addSeparator()
                        .addText(lang.setups.managebot.bannerDetails({ url: imageUrl }));

                    return sendV2(interaction, card);
                } catch (error) {
                    return sendV2(interaction, cards.error(
                        lang.setups.managebot.title,
                        lang.setups.managebot.bannerError({ error: error.message })
                    ));
                }
            }

            if (subcommand === 'username') {
                const newUsername = interaction.options.getString('name');

                if (!newUsername) {
                    return sendV2(interaction, cards.error(
                        lang.setups.managebot.title,
                        lang.setups.managebot.missingUsername
                    ));
                }

                try {
                    const oldUsername = client.user.username;
                    await client.user.setUsername(newUsername);

                    const card = buildCard({ accent: ACCENT.success })
                        .addText(`**${lang.setups.managebot.title}**`)
                        .addSeparator()
                        .addText(lang.setups.managebot.usernameUpdated)
                        .addSeparator()
                        .addText(lang.setups.managebot.usernameDetails({ oldName: oldUsername, newName: newUsername }));

                    return sendV2(interaction, card);
                } catch (error) {
                    return sendV2(interaction, cards.error(
                        lang.setups.managebot.title,
                        lang.setups.managebot.usernameError({ error: error.message })
                    ));
                }
            }

            if (subcommand === 'restart') {
                const userId = sender.id;
                const now = Date.now();

                if (restartConfirmations.has(userId)) {
                    const confirmTime = restartConfirmations.get(userId);

                    if (now - confirmTime <= 30000) {
                        restartConfirmations.delete(userId);

                        const card = buildCard({ accent: ACCENT.danger })
                            .addText(`**${lang.setups.managebot.restartingTitle}**`)
                            .addSeparator()
                            .addText(lang.setups.managebot.restartingDesc);

                        await sendV2(interaction, card);

                        setTimeout(() => {
                            console.log('[Manage-Bot] Bot restart initiated by owner:', sender.tag);
                            process.exit(0);
                        }, 2000);

                        return;
                    } else {
                        restartConfirmations.delete(userId);
                    }
                }

                restartConfirmations.set(userId, now);
                setTimeout(() => {
                    restartConfirmations.delete(userId);
                }, 30000);

                const card = buildCard({ accent: ACCENT.warning })
                    .addText(`**${lang.setups.managebot.restartWarningTitle}**`)
                    .addSeparator()
                    .addText(lang.setups.managebot.restartWarning);

                return sendV2(interaction, card);
            }

            return sendV2(interaction, cards.info(
                lang.setups.managebot.helpTitle,
                lang.setups.managebot.helpDesc
            ));

        } catch (error) {
            console.error('[Manage-Bot] Error in manage-bot command:', error);
            return sendV2(interaction, cards.error(
                lang.setups.managebot.title,
                lang.setups.managebot.error
            ));
        }
    }
};