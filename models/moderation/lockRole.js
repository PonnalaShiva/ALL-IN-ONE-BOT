const mongoose = require('mongoose');

const lockRoleSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    roleId: { type: String, required: true },
    whitelistedUsers: { type: [String], default: [] },
    punishment: {
        type: String,
        enum: ['log', 'kick', 'ban'],
        default: 'log'
    },
    enabled: { type: Boolean, default: true }
}, { timestamps: true });


lockRoleSchema.index({ guildId: 1, roleId: 1 }, { unique: true });

module.exports = mongoose.model('LockRole', lockRoleSchema);
