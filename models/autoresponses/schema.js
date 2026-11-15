const mongoose = require('mongoose');

const embedFieldSchema = new mongoose.Schema({
    name: { type: String, required: true },
    value: { type: String, required: true },
    inline: { type: Boolean, default: false }
}, { _id: false });

const embedSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    color: { type: String, default: '#FF00FF' },

    author: {
        name: { type: String, required: false },
        url: { type: String, required: false },
        iconURL: { type: String, required: false }
    },

    footer: {
        text: { type: String, required: false },
        iconURL: { type: String, required: false }
    },

    image: { type: String, required: false },
    thumbnail: { type: String, required: false },

    fields: {
        type: [embedFieldSchema],
        validate: {
            validator: (val) => val.length >= 2,
            message: 'At least 2 fields are required.'
        }
    }
}, { _id: false });

const autoResponderSchema = new mongoose.Schema({
    userId: { type: String, required: true, index: true },
    guildId: { type: String, required: true, index: true },
    trigger: { type: String, required: true },
    
    matchType: {
        type: String,
        enum: ['exact', 'partial', 'whole'],
        required: true
    },

    channels: {
        type: [String],
        required: true,
        validate: arr => arr.length > 0
    },

    textResponse: { type: String, default: null },
    embedData: { type: embedSchema, default: null },

    status: { type: Boolean, default: false }
}, { timestamps: true });

autoResponderSchema.index({ guildId: 1, trigger: 1 }, { unique: true });

module.exports = mongoose.model('AutoResponder', autoResponderSchema);
