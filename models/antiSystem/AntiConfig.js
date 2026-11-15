

const mongoose = require('mongoose');

const modulePunishmentSchema = new mongoose.Schema({
    enabled: { type: Boolean, default: true },
    maxWarnings: { type: Number, default: 3, min: 1, max: 10 },
    warningExpiry: { type: Number, default: 86400000 }, 
    actions: [{
        threshold: { type: Number, required: true }, 
        action: { type: String, enum: ['warn', 'delete', 'timeout', 'kick', 'quarantine', 'ban', 'tempban'], required: true },
        duration: { type: Number, default: 0 }, 
        deleteMessages: { type: Boolean, default: true },
        notifyUser: { type: Boolean, default: true },
        logAction: { type: Boolean, default: true }
    }],
    defaultAction: { type: String, enum: ['warn', 'delete', 'timeout', 'kick', 'quarantine', 'ban'], default: 'warn' }
}, { _id: false });


const roleTrustLevelSchema = new mongoose.Schema({
    roleId: { type: String, required: true },
    roleName: { type: String }, 
    trustLevel: { type: Number, min: 1, max: 100, default: 50 },
    limits: {
        channelDelete: { type: Number, default: 5 },
        channelCreate: { type: Number, default: 10 },
        roleDelete: { type: Number, default: 3 },
        roleCreate: { type: Number, default: 5 },
        memberKick: { type: Number, default: 10 },
        memberBan: { type: Number, default: 5 },
        webhookDelete: { type: Number, default: 3 },
        emojiDelete: { type: Number, default: 10 }
    },
    bypassModules: [{ type: String, enum: ['spam', 'link', 'raid', 'nuke'] }],
    canBypassLockdown: { type: Boolean, default: false }
}, { _id: false });


const blacklistEntrySchema = new mongoose.Schema({
    id: { type: String, required: true }, 
    type: { type: String, enum: ['user', 'server'], required: true },
    reason: { type: String, default: 'No reason provided' },
    addedBy: { type: String }, 
    addedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: null }, 
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    autoAction: { type: String, enum: ['warn', 'kick', 'ban', 'none'], default: 'ban' }
}, { _id: false });

const antiConfigSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true, index: true },

    enabled: { type: Boolean, default: true },
    
    
    systemMode: {
        mode: { type: String, enum: ['active', 'dry-run', 'log-only'], default: 'active' },
        simulateActions: { type: Boolean, default: false },
        logSimulations: { type: Boolean, default: true },
        notifyOnSimulation: { type: Boolean, default: false }
    },
    
    
    logging: {
        logChannelId: { type: String, default: null },
        alertChannelId: { type: String, default: null },
        staffChannelId: { type: String, default: null }, 
        logLevel: { type: String, enum: ['minimal', 'normal', 'verbose', 'debug'], default: 'normal' },
        includeMessageContent: { type: Boolean, default: true },
        includeUserHistory: { type: Boolean, default: true },
        webhookUrl: { type: String, default: null }, 
        embedColor: {
            warn: { type: String, default: '#ffff00' },
            timeout: { type: String, default: '#ff6600' },
            kick: { type: String, default: '#ff3300' },
            ban: { type: String, default: '#ff0000' },
            info: { type: String, default: '#00aaff' }
        }
    },
    
    
    aiSettings: {
        enabled: { type: Boolean, default: true },
        sensitivity: { type: String, enum: ['low', 'medium', 'high', 'paranoid'], default: 'medium' },
        confidenceThreshold: { type: Number, default: 0.7, min: 0, max: 1 },
        useForSpam: { type: Boolean, default: true },
        useForLinks: { type: Boolean, default: true },
        useForRaid: { type: Boolean, default: false },
        modelPreference: { type: String, default: 'default' }
    },

    whitelist: {
        owners: [{ type: String }],
        admins: [{ type: String }],
        customMembers: [{ type: String }],
        customChannels: [{ type: String }],
        customRoles: [{ type: String }],
        customCategories: [{ type: String }], 
        bypassAdmins: { type: Boolean, default: true },
        bypassModerators: { type: Boolean, default: false },
        logWhitelistedActions: { type: Boolean, default: false } 
    },

    blacklist: {
        enabled: { type: Boolean, default: true },
        entries: [blacklistEntrySchema],
        autoSyncGlobal: { type: Boolean, default: false }, 
        actionOnJoin: { type: String, enum: ['warn', 'kick', 'ban', 'none'], default: 'ban' },
        notifyOnMatch: { type: Boolean, default: true }
    },

    roleTrustLevels: {
        enabled: { type: Boolean, default: false },
        levels: [roleTrustLevelSchema],
        defaultTrustLevel: { type: Number, default: 10 },
        trustDecayEnabled: { type: Boolean, default: false },
        trustDecayRate: { type: Number, default: 1 } 
    },

    threatSystem: {
        enabled: { type: Boolean, default: true },
        autoActionThresholds: {
            warn: { type: Number, default: 30 },
            timeout: { type: Number, default: 50 },
            quarantine: { type: Number, default: 70 },
            ban: { type: Number, default: 90 }
        },
        decaySettings: {
            enabled: { type: Boolean, default: true },
            pointsPerHour: { type: Number, default: 2 },
            minScore: { type: Number, default: 0 },
            maxScore: { type: Number, default: 100 },
            decayAfterInactivity: { type: Number, default: 3600000 } 
        },
        crossModuleCorrelation: { type: Boolean, default: true }, 
        historicalWeighting: { type: Boolean, default: true } 
    },

    antiEvasion: {
        enabled: { type: Boolean, default: true },
        normalizeUnicode: { type: Boolean, default: true },
        removeZeroWidth: { type: Boolean, default: true },
        detectHomoglyphs: { type: Boolean, default: true },
        decodeUrls: { type: Boolean, default: true },
        removeInvisibleChars: { type: Boolean, default: true },
        normalizeWhitespace: { type: Boolean, default: true },
        detectLeetSpeak: { type: Boolean, default: true },
        customMappings: { type: Map, of: String, default: new Map() } 
    },

    actionRateLimit: {
        enabled: { type: Boolean, default: true },
        maxActionsPerMinute: { type: Number, default: 15 },
        burstAllowed: { type: Number, default: 5 },
        cooldownMs: { type: Number, default: 500 },
        queueOverflowBehavior: { type: String, enum: ['escalate', 'drop', 'delay'], default: 'escalate' },
        escalationAction: { type: String, enum: ['lockdown', 'alert', 'none'], default: 'alert' },
        perUserLimit: { type: Number, default: 5 }, 
        perChannelLimit: { type: Number, default: 20 } 
    },

    staffMonitoring: {
        enabled: { type: Boolean, default: true },
        logWhitelistedActions: { type: Boolean, default: false }, 
        alertOnBulkActions: { type: Boolean, default: true },
        bulkActionThreshold: { type: Number, default: 5 },
        bulkActionWindow: { type: Number, default: 60000 }, 
        trackPermissionChanges: { type: Boolean, default: true },
        trackRoleAssignments: { type: Boolean, default: true },
        alertOwnerOnSuspicious: { type: Boolean, default: true }
    },

    recoverySystem: {
        enabled: { type: Boolean, default: true },
        snapshotOnLockdown: { type: Boolean, default: true },
        maxSnapshots: { type: Number, default: 5 },
        snapshotRetention: { type: Number, default: 604800000 }, 
        undoTimeLimit: { type: Number, default: 3600000 }, 
        autoRestoreOnFalsePositive: { type: Boolean, default: false },
        backupRoles: { type: Boolean, default: true },
        backupChannels: { type: Boolean, default: true },
        backupPermissions: { type: Boolean, default: true }
    },

    antiSpam: {
        enabled: { type: Boolean, default: true },
        
        
        messageLimit: { type: Number, default: 7, min: 3, max: 30 }, 
        timeWindow: { type: Number, default: 5000, min: 1000, max: 60000 }, 
        duplicateThreshold: { type: Number, default: 4, min: 2, max: 10 }, 
        similarityThreshold: { type: Number, default: 0.85, min: 0.5, max: 1 }, 
        mentionLimit: { type: Number, default: 15, min: 3, max: 50 }, 
        mentionLimitPerMessage: { type: Number, default: 10, min: 3, max: 25 }, 
        emojiLimit: { type: Number, default: 15, min: 5, max: 100 }, 
        
        
        capsDetection: {
            enabled: { type: Boolean, default: false }, 
            percentage: { type: Number, default: 80, min: 50, max: 100 }, 
            minLength: { type: Number, default: 20 } 
        },
        
        
        attachmentSpam: {
            enabled: { type: Boolean, default: true },
            maxAttachments: { type: Number, default: 5 },
            timeWindow: { type: Number, default: 10000 }
        },
        
        
        inviteSpam: {
            enabled: { type: Boolean, default: true },
            maxInvites: { type: Number, default: 2 },
            timeWindow: { type: Number, default: 60000 },
            blockDiscordInvites: { type: Boolean, default: true },
            allowOwnServerInvites: { type: Boolean, default: true }
        },
        
        
        newlineSpam: {
            enabled: { type: Boolean, default: true },
            maxNewlines: { type: Number, default: 10 }
        },
        
        
        blockedWords: [{ type: String }],
        blockedPatterns: [{ type: String }], 
        
        
        whitelistedChannels: [{ type: String }],
        whitelistedRoles: [{ type: String }],
        
        
        punishment: modulePunishmentSchema
    },

    antiLink: {
        enabled: { type: Boolean, default: true },
        mode: { type: String, enum: ['strict', 'moderate', 'custom', 'off'], default: 'moderate' },
        
        
        allowedDomains: [{ type: String }],
        blockedDomains: [{ type: String }],
        
        
        shortenerProtection: { type: Boolean, default: true },
        ipLinkProtection: { type: Boolean, default: true },
        
        
        phishingProtection: {
            enabled: { type: Boolean, default: true },
            useExternalApi: { type: Boolean, default: false },
            apiEndpoint: { type: String, default: null },
            cacheResults: { type: Boolean, default: true },
            cacheDuration: { type: Number, default: 3600000 } 
        },
        
        
        inviteHandling: {
            blockAllInvites: { type: Boolean, default: false },
            allowPartnerInvites: { type: Boolean, default: true },
            partnerServers: [{ type: String }], 
            blockVanityUrls: { type: Boolean, default: false }
        },
        
        
        mediaLinks: {
            allowImages: { type: Boolean, default: true },
            allowVideos: { type: Boolean, default: true },
            allowedImageHosts: [{ type: String }],
            maxMediaPerMessage: { type: Number, default: 5 }
        },
        
        
        whitelistedChannels: [{ type: String }],
        whitelistedRoles: [{ type: String }],
        
        
        punishment: modulePunishmentSchema
    },

    antiRaid: {
        enabled: { type: Boolean, default: true },
        
        
        joinLimit: { type: Number, default: 5, min: 2, max: 50 },
        timeWindow: { type: Number, default: 60000, min: 5000, max: 300000 },
        
        
        accountAgeCheck: { type: Boolean, default: true },
        minAccountAge: { type: Number, default: 604800000 }, 
        avatarCheck: { type: Boolean, default: true },
        usernamePatternCheck: { type: Boolean, default: true },
        
        
        progressiveResponse: {
            enabled: { type: Boolean, default: true },
            levels: [{
                threshold: { type: Number, required: true }, 
                action: { type: String, enum: ['alert', 'slowmode', 'verification', 'lockdown'], required: true },
                duration: { type: Number, default: 300000 },
                escalateAfter: { type: Number, default: 60000 } 
            }],
            autoDeescalate: { type: Boolean, default: true },
            deescalateAfter: { type: Number, default: 300000 } 
        },
        
        
        verificationMode: {
            enabled: { type: Boolean, default: true },
            type: { type: String, enum: ['button', 'reaction', 'captcha', 'none'], default: 'button' },
            timeout: { type: Number, default: 300000 }, 
            kickOnTimeout: { type: Boolean, default: true }
        },
        
        
        lockdownDuration: { type: Number, default: 600000 }, 
        action: { type: String, enum: ['kick', 'ban', 'quarantine', 'verify'], default: 'quarantine' },
        
        
        crossRaidDetection: {
            enabled: { type: Boolean, default: false },
            sharedThreshold: { type: Number, default: 3 } 
        },
        
        
        punishment: modulePunishmentSchema
    },

    antiNuke: {
        enabled: { type: Boolean, default: true },
        
        
        limits: {
            channelDelete: { type: Number, default: 1, min: 1, max: 20 },
            channelCreate: { type: Number, default: 3, min: 1, max: 20 },
            roleDelete: { type: Number, default: 1, min: 1, max: 10 },
            roleCreate: { type: Number, default: 3, min: 1, max: 10 },
            memberKick: { type: Number, default: 2, min: 1, max: 20 },
            memberBan: { type: Number, default: 1, min: 1, max: 10 },
            
            webhookDelete: { type: Number, default: 1, min: 1, max: 10 },
            webhookCreate: { type: Number, default: 3, min: 1, max: 10 },
            emojiDelete: { type: Number, default: 3, min: 1, max: 20 },
            stickerDelete: { type: Number, default: 3, min: 1, max: 20 },
            integrationDelete: { type: Number, default: 1, min: 1, max: 5 },
            permissionChange: { type: Number, default: 5, min: 1, max: 20 }
        },
        
        timeWindow: { type: Number, default: 10000, min: 5000, max: 60000 },
        lockdownOnDetection: { type: Boolean, default: true },
        
        
        monitoredEvents: {
            channelDelete: { type: Boolean, default: true },
            channelCreate: { type: Boolean, default: true },
            roleDelete: { type: Boolean, default: true },
            roleCreate: { type: Boolean, default: true },
            memberKick: { type: Boolean, default: true },
            memberBan: { type: Boolean, default: true },
            webhookDelete: { type: Boolean, default: true },
            webhookCreate: { type: Boolean, default: true },
            emojiDelete: { type: Boolean, default: true },
            stickerDelete: { type: Boolean, default: true },
            integrationDelete: { type: Boolean, default: true },
            permissionChange: { type: Boolean, default: true },
            serverSettingsChange: { type: Boolean, default: true },
            vanityUrlChange: { type: Boolean, default: true }
        },
        
        
        botProtection: {
            enabled: { type: Boolean, default: true },
            allowedBots: [{ type: String }], 
            monitorBotActions: { type: Boolean, default: true },
            blockUnauthorizedBots: { type: Boolean, default: true }
        },
        
        
        ownerNotification: {
            enabled: { type: Boolean, default: true },
            dmOnCritical: { type: Boolean, default: true },
            dmOnLockdown: { type: Boolean, default: true },
            includeServerInvite: { type: Boolean, default: true }
        },
        
        
        punishment: modulePunishmentSchema
    },

    appealSystem: {
        enabled: { type: Boolean, default: false },
        appealChannelId: { type: String, default: null },
        appealCooldown: { type: Number, default: 86400000 }, 
        maxAppealsPerUser: { type: Number, default: 3 },
        autoCreateThread: { type: Boolean, default: true },
        notifyOnAppeal: { type: Boolean, default: true },
        allowedActions: [{ type: String, enum: ['ban', 'quarantine', 'timeout'], default: ['ban', 'quarantine'] }]
    },

    logChannelId: { type: String, default: null }, 
    alertChannelId: { type: String, default: null }, 
    aiEnabled: { type: Boolean, default: true }, 
    aiSensitivity: { type: String, default: 'medium' }, 
    aiConfidenceThreshold: { type: Number, default: 0.7 }, 
    punishmentSystem: { 
        useQuarantine: { type: Boolean, default: true },
        escalationEnabled: { type: Boolean, default: true },
        maxWarnings: { type: Number, default: 3 },
        timeoutDuration: { type: Number, default: 300000 },
        quarantineDuration: { type: Number, default: 3600000 },
        banAfterQuarantine: { type: Boolean, default: false }
    }
    
}, {
    timestamps: true,
    minimize: false 
});

antiConfigSchema.index({ 'blacklist.entries.id': 1 });
antiConfigSchema.index({ updatedAt: -1 });

antiConfigSchema.methods.getModulePunishment = function(module) {
    const moduleMap = {
        'spam': this.antiSpam?.punishment,
        'link': this.antiLink?.punishment,
        'raid': this.antiRaid?.punishment,
        'nuke': this.antiNuke?.punishment
    };
    
    
    return moduleMap[module] || {
        enabled: true,
        maxWarnings: this.punishmentSystem?.maxWarnings || 3,
        actions: [
            { threshold: 1, action: 'warn', duration: 0 },
            { threshold: 2, action: 'timeout', duration: this.punishmentSystem?.timeoutDuration || 300000 },
            { threshold: 3, action: 'quarantine', duration: this.punishmentSystem?.quarantineDuration || 3600000 }
        ],
        defaultAction: 'warn'
    };
};


antiConfigSchema.methods.isBlacklisted = function(userId) {
    if (!this.blacklist?.enabled) return null;
    
    const entry = this.blacklist.entries.find(e => 
        e.id === userId && 
        e.type === 'user' &&
        (!e.expiresAt || e.expiresAt > new Date())
    );
    
    return entry || null;
};


antiConfigSchema.methods.getTrustLevel = function(roleId) {
    if (!this.roleTrustLevels?.enabled) return this.roleTrustLevels?.defaultTrustLevel || 10;
    
    const roleConfig = this.roleTrustLevels.levels.find(l => l.roleId === roleId);
    return roleConfig?.trustLevel || this.roleTrustLevels.defaultTrustLevel || 10;
};


antiConfigSchema.methods.isDryRun = function() {
    return this.systemMode?.mode === 'dry-run' || this.systemMode?.mode === 'log-only';
};


antiConfigSchema.methods.getThreatAction = function(score) {
    const thresholds = this.threatSystem?.autoActionThresholds || {
        warn: 30, timeout: 50, quarantine: 70, ban: 90
    };
    
    if (score >= thresholds.ban) return 'ban';
    if (score >= thresholds.quarantine) return 'quarantine';
    if (score >= thresholds.timeout) return 'timeout';
    if (score >= thresholds.warn) return 'warn';
    return null;
};

antiConfigSchema.statics.getOrCreate = async function(guildId) {
    let config = await this.findOne({ guildId });
    
    if (!config) {
        config = new this({ guildId });
        await config.save();
    }
    
    return config;
};


antiConfigSchema.statics.migrateConfig = async function(guildId) {
    const config = await this.findOne({ guildId });
    if (!config) return null;
    
    let needsSave = false;
    
    
    if (config.logChannelId && !config.logging?.logChannelId) {
        config.logging = config.logging || {};
        config.logging.logChannelId = config.logChannelId;
        config.logging.alertChannelId = config.alertChannelId;
        needsSave = true;
    }
    
    
    if (config.aiEnabled !== undefined && !config.aiSettings?.enabled) {
        config.aiSettings = config.aiSettings || {};
        config.aiSettings.enabled = config.aiEnabled;
        config.aiSettings.sensitivity = config.aiSensitivity;
        config.aiSettings.confidenceThreshold = config.aiConfidenceThreshold;
        needsSave = true;
    }
    
    
    const modules = ['antiSpam', 'antiLink', 'antiRaid', 'antiNuke'];
    for (const mod of modules) {
        if (config[mod] && !config[mod].punishment) {
            config[mod].punishment = {
                enabled: true,
                maxWarnings: config.punishmentSystem?.maxWarnings || 3,
                warningExpiry: 86400000,
                actions: [
                    { threshold: 1, action: 'warn', duration: 0 },
                    { threshold: 2, action: 'timeout', duration: config.punishmentSystem?.timeoutDuration || 300000 },
                    { threshold: 3, action: mod === 'antiNuke' ? 'ban' : 'quarantine', duration: config.punishmentSystem?.quarantineDuration || 3600000 }
                ],
                defaultAction: 'warn'
            };
            needsSave = true;
        }
    }
    
    if (needsSave) {
        await config.save();
    }
    
    return config;
};

antiConfigSchema.pre('save', function() {
    
    if (!this.logging) {
        this.logging = {
            logChannelId: this.logChannelId,
            alertChannelId: this.alertChannelId
        };
    }
    
    
    if (!this.aiSettings) {
        this.aiSettings = {
            enabled: this.aiEnabled,
            sensitivity: this.aiSensitivity,
            confidenceThreshold: this.aiConfidenceThreshold
        };
    }
    

});

module.exports = mongoose.model('AntiConfig', antiConfigSchema);
