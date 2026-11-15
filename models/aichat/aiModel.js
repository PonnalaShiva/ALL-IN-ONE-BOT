const mongoose = require('mongoose');

const aiChatSchema = new mongoose.Schema({

  guildId: {
    type: String,
    required: true,
  },

  channelId: {
    type: String,
    required: true
  },

  isEnabled: {
    type: Boolean,
    default: false
  },

  createdAt: {
    type: Date,
    default: Date.now
  },

  updatedAt: {
    type: Date,
    default: Date.now
  },
 
  updatedBy: {
    type: String
  }
});


aiChatSchema.index({ guildId: 1 }, { unique: true });

aiChatSchema.statics.findActiveChannel = async function(guildId, channelId) {
  return this.findOne({ 
    guildId, 
    channelId, 
    isEnabled: true 
  });
};


aiChatSchema.statics.setConfig = async function(guildId, channelId, isEnabled, userId) {
  return this.updateOne(
    { guildId },
    { 
      $set: { 
        channelId,
        isEnabled,
        updatedAt: new Date(),
        updatedBy: userId
      }
    },
    { upsert: true }
  );
};


aiChatSchema.statics.disableChat = async function(guildId, userId) {
  return this.updateOne(
    { guildId },
    { 
      $set: { 
        isEnabled: false,
        updatedAt: new Date(),
        updatedBy: userId
      }
    }
  );
};


aiChatSchema.statics.getConfig = async function(guildId) {
  return this.findOne({ guildId });
};

const AiChat = mongoose.model('AiChat', aiChatSchema);

module.exports = AiChat;