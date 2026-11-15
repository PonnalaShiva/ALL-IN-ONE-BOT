const mongoose = require('mongoose');

const autoroleSchema = new mongoose.Schema({
    serverId: {
        type: String,
        required: true,
        unique: true
    },
    roleId: {
        type: String,
        required: true
    },
    status: {
        type: Boolean,
        default: true
    },
    ownerId: {
        type: String,
        required: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Autorole', autoroleSchema);