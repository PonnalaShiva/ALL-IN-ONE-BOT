const mongoose = require('mongoose');

const verificationConfigSchema =  new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    verificationEnabled: { type: Boolean, default: false },
    unverifiedRoleId: { type: String, default: null },
    verifiedRoleId: { type: String, default: null },
    verificationChannelId: { type: String, default: null },
    channelPermissionBackups: {
        type: [{
            channelId: { type: String, required: true },
            hadOverwrite: { type: Boolean, default: false },
            allow: { type: [String], default: [] },
            deny: { type: [String], default: [] }
        }],
        default: []
    }
});

module.exports = mongoose.model('VerificationConfig', verificationConfigSchema);
