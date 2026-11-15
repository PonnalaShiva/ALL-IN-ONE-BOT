

'use strict';

const {
    SlashCommandBuilder,
    ActionRowBuilder,
    ButtonStyle,
    MessageFlags
} = require('discord.js');

const Suggestion = require('../../models/suggestions/Suggestion');
const SuggestionVote = require('../../models/suggestions/SuggestionVote');
const { getSuggestionConfig } = require('../../utils/cacheHelpers');
const { getEmoji } = require('../../UI/emojis/emoji');
const rawLang = require('../../events/loadLanguage');
const { buildCard, cards, btn, sendV2, deferReply, ACCENT, createInterpolatableProxy } = require('../../UI');

const lang = { ...rawLang, suggestion: createInterpolatableProxy(rawLang.suggestion) };

module.exports = {
    data: new SlashCommandBuilder()
        .setName('suggestion')
        .setDescription('Manage suggestions')
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Submit a suggestion')
                .addStringOption(opt =>
                    opt.setName('title').setDescription('Suggestion title').setMaxLength(256).setRequired(true))
                .addStringOption(opt =>
                    opt.setName('description').setDescription('Suggestion details').setMaxLength(4000).setRequired(true))
        )
        .addSubcommand(sub =>
            sub.setName('status')
                .setDescription('Update the status of a suggestion')
                .addStringOption(opt =>
                    opt.setName('message_id').setDescription('Message ID of the suggestion').setMaxLength(20).setRequired(true))
                .addStringOption(opt =>
                    opt.setName('status')
                        .setDescription('New status')
                        .addChoices(
                            { name: 'Approved', value: 'approved' },
                            { name: 'Denied', value: 'denied' },
                            { name: 'Under Review', value: 'review' },
                            { name: 'Pending', value: 'pending' }
                        )
                        .setRequired(true))
                .addStringOption(opt =>
                    opt.setName('reason').setDescription('Optional reason for status change').setMaxLength(1000))
        )
        .addSubcommand(sub =>
            sub.setName('delete')
                .setDescription('Delete a suggestion')
                .addStringOption(opt =>
                    opt.setName('message_id').setDescription('Message ID of the suggestion').setMaxLength(20).setRequired(true))
        ),

    async execute(interaction) {
        try {
            const sub = interaction.options.getSubcommand();
            await deferReply(interaction, true);

            const guildId = interaction.guild.id;

            if (sub === 'add') {
                const config = await getSuggestionConfig(guildId);
                if (!config || !config.suggestionChannelId) {
                    return await sendV2(interaction, cards.error(
                        lang.suggestion.error.notConfiguredTitle({ emoji: getEmoji('cross') }),
                        lang.suggestion.error.notConfiguredDesc
                    ));
                }

                const allowedRoleId = config.allowedRoleId;
                if (allowedRoleId && !interaction.member.roles.cache.has(allowedRoleId)) {
                    return await sendV2(interaction, cards.error(
                        lang.suggestion.error.permRequiredTitle({ emoji: getEmoji('cross') }),
                        lang.suggestion.error.permRequiredRoleDesc({ roleId: allowedRoleId })
                    ));
                }

                const title = interaction.options.getString('title');
                const description = interaction.options.getString('description');

                if (!title || title.trim().length === 0) {
                    return await sendV2(interaction, cards.error(
                        lang.suggestion.error.invalidTitleTitle({ emoji: getEmoji('cross') }),
                        lang.suggestion.error.invalidTitleDesc
                    ));
                }
                if (!description || description.trim().length === 0) {
                    return await sendV2(interaction, cards.error(
                        lang.suggestion.error.invalidDescTitle({ emoji: getEmoji('cross') }),
                        lang.suggestion.error.invalidDescDesc
                    ));
                }
                if (title.length > 256) {
                    return await sendV2(interaction, cards.error(
                        lang.suggestion.error.titleTooLongTitle({ emoji: getEmoji('cross') }),
                        lang.suggestion.error.titleTooLongDesc
                    ));
                }
                if (description.length > 4000) {
                    return await sendV2(interaction, cards.error(
                        lang.suggestion.error.descTooLongTitle({ emoji: getEmoji('cross') }),
                        lang.suggestion.error.descTooLongDesc
                    ));
                }

                const suggestionChannel = interaction.guild.channels.cache.get(config.suggestionChannelId);
                if (!suggestionChannel || !suggestionChannel.isTextBased()) {
                    return await sendV2(interaction, cards.error(
                        lang.suggestion.error.channelErrorTitle({ emoji: getEmoji('warning') }),
                        lang.suggestion.error.channelErrorDesc
                    ));
                }

                const btnRow = new ActionRowBuilder().addComponents(
                    btn(lang.suggestion.card.btnYes({ count: 0 }), 'suggestion_yes', 'tick', ButtonStyle.Success),
                    btn(lang.suggestion.card.btnNo({ count: 0 }), 'suggestion_no', 'cross', ButtonStyle.Danger),
                );

                const cardContainer = buildCard({
                    title: lang.suggestion.card.title({ emoji: getEmoji('sparkles'), title: title.trim() }),
                    sections: [
                        description.trim(),
                        lang.suggestion.card.submittedBy({
                            userId: interaction.user.id,
                            statusEmoji: getEmoji('time'),
                            status: lang.suggestion.card.statusPending,
                            reason: '',
                            yesEmoji: getEmoji('tick'),
                            yesVotes: 0,
                            noEmoji: getEmoji('cross'),
                            noVotes: 0,
                        })
                    ],
                    thumbnailURL: interaction.user.displayAvatarURL({ dynamic: true }),
                    rows: [btnRow],
                    accentColor: ACCENT.info,
                });

                const msg = await suggestionChannel.send({
                    components: [cardContainer],
                    flags: MessageFlags.IsComponentsV2
                }).catch(err => {
                    console.error('[Suggestion] Error sending suggestion message:', err);
                    throw err;
                });

                try {
                    await Suggestion.create({
                        guildId,
                        userId: interaction.user.id,
                        messageId: msg.id,
                        channelId: suggestionChannel.id,
                        title: title.trim(),
                        description: description.trim(),
                        status: 'pending'
                    });
                } catch (error) {
                    await msg.delete().catch(() => { });
                    throw error;
                }

                return await sendV2(interaction, cards.success(
                    lang.suggestion.success.submittedTitle({ emoji: getEmoji('tick') }),
                    lang.suggestion.success.submittedDesc({ channel: suggestionChannel })
                ));
            }

            if (sub === 'status') {
                if (!interaction.member.permissions.has('ManageMessages')) {
                    return await sendV2(interaction, cards.error(
                        lang.suggestion.error.permRequiredTitle({ emoji: getEmoji('cross') }),
                        lang.suggestion.error.permManageMessagesDesc
                    ));
                }

                const messageId = interaction.options.getString('message_id');
                const newStatus = interaction.options.getString('status');
                const reason = interaction.options.getString('reason')?.slice(0, 1000) || null;

                if (!/^\d+$/.test(messageId)) {
                    return await sendV2(interaction, cards.error(
                        lang.suggestion.error.invalidMessageIdTitle({ emoji: getEmoji('cross') }),
                        lang.suggestion.error.invalidMessageIdDesc
                    ));
                }

                const suggestion = await Suggestion.findOne({ messageId, guildId });
                if (!suggestion) {
                    return await sendV2(interaction, cards.warning(
                        lang.suggestion.error.notFoundTitle({ emoji: getEmoji('warning') }),
                        lang.suggestion.error.notFoundDesc({ messageId })
                    ));
                }

                const channel = interaction.guild.channels.cache.get(suggestion.channelId);
                if (!channel || !channel.isTextBased()) {
                    return await sendV2(interaction, cards.error(
                        lang.suggestion.error.channelErrorTitle({ emoji: getEmoji('warning') }),
                        lang.suggestion.error.channelMissingDesc
                    ));
                }

                try {
                    const msg = await channel.messages.fetch(messageId).catch(() => null);
                    if (!msg) {
                        return await sendV2(interaction, cards.error(
                            lang.suggestion.error.messageNotFoundTitle({ emoji: getEmoji('cross') }),
                            lang.suggestion.error.messageNotFoundDesc
                        ));
                    }

                    const allVotes = await SuggestionVote.find({ messageId });
                    const yesVotes = allVotes.filter(v => v.vote === 'yes').length;
                    const noVotes = allVotes.filter(v => v.vote === 'no').length;

                    const statusConfigs = {
                        'approved': { color: ACCENT.success, label: lang.suggestion.card.statusApproved, emoji: getEmoji('tick') },
                        'denied': { color: ACCENT.danger, label: lang.suggestion.card.statusDenied, emoji: getEmoji('cross') },
                        'review': { color: ACCENT.warning, label: lang.suggestion.card.statusReview, emoji: getEmoji('time') },
                        'pending': { color: ACCENT.info, label: lang.suggestion.card.statusPending, emoji: getEmoji('time') }
                    };

                    const st = statusConfigs[newStatus] || statusConfigs['pending'];
                    const userObj = await interaction.client.users.fetch(suggestion.userId).catch(() => null);

                    const btnRow = new ActionRowBuilder().addComponents(
                        btn(lang.suggestion.card.btnYes({ count: yesVotes }), 'suggestion_yes', 'tick', ButtonStyle.Success, newStatus !== 'pending'),
                        btn(lang.suggestion.card.btnNo({ count: noVotes }), 'suggestion_no', 'cross', ButtonStyle.Danger, newStatus !== 'pending'),
                    );

                    const updatedCard = buildCard({
                        title: lang.suggestion.card.title({ emoji: getEmoji('sparkles'), title: suggestion.title }),
                        sections: [
                            suggestion.description,
                            lang.suggestion.card.submittedBy({
                                userId: suggestion.userId,
                                statusEmoji: st.emoji,
                                status: st.label,
                                reason: reason ? lang.suggestion.card.reasonLine({ reason }) : '',
                                yesEmoji: getEmoji('tick'),
                                yesVotes,
                                noEmoji: getEmoji('cross'),
                                noVotes,
                            })
                        ],
                        thumbnailURL: userObj ? userObj.displayAvatarURL({ dynamic: true }) : interaction.guild.iconURL({ dynamic: true }) || interaction.client.user.displayAvatarURL(),
                        rows: [btnRow],
                        accentColor: st.color,
                    });

                    suggestion.status = newStatus;
                    if (reason) suggestion.statusReason = reason;
                    suggestion.updatedAt = new Date();
                    await suggestion.save();

                    await msg.edit({ components: [updatedCard], flags: MessageFlags.IsComponentsV2 }).catch(err => {
                        console.error('[Suggestion] Error updating suggestion message:', err);
                        throw err;
                    });

                    return await sendV2(interaction, cards.success(
                        lang.suggestion.success.statusUpdatedTitle({ emoji: getEmoji('tick') }),
                        lang.suggestion.success.statusUpdatedDesc({
                            emoji: st.emoji,
                            label: st.label,
                            reason: reason ? lang.suggestion.success.reasonText({ reason }) : ''
                        })
                    ));

                } catch (err) {
                    console.error('[Suggestion] Error updating suggestion status:', err);
                    return await sendV2(interaction, cards.error(
                        lang.suggestion.error.updateErrorTitle({ emoji: getEmoji('cross') }),
                        lang.suggestion.error.updateErrorDesc
                    ));
                }
            }

            if (sub === 'delete') {
                const messageId = interaction.options.getString('message_id');

                if (!/^\d+$/.test(messageId)) {
                    return await sendV2(interaction, cards.error(
                        lang.suggestion.error.invalidMessageIdTitle({ emoji: getEmoji('cross') }),
                        lang.suggestion.error.invalidMessageIdDesc
                    ));
                }

                const suggestion = await Suggestion.findOne({ messageId, guildId });
                if (!suggestion) {
                    return await sendV2(interaction, cards.warning(
                        lang.suggestion.error.notFoundTitle({ emoji: getEmoji('warning') }),
                        lang.suggestion.error.notFoundGeneralDesc({ messageId })
                    ));
                }

                const isOwner = suggestion.userId === interaction.user.id;
                const isMod = interaction.member.permissions.has('ManageMessages');

                if (!isOwner && !isMod) {
                    return await sendV2(interaction, cards.error(
                        lang.suggestion.error.permRequiredTitle({ emoji: getEmoji('cross') }),
                        lang.suggestion.error.permDeleteDesc
                    ));
                }

                try {
                    const channel = interaction.guild.channels.cache.get(suggestion.channelId);
                    if (channel && channel.isTextBased()) {
                        try {
                            const msg = await channel.messages.fetch(messageId);
                            await msg.delete().catch(() => { });
                        } catch (_) { }
                    }

                    await Suggestion.deleteOne({ messageId });
                    await SuggestionVote.deleteMany({ messageId });

                    return await sendV2(interaction, cards.success(
                        lang.suggestion.success.deletedTitle({ emoji: getEmoji('delete') }),
                        lang.suggestion.success.deletedDesc
                    ));
                } catch (err) {
                    console.error('[Suggestion] Error deleting suggestion:', err);
                    return await sendV2(interaction, cards.error(
                        lang.suggestion.error.deleteErrorTitle({ emoji: getEmoji('cross') }),
                        lang.suggestion.error.deleteErrorDesc
                    ));
                }
            }

        } catch (error) {
            console.error('[Suggestion] Error in suggestion command:', error);
            return await sendV2(interaction, cards.error(
                lang.suggestion.error.commandErrorTitle({ emoji: getEmoji('cross') }),
                lang.suggestion.error.commandErrorDesc
            ));
        }
    }
};


