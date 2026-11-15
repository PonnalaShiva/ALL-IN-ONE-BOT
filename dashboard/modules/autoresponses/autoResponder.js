const AutoResponder = require('../../../models/autoresponses/schema');
const colors = require('../../../UI/colors/colors');
const client = require('../../../main'); 


function emitAutoResponderUpdate(serverId, autoResponder, socket) {
    socket.emit('bot_data_update', {
        type: 'autoresponder_config',
        payload: {
            guildId: serverId,
            trigger: autoResponder.trigger,
            userId: autoResponder.userId,
            textResponse: autoResponder.textResponse,
            embedData: autoResponder.embedData,
            matchType: autoResponder.matchType,
            channels: autoResponder.channels,
            status: autoResponder.status,
            _id: autoResponder._id,
            createdAt: autoResponder.createdAt,
            updatedAt: autoResponder.updatedAt
        }
    });
}


async function createOrUpdateAutoResponder(userId, guildId, trigger, textResponse, embedData, matchType, channels, status, socket) {
    try {
        console.log(`[DEBUG] Saving AutoResponder: ${trigger} for Guild: ${guildId}`);

        const update = {
            userId,
            guildId,
            trigger: trigger.toLowerCase(),
            textResponse,
            embedData,
            matchType,
            channels,
            status
        };

        const autoResponder = await AutoResponder.findOneAndUpdate(
            { guildId, trigger: trigger.toLowerCase() }, 
            { $set: update }, 
            { upsert: true, returnDocument: 'after' }
        );

        if (socket) {
            emitAutoResponderUpdate(guildId, autoResponder, socket);
        }

        console.log(`${colors.green}✅ Created/Updated AutoResponder: ${trigger} for server ${guildId}${colors.reset}`);
        
        return autoResponder;
    } catch (error) {
        console.error(`${colors.red}❌ Error creating/updating AutoResponder:${colors.reset}`, error);
        
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'autoresponder_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'create_or_update_autoresponder'
                }
            });
        }
        
        throw error;
    }
}

async function deleteAutoResponder(userId, guildId, autoResponderId, socket) {
    try {
        
        
        const query = { _id: autoResponderId, guildId };
        if (userId) {
            query.userId = userId;
        }

        const deletedAutoResponder = await AutoResponder.findOneAndDelete(query);
        
        if (!deletedAutoResponder) {
            throw new Error(`AutoResponder not found or you don't have permission.`);
        }

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'autoresponder_deleted',
                payload: { 
                    guildId, 
                    trigger: deletedAutoResponder.trigger,
                    _id: deletedAutoResponder._id
                }
            });
        }

        console.log(`${colors.red}🗑️ Deleted AutoResponder: ${deletedAutoResponder.trigger}${colors.reset}`);
        
        return deletedAutoResponder;
    } catch (error) {
        console.error(`${colors.red}❌ Error deleting AutoResponder:${colors.reset}`, error);
        
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'autoresponder_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'delete_autoresponder'
                }
            });
        }
        
        throw error;
    }
}

async function activateAutoResponder(guildId, autoResponderId, socket) {
    try {
        const autoResponder = await AutoResponder.findOneAndUpdate(
            { _id: autoResponderId, guildId },
            { status: true },
            { returnDocument: 'after' }
        );

        if (!autoResponder) {
            throw new Error(`AutoResponder not found.`);
        }

        if (socket) {
            emitAutoResponderUpdate(guildId, autoResponder, socket);
        }

        console.log(`${colors.green}✅ Activated AutoResponder: ${autoResponder.trigger}${colors.reset}`);
        
        return autoResponder;
    } catch (error) {
        console.error(`${colors.red}❌ Error activating AutoResponder:${colors.reset}`, error);
        
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'autoresponder_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'activate_autoresponder'
                }
            });
        }
        
        throw error;
    }
}


async function deactivateAutoResponder(guildId, autoResponderId, socket) {
    try {
        const autoResponder = await AutoResponder.findOneAndUpdate(
            { _id: autoResponderId, guildId },
            { status: false },
            { returnDocument: 'after' }
        );

        if (!autoResponder) {
            throw new Error(`AutoResponder not found.`);
        }

        if (socket) {
            emitAutoResponderUpdate(guildId, autoResponder, socket);
        }

        console.log(`${colors.yellow}⚠️ Deactivated AutoResponder: ${autoResponder.trigger}${colors.reset}`);
        
        return autoResponder;
    } catch (error) {
        console.error(`${colors.red}❌ Error deactivating AutoResponder:${colors.reset}`, error);
        
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'autoresponder_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'deactivate_autoresponder'
                }
            });
        }
        
        throw error;
    }
}


async function updateAutoResponder(guildId, autoResponderId, updateData, socket) {
    try {
        const autoResponder = await AutoResponder.findOneAndUpdate(
            { _id: autoResponderId, guildId },
            { $set: updateData },
            { returnDocument: 'after' }
        );

        if (!autoResponder) {
            throw new Error(`AutoResponder not found.`);
        }

        if (socket) {
            emitAutoResponderUpdate(guildId, autoResponder, socket);
        }

        console.log(`${colors.cyan}🔄 Updated AutoResponder: ${autoResponder.trigger}${colors.reset}`);
        
        return autoResponder;
    } catch (error) {
        console.error(`${colors.red}❌ Error updating AutoResponder:${colors.reset}`, error);
        
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'autoresponder_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'update_autoresponder'
                }
            });
        }
        
        throw error;
    }
}


async function getUserAutoResponders(userId, guildId, socket) {
    try {
        const autoResponders = await AutoResponder.find({ userId, guildId });
        
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'user_autoresponders',
                payload: {
                    guildId,
                    userId,
                    autoResponders: autoResponders.map(ar => ({
                        trigger: ar.trigger,
                        textResponse: ar.textResponse,
                        embedData: ar.embedData,
                        matchType: ar.matchType,
                        channels: ar.channels,
                        status: ar.status,
                        _id: ar._id,
                        createdAt: ar.createdAt,
                        updatedAt: ar.updatedAt
                    }))
                }
            });
        }
        
        return autoResponders;
    } catch (error) {
        console.error(`${colors.red}❌ Error getting user AutoResponders:${colors.reset}`, error);
        
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'autoresponder_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'get_user_autoresponders'
                }
            });
        }
        
        throw error;
    }
}


async function getAutoRespondersByServer(guildId, socket) {
    try {
        const autoResponders = await AutoResponder.find({ guildId });
        
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'server_autoresponders',
                payload: {
                    guildId,
                    autoResponders: autoResponders.map(ar => ({
                        trigger: ar.trigger,
                        userId: ar.userId,
                        textResponse: ar.textResponse,
                        embedData: ar.embedData,
                        matchType: ar.matchType,
                        channels: ar.channels,
                        status: ar.status,
                        _id: ar._id,
                        createdAt: ar.createdAt,
                        updatedAt: ar.updatedAt
                    }))
                }
            });
        }
        
        return autoResponders;
    } catch (error) {
        console.error(`${colors.red}❌ Error getting AutoResponders for server:${colors.reset}`, error);
        
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'autoresponder_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'get_autoresponders_by_server'
                }
            });
        }
        
        throw error;
    }
}


async function disableAutoResponderSystem(guildId, socket) {
    try {
        const result = await AutoResponder.updateMany(
            { guildId },
            { status: false }
        );

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'autoresponder_system_disabled',
                payload: {
                    guildId,
                    disabledCount: result.modifiedCount
                }
            });
        }

        console.log(`${colors.yellow}⚠️ AutoResponder system disabled for server ${guildId}. ${result.modifiedCount} autoresponders deactivated.${colors.reset}`);
        
        return result;
    } catch (error) {
        console.error(`${colors.red}❌ Error disabling AutoResponder system:${colors.reset}`, error);
        
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'autoresponder_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'disable_autoresponder_system'
                }
            });
        }
        
        throw error;
    }
}


async function sendAllAutoResponderConfigs(socket) {
    try {
        const autoResponders = await AutoResponder.find({});
        
        for (const ar of autoResponders) {
            socket.emit('bot_data_update', {
                type: 'autoresponder_config',
                payload: {
                    guildId: ar.guildId,
                    trigger: ar.trigger,
                    userId: ar.userId,
                    textResponse: ar.textResponse,
                    embedData: ar.embedData,
                    matchType: ar.matchType,
                    channels: ar.channels,
                    status: ar.status,
                    _id: ar._id,
                    createdAt: ar.createdAt,
                    updatedAt: ar.updatedAt
                }
            });
        }
        
        console.log(`${colors.green}📊 Sent ${autoResponders.length} AutoResponder configs to middleware${colors.reset}`);
    } catch (error) {
        console.error(`${colors.red}❌ Error sending all AutoResponder configs:${colors.reset}`, error);
    }
}


async function deleteUserAutoResponders(userId, guildId, socket) {
    try {
        const result = await AutoResponder.deleteMany({ userId, guildId });
        
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'user_autoresponders_deleted',
                payload: {
                    guildId,
                    userId,
                    deletedCount: result.deletedCount
                }
            });
        }

        console.log(`${colors.red}🗑️ Deleted ${result.deletedCount} AutoResponders for user ${userId} in server ${guildId}${colors.reset}`);
        
        return result;
    } catch (error) {
        console.error(`${colors.red}❌ Error deleting user AutoResponders:${colors.reset}`, error);
        
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'autoresponder_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'delete_user_autoresponders'
                }
            });
        }
        
        throw error;
    }
}


async function getActiveAutoResponders(guildId) {
    try {
        return await AutoResponder.find({ guildId, status: true });
    } catch (error) {
        console.error(`${colors.red}❌ Error getting active AutoResponders:${colors.reset}`, error);
        throw error;
    }
}

module.exports = {
    createOrUpdateAutoResponder,
    deleteAutoResponder,
    activateAutoResponder,
    deactivateAutoResponder,
    updateAutoResponder,
    getUserAutoResponders,
    getAutoRespondersByServer,
    disableAutoResponderSystem,
    sendAllAutoResponderConfigs,
    deleteUserAutoResponders,
    getActiveAutoResponders
};
