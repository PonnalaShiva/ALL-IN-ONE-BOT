const mongoose = require('mongoose');

const suggestionSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    messageId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true }, 
    title: { type: String, required: true },
    description: { type: String, required: true },
    status: {
        type: String,
        enum: ['pending', 'approved', 'denied', 'review'],
        default: 'pending'
    },
    statusReason: { type: String }, 
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});


suggestionSchema.index({ guildId: 1, messageId: 1 });
suggestionSchema.index({ guildId: 1, userId: 1 });

const Suggestion = mongoose.model('Suggestion', suggestionSchema);

module.exports = Suggestion;