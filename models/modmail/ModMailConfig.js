
const mongoose = require('mongoose');

const modMailConfigSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    logChannelId: { type: String, required: true },
    adminRoleId: { type: String, required: true },
    categoryId: { type: String, default: null }, 
    status: { type: Boolean, default: true },
    ownerId: { type: String, required: true },
    welcomeMessage: { 
        type: String, 
        default: "Hello! Thank you for contacting our staff team. Please describe your issue and we'll get back to you shortly." 
    },
    autoResponse: { type: Boolean, default: true },
    allowAttachments: { type: Boolean, default: true },
    maxOpenTickets: { type: Number, default: 3 },
    cooldownTime: { type: Number, default: 300000 }, 
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

modMailConfigSchema.pre('save', function() {
    this.updatedAt = Date.now();

});

module.exports = mongoose.model('ModMailConfig', modMailConfigSchema);
