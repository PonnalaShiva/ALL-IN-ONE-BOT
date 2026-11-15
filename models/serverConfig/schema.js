const mongoose = require('mongoose');

const ServerConfigSchema = new mongoose.Schema({
  serverId: { type: String, required: true, unique: true },
  botManagers: { type: [String], default: [] },
  adminRoles: { type: [String], default: [] },
  modRoles: { type: [String], default: [] },
  prefix: { type: String, default: '!' },
  lockRoleEnabled: { type: Boolean, default: false },
  rolePersistEnabled: { type: Boolean, default: false }
});

module.exports = mongoose.model('ServerConfig', ServerConfigSchema);
