'use strict';

const Report = require('../models/reportSystem/Report');
const ReportSettings = require('../models/reportSystem/ReportSettings');
const aiManager = require('../utils/AIManager');
const { getReportSettings, invalidateReport } = require('../utils/cacheHelpers');
const { getEmoji, getButtonEmoji } = require('../UI/emojis/emoji');
const loadLanguage = require('../events/loadLanguage');
const { 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    ContainerBuilder,
    SectionBuilder,
    TextDisplayBuilder,
    ThumbnailBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags
} = require('discord.js');

class ReportService {
    mapAICategoriesToSchema(aiCategories) {
        const categoryMap = {
            'malicious': 'malicious_links',
            'malicious_content': 'inappropriate_content',
            'toxic': 'harassment',
            'offensive': 'hate_speech',
            'scam': 'malicious_links',
            'phishing': 'malicious_links',
            'inappropriate': 'inappropriate_content',
            'nsfw': 'inappropriate_content',
            'adult_content': 'inappropriate_content',
            'violence': 'inappropriate_content',
            'threats': 'harassment',
            'bullying': 'harassment',
            'discrimination': 'hate_speech'
        };
        
        return aiCategories.map(category => {
            const normalizedCategory = category.toLowerCase().replace(/[_\s-]/g, '_');
            return categoryMap[normalizedCategory] || normalizedCategory;
        }).filter(category => [
            'spam', 'harassment', 'inappropriate_content', 'hate_speech',
            'doxxing', 'impersonation', 'self_harm', 'malicious_links',
            'raid_behavior', 'other'
        ].includes(category));
    }

    validateCategory(category) {
        const validCategories = [
            'spam', 'harassment', 'inappropriate_content', 'hate_speech',
            'doxxing', 'impersonation', 'self_harm', 'malicious_links',
            'raid_behavior', 'other'
        ];
        
        const categoryMap = {
            'malicious': 'malicious_links',
            'malicious_content': 'inappropriate_content',
            'toxic': 'harassment',
            'offensive': 'hate_speech',
            'scam': 'malicious_links',
            'phishing': 'malicious_links',
            'inappropriate': 'inappropriate_content',
            'nsfw': 'inappropriate_content',
            'adult_content': 'inappropriate_content',
            'violence': 'inappropriate_content',
            'threats': 'harassment',
            'bullying': 'harassment',
            'discrimination': 'hate_speech'
        };
        
        const normalizedCategory = category.toLowerCase().replace(/[_\s-]/g, '_');
        const mappedCategory = categoryMap[normalizedCategory] || normalizedCategory;
        
        return validCategories.includes(mappedCategory) ? mappedCategory : 'other';
    }
    
    async createReport(options) {
        const {
            guildId,
            reportedUser,
            reporter,
            reason,
            category,
            evidence = {},
            client
        } = options;
        
        try {
            const validatedCategory = this.validateCategory(category);
            
            const duplicateReport = await this.checkDuplicateReports(
                guildId,
                reportedUser.id,
                reporter.id,
                reason
            );
            
            if (duplicateReport) {
                return {
                    success: false,
                    message: 'Similar report already exists',
                    existingReport: duplicateReport
                };
            }
            
            let joinedServerAt = null;
            try {
                const guild = client.guilds.cache.get(guildId);
                if (guild) {
                    const member = await guild.members.fetch(reportedUser.id).catch(() => null);
                    if (member) {
                        joinedServerAt = member.joinedAt;
                    }
                }
            } catch (e) {
                
            }
            
            const reportData = {
                guildId,
                reportedUser: {
                    userId: reportedUser.id,
                    username: reportedUser.username,
                    displayName: reportedUser.displayName,
                    avatarURL: typeof reportedUser.displayAvatarURL === 'function' ? reportedUser.displayAvatarURL() : null,
                    accountCreatedAt: reportedUser.createdAt,
                    joinedServerAt: joinedServerAt
                },
                reporter: {
                    userId: reporter.id,
                    username: reporter.username,
                    displayName: reporter.displayName,
                    avatarURL: typeof reporter.displayAvatarURL === 'function' ? reporter.displayAvatarURL() : null
                },
                reason,
                category: validatedCategory,
                evidence
            };
            
            const report = new Report(reportData);
            
            await this.performAIAnalysis(report, { reportedUser, evidence, client });
            this.setPriority(report);
            await report.save();
            
            invalidateReport(report.reportId, report.guildId);
            
            await this.sendReportNotifications(report, client);
            await this.handleAutoActions(report, client);
            
            return {
                success: true,
                report,
                message: 'Report created successfully'
            };
            
        } catch (error) {
            console.error('Error creating report:', error);
            return {
                success: false,
                message: 'Failed to create report',
                error: error.message
            };
        }
    }
    
    async performAIAnalysis(report, context) {
        try {
            const analysisPrompt = this.buildAnalysisPrompt(report, context);
            
            const analysis = await aiManager.generateContent(report.guildId, analysisPrompt, {
                timeout: 20000
            });
            
            const aiResult = this.parseAIAnalysis(analysis.text());
            
            report.aiAnalysis = {
                analyzed: true,
                confidence: aiResult.confidence,
                severity: aiResult.severity,
                autoFlags: aiResult.flags || [],
                reasoning: aiResult.reasoning,
                riskScore: aiResult.riskScore,
                categories: aiResult.categories || [],
                analyzedAt: new Date()
            };
            
        } catch (error) {
            console.error('AI analysis failed:', error);
            report.aiAnalysis = {
                analyzed: false,
                confidence: 0,
                severity: 'medium',
                autoFlags: [],
                reasoning: 'AI analysis unavailable',
                riskScore: 30,
                categories: [report.category],
                analyzedAt: new Date()
            };
        }
    }
    
    buildAnalysisPrompt(report, context) {
        return `Analyze this Discord server report and provide a structured JSON response:
        
Report Details:
- Category: ${report.category}
- Reason: ${report.reason}
- Evidence: ${report.evidence?.messageContent || 'None'}
- Reported User: ${report.reportedUser.username}
- Reporter: ${report.reporter.username}

Respond with ONLY a JSON object in this exact format:
{
    "confidence": 0.85,
    "severity": "medium",
    "riskScore": 65,
    "categories": ["harassment", "spam"],
    "reasoning": "Brief explanation of the assessment",
    "flags": ["auto_timeout", "urgent_review"]
}

Severity must be: "low", "medium", "high", or "critical"
Risk score must be 0-100
Confidence must be 0.0-1.0`;
    }
    
    parseAIAnalysis(text) {
        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                const validatedCategories = this.mapAICategoriesToSchema(parsed.categories || []);
                
                return {
                    confidence: Math.max(0, Math.min(1, parsed.confidence || 0.5)),
                    severity: ['low', 'medium', 'high', 'critical'].includes(parsed.severity) ? 
                        parsed.severity : 'medium',
                    riskScore: Math.max(0, Math.min(100, parsed.riskScore || 50)),
                    categories: validatedCategories.length > 0 ? validatedCategories : ['other'],
                    reasoning: parsed.reasoning || 'Standard report analysis',
                    flags: parsed.flags || []
                };
            }
        } catch (e) {
            console.error('Failed to parse AI response:', e);
        }
        
        return {
            confidence: 0.5,
            severity: 'medium',
            riskScore: 50,
            categories: ['other'],
            reasoning: 'Automated fallback analysis',
            flags: []
        };
    }
    
    setPriority(report) {
        const { aiAnalysis } = report;
        
        if (aiAnalysis.severity === 'critical' || aiAnalysis.riskScore >= 80) {
            report.priority = 'urgent';
        } else if (aiAnalysis.severity === 'high' || aiAnalysis.riskScore >= 60) {
            report.priority = 'high';
        } else if (aiAnalysis.severity === 'medium' || aiAnalysis.riskScore >= 40) {
            report.priority = 'medium';
        } else {
            report.priority = 'low';
        }
    }
    
    async sendReportNotifications(report, client) {
        try {
            const settings = await getReportSettings(report.guildId);
            if (!settings || !settings.channels?.reportsChannel) return;
            
            const guild = client.guilds.cache.get(report.guildId);
            if (!guild) return;
            
            const reportsChannel = guild.channels.cache.get(settings.channels.reportsChannel);
            if (!reportsChannel) return;
            
            const container = this.buildReportContainer(report);
            
            const message = await reportsChannel.send({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });
            
            report.evidence.notificationMessageId = message.id;
            await report.save();
            invalidateReport(report.reportId, report.guildId);
            
            if (report.priority === 'urgent' && settings.channels.alertsChannel) {
                const alertChannel = guild.channels.cache.get(settings.channels.alertsChannel);
                if (alertChannel) {
                    await alertChannel.send({
                        content: `@everyone ${getEmoji('warning')} **URGENT REPORT ALERT** — Immediate moderator attention required!`,
                        allowedMentions: { parse: ['everyone'] }
                    }).catch(() => {});
                    const alertContainer = this.createAlertContainer(report);
                    await alertChannel.send({
                        components: [alertContainer],
                        flags: MessageFlags.IsComponentsV2
                    });
                }
            }
            
        } catch (error) {
            console.error('Failed to send report notifications:', error);
        }
    }

    buildReportContainer(report, forceDisabled = false) {
        const priorityColors = {
            low: 0x2ecc71,
            medium: 0xf1c40f,
            high: 0xe67e22,
            urgent: 0xe74c3c
        };

        const container = new ContainerBuilder()
            .setAccentColor(priorityColors[report.priority] || 0x3498db);

        const isCompleted = ['resolved', 'dismissed'].includes(report.status);
        const statusBadge = isCompleted ? ` [${report.status.toUpperCase()}]` : '';

        
        container.addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder()
                        .setContent([
                            `# ${getEmoji('report')} Case **${report.reportId}**${statusBadge}`,
                            `### Moderation Review Hub`,
                            `> Priority: **${report.priority.toUpperCase()}** • Status: **${report.status.toUpperCase()}**`
                        ].join('\n'))
                )
                .setThumbnailAccessory(
                    new ThumbnailBuilder()
                        .setURL(report.reportedUser.avatarURL || 'https://cdn.discordapp.com/embed/avatars/0.png')
                        .setDescription(`${report.reportedUser.username} avatar`)
                )
        );

        container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

        
        const detailsLines = [
            `### ${getEmoji('user')} Target & Reporter`,
            `**Reported User:** <@${report.reportedUser.userId}> (\`${report.reportedUser.username}\`)`,
            `**Reporter:** <@${report.reporter.userId}> (\`${report.reporter.username}\`)`,
            `**Category:** \`${report.category.replace(/_/g, ' ').toUpperCase()}\``,
            `**Reported At:** <t:${Math.floor(report.timestamps.createdAt.getTime() / 1000)}:F> (<t:${Math.floor(report.timestamps.createdAt.getTime() / 1000)}:R>)`
        ];
        if (report.assignedModerator?.username) {
            detailsLines.push(`**Assigned Staff:** <@${report.assignedModerator.userId}> (\`${report.assignedModerator.username}\`)`);
        }

        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(detailsLines.join('\n')));

        container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

        
        const cleanReason = report.reason.length > 800 ? report.reason.substring(0, 797) + '...' : report.reason;
        container.addTextDisplayComponents(
            new TextDisplayBuilder()
                .setContent([
                    `### ${getEmoji('document')} Stated Violation`,
                    `> ${cleanReason}`
                ].join('\n'))
        );

        
        if (report.aiAnalysis && report.aiAnalysis.analyzed) {
            container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
            container.addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent([
                        `### ${getEmoji('bot')} AI Automated Assessment`,
                        `**Severity:** \`${report.aiAnalysis.severity.toUpperCase()}\` • **Confidence:** \`${Math.round(report.aiAnalysis.confidence * 100)}%\``,
                        `**Risk Score:** \`${report.aiAnalysis.riskScore}/100\` • **Assessment:** *${report.aiAnalysis.reasoning || 'Automated scan'}*`,
                        report.aiAnalysis.categories?.length ? `**Detected Categories:** ${report.aiAnalysis.categories.map(c => `\`${c}\``).join(', ')}` : ''
                    ].filter(Boolean).join('\n'))
            );
        }

        
        if (report.evidence && report.evidence.messageContent) {
            container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
            const cleanContent = report.evidence.messageContent.length > 400 ?
                report.evidence.messageContent.substring(0, 397) + '...' : report.evidence.messageContent;
            container.addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent([
                        `### ${getEmoji('chat')} Evidence Attached`,
                        `**Channel Context:** <#${report.evidence.channelId}>`,
                        `> ${cleanContent}`
                    ].join('\n'))
            );
        }

        
        if (isCompleted) {
            container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
            container.addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent([
                        `### ${report.status === 'resolved' ? getEmoji('tick') + ' Case Resolved' : getEmoji('cross') + ' Case Dismissed'}`,
                        `**Action:** \`${report.resolution?.action || 'None'}\' • **Moderator:** <@${report.resolution?.resolvedBy || 'System'}>`,
                        `**Details:** ${report.resolution?.details || 'No details provided'}`,
                        `**Timestamp:** <t:${Math.floor((report.resolution?.resolvedAt?.getTime() || Date.now()) / 1000)}:R>`
                    ].join('\n'))
            );
        }

        
        const buttons = this.createReportButtons(report, forceDisabled);
        container.addActionRowComponents(buttons);

        return container;
    }

    createReportComponents(report) {
        return [this.buildReportContainer(report)];
    }

    createAlertContainer(report) {
        const alertContainer = new ContainerBuilder()
            .setAccentColor(0xe74c3c);

        alertContainer.addTextDisplayComponents(
            new TextDisplayBuilder()
                .setContent([
                    `# ${getEmoji('warning')} URGENT REPORT ALERT`,
                    `### Case ID: \`${report.reportId}\``,
                    '',
                    '> **IMMEDIATE ATTENTION REQUIRED**',
                    '> High-priority report flagged by AI analysis.',
                    '',
                    `**Target:** <@${report.reportedUser.userId}> (\`${report.reportedUser.username}\`)`,
                    `**Category:** \`${report.category.toUpperCase()}\``,
                    `**AI Risk Score:** \`${report.aiAnalysis?.riskScore || 0}/100\``,
                    '',
                    `*Please review this report in the moderation channels immediately.*`
                ].join('\n'))
        );

        return alertContainer;
    }

    createAlertComponents(report) {
        return [this.createAlertContainer(report)];
    }
    
    createReportButtons(report, forceDisabled = false) {
        const isCompleted = ['resolved', 'dismissed'].includes(report.status);
        const shouldDisable = forceDisabled || isCompleted;
        
        if (isCompleted) {
            const closedBtn = new ButtonBuilder()
                .setCustomId(`report_info_${report.reportId}`)
                .setLabel('Case Closed')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true);
            const lockEmoji = getButtonEmoji('lock');
            if (lockEmoji) closedBtn.setEmoji(lockEmoji);

            return new ActionRowBuilder().addComponents(closedBtn);
        }

        const claimBtn = new ButtonBuilder()
            .setCustomId(`report_claim_${report.reportId}`)
            .setLabel('Claim')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(shouldDisable || report.status === 'under_review');
        const claimEmoji = getButtonEmoji('claim');
        if (claimEmoji) claimBtn.setEmoji(claimEmoji);

        const timeoutBtn = new ButtonBuilder()
            .setCustomId(`report_timeout_${report.reportId}`)
            .setLabel('Timeout')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(shouldDisable);
        const timeoutEmoji = getButtonEmoji('timeout');
        if (timeoutEmoji) timeoutBtn.setEmoji(timeoutEmoji);

        const resolveBtn = new ButtonBuilder()
            .setCustomId(`report_resolve_${report.reportId}`)
            .setLabel('Resolve')
            .setStyle(ButtonStyle.Success)
            .setDisabled(shouldDisable);
        const resolveEmoji = getButtonEmoji('resolve');
        if (resolveEmoji) resolveBtn.setEmoji(resolveEmoji);

        const escalateBtn = new ButtonBuilder()
            .setCustomId(`report_escalate_${report.reportId}`)
            .setLabel('Escalate')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(shouldDisable);
        const escalateEmoji = getButtonEmoji('escalate');
        if (escalateEmoji) escalateBtn.setEmoji(escalateEmoji);

        const dismissBtn = new ButtonBuilder()
            .setCustomId(`report_dismiss_${report.reportId}`)
            .setLabel('Dismiss')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(shouldDisable);
        const dismissEmoji = getButtonEmoji('dismiss');
        if (dismissEmoji) dismissBtn.setEmoji(dismissEmoji);
        
        return new ActionRowBuilder().addComponents(
            claimBtn,
            timeoutBtn,
            resolveBtn,
            escalateBtn,
            dismissBtn
        );
    }

    async sendResolvedDM(reportedUser, report, guild, resolution) {
        try {
            const lang = loadLanguage(guild?.id).report;
            const dmContainer = new ContainerBuilder()
                .setAccentColor(0x2ecc71);

            dmContainer.addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent([
                        `# ${getEmoji('tick')} ${lang.dm?.resolvedUserTitle || 'Report Resolution Notice'}`,
                        `### Server: **${guild.name}**`,
                        '',
                        `> A report concerning you has been resolved.`,
                        '',
                        `**Case ID:** \`${report.reportId}\``,
                        `**Resolution:** \`${resolution.action}\``,
                        `**Details:** ${resolution.details || 'No details provided'}`,
                        `**Handled By:** ${resolution.resolvedBy}`,
                        '',
                        `*If you have questions regarding this case, please contact server staff.*`
                    ].join('\n'))
            );

            await reportedUser.send({
                components: [dmContainer],
                flags: MessageFlags.IsComponentsV2
            });
        } catch (error) {
            console.error('Failed to send resolved DM to reported user:', error);
        }
    }

    async sendResolvedReporterDM(reporter, report, guild, resolution) {
        try {
            const lang = loadLanguage(guild?.id).report;
            const dmContainer = new ContainerBuilder()
                .setAccentColor(0x2ecc71);

            dmContainer.addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent([
                        `# ${getEmoji('tick')} ${lang.dm?.resolvedReporterTitle || 'Your Report Has Been Resolved'}`,
                        `### Server: **${guild.name}**`,
                        '',
                        `> Thank you for helping keep our community safe!`,
                        '',
                        `**Case ID:** \`${report.reportId}\``,
                        `**Action Taken:** \`${resolution.action}\``,
                        `**Details:** ${resolution.details || 'No details provided'}`,
                        `**Handled By:** ${resolution.resolvedBy}`,
                        '',
                        `*Your report has been thoroughly reviewed and resolved by staff.*`
                    ].join('\n'))
            );

            await reporter.send({
                components: [dmContainer],
                flags: MessageFlags.IsComponentsV2
            });
        } catch (error) {
            console.error('Failed to send resolved DM to reporter:', error);
        }
    }

    async sendDismissedDM(reportedUser, report, guild, reason) {
        try {
            const lang = loadLanguage(guild?.id).report;
            const dmContainer = new ContainerBuilder()
                .setAccentColor(0x95a5a6);

            dmContainer.addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent([
                        `# ${getEmoji('cross')} ${lang.dm?.dismissedUserTitle || 'Report Dismissal Notice'}`,
                        `### Server: **${guild.name}**`,
                        '',
                        `> A report concerning you has been dismissed.`,
                        '',
                        `**Case ID:** \`${report.reportId}\``,
                        `**Outcome:** Dismissed (No action needed)`,
                        `**Details:** ${reason}`,
                        '',
                        `*This matter is now concluded and the case is closed.*`
                    ].join('\n'))
            );

            await reportedUser.send({
                components: [dmContainer],
                flags: MessageFlags.IsComponentsV2
            });
        } catch (error) {
            console.error('Failed to send dismissed DM to reported user:', error);
        }
    }

    async sendDismissedReporterDM(reporter, report, guild, reason) {
        try {
            const lang = loadLanguage(guild?.id).report;
            const dmContainer = new ContainerBuilder()
                .setAccentColor(0x95a5a6);

            dmContainer.addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent([
                        `# ${getEmoji('cross')} ${lang.dm?.dismissedReporterTitle || 'Report Dismissal Notice'}`,
                        `### Server: **${guild.name}**`,
                        '',
                        `> Your report has been reviewed and dismissed.`,
                        '',
                        `**Case ID:** \`${report.reportId}\``,
                        `**Reason:** ${reason}`,
                        '',
                        `*After careful review, no rule violation was found or no further action was necessary.*`
                    ].join('\n'))
            );

            await reporter.send({
                components: [dmContainer],
                flags: MessageFlags.IsComponentsV2
            });
        } catch (error) {
            console.error('Failed to send dismissed DM to reporter:', error);
        }
    }

    async sendTimeoutDMs(reportedUser, reporter, report, guild, duration) {
        try {
            const seconds = Math.floor(duration / 1000);
            
            if (reportedUser) {
                const reportedContainer = new ContainerBuilder()
                    .setAccentColor(0xe67e22);

                reportedContainer.addTextDisplayComponents(
                    new TextDisplayBuilder()
                        .setContent([
                            `# ${getEmoji('time')} You Have Been Timed Out`,
                            `### Server: **${guild.name}**`,
                            '',
                            `> You were timed out following a moderation report review.`,
                            '',
                            `**Case ID:** \`${report.reportId}\``,
                            `**Duration:** \`${seconds} seconds\` (10 minutes)`,
                            `**Reason:** ${report.reason.substring(0, 200)}`,
                            '',
                            `*You cannot send messages or join voice channels during this timeout.*`
                        ].join('\n'))
                );

                await reportedUser.send({
                    components: [reportedContainer],
                    flags: MessageFlags.IsComponentsV2
                }).catch(() => {});
            }

            if (reporter) {
                const reporterContainer = new ContainerBuilder()
                    .setAccentColor(0x2ecc71);

                reporterContainer.addTextDisplayComponents(
                    new TextDisplayBuilder()
                        .setContent([
                            `# ${getEmoji('tick')} Action Taken on Your Report`,
                            `### Server: **${guild.name}**`,
                            '',
                            `> Action has been taken regarding your report.`,
                            '',
                            `**Case ID:** \`${report.reportId}\``,
                            `**Action Applied:** Timeout (\`${seconds} seconds\`)`,
                            '',
                            `*Thank you for helping keep **${guild.name}** safe!*`
                        ].join('\n'))
                );

                await reporter.send({
                    components: [reporterContainer],
                    flags: MessageFlags.IsComponentsV2
                }).catch(() => {});
            }

        } catch (error) {
            console.error('Failed to send timeout DMs:', error);
        }
    }

    async sendClaimedDM(reporter, report, guild, moderator) {
        try {
            const dmContainer = new ContainerBuilder()
                .setAccentColor(0x3498db);

            dmContainer.addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent([
                        `# ${getEmoji('user')} Report Under Review`,
                        `### Server: **${guild.name}**`,
                        '',
                        `> Your report is currently being investigated by staff.`,
                        '',
                        `**Case ID:** \`${report.reportId}\``,
                        `**Assigned Moderator:** **${moderator.displayName || moderator.username}**`,
                        `**Current Status:** Under Review`,
                        '',
                        `*You will receive an automated notification when the investigation is complete.*`
                    ].join('\n'))
            );

            await reporter.send({
                components: [dmContainer],
                flags: MessageFlags.IsComponentsV2
            });
        } catch (error) {
            console.error('Failed to send claimed DM:', error);
        }
    }

    async updateReportMessage(report, client) {
        try {
            const settings = await getReportSettings(report.guildId);
            if (!settings || !settings.channels?.reportsChannel) return;

            const guild = client.guilds.cache.get(report.guildId);
            if (!guild) return;

            const reportsChannel = guild.channels.cache.get(settings.channels.reportsChannel);
            if (!reportsChannel) return;

            if (!report.evidence?.notificationMessageId) return;

            const message = await reportsChannel.messages.fetch(report.evidence.notificationMessageId).catch(() => null);
            if (!message) return;

            const container = this.buildReportContainer(report);

            await message.edit({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });

            invalidateReport(report.reportId, report.guildId);
            console.log(`[ReportService] Updated Card V2 message for ${report.reportId} - Status: ${report.status}`);

        } catch (error) {
            console.error('Failed to update report message:', error);
        }
    }

    async checkDuplicateReports(guildId, reportedUserId, reporterId, reason) {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        return await Report.findOne({
            guildId,
            'reportedUser.userId': reportedUserId,
            'reporter.userId': reporterId,
            'timestamps.createdAt': { $gte: twentyFourHoursAgo },
            $or: [
                { reason: { $regex: reason.substring(0, 50), $options: 'i' } },
                { status: { $in: ['pending', 'under_review'] } }
            ]
        });
    }
    
    async handleAutoActions(report, client) {
        if (!report.aiAnalysis?.analyzed) return;
        
        const settings = await getReportSettings(report.guildId);
        if (!settings?.autoModeration?.enabled) return;
        
        const { severity, confidence, autoFlags } = report.aiAnalysis;
        const flags = autoFlags || [];
        
        if (settings.autoModeration.autoTimeout?.enabled && 
            flags.includes('auto_timeout') && 
            confidence >= 0.8) {
            
            await this.executeAutoTimeout(report, client, settings);
        }
        
        if (settings.autoModeration.autoEscalate?.enabled && 
            (severity === 'critical' || confidence >= (settings.autoModeration.autoEscalate.confidenceThreshold || 0.8))) {
            
            report.status = 'escalated';
            await report.save();
            invalidateReport(report.reportId, report.guildId);
        }
    }
    
    async executeAutoTimeout(report, client, settings) {
        try {
            const guild = client.guilds.cache.get(report.guildId);
            if (!guild) return;
            
            const member = await guild.members.fetch(report.reportedUser.userId).catch(() => null);
            if (!member) return;

            const reporter = await client.users.fetch(report.reporter.userId).catch(() => null);
            
            const duration = (settings.autoModeration.autoTimeout.duration || 300) * 1000; 
            await member.timeout(duration, `Auto-timeout: Report ${report.reportId}`);
            
            await this.sendTimeoutDMs(member.user, reporter, report, guild, duration);
            
            report.resolution = {
                action: 'timeout',
                details: `Auto-timeout: ${settings.autoModeration.autoTimeout.duration || 300}s`,
                resolvedBy: 'Auto-Moderator',
                resolvedAt: new Date()
            };
            
            report.status = 'resolved';
            await report.save();
            invalidateReport(report.reportId, report.guildId);

            await this.updateReportMessage(report, client);
            
        } catch (error) {
            console.error('Auto-timeout failed:', error);
        }
    }
    
    async getReportStats(guildId, period = 'week') {
        const startDate = new Date();
        
        switch (period) {
            case 'day':
                startDate.setDate(startDate.getDate() - 1);
                break;
            case 'week':
                startDate.setDate(startDate.getDate() - 7);
                break;
            case 'month':
                startDate.setMonth(startDate.getMonth() - 1);
                break;
        }
        
        const stats = await Report.aggregate([
            { $match: { guildId, 'timestamps.createdAt': { $gte: startDate } } },
            {
                $group: {
                    _id: null,
                    totalReports: { $sum: 1 },
                    pendingReports: {
                        $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
                    },
                    resolvedReports: {
                        $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] }
                    },
                    dismissedReports: {
                        $sum: { $cond: [{ $eq: ['$status', 'dismissed'] }, 1, 0] }
                    },
                    escalatedReports: {
                        $sum: { $cond: [{ $eq: ['$status', 'escalated'] }, 1, 0] }
                    },
                    avgConfidence: { $avg: '$aiAnalysis.confidence' },
                    avgRiskScore: { $avg: '$aiAnalysis.riskScore' }
                }
            }
        ]);
        
        return stats[0] || {
            totalReports: 0,
            pendingReports: 0,
            resolvedReports: 0,
            dismissedReports: 0,
            escalatedReports: 0,
            avgConfidence: 0,
            avgRiskScore: 0
        };
    }
    
    async getReportById(reportId, guildId) {
        return await Report.findOne({ reportId, guildId });
    }
    
    async getReportsByUser(userId, guildId, limit = 10) {
        return await Report.find({
            guildId,
            'reportedUser.userId': userId
        })
        .sort({ 'timestamps.createdAt': -1 })
        .limit(limit);
    }
    
    async updateReportStatus(reportId, guildId, status, moderatorId, client) {
        const report = await Report.findOne({ reportId, guildId });
        if (!report) return null;
        
        report.status = status;
        report.timestamps.updatedAt = new Date();
        
        if (moderatorId && !report.assignedModerator?.userId) {
            report.assignedModerator = {
                userId: moderatorId,
                assignedAt: new Date()
            };
            
            if (status === 'under_review') {
                try {
                    const reporter = await client.users.fetch(report.reporter.userId).catch(() => null);
                    const guild = client.guilds.cache.get(guildId);
                    const moderator = await client.users.fetch(moderatorId).catch(() => null);
                    
                    if (reporter && guild && moderator) {
                        await this.sendClaimedDM(reporter, report, guild, moderator);
                    }
                } catch (error) {
                    console.error('Failed to send claimed DM:', error);
                }
            }
        }
        
        await report.save();
        invalidateReport(report.reportId, report.guildId);
        
        if (['resolved', 'dismissed'].includes(status)) {
            await this.updateReportMessage(report, client);
        }
        
        return report;
    }
    
    async addModeratorNote(reportId, guildId, moderatorId, moderatorName, note) {
        const report = await Report.findOne({ reportId, guildId });
        if (!report) return null;
        
        report.moderatorNotes.push({
            moderatorId,
            moderatorName,
            note,
            timestamp: new Date()
        });
        
        await report.save();
        invalidateReport(report.reportId, report.guildId);
        return report;
    }
    
    async resolveReport(reportId, guildId, resolution, client) {
        const report = await Report.findOne({ reportId, guildId });
        if (!report) return null;
        
        report.status = 'resolved';
        report.resolution = {
            ...resolution,
            resolvedAt: new Date()
        };
        
        await report.save();
        invalidateReport(report.reportId, report.guildId);

        try {
            const reportedUser = await client.users.fetch(report.reportedUser.userId).catch(() => null);
            const reporter = await client.users.fetch(report.reporter.userId).catch(() => null);
            const guild = client.guilds.cache.get(guildId);
            
            if (guild) {
                if (reportedUser) await this.sendResolvedDM(reportedUser, report, guild, resolution);
                if (reporter) await this.sendResolvedReporterDM(reporter, report, guild, resolution);
            }
        } catch (error) {
            console.error('Failed to send resolved DMs:', error);
        }

        await this.updateReportMessage(report, client);
        return report;
    }

    async dismissReport(reportId, guildId, reason, client) {
        const report = await Report.findOne({ reportId, guildId });
        if (!report) return null;
        
        report.status = 'dismissed';
        report.resolution = {
            action: 'none',
            details: reason,
            resolvedAt: new Date()
        };
        
        await report.save();
        invalidateReport(report.reportId, report.guildId);

        try {
            const reportedUser = await client.users.fetch(report.reportedUser.userId).catch(() => null);
            const reporter = await client.users.fetch(report.reporter.userId).catch(() => null);
            const guild = client.guilds.cache.get(guildId);
            
            if (guild) {
                if (reportedUser) await this.sendDismissedDM(reportedUser, report, guild, reason);
                if (reporter) await this.sendDismissedReporterDM(reporter, report, guild, reason);
            }
        } catch (error) {
            console.error('Failed to send dismissed DMs:', error);
        }

        await this.updateReportMessage(report, client);
        return report;
    }

    async applyTimeoutFromReport(reportId, guildId, duration, moderatorId, client) {
        const report = await Report.findOne({ reportId, guildId });
        if (!report) return null;

        try {
            const guild = client.guilds.cache.get(guildId);
            if (!guild) return null;

            const member = await guild.members.fetch(report.reportedUser.userId).catch(() => null);
            const reporter = await client.users.fetch(report.reporter.userId).catch(() => null);
            
            if (!member) return null;

            await member.timeout(duration * 1000, `Timeout applied via report ${reportId}`);

            await this.sendTimeoutDMs(member.user, reporter, report, guild, duration * 1000);

            report.status = 'resolved';
            report.resolution = {
                action: 'timeout',
                details: `Manual timeout: ${duration} seconds`,
                resolvedBy: moderatorId,
                resolvedAt: new Date()
            };

            await report.save();
            invalidateReport(report.reportId, report.guildId);
            await this.updateReportMessage(report, client);

            return report;
        } catch (error) {
            console.error('Failed to apply timeout:', error);
            return null;
        }
    }
    
    async getPendingReports(guildId, limit = 50) {
        return await Report.find({
            guildId,
            status: { $in: ['pending', 'under_review'] }
        })
        .sort({ priority: -1, 'timestamps.createdAt': -1 })
        .limit(limit);
    }
    
    async getHighPriorityReports(guildId) {
        return await Report.find({
            guildId,
            priority: { $in: ['high', 'urgent'] },
            status: { $in: ['pending', 'under_review', 'escalated'] }
        })
        .sort({ priority: -1, 'timestamps.createdAt': -1 });
    }
}

module.exports = new ReportService();
