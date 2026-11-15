const mongoose = require('mongoose');

const ticketUserDataSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    guildId: { type: String, required: true },
    ticketChannelId: { type: String, required: true },
    lastPing: { type: Date, default: null },
    closingAt: { type: Date, default: null }
});

ticketUserDataSchema.index({ userId: 1, guildId: 1 }, { unique: true });

module.exports = mongoose.model('TicketUserData', ticketUserDataSchema);
