const mongoose = require('mongoose');

const EmbedFieldSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        maxlength: 256
    },
    value: {
        type: String,
        required: true,
        maxlength: 1024
    },
    inline: {
        type: Boolean,
        default: false
    }
}, { _id: false });

const EmbedAuthorSchema = new mongoose.Schema({
    name: {
        type: String,
        maxlength: 256
    },
    url: String,
    iconURL: String
}, { _id: false });

const EmbedFooterSchema = new mongoose.Schema({
    text: {
        type: String,
        maxlength: 2048
    },
    iconURL: String
}, { _id: false });

const EmbedSchema = new mongoose.Schema({
    
    embedId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        maxlength: 100
    },
    guildId: {
        type: String,
        required: true,
        index: true
    },
    
    
    title: {
        type: String,
        maxlength: 256
    },
    description: {
        type: String,
        maxlength: 4096
    },
    url: String,
    color: {
        type: String,
        default: '#3498db',
        validate: {
            validator: function(v) {
                return /^#([0-9A-F]{6})$/i.test(v);
            },
            message: 'Color must be a valid hex color'
        }
    },
    timestamp: {
        type: Boolean,
        default: false
    },
    
    
    author: EmbedAuthorSchema,
    footer: EmbedFooterSchema,
    image: String,
    thumbnail: String,
    
    
    fields: {
        type: [EmbedFieldSchema],
        validate: {
            validator: function(fields) {
                return fields.length <= 25;
            },
            message: 'Maximum 25 fields allowed'
        },
        default: []
    },
    
    
    type: {
        type: String,
        enum: ['normal', 'scheduled', 'template'],
        default: 'normal'
    },
    category: {
        type: String,
        default: 'general'
    },
    tags: [String],
    
    
    usageCount: {
        type: Number,
        default: 0
    },
    lastUsed: Date,
    
    
    createdBy: {
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
    },
    updatedBy: String,
    
    
    isPublic: {
        type: Boolean,
        default: false
    },
    allowedRoles: [String],
    allowedUsers: [String]
});


EmbedSchema.pre('save', function() {
    this.updatedAt = new Date();

});


EmbedSchema.statics.generateEmbedId = function() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'EMB-';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

module.exports = mongoose.model('Embed', EmbedSchema);
