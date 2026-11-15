const mongoose = require('mongoose');

const disabledCommandSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    commandName: { type: String, required: true },
    subcommandName: { type: String } 
});

disabledCommandSchema.index({ guildId: 1, commandName: 1, subcommandName: 1 }, { unique: true });

module.exports = mongoose.model('DisabledCommand', disabledCommandSchema);
