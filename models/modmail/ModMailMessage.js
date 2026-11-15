
const mongoose = require('mongoose');

const modMailMessageSchema = new mongoose.Schema({
    threadId: { type: mongoose.Schema.Types.ObjectId, ref: 'ModMailThread', required: true },
    messageId: { type: String, required: true },
    authorId: { type: String, required: true },
    content: { type: String, required: true },
    attachments: [{ 
        name: String,
        url: String,
        size: Number
    }],
    isStaff: { type: Boolean, default: false },
    isAnonymous: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now }
});

modMailMessageSchema.index({ threadId: 1, createdAt: 1 });
modMailMessageSchema.index({ threadId: 1, messageId: 1 }, { unique: true });

module.exports = mongoose.model('ModMailMessage', modMailMessageSchema);
