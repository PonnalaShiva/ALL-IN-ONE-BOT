const mongoose = require('mongoose');

const LogConfigSchema = new mongoose.Schema({
  guildId: { type: String, required: true },
  eventType: { type: String, required: true },
  channelId: { type: String, required: true }
}, {
  timestamps: true
});

LogConfigSchema.index({ guildId: 1, eventType: 1 }, { unique: true });

module.exports = mongoose.model('LogConfig', LogConfigSchema);
