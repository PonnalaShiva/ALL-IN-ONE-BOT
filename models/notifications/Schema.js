const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    serverId: {
        type: String,
        required: true,
        index: true
    },
    platform: {
        type: String,
        required: true,
        enum: ['youtube', 'twitch'],
        index: true
    },
    platformId: {
        type: String,
        required: true
    },
    platformName: {
        type: String,
        default: null
    },
    channelId: {
        type: String,
        required: true
    },
    mentionRoleId: {
        type: String,
        default: null
    },
    customMessage: {
        type: String,
        default: null,
        maxlength: 2000
    },
    enabled: {
        type: Boolean,
        default: true
    },
    lastNotifiedId: {
        type: String,
        default: null
    },
    notifiedIds: [{
        type: String
    }],
    lastChecked: {
        type: Date,
        default: null
    },
    failCount: {
        type: Number,
        default: 0
    },
    lastError: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});


notificationSchema.index({ serverId: 1, platform: 1, platformId: 1 }, { unique: true });

notificationSchema.index({ enabled: 1, platform: 1 });


notificationSchema.pre('save', function() {
    if (this.notifiedIds && this.notifiedIds.length > 50) {
        this.notifiedIds = this.notifiedIds.slice(-50);
    }

});


notificationSchema.statics.findByServer = function (serverId) {
    return this.find({ serverId }).sort({ createdAt: -1 });
};

notificationSchema.statics.findActive = function (platform) {
    return this.find({ platform, enabled: true });
};

notificationSchema.statics.findByServerAndPlatform = function (serverId, platform) {
    return this.find({ serverId, platform });
};


notificationSchema.methods.markChecked = function (notifiedId) {
    this.lastChecked = new Date();
    this.failCount = 0;
    this.lastError = null;
    if (notifiedId) {
        this.lastNotifiedId = notifiedId;
        if (!this.notifiedIds.includes(notifiedId)) {
            this.notifiedIds.push(notifiedId);
        }
    }
    return this.save();
};


notificationSchema.methods.markFailed = function (errorMessage) {
    this.lastChecked = new Date();
    this.failCount += 1;
    this.lastError = errorMessage;
    
    if (this.failCount >= 10) {
        this.enabled = false;
    }
    return this.save();
};

module.exports = mongoose.model('Notification', notificationSchema);
