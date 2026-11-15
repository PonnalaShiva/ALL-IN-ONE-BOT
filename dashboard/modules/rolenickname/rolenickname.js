const RoleNickConfig = require('../../../models/rolenick/RoleNickConfig');
const colors = require('../../../UI/colors/colors');
const client = require('../../../main');


function emitRoleNickUpdate(serverId, roleNickData, socket) {
    socket.emit('bot_data_update', {
        type: 'rolenick_config',
        payload: {
            guildId: serverId,
            roles: roleNickData.roles,
            _id: roleNickData._id
        }
    });
}


async function getRoleNickConfig(guildId, socket) {
    try {
        const config = await RoleNickConfig.findOne({ guildId });
        
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'server_rolenick',
                payload: {
                    guildId,
                    config: config ? {
                        roles: config.roles,
                        _id: config._id,
                        guildId: config.guildId
                    } : null
                }
            });
        }
        
        return config;
    } catch (error) {
        console.error(`${colors.red}❌ Error getting role nick config:${colors.reset}`, error);
        
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'rolenick_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'get_rolenick_config'
                }
            });
        }
        
        throw error;
    }
}


async function addRoleNickConfig(guildId, roleId, nicknameFormat, socket) {
    try {
        console.log(`[DEBUG] Adding role nick config for Guild: ${guildId}, Role: ${roleId}`);

        let config = await RoleNickConfig.findOne({ guildId });
        
        if (config) {
            
            const existing = config.roles.find(r => r.roleId === roleId);
            if (existing) {
                existing.nicknameFormat = nicknameFormat;
            } else {
                config.roles.push({ roleId, nicknameFormat });
            }
            await config.save();
        } else {
            
            config = await RoleNickConfig.create({
                guildId,
                roles: [{ roleId, nicknameFormat }]
            });
        }

        if (socket) {
            emitRoleNickUpdate(guildId, config, socket);
        }

        console.log(`${colors.green}✅ Added/Updated role nick config for role ${roleId} in server ${guildId}${colors.reset}`);
        
        return config;
    } catch (error) {
        console.error(`${colors.red}❌ Error adding role nick config:${colors.reset}`, error);
        
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'rolenick_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'add_rolenick_config'
                }
            });
        }
        
        throw error;
    }
}


async function removeRoleNickConfig(guildId, roleId, socket) {
    try {
        const config = await RoleNickConfig.findOne({ guildId });
        
        if (!config) {
            throw new Error(`No role nickname configuration found for this server`);
        }

        config.roles = config.roles.filter(r => r.roleId !== roleId);
        await config.save();

        if (socket) {
            emitRoleNickUpdate(guildId, config, socket);
        }

        console.log(`${colors.yellow}🗑️ Removed role nick config for role ${roleId} in server ${guildId}${colors.reset}`);
        
        return config;
    } catch (error) {
        console.error(`${colors.red}❌ Error removing role nick config:${colors.reset}`, error);
        
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'rolenick_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'remove_rolenick_config'
                }
            });
        }
        
        throw error;
    }
}


async function clearRoleNickConfig(guildId, socket) {
    try {
        const config = await RoleNickConfig.findOne({ guildId });
        
        if (!config) {
            throw new Error(`No role nickname configuration found for this server`);
        }

        config.roles = [];
        await config.save();

        if (socket) {
            emitRoleNickUpdate(guildId, config, socket);
        }

        console.log(`${colors.yellow}🧹 Cleared all role nick configs for server ${guildId}${colors.reset}`);
        
        return config;
    } catch (error) {
        console.error(`${colors.red}❌ Error clearing role nick config:${colors.reset}`, error);
        
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'rolenick_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'clear_rolenick_config'
                }
            });
        }
        
        throw error;
    }
}


async function deleteRoleNickConfig(guildId, socket) {
    try {
        const deletedConfig = await RoleNickConfig.findOneAndDelete({ guildId });
        
        if (!deletedConfig) {
            throw new Error(`No role nickname configuration found for this server`);
        }

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'rolenick_deleted',
                payload: {
                    guildId,
                    _id: deletedConfig._id
                }
            });
        }

        console.log(`${colors.red}🗑️ Deleted role nick configuration for server ${guildId}${colors.reset}`);
        
        return deletedConfig;
    } catch (error) {
        console.error(`${colors.red}❌ Error deleting role nick config:${colors.reset}`, error);
        
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'rolenick_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'delete_rolenick_config'
                }
            });
        }
        
        throw error;
    }
}


async function updateRoleNickFormat(guildId, roleId, newFormat, socket) {
    try {
        const config = await RoleNickConfig.findOne({ guildId });
        
        if (!config) {
            throw new Error(`No role nickname configuration found for this server`);
        }

        const roleConfig = config.roles.find(r => r.roleId === roleId);
        if (!roleConfig) {
            throw new Error(`Role configuration not found`);
        }

        roleConfig.nicknameFormat = newFormat;
        await config.save();

        if (socket) {
            emitRoleNickUpdate(guildId, config, socket);
        }

        console.log(`${colors.cyan}🔄 Updated role nick format for role ${roleId} in server ${guildId}${colors.reset}`);
        
        return config;
    } catch (error) {
        console.error(`${colors.red}❌ Error updating role nick format:${colors.reset}`, error);
        
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'rolenick_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'update_rolenick_format'
                }
            });
        }
        
        throw error;
    }
}


async function getRoleNickStats(guildId, socket) {
    try {
        const config = await RoleNickConfig.findOne({ guildId });
        const guild = client.guilds.cache.get(guildId);
        
        const stats = {
            hasConfig: !!config,
            totalRoles: config?.roles?.length || 0,
            guildMemberCount: guild?.memberCount || 0,
            guildRoleCount: guild?.roles?.cache?.size || 0
        };

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'rolenick_stats',
                payload: {
                    guildId,
                    stats
                }
            });
        }

        return stats;
    } catch (error) {
        console.error(`${colors.red}❌ Error getting role nick stats:${colors.reset}`, error);
        
        if (socket) {
            socket.emit('bot_data_update', {
                type: 'rolenick_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'get_rolenick_stats'
                }
            });
        }
        
        throw error;
    }
}


async function sendAllRoleNickConfigs(socket) {
    try {
        const configs = await RoleNickConfig.find({});
        
        for (const config of configs) {
            socket.emit('bot_data_update', {
                type: 'rolenick_config',
                payload: {
                    guildId: config.guildId,
                    roles: config.roles,
                    _id: config._id
                }
            });
        }
        
        console.log(`${colors.green}📊 Sent ${configs.length} role nickname configs to middleware${colors.reset}`);
    } catch (error) {
        console.error(`${colors.red}❌ Error sending all role nick configs:${colors.reset}`, error);
    }
}


async function applyNicknameToMember(guildId, memberId, socket) {
    try {
        const config = await RoleNickConfig.findOne({ guildId });
        if (!config || config.roles.length === 0) return;

        const guild = client.guilds.cache.get(guildId);
        if (!guild) return;

        const member = guild.members.cache.get(memberId);
        if (!member) return;

        
        for (const roleEntry of config.roles) {
            if (member.roles.cache.has(roleEntry.roleId)) {
                const role = guild.roles.cache.get(roleEntry.roleId);
                if (!role) continue;

                const baseName = member.user.username;
                let formattedNickname = roleEntry.nicknameFormat
                    .replace('{ROLE}', role.name)
                    .replace('{USERNAME}', baseName)
                    .trim();

                if (formattedNickname.length > 32) {
                    formattedNickname = formattedNickname.slice(0, 32);
                }

                await member.setNickname(formattedNickname).catch(() => {});
                
                if (socket) {
                    socket.emit('bot_data_update', {
                        type: 'nickname_applied',
                        payload: {
                            guildId,
                            memberId,
                            nickname: formattedNickname,
                            roleId: roleEntry.roleId
                        }
                    });
                }

                console.log(`${colors.green}✅ Applied nickname "${formattedNickname}" to member ${memberId}${colors.reset}`);
                break;
            }
        }
    } catch (error) {
        console.error(`${colors.red}❌ Error applying nickname to member:${colors.reset}`, error);
    }
}

module.exports = {
    getRoleNickConfig,
    addRoleNickConfig,
    removeRoleNickConfig,
    clearRoleNickConfig,
    deleteRoleNickConfig,
    updateRoleNickFormat,
    getRoleNickStats,
    sendAllRoleNickConfigs,
    applyNicknameToMember
};
