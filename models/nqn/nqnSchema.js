const mongoose = require('mongoose');

const nqnConfigSchema = new mongoose.Schema({
    serverId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    status: {
        type: Boolean,
        required: true,
        default: false
    },
    ownerId: {
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
});


nqnConfigSchema.pre('save', function() {
    this.updatedAt = Date.now();

});


nqnConfigSchema.pre('findOneAndUpdate', function() {
    this.set({ updatedAt: Date.now() });

});

module.exports = mongoose.model('NqnConfig', nqnConfigSchema);