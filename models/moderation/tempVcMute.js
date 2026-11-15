const mongoose = require('mongoose');

const tempVcMuteSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    endTime: { type: Number, required: true }, 
    mutedBy: { type: String, required: true }
}, { timestamps: true });


tempVcMuteSchema.index({ guildId: 1, userId: 1 }, { unique: true });
tempVcMuteSchema.index({ endTime: 1 }); 

module.exports = mongoose.model('TempVcMute', tempVcMuteSchema);
