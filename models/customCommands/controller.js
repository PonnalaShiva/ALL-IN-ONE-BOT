const CustomCommand = require('./schema');

async function createOrUpdateCommand(serverId, userId, commandName, response) {
  await CustomCommand.findOneAndUpdate(
    { serverId, commandName },
    { $set: { userId, response } },
    { upsert: true, returnDocument: 'after' }
  );
}

async function getUserCommands(serverId, userId) {
  return await CustomCommand.find({ serverId, userId }).lean();
}

async function deleteCommand(serverId, userId, commandName, isAdmin = false) {
  const query = isAdmin ? { serverId, commandName } : { serverId, userId, commandName };
  const result = await CustomCommand.deleteOne(query);
  return result.deletedCount > 0;
}

module.exports = {
  createOrUpdateCommand,
  getUserCommands,
  deleteCommand,
};
