


'use strict';

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const CountingConfig = require('../../models/counting/Schema');
const { invalidateCountingConfig } = require('../../utils/cacheHelpers');
const checkPermissions = require('../../utils/checkPermissions');
const { buildCard, cards, sendV2, replyEphemeral, deferReply, ACCENT, createInterpolatableProxy } = require('../../UI');

const rawLang = require('../../events/loadLanguage');
const lang = {
    ...rawLang,
    setups: {
        ...rawLang.setups,
        counting: createInterpolatableProxy(rawLang.setups?.counting),
        common: createInterpolatableProxy(rawLang.setups?.common)
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-counting')
        .setDescription('Manage the advanced counting game for your server.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)

        .addSubcommand(sub =>
            sub.setName('channel')
                .setDescription('Set up counting channel with advanced options.')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Select the channel for the counting game.')
                        .setRequired(true))
                .addBooleanOption(option =>
                    option.setName('status')
                        .setDescription('Enable or disable counting.')
                        .setRequired(true))
                .addBooleanOption(option =>
                    option.setName('allow-same-user')
                        .setDescription('Allow same user to count consecutively.')
                        .setRequired(false))
                .addBooleanOption(option =>
                    option.setName('delete-wrong')
                        .setDescription('Delete incorrect counting messages.')
                        .setRequired(false))
                .addBooleanOption(option =>
                    option.setName('show-errors')
                        .setDescription('Show error messages for wrong counts.')
                        .setRequired(false))
        )

        .addSubcommand(sub =>
            sub.setName('view')
                .setDescription('View detailed counting statistics.')
        )

        .addSubcommand(sub =>
            sub.setName('leaderboard')
                .setDescription('View the counting leaderboard.')
        )

        .addSubcommand(sub =>
            sub.setName('milestones')
                .setDescription('View counting milestones.')
        )

        .addSubcommand(sub =>
            sub.setName('edit')
                .setDescription('Edit counting settings.')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Select a new counting channel.')
                        .setRequired(false))
                .addBooleanOption(option =>
                    option.setName('allow-same-user')
                        .setDescription('Allow same user to count consecutively.')
                        .setRequired(false))
                .addBooleanOption(option =>
                    option.setName('delete-wrong')
                        .setDescription('Delete incorrect counting messages.')
                        .setRequired(false))
                .addBooleanOption(option =>
                    option.setName('show-errors')
                        .setDescription('Show error messages for wrong counts.')
                        .setRequired(false))
                .addBooleanOption(option =>
                    option.setName('status')
                        .setDescription('Enable or disable counting.')
                        .setRequired(false))
        )

        .addSubcommand(sub =>
            sub.setName('reset')
                .setDescription('Reset the current count back to 0 (Admin only).')
        )

        .addSubcommand(sub =>
            sub.setName('delete')
                .setDescription('Delete counting setup for this server.')
        ),

    async execute(interaction) {
        if (!interaction.isCommand || !interaction.isCommand()) {
            return replyEphemeral(interaction, cards.warning(lang.warning, lang.setups.counting.warningUseSlash));
        }

        await deferReply(interaction, true);
        if (!await checkPermissions(interaction)) return;

        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (subcommand === 'channel') {
            const channel = interaction.options.getChannel('channel');
            const status = interaction.options.getBoolean('status');
            const allowSameUser = interaction.options.getBoolean('allow-same-user') ?? false;
            const deleteWrong = interaction.options.getBoolean('delete-wrong') ?? false;
            const showErrors = interaction.options.getBoolean('show-errors') ?? true;

            const existingConfig = await CountingConfig.findOne({ serverId: guildId });

            const config = await CountingConfig.findOneAndUpdate(
                { serverId: guildId },
                {
                    serverId: guildId,
                    channelId: channel.id,
                    status,
                    allowSameUser,
                    deleteWrongMessage: deleteWrong,
                    showErrors,
                    currentCount: existingConfig ? existingConfig.currentCount : 0,
                    lastNumber: existingConfig ? existingConfig.lastNumber : 0
                },
                { upsert: true, returnDocument: 'after' }
            );

            invalidateCountingConfig(guildId);

            const statusText = String(status ? lang.setups.counting.statusEnabled : lang.setups.counting.statusDisabled);
            const card = buildCard({ accent: status ? ACCENT.success : ACCENT.warning })
                .addText(`**${lang.setups.counting.title}**`)
                .addSeparator()
                .addText(lang.setups.counting.setupUpdated({ status: statusText.toLowerCase(), channel: channel.toString() }))
                .addSeparator()
                .addText(
                    `• **${lang.setups.counting.channelLabel}:** ${channel.toString()}\n` +
                    `• **${lang.setups.counting.statusLabel}:** ${statusText}\n` +
                    `• **${lang.setups.counting.allowSameUserLabel}:** ${allowSameUser ? lang.setups.counting.yes : lang.setups.counting.no}\n` +
                    `• **${lang.setups.counting.deleteWrongLabel}:** ${deleteWrong ? lang.setups.counting.yes : lang.setups.counting.no}\n` +
                    `• **${lang.setups.counting.showErrorsLabel}:** ${showErrors ? lang.setups.counting.yes : lang.setups.counting.no}\n` +
                    `• **${lang.setups.counting.currentCountLabel}:** \`${config.currentCount}\``
                );

            return sendV2(interaction, card);
        }

        if (subcommand === 'view') {
            const config = await CountingConfig.findOne({ serverId: guildId });

            if (!config) {
                return sendV2(interaction, cards.info(lang.setups.counting.title, lang.setups.counting.noConfig));
            }

            const channel = interaction.guild.channels.cache.get(config.channelId);
            const channelDisplay = channel ? channel.toString() : lang.setups.counting.channelDeleted;
            const lastUser = config.lastUserId ? `<@${config.lastUserId}>` : lang.setups.counting.none;
            const statusDisplay = String(config.status ? lang.setups.counting.statusEnabled : lang.setups.counting.statusDisabled);

            const card = buildCard({ accent: ACCENT.info })
                .addText(`**${lang.setups.counting.statsTitle}**`)
                .addSeparator()
                .addText(
                    `• **${lang.setups.counting.statusLabel}:** ${statusDisplay}\n` +
                    `• **${lang.setups.counting.channelLabel}:** ${channelDisplay}\n` +
                    `• **${lang.setups.counting.currentCountLabel}:** **${config.currentCount}**\n` +
                    `• **${lang.setups.counting.highScoreLabel}:** ${config.highScore || 0}\n` +
                    `• **${lang.setups.counting.lastCounterLabel}:** ${lastUser}\n` +
                    `• **${lang.setups.counting.totalCountsLabel}:** ${config.totalCounts || 0}`
                );

            return sendV2(interaction, card);
        }

        if (subcommand === 'leaderboard') {
            const config = await CountingConfig.findOne({ serverId: guildId });

            if (!config || !config.userStats || config.userStats.size === 0) {
                return sendV2(interaction, cards.info(lang.setups.counting.title, lang.setups.counting.noLeaderboard));
            }

            const entries = Array.from(config.userStats.entries())
                .sort((a, b) => b[1].correct - a[1].correct)
                .slice(0, 10);

            const lines = entries.map((entry, idx) => {
                const [uid, stats] = entry;
                return `**#${idx + 1}** <@${uid}> — **${stats.correct}** correct (${stats.wrong || 0} mistakes)`;
            }).join('\n');

            const card = buildCard({ accent: ACCENT.info })
                .addText(`**${lang.setups.counting.leaderboardTitle}**`)
                .addSeparator()
                .addText(lines);

            return sendV2(interaction, card);
        }

        if (subcommand === 'milestones') {
            const config = await CountingConfig.findOne({ serverId: guildId });

            if (!config || !config.milestones || config.milestones.length === 0) {
                return sendV2(interaction, cards.info(lang.setups.counting.title, lang.setups.counting.noMilestones));
            }

            const lines = config.milestones.map(m =>
                `• **${m.count}** reached on <t:${Math.floor(new Date(m.achievedAt).getTime() / 1000)}:d> by <@${m.achievedBy}>`
            ).join('\n');

            const card = buildCard({ accent: ACCENT.info })
                .addText(`**${lang.setups.counting.milestonesTitle}**`)
                .addSeparator()
                .addText(lines);

            return sendV2(interaction, card);
        }

        if (subcommand === 'edit') {
            const config = await CountingConfig.findOne({ serverId: guildId });
            if (!config) {
                return sendV2(interaction, cards.error(lang.errorTitle, lang.setups.counting.noConfig));
            }

            const channel = interaction.options.getChannel('channel');
            const allowSameUser = interaction.options.getBoolean('allow-same-user');
            const deleteWrong = interaction.options.getBoolean('delete-wrong');
            const showErrors = interaction.options.getBoolean('show-errors');
            const status = interaction.options.getBoolean('status');

            if (channel) config.channelId = channel.id;
            if (allowSameUser !== null) config.allowSameUser = allowSameUser;
            if (deleteWrong !== null) config.deleteWrongMessage = deleteWrong;
            if (showErrors !== null) config.showErrors = showErrors;
            if (status !== null) config.status = status;

            await config.save();
            invalidateCountingConfig(guildId);

            return sendV2(interaction, cards.success(lang.setups.counting.title, lang.setups.counting.settingsUpdated));
        }

        if (subcommand === 'reset') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return sendV2(interaction, cards.error(lang.errorTitle, lang.setups.counting.adminOnlyReset));
            }

            const config = await CountingConfig.findOne({ serverId: guildId });
            if (!config) {
                return sendV2(interaction, cards.error(lang.errorTitle, lang.setups.counting.noConfig));
            }

            config.currentCount = 0;
            config.lastNumber = 0;
            config.lastUserId = null;
            await config.save();
            invalidateCountingConfig(guildId);

            return sendV2(interaction, cards.warning(lang.setups.counting.title, lang.setups.counting.countReset));
        }

        if (subcommand === 'delete') {
            const hasPermission = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels) ||
                               interaction.member.id === interaction.guild.ownerId;

            if (!hasPermission) {
                return sendV2(interaction, cards.error(lang.errorTitle, lang.setups.counting.deletePermissionError));
            }

            const config = await CountingConfig.findOne({ serverId: guildId });
            if (!config) {
                return sendV2(interaction, cards.error(lang.errorTitle, lang.setups.counting.noConfig));
            }

            try {
                await CountingConfig.deleteOne({ serverId: guildId });
                invalidateCountingConfig(guildId);

                return sendV2(interaction, cards.success(lang.setups.counting.title, lang.setups.counting.deleted));
            } catch (error) {
                console.error('[Setup-Counting] Error deleting setup:', error);
                return sendV2(interaction, cards.error(lang.errorTitle, lang.setups.counting.deleteError));
            }
        }
    }
};
