const mongoose = require('mongoose');

const giveawaySchema = new mongoose.Schema({
  messageId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  guildId: {
    type: String,
    required: true,
    index: true
  },
  channelId: {
    type: String,
    required: true
  },
  hostId: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true,
    maxlength: 256
  },
  description: {
    type: String,
    required: true,
    maxlength: 1024
  },
  prize: {
    type: String,
    required: true,
    maxlength: 512
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: {
    type: Date,
    required: true,
    index: true
  },
  winners: {
    type: Number,
    required: true,
    min: 1,
    max: 100,
    default: 1
  },
  entries: [{
    userId: {
      type: String,
      required: true
    },
    username: String,
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  requirements: {
    roles: [{
      type: String
    }],
    minAccountAge: {
      type: Number,
      default: 0 
    },
    minServerAge: {
      type: Number,
      default: 0 
    },
    blacklistedRoles: [{
      type: String
    }]
  },
  status: {
    type: String,
    enum: ['active', 'ended', 'cancelled', 'paused'],
    default: 'active',
    index: true
  },
  winnersList: [{
    userId: String,
    username: String,
    selectedAt: {
      type: Date,
      default: Date.now
    }
  }],
  settings: {
    allowMultipleEntries: {
      type: Boolean,
      default: false
    },
    dmWinners: {
      type: Boolean,
      default: true
    },
    showParticipants: {
      type: Boolean,
      default: true
    },
    autoDelete: {
      type: Boolean,
      default: false
    },
    autoDeleteDelay: {
      type: Number,
      default: 24 
    }
  },
  metadata: {
    totalEntries: {
      type: Number,
      default: 0
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    },
    version: {
      type: Number,
      default: 1
    }
  }
}, {
  timestamps: true,
  versionKey: false
});


giveawaySchema.index({ guildId: 1, status: 1 });
giveawaySchema.index({ endTime: 1, status: 1 });
giveawaySchema.index({ hostId: 1 });


giveawaySchema.virtual('isActive').get(function() {
  return this.status === 'active' && this.endTime > new Date();
});


giveawaySchema.pre('save', function() {
  this.metadata.lastUpdated = new Date();
  this.metadata.totalEntries = this.entries.length;

});


giveawaySchema.methods.addEntry = function(userId, username) {
  
  const existingIndex = this.entries.findIndex(entry => entry.userId === userId);
  if (existingIndex === -1) {
    this.entries.push({ userId, username, joinedAt: new Date() });
    this.metadata.totalEntries = this.entries.length;
  }
  return this.save();
};

giveawaySchema.methods.removeEntry = function(userId) {
  this.entries = this.entries.filter(entry => entry.userId !== userId);
  this.metadata.totalEntries = this.entries.length;
  return this.save();
};

giveawaySchema.methods.selectWinners = function(count = this.winners) {
  const eligibleEntries = [...this.entries];
  const selectedWinners = [];
  
  while (selectedWinners.length < count && eligibleEntries.length > 0) {
    const randomIndex = Math.floor(Math.random() * eligibleEntries.length);
    const winner = eligibleEntries.splice(randomIndex, 1)[0];
    selectedWinners.push({
      userId: winner.userId,
      username: winner.username,
      selectedAt: new Date()
    });
  }
  
  this.winnersList = selectedWinners;
  return selectedWinners;
};


giveawaySchema.statics.findActiveGiveaways = function() {
  return this.find({ 
    status: 'active', 
    endTime: { $gt: new Date() } 
  });
};

giveawaySchema.statics.findExpiredGiveaways = function() {
  return this.find({ 
    status: 'active', 
    endTime: { $lte: new Date() } 
  });
};

module.exports = mongoose.model('Giveaway', giveawaySchema);
