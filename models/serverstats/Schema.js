const mongoose = require('mongoose');

const serverStatsSchema = new mongoose.Schema({
  guildId: {
    type: String,
    required: true,
    index: true
  },
  guildName: {
    type: String,
    required: true
  },
  statsChannels: [{
    type: {
      type: String,
      enum: ['members', 'bots', 'textChannels', 'voiceChannels', 'categories', 'roles', 'date', 'all'],
      required: true
    },
    channelId: {
      type: String,
      required: true
    },
    channelName: String,
    nameFormat: {
      type: String,
      required: true,
      default: function() {
        const formats = {
          members: "👥 Members: {count}",
          bots: "🤖 Bots: {count}",
          textChannels: "💬 Text Channels: {count}",
          voiceChannels: "🔊 Voice Channels: {count}",
          categories: "📁 Categories: {count}",
          roles: "🏷️ Roles: {count}",
          date: "📅 Date: {count}",
          all: "📊 Total Members: {count}"
        };
        return formats[this.type] || `${this.type}: {count}`;
      }
    },
    categoryId: String,
    active: {
      type: Boolean,
      default: true
    },
    lastValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    lastUpdatedAt: {
      type: Date,
      default: Date.now
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  settings: {
    updateInterval: {
      type: Number,
      default: 300000, 
      min: 60000, 
      max: 3600000 
    },
    autoUpdate: {
      type: Boolean,
      default: true
    },
    rateLimitHandling: {
      type: Boolean,
      default: true
    },
    timezone: {
      type: String,
      default: 'UTC'
    },
    locale: {
      type: String,
      default: 'en-US'
    }
  },
  statistics: {
    totalUpdates: {
      type: Number,
      default: 0
    },
    lastFullUpdate: {
      type: Date,
      default: Date.now
    },
    failedUpdates: {
      type: Number,
      default: 0
    },
    lastError: {
      message: String,
      timestamp: Date
    }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  versionKey: false
});


serverStatsSchema.index({ guildId: 1, 'statsChannels.type': 1 });
serverStatsSchema.index({ 'statsChannels.channelId': 1 });
serverStatsSchema.index({ 'statsChannels.active': 1 });
serverStatsSchema.index({ isActive: 1 });


serverStatsSchema.virtual('activeStatsChannels').get(function() {
  return this.statsChannels.filter(channel => channel.active);
});


serverStatsSchema.methods.addStatsChannel = function(channelData) {
  
  const existingIndex = this.statsChannels.findIndex(
    channel => channel.type === channelData.type
  );
  
  if (existingIndex !== -1) {
    
    this.statsChannels[existingIndex] = {
      ...this.statsChannels[existingIndex].toObject(),
      ...channelData,
      lastUpdatedAt: new Date()
    };
  } else {
    
    this.statsChannels.push({
      ...channelData,
      createdAt: new Date()
    });
  }
  
  return this.save();
};


serverStatsSchema.methods.removeStatsChannel = function(channelId) {
  this.statsChannels = this.statsChannels.filter(
    channel => channel.channelId !== channelId
  );
  return this.save();
};


serverStatsSchema.methods.updateChannelValue = function(channelId, value) {
  const channel = this.statsChannels.find(ch => ch.channelId === channelId);
  if (channel) {
    channel.lastValue = value;
    channel.lastUpdatedAt = new Date();
    this.statistics.totalUpdates += 1;
    this.statistics.lastFullUpdate = new Date();
  }
  return this.save();
};


serverStatsSchema.statics.findByGuildId = function(guildId) {
  return this.findOne({ guildId, isActive: true });
};


serverStatsSchema.statics.findActiveGuilds = function() {
  return this.find({ 
    isActive: true, 
    'statsChannels.0': { $exists: true },
    'statsChannels.active': true 
  });
};


serverStatsSchema.pre('save', function() {
  if (this.isModified('statsChannels')) {
    this.statistics.lastFullUpdate = new Date();
  }

});


module.exports = mongoose.model('ServerStats', serverStatsSchema);