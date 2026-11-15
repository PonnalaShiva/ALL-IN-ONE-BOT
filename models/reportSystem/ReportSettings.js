const mongoose = require('mongoose');

const reportSettingsSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true,
        unique: true
    },
    
    
    channels: {
        reportsChannel: String, 
        alertsChannel: String,  
        logsChannel: String     
    },
    
    
    autoModeration: {
        enabled: { type: Boolean, default: true },
        aiAnalysis: { type: Boolean, default: true },
        autoTimeout: {
            enabled: { type: Boolean, default: false },
            severityThreshold: { type: String, default: 'high' },
            duration: { type: Number, default: 300 } 
        },
        autoEscalate: {
            enabled: { type: Boolean, default: true },
            confidenceThreshold: { type: Number, default: 0.8 },
            severityThreshold: { type: String, default: 'high' }
        }
    },
    
    
    notifications: {
        instantAlerts: { type: Boolean, default: true },
        dailyDigest: { type: Boolean, default: true },
        weeklyReport: { type: Boolean, default: true },
        mentionModerators: { type: Boolean, default: true }
    },
    
    
    customCategories: [{
        name: String,
        description: String,
        color: String,
        autoActions: [String]
    }],
    
    
    moderatorRoles: [String],
    adminRoles: [String],
    
    
    thresholds: {
        duplicateWindow: { type: Number, default: 24 }, 
        escalationThreshold: { type: Number, default: 3 }, 
        aiConfidenceMin: { type: Number, default: 0.5 }
    },
    
    timestamps: {
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
    }
}, {
    timestamps: { createdAt: 'timestamps.createdAt', updatedAt: 'timestamps.updatedAt' }
});

module.exports = mongoose.model('ReportSettings', reportSettingsSchema);
