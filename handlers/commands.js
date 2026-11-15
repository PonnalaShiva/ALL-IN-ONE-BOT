const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

function collectLocalCommands(config) {
    const commandsPath = path.join(__dirname, '../commands');
    const commandFolders = fs.readdirSync(commandsPath, { withFileTypes: true })
        .filter(entry => entry.isDirectory() && config?.categories?.[entry.name])
        .map(entry => entry.name)
        .sort();
    const commands = [];
    const names = new Map();

    for (const folder of commandFolders) {
        const commandFiles = fs.readdirSync(path.join(commandsPath, folder))
            .filter(file => file.endsWith('.js'))
            .sort();

        for (const file of commandFiles) {
            const command = require(path.join(commandsPath, folder, file));
            const source = `${folder}/${file}`;
            if (!command?.data || typeof command.data.name !== 'string' || typeof command.data.toJSON !== 'function' || typeof command.execute !== 'function') {
                throw new Error(`Invalid slash command export in ${source}; expected data.name, data.toJSON(), and execute().`);
            }
            const name = command.data.name.trim().toLowerCase();
            if (!/^[a-z0-9_-]{1,32}$/.test(name)) {
                throw new Error(`Invalid Discord slash command name "${command.data.name}" in ${source}.`);
            }
            if (names.has(name)) {
                throw new Error(`Duplicate slash command name "${name}" in ${names.get(name)} and ${source}.`);
            }
            const payload = command.data.toJSON();
            if (payload.name !== name || typeof payload.description !== 'string' || !payload.description.trim()) {
                throw new Error(`Invalid slash command payload for "${name}" in ${source}.`);
            }
            names.set(name, source);
            command.category = folder;
            commands.push({ command, payload });
        }
    }

    validateCommandAliases(commands);
    return commands;
}

function validateCommandAliases(entries) {
    const canonicalNames = new Map(entries.map(({ payload, command }) => [
        payload.name,
        command.data?.name || payload.name
    ]));
    const aliasOwners = new Map();

    for (const { command, payload } of entries) {
        const aliases = command.aliases ?? [];
        if (!Array.isArray(aliases)) {
            throw new Error(`Command aliases for "${payload.name}" must be an array.`);
        }
        const localAliases = new Set();
        for (const rawAlias of aliases) {
            if (typeof rawAlias !== 'string' || !/^[a-z0-9_-]{1,32}$/i.test(rawAlias)) {
                throw new Error(`Invalid prefix alias for command "${payload.name}".`);
            }
            const alias = rawAlias.trim().toLowerCase();
            if (localAliases.has(alias)) {
                throw new Error(`Duplicate alias "${alias}" on command "${payload.name}".`);
            }
            localAliases.add(alias);

            const canonicalOwner = canonicalNames.get(alias);
            if (canonicalOwner) {
                throw new Error(`Alias "${alias}" on command "${payload.name}" conflicts with canonical command "${canonicalOwner}".`);
            }
            const previousOwner = aliasOwners.get(alias);
            if (previousOwner) {
                throw new Error(`Alias "${alias}" is shared by commands "${previousOwner}" and "${payload.name}".`);
            }
            aliasOwners.set(alias, payload.name);
        }
    }
}

async function loadCommands(client, config, colors) {
    const entries = collectLocalCommands(config);
    const commands = entries.map(({ command, payload }) => {
        
        client.commands.set(command.data.name, command);
        return payload;
    });

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN || config.token);

    try {
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );

        console.log(`${colors.green}[ LOADER ] Synchronized ${commands.length} enabled slash commands with Discord.${colors.reset}`);
    } catch (error) {
        console.log(`${colors.red}[ ERROR ]${colors.reset} ${colors.red}${error}${colors.reset}`);
        throw error;
    }
    return { count: commands.length, registered: true };
}

loadCommands.validateLocalCommands = collectLocalCommands;
loadCommands.validateCommandAliases = validateCommandAliases;


loadCommands.shouldSyncSlashCommands = () => true;
module.exports = loadCommands;
