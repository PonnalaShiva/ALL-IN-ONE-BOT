


'use strict';

const { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    PermissionsBitField,
} = require('discord.js');
const moment = require('moment');
const checkPermissions = require('../../utils/checkPermissions');
const { 
    buildCard, 
    cards, 
    sendV2, 
    deferReply, 
    ACCENT, createInterpolatableProxy } = require('../../UI');

const rawLang = require('../../events/loadLanguage');
const lang = {
    ...rawLang,
    moderation: {
        ...rawLang.moderation,
        messages: createInterpolatableProxy(rawLang.moderation?.messages),
        common: createInterpolatableProxy(rawLang.moderation?.common),
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('messages')
        .setDescription('Advanced message management and bulk deletion tools')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageMessages)
        .addSubcommand(sub => sub.setName('usermessages').setDescription('Delete all user messages in the channel').addIntegerOption(opt => opt.setName('count').setDescription('Number of messages to delete (1-1000)').setRequired(true)))
        .addSubcommand(sub => sub.setName('specificuser').setDescription('Delete messages from a specific user').addUserOption(opt => opt.setName('user').setDescription('User whose messages will be deleted').setRequired(true)).addIntegerOption(opt => opt.setName('count').setDescription('Number of messages to delete (1-1000)').setRequired(true)))
        .addSubcommand(sub => sub.setName('botmessages').setDescription('Delete all bot messages in the channel').addIntegerOption(opt => opt.setName('count').setDescription('Number of messages to delete (1-1000)').setRequired(true)))
        .addSubcommand(sub => sub.setName('embeds').setDescription('Delete messages that contain embeds').addIntegerOption(opt => opt.setName('count').setDescription('Number of messages to delete (1-1000)').setRequired(true)))
        .addSubcommand(sub => sub.setName('links').setDescription('Delete messages that contain links').addIntegerOption(opt => opt.setName('count').setDescription('Number of messages to delete (1-1000)').setRequired(true)))
        .addSubcommand(sub => sub.setName('emojis').setDescription('Delete messages that contain emojis').addIntegerOption(opt => opt.setName('count').setDescription('Number of messages to delete (1-1000)').setRequired(true)))
        .addSubcommand(sub => sub.setName('attachments').setDescription('Delete messages containing attachments').addIntegerOption(opt => opt.setName('count').setDescription('Number of messages to scan (1-1000)').setRequired(true)))
        .addSubcommand(sub => sub.setName('mentions').setDescription('Delete messages that contain mentions').addIntegerOption(opt => opt.setName('count').setDescription('Number of messages to scan (1-1000)').setRequired(true)))
        .addSubcommand(sub => sub.setName('containsword').setDescription('Delete messages containing a specific word or phrase').addStringOption(opt => opt.setName('word').setDescription('Keyword to match in messages').setRequired(true)).addIntegerOption(opt => opt.setName('count').setDescription('Number of messages to scan (1-1000)').setRequired(true)))
        .addSubcommand(sub => sub.setName('pinned').setDescription('Delete all pinned messages').addIntegerOption(opt => opt.setName('count').setDescription('Max number of pinned messages to delete').setRequired(true)))
        .addSubcommand(sub => sub.setName('containsinvite').setDescription('Delete messages containing Discord invite links').addIntegerOption(opt => opt.setName('count').setDescription('Number of messages to scan (1-1000)').setRequired(true)))
        .addSubcommand(sub => sub.setName('startswith').setDescription('Delete messages starting with specific characters').addStringOption(opt => opt.setName('prefix').setDescription('Prefix to match').setRequired(true)).addIntegerOption(opt => opt.setName('count').setDescription('Number of messages to scan (1-1000)').setRequired(true)))
        .addSubcommand(sub => sub.setName('uppercase').setDescription('Delete messages written in full uppercase').addIntegerOption(opt => opt.setName('count').setDescription('Number of messages to scan (1-1000)').setRequired(true)))
        .addSubcommand(sub => sub.setName('lengthover').setDescription('Delete messages over a certain character length').addIntegerOption(opt => opt.setName('limit').setDescription('Character length threshold').setRequired(true)).addIntegerOption(opt => opt.setName('count').setDescription('Number of messages to scan (1-1000)').setRequired(true)))
        .addSubcommand(sub => sub.setName('reactionbased').setDescription('Delete messages with a high number of reactions').addIntegerOption(opt => opt.setName('minreactions').setDescription('Minimum reactions required').setRequired(true)).addIntegerOption(opt => opt.setName('count').setDescription('Number of messages to scan (1-1000)').setRequired(true)))
        .addSubcommand(sub => sub.setName('spam').setDescription('Delete messages identified as spam (rapid posting)').addIntegerOption(opt => opt.setName('count').setDescription('Number of messages to scan (1-1000)').setRequired(true)).addIntegerOption(opt => opt.setName('timeframe').setDescription('Time frame in seconds (default: 60)').setRequired(false)))
        .addSubcommand(sub => sub.setName('duplicates').setDescription('Delete duplicate messages in the channel').addIntegerOption(opt => opt.setName('count').setDescription('Number of messages to scan (1-1000)').setRequired(true)))
        .addSubcommand(sub => sub.setName('clean').setDescription('Comprehensive channel cleanup with multiple filters').addIntegerOption(opt => opt.setName('count').setDescription('Number of messages to scan (1-1000)').setRequired(true)).addBooleanOption(opt => opt.setName('users').setDescription('Include user messages (default: true)').setRequired(false)).addBooleanOption(opt => opt.setName('bots').setDescription('Include bot messages').setRequired(false)).addBooleanOption(opt => opt.setName('links').setDescription('Include messages with links').setRequired(false)).addBooleanOption(opt => opt.setName('embeds').setDescription('Include messages with embeds').setRequired(false)))
        .addSubcommand(sub => sub.setName('stats').setDescription('Show detailed message statistics for the channel').addIntegerOption(opt => opt.setName('count').setDescription('Number of messages to analyze (1-1000)').setRequired(false)))
        .addSubcommand(sub => sub.setName('preview').setDescription('Preview messages that would be deleted without actually deleting them').addStringOption(opt => opt.setName('filter').setDescription('Filter type to preview').setRequired(true).addChoices({ name: 'bots', value: 'bots' }, { name: 'links', value: 'links' }, { name: 'embeds', value: 'embeds' }, { name: 'mentions', value: 'mentions' })).addIntegerOption(opt => opt.setName('count').setDescription('Number of messages to preview (1-100)').setRequired(true)))
        .addSubcommand(sub => sub.setName('help').setDescription('Show comprehensive help for message management commands')),

    async execute(interaction) {
        let sender = interaction.user;
        let subcommand;
        let isSlashCommand = false;
        let channel;
        let count;
        let args = {};

        if (interaction.isCommand && interaction.isCommand()) {
            isSlashCommand = true;
            await deferReply(interaction);
            sender = interaction.user;
            subcommand = interaction.options.getSubcommand();
            channel = interaction.channel;
            count = interaction.options.getInteger('count');

            args = {
                user: interaction.options.getUser('user'),
                word: interaction.options.getString('word'),
                prefix: interaction.options.getString('prefix'),
                limit: interaction.options.getInteger('limit'),
                minreactions: interaction.options.getInteger('minreactions'),
                timeframe: interaction.options.getInteger('timeframe') || 60,
                users: interaction.options.getBoolean('users'),
                bots: interaction.options.getBoolean('bots'),
                links: interaction.options.getBoolean('links'),
                embeds: interaction.options.getBoolean('embeds'),
                filter: interaction.options.getString('filter')
            };
        } else {
            const message = interaction;
            sender = message.author;
            channel = message.channel;
            const cmdArgs = message.content.split(' ');
            cmdArgs.shift();
            subcommand = cmdArgs[0] || 'help';
            count = parseInt(cmdArgs[1], 10) || 10;
        }

        if (!await checkPermissions(interaction, 'admin')) return;

        const member = interaction.guild?.members.cache.get(sender.id) || await interaction.guild?.members.fetch(sender.id).catch(() => null);
        if (!member?.permissions.has(PermissionFlagsBits.ManageMessages)) {
            const errorCard = cards.error(
                lang.moderation.messages.accessDeniedTitle,
                lang.moderation.messages.accessDenied
            );
            return sendV2(interaction, errorCard);
        }

        if ((count < 1 || count > 1000) && subcommand !== 'help' && subcommand !== 'stats') {
            const warnCard = cards.warning(
                lang.moderation.messages.invalidParamTitle,
                lang.moderation.messages.invalidParam
            );
            return sendV2(interaction, warnCard);
        }

        const advancedBulkDelete = async (messagesToDelete) => {
            if (messagesToDelete.length === 0) return 0;
            
            let totalDeleted = 0;
            const batches = [];
            
            for (let i = 0; i < messagesToDelete.length; i += 100) {
                batches.push(messagesToDelete.slice(i, i + 100));
            }

            for (const batch of batches) {
                try {
                    const deleted = await channel.bulkDelete(batch, true);
                    totalDeleted += deleted.size;
                    
                    if (batches.length > 1 && batch !== batches[batches.length - 1]) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                } catch (error) {
                    console.error('Batch deletion error:', error);
                }
            }

            return totalDeleted;
        };

        const fetchMessages = async (limit) => {
            const messages = [];
            let lastId;
            
            while (messages.length < limit) {
                const batch = await channel.messages.fetch({ 
                    limit: Math.min(100, limit - messages.length), 
                    before: lastId 
                });
                
                if (batch.size === 0) break;
                
                messages.push(...batch.values());
                lastId = batch.last().id;
            }
            
            return messages;
        };

        try {
            if (subcommand === 'help') {
                const helpCard = buildCard({
                    accent: ACCENT.primary,
                    title: lang.moderation.messages.helpTitle,
                    body: [
                        lang.moderation.messages.helpDesc,
                        lang.moderation.messages.helpTarget,
                        lang.moderation.messages.helpContent,
                        lang.moderation.messages.helpAdvanced,
                        lang.moderation.messages.helpSmart,
                        lang.moderation.messages.helpUtility,
                        lang.moderation.messages.helpFeatures,
                        lang.moderation.messages.helpExamples({ user: sender.tag })
                    ].join('\n\n'),
                    thumbnail: sender.displayAvatarURL({ dynamic: true })
                });

                return sendV2(interaction, helpCard);
            }

            if (subcommand === 'stats') {
                const scanCount = count || 200;
                const messages = await fetchMessages(scanCount);

                const stats = {
                    total: messages.length,
                    users: messages.filter(m => !m.author.bot).length,
                    bots: messages.filter(m => m.author.bot).length,
                    embeds: messages.filter(m => m.embeds.length > 0).length,
                    attachments: messages.filter(m => m.attachments.size > 0).length,
                    links: messages.filter(m => /(https?:\/\/[^\s]+)/gi.test(m.content)).length,
                    mentions: messages.filter(m => m.mentions.users.size > 0 || m.mentions.roles.size > 0).length,
                    reactions: messages.filter(m => m.reactions.cache.size > 0).length,
                    pinned: messages.filter(m => m.pinned).length
                };

                const topUsers = [...messages.reduce((acc, msg) => {
                    const userMsgCount = acc.get(msg.author.id) || 0;
                    acc.set(msg.author.id, userMsgCount + 1);
                    return acc;
                }, new Map())].sort((a, b) => b[1] - a[1]).slice(0, 5);

                const statsCard = buildCard({
                    accent: ACCENT.info,
                    title: lang.moderation.messages.statsTitleHeader,
                    body: [
                        lang.moderation.messages.statsHeader({
                            channel: channel.name,
                            total: String(stats.total),
                            count: String(scanCount),
                            date: moment().format('MMMM Do YYYY, h:mm A')
                        }),
                        lang.moderation.messages.statsDistribution({
                            users: String(stats.users),
                            userPct: ((stats.users / (stats.total || 1)) * 100).toFixed(1),
                            bots: String(stats.bots),
                            botPct: ((stats.bots / (stats.total || 1)) * 100).toFixed(1),
                            system: String(stats.total - stats.users - stats.bots)
                        }),
                        lang.moderation.messages.statsContent({
                            embeds: String(stats.embeds),
                            attachments: String(stats.attachments),
                            links: String(stats.links),
                            mentions: String(stats.mentions)
                        }),
                        lang.moderation.messages.statsEngagement({
                            reactions: String(stats.reactions),
                            pinned: String(stats.pinned),
                            avgLength: String(Math.round(messages.reduce((acc, m) => acc + m.content.length, 0) / (stats.total || 1))),
                            activity: stats.total > 80 ? 'High' : stats.total > 40 ? 'Medium' : 'Low'
                        }),
                        lang.moderation.messages.statsTopContributors({
                            contributors: topUsers.length > 0 ? topUsers.map((user, i) => {
                                const userObj = messages.find(m => m.author.id === user[0])?.author;
                                return `${i + 1}. **${userObj?.username || 'Unknown'}** - ${user[1]} messages`;
                            }).join('\n') : 'No data available'
                        }),
                        lang.moderation.messages.statsHealth({
                            score: String(Math.min(100, Math.round((stats.total / (scanCount || 1)) * 100))),
                            diversity: stats.embeds + stats.attachments + stats.links > stats.total / 4 ? 'High' : 'Medium',
                            engagement: ((stats.reactions / (stats.total || 1)) * 100).toFixed(1),
                            spamRisk: stats.total > 90 && stats.users < 5 ? 'High' : 'Low',
                            user: sender.tag
                        })
                    ].join('\n\n'),
                    thumbnail: channel.guild?.iconURL({ dynamic: true }) || sender.displayAvatarURL({ dynamic: true })
                });

                return sendV2(interaction, statsCard);
            }

            if (subcommand === 'preview') {
                const messages = await fetchMessages(Math.min(count * 2, 200));
                let filteredMessages = [];

                switch (args.filter) {
                    case 'bots':
                        filteredMessages = messages.filter(msg => msg.author.bot);
                        break;
                    case 'links':
                        filteredMessages = messages.filter(msg => /(https?:\/\/[^\s]+)/gi.test(msg.content));
                        break;
                    case 'embeds':
                        filteredMessages = messages.filter(msg => msg.embeds.length > 0);
                        break;
                    case 'mentions':
                        filteredMessages = messages.filter(msg => msg.mentions.users.size > 0 || msg.mentions.roles.size > 0);
                        break;
                    default:
                        filteredMessages = messages;
                }

                const previewList = filteredMessages.slice(0, Math.min(count, 15));

                const previewCard = buildCard({
                    accent: ACCENT.warning,
                    title: lang.moderation.messages.previewTitleHeader,
                    body: [
                        lang.moderation.messages.previewHeader({
                            filter: args.filter,
                            found: String(filteredMessages.length),
                            showing: String(previewList.length),
                            channel: channel.name
                        }),
                        lang.moderation.messages.previewListHeader({
                            list: previewList.map(msg => `• **${msg.author.username}:** ${msg.content.substring(0, 60)}${msg.content.length > 60 ? '...' : ''}`).join('\n') || 'No messages found'
                        }),
                        lang.moderation.messages.previewFooter({ user: sender.tag })
                    ].join('\n\n'),
                    thumbnail: sender.displayAvatarURL({ dynamic: true })
                });

                return sendV2(interaction, previewCard);
            }

            const messages = await fetchMessages(Math.min(count * 2, 1000));
            let filteredMessages = [];

            switch (subcommand) {
                case 'usermessages':
                    filteredMessages = messages.filter(msg => !msg.author.bot).slice(0, count);
                    break;
                case 'specificuser':
                    if (!args.user) {
                        return sendV2(interaction, cards.error(
                            lang.moderation.messages.missingUserTitle,
                            lang.moderation.messages.missingUser
                        ));
                    }
                    filteredMessages = messages.filter(msg => msg.author.id === args.user.id).slice(0, count);
                    break;
                case 'botmessages':
                    filteredMessages = messages.filter(msg => msg.author.bot).slice(0, count);
                    break;
                case 'embeds':
                    filteredMessages = messages.filter(msg => msg.embeds.length > 0).slice(0, count);
                    break;
                case 'links':
                    filteredMessages = messages.filter(msg => /(https?:\/\/[^\s]+)/gi.test(msg.content)).slice(0, count);
                    break;
                case 'emojis':
                    filteredMessages = messages.filter(msg => /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu.test(msg.content)).slice(0, count);
                    break;
                case 'attachments':
                    filteredMessages = messages.filter(msg => msg.attachments.size > 0).slice(0, count);
                    break;
                case 'mentions':
                    filteredMessages = messages.filter(msg => msg.mentions.users.size > 0 || msg.mentions.roles.size > 0 || msg.mentions.everyone).slice(0, count);
                    break;
                case 'containsword':
                    if (!args.word) {
                        return sendV2(interaction, cards.error(
                            lang.moderation.messages.missingWordTitle,
                            lang.moderation.messages.missingWord
                        ));
                    }
                    filteredMessages = messages.filter(msg => msg.content.toLowerCase().includes(args.word.toLowerCase())).slice(0, count);
                    break;
                case 'pinned':
                    filteredMessages = messages.filter(msg => msg.pinned).slice(0, count);
                    break;
                case 'containsinvite':
                    filteredMessages = messages.filter(msg => /(discord\.gg|discordapp\.com\/invite|discord\.com\/invite)/i.test(msg.content)).slice(0, count);
                    break;
                case 'startswith':
                    if (!args.prefix) {
                        return sendV2(interaction, cards.error(
                            lang.moderation.messages.missingPrefixTitle,
                            lang.moderation.messages.missingPrefix
                        ));
                    }
                    filteredMessages = messages.filter(msg => msg.content.startsWith(args.prefix)).slice(0, count);
                    break;
                case 'uppercase':
                    filteredMessages = messages.filter(msg => msg.content === msg.content.toUpperCase() && msg.content.length > 4 && /[A-Z]/.test(msg.content)).slice(0, count);
                    break;
                case 'lengthover':
                    if (!args.limit) {
                        return sendV2(interaction, cards.error(
                            lang.moderation.messages.missingLimitTitle,
                            lang.moderation.messages.missingLimit
                        ));
                    }
                    filteredMessages = messages.filter(msg => msg.content.length > args.limit).slice(0, count);
                    break;
                case 'reactionbased':
                    if (!args.minreactions) {
                        return sendV2(interaction, cards.error(
                            lang.moderation.messages.missingMinReactionsTitle,
                            lang.moderation.messages.missingMinReactions
                        ));
                    }
                    filteredMessages = messages.filter(msg => msg.reactions.cache.reduce((sum, r) => sum + r.count, 0) >= args.minreactions).slice(0, count);
                    break;
                case 'spam': {
                    const timeThreshold = Date.now() - (args.timeframe * 1000);
                    const userMessageCounts = new Map();

                    messages.forEach(msg => {
                        if (msg.createdTimestamp > timeThreshold) {
                            const userCount = userMessageCounts.get(msg.author.id) || 0;
                            userMessageCounts.set(msg.author.id, userCount + 1);
                        }
                    });

                    const spamUsers = [...userMessageCounts.entries()].filter(([, userCount]) => userCount > 5).map(([id]) => id);
                    filteredMessages = messages.filter(msg => spamUsers.includes(msg.author.id) && msg.createdTimestamp > timeThreshold).slice(0, count);
                    break;
                }
                case 'duplicates': {
                    const contentMap = new Map();
                    const duplicateMessages = [];

                    messages.forEach(msg => {
                        const content = msg.content.trim().toLowerCase();
                        if (content && content.length > 5) {
                            if (contentMap.has(content)) {
                                duplicateMessages.push(msg);
                            } else {
                                contentMap.set(content, msg);
                            }
                        }
                    });

                    filteredMessages = duplicateMessages.slice(0, count);
                    break;
                }
                case 'clean': {
                    const cleanFilters = [];
                    
                    if (args.users !== false) { 
                        cleanFilters.push(msg => !msg.author.bot);
                    }
                    
                    if (args.bots === true) cleanFilters.push(msg => msg.author.bot);
                    if (args.links === true) cleanFilters.push(msg => /(https?:\/\/[^\s]+)/gi.test(msg.content));
                    if (args.embeds === true) cleanFilters.push(msg => msg.embeds.length > 0);
                
                    if (cleanFilters.length === 0) {
                        filteredMessages = messages.filter(msg => 
                            !msg.author.bot || 
                            msg.author.bot || 
                            /(https?:\/\/[^\s]+)/gi.test(msg.content) || 
                            msg.embeds.length > 0 
                        ).slice(0, count);
                    } else {
                        filteredMessages = messages.filter(msg => cleanFilters.some(filter => filter(msg))).slice(0, count);
                    }
                    break;
                }
                default:
                    return sendV2(interaction, cards.error(
                        lang.moderation.messages.unknownCommandTitle,
                        lang.moderation.messages.unknownCommand({ command: subcommand })
                    ));
            }

            if (!filteredMessages || filteredMessages.length === 0) {
                const noMessagesCard = cards.warning(
                    lang.moderation.messages.noMessagesFoundHeader,
                    [
                        lang.moderation.messages.noMessagesFoundDetails({
                            filter: subcommand,
                            scanned: String(messages.length),
                            channel: channel.name
                        }),
                        lang.moderation.messages.noMessagesFoundFooter({ user: sender.tag })
                    ].join('\n\n')
                );

                return sendV2(interaction, noMessagesCard);
            }

            const deletedCount = await advancedBulkDelete(filteredMessages);

            const successCard = buildCard({
                accent: ACCENT.success,
                title: lang.moderation.messages.cleanupSuccessTitle,
                body: [
                    lang.moderation.messages.cleanupSuccessHeader({
                        operation: subcommand,
                        count: String(deletedCount),
                        channel: channel.name,
                        user: sender.tag
                    }),
                    lang.moderation.messages.cleanupSuccessFeatures({
                        batches: String(Math.ceil(deletedCount / 100)),
                        filter: subcommand
                    }),
                    lang.moderation.messages.cleanupSuccessDetails({
                        filter: subcommand,
                        processed: String(filteredMessages.length),
                        deleted: String(deletedCount),
                        time: moment().format('MMMM Do YYYY, h:mm:ss A')
                    }),
                    lang.moderation.messages.cleanupSuccessFooter({ user: sender.tag })
                ].join('\n\n'),
                thumbnail: sender.displayAvatarURL({ dynamic: true })
            });

            return sendV2(interaction, successCard);

        } catch (error) {
            console.error('Error during message deletion:', error);
            
            const errorCard = cards.error(
                lang.moderation.messages.errorTitle,
                [
                    lang.moderation.messages.errorDetails({ error: error.message || 'Unknown error' }),
                    lang.moderation.messages.errorTroubleshooting,
                    lang.moderation.messages.errorFooter({ user: sender.tag })
                ].join('\n\n')
            );

            return sendV2(interaction, errorCard);
        }
    }
};