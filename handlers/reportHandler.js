


'use strict';

const ReportService = require('../services/ReportService');
const Report = require('../models/reportSystem/Report');
const { isReportModeratorAction, canManageReports } = require('../utils/reportAuthorization');
const { getReportSettings, getReportCache, invalidateReport } = require('../utils/cacheHelpers');
const { getEmoji, getButtonEmoji } = require('../UI/emojis/emoji');
const { buildCard, cards, sendV2, replyEphemeral, ACCENT } = require('../UI');
const loadLanguage = require('../events/loadLanguage');
const {
    ModalBuilder,
    TextInputBuilder,
    ActionRowBuilder,
    TextInputStyle,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    SectionBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    PermissionsBitField,
    MessageFlags
} = require('discord.js');

const inFlightInteractions = new Set();

async function handleComponent(interaction) {
    if (!interaction.guild) return;

    const lockKey = `${interaction.user.id}:${interaction.customId}`;
    if (inFlightInteractions.has(lockKey)) {
        return;
    }
    inFlightInteractions.add(lockKey);

    const guildId = interaction.guild.id;
    const lang = loadLanguage(guildId).report;

    try {
        if (isReportModeratorAction(interaction) && !canManageReports(interaction, PermissionsBitField.Flags.ManageMessages)) {
            return await replyEphemeral(interaction, cards.error(lang.permissionDeniedTitle, lang.managePermission));
        }

        if (interaction.isModalSubmit() && interaction.customId.startsWith('report_modal_')) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            
            const customIdParts = interaction.customId.split('_');
            const userId = customIdParts[2];
            const messageId = customIdParts[customIdParts.length - 1];
            const categoryParts = customIdParts.slice(3, -1);
            const category = categoryParts.join('_');

            const reason = interaction.fields.getTextInputValue('reason');
            const additionalInfo = interaction.fields.getTextInputValue('additional_info') || '';

            const reportedUser = await interaction.client.users.fetch(userId).catch(() => null);
            if (!reportedUser) {
                const card = cards.error(lang.errorTitle, lang.userNotFound);
                return await sendV2(interaction, card);
            }

            let evidence = {};
            if (messageId && messageId !== 'none' && /^\d{17,19}$/.test(messageId)) {
                try {
                    const message = await interaction.channel.messages.fetch(messageId).catch(() => null);
                    if (message) {
                        evidence = {
                            messageId: message.id,
                            messageContent: message.content,
                            channelId: message.channel.id,
                            channelName: message.channel.name,
                            attachments: message.attachments.map(att => att.url)
                        };
                    }
                } catch (e) {
                    
                }
            }

            const fullReason = additionalInfo ? `${reason}\n\nAdditional Info: ${additionalInfo}` : reason;

            const result = await ReportService.createReport({
                guildId,
                reportedUser,
                reporter: interaction.user,
                reason: fullReason,
                category,
                evidence,
                client: interaction.client
            });

            if (result.success) {
                const aiDesc = result.report.aiAnalysis?.analyzed ?
                    `${result.report.aiAnalysis.severity.toUpperCase()} (${Math.round(result.report.aiAnalysis.confidence * 100)}%)` :
                    'Automated Analysis In Progress';

                const card = buildCard({
                    title: `${getEmoji('tick')} ${lang.submittedTitle}`,
                    description: [
                        `**Case ID:** \`${result.report.reportId}\``,
                        `**Reported User:** <@${reportedUser.id}> (\`${reportedUser.tag || reportedUser.username}\`)`,
                        `**Category:** \`${category.toUpperCase()}\``,
                        `**Priority:** \`${result.report.priority.toUpperCase()}\``,
                        `**AI Assessment:** ${aiDesc}`,
                        '',
                        `### ${getEmoji('document')} Stated Reason`,
                        `> ${reason.length > 300 ? reason.substring(0, 297) + '...' : reason}`,
                        '',
                        `*${lang.card?.detailsTitle}*`
                    ].join('\n'),
                    accentColor: ACCENT.success
                });

                return await sendV2(interaction, card);
            } else {
                const card = cards.error(lang.errorTitle, result.message || lang.submitFailed);
                return await sendV2(interaction, card);
            }
        }

        else if (interaction.isModalSubmit() && interaction.customId.startsWith('add_note_')) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const reportId = interaction.customId.replace('add_note_', '');
            const noteContent = interaction.fields.getTextInputValue('note');

            const report = await Report.findOne({ reportId, guildId });
            if (!report) {
                const card = cards.error(lang.errorTitle, lang.reportNotFound);
                return await sendV2(interaction, card);
            }

            report.moderatorNotes.push({
                moderatorId: interaction.user.id,
                moderatorName: interaction.user.username,
                note: noteContent,
                timestamp: new Date()
            });
            await report.save();
            invalidateReport(reportId, guildId);

            const card = cards.success(
                lang.noteAddedTitle,
                lang.noteAdded ? lang.noteAdded.replace('{id}', reportId) : `Note added to report **${reportId}**`
            );
            return await sendV2(interaction, card);
        }

        else if (interaction.isModalSubmit() && interaction.customId.startsWith('resolve_modal_')) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const reportId = interaction.customId.replace('resolve_modal_', '');
            const resolutionDetails = interaction.fields.getTextInputValue('resolution_details');

            const report = await Report.findOne({ reportId, guildId });
            if (!report) {
                const card = cards.error(lang.errorTitle, lang.reportNotFound);
                return await sendV2(interaction, card);
            }

            if (report.status === 'resolved' || report.status === 'dismissed') {
                const card = cards.info(
                    lang.caseClosedTitle,
                    lang.alreadyCompleted ?
                        lang.alreadyCompleted.replace('{id}', reportId).replace('{status}', report.status) :
                        `Report **${reportId}** is already ${report.status}!`
                );
                return await sendV2(interaction, card);
            }

            report.status = 'resolved';
            report.resolution = {
                action: 'other',
                details: resolutionDetails,
                resolvedBy: interaction.user.username,
                resolvedAt: new Date()
            };
            await report.save();
            invalidateReport(reportId, guildId);

            await ReportService.updateReportMessage(report, interaction.client);

            try {
                const reportedUser = await interaction.client.users.fetch(report.reportedUser.userId).catch(() => null);
                const reporter = await interaction.client.users.fetch(report.reporter.userId).catch(() => null);

                if (reportedUser) {
                    await ReportService.sendResolvedDM(reportedUser, report, interaction.guild, {
                        action: 'resolved',
                        details: resolutionDetails,
                        resolvedBy: interaction.user.username
                    });
                }
                if (reporter) {
                    await ReportService.sendResolvedReporterDM(reporter, report, interaction.guild, {
                        action: 'resolved',
                        details: resolutionDetails,
                        resolvedBy: interaction.user.username
                    });
                }
            } catch (dmErr) {
                
            }

            const card = buildCard({
                title: `${getEmoji('tick')} ${lang.resolvedTitle}`,
                description: [
                    lang.resolvedDesc ? lang.resolvedDesc.replace('{id}', reportId) : `Report **${reportId}** has been resolved.`,
                    '',
                    `**Resolution Details:** ${resolutionDetails.substring(0, 500)}`,
                    `**Resolved By:** <@${interaction.user.id}>`
                ].join('\n'),
                accentColor: ACCENT.success
            });

            return await sendV2(interaction, card);
        }

        else if (interaction.isButton() && interaction.customId.startsWith('report_')) {
            if (!canManageReports(interaction, PermissionsBitField.Flags.ManageMessages)) {
                const card = cards.error(lang.permissionDeniedTitle, lang.managePermission);
                return await replyEphemeral(interaction, card);
            }

            const parts = interaction.customId.split('_');
            const action = parts[1];
            const reportId = parts[2];

            if (action === 'info') {
                const card = cards.info(lang.caseClosedTitle, lang.caseClosedNotice);
                return await replyEphemeral(interaction, card);
            }

            if (action === 'resolve') {
                const modal = new ModalBuilder()
                    .setCustomId(`resolve_modal_${reportId}`)
                    .setTitle((lang.resolveModalTitle).slice(0, 45))
                    .addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('resolution_details')
                                .setLabel(lang.resolveDetailsLabel)
                                .setStyle(TextInputStyle.Paragraph)
                                .setPlaceholder(lang.resolveDetailsPlaceholder)
                                .setRequired(true)
                                .setMaxLength(500)
                        )
                    );
                return await interaction.showModal(modal);
            }

            if (!['claim', 'escalate', 'dismiss', 'timeout', 'ban'].includes(action)) {
                return await replyEphemeral(interaction, cards.error(lang.errorTitle, 'Unknown report action.'));
            }

            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const report = await Report.findOne({ reportId, guildId });
            if (!report) {
                const card = cards.error(lang.errorTitle, lang.reportNotFound);
                return await sendV2(interaction, card);
            }

            if (report.status === 'resolved' || report.status === 'dismissed') {
                await ReportService.updateReportMessage(report, interaction.client);
                const card = cards.info(
                    lang.caseClosedTitle,
                    lang.alreadyCompleted ?
                        lang.alreadyCompleted.replace('{id}', reportId).replace('{status}', report.status) :
                        `Report **${reportId}** is already **${report.status}**.`
                );
                return await sendV2(interaction, card);
            }

            switch (action) {
                case 'claim': {
                    if (report.assignedModerator?.userId) {
                        const card = cards.warning(
                            lang.alreadyClaimedTitle,
                            lang.alreadyClaimed ?
                                lang.alreadyClaimed.replace('{moderator}', report.assignedModerator.username) :
                                `Report already claimed by **${report.assignedModerator.username}**`
                        );
                        return await sendV2(interaction, card);
                    }

                    report.assignedModerator = {
                        userId: interaction.user.id,
                        username: interaction.user.username,
                        assignedAt: new Date()
                    };
                    report.status = 'under_review';
                    await report.save();
                    invalidateReport(reportId, guildId);

                    await ReportService.updateReportMessage(report, interaction.client);

                    try {
                        const reporter = await interaction.client.users.fetch(report.reporter.userId).catch(() => null);
                        if (reporter) {
                            await ReportService.sendClaimedDM(reporter, report, interaction.guild, interaction.user);
                        }
                    } catch (e) {
                        
                    }

                    const card = cards.success(
                        lang.reportClaimedTitle,
                        lang.claimSuccess ?
                            lang.claimSuccess.replace('{id}', reportId) :
                            `You have claimed report **${reportId}**.`
                    );
                    return await sendV2(interaction, card);
                }

                case 'resolve': {
                    
                    
                    break;
                }

                case 'escalate': {
                    report.status = 'escalated';
                    report.priority = 'urgent';
                    await report.save();
                    invalidateReport(reportId, guildId);

                    await ReportService.updateReportMessage(report, interaction.client);

                    const settings = await getReportSettings(guildId);
                    if (settings?.channels?.alertsChannel) {
                        const alertChannel = interaction.guild.channels.cache.get(settings.channels.alertsChannel);
                        if (alertChannel) {
                            await alertChannel.send({
                                content: `@everyone ${getEmoji('fire')} **${lang.escalatedAlertHeader}** — ${lang.escalatedAlertNotice}`,
                                allowedMentions: { parse: ['everyone'] }
                            }).catch(() => {});
                            const alertContainer = ReportService.createAlertContainer(report);
                            await alertChannel.send({
                                components: [alertContainer],
                                flags: MessageFlags.IsComponentsV2
                            }).catch(() => {});
                        }
                    }

                    const card = cards.warning(
                        lang.escalatedTitle,
                        lang.escalatedDesc ?
                            lang.escalatedDesc.replace('{id}', reportId) :
                            `Report **${reportId}** has been escalated to **URGENT** priority!`
                    );
                    return await sendV2(interaction, card);
                }

                case 'dismiss': {
                    const container = new ContainerBuilder()
                        .setAccentColor(ACCENT.warning);

                    container.addSectionComponents(
                        new SectionBuilder().addTextDisplayComponents(
                            new TextDisplayBuilder().setContent([
                                `# ${getEmoji('cross')} ${lang.dismissConfirmTitle}`,
                                '',
                                `Are you sure you want to dismiss report **${report.reportId}**?`,
                                `**Target:** <@${report.reportedUser.userId}> (\`${report.reportedUser.username}\`)`,
                                `**Stated Reason:** ${report.reason.substring(0, 150)}${report.reason.length > 150 ? '...' : ''}`
                            ].join('\n'))
                        )
                    );

                    const confirmBtn = new ButtonBuilder()
                        .setCustomId(`confirm_dismiss_${report.reportId}`)
                        .setLabel(lang.buttons?.confirmDismiss)
                        .setStyle(ButtonStyle.Danger);
                    const confirmEmoji = getButtonEmoji('tick');
                    if (confirmEmoji) confirmBtn.setEmoji(confirmEmoji);

                    const cancelBtn = new ButtonBuilder()
                        .setCustomId(`cancel_dismiss_${report.reportId}`)
                        .setLabel(lang.buttons?.cancel)
                        .setStyle(ButtonStyle.Secondary);
                    const cancelEmoji = getButtonEmoji('cross');
                    if (cancelEmoji) cancelBtn.setEmoji(cancelEmoji);

                    container.addActionRowComponents(new ActionRowBuilder().addComponents(confirmBtn, cancelBtn));

                    return await interaction.editReply({
                        components: [container],
                        flags: MessageFlags.IsComponentsV2
                    });
                }

                case 'timeout': {
                    const container = new ContainerBuilder()
                        .setAccentColor(ACCENT.warning);

                    container.addSectionComponents(
                        new SectionBuilder().addTextDisplayComponents(
                            new TextDisplayBuilder().setContent([
                                `# ${getEmoji('time')} ${lang.timeoutConfirmTitle}`,
                                '',
                                `Are you sure you want to timeout **${report.reportedUser.username}**?`,
                                `**Case ID:** \`${report.reportId}\``,
                                `**Duration:** \`10 minutes\``
                            ].join('\n'))
                        )
                    );

                    const confirmBtn = new ButtonBuilder()
                        .setCustomId(`confirm_timeout_${report.reportId}`)
                        .setLabel(lang.buttons?.confirmTimeout)
                        .setStyle(ButtonStyle.Danger);
                    const confirmEmoji = getButtonEmoji('time');
                    if (confirmEmoji) confirmBtn.setEmoji(confirmEmoji);

                    const cancelBtn = new ButtonBuilder()
                        .setCustomId(`cancel_timeout_${report.reportId}`)
                        .setLabel(lang.buttons?.cancel)
                        .setStyle(ButtonStyle.Secondary);
                    const cancelEmoji = getButtonEmoji('cross');
                    if (cancelEmoji) cancelBtn.setEmoji(cancelEmoji);

                    container.addActionRowComponents(new ActionRowBuilder().addComponents(confirmBtn, cancelBtn));

                    return await interaction.editReply({
                        components: [container],
                        flags: MessageFlags.IsComponentsV2
                    });
                }

                case 'ban': {
                    const container = new ContainerBuilder()
                        .setAccentColor(ACCENT.danger);

                    container.addSectionComponents(
                        new SectionBuilder().addTextDisplayComponents(
                            new TextDisplayBuilder().setContent([
                                `# ${getEmoji('security')} ${lang.banConfirmTitle}`,
                                '',
                                `${getEmoji('warning')} **${lang.banConfirmDesc ? lang.banConfirmDesc.replace('{user}', report.reportedUser.username).replace('{id}', report.reportId).replace('{category}', report.category.toUpperCase()) : `This action cannot be undone!\n\nAre you sure you want to BAN **${report.reportedUser.username}**?\n\n**Case ID:** \`${report.reportId}\`\n**Violation:** \`${report.category.toUpperCase()}\``}`
                            ].join('\n'))
                        )
                    );

                    const confirmBtn = new ButtonBuilder()
                        .setCustomId(`confirm_ban_${report.reportId}`)
                        .setLabel(lang.buttons?.confirmBan)
                        .setStyle(ButtonStyle.Danger);
                    const confirmEmoji = getButtonEmoji('security');
                    if (confirmEmoji) confirmBtn.setEmoji(confirmEmoji);

                    const cancelBtn = new ButtonBuilder()
                        .setCustomId(`cancel_ban_${report.reportId}`)
                        .setLabel(lang.buttons?.cancel)
                        .setStyle(ButtonStyle.Secondary);
                    const cancelEmoji = getButtonEmoji('cross');
                    if (cancelEmoji) cancelBtn.setEmoji(cancelEmoji);

                    container.addActionRowComponents(new ActionRowBuilder().addComponents(confirmBtn, cancelBtn));

                    return await interaction.editReply({
                        components: [container],
                        flags: MessageFlags.IsComponentsV2
                    });
                }
            }
        }

        else if (interaction.isButton() && interaction.customId.startsWith('confirm_dismiss_')) {
            await interaction.deferUpdate();

            const reportId = interaction.customId.replace('confirm_dismiss_', '');
            const report = await Report.findOne({ reportId, guildId });

            if (!report) {
                const card = cards.error(lang.errorTitle, lang.reportNotFound);
                return await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
            }

            if (report.status === 'resolved' || report.status === 'dismissed') {
                const card = cards.info(lang.caseClosedTitle, (lang.alreadyCompleted).replace('{id}', report.reportId || report._id).replace('{status}', report.status));
                return await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
            }

            report.status = 'dismissed';
            report.resolution = {
                action: 'none',
                details: 'Report dismissed - no action needed',
                resolvedBy: interaction.user.username,
                resolvedAt: new Date()
            };
            await report.save();
            invalidateReport(reportId, guildId);

            await ReportService.updateReportMessage(report, interaction.client);

            try {
                const reportedUser = await interaction.client.users.fetch(report.reportedUser.userId).catch(() => null);
                const reporter = await interaction.client.users.fetch(report.reporter.userId).catch(() => null);

                if (reportedUser) await ReportService.sendDismissedDM(reportedUser, report, interaction.guild, 'No action needed');
                if (reporter) await ReportService.sendDismissedReporterDM(reporter, report, interaction.guild, 'No action needed');
            } catch (e) {
                
            }

            const card = buildCard({
                title: `${getEmoji('tick')} ${lang.dismissConfirmTitle}`,
                description: lang.dismissSuccess ?
                    lang.dismissSuccess.replace('{id}', report.reportId) :
                    `Report **${report.reportId}** has been dismissed.`,
                accentColor: ACCENT.success
            });

            return await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
        }

        else if (interaction.isButton() && interaction.customId.startsWith('confirm_timeout_')) {
            await interaction.deferUpdate();

            const reportId = interaction.customId.replace('confirm_timeout_', '');
            const report = await Report.findOne({ reportId, guildId });

            if (!report) {
                const card = cards.error(lang.errorTitle, lang.reportNotFound);
                return await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
            }

            if (report.status === 'resolved' || report.status === 'dismissed') {
                const card = cards.info(lang.caseClosedTitle, (lang.alreadyCompleted).replace('{id}', report.reportId || report._id).replace('{status}', report.status));
                return await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
            }

            const member = await interaction.guild.members.fetch(report.reportedUser.userId).catch(() => null);
            if (!member) {
                const card = cards.error(lang.errorTitle, lang.userNotInGuild);
                return await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
            }

            const timeoutDuration = 10 * 60 * 1000;
            await member.timeout(timeoutDuration, `Report: ${report.reportId} - ${report.category}`);

            report.status = 'resolved';
            report.resolution = {
                action: 'timeout',
                details: '10 minute timeout applied',
                resolvedBy: interaction.user.username,
                resolvedAt: new Date()
            };
            await report.save();
            invalidateReport(reportId, guildId);

            await ReportService.updateReportMessage(report, interaction.client);

            try {
                const reportedUser = await interaction.client.users.fetch(report.reportedUser.userId).catch(() => null);
                const reporter = await interaction.client.users.fetch(report.reporter.userId).catch(() => null);

                await ReportService.sendTimeoutDMs(reportedUser, reporter, report, interaction.guild, timeoutDuration);
            } catch (e) {
                
            }

            const card = buildCard({
                title: `${getEmoji('time')} ${lang.timeoutConfirmTitle}`,
                description: lang.timeoutSuccess ?
                    lang.timeoutSuccess.replace('{user}', report.reportedUser.username) :
                    `**${report.reportedUser.username}** has been timed out for 10 minutes.`,
                accentColor: ACCENT.success
            });

            return await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
        }

        else if (interaction.isButton() && interaction.customId.startsWith('confirm_ban_')) {
            await interaction.deferUpdate();

            const reportId = interaction.customId.replace('confirm_ban_', '');
            const report = await Report.findOne({ reportId, guildId });

            if (!report) {
                const card = cards.error(lang.errorTitle, lang.reportNotFound);
                return await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
            }

            if (report.status === 'resolved' || report.status === 'dismissed') {
                const card = cards.info(lang.caseClosedTitle, (lang.alreadyCompleted).replace('{id}', report.reportId || report._id).replace('{status}', report.status));
                return await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
            }

            try {
                const userToBan = await interaction.client.users.fetch(report.reportedUser.userId).catch(() => null);
                if (userToBan) {
                    const dmContainer = new ContainerBuilder().setAccentColor(ACCENT.danger);
                    dmContainer.addTextDisplayComponents(
                        new TextDisplayBuilder().setContent([
                            `# ${getEmoji('security')} You Have Been Banned`,
                            `### Server: **${interaction.guild.name}**`,
                            '',
                            `> You were banned following a report violation review.`,
                            '',
                            `**Case ID:** \`${report.reportId}\``,
                            `**Reason:** ${report.category}`
                        ].join('\n'))
                    );
                    await userToBan.send({ components: [dmContainer], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
                }
            } catch (e) {
                
            }

            await interaction.guild.members.ban(report.reportedUser.userId, {
                reason: `Report: ${report.reportId} - ${report.category}`,
                deleteMessageSeconds: 86400
            });

            report.status = 'resolved';
            report.resolution = {
                action: 'ban',
                details: 'User banned from server',
                resolvedBy: interaction.user.username,
                resolvedAt: new Date()
            };
            await report.save();
            invalidateReport(reportId, guildId);

            await ReportService.updateReportMessage(report, interaction.client);

            const card = buildCard({
                title: `${getEmoji('security')} ${lang.banConfirmTitle}`,
                description: lang.banSuccess ?
                    lang.banSuccess.replace('{user}', report.reportedUser.username) :
                    `**${report.reportedUser.username}** has been banned from the server.`,
                accentColor: ACCENT.danger
            });

            return await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
        }

        else if (interaction.isButton() && (
            interaction.customId.startsWith('cancel_dismiss_') ||
            interaction.customId.startsWith('cancel_timeout_') ||
            interaction.customId.startsWith('cancel_ban_') ||
            interaction.customId.startsWith('cancel_')
        )) {
            await interaction.deferUpdate();

            const card = cards.info(
                lang.actionCancelledTitle,
                lang.actionCancelledDesc
            );
            return await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
        }

    } catch (error) {
        console.error('[ReportHandler] Error processing interaction:', error);
        const card = cards.error(
            lang.errorTitle,
            lang.reportError
        );

        if (!interaction.replied && !interaction.deferred) {
            await replyEphemeral(interaction, card);
        } else {
            await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
        }
    } finally {
        inFlightInteractions.delete(lockKey);
    }
}


module.exports = () => {};

module.exports.handleComponent = handleComponent;
