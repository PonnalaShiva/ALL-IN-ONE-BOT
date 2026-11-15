const fs = require('fs').promises;
const path = require('path');

module.exports = async function scanCommands(config) {
    const commandsPath = path.join(__dirname, '../commands');
    const commandFolders = await fs.readdir(commandsPath);
    const categories = config?.categories || {};
    const enabledFolders = commandFolders.filter(folder => categories[folder]);

    let totalCommands = 0;

    for (const folder of enabledFolders) {
        const commandFiles = (await fs.readdir(path.join(commandsPath, folder)))
            .filter(file => file.endsWith('.js'));
        totalCommands += commandFiles.length;
    }

    return totalCommands;
};
