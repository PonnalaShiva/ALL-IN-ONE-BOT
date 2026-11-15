const mongoose = require('mongoose');


const ticketOptionSchema = new mongoose.Schema({
    label: { type: String, required: true, maxlength: 50 },
    value: { type: String, required: true, maxlength: 50 },
    description: { type: String, maxlength: 50, default: null },
    emoji: { type: String, default: null }
}, { _id: false });


const customEmbedSchema = new mongoose.Schema({
    title: { type: String, maxlength: 256, default: null },
    description: { type: String, maxlength: 4096, default: null },
    color: { type: Number, default: 0x00FF00 },
    url: { type: String, default: null },
    timestamp: { type: Boolean, default: true },
    author: {
        name: { type: String, maxlength: 256, default: null },
        url: { type: String, default: null },
        icon_url: { type: String, default: null }
    },
    footer: {
        text: { type: String, maxlength: 2048, default: null },
        icon_url: { type: String, default: null }
    },
    thumbnail: {
        url: { type: String, default: null }
    },
    image: {
        url: { type: String, default: null }
    },
    fields: [{
        name: { type: String, maxlength: 256 },
        value: { type: String, maxlength: 1024 },
        inline: { type: Boolean, default: false }
    }]
}, { _id: false });

const ticketConfigSchema = new mongoose.Schema({
    serverId: { type: String, required: true, unique: true },
    guildId: { type: String, default: null },
    ticketChannelId: { type: String, required: true },
    transcriptChannelId: { type: String, default: null },
    adminRoleId: { type: String, required: true },
    status: { type: Boolean, default: true },
    ownerId: { type: String, required: true },
    categoryId: { type: String, default: null },

    
    customEmbed: { type: customEmbedSchema, default: null },

    
    interactionType: {
        type: String,
        enum: ['button', 'dropdown'],
        default: 'dropdown'
    },

    
    ticketOptions: {
        type: [ticketOptionSchema],
        default: [
            { label: 'Support', value: 'support', description: 'Get help from our team', emoji: '🆘' },
            { label: 'Suggestion', value: 'suggestion', description: 'Share your ideas', emoji: '📂' },
            { label: 'Feedback', value: 'feedback', description: 'Give us feedback', emoji: '💜' },
            { label: 'Report', value: 'report', description: 'Report an issue', emoji: '⚠️' }
        ],
        validate: {
            validator: function (v) {
                return v.length >= 1 && v.length <= 10;
            },
            message: 'Ticket options must have between 1 and 10 items'
        }
    }
});

ticketConfigSchema.pre('save', function () {
    if (!this.guildId && this.serverId) this.guildId = this.serverId;
    if (!this.serverId && this.guildId) this.serverId = this.guildId;
});

ticketConfigSchema.pre('findOneAndUpdate', function () {
    const update = this.getUpdate();
    if (update) {
        if (update.serverId && !update.guildId) update.guildId = update.serverId;
        if (update.guildId && !update.serverId) update.serverId = update.guildId;
        if (update.$set) {
            if (update.$set.serverId && !update.$set.guildId) update.$set.guildId = update.$set.serverId;
            if (update.$set.guildId && !update.$set.serverId) update.$set.serverId = update.$set.guildId;
        }
    }
});

module.exports = mongoose.model('TicketConfig', ticketConfigSchema);
