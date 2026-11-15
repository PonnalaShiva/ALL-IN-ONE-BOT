const mongoose = require('mongoose');

const countingSchema = new mongoose.Schema({
    serverId: { 
        type: String, 
        required: true, 
        unique: true 
    },
    channelId: { 
        type: String, 
        required: true 
    },
    currentCount: { 
        type: Number, 
        default: 0 
    },
    status: { 
        type: Boolean, 
        default: true 
    },
    lastUserId: { 
        type: String, 
        default: null 
    },
    highestCount: { 
        type: Number, 
        default: 0 
    },
    totalMessages: { 
        type: Number, 
        default: 0 
    },
    revision: { type: Number, default: 0 },
    recentMessageIds: { type: [String], default: [] },
    resetCount: { 
        type: Number, 
        default: 0 
    },
    allowSameUser: { 
        type: Boolean, 
        default: false 
    },
    deleteWrongMessages: { 
        type: Boolean, 
        default: true 
    },
    showErrorMessages: { 
        type: Boolean, 
        default: true 
    },
    errorMessageDuration: { 
        type: Number, 
        default: 3000 
    },
    leaderboard: [{
        userId: String,
        count: { type: Number, default: 0 },
        lastContribution: { type: Date, default: Date.now }
    }],
    milestones: [{
        count: Number,
        achievedAt: { type: Date, default: Date.now },
        achievedBy: String
    }],
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

countingSchema.index({ channelId: 1 });


countingSchema.statics.applyCountMessage = async function({ serverId, channelId, userId, count, messageId, maxRetries = 5 }) {
    if (!serverId || !channelId || !userId || !messageId || !Number.isSafeInteger(count) || count < 1) {
        return { success: false, error: 'invalid_input' };
    }

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        const config = await this.findOne({ serverId, channelId, status: true });
        if (!config) return { success: false, error: 'disabled' };
        const currentCount = Number(config.currentCount) || 0;
        const recentIds = config.recentMessageIds || [];
        if (recentIds.includes(messageId)) return { success: false, error: 'duplicate', config };
        if (count !== currentCount + 1) return { success: false, error: 'wrong_number', expected: currentCount + 1, config };
        if (!config.allowSameUser && config.lastUserId === userId) return { success: false, error: 'same_user_not_allowed', expected: currentCount + 1, config };

        const now = new Date();
        const leaderboard = (config.leaderboard || []).map(entry => ({
            userId: entry.userId,
            count: Number(entry.count) || 0,
            lastContribution: entry.lastContribution
        }));
        const entry = leaderboard.find(item => item.userId === userId);
        if (entry) {
            entry.count++;
            entry.lastContribution = now;
        } else {
            leaderboard.push({ userId, count: 1, lastContribution: now });
        }
        leaderboard.sort((a, b) => b.count - a.count || String(a.userId).localeCompare(String(b.userId)));

        const filter = {
            _id: config._id,
            serverId,
            channelId,
            status: true,
            lastUserId: config.lastUserId ?? null,
            allowSameUser: Boolean(config.allowSameUser),
            recentMessageIds: { $ne: messageId }
        };
        
        if (currentCount === 0) filter.$and = [{ $or: [{ currentCount: 0 }, { currentCount: { $exists: false } }] }];
        else filter.currentCount = currentCount;
        if (!config.allowSameUser) filter.allowSameUser = { $ne: true };

        const updated = await this.findOneAndUpdate(filter, {
            $set: {
                currentCount: count,
                lastUserId: userId,
                highestCount: Math.max(Number(config.highestCount) || 0, count),
                totalMessages: (Number(config.totalMessages) || 0) + 1,
                leaderboard: leaderboard.slice(0, 10),
                recentMessageIds: [...recentIds.filter(id => id !== messageId), messageId].slice(-100),
                updatedAt: now
            },
            $inc: { revision: 1 }
        }, { returnDocument: 'after', runValidators: true });

        if (updated) return { success: true, newCount: count, isHighestCount: count > (Number(config.highestCount) || 0), config: updated };
        
    }

    const latest = await this.findOne({ serverId, channelId, status: true });
    return { success: false, error: 'contention', expected: (Number(latest?.currentCount) || 0) + 1, config: latest };
};

countingSchema.methods.incrementCount = async function(userId) {
    const result = await this.constructor.applyCountMessage({
        serverId: this.serverId,
        channelId: this.channelId,
        userId,
        count: (Number(this.currentCount) || 0) + 1,
        messageId: `legacy-count:${Date.now()}:${Math.random().toString(36).slice(2)}`
    });
    if (!result.success) throw new Error(`Count increment failed: ${result.error}`);
    return result.config;
};

countingSchema.methods.resetCounting = function(userId) {
    return this.constructor.findOneAndUpdate({ _id: this._id }, {
        $set: { currentCount: 0, lastUserId: null, updatedAt: new Date() },
        $inc: { resetCount: 1, revision: 1 }
    }, { returnDocument: 'after', runValidators: true });
};

countingSchema.methods.addMilestone = function(count, userId) {
    return this.constructor.findOneAndUpdate({
        _id: this._id,
        'milestones.count': { $ne: count }
    }, {
        $push: {
            milestones: {
                $each: [{ count, achievedAt: new Date(), achievedBy: userId }],
                $slice: -50
            }
        },
        $inc: { revision: 1 }
    }, { returnDocument: 'after', runValidators: true });
};


countingSchema.statics.findByServerId = function(serverId) {
    return this.findOne({ serverId });
};

countingSchema.statics.findByChannelId = function(channelId) {
    return this.findOne({ channelId });
};

countingSchema.statics.getLeaderboard = function(serverId, limit = 10) {
    return this.findOne({ serverId })
        .select('leaderboard')
        .then(doc => doc ? doc.leaderboard.slice(0, limit) : []);
};

module.exports = mongoose.model('CountingConfig', countingSchema);
