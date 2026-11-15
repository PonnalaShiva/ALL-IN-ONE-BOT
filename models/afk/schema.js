const mongoose = require('mongoose');

const afkSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  guildId: {
    type: String,
    required: true,
    index: true
  },
  reason: {
    type: String,
    required: true,
    maxLength: 1024
  },
  setAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  expiresAt: {
    type: Date,
    default: null,
    index: true
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'removed'],
    default: 'active',
    index: true
  },
  mentions: {
    count: {
      type: Number,
      default: 0
    },
    lastMentioned: {
      type: Date,
      default: null
    },
    mentionedBy: [{
      userId: String,
      username: String,
      timestamp: Date,
      note: { type: String, default: null }
    }]
  },
  autoResponses: {
    enabled: {
      type: Boolean,
      default: false
    },
    message: {
      type: String,
      maxLength: 500,
      default: null
    },
    cooldown: {
      type: Number,
      default: 300000, 
      min: 60000 
    },
    lastSent: {
      type: Date,
      default: null
    }
  },
  settings: {
    dmNotifications: {
      type: Boolean,
      default: true
    },
    publicNotifications: {
      type: Boolean,
      default: true
    },
    showDuration: {
      type: Boolean,
      default: true
    },
    allowMentionTracking: {
      type: Boolean,
      default: true
    }
  },
  metadata: {
    timezone: {
      type: String,
      default: null
    },
    lastActivity: {
      type: Date,
      default: null
    },
    totalAfkTime: {
      type: Number,
      default: 0
    },
    remindUsers: {
      type: [String],
      default: []
    },
    previousReason: {
      type: String,
      default: null
    }
  }
}, {
  timestamps: true,
  collection: 'afkUsers'
});


afkSchema.index({ userId: 1, guildId: 1 }, { unique: true });
afkSchema.index({ guildId: 1, status: 1 });
afkSchema.index({ expiresAt: 1, status: 1 });


afkSchema.virtual('isActive').get(function() {
  if (this.status !== 'active') return false;
  if (!this.expiresAt) return true;
  return new Date() < this.expiresAt;
});


afkSchema.virtual('formattedDuration').get(function() {
  if (!this.expiresAt) return 'Indefinite';
  
  const now = new Date();
  const diff = this.expiresAt - now;
  
  if (diff <= 0) return 'Expired';
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
});


afkSchema.pre('save', function() {
  if (this.isNew) {
    this.metadata.lastActivity = new Date();
  }

});


afkSchema.statics.findActiveAFK = function(userId, guildId) {
  return this.findOne({
    userId,
    guildId,
    status: 'active',
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ]
  });
};

afkSchema.statics.findExpiredAFKs = function(guildId = null) {
  const query = {
    status: 'active',
    expiresAt: { $lte: new Date() }
  };
  
  if (guildId) query.guildId = guildId;
  
  return this.find(query);
};

afkSchema.statics.getGuildAFKStats = function(guildId) {
  return this.aggregate([
    { $match: { guildId } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalMentions: { $sum: '$mentions.count' }
      }
    }
  ]);
};


afkSchema.methods.addMention = function(mentionedBy, note = null) {
  if (!this.settings.allowMentionTracking) return;
  
  this.mentions.count += 1;
  this.mentions.lastMentioned = new Date();
  
  
  this.mentions.mentionedBy.unshift({
    userId: mentionedBy.id,
    username: mentionedBy.username,
    timestamp: new Date(),
    note: note || null
  });
  
  if (this.mentions.mentionedBy.length > 10) {
    this.mentions.mentionedBy = this.mentions.mentionedBy.slice(0, 10);
  }
  
  return this.save();
};

afkSchema.methods.addNoteForMentioner = function(userId, username, note) {
  const item = this.mentions.mentionedBy.find(m => m.userId === userId);
  if (item) {
    item.note = note;
  } else {
    this.mentions.mentionedBy.unshift({
      userId,
      username: username || 'User',
      timestamp: new Date(),
      note
    });
  }
  return this.save();
};

afkSchema.methods.addRemindUser = function(userId) {
  if (!this.metadata.remindUsers) this.metadata.remindUsers = [];
  if (!this.metadata.remindUsers.includes(userId)) {
    this.metadata.remindUsers.push(userId);
  }
  return this.save();
};

afkSchema.methods.canSendAutoResponse = function() {
  if (!this.autoResponses.enabled || !this.autoResponses.message) return false;
  
  if (!this.autoResponses.lastSent) return true;
  
  const timeSinceLastSent = Date.now() - this.autoResponses.lastSent.getTime();
  return timeSinceLastSent >= this.autoResponses.cooldown;
};

afkSchema.methods.markAutoResponseSent = function() {
  this.autoResponses.lastSent = new Date();
  return this.save();
};

afkSchema.methods.calculateTotalAfkTime = function() {
  const now = new Date();
  const afkDuration = now - this.setAt;
  this.metadata.totalAfkTime += afkDuration;
  return this.save();
};

module.exports = mongoose.model('AFK', afkSchema);