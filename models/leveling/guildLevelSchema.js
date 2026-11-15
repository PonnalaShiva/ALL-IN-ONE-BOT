
const mongoose = require('mongoose');

const guildLevelSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    enabled: { type: Boolean, default: false },
    settings: {
        logChannel: { type: String, default: null },
        levelUpMessage: { type: String, default: '🎉 {user} leveled up to **Level {level}**!' },
        xpCooldown: { type: Number, default: 60000, min: 5000 }, 
        xpRange: {
            min: { type: Number, default: 15, min: 1 },
            max: { type: Number, default: 25, min: 1 }
        },
        multipliers: {
            text: { type: Number, default: 1.0, min: 0.1 },
            voice: { type: Number, default: 1.2, min: 0.1 },
            attachment: { type: Number, default: 1.5, min: 0.1 },
            weekend: { type: Number, default: 1.25, min: 0.1 },
            boost: { type: Number, default: 2.0, min: 0.1 }
        },
        restrictions: {
            ignoredChannels: [String],
            ignoredRoles: [String],
            allowedChannels: [String],
            botMessages: { type: Boolean, default: false }
        }
    },
    voiceSettings: {
        enabled: { type: Boolean, default: true },
        xpPerMinute: { type: Number, default: 2, min: 0.1 }, 
        afkChannelXp: { type: Boolean, default: false },
        soloChannelXp: { type: Boolean, default: false }, 
        minSessionLength: { type: Number, default: 60000 }, 
        maxSessionXp: { type: Number, default: 500 }, 
        multipliers: {
            streaming: { type: Number, default: 1.5 },
            camera: { type: Number, default: 1.3 },
            screenshare: { type: Number, default: 1.4 },
            multipleUsers: { type: Number, default: 1.2 } 
        },
        ignoredChannels: [String],
        bonusChannels: [{
            channelId: String,
            multiplier: { type: Number, default: 1.0 }
        }]
    },
    levelRoles: [{
        level: { type: Number, required: true, min: 1 },
        roleId: { type: String, required: true },
        action: { type: String, enum: ['add', 'replace'], default: 'add' },
        stackable: { type: Boolean, default: true },
        rewards: {
            xpBonus: { type: Number, default: 0 },
            announcement: { type: String, default: null }
        }
    }],
    leaderboard: {
        enabled: { type: Boolean, default: true },
        channel: { type: String, default: null },
        updateInterval: { type: Number, default: 300000 }, 
        displayCount: { type: Number, default: 10, min: 5, max: 25 }
    },
    rewards: {
        milestones: [{
            level: Number,
            reward: String,
            type: { type: String, enum: ['role', 'xp', 'custom'] }
        }],
        achievements: [{
            id: String,
            name: String,
            description: String,
            requirement: Number,
            type: { type: String, enum: ['levels', 'messages', 'streak'] },
            reward: String
        }]
    }
}, { timestamps: true });

module.exports = mongoose.model('GuildLevel', guildLevelSchema);
