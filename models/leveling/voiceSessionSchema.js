
const mongoose = require('mongoose');

const voiceSessionSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    guildId: { type: String, required: true },
    channelId: { type: String, required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, default: null },
    duration: { type: Number, default: 0 }, 
    xpEarned: { type: Number, default: 0 },
    wasAFK: { type: Boolean, default: false },
    wasMuted: { type: Boolean, default: false },
    wasDeafened: { type: Boolean, default: false },
    participants: [String] 
}, {
    timestamps: true,
    indexes: [
        { guildId: 1, userId: 1 },
        { guildId: 1, startTime: -1 },
        { endTime: 1 }
    ]
});

module.exports = mongoose.model('VoiceSession', voiceSessionSchema);
