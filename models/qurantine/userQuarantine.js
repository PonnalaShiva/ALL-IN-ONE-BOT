const mongoose = require('mongoose');


const userQuarantineSchema =  new mongoose.Schema({
    userId: { type: String, required: true },
    guildId: { type: String, required: true },
    isQuarantined: { type: Boolean, default: true }, 
    quarantinedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('UserQuarantine', userQuarantineSchema);
