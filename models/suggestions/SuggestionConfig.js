const mongoose = require('mongoose');

const suggestionConfigSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    suggestionChannelId: { type: String, required: true },
    allowedRoleId: { type: String, default: null }
});

module.exports = mongoose.model('SuggestionConfig', suggestionConfigSchema);
