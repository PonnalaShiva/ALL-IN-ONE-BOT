
const mongoose = require('mongoose');

const userLevelSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    guildId: { type: String, required: true },
    xp: { type: Number, default: 0, min: 0 },
    level: { type: Number, default: 1, min: 1 },
    totalXp: { type: Number, default: 0, min: 0 },
    weeklyXp: { type: Number, default: 0, min: 0 },
    dailyXp: { type: Number, default: 0, min: 0 },
    messageCount: { type: Number, default: 0, min: 0 },
    lastXpGain: { type: Date, default: Date.now },
    cooldownUntil: { type: Date, default: null },
    prestige: { type: Number, default: 0, min: 0 },
    rankCard: {
        background: { type: String, default: null },
        color: { type: String, default: '#1e3a8a' },
        theme: { type: String, default: 'default', enum: ['default', 'dark', 'neon', 'minimal', 'gaming'] },
        badge: { type: String, default: null }
    },
    voiceStats: {
        totalMinutes: { type: Number, default: 0 },
        sessionsCount: { type: Number, default: 0 },
        voiceXp: { type: Number, default: 0 },
        longestSession: { type: Number, default: 0 }, 
        averageSessionLength: { type: Number, default: 0 },
        weeklyVoiceMinutes: { type: Number, default: 0 },
        monthlyVoiceMinutes: { type: Number, default: 0 }
    },
    achievements: [{
        id: String,
        unlockedAt: { type: Date, default: Date.now },
        progress: { type: Number, default: 0 }
    }],
    streaks: {
        daily: { type: Number, default: 0 },
        weekly: { type: Number, default: 0 },
        lastActive: { type: Date, default: Date.now }
    }
}, {
    timestamps: true,
    indexes: [
        { guildId: 1, level: -1, xp: -1 },
        { guildId: 1, userId: 1 },
        { guildId: 1, weeklyXp: -1 },
        { lastXpGain: 1 }
    ]
});

userLevelSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('UserLevel', userLevelSchema);
