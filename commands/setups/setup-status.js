


'use strict';

const { SlashCommandBuilder } = require('discord.js');
const { botStatusCollection } = require('../../mongodb');
const config = require('../../config.js');


const getOwnerId = () => {
    return config.ownerId || null;
};

const { buildCard, cards, sendV2, replyEphemeral, deferReply, ACCENT, createInterpolatableProxy } = require('../../UI');

const rawLang = require('../../events/loadLanguage');
const lang = {
    ...rawLang,
    setups: {
        ...rawLang.setups,
        status: createInterpolatableProxy(rawLang.setups?.status),
        common: createInterpolatableProxy(rawLang.setups?.common)
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-status')
        .setDescription('View or change the bot\'s presence')
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Add a custom status to rotation')
                .addStringOption(opt =>
                    opt.setName('status')
                        .setDescription('Bot status')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Online', value: 'online' },
                            { name: 'Idle', value: 'idle' },
                            { name: 'Do Not Disturb', value: 'dnd' },
                        ))
                .addStringOption(opt =>
                    opt.setName('activity')
                        .setDescription('Activity text (use placeholders like {members}, {servers}, {channels})')
                        .setRequired(true))
                .addStringOption(opt =>
                    opt.setName('type')
                        .setDescription('Activity type')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Playing', value: 'Playing' },
                            { name: 'Watching', value: 'Watching' },
                            { name: 'Listening', value: 'Listening' },
                            { name: 'Streaming', value: 'Streaming' },
                        ))
                .addStringOption(opt =>
                    opt.setName('streamurl')
                        .setDescription('Twitch Stream URL (only for Streaming activity)')
                        .setRequired(false))
        )
        .addSubcommand(sub =>
            sub.setName('view')
                .setDescription('View all custom statuses in rotation')
        )
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Remove a custom status from rotation')
                .addIntegerOption(opt =>
                    opt.setName('index')
                        .setDescription('Index of the status to remove (use /setup-status view to see indices)')
                        .setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('interval')
                .setDescription('Set the interval for status rotation')
                .addIntegerOption(opt =>
                    opt.setName('seconds')
                        .setDescription('Interval in seconds (default: 10)')
                        .setRequired(true)
                        .setMinValue(5)
                        .setMaxValue(300))
        )
        .addSubcommand(sub =>
            sub.setName('toggle')
                .setDescription('Toggle between default rotation and custom rotation')
                .addBooleanOption(opt =>
                    opt.setName('use_custom')
                        .setDescription('Use custom rotation instead of default')
                        .setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('reset')
                .setDescription('Reset to default rotating activities')
        ),

    async execute(interaction) {
        if (!interaction.isCommand || !interaction.isCommand()) {
            return replyEphemeral(interaction, cards.warning(lang.warning, lang.setups.status.warningUseSlash));
        }

        await deferReply(interaction, true);
        const subcommand = interaction.options.getSubcommand();

        const ownerId = getOwnerId();
        if (!ownerId) {
            return sendV2(interaction, cards.error(lang.errorTitle, 'Bot owner ID not configured. Please set `ownerId` in config.js.'));
        }

        if (interaction.user.id !== ownerId) {
            return sendV2(interaction, cards.error(lang.errorTitle, lang.setups.status.onlyOwner));
        }

        if (subcommand === 'add') {
            const status = interaction.options.getString('status');
            const activityRaw = interaction.options.getString('activity');
            const type = interaction.options.getString('type');
            const streamurl = interaction.options.getString('streamurl') || null;

            if (type === 'Streaming' && (!streamurl || !streamurl.startsWith('https://www.twitch.tv/'))) {
                return sendV2(interaction, cards.error(lang.errorTitle, lang.setups.status.invalidTwitchUrl));
            }

            const statusObj = {
                status,
                activity: activityRaw,
                type,
                url: streamurl || null,
            };

            const statusDoc = await botStatusCollection.findOne({}) || { 
                useCustom: false, 
                customRotation: [],
                interval: 10
            };

            if (!statusDoc.customRotation) {
                statusDoc.customRotation = [];
            }

            if (statusDoc.customRotation.length >= 3) {
                return sendV2(interaction, cards.warning(lang.warning, lang.setups.status.maxLimitReached));
            }

            statusDoc.customRotation.push(statusObj);
            await botStatusCollection.updateOne({}, { $set: statusDoc }, { upsert: true });

            const card = cards.success(
                lang.setups.status.title,
                lang.setups.status.added({ status, type, activity: activityRaw })
            );
            return sendV2(interaction, card);
        }

        if (subcommand === 'view') {
            const statusDoc = await botStatusCollection.findOne({});
            if (!statusDoc || !statusDoc.customRotation || statusDoc.customRotation.length === 0) {
                return sendV2(interaction, cards.info(lang.setups.status.title, lang.setups.status.noCustomStatuses));
            }

            const rotationList = statusDoc.customRotation.map((st, index) => {
                const urlPart = st.url ? ` (URL: ${st.url})` : '';
                return `**${index + 1}.** ${st.status} — ${st.type} **${st.activity}**${urlPart}`;
            }).join('\n');

            const activeMode = statusDoc.useCustom ? lang.setups.status.customRotation : lang.setups.status.defaultRotation;
            const intervalMsg = `**${lang.setups.status.intervalLabel}:** ${statusDoc.interval || 10}s\n**${lang.setups.status.activeModeLabel}:** ${activeMode}`;

            const card = buildCard({ accent: ACCENT.info })
                .addText(`**${lang.setups.status.listTitle({ count: statusDoc.customRotation.length })}**`)
                .addSeparator()
                .addText(rotationList)
                .addSeparator()
                .addText(intervalMsg);

            return sendV2(interaction, card);
        }

        if (subcommand === 'remove') {
            const index = interaction.options.getInteger('index') - 1;

            const statusDoc = await botStatusCollection.findOne({});
            if (!statusDoc || !statusDoc.customRotation || !statusDoc.customRotation[index]) {
                return sendV2(interaction, cards.error(lang.errorTitle, lang.setups.status.invalidIndex));
            }

            const removed = statusDoc.customRotation.splice(index, 1)[0];
            await botStatusCollection.updateOne({}, { $set: { customRotation: statusDoc.customRotation } });

            const card = cards.success(
                lang.setups.status.title,
                lang.setups.status.removed({ status: removed.status, type: removed.type, activity: removed.activity })
            );
            return sendV2(interaction, card);
        }

        if (subcommand === 'interval') {
            const seconds = interaction.options.getInteger('seconds');

            await botStatusCollection.updateOne({}, { $set: { interval: seconds } }, { upsert: true });

            return sendV2(interaction, cards.success(
                lang.setups.status.title,
                lang.setups.status.intervalSet({ seconds })
            ));
        }

        if (subcommand === 'toggle') {
            const useCustom = interaction.options.getBoolean('use_custom');

            const statusDoc = await botStatusCollection.findOne({}) || { 
                customRotation: [],
                interval: 10
            };

            if (useCustom && (!statusDoc.customRotation || statusDoc.customRotation.length === 0)) {
                return sendV2(interaction, cards.warning(lang.warning, lang.setups.status.noStatusesForCustomMode));
            }

            await botStatusCollection.updateOne({}, { $set: { useCustom } }, { upsert: true });

            const mode = useCustom ? lang.setups.status.customRotation : lang.setups.status.defaultRotation;
            return sendV2(interaction, cards.success(
                lang.setups.status.title,
                lang.setups.status.modeSet({ mode })
            ));
        }

        if (subcommand === 'reset') {
            await botStatusCollection.deleteOne({});
            return sendV2(interaction, cards.success(lang.setups.status.title, lang.setups.status.resetSuccess));
        }
    }
};