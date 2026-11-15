const mongoose = require('mongoose');

const roleNickConfigSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    roles: [
        {
            roleId: { type: String, required: true },
            nicknameFormat: { type: String, default: '[{ROLE}] {USERNAME}' }
        }
    ]
});

module.exports = mongoose.model('RoleNickConfig', roleNickConfigSchema);
