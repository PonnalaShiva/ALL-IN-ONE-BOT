
const mongoose = require('mongoose');

const geminiApiKeySchema = new mongoose.Schema({
    keyId: { type: String, required: true },
    apiKey: { type: String, required: true },
    serverId: { type: String, required: true }, 
    name: { type: String, required: true },
    isActive: { type: Boolean, default: true },

    
    totalRequests: { type: Number, default: 0 },
    successfulRequests: { type: Number, default: 0 },
    failedRequests: { type: Number, default: 0 },

    
    lastUsedAt: { type: Date, default: null },
    isBlocked: { type: Boolean, default: false },
    blockedUntil: { type: Date, default: null },
    blockedReason: { type: String, default: null },

    
    avgResponseTime: { type: Number, default: 0 },
    lastErrorAt: { type: Date, default: null },
    lastErrorMessage: { type: String, default: null },

    
    addedBy: { type: String, required: true },
    addedAt: { type: Date, default: Date.now },
    lastModifiedAt: { type: Date, default: Date.now }
}, {
    timestamps: true
});


geminiApiKeySchema.index({ serverId: 1, isActive: 1, isBlocked: 1 });
geminiApiKeySchema.index({ serverId: 1, keyId: 1 }, { unique: true });

module.exports = mongoose.model('GeminiApiKey', geminiApiKeySchema);
