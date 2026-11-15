const DisabledCommand = require('../../../models/commands/DisabledCommands');
const colors = require('../../../UI/colors/colors');
const client = require('../../../main');


function emitCommandUpdate(serverId, commandData, socket) {
    socket.emit('bot_data_update', {
        type: 'command_config',
        payload: {
            guildId: serverId,
            commandName: commandData.commandName,
            subcommandName: commandData.subcommandName,
            isDisabled: true,
            _id: commandData._id
        }
    });
}


async function getDisabledCommands(guildId, socket) {
    try {
        const disabledCommands = await DisabledCommand.find({ guildId });
        
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'server_disabled_commands',
                payload: {
                    guildId,
                    commands: disabledCommands.map(cmd => ({
                        commandName: cmd.commandName,
                        subcommandName: cmd.subcommandName,
                        guildId: cmd.guildId,
                        _id: cmd._id
                    }))
                }
            });
        }
        
        return disabledCommands;
    } catch (error) {
        console.error(`${colors.red}❌ Error getting disabled commands:${colors.reset}`, error);
        
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'command_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'get_disabled_commands'
                }
            });
        }
        
        throw error;
    }
}


async function disableCommand(guildId, commandName, subcommandName = null, socket) {
    try {
        console.log(`[DEBUG] Disabling command: ${commandName}${subcommandName ? ` ${subcommandName}` : ''} for Guild: ${guildId}`);

        
        const existing = await DisabledCommand.findOne({ guildId, commandName, subcommandName });
        if (existing) {
            throw new Error(`Command is already disabled`);
        }

        const disabledCommand = await DisabledCommand.create({
            guildId,
            commandName,
            subcommandName
        });

        if (socket) {
            emitCommandUpdate(guildId, disabledCommand, socket);
        }

        console.log(`${colors.red}🚫 Disabled command: ${commandName}${subcommandName ? ` ${subcommandName}` : ''} for server ${guildId}${colors.reset}`);
        
        return disabledCommand;
    } catch (error) {
        console.error(`${colors.red}❌ Error disabling command:${colors.reset}`, error);
        
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'command_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'disable_command'
                }
            });
        }
        
        throw error;
    }
}


async function enableCommand(guildId, commandName, subcommandName = null, socket) {
    try {
        console.log(`[DEBUG] Enabling command: ${commandName}${subcommandName ? ` ${subcommandName}` : ''} for Guild: ${guildId}`);

        const deletedCommand = await DisabledCommand.findOneAndDelete({
            guildId,
            commandName,
            subcommandName
        });

        if (!deletedCommand) {
            throw new Error(`Command is not disabled`);
        }

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'command_enabled',
                payload: {
                    guildId,
                    commandName,
                    subcommandName,
                    _id: deletedCommand._id
                }
            });
        }

        console.log(`${colors.green}✅ Enabled command: ${commandName}${subcommandName ? ` ${subcommandName}` : ''} for server ${guildId}${colors.reset}`);
        
        return deletedCommand;
    } catch (error) {
        console.error(`${colors.red}❌ Error enabling command:${colors.reset}`, error);
        
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'command_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'enable_command'
                }
            });
        }
        
        throw error;
    }
}


async function toggleCommand(guildId, commandName, subcommandName = null, socket) {
    try {
        const existing = await DisabledCommand.findOne({ guildId, commandName, subcommandName });
        
        if (existing) {
            
            return await enableCommand(guildId, commandName, subcommandName, socket);
        } else {
            
            return await disableCommand(guildId, commandName, subcommandName, socket);
        }
    } catch (error) {
        console.error(`${colors.red}❌ Error toggling command:${colors.reset}`, error);
        
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'command_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'toggle_command'
                }
            });
        }
        
        throw error;
    }
}


async function enableAllCommands(guildId, socket) {
    try {
        const result = await DisabledCommand.deleteMany({ guildId });

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'all_commands_enabled',
                payload: {
                    guildId,
                    enabledCount: result.deletedCount
                }
            });
        }

        console.log(`${colors.green}✅ Enabled all commands for server ${guildId}. Count: ${result.deletedCount}${colors.reset}`);
        
        return result;
    } catch (error) {
        console.error(`${colors.red}❌ Error enabling all commands:${colors.reset}`, error);
        
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'command_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'enable_all_commands'
                }
            });
        }
        
        throw error;
    }
}


async function getCommandStats(guildId, socket) {
    try {
        const disabledCount = await DisabledCommand.countDocuments({ guildId });
        
        
        const availableCommands = client.commands ? client.commands.size : 0;
        
        const stats = {
            totalCommands: availableCommands,
            disabledCommands: disabledCount,
            enabledCommands: Math.max(0, availableCommands - disabledCount)
        };

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'command_stats',
                payload: {
                    guildId,
                    stats
                }
            });
        }

        return stats;
    } catch (error) {
        console.error(`${colors.red}❌ Error getting command stats:${colors.reset}`, error);
        
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'command_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'get_command_stats'
                }
            });
        }
        
        throw error;
    }
}


async function sendAllDisabledCommands(socket) {
    try {
        const disabledCommands = await DisabledCommand.find({});
        
        
        const commandsByGuild = {};
        disabledCommands.forEach(cmd => {
            if (!commandsByGuild[cmd.guildId]) {
                commandsByGuild[cmd.guildId] = [];
            }
            commandsByGuild[cmd.guildId].push({
                commandName: cmd.commandName,
                subcommandName: cmd.subcommandName,
                guildId: cmd.guildId,
                _id: cmd._id
            });
        });

        
        for (const [guildId, commands] of Object.entries(commandsByGuild)) {
            socket.emit('bot_data_update', {
                type: 'server_disabled_commands',
                payload: {
                    guildId,
                    commands
                }
            });
        }
        
        console.log(`${colors.green}📊 Sent disabled commands for ${Object.keys(commandsByGuild).length} guilds to middleware${colors.reset}`);
    } catch (error) {
        console.error(`${colors.red}❌ Error sending all disabled commands:${colors.reset}`, error);
    }
}

module.exports = {
    getDisabledCommands,
    disableCommand,
    enableCommand,
    toggleCommand,
    enableAllCommands,
    getCommandStats,
    sendAllDisabledCommands
};
