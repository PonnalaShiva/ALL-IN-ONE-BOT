


const { PermissionsBitField, MessageFlags } = require('discord.js');
const { buildCard } = require('../UI');
const { getEmoji } = require('../UI/emojis/emoji');
const loadLanguage = require('../events/loadLanguage');
const AntiConfig = require('../models/antiSystem/AntiConfig');
const UserViolation = require('../models/antiSystem/UserViolation');
const ThreatScore = require('../models/antiSystem/ThreatScore');
const { normalize, hasEvasion, getEvasionScore } = require('../utils/antiEvasion');
const { getActionQueue, ACTION_TYPES, PRIORITY } = require('../utils/actionQueue');

class AntiSpamModuleV2 {
    constructor(client) {
        this.client = client;
        this.spamTracking = new Map();      
        this.rateLimiter = new Map();       
        this.actionQueue = null;            
        this.cleanupTimers = [];
        this.unregisterMiddleware = null;
        this.initialize();
    }
    
    initialize() {
        
        const messageMiddleware = require('../utils/messageMiddleware');
        this.unregisterMiddleware = messageMiddleware.use(async (message, next) => {
            if (!message.guild || message.author.bot) {
                await next();
                return false;
            }
            await this.handleMessage(message);
            await next();
            return false;
        }, 20); 
        
        
        this.cleanupTimers.push(
            setInterval(() => this.cleanup(), 5 * 60 * 1000),
            setInterval(() => this.cleanupRateLimiter(), 60 * 1000)
        );
        this.cleanupTimers.forEach(timer => timer.unref?.());
        
        
        this.actionQueue = getActionQueue(this.client);
    }

    stop() {
        for (const timer of this.cleanupTimers) clearInterval(timer);
        this.cleanupTimers = [];
        this.unregisterMiddleware?.();
        this.unregisterMiddleware = null;
        this.spamTracking.clear();
        this.rateLimiter.clear();
    }
    
    async handleMessage(message) {
        try {
            
            const { getAntiConfig } = require('../utils/cacheHelpers');
            const config = await getAntiConfig(message.guild.id);
            
            if (!config?.antiSpam?.enabled) return;
            
            
            const isWhitelisted = await this.isWhitelisted(message.author, message.channel, config);
            
            const userId = message.author.id;
            const guildId = message.guild.id;
            
            
            if (this.isRateLimited(userId)) return;
            
            
            this.trackMessage(userId, message);
            
            
            if (isWhitelisted) {
                
                if (config.staffMonitoring?.logWhitelistedActions) {
                    let threatScore = await ThreatScore.getOrCreate(userId, guildId);
                    const violations = await this.detectViolations(message, config, threatScore);
                    
                    
                    if (violations.length > 0 && violations.some(v => v.severity !== 'low')) {
                        this.logWhitelistedAction(message, violations, config);
                    }
                }
                return; 
            }
            
            
            let threatScore = await ThreatScore.getOrCreate(userId, guildId);
            
            
            threatScore.applyDecay(config.threatSystem?.decaySettings);
            
            
            const violations = await this.detectViolations(message, config, threatScore);
            
            if (violations.length > 0) {
                await this.handleViolations(message, violations, config, threatScore);
            }
            
        } catch (error) {
            console.error('[ANTI-SPAM-V2] Error:', error);
        }
    }
    
    trackMessage(userId, message) {
        const now = Date.now();
        
        if (!this.spamTracking.has(userId)) {
            this.spamTracking.set(userId, { 
                messages: [], 
                lastReset: now,
                channelHopping: new Map() 
            });
        }
        
        const userData = this.spamTracking.get(userId);
        
        
        const normalized = normalize(message.content);
        
        userData.messages.push({
            content: message.content,
            normalizedContent: normalized.normalized,
            timestamp: now,
            channelId: message.channel.id,
            attachments: message.attachments.size,
            embeds: message.embeds.length,
            mentions: message.mentions.users.size + message.mentions.roles.size,
            invites: (message.content.match(/discord\.gg\/\w+|discord\.com\/invite\/\w+/gi) || []).length,
            evasionScore: normalized.evasionScore
        });
        
        
        const channelCount = userData.channelHopping.get(message.channel.id) || 0;
        userData.channelHopping.set(message.channel.id, channelCount + 1);
        
        
        userData.messages = userData.messages.filter(msg => now - msg.timestamp < 30000);
    }
    
    async detectViolations(message, config, threatScore) {
        const violations = [];
        const userId = message.author.id;
        const userData = this.spamTracking.get(userId);
        const spamConfig = config.antiSpam;
        
        
        const recentMessages = userData.messages.filter(
            msg => Date.now() - msg.timestamp < spamConfig.timeWindow
        );
        
        
        const messageLimit = spamConfig.messageLimit || 7; 
        const timeWindow = spamConfig.timeWindow || 5000; 
        if (recentMessages.length > messageLimit) {
            violations.push({
                type: 'spam',
                severity: this.calculateSeverity(recentMessages.length, messageLimit),
                description: `${recentMessages.length} messages in ${timeWindow/1000}s (limit: ${messageLimit})`,
                confidence: 0.95,
                data: { count: recentMessages.length, limit: messageLimit }
            });
        }

        const duplicateThreshold = spamConfig.duplicateThreshold || 4; 
        const similarityThreshold = spamConfig.similarityThreshold || 0.85; 
        const duplicates = this.findDuplicates(recentMessages, similarityThreshold);
        if (duplicates.count >= duplicateThreshold && recentMessages.length >= 3) {
            violations.push({
                type: 'duplicate_spam',
                severity: duplicates.count > duplicateThreshold * 2 ? 'high' : 'medium', 
                description: `${duplicates.count} duplicate/similar messages detected`,
                confidence: duplicates.avgSimilarity,
                data: { count: duplicates.count, similarity: duplicates.avgSimilarity }
            });
        }

        const thisMsgMentions = message.mentions.users.size + message.mentions.roles.size;
        const perMessageLimit = spamConfig.mentionLimitPerMessage || 10; 
        
        
        if (thisMsgMentions >= perMessageLimit) {
            violations.push({
                type: 'mention_spam',
                severity: thisMsgMentions > perMessageLimit * 2 ? 'critical' : 'high',
                description: `Mass mentions in single message: ${thisMsgMentions} (limit: ${perMessageLimit})`,
                confidence: 0.95,
                data: { count: thisMsgMentions, limit: perMessageLimit }
            });
        }
        
        else {
            const totalMentions = recentMessages.reduce((sum, m) => sum + m.mentions, 0);
            const totalLimit = spamConfig.mentionLimit || 15; 
            if (totalMentions > totalLimit && recentMessages.length >= 3) {
                violations.push({
                    type: 'mention_spam',
                    severity: totalMentions > totalLimit * 2 ? 'critical' : 'medium',
                    description: `Cumulative mention spam: ${totalMentions} mentions in ${recentMessages.length} messages`,
                    confidence: 0.85,
                    data: { count: totalMentions, limit: totalLimit, messages: recentMessages.length }
                });
            }
        }
        
        
        const emojiLimit = spamConfig.emojiLimit || 15; 
        const emojiCount = this.countEmojis(message.content);
        if (emojiCount > emojiLimit && message.content.length > 5) { 
            violations.push({
                type: 'emoji_spam',
                severity: emojiCount > emojiLimit * 2 ? 'high' : 'low', 
                description: `Excessive emojis: ${emojiCount} (limit: ${emojiLimit})`,
                confidence: 0.85,
                data: { count: emojiCount, limit: emojiLimit }
            });
        }
        
        
        const capsMinLength = spamConfig.capsDetection?.minLength || 20; 
        if (spamConfig.capsDetection?.enabled !== false && message.content.length > capsMinLength) {
            const capsPercentage = this.getCapsPercentage(message.content);
            const capsThreshold = spamConfig.capsDetection?.percentage || 80; 
            if (capsPercentage >= capsThreshold) {
                violations.push({
                    type: 'caps',
                    severity: 'low', 
                    description: `Excessive caps: ${capsPercentage.toFixed(1)}% (limit: ${capsThreshold}%)`,
                    confidence: 0.75, 
                    data: { percentage: capsPercentage }
                });
            }
        }
        
        
        const blockedWordResult = this.checkBlockedWords(message.content, spamConfig.blockedWords || []);
        if (blockedWordResult.found) {
            violations.push({
                type: 'blocked_word',
                severity: blockedWordResult.evasionAttempted ? 'high' : 'medium',
                description: blockedWordResult.evasionAttempted 
                    ? `Blocked word detected with evasion attempt: "${blockedWordResult.word}"`
                    : `Contains blocked word: "${blockedWordResult.word}"`,
                confidence: 1.0,
                data: { word: blockedWordResult.word, evasion: blockedWordResult.evasionAttempted }
            });
        }
        
        
        if (spamConfig.blockedPatterns?.length > 0) {
            const patternMatch = this.checkBlockedPatterns(message.content, spamConfig.blockedPatterns);
            if (patternMatch.found) {
                violations.push({
                    type: 'blocked_pattern',
                    severity: 'high',
                    description: `Matches blocked pattern`,
                    confidence: 1.0,
                    data: { pattern: patternMatch.pattern }
                });
            }
        }
        
        
        if (spamConfig.attachmentSpam?.enabled) {
            const attachmentCount = recentMessages.reduce((sum, m) => sum + m.attachments, 0);
            const attachmentWindow = recentMessages.filter(
                m => Date.now() - m.timestamp < spamConfig.attachmentSpam.timeWindow
            );
            
            if (attachmentWindow.length > 0) {
                const attachmentsInWindow = attachmentWindow.reduce((sum, m) => sum + m.attachments, 0);
                if (attachmentsInWindow > spamConfig.attachmentSpam.maxAttachments) {
                    violations.push({
                        type: 'attachment_spam',
                        severity: 'medium',
                        description: `Excessive attachments: ${attachmentsInWindow} in ${spamConfig.attachmentSpam.timeWindow/1000}s`,
                        confidence: 0.9,
                        data: { count: attachmentsInWindow }
                    });
                }
            }
        }
        
        
        if (spamConfig.inviteSpam?.enabled) {
            const inviteCount = recentMessages.reduce((sum, m) => sum + m.invites, 0);
            if (inviteCount > spamConfig.inviteSpam.maxInvites) {
                violations.push({
                    type: 'invite_spam',
                    severity: 'high',
                    description: `Excessive Discord invites: ${inviteCount} (limit: ${spamConfig.inviteSpam.maxInvites})`,
                    confidence: 0.95,
                    data: { count: inviteCount }
                });
            }
        }
        
        
        if (spamConfig.newlineSpam?.enabled) {
            const newlineCount = (message.content.match(/\n/g) || []).length;
            if (newlineCount > spamConfig.newlineSpam.maxNewlines) {
                violations.push({
                    type: 'newline_spam',
                    severity: 'low',
                    description: `Excessive newlines: ${newlineCount} (limit: ${spamConfig.newlineSpam.maxNewlines})`,
                    confidence: 0.8,
                    data: { count: newlineCount }
                });
            }
        }
        
        
        const messageEvasionScore = userData.messages.slice(-5).reduce((sum, m) => sum + m.evasionScore, 0);
        if (messageEvasionScore >= 10) {
            violations.push({
                type: 'evasion_attempt',
                severity: messageEvasionScore >= 20 ? 'high' : 'medium',
                description: `Evasion techniques detected (score: ${messageEvasionScore})`,
                confidence: 0.85,
                data: { evasionScore: messageEvasionScore }
            });
        }
        
        
        const uniqueChannels = userData.channelHopping.size;
        if (uniqueChannels >= 5 && recentMessages.length >= spamConfig.messageLimit) {
            violations.push({
                type: 'channel_hopping',
                severity: 'high',
                description: `Suspicious cross-channel activity: ${recentMessages.length} messages across ${uniqueChannels} channels`,
                confidence: 0.85,
                data: { channels: uniqueChannels, messages: recentMessages.length }
            });
        }
        
        return violations;
    }
    
    async handleViolations(message, violations, config, threatScore) {
        const userId = message.author.id;
        const guildId = message.guild.id;
        
        
        const severityScores = { low: 5, medium: 15, high: 30, critical: 60 };
        const totalSeverity = violations.reduce((sum, v) => sum + severityScores[v.severity], 0);
        
        
        for (const violation of violations) {
            await threatScore.addViolation({
                type: violation.type,
                severity: violation.severity,
                module: 'spam',
                reason: violation.description,
                actionTaken: null 
            });
        }
        
        
        if (config.systemMode?.mode === 'dry-run' || config.systemMode?.mode === 'log-only') {
            await this.logViolation(message, violations, 'simulated', null, config, threatScore, true);
            await threatScore.save();
            return;
        }
        
        
        const punishment = config.getModulePunishment('spam');
        const action = await this.determineAction(userId, guildId, threatScore, punishment, config);
        
        
        await this.executeAction(message, action, violations, config, threatScore);
        
        
        const violation = new UserViolation({
            userId,
            guildId,
            violationType: violations[0].type,
            severity: violations[0].severity,
            content: message.content.slice(0, 500),
            channelId: message.channel.id,
            aiAnalysis: {
                confidence: violations[0].confidence,
                reasoning: violations.map(v => v.description).join('; '),
                threatScore: threatScore.currentScore
            },
            actionTaken: action.type,
            actionDuration: action.duration,
            warningCount: threatScore.violationCounts.total
        });
        
        await violation.save();
        
        
        threatScore.addAction({
            type: action.type,
            reason: violations[0].description,
            duration: action.duration,
            automated: true,
            triggerModule: 'spam'
        });
        
        await threatScore.save();
        
        
        await this.logViolation(message, violations, action.type, action.duration, config, threatScore);
    }
    
    async determineAction(userId, guildId, threatScore, punishment, config) {
        
        const recentViolations = await UserViolation.countDocuments({
            userId,
            guildId,
            violatedAt: { $gte: new Date(Date.now() - (punishment.warningExpiry || 86400000)) }
        });
        
        
        const thresholds = config.threatSystem?.autoActionThresholds || {};
        const scoreAction = threatScore.getRecommendedAction(thresholds);
        
        if (scoreAction.urgent && scoreAction.action) {
            return {
                type: scoreAction.action,
                duration: this.getActionDuration(scoreAction.action, punishment, config),
                reason: 'threat_score_threshold'
            };
        }
        
        
        if (punishment.actions?.length > 0) {
            
            const sortedActions = [...punishment.actions].sort((a, b) => b.threshold - a.threshold);
            
            for (const actionConfig of sortedActions) {
                if (recentViolations >= actionConfig.threshold) {
                    return {
                        type: actionConfig.action,
                        duration: actionConfig.duration || this.getActionDuration(actionConfig.action, punishment, config),
                        reason: 'escalation',
                        deleteMessages: actionConfig.deleteMessages !== false,
                        notifyUser: actionConfig.notifyUser !== false
                    };
                }
            }
        }
        
        
        return {
            type: punishment.defaultAction || 'warn',
            duration: 0,
            reason: 'default',
            deleteMessages: true,
            notifyUser: true
        };
    }
    
    getActionDuration(action, punishment, config) {
        const durations = {
            timeout: config.punishmentSystem?.timeoutDuration || 300000,
            quarantine: config.punishmentSystem?.quarantineDuration || 3600000,
            tempban: 86400000 
        };
        return durations[action] || 0;
    }
    
    async executeAction(message, action, violations, config, threatScore) {
        const member = message.guild.members.cache.get(message.author.id);
        if (!member) return;
        
        const actionQueue = getActionQueue(this.client);
        
        
        if (action.deleteMessages !== false) {
            await actionQueue.enqueue({
                type: ACTION_TYPES.DELETE_MESSAGE,
                guildId: message.guild.id,
                data: { channelId: message.channel.id, messageId: message.id },
                priority: PRIORITY.HIGH,
                module: 'spam',
                reason: violations[0].description
            });
        }
        
        switch (action.type) {
            case 'warn':
                if (action.notifyUser !== false) {
                    await actionQueue.enqueue({
                        type: ACTION_TYPES.SEND_WARNING,
                        guildId: message.guild.id,
                        targetId: message.author.id,
                        data: { channelId: message.channel.id },
                        priority: PRIORITY.LOW,
                        module: 'spam',
                        reason: `Spam: ${violations[0].description}`
                    });
                }
                break;
                
            case 'delete':
                
                break;
                
            case 'timeout':
                if (member.moderatable) {
                    await actionQueue.enqueue({
                        type: ACTION_TYPES.TIMEOUT_USER,
                        guildId: message.guild.id,
                        targetId: message.author.id,
                        data: { duration: action.duration },
                        priority: PRIORITY.MEDIUM,
                        module: 'spam',
                        reason: `Anti-spam: ${violations[0].description}`,
                        undoData: { previousTimeout: member.communicationDisabledUntil }
                    });
                }
                break;
                
            case 'kick':
                if (member.kickable) {
                    await actionQueue.enqueue({
                        type: ACTION_TYPES.KICK_USER,
                        guildId: message.guild.id,
                        targetId: message.author.id,
                        priority: PRIORITY.HIGH,
                        module: 'spam',
                        reason: `Anti-spam: ${violations[0].description}`
                    });
                }
                break;
                
            case 'quarantine':
                await this.quarantineUser(message, member, violations, config);
                break;
                
            case 'ban':
            case 'tempban':
                if (member.bannable) {
                    await actionQueue.enqueue({
                        type: ACTION_TYPES.BAN_USER,
                        guildId: message.guild.id,
                        targetId: message.author.id,
                        data: { deleteMessageDays: 1 },
                        priority: PRIORITY.HIGH,
                        module: 'spam',
                        reason: `Anti-spam: ${violations[0].description}`,
                        undoData: { action: 'ban' }
                    });
                }
                break;
        }
    }
    
    async quarantineUser(message, member, violations, config) {
        const QuarantineConfig = require('../models/qurantine/quarantineConfig');
        const UserQuarantine = require('../models/qurantine/userQuarantine');
        
        const quarantineConfig = await QuarantineConfig.findOne({ guildId: member.guild.id });
        if (!quarantineConfig?.quarantineEnabled) {
            
            const actionQueue = getActionQueue(this.client);
            await actionQueue.enqueue({
                type: ACTION_TYPES.BAN_USER,
                guildId: member.guild.id,
                targetId: member.id,
                data: { deleteMessageDays: 1 },
                priority: PRIORITY.HIGH,
                module: 'spam',
                reason: `Anti-spam: ${violations[0].description}`
            });
            return;
        }
        
        const quarantineRole = member.guild.roles.cache.get(quarantineConfig.quarantineRoleId);
        if (!quarantineRole) return;
        
        
        const originalRoles = member.roles.cache
            .filter(role => role.id !== member.guild.id && role.id !== quarantineConfig.quarantineRoleId)
            .map(role => role.id);
        
        const actionQueue = getActionQueue(this.client);
        await actionQueue.enqueue({
            type: ACTION_TYPES.QUARANTINE_USER,
            guildId: member.guild.id,
            targetId: member.id,
            data: { 
                quarantineRoleId: quarantineConfig.quarantineRoleId,
                originalRoles 
            },
            priority: PRIORITY.MEDIUM,
            module: 'spam',
            reason: `Anti-spam: ${violations[0].description}`,
            undoData: { originalRoles, quarantineRoleId: quarantineConfig.quarantineRoleId }
        });
        
        
        await UserQuarantine.findOneAndUpdate(
            { userId: member.id, guildId: member.guild.id },
            { 
                isQuarantined: true, 
                quarantinedAt: new Date(),
                reason: `Anti-spam violation: ${violations[0].description}`
            },
            { upsert: true }
        );
        
        quarantineConfig.userRoles.set(member.id, originalRoles);
        await quarantineConfig.save();
        
        
        this.sendQuarantineDM(member, violations);
    }
    
    async sendQuarantineDM(member, violations) {
        const lang = loadLanguage(member.guild.id);
        const l = lang.antimodules?.spam || {};
        const card = buildCard({
            title: `${getEmoji('warning')} ${l.quarantinedTitle || 'You Have Been Quarantined'}`,
            description: (l.quarantinedDesc || 'You have been quarantined in **{guild}** for spam violations.').replace('{guild}', member.guild.name),
            fields: [
                { name: l.reasonLabel || 'Reason', value: violations[0].description, inline: false },
                { name: l.violationsLabel || 'Violations', value: violations.map(v => `• ${v.type}: ${v.description}`).join('\n').slice(0, 1000), inline: false },
                { name: l.durationLabel || 'Duration', value: 'Until reviewed by staff', inline: true }
            ],
            tone: 'danger'
        });
        
        try {
            await member.send({ components: [card], flags: MessageFlags.IsComponentsV2 });
        } catch (error) {
            console.log(`[ANTI-SPAM-V2] Failed to DM ${member.user.tag}`);
        }
    }
    
    async logViolation(message, violations, action, duration, config, threatScore, isDryRun = false) {
        const logChannelId = config.logging?.logChannelId || config.logChannelId;
        const logChannel = this.client.channels.cache.get(logChannelId);
        if (!logChannel) return;

        const lang = loadLanguage(message.guild.id);
        const l = lang.antimodules?.spam || {};
        
        const violationsList = violations.map(v => 
            `• **${v.type}** (${v.severity}): ${v.description}`
        ).join('\n').slice(0, 1000);

        const fields = [
            { name: l.userLabel || 'User', value: `${message.author.tag} (${message.author.id})`, inline: true },
            { name: l.channelLabel || 'Channel', value: `<#${message.channel.id}>`, inline: true },
            { name: l.actionLabel || 'Action', value: isDryRun ? `${action.toUpperCase()} (SIMULATED)` : action.toUpperCase(), inline: true },
            { name: l.threatScoreLabel || 'Threat Score', value: `${threatScore.currentScore}/100 (${threatScore.riskLevel})`, inline: true },
            { name: 'Total Violations', value: `${threatScore.violationCounts.total}`, inline: true },
            { name: l.riskLevelLabel || 'Risk Level', value: threatScore.riskLevel.toUpperCase(), inline: true },
            { name: l.violationsLabel || 'Violations', value: violationsList, inline: false }
        ];

        if (duration) {
            fields.push({ name: l.durationLabel || 'Duration', value: `${duration/1000}s`, inline: true });
        }

        const evasionViolation = violations.find(v => v.type === 'evasion_attempt');
        if (evasionViolation) {
            fields.push({ 
                name: `${getEmoji('warning')} Evasion Detected`, 
                value: `User attempted to bypass detection (score: ${evasionViolation.data.evasionScore})`,
                inline: false 
            });
        }

        const titleText = isDryRun ? (l.detectionDryRunTitle || 'Anti-Spam Detection (DRY RUN)') : (l.detectionTitle || 'Anti-Spam Detection');
        const card = buildCard({
            title: `${getEmoji('security')} ${titleText}`,
            description: config.logging?.includeMessageContent !== false ? `**${l.messageContentLabel || 'Message'}:** ${message.content.slice(0, 500)}` : undefined,
            fields,
            tone: action === 'ban' || action === 'quarantine' ? 'danger' : 'warning'
        });

        await logChannel.send({ components: [card], flags: MessageFlags.IsComponentsV2 });
        
        
        if (threatScore.currentScore >= 70) {
            await this.sendHighThreatAlert(message, threatScore, config);
        }
    }
    
    async sendHighThreatAlert(message, threatScore, config) {
        const alertChannelId = config.logging?.alertChannelId || config.alertChannelId;
        if (!alertChannelId || alertChannelId === config.logging?.logChannelId) return;
        
        const alertChannel = this.client.channels.cache.get(alertChannelId);
        if (!alertChannel) return;

        const lang = loadLanguage(message.guild.id);
        const l = lang.antimodules?.spam || {};
        
        const card = buildCard({
            title: `${getEmoji('fire')} ${l.highThreatTitle || 'HIGH THREAT DETECTED'}`,
            description: (l.highThreatDesc || 'User **{user}** has reached threat score **{score}/100**')
                .replace('{user}', message.author.tag)
                .replace('{score}', threatScore.currentScore),
            fields: [
                { name: l.riskLevelLabel || 'Risk Level', value: threatScore.riskLevel.toUpperCase(), inline: true },
                { name: 'Total Violations', value: `${threatScore.violationCounts.total}`, inline: true },
                { name: 'Last 24h', value: `${threatScore.violationCounts.last24Hours}`, inline: true },
                { name: 'Action Required', value: 'Manual review recommended', inline: false }
            ],
            tone: 'danger'
        });
        
        await alertChannel.send({ content: '@here' });
        await alertChannel.send({ components: [card], flags: MessageFlags.IsComponentsV2 });
    }
    
    logWhitelistedAction(message, violations, config) {
        const staffChannelId = config.logging?.staffChannelId;
        if (!staffChannelId) return;
        
        const staffChannel = this.client.channels.cache.get(staffChannelId);
        if (!staffChannel) return;

        const lang = loadLanguage(message.guild.id);
        const l = lang.antimodules?.spam || {};
        
        const violationSummary = violations.map(v => `• ${v.type}: ${v.description}`).join('\n');
        
        const card = buildCard({
            title: `${getEmoji('document')} ${l.whitelistedTitle || 'Whitelisted User Activity'}`,
            description: (l.whitelistedDesc || 'Whitelisted user **{user}** triggered detection but was **bypassed** due to whitelist.').replace('{user}', message.author.tag),
            fields: [
                { name: l.channelLabel || 'Channel', value: `<#${message.channel.id}>`, inline: true },
                { name: l.violationsLabel || 'Violations Detected', value: violationSummary || 'N/A', inline: false },
                { name: l.messageContentLabel || 'Message', value: message.content.slice(0, 200) || 'No content', inline: false },
                { name: 'Note', value: `${getEmoji('warning')} ${l.whitelistedNote || 'No action taken - user is whitelisted'}`, inline: false }
            ],
            tone: 'warning'
        });
        
        staffChannel.send({ components: [card], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
    }

    findDuplicates(messages, threshold) {
        let duplicateCount = 0;
        let totalSimilarity = 0;
        const checked = new Set();
        
        for (let i = 0; i < messages.length; i++) {
            if (checked.has(i)) continue;
            
            for (let j = i + 1; j < messages.length; j++) {
                if (checked.has(j)) continue;
                
                
                const similarity = this.similarity(
                    messages[i].normalizedContent,
                    messages[j].normalizedContent
                );
                
                if (similarity >= threshold) {
                    duplicateCount++;
                    totalSimilarity += similarity;
                    checked.add(j);
                }
            }
        }
        
        return {
            count: duplicateCount,
            avgSimilarity: duplicateCount > 0 ? totalSimilarity / duplicateCount : 0
        };
    }
    
    countEmojis(content) {
        const customEmoji = (content.match(/<a?:\w+:\d+>/g) || []).length;
        const unicodeEmoji = (content.match(/[\u{1f600}-\u{1f64f}]|[\u{1f300}-\u{1f5ff}]|[\u{1f680}-\u{1f6ff}]|[\u{1f1e0}-\u{1f1ff}]|[\u{2600}-\u{26ff}]|[\u{2700}-\u{27bf}]/gu) || []).length;
        return customEmoji + unicodeEmoji;
    }
    
    getCapsPercentage(content) {
        const letters = content.match(/[a-zA-Z]/g) || [];
        if (letters.length === 0) return 0;
        const caps = letters.filter(c => c === c.toUpperCase()).length;
        return (caps / letters.length) * 100;
    }
    
    checkBlockedWords(content, blockedWords) {
        if (!blockedWords || blockedWords.length === 0) {
            return { found: false };
        }
        
        
        const normalized = normalize(content);
        const lowerContent = normalized.normalized;
        const originalLower = content.toLowerCase();
        
        for (const word of blockedWords) {
            const lowerWord = word.toLowerCase();
            
            if (lowerContent.includes(lowerWord)) {
                
                const evasionAttempted = !originalLower.includes(lowerWord);
                
                return {
                    found: true,
                    word,
                    evasionAttempted
                };
            }
        }
        
        return { found: false };
    }
    
    checkBlockedPatterns(content, patterns) {
        for (const pattern of patterns) {
            try {
                const regex = new RegExp(pattern, 'gi');
                if (regex.test(content)) {
                    return { found: true, pattern };
                }
            } catch (e) {
                
            }
        }
        return { found: false };
    }
    
    calculateSeverity(actual, limit) {
        const ratio = actual / limit;
        if (ratio >= 3) return 'critical';
        if (ratio >= 2) return 'high';
        if (ratio >= 1.5) return 'medium';
        return 'low';
    }
    
    similarity(str1, str2) {
        if (!str1 || !str2) return 0;
        if (str1 === str2) return 1;
        
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 1.0;
        
        const editDistance = this.levenshteinDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }
    
    levenshteinDistance(str1, str2) {
        const matrix = Array(str2.length + 1).fill(null).map(() => 
            Array(str1.length + 1).fill(0)
        );
        
        for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
        for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
        
        for (let j = 1; j <= str2.length; j++) {
            for (let i = 1; i <= str1.length; i++) {
                const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(
                    matrix[j][i - 1] + 1,
                    matrix[j - 1][i] + 1,
                    matrix[j - 1][i - 1] + indicator
                );
            }
        }
        
        return matrix[str2.length][str1.length];
    }
    
    isRateLimited(userId) {
        const now = Date.now();
        const userLimit = this.rateLimiter.get(userId);
        
        if (!userLimit || now > userLimit.resetTime) {
            this.rateLimiter.set(userId, { count: 1, resetTime: now + 1000 });
            return false;
        }
        
        if (userLimit.count >= 10) return true;
        
        userLimit.count++;
        return false;
    }
    
    async isWhitelisted(user, channel, config) {
        const member = channel.guild.members.cache.get(user.id);
        if (!member) return false;
        
        
        if (user.id === channel.guild.ownerId) return true;
        
        
        if (config.whitelist?.owners?.includes(user.id)) return true;
        if (config.whitelist?.customMembers?.includes(user.id)) return true;
        if (config.whitelist?.customChannels?.includes(channel.id)) return true;
        if (config.antiSpam?.whitelistedChannels?.includes(channel.id)) return true;
        
        
        const hasWhitelistedRole = member.roles.cache.some(role => 
            config.whitelist?.customRoles?.includes(role.id) ||
            config.antiSpam?.whitelistedRoles?.includes(role.id)
        );
        if (hasWhitelistedRole) return true;
        
        
        if (config.whitelist?.bypassAdmins && 
            member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return true;
        }
        
        
        if (config.whitelist?.bypassModerators && 
            member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return true;
        }
        
        return false;
    }
    
    cleanup() {
        const now = Date.now();
        const MAX_SIZE = 5000;
        
        
        for (const [userId, userData] of this.spamTracking.entries()) {
            userData.messages = userData.messages.filter(msg => now - msg.timestamp < 30000);
            
            
            if (now - userData.lastReset > 60000) {
                userData.channelHopping.clear();
                userData.lastReset = now;
            }
            
            if (userData.messages.length === 0) {
                this.spamTracking.delete(userId);
            }
        }
        
        
        if (this.spamTracking.size > MAX_SIZE) {
            const entries = Array.from(this.spamTracking.entries())
                .sort((a, b) => a[1].lastReset - b[1].lastReset);
            const toRemove = entries.slice(0, this.spamTracking.size - MAX_SIZE);
            for (const [userId] of toRemove) {
                this.spamTracking.delete(userId);
            }
        }
    }
    
    cleanupRateLimiter() {
        const now = Date.now();
        for (const [userId, limit] of this.rateLimiter.entries()) {
            if (now > limit.resetTime) {
                this.rateLimiter.delete(userId);
            }
        }
    }
}

module.exports = AntiSpamModuleV2;
