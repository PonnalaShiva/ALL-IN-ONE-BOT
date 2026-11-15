const mongoose = require('mongoose');

const VoiceChannelSchema = new mongoose.Schema({
  serverId: { type: String, required: true },
  voiceChannelId: { type: String, required: true },
  managerChannelId: { type: String, required: true },
  allowedRoleIds: { type: [String], default: [] }, 
  status: { type: Boolean, default: true },
  ownerId: { type: String, required: true }
});

const TemporaryChannelSchema = new mongoose.Schema({
  channelId: { type: String, required: true, unique: true },
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  isTemporary: { type: Boolean, default: true },
  name: { type: String, default: 'Voice Channel' },
  description: { type: String, default: '' }
});

const CentralizedControlSchema = new mongoose.Schema({
  guildId: { type: String, required: true, unique: true },
  messageId: { type: String, required: true }
});
const VoiceChannelModel = mongoose.model('VoiceChannel', VoiceChannelSchema);
const TemporaryChannelModel = mongoose.model('TemporaryChannel', TemporaryChannelSchema);
const CentralizedControlModel = mongoose.model('CentralizedControl', CentralizedControlSchema);


module.exports = {
  VoiceChannelModel,
  TemporaryChannelModel,
  CentralizedControlModel,
};