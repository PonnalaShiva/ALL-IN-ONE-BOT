const mongoose = require('mongoose');

const suggestionVoteSchema = new mongoose.Schema({
    messageId: { type: String, required: true },
    userId: { type: String, required: true },
    vote: { type: String, enum: ['yes', 'no'], required: true },
    votedAt: { type: Date, default: Date.now }
});

suggestionVoteSchema.index({ messageId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('SuggestionVote', suggestionVoteSchema);
