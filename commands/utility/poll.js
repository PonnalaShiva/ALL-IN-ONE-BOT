
'use strict';

const { SlashCommandBuilder } = require('@discordjs/builders');
const {
    PermissionFlagsBits,
    MessageFlags,
} = require('discord.js');
const cmdIcons = require('../../UI/icons/commandicons');
const { getEmoji } = require('../../UI/emojis/emoji');
const rawLang = require('../../events/loadLanguage');
const checkPermissions = require('../../utils/checkPermissions');
const { buildCard, cards, sendV2, deferReply, ACCENT, createInterpolatableProxy } = require('../../UI');

const lang = { ...rawLang, poll: createInterpolatableProxy(rawLang.poll) };

const activePolls = new Map();
const pollVotes = new Map();
const pollTimers = new Map();
const retentionTimers = new Map();
const pollListenersByClient = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('createpoll')
        .setDescription('Create clean polls with emoji reactions and V2 display')
        .addStringOption(option =>
            option.setName('question')
                .setDescription('The poll question')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('options')
                .setDescription('Number of options (2-10)')
                .setRequired(true)
                .setMinValue(2)
                .setMaxValue(10))
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Channel to send the poll to')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('duration')
                .setDescription('Poll duration in minutes (default: 60, max: 1440)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(1440))
        .addBooleanOption(option =>
            option.setName('anonymous')
                .setDescription('Hide detailed voter info (default: false)')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('option1')
                .setDescription('First option')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('option2')
                .setDescription('Second option')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('option3')
                .setDescription('Third option')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('option4')
                .setDescription('Fourth option')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('option5')
                .setDescription('Fifth option')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('option6')
                .setDescription('Sixth option')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('option7')
                .setDescription('Seventh option')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('option8')
                .setDescription('Eighth option')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('option9')
                .setDescription('Ninth option')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('option10')
                .setDescription('Tenth option')
                .setRequired(false)),

    async execute(interaction) {
        if (interaction.isCommand && interaction.isCommand()) {
            await deferReply(interaction);

            if (!await checkPermissions(interaction)) return;

            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
                return await sendV2(
                    interaction,
                    cards.error(lang.poll.error.permissionTitle, lang.poll.error.permissionDesc)
                );
            }

            const question = interaction.options.getString('question');
            const numOptions = interaction.options.getInteger('options');
            const channel = interaction.options.getChannel('channel');
            const duration = interaction.options.getInteger('duration') || 60;
            const anonymous = interaction.options.getBoolean('anonymous') || false;
            const sender = interaction.user;

            const options = [];
            for (let i = 1; i <= numOptions; i++) {
                const option = interaction.options.getString(`option${i}`);
                if (option && option.trim()) {
                    options.push(option.trim());
                }
            }

            while (options.length < numOptions) {
                if (options.length === 0) options.push(lang.poll.display.yes.replace(/^[^\w]+/, '').trim());
                else if (options.length === 1) options.push(lang.poll.display.no.replace(/^[^\w]+/, '').trim());
                else options.push(lang.poll.display.defaultOption.replace('{number}', options.length + 1));
            }

            const pollId = `poll-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const endTime = Date.now() + (duration * 60000);

            const pollData = {
                id: pollId,
                question: question,
                options: options,
                creator: sender.id,
                creatorTag: sender.tag,
                channel: channel.id,
                guild: interaction.guild.id,
                startTime: Date.now(),
                endTime: endTime,
                duration: duration,
                anonymous: anonymous,
                active: true,
                messageId: null,
                client: interaction.client,
                reactionEmojis: ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'].slice(0, options.length)
            };

            activePolls.set(pollId, pollData);
            pollVotes.set(pollId, new Map());

            try {
                const pollContainer = this.createPollDisplay(pollId);

                const pollMessage = await channel.send({
                    components: [pollContainer],
                    flags: MessageFlags.IsComponentsV2
                });

                const poll = activePolls.get(pollId);
                for (const emoji of poll.reactionEmojis) {
                    await pollMessage.react(emoji);
                }

                poll.messageId = pollMessage.id;
                activePolls.set(pollId, poll);

                const expiryTimer = setTimeout(async () => {
                    pollTimers.delete(pollId);
                    if (activePolls.has(pollId) && activePolls.get(pollId).active) {
                        await this.closePoll(pollId, 'expired');
                    }
                }, duration * 60000);
                expiryTimer.unref?.();
                pollTimers.set(pollId, expiryTimer);

                this.setupPollEventListeners(interaction.client);

                const successCard = buildCard({
                    title: lang.poll.success.title,
                    sections: [
                        lang.poll.success.info({
                            question,
                            channel: channel.name,
                            duration
                        }),
                        `**${lang.poll.success.optionsHeading}**\n${options.map((opt, i) => `${poll.reactionEmojis[i]} **${opt}**`).join('\n')}\n\n**${lang.poll.success.optionsFooter}**`,
                        lang.poll.success.settings({
                            duration,
                            anonymous: anonymous ? lang.poll.success.enabled : lang.poll.success.disabled,
                            endTime: Math.floor(endTime / 1000),
                            pollId: pollId.split('-').pop()
                        })
                    ],
                    thumbnailURL: sender.displayAvatarURL({ dynamic: true }),
                    accentColor: ACCENT.success
                });

                await sendV2(interaction, successCard);

            } catch (error) {
                console.error('Poll creation error:', error);
                await sendV2(
                    interaction,
                    cards.error(lang.poll.error.createFailedTitle, lang.poll.error.createFailedDesc)
                );
            }

        } else {
            const helpCard = buildCard({
                title: lang.poll.help.title,
                sections: [lang.poll.help.content],
                accentColor: ACCENT.primary
            });

            await sendV2(interaction, helpCard);
        }
    },

    setupPollEventListeners(client) {
        if (pollListenersByClient.has(client)) return;

        const onReactionAdd = async (reaction, user) => {
            if (user.bot) return;

            if (reaction.partial) {
                try {
                    await reaction.fetch();
                } catch {
                    return;
                }
            }
            if (reaction.message?.partial) {
                try {
                    await reaction.message.fetch();
                } catch {
                    return;
                }
            }

            const messageId = reaction.message.id;
            const emoji = reaction.emoji.name;

            for (const [pollId, poll] of activePolls.entries()) {
                if (poll.messageId === messageId && poll.active && poll.reactionEmojis.includes(emoji)) {
                    const newOptionIndex = poll.reactionEmojis.indexOf(emoji);
                    const votes = pollVotes.get(pollId);
                    const previousVote = votes.get(user.id);

                    if (previousVote !== undefined && previousVote !== newOptionIndex) {
                        try {
                            const previousEmoji = poll.reactionEmojis[previousVote];
                            const previousReaction = reaction.message.reactions.cache.get(previousEmoji);
                            if (previousReaction) {
                                await previousReaction.users.remove(user.id);
                            }
                        } catch (error) {
                            console.error('Error removing previous reaction:', error);
                        }
                    }

                    votes.set(user.id, newOptionIndex);
                    await this.updatePollDisplay(pollId);
                    break;
                }
            }
        };

        const onReactionRemove = async (reaction, user) => {
            if (user.bot) return;

            if (reaction.partial) {
                try {
                    await reaction.fetch();
                } catch {
                    return;
                }
            }
            if (reaction.message?.partial) {
                try {
                    await reaction.message.fetch();
                } catch {
                    return;
                }
            }

            const messageId = reaction.message.id;
            const emoji = reaction.emoji.name;

            for (const [pollId, poll] of activePolls.entries()) {
                if (poll.messageId === messageId && poll.active && poll.reactionEmojis.includes(emoji)) {
                    const optionIndex = poll.reactionEmojis.indexOf(emoji);
                    const votes = pollVotes.get(pollId);

                    if (votes.has(user.id) && votes.get(user.id) === optionIndex) {
                        votes.delete(user.id);
                        await this.updatePollDisplay(pollId);
                    }
                    break;
                }
            }
        };
        client.on('messageReactionAdd', onReactionAdd);
        client.on('messageReactionRemove', onReactionRemove);
        pollListenersByClient.set(client, { onReactionAdd, onReactionRemove });
    },

    createPollDisplay(pollId) {
        const poll = activePolls.get(pollId);
        const votes = pollVotes.get(pollId);

        if (!poll || !votes) {
            return cards.error(
                lang.poll.error.dataUnavailableTitle,
                lang.poll.error.dataUnavailableDesc
            );
        }

        const voteCounts = Array(poll.options.length).fill(0);
        for (const [, optionIndex] of votes.entries()) {
            voteCounts[optionIndex]++;
        }

        const totalVotes = voteCounts.reduce((sum, count) => sum + count, 0);
        const maxVotes = Math.max(...voteCounts, 1);

        const optionsDisplay = poll.options.map((option, index) => {
            const voteCount = voteCounts[index];
            const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
            const barLength = Math.round((voteCount / maxVotes) * 15);
            const progressBar = voteCount > 0 ? '█'.repeat(barLength) + '░'.repeat(15 - barLength) : '░'.repeat(15);
            const emoji = poll.reactionEmojis[index];

            return `${emoji} **${option}**\n\`${progressBar}\` ${voteCount} votes • ${percentage}%`;
        }).join('\n\n');

        const timeRemaining = poll.active ? Math.max(0, Math.floor((poll.endTime - Date.now()) / 60000)) : 0;
        const statusText = poll.active
            ? lang.poll.display.statusActive({ timeRemaining })
            : lang.poll.display.statusClosed;

        return buildCard({
            title: lang.poll.display.liveTitle,
            sections: [
                lang.poll.display.sectionText({
                    question: poll.question,
                    statusText,
                    totalVotes,
                    participants: votes.size,
                }),
                `**${lang.poll.display.voteHeading}**\n\n${optionsDisplay}`,
                lang.poll.display.howToVote({
                    duration: poll.duration,
                    anonymous: poll.anonymous ? lang.poll.display.yes : lang.poll.display.no,
                    endTime: Math.floor(poll.endTime / 1000)
                })
            ],
            thumbnailURL: cmdIcons.PollIcon,
            accentColor: poll.active ? ACCENT.primary : ACCENT.neutral,
            footer: lang.poll.display.createdBy({
                creator: poll.creatorTag,
                pollId: pollId.split('-').pop()
            })
        });
    },

    async updatePollDisplay(pollId) {
        const poll = activePolls.get(pollId);
        if (!poll || !poll.messageId || !poll.client) return;

        try {
            const guild = await poll.client.guilds.fetch(poll.guild);
            const channel = await guild.channels.fetch(poll.channel);
            const message = await channel.messages.fetch(poll.messageId);

            const updatedContainer = this.createPollDisplay(pollId);

            await message.edit({
                components: [updatedContainer],
                flags: MessageFlags.IsComponentsV2
            });
        } catch (error) {
            console.error('Error updating poll:', error);
        }
    },

    async closePoll(pollId, reason = 'manual') {
        const poll = activePolls.get(pollId);
        if (!poll || !poll.active) return;

        poll.active = false;
        activePolls.set(pollId, poll);

        const votes = pollVotes.get(pollId);
        const voteCounts = Array(poll.options.length).fill(0);

        for (const [, optionIndex] of votes.entries()) {
            voteCounts[optionIndex]++;
        }

        const totalVotes = voteCounts.reduce((sum, count) => sum + count, 0);
        const maxVotes = Math.max(...voteCounts);
        const winners = poll.options.filter((_, index) => voteCounts[index] === maxVotes);
        const winnerText = maxVotes === 0 ? lang.poll.display.noVotes :
            winners.length === 1 ? winners[0] :
                lang.poll.display.tie({ winners: winners.join(', ') });

        const medalEmoji = getEmoji('medal');
        const resultsDisplay = poll.options.map((option, index) => {
            const voteCount = voteCounts[index];
            const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
            const isWinner = voteCount === maxVotes && maxVotes > 0;
            const emoji = isWinner ? medalEmoji : poll.reactionEmojis[index];
            return `${emoji} **${option}:** ${voteCount} votes (${percentage}%)`;
        }).join('\n');

        const finalContainer = buildCard({
            title: lang.poll.display.closedTitle,
            sections: [
                lang.poll.display.finalWinner({
                    question: poll.question,
                    winner: winnerText,
                    totalVotes,
                    participants: votes.size
                }),
                `**${lang.poll.display.finalResultsHeading}**\n\n${resultsDisplay}`
            ],
            thumbnailURL: cmdIcons.PollIcon,
            accentColor: ACCENT.danger,
            footer: lang.poll.display.closedFooter({
                creator: poll.creatorTag,
                time: Math.floor(Date.now() / 1000)
            })
        });

        await this.updatePollDisplayWithContainer(pollId, finalContainer);

        const expiryTimer = pollTimers.get(pollId);
        if (expiryTimer) clearTimeout(expiryTimer);
        pollTimers.delete(pollId);

        const retentionTimer = setTimeout(() => {
            retentionTimers.delete(pollId);
            activePolls.delete(pollId);
            pollVotes.delete(pollId);
        }, 60 * 60 * 1000);
        retentionTimer.unref?.();
        retentionTimers.set(pollId, retentionTimer);
    },

    stop() {
        for (const [client, listeners] of pollListenersByClient) {
            client.off('messageReactionAdd', listeners.onReactionAdd);
            client.off('messageReactionRemove', listeners.onReactionRemove);
        }
        pollListenersByClient.clear();
        for (const timer of pollTimers.values()) clearTimeout(timer);
        for (const timer of retentionTimers.values()) clearTimeout(timer);
        pollTimers.clear();
        retentionTimers.clear();
        activePolls.clear();
        pollVotes.clear();
    },

    async updatePollDisplayWithContainer(pollId, container) {
        const poll = activePolls.get(pollId);
        if (!poll || !poll.messageId || !poll.client) return;

        try {
            const guild = await poll.client.guilds.fetch(poll.guild);
            const channel = await guild.channels.fetch(poll.channel);
            const message = await channel.messages.fetch(poll.messageId);

            await message.edit({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });
        } catch (error) {
            console.error('Error updating poll container:', error);
        }
    }
};


