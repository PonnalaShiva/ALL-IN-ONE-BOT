const mongoose = require('mongoose');

const inviteSettingsSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    inviteLogChannelId: { type: String, default: null },
    status: { type: Boolean, default: true }
});

module.exports = mongoose.model('InviteSettings', inviteSettingsSchema);
