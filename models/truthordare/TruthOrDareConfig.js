const mongoose = require('mongoose');

const truthOrDareSchema = new mongoose.Schema({
    serverId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true }
});

module.exports = mongoose.model('TruthOrDareConfig', truthOrDareSchema);
