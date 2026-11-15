const mongoose = require('mongoose');
const inviteSchema =  new mongoose.Schema({
    guildId: { type: String, required: true },
    inviterId: { type: String, required: true },
    inviteCode: { type: String, required: true },
    uses: { type: Number, required: true }
});
module.exports = mongoose.model('Invites', inviteSchema);
