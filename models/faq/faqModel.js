const mongoose = require('mongoose');


const channelSchema = new mongoose.Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    type: { type: String, required: true }
}, { _id: false });

const roleSchema = new mongoose.Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    permissions: { type: String, required: true }
}, { _id: false });

const linkSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['youtube', 'website', 'discord', 'social', 'documentation', 'guide', 'other'],
        required: true
    },
    name: {
        type: String,
        required: true,
        maxlength: 100
    },
    url: {
        type: String,
        required: true,
        validate: {
            validator: function(v) {
                return /^https?:\/\/.+/.test(v);
            },
            message: 'Invalid URL format'
        }
    },
    description: {
        type: String,
        maxlength: 200
    }
}, { _id: false });

const faqConfigSchema = new mongoose.Schema({
    guildId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    enabled: {
        type: Boolean,
        default: false
    },
    channels: {
        type: String, 
        default: 'ALL'
    },
    prefix: {
        type: String,
        default: '?',
        maxlength: 5
    },
    context: {
        serverDescription: {
            type: String,
            maxlength: 5000
        },
        customInstructions: {
            type: String,
            maxlength: 2000
        }
    },
    links: [linkSchema],
    serverMetadata: {
        serverName: { type: String, default: '' },
        memberCount: { type: Number, default: 0 },
        channelCount: { type: Number, default: 0 },
        roleCount: { type: Number, default: 0 },
        channels: [channelSchema], 
        roles: [roleSchema], 
        lastUpdated: {
            type: Date,
            default: Date.now
        }
    },
    usage: {
        totalQueries: {
            type: Number,
            default: 0
        },
        dailyQueries: {
            type: Number,
            default: 0
        },
        lastDailyReset: {
            type: Date,
            default: Date.now
        }
    }
}, {
    timestamps: true
});


faqConfigSchema.statics.findByGuild = function(guildId) {
    return this.findOne({ guildId });
};

faqConfigSchema.statics.createOrUpdate = function(guildId, updateData) {
    return this.findOneAndUpdate(
        { guildId },
        { $set: updateData },
        { upsert: true, returnDocument: 'after' }
    );
};

faqConfigSchema.statics.isChannelEnabled = async function(guildId, channelId) {
    const config = await this.findByGuild(guildId);
    if (!config || !config.enabled) return false;
    
    if (config.channels === 'ALL') return true;
    
    const allowedChannels = config.channels.split(',').map(id => id.trim());
    return allowedChannels.includes(channelId);
};


faqConfigSchema.statics.updateServerMetadataStatic = async function(guildId, guildData) {
    try {
        
        const channelsArray = [];
        if (guildData.channels && guildData.channels.cache) {
            guildData.channels.cache.forEach(channel => {
                channelsArray.push({
                    id: channel.id,
                    name: channel.name,
                    type: channel.type.toString()
                });
            });
        }

        
        const rolesArray = [];
        if (guildData.roles && guildData.roles.cache) {
            guildData.roles.cache.forEach(role => {
                rolesArray.push({
                    id: role.id,
                    name: role.name,
                    permissions: role.permissions.bitfield.toString()
                });
            });
        }

        
        const result = await this.findOneAndUpdate(
            { guildId },
            {
                $set: {
                    'serverMetadata.serverName': guildData.name,
                    'serverMetadata.memberCount': guildData.memberCount,
                    'serverMetadata.channelCount': guildData.channels?.cache?.size || 0,
                    'serverMetadata.roleCount': guildData.roles?.cache?.size || 0,
                    'serverMetadata.channels': channelsArray,
                    'serverMetadata.roles': rolesArray,
                    'serverMetadata.lastUpdated': new Date()
                }
            },
            { upsert: false, returnDocument: 'after' }
        );

        return result;
    } catch (error) {
        console.error('Error in updateServerMetadataStatic:', error);
        throw error;
    }
};


faqConfigSchema.methods.addLink = function(linkData) {
    this.links.push(linkData);
    return this.save();
};

faqConfigSchema.methods.removeLink = function(linkName) {
    this.links = this.links.filter(link => link.name !== linkName);
    return this.save();
};

faqConfigSchema.methods.updateServerMetadata = function(guildData) {
    try {
        const channelsArray = [];
        const rolesArray = [];

        
        if (guildData.channels && guildData.channels.cache) {
            guildData.channels.cache.forEach(channel => {
                channelsArray.push({
                    id: channel.id,
                    name: channel.name,
                    type: channel.type.toString()
                });
            });
        }

        
        if (guildData.roles && guildData.roles.cache) {
            guildData.roles.cache.forEach(role => {
                rolesArray.push({
                    id: role.id,
                    name: role.name,
                    permissions: role.permissions.bitfield.toString()
                });
            });
        }

        
        this.serverMetadata = {
            serverName: guildData.name,
            memberCount: guildData.memberCount,
            channelCount: guildData.channels?.cache?.size || 0,
            roleCount: guildData.roles?.cache?.size || 0,
            channels: channelsArray,
            roles: rolesArray,
            lastUpdated: new Date()
        };

        return this.save();
    } catch (error) {
        console.error('Error updating server metadata:', error);
        throw error;
    }
};

faqConfigSchema.methods.incrementUsage = function() {
    this.usage.totalQueries += 1;
    
    
    const now = new Date();
    const lastReset = new Date(this.usage.lastDailyReset);
    if (now.getDate() !== lastReset.getDate() || 
        now.getMonth() !== lastReset.getMonth() || 
        now.getFullYear() !== lastReset.getFullYear()) {
        this.usage.dailyQueries = 1;
        this.usage.lastDailyReset = now;
    } else {
        this.usage.dailyQueries += 1;
    }
    
    return this.save();
};

module.exports = mongoose.model('FaqConfig', faqConfigSchema);