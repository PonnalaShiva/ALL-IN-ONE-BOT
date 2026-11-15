


const { PermissionsBitField, ChannelType, MessageFlags } = require('discord.js');
const { buildCard } = require('../UI');
const { getEmoji, getButtonEmoji } = require('../UI/emojis/emoji');
const loadLanguage = require('../events/loadLanguage');
const AntiConfig = require('../models/antiSystem/AntiConfig');
const UserViolation = require('../models/antiSystem/UserViolation');
const ThreatScore = require('../models/antiSystem/ThreatScore');
const { getActionQueue, ACTION_TYPES, PRIORITY } = require('../utils/actionQueue');
const { registerInteractionHandler } = require('../utils/interactionRouter');

class AntiRaidModule {
    constructor(client) {
        this.client = client;
        this.unregisterInteractionRoute = null;
        this.clientListeners = [];
        this.cleanupTimer = null;
        this.raidCooldownTimer = null;
        this.joinTracker = new Map();           
        this.suspiciousAccounts = new Map();    
        this.raidWave = new Map();              
        this.lockdownState = new Map();         
        this.verificationQueue = new Map();     
        this.actionQueue = null;
        
        
        this.namePatterns = new Map();          
        this.avatarHashes = new Map();          
        
        
        this.RAID_LEVELS = {
            NONE: 0,
            LOW: 1,      
            MODERATE: 2,  
            HIGH: 3,      
            CRITICAL: 4   
        };
        this.initialize();
    }
    
    initialize() {
        
        this.bindClientEvent('guildMemberAdd', async (member) => {
            await this.handleMemberJoin(member);
        });
        
        
        this.bindClientEvent('guildMemberRemove', async (member) => {
            await this.handleMemberLeave(member);
        });
        
        
        this.unregisterInteractionRoute = registerInteractionHandler(this.client, {
            name: 'anti-raid-verification',
            prefixes: ['antiraid_verify_'],
            types: ['button'],
            handler: interaction => this.handleVerification(interaction)
        });
        
        
        this.cleanupTimer = setInterval(() => this.cleanup(), 60 * 1000);
        this.cleanupTimer.unref?.();
        
        
        this.raidCooldownTimer = setInterval(() => this.checkRaidCooldown(), 30 * 1000);
        this.raidCooldownTimer.unref?.();
        
        
        this.actionQueue = getActionQueue(this.client);
    }

    bindClientEvent(eventName, callback, once = false) {
        const listener = (...args) => callback(...args);
        this.clientListeners.push({ eventName, listener });
        (once ? this.client.once : this.client.on).call(this.client, eventName, listener);
    }

    stop() {
        for (const { eventName, listener } of this.clientListeners) this.client.off(eventName, listener);
        this.clientListeners = [];
        this.unregisterInteractionRoute?.();
        this.unregisterInteractionRoute = null;
        if (this.cleanupTimer) clearInterval(this.cleanupTimer);
        if (this.raidCooldownTimer) clearInterval(this.raidCooldownTimer);
        this.cleanupTimer = null;
        this.raidCooldownTimer = null;
        for (const queue of this.verificationQueue.values()) {
            for (const data of queue.values()) {
                if (data.timer) clearTimeout(data.timer);
            }
        }
        this.joinTracker.clear();
        this.suspiciousAccounts.clear();
        this.raidWave.clear();
        this.lockdownState.clear();
        this.verificationQueue.clear();
        this.namePatterns.clear();
        this.avatarHashes.clear();
    }
    
    async handleMemberJoin(member) {
        try {
            const { getAntiConfig } = require('../utils/cacheHelpers');
            const config = await getAntiConfig(member.guild.id);
            
            if (!config?.antiRaid?.enabled) return;
            
            const guildId = member.guild.id;
            const raidConfig = config.antiRaid;
            
            
            this.initGuildTrackers(guildId);
            
            
            const tracker = this.joinTracker.get(guildId);
            const now = Date.now();
            
            tracker.joins.push({
                userId: member.id,
                timestamp: now,
                accountAge: now - member.user.createdTimestamp,
                username: member.user.username,
                discriminator: member.user.discriminator,
                avatar: member.user.avatar,
                avatarHash: this.hashAvatar(member.user)
            });
            
            
            const joinWindow = raidConfig.joinWindow || 10000;
            tracker.joins = tracker.joins.filter(j => now - j.timestamp < joinWindow * 3);
            
            
            const patterns = this.detectRaidPatterns(member, tracker, raidConfig);
            const riskScore = this.calculateJoinRiskScore(member, patterns, raidConfig);
            
            
            const newRaidLevel = this.evaluateRaidLevel(tracker, raidConfig);
            
            if (newRaidLevel > tracker.raidLevel) {
                tracker.raidLevel = newRaidLevel;
                await this.handleRaidLevelChange(member.guild, newRaidLevel, tracker, config);
            }
            
            
            await this.processJoin(member, patterns, riskScore, tracker.raidLevel, config);
            
        } catch (error) {
            console.error('[ANTI-RAID] Error:', error);
        }
    }
    
    initGuildTrackers(guildId) {
        if (!this.joinTracker.has(guildId)) {
            this.joinTracker.set(guildId, {
                joins: [],
                raidLevel: this.RAID_LEVELS.NONE,
                lastRaidTime: null,
                raidCount: 0
            });
        }
        
        if (!this.raidWave.has(guildId)) {
            this.raidWave.set(guildId, {
                active: false,
                members: [],
                startTime: null,
                patterns: []
            });
        }
        
        if (!this.namePatterns.has(guildId)) {
            this.namePatterns.set(guildId, new Map());
        }
        
        if (!this.avatarHashes.has(guildId)) {
            this.avatarHashes.set(guildId, new Map());
        }
        
        if (!this.suspiciousAccounts.has(guildId)) {
            this.suspiciousAccounts.set(guildId, new Set());
        }
    }
    
    detectRaidPatterns(member, tracker, config) {
        const patterns = {
            highJoinRate: false,
            similarNames: false,
            sameAvatars: false,
            newAccounts: false,
            defaultAvatars: false,
            sequentialNames: false,
            botNames: false,
            suspiciousTimezone: false
        };
        
        const now = Date.now();
        const joinWindow = config.joinWindow || 10000;
        const recentJoins = tracker.joins.filter(j => now - j.timestamp < joinWindow);
        
        
        const joinThreshold = config.joinThreshold || 5;
        patterns.highJoinRate = recentJoins.length >= joinThreshold;
        
        
        const nameThreshold = config.similarNameThreshold || 3;
        patterns.similarNames = this.detectSimilarNames(recentJoins, nameThreshold);
        
        
        const avatarThreshold = config.sameAvatarThreshold || 3;
        patterns.sameAvatars = this.detectSameAvatars(recentJoins, avatarThreshold);
        
        
        const accountAgeThreshold = config.accountAgeThreshold || 7 * 24 * 60 * 60 * 1000;
        const newAccounts = recentJoins.filter(j => j.accountAge < accountAgeThreshold);
        patterns.newAccounts = newAccounts.length >= Math.max(2, joinThreshold / 2);
        
        
        const defaultAvatars = recentJoins.filter(j => !j.avatar);
        patterns.defaultAvatars = defaultAvatars.length >= Math.max(2, joinThreshold / 2);
        
        
        patterns.sequentialNames = this.detectSequentialNames(recentJoins);
        
        
        patterns.botNames = this.detectBotNames(recentJoins);
        
        
        this.trackNamePattern(member.guild.id, member.user.username);
        
        return patterns;
    }
    
    detectSimilarNames(joins, threshold) {
        if (joins.length < threshold) return false;
        
        const nameGroups = new Map();
        
        for (const join of joins) {
            const normalized = this.normalizeUsername(join.username);
            const basePattern = this.extractBasePattern(normalized);
            
            const count = (nameGroups.get(basePattern) || 0) + 1;
            nameGroups.set(basePattern, count);
            
            if (count >= threshold) return true;
        }
        
        return false;
    }
    
    normalizeUsername(username) {
        return username
            .toLowerCase()
            .replace(/[0-9]/g, '#')
            .replace(/[^a-z#]/g, '')
            .slice(0, 8);
    }
    
    extractBasePattern(normalized) {
        
        return normalized.replace(/#/g, '');
    }
    
    detectSameAvatars(joins, threshold) {
        if (joins.length < threshold) return false;
        
        const avatarGroups = new Map();
        
        for (const join of joins) {
            const hash = join.avatarHash;
            const count = (avatarGroups.get(hash) || 0) + 1;
            avatarGroups.set(hash, count);
            
            if (count >= threshold) return true;
        }
        
        return false;
    }
    
    detectSequentialNames(joins) {
        
        const numbers = [];
        
        for (const join of joins) {
            const match = join.username.match(/(\d+)$/);
            if (match) {
                numbers.push(parseInt(match[1]));
            }
        }
        
        if (numbers.length < 3) return false;
        
        numbers.sort((a, b) => a - b);
        
        let sequential = 0;
        for (let i = 1; i < numbers.length; i++) {
            if (numbers[i] - numbers[i - 1] <= 2) {
                sequential++;
            }
        }
        
        return sequential >= 2;
    }
    
    detectBotNames(joins) {
        const botPatterns = [
            /^[a-z]{3,8}\d{4,}$/i,           
            /^user\d+$/i,                     
            /^bot\d+$/i,                      
            /^[a-f0-9]{8,}$/i,               
            /^[a-z]+_[a-z]+_\d+$/i,          
            /^.{1,3}$/                        
        ];
        
        let botCount = 0;
        
        for (const join of joins) {
            if (botPatterns.some(pattern => pattern.test(join.username))) {
                botCount++;
            }
        }
        
        return botCount >= 2;
    }
    
    trackNamePattern(guildId, username) {
        const patterns = this.namePatterns.get(guildId);
        const normalized = this.normalizeUsername(username);
        const base = this.extractBasePattern(normalized);
        
        if (base.length >= 3) {
            const count = (patterns.get(base) || 0) + 1;
            patterns.set(base, count);
        }
    }
    
    hashAvatar(user) {
        if (!user.avatar) return 'default';
        return user.avatar;
    }
    
    calculateJoinRiskScore(member, patterns, config) {
        let score = 0;
        
        
        const accountAge = Date.now() - member.user.createdTimestamp;
        const accountAgeThreshold = config.accountAgeThreshold || 7 * 24 * 60 * 60 * 1000;
        
        
        if (accountAge < 24 * 60 * 60 * 1000) {
            score += 30;
        } else if (accountAge < 7 * 24 * 60 * 60 * 1000) {
            score += 15;
        } else if (accountAge < accountAgeThreshold) {
            score += 5;
        }
        
        
        if (!member.user.avatar) score += 10;
        
        
        if (member.user.discriminator === '0') {
            
            score += 5;
        }
        
        
        if (patterns.highJoinRate) score += 25;
        if (patterns.similarNames) score += 20;
        if (patterns.sameAvatars) score += 20;
        if (patterns.newAccounts) score += 15;
        if (patterns.defaultAvatars) score += 15;
        if (patterns.sequentialNames) score += 25;
        if (patterns.botNames) score += 20;
        
        
        const crossServerData = this.getCrossServerData(member.id);
        if (crossServerData.isKnownRaider) {
            score += 40;
        }
        
        return Math.min(score, 100);
    }
    
    getCrossServerData(userId) {
        
        return {
            isKnownRaider: false 
        };
    }
    
    evaluateRaidLevel(tracker, config) {
        const now = Date.now();
        const joinWindow = config.joinWindow || 10000;
        const recentJoins = tracker.joins.filter(j => now - j.timestamp < joinWindow);
        
        const joinThreshold = config.joinThreshold || 5;
        const joinRate = recentJoins.length;
        
        
        const accountAgeThreshold = config.accountAgeThreshold || 7 * 24 * 60 * 60 * 1000;
        const newAccountRatio = recentJoins.filter(j => j.accountAge < accountAgeThreshold).length / Math.max(1, recentJoins.length);
        
        
        if (joinRate >= joinThreshold * 3 || (joinRate >= joinThreshold && newAccountRatio >= 0.8)) {
            return this.RAID_LEVELS.CRITICAL;
        }
        
        
        if (joinRate >= joinThreshold * 2 || (joinRate >= joinThreshold && newAccountRatio >= 0.6)) {
            return this.RAID_LEVELS.HIGH;
        }
        
        
        if (joinRate >= joinThreshold) {
            return this.RAID_LEVELS.MODERATE;
        }
        
        
        if (joinRate >= Math.floor(joinThreshold * 0.6)) {
            return this.RAID_LEVELS.LOW;
        }
        
        return this.RAID_LEVELS.NONE;
    }
    
    async handleRaidLevelChange(guild, newLevel, tracker, config) {
        const raidConfig = config.antiRaid;
        
        
        await this.logRaidLevel(guild, newLevel, tracker, config);
        
        
        switch (newLevel) {
            case this.RAID_LEVELS.LOW:
                await this.handleLowLevel(guild, config);
                break;
                
            case this.RAID_LEVELS.MODERATE:
                await this.handleModerateLevel(guild, config);
                break;
                
            case this.RAID_LEVELS.HIGH:
                await this.handleHighLevel(guild, tracker, config);
                break;
                
            case this.RAID_LEVELS.CRITICAL:
                await this.handleCriticalLevel(guild, tracker, config);
                break;
        }
    }
    
    async handleLowLevel(guild, config) {
        
        if (config.antiRaid.progressiveResponse?.lowLevel?.enableVerification) {
            await this.enableVerificationMode(guild, config);
        }
    }
    
    async handleModerateLevel(guild, config) {
        
        if (config.antiRaid.progressiveResponse?.moderateLevel?.enableVerification !== false) {
            await this.enableVerificationMode(guild, config);
        }
        
        
        if (config.antiRaid.progressiveResponse?.moderateLevel?.slowMode) {
            await this.setSlowMode(guild, config.antiRaid.progressiveResponse.moderateLevel.slowMode);
        }
    }
    
    async handleHighLevel(guild, tracker, config) {
        
        await this.enableVerificationMode(guild, config);
        
        
        if (config.antiRaid.progressiveResponse?.highLevel?.lockChannels) {
            await this.lockNewMemberChannels(guild, config);
        }
        
        
        const now = Date.now();
        const joinWindow = config.antiRaid.joinWindow || 10000;
        const recentJoins = tracker.joins.filter(j => now - j.timestamp < joinWindow);
        
        for (const join of recentJoins) {
            const member = guild.members.cache.get(join.userId);
            if (member) {
                const accountAge = join.accountAge;
                const accountAgeThreshold = config.antiRaid.accountAgeThreshold || 7 * 24 * 60 * 60 * 1000;
                
                if (accountAge < accountAgeThreshold) {
                    await this.quarantineRaider(member, 'High raid level - suspicious new account', config);
                }
            }
        }
    }
    
    async handleCriticalLevel(guild, tracker, config) {
        
        await this.enableVerificationMode(guild, config);
        
        
        if (config.antiRaid.progressiveResponse?.criticalLevel?.fullLockdown !== false) {
            await this.fullLockdown(guild, config);
        }
        
        
        const now = Date.now();
        const joinWindow = config.antiRaid.joinWindow || 10000;
        const recentJoins = tracker.joins.filter(j => now - j.timestamp < joinWindow * 2);
        
        for (const join of recentJoins) {
            const member = guild.members.cache.get(join.userId);
            if (member && member.kickable) {
                
                const accountAge = join.accountAge;
                const accountAgeThreshold = config.antiRaid.accountAgeThreshold || 7 * 24 * 60 * 60 * 1000;
                
                if (accountAge < accountAgeThreshold) {
                    await this.actionQueue.enqueue({
                        type: ACTION_TYPES.KICK_USER,
                        guildId: guild.id,
                        targetId: join.userId,
                        priority: PRIORITY.CRITICAL,
                        module: 'raid',
                        reason: 'Anti-raid: Critical raid level - new account'
                    });
                }
            }
        }
        
        
        this.raidWave.set(guild.id, {
            active: true,
            members: recentJoins.map(j => j.userId),
            startTime: now,
            patterns: ['CRITICAL']
        });
        
        
        await this.notifyOwner(guild, tracker, config);
    }
    
    async processJoin(member, patterns, riskScore, raidLevel, config) {
        const guildId = member.guild.id;
        const raidConfig = config.antiRaid;
        
        
        const isDryRun = config.systemMode?.mode === 'dry-run' || config.systemMode?.mode === 'log-only';
        
        
        if (raidLevel >= this.RAID_LEVELS.HIGH) {
            
            const accountAge = Date.now() - member.user.createdTimestamp;
            const accountAgeThreshold = raidConfig.accountAgeThreshold || 7 * 24 * 60 * 60 * 1000;
            
            if (riskScore >= 50 || accountAge < accountAgeThreshold) {
                if (!isDryRun) {
                    await this.quarantineRaider(member, 'Active raid - high risk score', config);
                }
                await this.logJoin(member, patterns, riskScore, 'quarantine', isDryRun, config);
            } else if (riskScore >= 30) {
                if (!isDryRun) {
                    await this.requireVerification(member, config);
                }
                await this.logJoin(member, patterns, riskScore, 'verification', isDryRun, config);
            }
        } else if (raidLevel >= this.RAID_LEVELS.MODERATE) {
            
            if (riskScore >= 40) {
                if (!isDryRun) {
                    await this.requireVerification(member, config);
                }
                await this.logJoin(member, patterns, riskScore, 'verification', isDryRun, config);
            }
        } else if (raidLevel === this.RAID_LEVELS.LOW || riskScore >= 60) {
            
            await this.logJoin(member, patterns, riskScore, 'monitoring', isDryRun, config);
        }
        
        
        if (raidConfig.autorole?.enabled && raidLevel < this.RAID_LEVELS.MODERATE) {
            await this.applyAutoRole(member, config);
        }
    }
    
    async quarantineRaider(member, reason, config) {
        const QuarantineConfig = require('../models/qurantine/quarantineConfig');
        const UserQuarantine = require('../models/qurantine/userQuarantine');
        
        const quarantineConfig = await QuarantineConfig.findOne({ guildId: member.guild.id });
        
        if (quarantineConfig?.quarantineEnabled && quarantineConfig.quarantineRoleId) {
            const quarantineRole = member.guild.roles.cache.get(quarantineConfig.quarantineRoleId);
            
            if (quarantineRole) {
                const originalRoles = member.roles.cache
                    .filter(role => role.id !== member.guild.id && role.id !== quarantineConfig.quarantineRoleId)
                    .map(role => role.id);
                
                await this.actionQueue.enqueue({
                    type: ACTION_TYPES.QUARANTINE_USER,
                    guildId: member.guild.id,
                    targetId: member.id,
                    data: {
                        quarantineRoleId: quarantineConfig.quarantineRoleId,
                        originalRoles
                    },
                    priority: PRIORITY.HIGH,
                    module: 'raid',
                    reason: `Anti-raid: ${reason}`,
                    undoData: { originalRoles, quarantineRoleId: quarantineConfig.quarantineRoleId }
                });
                
                await UserQuarantine.findOneAndUpdate(
                    { userId: member.id, guildId: member.guild.id },
                    {
                        isQuarantined: true,
                        quarantinedAt: new Date(),
                        reason: `Anti-raid: ${reason}`
                    },
                    { upsert: true }
                );
                
                quarantineConfig.userRoles.set(member.id, originalRoles);
                await quarantineConfig.save();
                
                
                let threatScore = await ThreatScore.getOrCreate(member.id, member.guild.id);
                await threatScore.addViolation({
                    type: 'raid_participation',
                    severity: 'critical',
                    module: 'raid',
                    reason
                });
                await threatScore.addAction({
                    type: 'quarantine',
                    reason,
                    automated: true,
                    triggerModule: 'raid'
                });
                await threatScore.save();
                
                return;
            }
        }
        
        
        if (member.kickable) {
            await this.actionQueue.enqueue({
                type: ACTION_TYPES.KICK_USER,
                guildId: member.guild.id,
                targetId: member.id,
                priority: PRIORITY.HIGH,
                module: 'raid',
                reason: `Anti-raid: ${reason}`
            });
        }
    }
    
    async requireVerification(member, config) {
        const guildId = member.guild.id;
        
        if (!this.verificationQueue.has(guildId)) {
            this.verificationQueue.set(guildId, new Map());
        }
        
        const queue = this.verificationQueue.get(guildId);
        const verificationTimeout = config.antiRaid.verificationTimeout || 300000;
        const previousVerification = queue.get(member.id);
        if (previousVerification?.timer) clearTimeout(previousVerification.timer);
        
        const verificationData = {
            timestamp: Date.now(),
            timeout: verificationTimeout,
            verified: false,
            timer: null
        };
        queue.set(member.id, verificationData);
        
        
        const unverifiedRoleId = config.antiRaid.unverifiedRoleId;
        if (unverifiedRoleId) {
            const unverifiedRole = member.guild.roles.cache.get(unverifiedRoleId);
            if (unverifiedRole) {
                await member.roles.add(unverifiedRole).catch(() => {});
            }
        }
        
        
        await this.sendVerificationDM(member, config);
        
        
        verificationData.timer = setTimeout(async () => {
            const memberQueue = this.verificationQueue.get(guildId)?.get(member.id);
            if (memberQueue && !memberQueue.verified) {
                const currentMember = member.guild.members.cache.get(member.id);
                if (currentMember?.kickable) {
                    await this.actionQueue.enqueue({
                        type: ACTION_TYPES.KICK_USER,
                        guildId: member.guild.id,
                        targetId: member.id,
                        priority: PRIORITY.MEDIUM,
                        module: 'raid',
                        reason: 'Anti-raid: Verification timeout'
                    });
                }
                this.verificationQueue.get(guildId)?.delete(member.id);
            }
        }, verificationTimeout);
    }
    
    async sendVerificationDM(member, config) {
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const lang = loadLanguage(member.guild.id);
        const r = lang.antimodules?.raid || {};
        
        const card = buildCard({
            title: `${getEmoji('lock')} ${r.verificationRequiredTitle || 'Verification Required'}`,
            description: (r.verificationRequiredDesc || "Welcome to **{guild}**! Due to security measures, please verify you're human.").replace('{guild}', member.guild.name),
            fields: [
                { name: 'Why am I seeing this?', value: 'Our anti-raid system has detected suspicious activity.', inline: false },
                { name: 'Time Limit', value: `You have ${Math.floor((config.antiRaid?.verificationTimeout || 300000) / 60000)} minutes to verify.`, inline: true }
            ],
            tone: 'warning'
        });
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`antiraid_verify_${member.guild.id}_${member.id}`)
                    .setLabel(r.btnVerify || 'Verify Me')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji(getButtonEmoji('tick'))
            );
        
        card.addActionRowComponents(row);
        await member.send({ components: [card], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
    }
    
    async handleVerification(interaction) {
        const parts = interaction.customId.split('_');
        const [, , guildId, userId, ...extra] = parts;
        if (parts.length !== 4 || extra.length || !guildId || !userId) {
            return interaction.reply({ content: 'This verification link is invalid.', flags: MessageFlags.Ephemeral });
        }
        
        if (interaction.user.id !== userId) {
            return interaction.reply({ content: 'This verification is not for you.', flags: MessageFlags.Ephemeral });
        }
        
        const queue = this.verificationQueue.get(guildId);
        if (!queue?.has(userId)) {
            return interaction.reply({ content: 'Verification expired or already processed.', flags: MessageFlags.Ephemeral });
        }
        
        const verificationData = queue.get(userId);
        if (verificationData.processing) {
            return interaction.reply({ content: 'Your verification is already being processed.', flags: MessageFlags.Ephemeral });
        }

        verificationData.processing = true;
        try {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            
            const { getAntiConfig } = require('../utils/cacheHelpers');
            const config = await getAntiConfig(guildId);

            const guild = this.client.guilds.cache.get(guildId);
            const member = guild?.members.cache.get(userId);
            if (!member || !queue.has(userId) || queue.get(userId) !== verificationData) {
                queue.delete(userId);
                if (verificationData.timer) clearTimeout(verificationData.timer);
                await interaction.editReply({ content: 'Verification expired because you are no longer in the server.' });
                return;
            }

            
            const unverifiedRoleId = config?.antiRaid?.unverifiedRoleId;
            if (unverifiedRoleId) await member.roles.remove(unverifiedRoleId);

            await this.applyAutoRole(member, config);

            verificationData.verified = true;
            if (verificationData.timer) clearTimeout(verificationData.timer);
            queue.delete(userId);

            await interaction.editReply({
                content: `${getEmoji('tick')} ${loadLanguage(guildId)?.antimodules?.raid?.verifiedSuccess || 'You have been verified! Welcome to the server.'}`
            });

            
            await this.logVerification(member, config).catch(error => {
                console.error('[ANTI-RAID] Verification succeeded but logging failed:', error);
            });
        } catch (error) {
            verificationData.processing = false;
            console.error('[ANTI-RAID] Verification could not be completed:', error);
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: 'Verification could not be completed. Please try again.' }).catch(() => {});
            } else {
                await interaction.reply({ content: 'Verification could not be completed. Please try again.', flags: MessageFlags.Ephemeral }).catch(() => {});
            }
        }
    }
    
    async applyAutoRole(member, config) {
        if (!config?.antiRaid?.autorole?.enabled || !config.antiRaid.autorole.roleId) return;
        
        const autoRole = member.guild.roles.cache.get(config.antiRaid.autorole.roleId);
        if (autoRole && autoRole.position < member.guild.members.me.roles.highest.position) {
            await member.roles.add(autoRole).catch(() => {});
        }
    }
    
    async enableVerificationMode(guild, config) {
        
        const verificationChannelId = config.antiRaid.verificationChannelId;
        if (!verificationChannelId) return;
        
        const channel = guild.channels.cache.get(verificationChannelId);
        if (!channel) return;
        
        const lang = loadLanguage(guild.id);
        const r = lang.antimodules?.raid || {};
        const card = buildCard({
            title: `${getEmoji('security')} ${r.verificationModeEnabledTitle || 'Verification Mode Enabled'}`,
            description: r.verificationModeEnabledDesc || 'Due to suspicious activity, new members must verify before accessing the server.',
            tone: 'warning'
        });
        
        await channel.send({ components: [card], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
    }
    
    async setSlowMode(guild, duration) {
        
        const textChannels = guild.channels.cache.filter(c =>
            c.type === ChannelType.GuildText &&
            !c.permissionsFor(guild.roles.everyone).has(PermissionsBitField.Flags.Administrator)
        );
        
        for (const [, channel] of textChannels) {
            if (channel.manageable) {
                await channel.setRateLimitPerUser(duration).catch(() => {});
            }
        }
    }
    
    async lockNewMemberChannels(guild, config) {
        const channelsToLock = config.antiRaid.progressiveResponse?.highLevel?.lockChannelIds || [];
        
        const lockdownData = {
            locked: true,
            lockedChannels: [],
            timestamp: Date.now()
        };
        
        for (const channelId of channelsToLock) {
            const channel = guild.channels.cache.get(channelId);
            if (channel && channel.manageable) {
                const currentPerms = channel.permissionOverwrites.cache.get(guild.roles.everyone.id);
                
                lockdownData.lockedChannels.push({
                    channelId,
                    previousPerms: currentPerms?.deny?.bitfield || 0
                });
                
                await channel.permissionOverwrites.edit(guild.roles.everyone, {
                    SendMessages: false
                }).catch(() => {});
            }
        }
        
        this.lockdownState.set(guild.id, lockdownData);
    }
    
    async fullLockdown(guild, config) {
        const actionQueue = getActionQueue(this.client);
        
        await actionQueue.enqueue({
            type: ACTION_TYPES.SERVER_LOCKDOWN,
            guildId: guild.id,
            priority: PRIORITY.CRITICAL,
            module: 'raid',
            reason: 'Anti-raid: Critical raid level detected'
        });
        
        this.lockdownState.set(guild.id, {
            locked: true,
            fullLockdown: true,
            timestamp: Date.now()
        });
    }
    
    async notifyOwner(guild, tracker, config) {
        const owner = await guild.fetchOwner().catch(() => null);
        if (!owner) return;
        
        const lang = loadLanguage(guild.id);
        const r = lang.antimodules?.raid || {};
        const card = buildCard({
            title: `${getEmoji('fire')} ${r.criticalRaidTitle || 'CRITICAL: Server Under Raid Attack'}`,
            description: `**${guild.name}** is experiencing a large-scale raid attack!`,
            fields: [
                { name: 'Raid Level', value: 'CRITICAL', inline: true },
                { name: 'Recent Joins', value: tracker.joins.length.toString(), inline: true },
                { name: 'Status', value: 'Lockdown Activated', inline: true }
            ],
            tone: 'danger'
        });
        
        await owner.send({ components: [card], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
        
        const alertChannelId = config.logging?.alertChannelId || config.alertChannelId;
        if (alertChannelId) {
            const alertChannel = guild.channels.cache.get(alertChannelId);
            if (alertChannel) {
                await alertChannel.send({ content: '@everyone' }).catch(() => {});
                await alertChannel.send({
                    components: [card],
                    flags: MessageFlags.IsComponentsV2
                }).catch(() => {});
            }
        }
    }
    
    async handleMemberLeave(member) {
        
        const guildId = member.guild.id;
        const tracker = this.joinTracker.get(guildId);
        
        if (!tracker) return;
        
        const join = tracker.joins.find(j => j.userId === member.id);
        if (join) {
            const timeInServer = Date.now() - join.timestamp;
            
            
            if (timeInServer < 30000) {
                this.suspiciousAccounts.get(guildId)?.add(member.id);
                
                
                let threatScore = await ThreatScore.findOne({
                    odUserId: member.id,
                    guildId: member.guild.id
                });
                
                if (threatScore) {
                    await threatScore.addViolation({
                        type: 'raid_bounce',
                        severity: 'medium',
                        module: 'raid',
                        reason: 'Left server immediately after joining during raid'
                    });
                    await threatScore.save();
                }
            }
        }
    }

    async logRaidLevel(guild, level, tracker, config) {
        const logChannelId = config.logging?.logChannelId || config.logChannelId;
        const logChannel = guild.channels.cache.get(logChannelId);
        if (!logChannel) return;
        
        const levelNames = ['NONE', 'LOW', 'MODERATE', 'HIGH', 'CRITICAL'];
        const levelColors = ['#00ff00', '#ffff00', '#ff9900', '#ff3300', '#ff0000'];
        
        const now = Date.now();
        const joinWindow = config.antiRaid?.joinWindow || 10000;
        const recentJoins = tracker.joins.filter(j => now - j.timestamp < joinWindow);
        
        const lang = loadLanguage(guild.id);
        const r = lang.antimodules?.raid || {};

        const fields = [
            { name: 'Level', value: levelNames[level], inline: true },
            { name: 'Recent Joins', value: recentJoins.length.toString(), inline: true },
            { name: 'Window', value: `${joinWindow / 1000}s`, inline: true }
        ];

        if (recentJoins.length > 0) {
            const joinList = recentJoins
                .slice(0, 10)
                .map(j => `<@${j.userId}> (${Math.floor(j.accountAge / 86400000)}d old)`)
                .join('\n');
            fields.push({ name: 'Recent Members', value: joinList, inline: false });
        }

        const card = buildCard({
            title: `${getEmoji('warning')} ${r.raidLevelChangedTitle || 'Raid Level Changed'}`,
            description: (r.raidLevelChangedDesc || 'Raid threat level updated to **{level}**.').replace('{level}', levelNames[level]),
            fields,
            tone: level >= 3 ? 'danger' : 'warning'
        });
        
        await logChannel.send({ components: [card], flags: MessageFlags.IsComponentsV2 });
    }
    
    async logJoin(member, patterns, riskScore, action, isDryRun, config) {
        const logChannelId = config.logging?.logChannelId || config.logChannelId;
        const logChannel = member.guild.channels.cache.get(logChannelId);
        if (!logChannel) return;
        
        const accountAge = Date.now() - member.user.createdTimestamp;
        
        const lang = loadLanguage(member.guild.id);
        const r = lang.antimodules?.raid || {};

        const fields = [
            { name: 'User', value: `${member.user.tag} (${member.id})`, inline: true },
            { name: 'Risk Score', value: `${riskScore}/100`, inline: true },
            { name: 'Action', value: isDryRun ? `${action.toUpperCase()} (SIMULATED)` : action.toUpperCase(), inline: true },
            { name: 'Account Age', value: this.formatDuration(accountAge), inline: true },
            { name: 'Has Avatar', value: member.user.avatar ? 'Yes' : 'No', inline: true }
        ];

        const activePatterns = Object.entries(patterns)
            .filter(([, active]) => active)
            .map(([name]) => name);
        
        if (activePatterns.length > 0) {
            fields.push({ name: 'Patterns Detected', value: activePatterns.join(', '), inline: false });
        }

        const titleText = isDryRun ? (r.suspiciousJoinDryRunTitle || 'Suspicious Join (DRY RUN)') : (r.suspiciousJoinTitle || 'Suspicious Join');
        const card = buildCard({
            title: `${getEmoji('user')} ${titleText}`,
            fields,
            tone: riskScore >= 60 ? 'danger' : 'warning'
        });
        
        await logChannel.send({ components: [card], flags: MessageFlags.IsComponentsV2 });
    }
    
    async logVerification(member, config) {
        const logChannelId = config.logging?.logChannelId || config.logChannelId;
        if (!logChannelId) return;
        
        const logChannel = member.guild.channels.cache.get(logChannelId);
        if (!logChannel) return;
        
        const lang = loadLanguage(member.guild.id);
        const r = lang.antimodules?.raid || {};
        const card = buildCard({
            title: `${getEmoji('tick')} ${r.userVerifiedTitle || 'User Verified'}`,
            description: (r.userVerifiedDesc || 'Member **{user}** passed raid verification.').replace('{user}', member.user.tag),
            tone: 'success'
        });
        
        await logChannel.send({ components: [card], flags: MessageFlags.IsComponentsV2 });
    }
    
    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `${days}d ${hours % 24}h`;
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m`;
        return `${seconds}s`;
    }

    checkRaidCooldown() {
        for (const [guildId, tracker] of this.joinTracker.entries()) {
            if (tracker.raidLevel > this.RAID_LEVELS.NONE) {
                const now = Date.now();
                const joinWindow = 10000; 
                const recentJoins = tracker.joins.filter(j => now - j.timestamp < joinWindow);
                
                
                if (recentJoins.length === 0) {
                    tracker.raidLevel = Math.max(0, tracker.raidLevel - 1);
                    
                    
                    if (tracker.raidLevel === this.RAID_LEVELS.NONE) {
                        this.endRaid(guildId);
                    }
                }
            }
        }
    }
    
    async endRaid(guildId) {
        const lockdownData = this.lockdownState.get(guildId);
        if (!lockdownData?.locked) return;
        
        const guild = this.client.guilds.cache.get(guildId);
        if (!guild) return;
        
        
        if (lockdownData.fullLockdown) {
            await this.actionQueue.enqueue({
                type: ACTION_TYPES.SERVER_UNLOCK,
                guildId: guild.id,
                priority: PRIORITY.MEDIUM,
                module: 'raid',
                reason: 'Anti-raid: Raid ended'
            });
        } else if (lockdownData.lockedChannels) {
            
            for (const channelData of lockdownData.lockedChannels) {
                const channel = guild.channels.cache.get(channelData.channelId);
                if (channel && channel.manageable) {
                    await channel.permissionOverwrites.edit(guild.roles.everyone, {
                        SendMessages: null
                    }).catch(() => {});
                }
            }
        }
        
        this.lockdownState.delete(guildId);
        this.raidWave.set(guildId, { active: false, members: [], startTime: null, patterns: [] });
        
        
        const { getAntiConfig } = require('../utils/cacheHelpers');
        const config = await getAntiConfig(guildId);
        
        const logChannelId = config?.logging?.logChannelId || config?.logChannelId;
        if (logChannelId) {
            const logChannel = guild.channels.cache.get(logChannelId);
            if (logChannel) {
                const lang = loadLanguage(guildId);
                const r = lang.antimodules?.raid || {};
                const card = buildCard({
                    title: `${getEmoji('tick')} ${r.raidEndedTitle || 'Raid Ended'}`,
                    description: r.raidEndedDesc || 'Raid activity has ceased. Server protection returning to normal.',
                    tone: 'success'
                });
                
                await logChannel.send({ components: [card], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
            }
        }
    }
    
    cleanup() {
        const now = Date.now();
        const MAX_AGE = 5 * 60 * 1000; 
        
        
        for (const [, tracker] of this.joinTracker.entries()) {
            tracker.joins = tracker.joins.filter(j => now - j.timestamp < MAX_AGE);
        }
        
        
        for (const [guildId, patterns] of this.namePatterns.entries()) {
            if (patterns.size > 1000) {
                this.namePatterns.set(guildId, new Map());
            }
        }
        
        
        for (const [guildId, hashes] of this.avatarHashes.entries()) {
            if (hashes.size > 1000) {
                this.avatarHashes.set(guildId, new Map());
            }
        }
        
        
        for (const [guildId, queue] of this.verificationQueue.entries()) {
            for (const [userId, data] of queue.entries()) {
                if (now - data.timestamp > data.timeout * 2) {
                    if (data.timer) clearTimeout(data.timer);
                    queue.delete(userId);
                }
            }
        }
    }
}

module.exports = AntiRaidModule;
