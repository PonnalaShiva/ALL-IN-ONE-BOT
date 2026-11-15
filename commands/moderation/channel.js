


'use strict';

const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    ButtonStyle,
    MessageFlags
} = require('discord.js');
const checkPermissions = require('../../utils/checkPermissions');
const {
    buildCard,
    cards,
    btn,
    buttonRow,
    sendV2,
    editV2,
    deferReply,
    deferUpdate,
    ACCENT, createInterpolatableProxy } = require('../../UI');
const { getEmoji } = require('../../UI/emojis/emoji');

const rawLang = require('../../events/loadLanguage');
const lang = {
    ...rawLang,
    moderation: {
        ...rawLang.moderation,
        channel: createInterpolatableProxy(rawLang.moderation?.channel),
        common: createInterpolatableProxy(rawLang.moderation?.common)
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('channel')
        .setDescription('Advanced channel management and administration tools')
        .addSubcommand(sub =>
            sub.setName('info')
                .setDescription('Get comprehensive channel information and analytics')
                .addChannelOption(o => o.setName('channel').setDescription('Target channel to analyze').setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('slowmode')
                .setDescription('Configure channel slowmode with precise control')
                .addIntegerOption(o => o.setName('duration').setDescription('Duration in seconds (0–21600)').setRequired(true))
                .addChannelOption(o => o.setName('channel').setDescription('Target channel (default: current)').setRequired(false)))
        .addSubcommand(sub =>
            sub.setName('removeslowmode')
                .setDescription('Remove slowmode from channel')
                .addChannelOption(o => o.setName('channel').setDescription('Target channel (default: current)').setRequired(false)))
        .addSubcommand(sub =>
            sub.setName('lock')
                .setDescription('Lock channel to prevent messaging')
                .addChannelOption(o => o.setName('channel').setDescription('Target channel (default: current)').setRequired(false))
                .addStringOption(o => o.setName('reason').setDescription('Reason for locking').setRequired(false)))
        .addSubcommand(sub =>
            sub.setName('unlock')
                .setDescription('Unlock channel to allow messaging')
                .addChannelOption(o => o.setName('channel').setDescription('Target channel (default: current)').setRequired(false))
                .addStringOption(o => o.setName('reason').setDescription('Reason for unlocking').setRequired(false)))
        .addSubcommand(sub =>
            sub.setName('rename')
                .setDescription('Rename channel with validation')
                .addStringOption(o => o.setName('name').setDescription('New channel name').setRequired(true))
                .addChannelOption(o => o.setName('channel').setDescription('Target channel (default: current)').setRequired(false)))
        .addSubcommand(sub =>
            sub.setName('topic')
                .setDescription('Set or update channel topic')
                .addStringOption(o => o.setName('text').setDescription('Topic text (max 1024 characters)').setRequired(true))
                .addChannelOption(o => o.setName('channel').setDescription('Target channel (default: current)').setRequired(false)))
        .addSubcommand(sub =>
            sub.setName('clone')
                .setDescription('Create an exact copy of channel')
                .addChannelOption(o => o.setName('channel').setDescription('Channel to clone (default: current)').setRequired(false))
                .addStringOption(o => o.setName('name').setDescription('Name for cloned channel').setRequired(false)))
        .addSubcommand(sub =>
            sub.setName('delete')
                .setDescription('Delete channel with confirmation')
                .addChannelOption(o => o.setName('channel').setDescription('Channel to delete').setRequired(true))
                .addStringOption(o => o.setName('reason').setDescription('Reason for deletion').setRequired(false)))
        .addSubcommand(sub =>
            sub.setName('create')
                .setDescription('Create new channel with advanced options')
                .addStringOption(o => o.setName('name').setDescription('Channel name').setRequired(true))
                .addStringOption(o => o.setName('type').setDescription('Channel type').addChoices(
                    { name: 'Text Channel', value: 'GUILD_TEXT' },
                    { name: 'Voice Channel', value: 'GUILD_VOICE' },
                    { name: 'Stage Channel', value: 'GUILD_STAGE_VOICE' },
                    { name: 'Category', value: 'GUILD_CATEGORY' },
                    { name: 'News Channel', value: 'GUILD_NEWS' },
                    { name: 'Forum Channel', value: 'GUILD_FORUM' }
                ).setRequired(true))
                .addChannelOption(o => o.setName('category').setDescription('Parent category').addChannelTypes(ChannelType.GuildCategory).setRequired(false))
                .addStringOption(o => o.setName('topic').setDescription('Channel topic').setRequired(false))
                .addBooleanOption(o => o.setName('nsfw').setDescription('Mark as NSFW').setRequired(false)))
        .addSubcommand(sub =>
            sub.setName('nsfw')
                .setDescription('Toggle NSFW status')
                .addChannelOption(o => o.setName('channel').setDescription('Target channel (default: current)').setRequired(false)))
        .addSubcommand(sub =>
            sub.setName('permissions')
                .setDescription('Analyze channel permissions')
                .addChannelOption(o => o.setName('channel').setDescription('Target channel').setRequired(true))
                .addUserOption(o => o.setName('user').setDescription('User to check').setRequired(false))
                .addRoleOption(o => o.setName('role').setDescription('Role to check').setRequired(false)))
        .addSubcommand(sub =>
            sub.setName('hide')
                .setDescription('Hide channel from @everyone')
                .addChannelOption(o => o.setName('channel').setDescription('Target channel (default: current)').setRequired(false)))
        .addSubcommand(sub =>
            sub.setName('unhide')
                .setDescription('Show channel to @everyone')
                .addChannelOption(o => o.setName('channel').setDescription('Target channel (default: current)').setRequired(false)))
        .addSubcommand(sub =>
            sub.setName('move')
                .setDescription('Move channel to different category')
                .addChannelOption(o => o.setName('category').setDescription('Target category').addChannelTypes(ChannelType.GuildCategory).setRequired(true))
                .addChannelOption(o => o.setName('channel').setDescription('Channel to move (default: current)').setRequired(false))
                .addIntegerOption(o => o.setName('position').setDescription('Position in category').setRequired(false)))
        .addSubcommand(sub =>
            sub.setName('stats')
                .setDescription('Advanced channel statistics')
                .addChannelOption(o => o.setName('channel').setDescription('Channel to analyze (default: current)').setRequired(false)))
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('List all channels with details')
                .addStringOption(o => o.setName('type').setDescription('Filter by type').addChoices(
                    { name: 'All Channels', value: 'all' },
                    { name: 'Text Channels', value: 'text' },
                    { name: 'Voice Channels', value: 'voice' },
                    { name: 'Categories', value: 'category' },
                    { name: 'Stage Channels', value: 'stage' }
                ).setRequired(false)))
        .addSubcommand(sub =>
            sub.setName('purge')
                .setDescription('Advanced message purging')
                .addIntegerOption(o => o.setName('amount').setDescription('Number of messages (1-100)').setRequired(true))
                .addUserOption(o => o.setName('user').setDescription('Filter by user').setRequired(false))
                .addStringOption(o => o.setName('content').setDescription('Filter by content').setRequired(false))
                .addBooleanOption(o => o.setName('bots').setDescription('Only bot messages').setRequired(false))),

    async execute(interaction) {
        if (!await checkPermissions(interaction, 'admin')) return;

        let sender = interaction.user;
        let subcommand;
        let isSlashCommand = false;
        let args = [];

        if (interaction.isCommand && interaction.isCommand()) {
            isSlashCommand = true;
            await deferReply(interaction);
            subcommand = interaction.options.getSubcommand();
        } else {
            const message = interaction;
            sender = message.author;
            const messageArgs = message.content.split(' ');
            messageArgs.shift();
            subcommand = messageArgs[0] || 'help';
            args = messageArgs.slice(1);
        }

        const getChannelOption = (optionName) => {
            if (isSlashCommand) {
                return interaction.options.getChannel(optionName);
            }
            const channelArg = args.find(arg => arg.startsWith('<#') && arg.endsWith('>'));
            if (channelArg) {
                const channelId = channelArg.slice(2, -1);
                return interaction.guild.channels.cache.get(channelId);
            }
            return null;
        };

        const getStringOption = (optionName) => {
            if (isSlashCommand) {
                return interaction.options.getString(optionName);
            }
            return args.join(' ') || null;
        };

        const getIntegerOption = (optionName) => {
            if (isSlashCommand) {
                return interaction.options.getInteger(optionName);
            }
            const num = parseInt(args[0], 10);
            return isNaN(num) ? null : num;
        };

        const getUserOption = (optionName) => {
            if (isSlashCommand) {
                return interaction.options.getUser(optionName);
            }
            const userArg = args.find(arg => arg.startsWith('<@') && arg.endsWith('>'));
            if (userArg) {
                const userId = userArg.replace(/[<@!>]/g, '');
                return interaction.guild.members.cache.get(userId)?.user || null;
            }
            return null;
        };

        const member = interaction.member;
        const channel = interaction.channel;
        const guild = interaction.guild;

        if (!member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            const errorCard = cards.error(
                lang.moderation.channel.accessDeniedTitle,
                lang.moderation.channel.accessDenied
            );
            return sendV2(interaction, errorCard);
        }

        if (subcommand === 'purge' && !member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return sendV2(interaction, cards.error(
                lang.moderation.channel.accessDeniedTitle,
                lang.moderation.channel.purgePermissionDenied
            ));
        }

        switch (subcommand) {
            case 'info': {
                const targetChannel = getChannelOption('channel') || channel;
                if (!targetChannel) {
                    return sendV2(interaction, cards.error(
                        lang.moderation.channel.channelNotFoundTitle,
                        lang.moderation.channel.channelNotFound
                    ));
                }

                const slowmode = targetChannel.rateLimitPerUser || 0;
                const members = targetChannel.members?.size || 0;
                const permissions = targetChannel.permissionsFor(guild.roles.everyone);
                const canSend = permissions?.has(PermissionFlagsBits.SendMessages) ?? false;
                const canView = permissions?.has(PermissionFlagsBits.ViewChannel) ?? false;

                const card = buildCard({ accent: ACCENT.primary })
                    .addText(`${getEmoji('analytics')} **${lang.moderation.channel.infoTitleHeader}**`)
                    .addSeparator()
                    .addText(`**Channel:** ${targetChannel}\n**Channel ID:** \`${targetChannel.id}\`\n**Type:** \`${ChannelType[targetChannel.type] || 'Unknown'}\`\n**Position:** ${targetChannel.position + 1}`)
                    .addSeparator()
                    .addText(`**Created:** <t:${Math.floor(targetChannel.createdTimestamp / 1000)}:F>\n**Category:** ${targetChannel.parent ? targetChannel.parent.name : 'None'}\n**NSFW Status:** ${targetChannel.nsfw ? 'Enabled' : 'Disabled'}`);

                if (targetChannel.topic) {
                    card.addSeparator().addText(`**Channel Topic:**\n${targetChannel.topic}`);
                }

                if (slowmode > 0) {
                    card.addSeparator().addText(`**Slowmode:** ${slowmode} seconds active\n**Effect:** Users must wait ${slowmode}s between messages`);
                }

                if (targetChannel.type === ChannelType.GuildVoice || targetChannel.type === ChannelType.GuildStageVoice) {
                    const quality = targetChannel.bitrate >= 96000 ? 'High' : targetChannel.bitrate >= 64000 ? 'Standard' : 'Basic';
                    card.addSeparator().addText(`**Voice Channel Details:**\n**Connected Users:** ${members}\n**User Limit:** ${targetChannel.userLimit || 'Unlimited'}\n**Bitrate:** ${targetChannel.bitrate / 1000}kbps\n**Quality:** ${quality}`);
                }

                card.addSeparator().addText(`**Permissions Overview:**\n**@everyone can view:** ${canView ? 'Yes' : 'No'}\n**@everyone can send:** ${canSend ? 'Yes' : 'No'}\n**Permission Overrides:** ${targetChannel.permissionOverwrites?.cache?.size || 0} configured`);

                return sendV2(interaction, card);
            }

            case 'slowmode': {
                const duration = getIntegerOption('duration');
                const targetChannel = getChannelOption('channel') || channel;

                if (duration === null || duration < 0 || duration > 21600) {
                    return sendV2(interaction, cards.error(
                        lang.moderation.channel.invalidDurationTitle,
                        lang.moderation.channel.invalidDuration
                    ));
                }

                try {
                    await targetChannel.setRateLimitPerUser(duration);
                    const impact = duration === 0
                        ? 'Users can now message freely without restrictions'
                        : `Users must wait ${duration}s between messages.`;

                    const card = buildCard({ accent: ACCENT.success })
                        .addText(`${getEmoji('time')} **${lang.moderation.channel.slowmodeTitle}**`)
                        .addSeparator()
                        .addText(`**Channel:** ${targetChannel}\n**New Duration:** ${duration === 0 ? 'Disabled' : `${duration} seconds`}\n**Modified By:** ${sender}\n**Timestamp:** <t:${Math.floor(Date.now() / 1000)}:F>`)
                        .addSeparator()
                        .addText(`**Impact:** ${impact}`);

                    return sendV2(interaction, card);
                } catch (error) {
                    return sendV2(interaction, cards.error(
                        lang.moderation.channel.slowmodeErrorTitle,
                        lang.moderation.channel.slowmodeError
                    ));
                }
            }

            case 'removeslowmode': {
                const targetChannel = getChannelOption('channel') || channel;

                try {
                    await targetChannel.setRateLimitPerUser(0);
                    const card = buildCard({ accent: ACCENT.success })
                        .addText(`${getEmoji('tick')} **${lang.moderation.channel.slowmodeRemovedTitle}**`)
                        .addSeparator()
                        .addText(`**Channel:** ${targetChannel}\n**Status:** Slowmode Completely Disabled\n**Modified By:** ${sender}\n**Action Time:** <t:${Math.floor(Date.now() / 1000)}:F>`)
                        .addSeparator()
                        .addText(lang.moderation.channel.slowmodeRemoved({ channel: targetChannel }));

                    return sendV2(interaction, card);
                } catch (error) {
                    return sendV2(interaction, cards.error(
                        lang.moderation.channel.removeSlowmodeErrorTitle,
                        lang.moderation.channel.removeSlowmodeError
                    ));
                }
            }

            case 'lock': {
                const targetChannel = getChannelOption('channel') || channel;
                const reason = getStringOption('reason') || lang.moderation.channel.noReason;

                try {
                    await targetChannel.permissionOverwrites.edit(guild.roles.everyone, {
                        SendMessages: false,
                        AddReactions: false,
                        CreatePublicThreads: false,
                        CreatePrivateThreads: false,
                        SendMessagesInThreads: false
                    });

                    const card = buildCard({ accent: ACCENT.danger })
                        .addText(`${getEmoji('lock')} **${lang.moderation.channel.lockTitle}**`)
                        .addSeparator()
                        .addText(`**Channel:** ${targetChannel}\n**Lock Status:** Fully Secured\n**Locked By:** ${sender}\n**Lock Time:** <t:${Math.floor(Date.now() / 1000)}:F>`)
                        .addSeparator()
                        .addText(`**Reason for Lock:**\n${reason}`)
                        .addSeparator()
                        .addText('**Security Restrictions Applied:**\n• Send Messages: Disabled\n• Add Reactions: Disabled\n• Public/Private Threads: Disabled');

                    return sendV2(interaction, card);
                } catch (error) {
                    return sendV2(interaction, cards.error(
                        lang.moderation.channel.lockErrorTitle,
                        lang.moderation.channel.lockError
                    ));
                }
            }

            case 'unlock': {
                const targetChannel = getChannelOption('channel') || channel;
                const reason = getStringOption('reason') || lang.moderation.channel.noReason;

                try {
                    await targetChannel.permissionOverwrites.edit(guild.roles.everyone, {
                        SendMessages: null,
                        AddReactions: null,
                        CreatePublicThreads: null,
                        CreatePrivateThreads: null,
                        SendMessagesInThreads: null
                    });

                    const card = buildCard({ accent: ACCENT.success })
                        .addText(`${getEmoji('tick')} **${lang.moderation.channel.unlockTitle}**`)
                        .addSeparator()
                        .addText(`**Channel:** ${targetChannel}\n**Security Status:** Fully Accessible\n**Unlocked By:** ${sender}\n**Unlock Time:** <t:${Math.floor(Date.now() / 1000)}:F>`)
                        .addSeparator()
                        .addText(`**Reason for Unlock:**\n${reason}`)
                        .addSeparator()
                        .addText('**Permissions Restored:**\n• Send Messages: Re-enabled\n• Add Reactions: Re-enabled\n• Threads: Re-enabled');

                    return sendV2(interaction, card);
                } catch (error) {
                    return sendV2(interaction, cards.error(
                        lang.moderation.channel.unlockErrorTitle,
                        lang.moderation.channel.unlockError
                    ));
                }
            }

            case 'rename': {
                const newName = getStringOption('name');
                const targetChannel = getChannelOption('channel') || channel;

                if (!newName || newName.length < 1 || newName.length > 100) {
                    return sendV2(interaction, cards.error(
                        lang.moderation.channel.invalidNameTitle,
                        lang.moderation.channel.invalidName
                    ));
                }

                const oldName = targetChannel.name;

                try {
                    await targetChannel.setName(newName);

                    const card = buildCard({ accent: ACCENT.primary })
                        .addText(`${getEmoji('document')} **${lang.moderation.channel.renameTitle}**`)
                        .addSeparator()
                        .addText(`**Channel:** ${targetChannel}\n**Renamed By:** ${sender}\n**Operation Time:** <t:${Math.floor(Date.now() / 1000)}:F>`)
                        .addSeparator()
                        .addText(`**Name Change Details:**\n**Previous Name:** ${oldName}\n**New Name:** ${newName}\n**Character Count:** ${newName.length}/100`);

                    return sendV2(interaction, card);
                } catch (error) {
                    return sendV2(interaction, cards.error(
                        lang.moderation.channel.renameErrorTitle,
                        lang.moderation.channel.renameError
                    ));
                }
            }

            case 'topic': {
                const text = getStringOption('text');
                const targetChannel = getChannelOption('channel') || channel;

                if (!text || text.length > 1024) {
                    return sendV2(interaction, cards.error(
                        lang.moderation.channel.invalidTopicTitle,
                        lang.moderation.channel.invalidTopic
                    ));
                }

                if (![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(targetChannel.type)) {
                    return sendV2(interaction, cards.error(
                        lang.moderation.channel.topicUnsupportedTitle,
                        lang.moderation.channel.topicUnsupported
                    ));
                }

                try {
                    await targetChannel.setTopic(text);

                    const card = buildCard({ accent: ACCENT.success })
                        .addText(`${getEmoji('chat')} **${lang.moderation.channel.topicTitle}**`)
                        .addSeparator()
                        .addText(`**Channel:** ${targetChannel}\n**Updated By:** ${sender}\n**Update Time:** <t:${Math.floor(Date.now() / 1000)}:F>\n**Character Count:** ${text.length}/1024`)
                        .addSeparator()
                        .addText(`**New Channel Topic:**\n${text}`);

                    return sendV2(interaction, card);
                } catch (error) {
                    return sendV2(interaction, cards.error(
                        lang.moderation.channel.topicErrorTitle,
                        lang.moderation.channel.topicError
                    ));
                }
            }

            case 'clone': {
                const targetChannel = getChannelOption('channel') || channel;
                const newName = getStringOption('name') || `${targetChannel.name}-copy`;

                try {
                    const clonedChannel = await targetChannel.clone({
                        name: newName,
                        reason: `Channel cloned by ${sender.tag || sender.username} using channel management`
                    });

                    const card = buildCard({ accent: ACCENT.primary })
                        .addText(`${getEmoji('folder')} **${lang.moderation.channel.cloneTitle}**`)
                        .addSeparator()
                        .addText(`**Original Channel:** ${targetChannel}\n**Cloned Channel:** ${clonedChannel}\n**Cloned By:** ${sender}\n**Clone Time:** <t:${Math.floor(Date.now() / 1000)}:F>`)
                        .addSeparator()
                        .addText(`**Clone Details:**\n**Original Name:** ${targetChannel.name}\n**Clone Name:** ${newName}\n**Channel Type:** \`${ChannelType[targetChannel.type]}\`\n**Category:** ${targetChannel.parent?.name || 'None'}`);

                    return sendV2(interaction, card);
                } catch (error) {
                    return sendV2(interaction, cards.error(
                        lang.moderation.channel.cloneErrorTitle,
                        lang.moderation.channel.cloneError
                    ));
                }
            }

            case 'delete': {
                const targetChannel = getChannelOption('channel');
                const reason = getStringOption('reason') || lang.moderation.channel.noReason;

                if (!targetChannel) {
                    return sendV2(interaction, cards.error(
                        lang.moderation.channel.cannotDeleteCurrentTitle,
                        lang.moderation.channel.cannotDeleteCurrent
                    ));
                }

                const confirmButtons = buttonRow(
                    btn({
                        label: lang.moderation.channel.confirmDeleteLabel,
                        customId: 'confirm_delete',
                        emojiKey: 'delete',
                        style: ButtonStyle.Danger
                    }),
                    btn({
                        label: lang.moderation.channel.cancelDeleteLabel,
                        customId: 'cancel_delete',
                        emojiKey: 'cross',
                        style: ButtonStyle.Secondary
                    })
                );

                const confirmCard = buildCard({ accent: ACCENT.danger })
                    .addText(`${getEmoji('warning')} **${lang.moderation.channel.criticalDeleteTitle}**`)
                    .addSeparator()
                    .addText(`**Target Channel:** ${targetChannel}\n**Channel Type:** \`${ChannelType[targetChannel.type]}\`\n**Requested By:** ${sender}\n**Request Time:** <t:${Math.floor(Date.now() / 1000)}:F>`)
                    .addSeparator()
                    .addText(`**Deletion Reason:**\n${reason}`)
                    .addSeparator()
                    .addText('**Permanent Action Warning:**\nThis operation cannot be undone. All message history and settings will be permanently lost.');

                const response = await sendV2(interaction, [confirmCard, confirmButtons]);

                if (!response?.createMessageComponentCollector) return;

                const filter = i => i.user.id === sender.id;
                const collector = response.createMessageComponentCollector({ filter, time: 30000, max: 1 });

                collector.on('collect', async i => {
                    try {
                        await deferUpdate(i);
                    } catch (ackError) {
                        console.error('[ModerationChannel] Could not acknowledge channel deletion decision:', ackError);
                        return;
                    }
                    collector.stop('handled');
                    if (i.customId === 'confirm_delete') {
                        try {
                            const channelName = targetChannel.name;
                            const channelId = targetChannel.id;
                            await targetChannel.delete(reason);

                            const deleteCard = buildCard({ accent: ACCENT.success })
                                .addText(`${getEmoji('tick')} **${lang.moderation.channel.deleteSuccessTitle}**`)
                                .addSeparator()
                                .addText(`**Deleted Channel:** #${channelName}\n**Channel ID:** \`${channelId}\`\n**Deleted By:** ${sender}\n**Completion Time:** <t:${Math.floor(Date.now() / 1000)}:F>`)
                                .addSeparator()
                                .addText(`**Deletion Reason:**\n${reason}`);

                            await editV2(i, deleteCard);
                        } catch (error) {
                            await editV2(i, cards.error(
                                lang.moderation.channel.deleteErrorTitle,
                                lang.moderation.channel.deleteError
                            ));
                        }
                    } else if (i.customId === 'cancel_delete') {
                        const cancelCard = cards.info(
                            lang.moderation.channel.deleteCancelledTitle,
                            lang.moderation.channel.deleteCancelled
                        );
                        await editV2(i, cancelCard);
                    }
                });

                collector.on('end', async collected => {
                    if (collected.size === 0) {
                        try {
                            const timeoutCard = cards.warning(
                                lang.moderation.channel.deleteTimeoutTitle,
                                lang.moderation.channel.deleteTimeout
                            );
                            await editV2(response, timeoutCard);
                        } catch (_) {}
                    }
                });
                break;
            }

            case 'create': {
                const name = getStringOption('name');
                const type = getStringOption('type');
                const category = getChannelOption('category');
                const topic = getStringOption('topic');
                const nsfw = isSlashCommand ? interaction.options.getBoolean('nsfw') : false;

                if (!name || !type) {
                    return sendV2(interaction, cards.error(
                        lang.moderation.channel.createMissingParamsTitle,
                        lang.moderation.channel.createMissingParams
                    ));
                }

                try {
                    const channelOptions = {
                        name: name,
                        type: ChannelType[type],
                        parent: category?.id || null,
                        nsfw: nsfw || false,
                        reason: `Channel creation by ${sender.tag || sender.username}`
                    };

                    if (topic && (type === 'GUILD_TEXT' || type === 'GUILD_NEWS')) {
                        channelOptions.topic = topic;
                    }

                    const newChannel = await guild.channels.create(channelOptions);

                    const card = buildCard({ accent: ACCENT.success })
                        .addText(`${getEmoji('tick')} **${lang.moderation.channel.createTitle}**`)
                        .addSeparator()
                        .addText(`**New Channel:** ${newChannel}\n**Channel ID:** \`${newChannel.id}\`\n**Created By:** ${sender}\n**Creation Time:** <t:${Math.floor(Date.now() / 1000)}:F>`)
                        .addSeparator()
                        .addText(`**Configuration:**\n**Name:** ${name}\n**Type:** \`${ChannelType[newChannel.type]}\`\n**Category:** ${category?.name || 'None (Top Level)'}\n**NSFW Status:** ${nsfw ? 'Enabled' : 'Disabled'}`);

                    if (topic) {
                        card.addSeparator().addText(`**Channel Topic:**\n${topic}`);
                    }

                    return sendV2(interaction, card);
                } catch (error) {
                    return sendV2(interaction, cards.error(
                        lang.moderation.channel.createErrorTitle,
                        lang.moderation.channel.createError
                    ));
                }
            }

            case 'nsfw': {
                const targetChannel = getChannelOption('channel') || channel;

                if (targetChannel.type !== ChannelType.GuildText && targetChannel.type !== ChannelType.GuildNews) {
                    return sendV2(interaction, cards.error(
                        lang.moderation.channel.nsfwIncompatibleTitle,
                        lang.moderation.channel.nsfwIncompatible
                    ));
                }

                try {
                    const newNsfwStatus = !targetChannel.nsfw;
                    await targetChannel.setNSFW(newNsfwStatus);

                    const card = buildCard({ accent: newNsfwStatus ? ACCENT.danger : ACCENT.success })
                        .addText(`${getEmoji('security')} **${lang.moderation.channel.nsfwTitle}**`)
                        .addSeparator()
                        .addText(`**Channel:** ${targetChannel}\n**Modified By:** ${sender}\n**Status Change:** ${targetChannel.nsfw ? 'Enabled' : 'Disabled'} → ${newNsfwStatus ? 'Enabled' : 'Disabled'}\n**Update Time:** <t:${Math.floor(Date.now() / 1000)}:F>`)
                        .addSeparator()
                        .addText(`**Status:** ${newNsfwStatus ? 'NSFW Enabled (Age-restricted)' : 'NSFW Disabled (Safe for all)'}`);

                    return sendV2(interaction, card);
                } catch (error) {
                    return sendV2(interaction, cards.error(
                        lang.moderation.channel.nsfwErrorTitle,
                        lang.moderation.channel.nsfwError
                    ));
                }
            }

            case 'permissions': {
                const targetChannel = getChannelOption('channel');
                const user = getUserOption('user') || (isSlashCommand ? interaction.options.getUser('user') : null);
                const role = isSlashCommand ? interaction.options.getRole('role') : null;

                if (!targetChannel) {
                    return sendV2(interaction, cards.error(
                        lang.moderation.channel.specifyChannelTitle,
                        lang.moderation.channel.specifyChannel
                    ));
                }

                const target = user || role;

                if (target) {
                    const permissions = targetChannel.permissionsFor(target);
                    const permArray = permissions ? permissions.toArray() : [];

                    const card = buildCard({ accent: ACCENT.info })
                        .addText(`${getEmoji('security')} **${lang.moderation.channel.permissionsTitle}**`)
                        .addSeparator()
                        .addText(`**Channel:** ${targetChannel}\n**Target:** ${target}\n**Target Type:** ${user ? 'User Account' : 'Server Role'}\n**Effective Permissions:** ${permArray.length}`)
                        .addSeparator();

                    if (permArray.length > 0) {
                        const permissionCategories = {
                            'General': ['ViewChannel', 'ManageChannels', 'ManageRoles', 'ManageWebhooks'],
                            'Text': ['SendMessages', 'EmbedLinks', 'AttachFiles', 'AddReactions', 'UseExternalEmojis', 'MentionEveryone'],
                            'Voice': ['Connect', 'Speak', 'Stream', 'UseVAD', 'MuteMembers', 'DeafenMembers', 'MoveMembers'],
                            'Advanced': ['Administrator', 'ManageGuild', 'KickMembers', 'BanMembers', 'CreateInstantInvite']
                        };

                        for (const [category, categoryPerms] of Object.entries(permissionCategories)) {
                            const matchingPerms = permArray.filter(perm => categoryPerms.includes(perm));
                            if (matchingPerms.length > 0) {
                                card.addText(`**${category} Permissions:**\n${matchingPerms.join(', ')}`)
                                    .addSeparator();
                            }
                        }
                    } else {
                        card.addText('**Permission Status:** No explicit permissions granted.');
                    }

                    return sendV2(interaction, card);
                } else {
                    const overrides = targetChannel.permissionOverwrites?.cache || new Map();

                    const card = buildCard({ accent: ACCENT.info })
                        .addText(`${getEmoji('security')} **${lang.moderation.channel.permissionsTitle}**`)
                        .addSeparator()
                        .addText(`**Channel:** ${targetChannel}\n**Channel Type:** \`${ChannelType[targetChannel.type]}\`\n**Permission Overrides:** ${overrides.size} configured\n**Analysis Time:** <t:${Math.floor(Date.now() / 1000)}:F>`);

                    if (overrides.size === 0) {
                        card.addSeparator().addText('**Override Status:** No custom permission overrides configured. Uses server defaults.');
                    } else {
                        card.addSeparator().addText('**Permission Overrides (First 5):**');
                        let count = 0;
                        for (const [, override] of overrides) {
                            if (count >= 5) break;
                            const targetEntity = override.type === 0 ? guild.roles.cache.get(override.id) : guild.members.cache.get(override.id);
                            const allowed = override.allow.toArray();
                            const denied = override.deny.toArray();
                            const entityName = targetEntity?.name || targetEntity?.user?.username || 'Unknown Entity';
                            card.addSeparator()
                                .addText(`**${override.type === 0 ? 'Role' : 'User'}: ${entityName}**\n**Allowed:** ${allowed.length > 0 ? allowed.join(', ') : 'None'}\n**Denied:** ${denied.length > 0 ? denied.join(', ') : 'None'}`);
                            count++;
                        }
                    }

                    return sendV2(interaction, card);
                }
            }

            case 'hide': {
                const targetChannel = getChannelOption('channel') || channel;

                try {
                    await targetChannel.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: false });

                    const card = buildCard({ accent: ACCENT.warning })
                        .addText(`${getEmoji('lock')} **${lang.moderation.channel.hideTitle}**`)
                        .addSeparator()
                        .addText(`**Channel:** ${targetChannel}\n**Hidden By:** ${sender}\n**Visibility Status:** Hidden from @everyone\n**Action Time:** <t:${Math.floor(Date.now() / 1000)}:F>`)
                        .addSeparator()
                        .addText(lang.moderation.channel.hidden({ channel: targetChannel }));

                    return sendV2(interaction, card);
                } catch (error) {
                    return sendV2(interaction, cards.error(
                        lang.moderation.channel.hideErrorTitle,
                        lang.moderation.channel.hideError
                    ));
                }
            }

            case 'unhide': {
                const targetChannel = getChannelOption('channel') || channel;

                try {
                    await targetChannel.permissionOverwrites.edit(guild.roles.everyone, { ViewChannel: null });

                    const card = buildCard({ accent: ACCENT.success })
                        .addText(`${getEmoji('tick')} **${lang.moderation.channel.unhideTitle}**`)
                        .addSeparator()
                        .addText(`**Channel:** ${targetChannel}\n**Unhidden By:** ${sender}\n**Visibility Status:** Visible to @everyone\n**Restoration Time:** <t:${Math.floor(Date.now() / 1000)}:F>`)
                        .addSeparator()
                        .addText(lang.moderation.channel.unhidden({ channel: targetChannel }));

                    return sendV2(interaction, card);
                } catch (error) {
                    return sendV2(interaction, cards.error(
                        lang.moderation.channel.unhideErrorTitle,
                        lang.moderation.channel.unhideError
                    ));
                }
            }

            case 'move': {
                const targetChannel = getChannelOption('channel') || channel;
                const targetCategory = isSlashCommand ? interaction.options.getChannel('category') : null;
                const position = isSlashCommand ? interaction.options.getInteger('position') : null;

                if (!targetCategory) {
                    return sendV2(interaction, cards.error(
                        lang.moderation.channel.missingCategoryTitle,
                        lang.moderation.channel.missingCategory
                    ));
                }

                try {
                    const previousCategory = targetChannel.parent?.name || 'None (Top Level)';
                    await targetChannel.setParent(targetCategory.id);
                    if (position !== null) {
                        await targetChannel.setPosition(position);
                    }

                    const card = buildCard({ accent: ACCENT.primary })
                        .addText(`${getEmoji('folder')} **${lang.moderation.channel.moveTitle}**`)
                        .addSeparator()
                        .addText(`**Channel:** ${targetChannel}\n**Moved By:** ${sender}\n**Completion Time:** <t:${Math.floor(Date.now() / 1000)}:F>`)
                        .addSeparator()
                        .addText(`**Category Movement:**\n**Previous:** ${previousCategory}\n**New Location:** ${targetCategory.name}\n**Position:** ${position !== null ? `Position ${position}` : 'Default (bottom)'}`);

                    return sendV2(interaction, card);
                } catch (error) {
                    return sendV2(interaction, cards.error(
                        lang.moderation.channel.moveErrorTitle,
                        lang.moderation.channel.moveError
                    ));
                }
            }

            case 'stats': {
                const targetChannel = getChannelOption('channel') || channel;

                try {
                    let totalMessages = 0, botMessages = 0, humanMessages = 0;
                    const userMessages = {};
                    let analysisError = false;

                    try {
                        const messages = await targetChannel.messages.fetch({ limit: 100 });
                        totalMessages = messages.size;
                        messages.forEach(msg => {
                            if (msg.author.bot) {
                                botMessages++;
                            } else {
                                humanMessages++;
                                userMessages[msg.author.id] = (userMessages[msg.author.id] || 0) + 1;
                            }
                        });
                    } catch (error) {
                        analysisError = true;
                    }

                    const topUsers = Object.entries(userMessages)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 5);

                    const card = buildCard({ accent: ACCENT.warning })
                        .addText(`${getEmoji('analytics')} **${lang.moderation.channel.statsTitle}**`)
                        .addSeparator()
                        .addText(`**Channel:** ${targetChannel}\n**Type:** \`${ChannelType[targetChannel.type]}\`\n**Created:** <t:${Math.floor(targetChannel.createdTimestamp / 1000)}:R>`)
                        .addSeparator()
                        .addText(`**Channel ID:** \`${targetChannel.id}\`\n**Category:** ${targetChannel.parent?.name || 'None'}\n**NSFW Status:** ${targetChannel.nsfw ? 'Enabled' : 'Disabled'}`);

                    if (!analysisError) {
                        card.addSeparator().addText(`**Message Activity (Last 100):**\n**Total Messages:** ${totalMessages}\n**Human Messages:** ${humanMessages}\n**Bot Messages:** ${botMessages}`);

                        if (topUsers.length > 0) {
                            const topContributors = topUsers.map(([userId, count], i) => {
                                const u = guild.members.cache.get(userId);
                                return `${i + 1}. ${u ? u.displayName : 'Unknown User'}: ${count} messages`;
                            });
                            card.addSeparator()
                                .addText(`**Top Contributors:**\n${topContributors.join('\n')}`);
                        }
                    }

                    if (targetChannel.type === ChannelType.GuildVoice || targetChannel.type === ChannelType.GuildStageVoice) {
                        const members = targetChannel.members?.size || 0;
                        card.addSeparator().addText(`**Voice Statistics:**\n**Connected Users:** ${members}\n**Bitrate:** ${targetChannel.bitrate / 1000}kbps`);
                    }

                    return sendV2(interaction, card);
                } catch (error) {
                    return sendV2(interaction, cards.error(
                        lang.moderation.channel.statsErrorTitle,
                        lang.moderation.channel.statsError
                    ));
                }
            }

            case 'list': {
                const filterType = getStringOption('type') || 'all';
                let channels = guild.channels.cache;

                switch (filterType) {
                    case 'text':
                        channels = channels.filter(c => c.type === ChannelType.GuildText || c.type === ChannelType.GuildNews);
                        break;
                    case 'voice':
                        channels = channels.filter(c => c.type === ChannelType.GuildVoice);
                        break;
                    case 'category':
                        channels = channels.filter(c => c.type === ChannelType.GuildCategory);
                        break;
                    case 'stage':
                        channels = channels.filter(c => c.type === ChannelType.GuildStageVoice);
                        break;
                    default:
                        break;
                }

                const sortedChannels = [...channels.values()].sort((a, b) => a.position - b.position);
                const totalChannels = sortedChannels.length;

                if (totalChannels === 0) {
                    return sendV2(interaction, cards.error(
                        lang.moderation.channel.noChannelsFoundTitle,
                        lang.moderation.channel.noChannelsFound
                    ));
                }

                const CHANNELS_PER_PAGE = 25;
                const totalPages = Math.ceil(totalChannels / CHANNELS_PER_PAGE);
                let currentPage = 0;

                const generatePage = (page) => {
                    const startIndex = page * CHANNELS_PER_PAGE;
                    const endIndex = Math.min(startIndex + CHANNELS_PER_PAGE, totalChannels);
                    const pageChannels = sortedChannels.slice(startIndex, endIndex);

                    const channelLines = pageChannels.map(c => {
                        const typeEmoji = c.type === ChannelType.GuildVoice ? getEmoji('voice') : c.type === ChannelType.GuildCategory ? getEmoji('folder') : getEmoji('chat');
                        return `${typeEmoji} ${c} (\`${c.id}\`)`;
                    });

                    const pageCard = buildCard({ accent: ACCENT.primary })
                        .addText(`${getEmoji('list')} **${guild.name} - Channel Directory**`)
                        .addSeparator()
                        .addText(`**Page ${page + 1}/${totalPages}** • **${totalChannels} total channels** • **Filter:** \`${filterType}\``)
                        .addSeparator()
                        .addText(channelLines.join('\n'));

                    let pagination = null;
                    if (totalPages > 1) {
                        pagination = buttonRow(
                            btn({
                                label: lang.moderation.channel.pagePrevLabel,
                                customId: 'page_prev',
                                emojiKey: 'arrleft',
                                style: ButtonStyle.Primary,
                                disabled: page === 0
                            }),
                            btn({
                                label: lang.moderation.channel.pageInfoLabel({ current: page + 1, total: totalPages }),
                                customId: 'page_info',
                                style: ButtonStyle.Secondary,
                                disabled: true
                            }),
                            btn({
                                label: lang.moderation.channel.pageNextLabel,
                                customId: 'page_next',
                                emojiKey: 'arrright',
                                style: ButtonStyle.Primary,
                                disabled: page >= totalPages - 1
                            })
                        );
                    }

                    return { pageCard, pagination };
                };

                const initial = generatePage(0);
                const response = await sendV2(
                    interaction,
                    initial.pagination ? [initial.pageCard, initial.pagination] : initial.pageCard
                );

                if (totalPages > 1 && response?.createMessageComponentCollector) {
                    const filter = i => i.user.id === sender.id;
                    const collector = response.createMessageComponentCollector({ filter, time: 300000 });

                    collector.on('collect', async i => {
                        try {
                            await deferUpdate(i);
                        } catch (ackError) {
                            console.error('[ModerationChannel] Could not acknowledge channel-list pagination:', ackError);
                            return;
                        }

                        try {
                            let newPage = currentPage;
                            if (i.customId === 'page_prev') newPage = Math.max(0, currentPage - 1);
                            if (i.customId === 'page_next') newPage = Math.min(totalPages - 1, currentPage + 1);

                            if (newPage !== currentPage) {
                                const updated = generatePage(newPage);
                                await editV2(
                                    i,
                                    updated.pagination ? [updated.pageCard, updated.pagination] : updated.pageCard
                                );
                                currentPage = newPage;
                            }
                        } catch (renderError) {
                            console.error('[ModerationChannel] Channel-list pagination failed:', renderError);
                            await i.followUp({
                                content: 'Could not update the channel list. Please try again.',
                                flags: MessageFlags.Ephemeral
                            }).catch(() => {});
                        }
                    });

                    collector.on('end', async () => {
                        try {
                            const expiredCard = cards.expired(lang.moderation.channel.listExpired);
                            await editV2(response, expiredCard);
                        } catch (_) {}
                    });
                }
                break;
            }

            case 'purge': {
                const amount = getIntegerOption('amount');
                const targetUser = getUserOption('user') || (isSlashCommand ? interaction.options.getUser('user') : null);
                const content = getStringOption('content');
                const botsOnly = isSlashCommand ? interaction.options.getBoolean('bots') : false;

                if (!amount || amount < 1 || amount > 100) {
                    return sendV2(interaction, cards.error(
                        lang.moderation.channel.invalidPurgeAmountTitle,
                        lang.moderation.channel.invalidPurgeAmount
                    ));
                }

                try {
                    const messages = await channel.messages.fetch({ limit: 100 });
                    const now = Date.now();
                    let messagesToDelete = messages.filter(msg => (now - msg.createdTimestamp) < 14 * 24 * 60 * 60 * 1000);

                    if (targetUser) {
                        messagesToDelete = messagesToDelete.filter(msg => msg.author.id === targetUser.id);
                    }
                    if (content) {
                        messagesToDelete = messagesToDelete.filter(msg => msg.content.toLowerCase().includes(content.toLowerCase()));
                    }
                    if (botsOnly) {
                        messagesToDelete = messagesToDelete.filter(msg => msg.author.bot);
                    }

                    messagesToDelete = messagesToDelete.first(amount);

                    if (!messagesToDelete || messagesToDelete.size === 0) {
                        return sendV2(interaction, cards.warning(
                            lang.moderation.channel.noMessagesToPurgeTitle,
                            lang.moderation.channel.noMessagesToPurge
                        ));
                    }

                    await channel.bulkDelete(messagesToDelete, true);

                    const card = buildCard({ accent: ACCENT.success })
                        .addText(`${getEmoji('tick')} **${lang.moderation.channel.purgeTitle}**`)
                        .addSeparator()
                        .addText(`**Channel:** ${channel}\n**Purged By:** ${sender}\n**Messages Deleted:** ${messagesToDelete.size}\n**Operation Time:** <t:${Math.floor(Date.now() / 1000)}:F>`)
                        .addSeparator()
                        .addText(lang.moderation.channel.purgeSuccess({ count: messagesToDelete.size, channel }));

                    return sendV2(interaction, card);
                } catch (error) {
                    return sendV2(interaction, cards.error(
                        lang.moderation.channel.purgeErrorTitle,
                        lang.moderation.channel.purgeError
                    ));
                }
            }

            default: {
                const card = buildCard({ accent: ACCENT.info })
                    .addText(`${getEmoji('help')} **${lang.moderation.channel.helpTitle}**`)
                    .addSeparator()
                    .addText(lang.moderation.channel.helpDescription)
                    .addSeparator()
                    .addText('**Information Commands:**\n• `info` - Comprehensive channel analytics\n• `stats` - Activity statistics\n• `list` - Interactive channel directory\n• `permissions` - Security analysis')
                    .addSeparator()
                    .addText('**Management Commands:**\n• `create` - Advanced channel creation\n• `clone` - Duplicate channel\n• `rename` - Update channel name\n• `topic` - Set channel description\n• `move` - Organize channels')
                    .addSeparator()
                    .addText('**Security Commands:**\n• `lock/unlock` - Control messaging permissions\n• `hide/unhide` - Manage channel visibility\n• `nsfw` - Toggle adult content\n• `slowmode/removeslowmode` - Rate limiting')
                    .addSeparator()
                    .addText('**Maintenance Commands:**\n• `purge` - Message cleanup\n• `delete` - Safe channel removal');

                return sendV2(interaction, card);
            }
        }
    }
};
