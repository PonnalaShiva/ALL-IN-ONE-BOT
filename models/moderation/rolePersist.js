const mongoose = require('mongoose');

const rolePersistSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    oderId: { type: String }, 
    roles: { type: [String], default: [] }
}, { timestamps: true });

rolePersistSchema.pre('validate', function() {
    if (this.oderId && !this.userId) {
        this.userId = this.oderId;
    }
    if (this.userId && !this.oderId) {
        this.oderId = this.userId;
    }

});


rolePersistSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('RolePersist', rolePersistSchema);
