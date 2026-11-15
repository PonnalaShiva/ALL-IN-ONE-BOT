const ServerConfig = require('./schema');
const { invalidateServerConfig } = require('../../utils/cacheHelpers');

async function getConfig(serverId) {
  return await ServerConfig.findOne({ serverId });
}

async function updateConfig(serverId, data) {
  const result = await ServerConfig.findOneAndUpdate(
    { serverId },
    { $set: data },
    { upsert: true, returnDocument: 'after' }
  );
  
  invalidateServerConfig(serverId);
  return result;
}

async function removeBotManagers(serverId, removeList) {
  const result = await ServerConfig.findOneAndUpdate(
    { serverId },
    { $pull: { botManagers: { $in: removeList } } },
    { returnDocument: 'after' }
  );
  
  invalidateServerConfig(serverId);
  return result;
}

async function removeAdminRoles(serverId, removeList) {
  const result = await ServerConfig.findOneAndUpdate(
    { serverId },
    { $pull: { adminRoles: { $in: removeList } } },
    { returnDocument: 'after' }
  );
  
  invalidateServerConfig(serverId);
  return result;
}

async function removeModRoles(serverId, removeList) {
  const result = await ServerConfig.findOneAndUpdate(
    { serverId },
    { $pull: { modRoles: { $in: removeList } } },
    { returnDocument: 'after' }
  );
  
  invalidateServerConfig(serverId);
  return result;
}

module.exports = {
  getConfig,
  updateConfig,
  removeBotManagers,
  removeAdminRoles,
  removeModRoles
};
