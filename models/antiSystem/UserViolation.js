
const mongoose = require('mongoose');

const userViolationSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    guildId: { type: String, required: true },
    
    
    violationType: { 
        type: String, 
        enum: [
            'spam', 
            'link', 
            'raid', 
            'nuke', 
            'mention_spam', 
            'caps', 
            'blocked_word', 
            'suspicious_behavior',
            'emoji_spam',
            
            'blocked_domain',
            'ip_link', 
            'url_shortener',
            'unauthorized_link',  
            'suspicious_link',
            
            'channel_delete_limit',
            'channel_create_limit',
            'role_delete_limit', 
            'role_create_limit',
            'member_ban_limit',
            'member_kick_limit',
            
            'raid_participation'
        ],
        required: true 
    },
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true },
    content: { type: String, default: null },
    channelId: { type: String, required: true },
    
    
    aiAnalysis: {
        confidence: { type: Number, default: 0 },
        reasoning: { type: String, default: null },
        threatScore: { type: Number, default: 0 }
    },
    
    
    actionTaken: { 
        type: String, 
        enum: ['warn', 'timeout', 'quarantine', 'kick', 'ban', 'none'],
        required: true 
    },
    actionDuration: { type: Number, default: null },
    
    
    warningCount: { type: Number, default: 0 },
    isEscalated: { type: Boolean, default: false },
    
    violatedAt: { type: Date, default: Date.now }
}, {
    timestamps: true
});


userViolationSchema.index({ userId: 1, guildId: 1, violatedAt: -1 });

module.exports = mongoose.model('UserViolation', userViolationSchema);
