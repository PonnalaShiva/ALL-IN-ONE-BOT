


const { PermissionsBitField, MessageFlags } = require('discord.js');
const { buildCard } = require('../UI');
const { getEmoji } = require('../UI/emojis/emoji');
const loadLanguage = require('../events/loadLanguage');
const AntiConfig = require('../models/antiSystem/AntiConfig');
const UserViolation = require('../models/antiSystem/UserViolation');
const ThreatScore = require('../models/antiSystem/ThreatScore');
const { normalize, analyzeUrl, checkConfusableDomains, hasEvasion } = require('../utils/antiEvasion');
const { getActionQueue, ACTION_TYPES, PRIORITY } = require('../utils/actionQueue');
const aiManager = require('../utils/AIManager');

class AntiLinkModule {
    constructor(client) {
        this.client = client;
        this.linkCache = new Map();         
        this.phishingCache = new Map();     
        this.actionQueue = null;
        this.cleanupTimer = null;
        this.unregisterMiddleware = null;
        
        
        this.urlShorteners = [
            'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'short.link',
            'tiny.one', 'rb.gy', 'cutt.ly', 'is.gd', 'v.gd', 'x.co', 'shorturl.at',
            't.ly', 'tiny.cc', 'bc.vc', 'bit.do', 'adf.ly', 'ouo.io', 'shorte.st'
        ];
        
        
        this.phishingPatterns = [
            /discord[.-]?gift/i,
            /discord[.-]?nitro/i,
            /free[.-]?nitro/i,
            /steam[.-]?community/i,
            /steampowered[.-]?com/i,
            /claim[.-]?gift/i,
            /verify[.-]?account/i,
            /login[.-]?discord/i,
            /discord[.-]?verify/i
        ];
        
        
        this.suspiciousTLDs = [
            '.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.work', 
            '.click', '.link', '.info', '.online', '.site', '.club', '.icu'
        ];
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
        }, 30); 
        
        
        this.cleanupTimer = setInterval(() => this.cleanup(), 10 * 60 * 1000);
        this.cleanupTimer.unref?.();
        
        
        this.actionQueue = getActionQueue(this.client);
    }

    stop() {
        if (this.cleanupTimer) clearInterval(this.cleanupTimer);
        this.cleanupTimer = null;
        this.unregisterMiddleware?.();
        this.unregisterMiddleware = null;
        this.linkCache.clear();
        this.phishingCache.clear();
    }
    
    async handleMessage(message) {
        try {
            const { getAntiConfig } = require('../utils/cacheHelpers');
            const config = await getAntiConfig(message.guild.id);
            
            if (!config?.antiLink?.enabled) return;
            
            
            const links = this.extractLinks(message.content, config);
            if (links.length === 0) return;
            
            
            const isWhitelisted = await this.isWhitelisted(message.author, message.channel, config);
            
            if (isWhitelisted) {
                
                if (config.staffMonitoring?.logWhitelistedActions) {
                    const violations = await this.analyzeLinks(links, message, config);
                    if (violations.length > 0) {
                        this.logWhitelistedAction(message, violations, config);
                    }
                }
                return; 
            }
            
            
            const violations = await this.analyzeLinks(links, message, config);
            
            if (violations.length > 0) {
                await this.handleViolations(message, violations, config);
            }
            
        } catch (error) {
            console.error('[ANTI-LINK] Error:', error);
        }
    }

    extractLinks(content, config) {
        const links = [];
        
        
        const normalized = normalize(content, {
            normalizeUnicode: config.antiEvasion?.normalizeUnicode !== false,
            removeZeroWidth: config.antiEvasion?.removeZeroWidth !== false,
            detectHomoglyphs: config.antiEvasion?.detectHomoglyphs !== false,
            decodeUrls: config.antiEvasion?.decodeUrls !== false
        });
        
        
        const urlRegex = /https?:\/\/[^\s<>"{}|\\/^`[\]]+/gi;
        const discordInviteRegex = /(?:discord\.gg|discord(?:app)?\.com\/invite)\/([a-zA-Z0-9-]+)/gi;
        
        
        const originalMatches = content.match(urlRegex) || [];
        const normalizedMatches = normalized.normalized.match(urlRegex) || [];
        
        
        const allMatches = [...new Set([...originalMatches, ...normalizedMatches])];
        
        for (const url of allMatches) {
            try {
                
                const urlAnalysis = analyzeUrl(url);
                
                const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
                
                links.push({
                    original: url,
                    normalized: urlAnalysis.normalizedHostname || urlObj.hostname.toLowerCase(),
                    hostname: urlObj.hostname.toLowerCase(),
                    path: urlObj.pathname,
                    protocol: urlObj.protocol,
                    isEvasion: urlAnalysis.isEvasion,
                    evasionScore: urlAnalysis.evasionScore,
                    evasionFlags: urlAnalysis.flags,
                    confusableDetails: urlAnalysis.confusableDetails
                });
            } catch (e) {
                
                links.push({
                    original: url,
                    normalized: url.toLowerCase(),
                    hostname: url.toLowerCase(),
                    path: '',
                    protocol: 'unknown',
                    isEvasion: hasEvasion(url),
                    evasionScore: 0,
                    evasionFlags: ['invalid_url']
                });
            }
        }
        
        
        const inviteMatches = content.matchAll(discordInviteRegex);
        for (const match of inviteMatches) {
            const inviteCode = match[1];
            const fullUrl = `discord.gg/${inviteCode}`;
            
            
            if (!links.some(l => l.original.includes(inviteCode))) {
                links.push({
                    original: fullUrl,
                    normalized: fullUrl,
                    hostname: 'discord.gg',
                    path: `/${inviteCode}`,
                    protocol: 'https:',
                    isDiscordInvite: true,
                    inviteCode,
                    isEvasion: false,
                    evasionScore: 0,
                    evasionFlags: []
                });
            }
        }
        
        return links;
    }
    
    async analyzeLinks(links, message, config) {
        const violations = [];
        
        for (const link of links) {
            
            if (link.isEvasion && config.antiEvasion?.enabled !== false) {
                violations.push({
                    type: 'link_evasion',
                    severity: link.evasionScore >= 10 ? 'critical' : 'high',
                    description: `Link evasion detected: ${link.evasionFlags.join(', ')}`,
                    confidence: 0.95,
                    url: link.original,
                    data: { 
                        evasionScore: link.evasionScore, 
                        flags: link.evasionFlags,
                        confusable: link.confusableDetails
                    }
                });
                continue; 
            }
            
            
            if (this.isDomainBlocked(link.hostname, config.antiLink.blockedDomains) ||
                this.isDomainBlocked(link.normalized, config.antiLink.blockedDomains)) {
                violations.push({
                    type: 'blocked_domain',
                    severity: 'high',
                    description: `Blocked domain: ${link.hostname}`,
                    confidence: 1.0,
                    url: link.original
                });
                continue;
            }
            
            
            if (config.antiLink.mode === 'custom' &&
                this.isDomainAllowed(link.hostname, config.antiLink.allowedDomains)) {
                continue;
            }
            
            
            const confusableCheck = checkConfusableDomains(link.hostname);
            if (confusableCheck.isConfusable) {
                violations.push({
                    type: 'spoofed_domain',
                    severity: 'critical',
                    description: `Spoofed domain detected: ${confusableCheck.details}`,
                    confidence: 0.95,
                    url: link.original,
                    data: { matches: confusableCheck.matches }
                });
                continue;
            }
            
            
            if (config.antiLink.ipLinkProtection && this.isIPLink(link.hostname)) {
                violations.push({
                    type: 'ip_link',
                    severity: 'high',
                    description: `IP-based link detected: ${link.hostname}`,
                    confidence: 0.9,
                    url: link.original
                });
                continue;
            }
            
            
            if (config.antiLink.shortenerProtection && this.isUrlShortener(link.hostname)) {
                violations.push({
                    type: 'url_shortener',
                    severity: 'medium',
                    description: `URL shortener detected: ${link.hostname}`,
                    confidence: 0.85,
                    url: link.original
                });
                continue;
            }
            
            
            if (this.hasSuspiciousTLD(link.hostname)) {
                violations.push({
                    type: 'suspicious_tld',
                    severity: 'medium',
                    description: `Suspicious TLD: ${link.hostname}`,
                    confidence: 0.7,
                    url: link.original
                });
                
            }
            
            
            const phishingResult = this.checkPhishingPatterns(link);
            if (phishingResult.isPhishing) {
                violations.push({
                    type: 'phishing_link',
                    severity: 'critical',
                    description: `Phishing pattern detected: ${phishingResult.pattern}`,
                    confidence: 0.95,
                    url: link.original,
                    data: { pattern: phishingResult.pattern }
                });
                continue;
            }
            
            
            if (link.isDiscordInvite && config.antiLink.inviteHandling) {
                const inviteViolation = await this.checkDiscordInvite(link, message, config);
                if (inviteViolation) {
                    violations.push(inviteViolation);
                    continue;
                }
            }
            
            
            if (config.antiLink.mode === 'strict' &&
                !this.isDomainAllowed(link.hostname, config.antiLink.allowedDomains)) {
                violations.push({
                    type: 'unauthorized_link',
                    severity: 'medium',
                    description: `Unauthorized link in strict mode: ${link.hostname}`,
                    confidence: 0.8,
                    url: link.original
                });
                continue;
            }
            
            
            if (config.aiSettings?.enabled && config.aiSettings?.useForLinks && 
                config.antiLink.mode === 'moderate') {
                try {
                    const aiResult = await this.analyzeWithAI(link, message, config);
                    
                    if (aiResult.success && aiResult.isMalicious &&
                        aiResult.confidence >= (config.aiSettings.confidenceThreshold || 0.7)) {
                        violations.push({
                            type: 'ai_suspicious_link',
                            severity: aiResult.riskLevel === 'critical' ? 'critical' : 'high',
                            description: aiResult.reasoning,
                            confidence: aiResult.confidence,
                            url: link.original,
                            aiGenerated: true,
                            data: { aiResult }
                        });
                    }
                } catch (aiError) {
                    console.error('[ANTI-LINK] AI analysis failed:', aiError.message);
                }
            }
            
            
            if (config.antiLink.phishingProtection?.enabled && 
                config.antiLink.phishingProtection?.useExternalApi) {
                const apiResult = await this.checkPhishingApi(link, config);
                if (apiResult.isPhishing) {
                    violations.push({
                        type: 'phishing_api_detected',
                        severity: 'critical',
                        description: `External API flagged as phishing`,
                        confidence: 0.98,
                        url: link.original,
                        data: { apiResult }
                    });
                }
            }
        }
        
        return violations;
    }

    async checkDiscordInvite(link, message, config) {
        const inviteConfig = config.antiLink.inviteHandling;
        
        
        if (inviteConfig.blockAllInvites) {
            return {
                type: 'blocked_invite',
                severity: 'medium',
                description: 'Discord invites are not allowed',
                confidence: 1.0,
                url: link.original
            };
        }
        
        try {
            
            const invite = await this.client.fetchInvite(link.inviteCode).catch(() => null);
            
            if (!invite) {
                return {
                    type: 'invalid_invite',
                    severity: 'low',
                    description: 'Invalid or expired invite',
                    confidence: 0.9,
                    url: link.original
                };
            }
            
            
            if (invite.guild?.id === message.guild.id) {
                if (inviteConfig.allowOwnServerInvites !== false) {
                    return null; 
                }
            }
            
            
            if (inviteConfig.partnerServers?.includes(invite.guild?.id)) {
                return null; 
            }
            
            
            if (inviteConfig.blockVanityUrls && invite.code === invite.guild?.vanityURLCode) {
                return {
                    type: 'blocked_vanity_invite',
                    severity: 'medium',
                    description: `Vanity URL invite: ${invite.guild?.name}`,
                    confidence: 0.95,
                    url: link.original
                };
            }
            
            
            return {
                type: 'external_invite',
                severity: 'medium',
                description: `External server invite: ${invite.guild?.name || 'Unknown'}`,
                confidence: 0.9,
                url: link.original,
                data: { 
                    guildId: invite.guild?.id,
                    guildName: invite.guild?.name,
                    memberCount: invite.memberCount
                }
            };
            
        } catch (error) {
            return null; 
        }
    }
    
    checkPhishingPatterns(link) {
        const fullUrl = `${link.hostname}${link.path}`;
        
        for (const pattern of this.phishingPatterns) {
            if (pattern.test(fullUrl) || pattern.test(link.original)) {
                
                if (link.hostname === 'discord.com' || link.hostname === 'discord.gg') {
                    continue; 
                }
                
                return {
                    isPhishing: true,
                    pattern: pattern.toString()
                };
            }
        }
        
        return { isPhishing: false };
    }
    
    async checkPhishingApi(link, config) {
        const cacheKey = link.hostname;
        
        
        if (this.phishingCache.has(cacheKey)) {
            const cached = this.phishingCache.get(cacheKey);
            const cacheDuration = config.antiLink.phishingProtection?.cacheDuration || 3600000;
            if (Date.now() - cached.timestamp < cacheDuration) {
                return cached.result;
            }
        }
        
        try {
            const apiEndpoint = config.antiLink.phishingProtection?.apiEndpoint;
            if (!apiEndpoint) return { isPhishing: false };
            
            
            const response = await fetch(`${apiEndpoint}?url=${encodeURIComponent(link.original)}`, {
                timeout: 5000
            }).catch(() => null);
            
            if (!response) return { isPhishing: false };
            
            const result = await response.json();
            
            
            this.phishingCache.set(cacheKey, {
                result: { isPhishing: result.phishing || false },
                timestamp: Date.now()
            });
            
            return { isPhishing: result.phishing || false };
            
        } catch (error) {
            return { isPhishing: false };
        }
    }
    
    async analyzeWithAI(link, message, config) {
        const cacheKey = `${link.hostname}_${link.path}`;
        
        if (this.linkCache.has(cacheKey)) {
            const cached = this.linkCache.get(cacheKey);
            if (Date.now() - cached.timestamp < 60 * 60 * 1000) {
                return cached.result;
            }
        }
        
        try {
            const result = await aiManager.analyzeLink(link.original, {
                guildName: message.guild.name,
                authorTag: message.author.tag,
                channelName: message.channel.name,
                isEvasion: link.isEvasion,
                evasionScore: link.evasionScore
            });
            
            this.linkCache.set(cacheKey, {
                result,
                timestamp: Date.now()
            });
            
            return result;
        } catch (error) {
            throw error;
        }
    }
    
    async handleViolations(message, violations, config) {
        const userId = message.author.id;
        const guildId = message.guild.id;
        
        
        let threatScore = await ThreatScore.getOrCreate(userId, guildId);
        threatScore.applyDecay(config.threatSystem?.decaySettings);
        
        
        const severityScores = { low: 5, medium: 15, high: 30, critical: 60 };
        const totalSeverity = violations.reduce((sum, v) => sum + severityScores[v.severity], 0);
        
        
        for (const violation of violations) {
            await threatScore.addViolation({
                type: violation.type,
                severity: violation.severity,
                module: 'link',
                reason: violation.description
            });
        }
        
        
        if (config.systemMode?.mode === 'dry-run' || config.systemMode?.mode === 'log-only') {
            await this.logViolation(message, violations, 'simulated', null, config, threatScore, true);
            await threatScore.save();
            return;
        }
        
        
        const punishment = config.getModulePunishment('link');
        const action = await this.determineAction(userId, guildId, threatScore, punishment, config, violations);
        
        
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
            triggerModule: 'link'
        });
        
        await threatScore.save();
        
        
        await this.logViolation(message, violations, action.type, action.duration, config, threatScore);
    }
    
    async determineAction(userId, guildId, threatScore, punishment, config, violations) {
        
        const hasCritical = violations.some(v => v.severity === 'critical');
        const hasPhishing = violations.some(v => 
            v.type === 'phishing_link' || 
            v.type === 'spoofed_domain' || 
            v.type === 'phishing_api_detected'
        );
        
        
        if (hasPhishing) {
            return {
                type: 'ban',
                duration: 0,
                reason: 'phishing',
                deleteMessages: true,
                notifyUser: true
            };
        }
        
        
        if (hasCritical && violations.some(v => v.type === 'link_evasion')) {
            return {
                type: 'quarantine',
                duration: config.punishmentSystem?.quarantineDuration || 3600000,
                reason: 'evasion',
                deleteMessages: true,
                notifyUser: true
            };
        }
        
        
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
                duration: this.getActionDuration(scoreAction.action, config),
                reason: 'threat_score',
                deleteMessages: true,
                notifyUser: true
            };
        }
        
        
        if (punishment.actions?.length > 0) {
            const sortedActions = [...punishment.actions].sort((a, b) => b.threshold - a.threshold);
            
            for (const actionConfig of sortedActions) {
                if (recentViolations >= actionConfig.threshold) {
                    return {
                        type: actionConfig.action,
                        duration: actionConfig.duration || this.getActionDuration(actionConfig.action, config),
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
    
    getActionDuration(action, config) {
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
                module: 'link',
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
                        module: 'link',
                        reason: `Unauthorized link: ${violations[0].description}`
                    });
                }
                break;
                
            case 'timeout':
                if (member.moderatable) {
                    await actionQueue.enqueue({
                        type: ACTION_TYPES.TIMEOUT_USER,
                        guildId: message.guild.id,
                        targetId: message.author.id,
                        data: { duration: action.duration },
                        priority: PRIORITY.MEDIUM,
                        module: 'link',
                        reason: `Anti-link: ${violations[0].description}`,
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
                        module: 'link',
                        reason: `Anti-link: ${violations[0].description}`
                    });
                }
                break;
                
            case 'quarantine':
                await this.quarantineUser(message, member, violations, config);
                break;
                
            case 'ban':
                if (member.bannable) {
                    await actionQueue.enqueue({
                        type: ACTION_TYPES.BAN_USER,
                        guildId: message.guild.id,
                        targetId: message.author.id,
                        data: { deleteMessageDays: 1 },
                        priority: PRIORITY.CRITICAL,
                        module: 'link',
                        reason: `Anti-link: ${violations[0].description}`,
                        undoData: { action: 'ban' }
                    });
                    
                    
                    this.sendBanDM(member, violations);
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
                module: 'link',
                reason: `Anti-link: ${violations[0].description}`
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
            module: 'link',
            reason: `Anti-link: ${violations[0].description}`,
            undoData: { originalRoles, quarantineRoleId: quarantineConfig.quarantineRoleId }
        });
        
        await UserQuarantine.findOneAndUpdate(
            { userId: member.id, guildId: member.guild.id },
            {
                isQuarantined: true,
                quarantinedAt: new Date(),
                reason: `Anti-link: ${violations[0].description}`
            },
            { upsert: true }
        );
        
        quarantineConfig.userRoles.set(member.id, originalRoles);
        await quarantineConfig.save();
        
        this.sendQuarantineDM(member, violations);
    }
    
    sendBanDM(member, violations) {
        const lang = loadLanguage(member.guild.id);
        const l = lang.antimodules?.link || {};
        const card = buildCard({
            title: `${getEmoji('cross')} ${l.bannedTitle || 'You Have Been Banned'}`,
            description: (l.bannedDesc || 'You have been banned from **{guild}** for posting malicious links.').replace('{guild}', member.guild.name),
            fields: [
                { name: l.reasonLabel || 'Reason', value: violations[0].description, inline: false },
                { name: l.violationTypeLabel || 'Violation Type', value: violations[0].type, inline: true },
                { name: l.severityLabel || 'Severity', value: 'CRITICAL - Phishing/Malware', inline: true }
            ],
            tone: 'danger'
        });
        member.send({ components: [card], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
    }
    
    sendQuarantineDM(member, violations) {
        const lang = loadLanguage(member.guild.id);
        const l = lang.antimodules?.link || {};
        const card = buildCard({
            title: `${getEmoji('warning')} ${l.quarantinedTitle || 'You Have Been Quarantined'}`,
            description: (l.quarantinedDesc || 'You have been quarantined in **{guild}** for posting unauthorized links.').replace('{guild}', member.guild.name),
            fields: [
                { name: l.reasonLabel || 'Reason', value: violations[0].description, inline: false },
                { name: l.linksDetectedLabel || 'Links Detected', value: violations.map(v => v.url || 'Unknown').join('\n').slice(0, 1000), inline: false },
                { name: l.durationLabel || 'Duration', value: 'Until reviewed by staff', inline: true }
            ],
            tone: 'danger'
        });
        member.send({ components: [card], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
    }
    
    async logViolation(message, violations, action, duration, config, threatScore, isDryRun = false) {
        const logChannelId = config.logging?.logChannelId || config.logChannelId;
        const logChannel = this.client.channels.cache.get(logChannelId);
        if (!logChannel) return;

        const lang = loadLanguage(message.guild.id);
        const l = lang.antimodules?.link || {};
        
        const violationsList = violations.map(v =>
            `• **${v.type}** (${v.severity}): ${v.description}\n  URL: \`${v.url || 'N/A'}\``
        ).join('\n').slice(0, 1000);

        const fields = [
            { name: l.userLabel || 'User', value: `${message.author.tag} (${message.author.id})`, inline: true },
            { name: l.channelLabel || 'Channel', value: `<#${message.channel.id}>`, inline: true },
            { name: l.actionLabel || 'Action', value: isDryRun ? `${action.toUpperCase()} (SIMULATED)` : action.toUpperCase(), inline: true },
            { name: l.threatScoreLabel || 'Threat Score', value: `${threatScore.currentScore}/100 (${threatScore.riskLevel})`, inline: true },
            { name: l.riskLevelLabel || 'Risk Level', value: threatScore.riskLevel.toUpperCase(), inline: true },
            { name: l.violationsLabel || 'Violations', value: violationsList, inline: false }
        ];

        const evasionViolation = violations.find(v => v.type === 'link_evasion' || v.data?.evasionScore > 0);
        if (evasionViolation) {
            fields.push({
                name: `${getEmoji('warning')} ${l.evasionDetectedLabel || 'Evasion Detected'}`,
                value: `Flags: ${evasionViolation.data?.flags?.join(', ') || 'Unknown'}`,
                inline: false
            });
        }

        const titleText = isDryRun ? (l.detectionDryRunTitle || 'Anti-Link Detection (DRY RUN)') : (l.detectionTitle || 'Anti-Link Detection');
        const card = buildCard({
            title: `${getEmoji('security')} ${titleText}`,
            description: config.logging?.includeMessageContent !== false ? `**${l.messageContentLabel || 'Message'}:** ${message.content.slice(0, 500)}` : undefined,
            fields,
            tone: action === 'ban' || action === 'quarantine' ? 'danger' : 'warning'
        });

        await logChannel.send({ components: [card], flags: MessageFlags.IsComponentsV2 });
        
        
        if (threatScore.currentScore >= 70 || violations.some(v => v.severity === 'critical')) {
            await this.sendHighThreatAlert(message, violations, threatScore, config);
        }
    }
    
    async sendHighThreatAlert(message, violations, threatScore, config) {
        const alertChannelId = config.logging?.alertChannelId || config.alertChannelId;
        if (!alertChannelId || alertChannelId === config.logging?.logChannelId) return;
        
        const alertChannel = this.client.channels.cache.get(alertChannelId);
        if (!alertChannel) return;
        
        const hasCritical = violations.some(v => v.severity === 'critical');
        const lang = loadLanguage(message.guild.id);
        const l = lang.antimodules?.link || {};

        const titleText = hasCritical ? (l.criticalThreatTitle || 'CRITICAL THREAT DETECTED') : (l.highThreatTitle || 'HIGH THREAT DETECTED');
        const card = buildCard({
            title: `${getEmoji('fire')} ${titleText}`,
            description: (l.highThreatDesc || 'User **{user}** posted malicious/suspicious links').replace('{user}', message.author.tag),
            fields: [
                { name: l.threatScoreLabel || 'Threat Score', value: `${threatScore.currentScore}/100`, inline: true },
                { name: l.riskLevelLabel || 'Risk Level', value: threatScore.riskLevel.toUpperCase(), inline: true },
                { name: l.criticalViolationsLabel || 'Critical Violations', value: hasCritical ? 'YES' : 'NO', inline: true },
                { name: l.linksDetectedLabel || 'Links', value: violations.map(v => v.url || 'Unknown').join('\n').slice(0, 500), inline: false }
            ],
            tone: 'danger'
        });
        
        await alertChannel.send({ content: hasCritical ? '@everyone' : '@here' });
        await alertChannel.send({ 
            components: [card],
            flags: MessageFlags.IsComponentsV2
        });
    }
    
    logWhitelistedAction(message, violations, config) {
        const staffChannelId = config.logging?.staffChannelId;
        if (!staffChannelId) return;
        
        const staffChannel = this.client.channels.cache.get(staffChannelId);
        if (!staffChannel) return;
        
        if (violations.length === 0) return;
        
        const violationSummary = violations.map(v => `• ${v.type}: ${v.url || 'Unknown'}').join('\n`);
        const lang = loadLanguage(message.guild.id);
        const l = lang.antimodules?.link || {};

        const card = buildCard({
            title: `${getEmoji('document')} ${l.whitelistedTitle || 'Whitelisted User - Link Violations Bypassed'}`,
            description: (l.whitelistedDesc || 'Whitelisted user **{user}** posted links that would trigger detection').replace('{user}', message.author.tag),
            fields: [
                { name: l.channelLabel || 'Channel', value: `<#${message.channel.id}>`, inline: true },
                { name: l.violationsLabel || 'Violations Detected', value: violationSummary.slice(0, 500) || 'N/A', inline: false },
                { name: 'Note', value: `${getEmoji('warning')} ${l.whitelistedNote || 'No action taken - user is whitelisted'}`, inline: false }
            ],
            tone: 'warning'
        });
        
        staffChannel.send({ components: [card], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
    }

    isDomainBlocked(hostname, blockedDomains) {
        if (!blockedDomains || blockedDomains.length === 0) return false;
        return blockedDomains.some(domain =>
            hostname === domain || hostname.endsWith('.' + domain)
        );
    }
    
    isDomainAllowed(hostname, allowedDomains) {
        if (!allowedDomains || allowedDomains.length === 0) return false;
        return allowedDomains.some(domain =>
            hostname === domain || hostname.endsWith('.' + domain)
        );
    }
    
    isIPLink(hostname) {
        const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
        const ipv6Regex = /^([0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}$/i;
        return ipv4Regex.test(hostname) || ipv6Regex.test(hostname);
    }
    
    isUrlShortener(hostname) {
        return this.urlShorteners.some(shortener =>
            hostname === shortener || hostname.endsWith('.' + shortener)
        );
    }
    
    hasSuspiciousTLD(hostname) {
        return this.suspiciousTLDs.some(tld => hostname.endsWith(tld));
    }
    
    async isWhitelisted(user, channel, config) {
        const member = channel.guild.members.cache.get(user.id);
        if (!member) return false;
        
        if (user.id === channel.guild.ownerId) return true;
        if (config.whitelist?.owners?.includes(user.id)) return true;
        if (config.whitelist?.customMembers?.includes(user.id)) return true;
        if (config.whitelist?.customChannels?.includes(channel.id)) return true;
        if (config.antiLink?.whitelistedChannels?.includes(channel.id)) return true;
        
        const hasWhitelistedRole = member.roles.cache.some(role =>
            config.whitelist?.customRoles?.includes(role.id) ||
            config.antiLink?.whitelistedRoles?.includes(role.id)
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
        const MAX_SIZE = 10000;
        
        
        for (const [key, cached] of this.linkCache.entries()) {
            if (now - cached.timestamp > 60 * 60 * 1000) {
                this.linkCache.delete(key);
            }
        }
        
        
        for (const [key, cached] of this.phishingCache.entries()) {
            if (now - cached.timestamp > 60 * 60 * 1000) {
                this.phishingCache.delete(key);
            }
        }
        
        
        if (this.linkCache.size > MAX_SIZE) {
            const entries = Array.from(this.linkCache.entries())
                .sort((a, b) => a[1].timestamp - b[1].timestamp);
            const toRemove = entries.slice(0, this.linkCache.size - MAX_SIZE);
            for (const [key] of toRemove) {
                this.linkCache.delete(key);
            }
        }
    }
}

module.exports = AntiLinkModule;
