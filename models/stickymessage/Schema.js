const mongoose = require('mongoose');

const stickyMessageSchema = new mongoose.Schema({
    serverId: { type: String, required: true },
    channelId: { type: String, required: true },
    
    
    messageType: { 
        type: String, 
        enum: ['embed', 'text', 'both'], 
        default: 'embed' 
    },
    
    
    textContent: { type: String, default: '' },
    
    
    embed: {
        title: { type: String, default: '' },
        description: { type: String, default: '' },
        color: { type: String, default: '#00e5ff' },
        
        author: {
            name: { type: String, default: '' },
            iconURL: { type: String, default: '' },
            url: { type: String, default: '' }
        },
        
        footer: {
            text: { type: String, default: '' },
            iconURL: { type: String, default: '' }
        },
        
        image: { type: String, default: '' },
        thumbnail: { type: String, default: '' },
        
        fields: [{
            name: { type: String, required: true },
            value: { type: String, required: true },
            inline: { type: Boolean, default: false }
        }],
        
        timestamp: { type: Boolean, default: false }
    },
    
    
    timerMode: { 
        type: String, 
        enum: ['message', 'time'], 
        default: 'message' 
    },
    
    
    messageCount: { type: Number, default: 1 },
    currentMessageCount: { type: Number, default: 0 },
    
    
    timerInterval: { type: Number, default: 300 }, 
    lastSent: { type: Date, default: Date.now },
    
    
    active: { type: Boolean, default: true },
    lastMessageId: { type: String, default: '' },
    deleteOldMessage: { type: Boolean, default: true },
    ignoreBots: { type: Boolean, default: true },
    allowedRoles: [{ type: String }],
    blockedRoles: [{ type: String }],
    
    
    createdBy: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, {
    timestamps: true
});

stickyMessageSchema.index({ serverId: 1, channelId: 1 }, { unique: true });

module.exports = mongoose.model('StickyMessage', stickyMessageSchema);
