
const mongoose = require('mongoose');

const reactionRoleSchema = new mongoose.Schema({
  
  setupId: {
    type: String,
    required: true,
    unique: true
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
  
  messageId: {
    type: String,
    required: true,
    index: true
  },
  
  
  title: {
    type: String,
    maxLength: 256,
    default: '' 
  },
  
  description: {
    type: String,
    maxLength: 4000, 
    default: '' 
  },
  
  color: {
    type: String,
    default: '#6366f1'
  },
  
  
  type: {
    type: String,
    enum: ['buttons', 'menu', ''], 
    default: '' 
  },
  
  
  menuConfig: {
    placeholder: {
      type: String,
      maxLength: 150,
      default: 'Select your roles...'
    },
    minValues: {
      type: Number,
      default: 1
    },
    maxValues: {
      type: Number,
      default: 1
    }
  },
  
  
  roles: [{
    roleId: {
      type: String,
      required: true
    },
    roleName: {
      type: String,
      required: true
    },
    label: {
      type: String,
      required: true,
      maxLength: 80
    },
    description: {
      type: String,
      maxLength: 100
    },
    emoji: {
      type: {
        id: String,
        name: String,
        animated: Boolean,
        unicode: Boolean
      },
      default: null
    },
    style: {
      type: String,
      enum: ['Primary', 'Secondary', 'Success', 'Danger'],
      default: 'Secondary'
    }
  }],
  
  
  settings: {
    requireRole: String,
    maxRolesPerUser: {
      type: Number,
      default: null 
    },
    removeOtherRoles: {
      type: Boolean,
      default: false
    },
    allowMultipleRoles: {
      type: Boolean,
      default: true
    }
  },
  
  
  stats: {
    totalInteractions: {
      type: Number,
      default: 0
    },
    rolesGiven: {
      type: Number,
      default: 0
    },
    rolesRemoved: {
      type: Number,
      default: 0
    }
  },
  
  
  createdBy: {
    type: String,
    required: true
  },
  
  updatedBy: {
    type: String,
    required: true
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});


reactionRoleSchema.methods.validateComplete = function() {
  const errors = [];
  
  if (!this.title || this.title.trim() === '') {
    errors.push('Title is required to complete setup');
  }
  
  if (!this.description || this.description.trim() === '') {
    errors.push('Description is required to complete setup');
  }
  
  if (!this.type || this.type === '') {
    errors.push('Type is required to complete setup');
  }
  
  if (this.roles.length === 0) {
    errors.push('At least one role is required to complete setup');
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors
  };
};


reactionRoleSchema.pre('save', function() {
  this.updatedAt = new Date();

});


reactionRoleSchema.index({ guildId: 1, messageId: 1 });
reactionRoleSchema.index({ guildId: 1, channelId: 1 });

reactionRoleSchema.index({ createdBy: 1 });
reactionRoleSchema.index({ guildId: 1, createdAt: -1 });

module.exports = mongoose.model('ReactionRole', reactionRoleSchema);
