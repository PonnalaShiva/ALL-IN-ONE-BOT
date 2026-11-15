const mongoose = require('mongoose');


const commandLogsConfigSchema = new mongoose.Schema({
    guildId: {
        type: String,
        default: null
    },
    serverId: {
        type: String,
        default: null
    },
    channelId: {
        type: String,
        default: null
    },
    logChannelId: {
        type: String,
        default: null
    },
    enabled: {
        type: Boolean,
        default: false
    },
    isEnabled: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

commandLogsConfigSchema.pre('validate', function () {
    if (!this.guildId && this.serverId) this.guildId = this.serverId;
    if (!this.serverId && this.guildId) this.serverId = this.guildId;
    if (!this.channelId && this.logChannelId) this.channelId = this.logChannelId;
    if (!this.logChannelId && this.channelId) this.logChannelId = this.channelId;
    if (this.enabled !== undefined && this.isEnabled === undefined) this.isEnabled = this.enabled;
    if (this.isEnabled !== undefined && this.enabled === undefined) this.enabled = this.isEnabled;
});

commandLogsConfigSchema.pre('save', function () {
    if (!this.guildId && this.serverId) this.guildId = this.serverId;
    if (!this.serverId && this.guildId) this.serverId = this.guildId;
    if (!this.channelId && this.logChannelId) this.channelId = this.logChannelId;
    if (!this.logChannelId && this.channelId) this.logChannelId = this.channelId;
    if (this.enabled !== undefined && this.isEnabled === undefined) this.isEnabled = this.enabled;
    if (this.isEnabled !== undefined && this.enabled === undefined) this.enabled = this.isEnabled;
});

commandLogsConfigSchema.pre('findOneAndUpdate', function () {
    const update = this.getUpdate();
    if (update) {
        if (update.serverId && !update.guildId) update.guildId = update.serverId;
        if (update.guildId && !update.serverId) update.serverId = update.guildId;
        if (update.logChannelId && !update.channelId) update.channelId = update.logChannelId;
        if (update.channelId && !update.logChannelId) update.logChannelId = update.channelId;
        if (update.enabled !== undefined && update.isEnabled === undefined) update.isEnabled = update.enabled;
        if (update.isEnabled !== undefined && update.enabled === undefined) update.enabled = update.isEnabled;
        if (update.$set) {
            if (update.$set.serverId && !update.$set.guildId) update.$set.guildId = update.$set.serverId;
            if (update.$set.guildId && !update.$set.serverId) update.$set.serverId = update.$set.guildId;
            if (update.$set.logChannelId && !update.$set.channelId) update.$set.channelId = update.$set.logChannelId;
            if (update.$set.channelId && !update.$set.logChannelId) update.$set.logChannelId = update.$set.channelId;
            if (update.$set.enabled !== undefined && update.$set.isEnabled === undefined) update.$set.isEnabled = update.$set.enabled;
            if (update.$set.isEnabled !== undefined && update.$set.enabled === undefined) update.$set.enabled = update.$set.isEnabled;
        }
    }
});

module.exports = mongoose.model('CommandLogsConfig', commandLogsConfigSchema);