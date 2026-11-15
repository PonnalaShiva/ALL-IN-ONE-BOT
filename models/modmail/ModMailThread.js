
const mongoose = require('mongoose');

const modMailThreadSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    guildId: { type: String, required: true },
    threadChannelId: { type: String, required: true },
    controlMessageId: { type: String, default: null },
    status: { 
        type: String, 
        enum: ['open', 'closed', 'archived'], 
        default: 'open' 
    },
    priority: { 
        type: String, 
        enum: ['low', 'medium', 'high', 'urgent'], 
        default: 'medium' 
    },
    category: { 
        type: String, 
        enum: ['general', 'ban_appeal', 'report', 'suggestion', 'other'], 
        default: 'general' 
    },
    openedBy: { type: String, required: true },
    closedBy: { type: String, default: null },
    closingAt: { type: Date, default: null },
    openedAt: { type: Date, default: Date.now },
    closedAt: { type: Date, default: null },
    lastActivity: { type: Date, default: Date.now },
    messageCount: { type: Number, default: 0 },
    staffResponded: { type: Boolean, default: false },
    tags: [{ type: String }],
    notes: { type: String, default: null }
});

modMailThreadSchema.index({ userId: 1, guildId: 1, status: 1 });
modMailThreadSchema.index(
    { userId: 1, guildId: 1 },
    { unique: true, partialFilterExpression: { status: 'open' } }
);
modMailThreadSchema.index({ guildId: 1, status: 1 });
modMailThreadSchema.index({ lastActivity: 1 });

module.exports = mongoose.model('ModMailThread', modMailThreadSchema);
