

'use strict';

const {
    SlashCommandBuilder,
    PermissionsBitField,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
} = require('discord.js');
const ReportService = require('../../services/ReportService');
const Report = require('../../models/reportSystem/Report');
const ReportSettings = require('../../models/reportSystem/ReportSettings');
const checkPermissions = require('../../utils/checkPermissions');
const { runWithinAcknowledgementWindow } = require('../../utils/interactionRouter');
const { getEmoji } = require('../../UI/emojis/emoji');
const {
    buildCard,
    cards,
    sendV2,
    deferReply,
    replyEphemeral,
    ACCENT, createInterpolatableProxy } = require('../../UI');

const rawLang = require('../../events/loadLanguage');
const lang = {
    ...rawLang,
    moderation: {
        ...rawLang.moderation,
        report: createInterpolatableProxy(rawLang.moderation?.report),
        common: createInterpolatableProxy(rawLang.moderation?.common),
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('report')
        .setDescription('Advanced user reporting system')
        .addSubcommand(subcommand =>
            subcommand
                .setName('user')
                .setDescription('Report a user for violations')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to report')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('category')
                        .setDescription('Report category')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Spam', value: 'spam' },
                            { name: 'Harassment', value: 'harassment' },
                            { name: 'Inappropriate Content', value: 'inappropriate_content' },
                            { name: 'Hate Speech', value: 'hate_speech' },
                            { name: 'Doxxing', value: 'doxxing' },
                            { name: 'Impersonation', value: 'impersonation' },
                            { name: 'Self Harm', value: 'self_harm' },
                            { name: 'Malicious Links', value: 'malicious_links' },
                            { name: 'Raid Behavior', value: 'raid_behavior' },
                            { name: 'Other', value: 'other' }
                        ))
                .addStringOption(option =>
                    option.setName('message_id')
                        .setDescription('Message ID as evidence (optional)')
                        .setRequired(false)
                        .setMaxLength(20)))

        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('View reports for a user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to view reports for')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('status')
                        .setDescription('Filter by status')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Pending', value: 'pending' },
                            { name: 'Under Review', value: 'under_review' },
                            { name: 'Resolved', value: 'resolved' },
                            { name: 'Dismissed', value: 'dismissed' },
                            { name: 'Escalated', value: 'escalated' }
                        )))

        .addSubcommand(subcommand =>
            subcommand
                .setName('manage')
                .setDescription('Manage a specific report')
                .addStringOption(option =>
                    option.setName('report_id')
                        .setDescription('Report ID to manage')
                        .setRequired(true)
                        .setMaxLength(80))
                .addStringOption(option =>
                    option.setName('action')
                        .setDescription('Action to take')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Claim', value: 'claim' },
                            { name: 'Resolve', value: 'resolve' },
                            { name: 'Dismiss', value: 'dismiss' },
                            { name: 'Escalate', value: 'escalate' },
                            { name: 'Add Note', value: 'note' }
                        )))

        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('View server report statistics')
                .addStringOption(option =>
                    option.setName('period')
                        .setDescription('Time period')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Today', value: 'day' },
                            { name: 'This Week', value: 'week' },
                            { name: 'This Month', value: 'month' }
                        )))

        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Configure report system settings')
                .addChannelOption(option =>
                    option.setName('reports_channel')
                        .setDescription('Channel for report notifications')
                        .setRequired(false))
                .addChannelOption(option =>
                    option.setName('alerts_channel')
                        .setDescription('Channel for urgent alerts')
                        .setRequired(false))
                .addBooleanOption(option =>
                    option.setName('ai_analysis')
                        .setDescription('Enable AI analysis')
                        .setRequired(false))),

    async execute(interaction) {
        if (!(typeof interaction.isChatInputCommand === 'function' ? interaction.isChatInputCommand() : interaction.isCommand?.())) {
            return await replyEphemeral(interaction, cards.error(lang.moderation.report.errorTitle, lang.moderation.report.slashOnly));
        }

        const subcommand = interaction.options.getSubcommand();
        const manageAction = subcommand === 'manage' ? interaction.options.getString('action') : null;
        const isManageNote = manageAction === 'note';

        if (subcommand !== 'user' && !isManageNote) {
            await deferReply(interaction);
        }

        if (isManageNote) {
            const reportId = interaction.options.getString('report_id');
            const prepared = await runWithinAcknowledgementWindow(
                interaction,
                async () => {
                    const admin = await checkPermissions.hasPermission(interaction, 'admin');
                    if (!admin) return { denied: 'admin' };
                    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) return { denied: 'manage-messages' };
                    const report = await Report.findOne({ reportId, guildId: interaction.guild.id });
                    return { report };
                },
                'Report details are taking too long to load. Please try again shortly.'
            );
            if (!prepared.completed) return;
            if (prepared.value.denied === 'admin') {
                return replyEphemeral(interaction, 'You need administrator access to manage reports.');
            }
            if (prepared.value.denied === 'manage-messages') {
                return replyEphemeral(interaction, cards.error('Permission Denied', lang.moderation.report.managePermission));
            }
            if (!prepared.value.report) {
                return replyEphemeral(interaction, cards.error('Not Found', lang.moderation.report.reportNotFound));
            }
            return this.handleManageReport(interaction, { preloadedReport: prepared.value.report });
        }

        if (subcommand !== 'user' && !await checkPermissions(interaction, 'admin')) return;

        try {
            switch (subcommand) {
                case 'user':
                    await this.handleUserReport(interaction);
                    break;
                case 'view':
                    await this.handleViewReports(interaction);
                    break;
                case 'manage':
                    await this.handleManageReport(interaction);
                    break;
                case 'stats':
                    await this.handleStats(interaction);
                    break;
                case 'setup':
                    await this.handleSetup(interaction);
                    break;
                default: {
                    const card = cards.error(lang.moderation.report.errorTitle, lang.moderation.report.unknownSubcommand);
                    return await sendV2(interaction, card);
                }
            }
        } catch (error) {
            console.error('[Report] Error:', error);
            const card = cards.error(lang.moderation.report.errorTitle, error.message || lang.moderation.report.reportError);
            return await sendV2(interaction, card);
        }
    },

    async handleUserReport(interaction) {
        const user = interaction.options.getUser('user');
        const category = interaction.options.getString('category');
        const messageId = interaction.options.getString('message_id');

        if (user.id === interaction.user.id) {
            const card = cards.error('Invalid Target', lang.moderation.report.cannotReportSelf);
            return await replyEphemeral(interaction, card);
        }

        if (user.bot) {
            const card = cards.error('Invalid Target', lang.moderation.report.cannotReportBot);
            return await replyEphemeral(interaction, card);
        }

        const modal = new ModalBuilder()
            .setCustomId(`report_modal_${user.id}_${category}_${messageId || 'none'}`)
            .setTitle(lang.moderation.report.modalTitle({ user: user.username }).slice(0, 45))
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('reason')
                        .setLabel(lang.moderation.report.reasonLabel())
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder(lang.moderation.report.reasonPlaceholder())
                        .setRequired(true)
                        .setMaxLength(1000)
                ),
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('additional_info')
                        .setLabel(lang.moderation.report.contextLabel())
                        .setStyle(TextInputStyle.Paragraph)
                        .setPlaceholder(lang.moderation.report.contextPlaceholder())
                        .setRequired(false)
                        .setMaxLength(500)
                )
            );

        await interaction.showModal(modal);
    },

    async handleViewReports(interaction) {
        const user = interaction.options.getUser('user');
        const statusFilter = interaction.options.getString('status');

        const query = {
            guildId: interaction.guild.id,
            'reportedUser.userId': user.id
        };

        if (statusFilter) {
            query.status = statusFilter;
        }

        const reports = await Report.find(query)
            .sort({ 'timestamps.createdAt': -1 })
            .limit(10);

        if (!reports.length) {
            const card = cards.info(
                'Reports',
                lang.moderation.report.noReportsFound({
                    user: user.tag,
                    statusFilter: statusFilter ? ` with status "${statusFilter}"` : ''
                })
            );
            return await sendV2(interaction, card);
        }

        const reportList = reports.map((report) => {
            const icon = report.status === 'resolved' ? getEmoji('tick')
                : report.status === 'dismissed' ? getEmoji('cross')
                    : report.status === 'under_review' ? getEmoji('help')
                        : getEmoji('warning');

            return `${icon} **${report.reportId}**\n` +
                `**Category:** ${report.category}\n` +
                `**Status:** ${report.status}\n` +
                `**Priority:** ${report.priority}\n` +
                `**Created:** <t:${Math.floor(report.timestamps.createdAt.getTime() / 1000)}:R>\n` +
                `**AI Score:** ${report.aiAnalysis?.riskScore || 'N/A'}/100`;
        });

        const card = buildCard({
            title: `${getEmoji('document')} ${lang.moderation.report.viewTitle({ user: user.tag })}`,
            description: reportList.join('\n\n'),
            accentColor: ACCENT.info
        });

        return await sendV2(interaction, card);
    },

    async handleManageReport(interaction, { preloadedReport = null } = {}) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            const card = cards.error('Permission Denied', lang.moderation.report.managePermission);
            return await replyEphemeral(interaction, card);
        }

        const reportId = interaction.options.getString('report_id');
        const action = interaction.options.getString('action');

        if (action !== 'note' && !interaction.deferred && !interaction.replied) {
            await deferReply(interaction);
        }

        let report = preloadedReport;
        if (report) {
            
        } else if (action === 'note') {
            const lookup = await runWithinAcknowledgementWindow(
                interaction,
                () => Report.findOne({ reportId, guildId: interaction.guild.id }),
                'Report details are taking too long to load. Please try again shortly.'
            );
            if (!lookup.completed) return;
            report = lookup.value;
        } else {
            report = await Report.findOne({ reportId, guildId: interaction.guild.id });
        }

        if (!report) {
            const notFoundCard = cards.error('Not Found', lang.moderation.report.reportNotFound);
            if (action === 'note') {
                return await replyEphemeral(interaction, notFoundCard);
            } else {
                return await sendV2(interaction, notFoundCard);
            }
        }

        switch (action) {
            case 'claim': {
                report.assignedModerator = {
                    userId: interaction.user.id,
                    username: interaction.user.username,
                    assignedAt: new Date()
                };
                report.status = 'under_review';
                await report.save();

                const card = cards.success('Report Claimed', lang.moderation.report.claimed({ id: reportId }));
                return await sendV2(interaction, card);
            }

            case 'resolve': {
                report.status = 'resolved';
                report.resolution = {
                    action: 'other',
                    details: 'Resolved via command',
                    resolvedBy: interaction.user.id,
                    resolvedAt: new Date()
                };
                await report.save();

                const card = cards.success('Report Resolved', lang.moderation.report.resolved({ id: reportId }));
                return await sendV2(interaction, card);
            }

            case 'dismiss': {
                report.status = 'dismissed';
                report.resolution = {
                    action: 'none',
                    details: 'Dismissed - no action needed',
                    resolvedBy: interaction.user.id,
                    resolvedAt: new Date()
                };
                await report.save();

                const card = cards.info('Report Dismissed', lang.moderation.report.dismissed({ id: reportId }));
                return await sendV2(interaction, card);
            }

            case 'escalate': {
                report.status = 'escalated';
                report.priority = 'urgent';
                await report.save();

                const card = cards.warning('Report Escalated', lang.moderation.report.escalated({ id: reportId }));
                return await sendV2(interaction, card);
            }

            case 'note': {
                const modal = new ModalBuilder()
                    .setCustomId(`add_note_${reportId}`)
                    .setTitle(lang.moderation.report.noteModalTitle().slice(0, 45))
                    .addComponents(
                        new ActionRowBuilder().addComponents(
                            new TextInputBuilder()
                                .setCustomId('note')
                                .setLabel(lang.moderation.report.noteLabel())
                                .setStyle(TextInputStyle.Paragraph)
                                .setRequired(true)
                                .setMaxLength(500)
                        )
                    );

                await interaction.showModal(modal);
                return;
            }
        }
    },

    async handleStats(interaction) {
        const period = interaction.options.getString('period') || 'week';
        const stats = await ReportService.getReportStats(interaction.guild.id, period);

        const fields = [
            `**${lang.moderation.report.totalReports}:** ${stats.totalReports}`,
            `**${lang.moderation.report.pendingReports}:** ${stats.pendingReports}`,
            `**${lang.moderation.report.resolvedReports}:** ${stats.resolvedReports}`,
            `**${lang.moderation.report.avgConfidence}:** ${Math.round(stats.avgConfidence * 100)}%`,
            `**${lang.moderation.report.avgRiskScore}:** ${Math.round(stats.avgRiskScore)}/100`,
            `**${lang.moderation.report.resolutionRate}:** ${stats.totalReports > 0 ? `${Math.round((stats.resolvedReports / stats.totalReports) * 100)}%` : '0%'}`
        ].join('\n');

        const card = buildCard({
            title: `${getEmoji('analytics')} ${lang.moderation.report.statsTitle({ period: period.charAt(0).toUpperCase() + period.slice(1) })}`,
            description: `${fields}\n\n*Server: ${interaction.guild.name}*`,
            accentColor: ACCENT.danger
        });

        return await sendV2(interaction, card);
    },

    async handleSetup(interaction) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            const card = cards.error('Permission Denied', lang.moderation.common.manageServerRequired);
            return await sendV2(interaction, card);
        }

        const reportsChannel = interaction.options.getChannel('reports_channel');
        const alertsChannel = interaction.options.getChannel('alerts_channel');
        const aiAnalysis = interaction.options.getBoolean('ai_analysis');

        let settings = await ReportSettings.findOne({ guildId: interaction.guild.id });

        if (!settings) {
            settings = new ReportSettings({ guildId: interaction.guild.id });
        }

        let changes = [];

        if (reportsChannel) {
            settings.channels.reportsChannel = reportsChannel.id;
            changes.push(`Reports channel: ${reportsChannel}`);
        }

        if (alertsChannel) {
            settings.channels.alertsChannel = alertsChannel.id;
            changes.push(`Alerts channel: ${alertsChannel}`);
        }

        if (aiAnalysis !== null) {
            settings.autoModeration.aiAnalysis = aiAnalysis;
            changes.push(`AI Analysis: ${aiAnalysis ? 'Enabled' : 'Disabled'}`);
        }

        await settings.save();

        
        const { invalidateReportSettings } = require('../../utils/cacheHelpers');
        invalidateReportSettings(interaction.guild.id);

        const card = cards.success(
            lang.moderation.report.setupSuccess,
            changes.length ? changes.join('\n') : lang.moderation.report.noChanges
        );

        return await sendV2(interaction, card);
    },

    handleComponent: (interaction) => require('../../handlers/reportHandler').handleComponent(interaction)
};
