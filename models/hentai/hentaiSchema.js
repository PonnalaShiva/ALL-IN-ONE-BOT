const mongoose = require('mongoose');

const hentaiConfigSchema = new mongoose.Schema({
    serverId: {
        type: String,
        required: true,
        unique: true
    },
    status: {
        type: Boolean,
        default: false
    },
    ownerId: {
        type: String,
        required: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('HentaiConfig', hentaiConfigSchema);