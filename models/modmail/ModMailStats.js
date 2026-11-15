
const mongoose = require('mongoose');

const modMailStatsSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    totalThreads: { type: Number, default: 0 },
    openThreads: { type: Number, default: 0 },
    closedThreads: { type: Number, default: 0 },
    averageResponseTime: { type: Number, default: 0 }, 
    totalMessages: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ModMailStats', modMailStatsSchema);
