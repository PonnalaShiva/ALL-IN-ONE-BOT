
const mongoose = require('mongoose');


const guildBirthdaySettingsSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true,
        unique: true
    },
    settings: {
        announcementChannelId: {
            type: String,
            default: null
        },
        enableDailyAnnouncements: {
            type: Boolean,
            default: true
        },
        enableWeeklyReminders: {
            type: Boolean,
            default: true
        },
        enableMonthlyStats: {
            type: Boolean,
            default: false
        },
        announcementTime: {
            type: String,
            default: '09:00' 
        },
        mentionRole: {
            type: String,
            default: null
        },
        customMessage: {
            type: String,
            default: null
        },
        timezone: {
            type: String,
            default: 'UTC'
        }
    },
    permissions: {
        adminRoles: [{
            type: String
        }],
        moderatorRoles: [{
            type: String
        }]
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('GuildBirthdaySettings', guildBirthdaySettingsSchema);
