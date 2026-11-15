

const mongoose = require('mongoose');

const violationHistorySchema = new mongoose.Schema({
    type: { 
        type: String, 
        enum: [
            
            'spam', 'mention_spam', 'emoji_spam', 'caps', 'blocked_word',
            'attachment_spam', 'invite_spam', 'newline_spam', 'duplicate_spam',
            
            'blocked_domain', 'ip_link', 'url_shortener', 'unauthorized_link',
            'suspicious_link', 'phishing_link', 'malware_link', 'scam_link',
            
            'raid_participation', 'suspicious_join', 'verification_timeout',
            'account_age_violation', 'pattern_match',
            
            'channel_delete_limit', 'channel_create_limit', 'role_delete_limit',
            'role_create_limit', 'member_ban_limit', 'member_kick_limit',
            'webhook_abuse', 'permission_abuse', 'emoji_delete_limit',
            
            'evasion_attempt', 'manual_flag', 'ai_detected', 'cross_server_flag'
        ],
        required: true 
    },
    severity: { 
        type: String, 
        enum: ['low', 'medium', 'high', 'critical'],
        required: true 
    },
    points: { type: Number, required: true },
    module: { type: String, enum: ['spam', 'link', 'raid', 'nuke', 'manual', 'system'] },
    reason: { type: String },
    actionTaken: { type: String },
    timestamp: { type: Date, default: Date.now },
    decayed: { type: Boolean, default: false },
    decayedAt: { type: Date, default: null }
}, { _id: false });

const actionHistorySchema = new mongoose.Schema({
    action: { 
        type: String, 
        enum: ['warn', 'delete', 'timeout', 'kick', 'quarantine', 'ban', 'tempban', 'unban', 'unquarantine'],
        required: true 
    },
    reason: { type: String },
    duration: { type: Number, default: 0 },
    moderatorId: { type: String }, 
    automated: { type: Boolean, default: true },
    triggerScore: { type: Number }, 
    triggerModule: { type: String },
    timestamp: { type: Date, default: Date.now },
    reversed: { type: Boolean, default: false },
    reversedAt: { type: Date, default: null },
    reversedBy: { type: String, default: null }
}, { _id: false });

const threatScoreSchema = new mongoose.Schema({
    userId: { type: String, required: true, index: true },
    guildId: { type: String, required: true, index: true },

    currentScore: { type: Number, default: 0, min: 0, max: 100 },
    peakScore: { type: Number, default: 0 }, 
    
    
    scores: {
        spam: { type: Number, default: 0, min: 0, max: 100 },
        link: { type: Number, default: 0, min: 0, max: 100 },
        raid: { type: Number, default: 0, min: 0, max: 100 },
        nuke: { type: Number, default: 0, min: 0, max: 100 },
        behavior: { type: Number, default: 0, min: 0, max: 100 }, 
        evasion: { type: Number, default: 0, min: 0, max: 100 }  
    },

    riskLevel: { 
        type: String, 
        enum: ['safe', 'low', 'medium', 'high', 'critical', 'blacklisted'],
        default: 'safe'
    },
    riskFactors: [{
        factor: { type: String },
        weight: { type: Number },
        description: { type: String },
        detectedAt: { type: Date, default: Date.now }
    }],

    violationHistory: [violationHistorySchema],
    violationCounts: {
        total: { type: Number, default: 0 },
        last24Hours: { type: Number, default: 0 },
        last7Days: { type: Number, default: 0 },
        last30Days: { type: Number, default: 0 },
        byModule: {
            spam: { type: Number, default: 0 },
            link: { type: Number, default: 0 },
            raid: { type: Number, default: 0 },
            nuke: { type: Number, default: 0 }
        },
        bySeverity: {
            low: { type: Number, default: 0 },
            medium: { type: Number, default: 0 },
            high: { type: Number, default: 0 },
            critical: { type: Number, default: 0 }
        }
    },

    actionHistory: [actionHistorySchema],
    actionCounts: {
        warnings: { type: Number, default: 0 },
        timeouts: { type: Number, default: 0 },
        kicks: { type: Number, default: 0 },
        quarantines: { type: Number, default: 0 },
        bans: { type: Number, default: 0 },
        appeals: { type: Number, default: 0 },
        appealsAccepted: { type: Number, default: 0 }
    },

    status: {
        isQuarantined: { type: Boolean, default: false },
        isBanned: { type: Boolean, default: false },
        isWatched: { type: Boolean, default: false }, 
        isTrusted: { type: Boolean, default: false }, 
        isBlacklisted: { type: Boolean, default: false }
    },

    decay: {
        lastDecayAt: { type: Date, default: null },
        totalDecayed: { type: Number, default: 0 },
        decayRate: { type: Number, default: 2 }, 
        decayPaused: { type: Boolean, default: false },
        decayPausedUntil: { type: Date, default: null }
    },

    lastActivity: { type: Date, default: Date.now },
    lastViolation: { type: Date, default: null },
    lastAction: { type: Date, default: null },
    firstViolation: { type: Date, default: null },

    crossServer: {
        enabled: { type: Boolean, default: false },
        sharedGuilds: [{ type: String }], 
        flaggedInGuilds: { type: Number, default: 0 },
        globalRiskLevel: { type: String, enum: ['safe', 'low', 'medium', 'high', 'critical'], default: 'safe' }
    },

    notes: [{
        content: { type: String },
        addedBy: { type: String },
        addedAt: { type: Date, default: Date.now }
    }],
    tags: [{ type: String }] 
    
}, {
    timestamps: true
});

threatScoreSchema.index({ guildId: 1, userId: 1 }, { unique: true });
threatScoreSchema.index({ guildId: 1, currentScore: -1 });
threatScoreSchema.index({ guildId: 1, riskLevel: 1 });
threatScoreSchema.index({ lastViolation: -1 });
threatScoreSchema.index({ 'status.isWatched': 1, guildId: 1 });

const SEVERITY_POINTS = {
    low: 5,
    medium: 15,
    high: 30,
    critical: 60
};

threatScoreSchema.methods.addViolation = async function(violation) {
    const { type, severity, module, reason, actionTaken } = violation;
    const points = SEVERITY_POINTS[severity] || 10;
    
    
    this.violationHistory.push({
        type,
        severity,
        points,
        module,
        reason,
        actionTaken,
        timestamp: new Date()
    });
    
    
    if (this.violationHistory.length > 100) {
        this.violationHistory = this.violationHistory.slice(-100);
    }
    
    
    this.violationCounts.total++;
    this.violationCounts.last24Hours++;
    this.violationCounts.last7Days++;
    this.violationCounts.last30Days++;
    
    if (module && this.violationCounts.byModule[module] !== undefined) {
        this.violationCounts.byModule[module]++;
    }
    
    if (this.violationCounts.bySeverity[severity] !== undefined) {
        this.violationCounts.bySeverity[severity]++;
    }
    
    
    this.currentScore = Math.min(100, this.currentScore + points);
    if (this.currentScore > this.peakScore) {
        this.peakScore = this.currentScore;
    }
    
    
    if (module && this.scores[module] !== undefined) {
        this.scores[module] = Math.min(100, this.scores[module] + points);
    }
    
    
    this.lastViolation = new Date();
    this.lastActivity = new Date();
    if (!this.firstViolation) {
        this.firstViolation = new Date();
    }
    
    
    this.updateRiskLevel();
    
    return this;
};

threatScoreSchema.methods.addAction = function(action) {
    const { type, reason, duration, moderatorId, automated, triggerModule } = action;
    
    this.actionHistory.push({
        action: type,
        reason,
        duration,
        moderatorId,
        automated: automated !== false,
        triggerScore: this.currentScore,
        triggerModule,
        timestamp: new Date()
    });
    
    
    if (this.actionHistory.length > 50) {
        this.actionHistory = this.actionHistory.slice(-50);
    }
    
    
    const countMap = {
        'warn': 'warnings',
        'timeout': 'timeouts',
        'kick': 'kicks',
        'quarantine': 'quarantines',
        'ban': 'bans'
    };
    
    if (countMap[type]) {
        this.actionCounts[countMap[type]]++;
    }
    
    
    if (type === 'quarantine') this.status.isQuarantined = true;
    if (type === 'ban') this.status.isBanned = true;
    if (type === 'unquarantine') this.status.isQuarantined = false;
    if (type === 'unban') this.status.isBanned = false;
    
    this.lastAction = new Date();
    
    return this;
};

threatScoreSchema.methods.applyDecay = function(config = {}) {
    if (this.decay.decayPaused) {
        if (this.decay.decayPausedUntil && new Date() > this.decay.decayPausedUntil) {
            this.decay.decayPaused = false;
        } else {
            return this;
        }
    }
    
    const now = new Date();
    const lastDecay = this.decay.lastDecayAt || this.lastActivity || now;
    const hoursSinceLastDecay = (now - lastDecay) / (1000 * 60 * 60);
    
    if (hoursSinceLastDecay < 1) return this; 
    
    const decayRate = config.pointsPerHour || this.decay.decayRate || 2;
    const minScore = config.minScore || 0;
    
    const pointsToDecay = Math.floor(hoursSinceLastDecay * decayRate);
    
    if (pointsToDecay > 0 && this.currentScore > minScore) {
        const actualDecay = Math.min(pointsToDecay, this.currentScore - minScore);
        this.currentScore -= actualDecay;
        this.decay.totalDecayed += actualDecay;
        this.decay.lastDecayAt = now;
        
        
        const ratio = actualDecay / (this.currentScore + actualDecay);
        for (const module of ['spam', 'link', 'raid', 'nuke', 'behavior', 'evasion']) {
            if (this.scores[module] > 0) {
                this.scores[module] = Math.max(0, this.scores[module] - (this.scores[module] * ratio));
            }
        }
        
        
        this.updateRiskLevel();
    }
    
    return this;
};

threatScoreSchema.methods.updateRiskLevel = function() {
    const score = this.currentScore;
    
    if (this.status.isBlacklisted) {
        this.riskLevel = 'blacklisted';
    } else if (score >= 90) {
        this.riskLevel = 'critical';
    } else if (score >= 70) {
        this.riskLevel = 'high';
    } else if (score >= 50) {
        this.riskLevel = 'medium';
    } else if (score >= 25) {
        this.riskLevel = 'low';
    } else {
        this.riskLevel = 'safe';
    }
    
    return this;
};

threatScoreSchema.methods.getRecommendedAction = function(thresholds = {}) {
    const defaults = {
        warn: 30,
        timeout: 50,
        quarantine: 70,
        ban: 90
    };
    
    const t = { ...defaults, ...thresholds };
    const score = this.currentScore;
    
    if (score >= t.ban) return { action: 'ban', urgent: true };
    if (score >= t.quarantine) return { action: 'quarantine', urgent: true };
    if (score >= t.timeout) return { action: 'timeout', urgent: false };
    if (score >= t.warn) return { action: 'warn', urgent: false };
    
    return { action: null, urgent: false };
};

threatScoreSchema.methods.resetUser = function(moderatorId, reason) {
    this.currentScore = 0;
    this.scores = { spam: 0, link: 0, raid: 0, nuke: 0, behavior: 0, evasion: 0 };
    this.riskLevel = 'safe';
    this.status.isQuarantined = false;
    this.status.isBanned = false;
    this.status.isWatched = false;
    
    this.notes.push({
        content: `User reset by moderator. Reason: ${reason || 'No reason provided'}`,
        addedBy: moderatorId,
        addedAt: new Date()
    });
    
    this.actionHistory.push({
        action: 'unban',
        reason: reason || 'User reset',
        moderatorId,
        automated: false,
        timestamp: new Date()
    });
    
    return this;
};

threatScoreSchema.methods.updateViolationCounts = function() {
    const now = new Date();
    const day = 24 * 60 * 60 * 1000;
    
    this.violationCounts.last24Hours = this.violationHistory.filter(v => 
        (now - v.timestamp) < day
    ).length;
    
    this.violationCounts.last7Days = this.violationHistory.filter(v => 
        (now - v.timestamp) < (7 * day)
    ).length;
    
    this.violationCounts.last30Days = this.violationHistory.filter(v => 
        (now - v.timestamp) < (30 * day)
    ).length;
    
    return this;
};

threatScoreSchema.statics.getOrCreate = async function(userId, guildId) {
    let score = await this.findOne({ userId, guildId });
    
    if (!score) {
        score = new this({ userId, guildId });
        await score.save();
    }
    
    return score;
};

threatScoreSchema.statics.getTopThreats = function(guildId, limit = 10) {
    return this.find({ guildId, currentScore: { $gt: 0 } })
        .sort({ currentScore: -1 })
        .limit(limit)
        .select('userId currentScore riskLevel violationCounts.total lastViolation');
};

threatScoreSchema.statics.getUsersNeedingAction = function(guildId, threshold = 50) {
    return this.find({ 
        guildId, 
        currentScore: { $gte: threshold },
        'status.isBanned': false,
        'status.isQuarantined': false
    }).sort({ currentScore: -1 });
};

threatScoreSchema.statics.applyGuildDecay = async function(guildId, config = {}) {
    const scores = await this.find({ guildId, currentScore: { $gt: 0 } });
    
    for (const score of scores) {
        score.applyDecay(config);
        await score.save();
    }
    
    return scores.length;
};

threatScoreSchema.statics.getGuildStats = async function(guildId) {
    const stats = await this.aggregate([
        { $match: { guildId } },
        { $group: {
            _id: null,
            totalUsers: { $sum: 1 },
            totalViolations: { $sum: '$violationCounts.total' },
            avgScore: { $avg: '$currentScore' },
            maxScore: { $max: '$currentScore' },
            criticalUsers: { $sum: { $cond: [{ $eq: ['$riskLevel', 'critical'] }, 1, 0] } },
            highRiskUsers: { $sum: { $cond: [{ $eq: ['$riskLevel', 'high'] }, 1, 0] } },
            mediumRiskUsers: { $sum: { $cond: [{ $eq: ['$riskLevel', 'medium'] }, 1, 0] } },
            quarantinedUsers: { $sum: { $cond: ['$status.isQuarantined', 1, 0] } },
            bannedUsers: { $sum: { $cond: ['$status.isBanned', 1, 0] } },
            watchedUsers: { $sum: { $cond: ['$status.isWatched', 1, 0] } }
        }}
    ]);
    
    return stats[0] || {
        totalUsers: 0,
        totalViolations: 0,
        avgScore: 0,
        maxScore: 0,
        criticalUsers: 0,
        highRiskUsers: 0,
        mediumRiskUsers: 0,
        quarantinedUsers: 0,
        bannedUsers: 0,
        watchedUsers: 0
    };
};

threatScoreSchema.pre('save', function() {
    
    this.currentScore = Math.max(0, Math.min(100, this.currentScore));
    
    
    this.updateRiskLevel();
    
    
    this.lastActivity = new Date();
    

});

module.exports = mongoose.model('ThreatScore', threatScoreSchema);
