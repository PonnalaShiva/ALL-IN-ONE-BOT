'use strict';

const _cmdIds = new Map();
const FALLBACK_BOT_ID = '1270691569225433150';

async function cacheCommandIds(client, interaction) {
    if (_cmdIds.size > 0) return;
    try {
        if (client?.application?.commands) {
            const globalCommands = await client.application.commands.fetch().catch(() => null);
            if (globalCommands) {
                globalCommands.forEach((command) => {
                    if (command.type === 1 && command.name) {
                        _cmdIds.set(command.name.toLowerCase(), command.id);
                    }
                });
            }
        }
        if (interaction?.guild?.commands) {
            const guildCommands = await interaction.guild.commands.fetch().catch(() => null);
            if (guildCommands) {
                guildCommands.forEach((command) => {
                    if (command.type === 1 && command.name) {
                        _cmdIds.set(command.name.toLowerCase(), command.id);
                    }
                });
            }
        }
    } catch (_) {}
}

function formatCommandLink(name, subName = null) {
    const key = String(name || '').toLowerCase();
    let cmdId = _cmdIds.get(key);
    if (!cmdId) {
        cmdId = _cmdIds.get('bot') || _cmdIds.get('help') || FALLBACK_BOT_ID;
    }
    if (subName) {
        return `</${key} ${String(subName).toLowerCase()}:${cmdId}>`;
    }
    return `</${key}:${cmdId}>`;
}

function getRandomCategorySuggestions(client, category = 'basic') {
    const safeLinks = [];
    if (!client?.commands) {
        return `</bot stats:${FALLBACK_BOT_ID}>   </bot ping:${FALLBACK_BOT_ID}>   </bot status:${FALLBACK_BOT_ID}>`;
    }

    const commandList = typeof client.commands.filter === 'function'
        ? client.commands
        : Array.from(client.commands.values ? client.commands.values() : (Array.isArray(client.commands) ? client.commands : []));

    const categoryCommands = commandList.filter(
        cmd => cmd?.category === category && (cmd?.data?.name || cmd?.name) !== 'help'
    );

    categoryCommands.forEach(cmd => {
        const cmdName = String(cmd.data?.name || cmd.name || '').toLowerCase();
        if (!cmdName) return;
        const cmdId = _cmdIds.get(cmdName) || FALLBACK_BOT_ID;

        const rawCmd = cmd.data?.toJSON ? cmd.data.toJSON() : cmd;
        if (rawCmd?.options) {
            const subcommands = rawCmd.options.filter(o => o.type === 1 || o.type === 2);
            if (subcommands.length > 0) {
                subcommands.forEach(sub => {
                    if (sub.type === 1 && sub.name) {
                        safeLinks.push(`</${cmdName} ${sub.name.toLowerCase()}:${cmdId}>`);
                    } else if (sub.type === 2 && sub.name) {
                        const subOptions = sub.options || [];
                        subOptions.forEach(subOpt => {
                            if (subOpt.type === 1 && subOpt.name) {
                                safeLinks.push(`</${cmdName} ${sub.name.toLowerCase()} ${subOpt.name.toLowerCase()}:${cmdId}>`);
                            }
                        });
                    }
                });
            } else {
                safeLinks.push(`</${cmdName}:${cmdId}>`);
            }
        } else {
            safeLinks.push(`</${cmdName}:${cmdId}>`);
        }
    });

    if (safeLinks.length === 0) {
        const botId = _cmdIds.get('bot') || FALLBACK_BOT_ID;
        return `</bot stats:${botId}>   </bot ping:${botId}>   </bot status:${botId}>`;
    }

    const shuffled = [...safeLinks].sort(() => 0.5 - Math.random());
    const selected = [];
    const seen = new Set();
    for (const link of shuffled) {
        if (!seen.has(link)) {
            seen.add(link);
            selected.push(link);
            if (selected.length === 3) break;
        }
    }
    return selected.join('   ');
}

module.exports = {
    _cmdIds,
    cacheCommandIds,
    formatCommandLink,
    getRandomCategorySuggestions,
};

