const CustomCommand = require('../../../models/customCommands/schema');
const colors = require('../../../UI/colors/colors');
const client = require('../../../main');


async function resolveUserInfo(guild, userId) {
    try {
        const member = await guild.members.fetch(userId);
        return {
            id: userId,
            username: member.user.username,
            displayName: member.displayName,
            avatar: member.user.displayAvatarURL({ size: 64 })
        };
    } catch {
        return { id: userId, username: null, displayName: null, avatar: null };
    }
}


async function emitCustomCommandUpdate(commandData, socket) {
    const guild = client.guilds.cache.get(commandData.serverId);
    const ownerInfo = await resolveUserInfo(guild, commandData.userId);

    socket.emit('bot_data_update', {
        type: 'customcommand_config',
        payload: {
            serverId: commandData.serverId,
            userId: commandData.userId,
            commandName: commandData.commandName,
            response: commandData.response,
            _id: commandData._id,
            createdAt: commandData.createdAt,
            updatedAt: commandData.updatedAt,
            ownerInfo
        }
    });
}


async function getServerCustomCommands(serverId, socket) {
    try {
        const commands = await CustomCommand.find({ serverId }).lean();
        const guild = client.guilds.cache.get(serverId);

        
        const commandsWithOwners = await Promise.all(commands.map(async cmd => {
            const ownerInfo = await resolveUserInfo(guild, cmd.userId);
            return {
                serverId: cmd.serverId,
                userId: cmd.userId,
                commandName: cmd.commandName,
                response: cmd.response,
                _id: cmd._id,
                createdAt: cmd.createdAt,
                updatedAt: cmd.updatedAt,
                ownerInfo
            };
        }));

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'server_customcommands',
                payload: {
                    serverId,
                    commands: commandsWithOwners
                }
            });
        }

        return commands;
    } catch (error) {
        console.error(`${colors.red}❌ Error getting server custom commands:${colors.reset}`, error);

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'customcommand_error',
                payload: {
                    serverId,
                    error: error.message,
                    action: 'get_server_customcommands'
                }
            });
        }

        throw error;
    }
}


async function createOrUpdateCustomCommand(serverId, userId, commandName, response, socket) {
    try {
        console.log(`[DEBUG] Creating/updating custom command for Server: ${serverId}, User: ${userId}, Command: ${commandName}`);

        
        if (!commandName || !response) {
            throw new Error('Command name and response are required');
        }

        
        const sanitizedName = commandName.toLowerCase().trim();

        
        const restrictedNames = ['nuke', 'raid', 'hack', 'shutdown', 'ban', 'delete', 'hentai', 'love'];
        if (restrictedNames.includes(sanitizedName)) {
            throw new Error(`The command name "${sanitizedName}" is restricted`);
        }

        
        if (!/^[a-z0-9_-]+$/.test(sanitizedName) || sanitizedName.length > 20) {
            throw new Error('Command name can only contain lowercase letters, numbers, hyphens, and underscores (max 20 chars)');
        }

        
        if (response.length > 200) {
            throw new Error('Response must be 200 characters or less');
        }

        
        const forbiddenPatterns = [
            /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
            /drop\s+table\s+/gi,
            /select\s+\*\s+from\s+/gi,
            /[`$|{}<>;]/g
        ];

        if (forbiddenPatterns.some(pattern => pattern.test(response))) {
            throw new Error('Response contains forbidden content');
        }

        
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const isUrl = urlRegex.test(response);
        const isText = /^[a-zA-Z0-9\s.,!?'"-]+$/.test(response);

        if (!isUrl && !isText) {
            throw new Error('Only plain text and URLs are allowed in responses');
        }

        const updatedCommand = await CustomCommand.findOneAndUpdate(
            { serverId, commandName: sanitizedName },
            {
                $set: {
                    userId,
                    response: response.trim(),
                    updatedAt: new Date()
                }
            },
            { upsert: true, returnDocument: 'after' }
        );

        if (socket) {
            await emitCustomCommandUpdate(updatedCommand, socket);

            socket.emit('bot_data_update', {
                type: 'customcommand_refresh_needed',
                payload: {
                    serverId,
                    action: 'create_update'
                }
            });
        }

        console.log(`${colors.green}✅ Created/updated custom command "${sanitizedName}" for server ${serverId}${colors.reset}`);

        return updatedCommand;
    } catch (error) {
        console.error(`${colors.red}❌ Error creating/updating custom command:${colors.reset}`, error);

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'customcommand_error',
                payload: {
                    serverId,
                    error: error.message,
                    action: 'create_update_customcommand'
                }
            });
        }

        throw error;
    }
}


async function deleteCustomCommand(serverId, commandName, isAdmin, socket) {
    try {
        console.log(`[DEBUG] Deleting custom command for Server: ${serverId}, Command: ${commandName}, Admin: ${isAdmin}`);

        const sanitizedName = commandName.toLowerCase().trim();

        
        const deletedCommand = await CustomCommand.findOneAndDelete({ serverId, commandName: sanitizedName });

        if (!deletedCommand) {
            throw new Error('Command not found or you do not have permission to delete it');
        }

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'customcommand_deleted',
                payload: {
                    serverId,
                    userId: deletedCommand.userId,
                    commandName: deletedCommand.commandName,
                    _id: deletedCommand._id
                }
            });

            socket.emit('bot_data_update', {
                type: 'customcommand_refresh_needed',
                payload: {
                    serverId,
                    action: 'delete'
                }
            });
        }

        console.log(`${colors.red}🗑️ Deleted custom command "${sanitizedName}" from server ${serverId}${colors.reset}`);

        return deletedCommand;
    } catch (error) {
        console.error(`${colors.red}❌ Error deleting custom command:${colors.reset}`, error);

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'customcommand_error',
                payload: {
                    serverId,
                    error: error.message,
                    action: 'delete_customcommand'
                }
            });
        }

        throw error;
    }
}


async function getCustomCommandStats(serverId, socket) {
    try {
        const serverCommands = await CustomCommand.countDocuments({ serverId });
        const uniqueOwners = await CustomCommand.distinct('userId', { serverId });

        const stats = {
            serverCommandCount: serverCommands,
            uniqueOwnerCount: uniqueOwners.length
        };

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'customcommand_stats',
                payload: {
                    serverId,
                    stats
                }
            });
        }

        return stats;
    } catch (error) {
        console.error(`${colors.red}❌ Error getting custom command stats:${colors.reset}`, error);

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'customcommand_error',
                payload: {
                    serverId,
                    error: error.message,
                    action: 'get_customcommand_stats'
                }
            });
        }

        throw error;
    }
}


async function sendAllCustomCommands(socket) {
    try {
        const commands = await CustomCommand.find({}).lean();

        
        const byServer = {};
        for (const cmd of commands) {
            if (!byServer[cmd.serverId]) byServer[cmd.serverId] = [];
            byServer[cmd.serverId].push(cmd);
        }

        
        for (const [serverId, serverCmds] of Object.entries(byServer)) {
            const guild = client.guilds.cache.get(serverId);

            const commandsWithOwners = await Promise.all(serverCmds.map(async cmd => {
                const ownerInfo = await resolveUserInfo(guild, cmd.userId);
                return {
                    serverId: cmd.serverId,
                    userId: cmd.userId,
                    commandName: cmd.commandName,
                    response: cmd.response,
                    _id: cmd._id,
                    createdAt: cmd.createdAt,
                    updatedAt: cmd.updatedAt,
                    ownerInfo
                };
            }));

            socket.emit('bot_data_update', {
                type: 'server_customcommands',
                payload: {
                    serverId,
                    commands: commandsWithOwners
                }
            });
        }

        console.log(`${colors.green}📊 Sent custom commands for ${Object.keys(byServer).length} servers to middleware${colors.reset}`);
    } catch (error) {
        console.error(`${colors.red}❌ Error sending all custom commands:${colors.reset}`, error);
    }
}

module.exports = {
    getServerCustomCommands,
    createOrUpdateCustomCommand,
    deleteCustomCommand,
    getCustomCommandStats,
    sendAllCustomCommands
};
