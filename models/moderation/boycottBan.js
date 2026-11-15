const mongoose = require('mongoose');

const boycottBanSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    targetId: { type: String, required: true }, 
    targetType: {
        type: String,
        enum: ['user', 'role'],
        default: 'user',
        required: true
    },
    restrictedNear: { type: String, required: true }, 
    
    userId: { type: String },
    protectedRoles: { type: [String], default: [] },
    reason: { type: String, default: 'No reason provided' },
    addedBy: { type: String }
}, { timestamps: true });


boycottBanSchema.pre('validate', function() {
    if (this.userId && !this.targetId) {
        this.targetId = this.userId;
        if (!this.targetType) this.targetType = 'user';
    }
    if (this.targetId && !this.userId && this.targetType === 'user') {
        this.userId = this.targetId;
    }
    if (Array.isArray(this.protectedRoles) && this.protectedRoles.length > 0 && !this.restrictedNear) {
        this.restrictedNear = this.protectedRoles[0];
    }
    if (this.restrictedNear && (!this.protectedRoles || this.protectedRoles.length === 0)) {
        this.protectedRoles = [this.restrictedNear];
    }
    if (!this.targetType) {
        this.targetType = 'user';
    }

});


boycottBanSchema.index({ guildId: 1, targetId: 1 }, { unique: true });

module.exports = mongoose.model('BoycottBan', boycottBanSchema);
