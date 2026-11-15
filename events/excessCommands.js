'use strict';

const { MessageFlags } = require('discord.js');
const fs = require('fs').promises;
const path = require('path');
const config = require('../config.js');
const { buildCard } = require('../UI');
const { getEmoji } = require('../UI/emojis/emoji');
const logger = require('../utils/logger');
const loadLanguage = require('./loadLanguage');
const {
    getServerConfig,
    getHentaiConfig,
    isCommandDisabled
} = require('../utils/cacheHelpers');

const commandRegistry = new Map();
const excessCommandsPath = path.join(__dirname, '..', 'excesscommands');

const registryReady = (async () => {
    try {
        const commandFolders = await fs.readdir(excessCommandsPath, { withFileTypes: true });
        const folders = commandFolders.filter(entry => entry.isDirectory()).map(entry => entry.name);

        for (const folder of folders) {
            const folderPath = path.join(excessCommandsPath, folder);
            const files = await fs.readdir(folderPath);

            for (const file of files) {
                if (!file.endsWith('.js')) continue;
                const commandName = file.slice(0, -3);
                const key = `${folder}_${commandName}`;
                commandRegistry.set(key, { folder, commandName, path: path.join(folderPath, file) });
            }
        }
        
    } catch (error) {
        logger.error('COMMANDS', 'Error loading excess command registry', error);
    }
})();

async function handleMessage(message, client) {
    await registryReady;
    if (message.author.bot || !message.guild) return false;

    const guildId = message.guild.id;
    const [serverConfig, hentaiSettings] = await Promise.allSettled([
        getServerConfig(guildId),
        getHentaiConfig(guildId)
    ]);

    const serverConfigValue = serverConfig.status === 'fulfilled' ? serverConfig.value : null;
    const hentaiSettingsValue = hentaiSettings.status === 'fulfilled' ? hentaiSettings.value : null;
    const prefix = serverConfigValue?.prefix || config.prefix;
    if (!prefix || !message.content.startsWith(prefix)) return false;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift()?.toLowerCase();
    if (!commandName) return false;

    for (const cmdInfo of commandRegistry.values()) {
        if (cmdInfo.commandName !== commandName) continue;

        const commandFolder = cmdInfo.folder;
        if (commandFolder === 'nsfw' || commandFolder === 'hentai') {
            if (!hentaiSettingsValue?.status) {
                const lang = loadLanguage(guildId);
                const card = buildCard({
                    title: `${getEmoji('nsfw') || getEmoji('cross')} ${lang.nsfwDisabled || 'NSFW commands are currently disabled.'}`,
                    tone: 'danger'
                });
                await message.reply({ components: [card], flags: MessageFlags.IsComponentsV2 });
                return true;
            }
        }

        const configKey = commandFolder === 'hentai' ? 'nsfw' : commandFolder;
        const categoryEnabled = config.excessCommands &&
            ((commandFolder === 'nsfw' || commandFolder === 'hentai') || config.excessCommands[configKey]);
        if (!categoryEnabled) continue;

        if (await isCommandDisabled(guildId, commandName)) {
            const lang = loadLanguage(guildId);
            const msg = (lang.commandDisabledInServer || 'The `{command}` command is disabled in this server.')
                .replace('{command}', `${prefix}${commandName}`);
            const card = buildCard({ title: `${getEmoji('cross')} ${msg}`, tone: 'danger' });
            await message.reply({ components: [card], flags: MessageFlags.IsComponentsV2 });
            return true;
        }

        let command;
        try {
            command = require(cmdInfo.path);
        } catch (loadError) {
            console.error(`Error loading excess command ${commandName}:`, loadError);
            return false;
        }

        try {
            await command.execute(message, args, client);
        } catch (error) {
            console.error(`[Excess command ${commandName}]`, error);
            const lang = loadLanguage(guildId);
            const card = buildCard({
                title: `${getEmoji('cross')} ${lang.commandErrorTitle || 'Command Error'}`,
                sections: [
                    (lang.commandErrorDesc || 'An error occurred while executing the `{command}` command.')
                        .replace('{command}', commandName),
                    'Please try again later.'
                ],
                tone: 'danger'
            });
            await message.reply({ components: [card], flags: MessageFlags.IsComponentsV2 });
        }
        return true;
    }

    return false;
}

module.exports = { handleMessage };
