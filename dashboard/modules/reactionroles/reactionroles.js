const colors = require('../../../UI/colors/colors');
const ReactionRole = require('../../../models/reactionroles/schema');
const { invalidateReactionRole } = require('../../../utils/cacheHelpers');
const { getEmoji } = require('../../../UI/emojis/emoji');
const { ContainerBuilder, TextDisplayBuilder, MessageFlags } = require('discord.js');
const client = require('../../../main'); 
async function sendAllReactionRoleData(socket, guildId = null) {
    try {
        console.log(`${colors.blue}📊 Sending reaction role data to middleware${colors.reset}`);
        
        let query = {};
        if (guildId) {
            query.guildId = guildId;
        }
        
        const allReactionRoles = await ReactionRole.find(query).sort({ createdAt: -1 }).limit(100);
        
        
        const guildGroups = {};
        allReactionRoles.forEach(reactionRole => {
            if (!guildGroups[reactionRole.guildId]) {
                guildGroups[reactionRole.guildId] = [];
            }
            guildGroups[reactionRole.guildId].push(reactionRole);
        });

        for (const [guildId, reactionRoles] of Object.entries(guildGroups)) {
            emitReactionRoleUpdate(guildId, { 
                reactionRoles, 
                stats: await getReactionRoleStats(guildId) 
            }, socket, 'server_reaction_role_data');
        }
        
        console.log(`${colors.green}✅ Sent reaction role data for ${Object.keys(guildGroups).length} servers to middleware${colors.reset}`);
        
    } catch (error) {
        console.error(`${colors.red}❌ Error sending reaction role data:${colors.reset}`, error);
    }
}


function emitReactionRoleUpdate(serverId, data, socket, eventType = 'reaction_role_update') {
    if (socket && socket.emit) {
        socket.emit('bot_data_update', {
            type: eventType,
            payload: {
                serverId: serverId,
                data: data,
                timestamp: Date.now()
            }
        });
    }
}


async function createReactionRoleSetup(serverId, options, socket) {
    try {
        console.log(`${colors.blue}🎭 Creating final reaction role setup for server ${serverId}${colors.reset}`);
        

        if (!client) {
            throw new Error('Discord client not available');
        }

        
        const channel = await client.channels.fetch(options.channelId);
        if (!channel) {
            throw new Error('Channel not found');
        }

        
        const setupId = `rr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        
        const reactionRoleData = new ReactionRole({
            setupId,
            guildId: serverId,
            channelId: options.channelId,
            messageId: '', 
            title: options.title,
            description: options.description,
            color: options.color || '#6366f1',
            type: options.type, 
            roles: options.roles || [], 
            menuConfig: options.menuConfig || {
                placeholder: 'Select your roles...',
                minValues: 1,
                maxValues: 1
            },
            settings: {
                requireRole: options.settings?.requireRole || null,
                maxRolesPerUser: options.settings?.maxRolesPerUser || null,
                removeOtherRoles: options.settings?.removeOtherRoles || false,
                allowMultipleRoles: options.settings?.allowMultipleRoles ?? true
            },
            createdBy: options.createdBy,
            updatedBy: options.createdBy
        });

        
        let accentColor = 0x6366f1;
        if (options.color) {
            const hex = options.color.replace('#', '');
            const parsed = parseInt(hex, 16);
            if (!isNaN(parsed)) accentColor = parsed;
        }

        const finalContainer = new ContainerBuilder()
            .setAccentColor(accentColor)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `# ${getEmoji('sparkles')} ${options.title}\n` +
                    (options.description ? `> ${options.description}\n\n` : '') +
                    `*${getEmoji('sparkles')} React with the ${options.type} below to get your roles!*`
                )
            );

        
        const components = buildFinalComponents(reactionRoleData);
        for (const row of components) {
            finalContainer.addActionRowComponents(row);
        }

        
        const message = await channel.send({
            components: [finalContainer],
            flags: MessageFlags.IsComponentsV2
        });

        
        reactionRoleData.messageId = message.id;
        await reactionRoleData.save();
        invalidateReactionRole(serverId, message.id, setupId);

        console.log(`${colors.green}✅ Final reaction role setup created for server ${serverId}${colors.reset}`);
        
        
        emitReactionRoleUpdate(serverId, { 
            type: 'reaction_role_created', 
            reactionRole: reactionRoleData,
            stats: await getReactionRoleStats(serverId)
        }, socket, 'reaction_role_update');
        
        return reactionRoleData;
        
    } catch (error) {
        console.error(`${colors.red}❌ Error creating reaction role setup for server ${serverId}:${colors.reset}`, error);
        
        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'reaction_role_error',
                payload: {
                    serverId: serverId,
                    error: error.message,
                    action: 'create_reaction_role_setup',
                    timestamp: Date.now()
                }
            });
        }
        
        throw error;
    }
}


function buildFinalComponents(setup) {
    const { ActionRowBuilder, ButtonBuilder, StringSelectMenuBuilder, ButtonStyle } = require('discord.js');
    
    if (setup.type === 'buttons') {
        const rows = [];
        let currentRow = new ActionRowBuilder();
        let buttonsInRow = 0;

        for (const roleConfig of setup.roles) {
            if (buttonsInRow >= 5) {
                rows.push(currentRow);
                currentRow = new ActionRowBuilder();
                buttonsInRow = 0;
            }

            const button = new ButtonBuilder()
                .setCustomId(`rr_role_${roleConfig.roleId}`)
                .setLabel(roleConfig.label)
                .setStyle(ButtonStyle[roleConfig.style] || ButtonStyle.Secondary);

            if (roleConfig.emoji) {
                if (roleConfig.emoji.unicode) {
                    button.setEmoji(roleConfig.emoji.name);
                } else {
                    button.setEmoji(roleConfig.emoji.id);
                }
            }

            currentRow.addComponents(button);
            buttonsInRow++;
        }

        if (buttonsInRow > 0) {
            rows.push(currentRow);
        }

        return rows;
    } else if (setup.type === 'menu') {
        const options = setup.roles.map(roleConfig => {
            const option = {
                label: roleConfig.label,
                value: roleConfig.roleId,
                description: roleConfig.description || `Toggle the ${roleConfig.roleName} role`
            };

            if (roleConfig.emoji) {
                if (roleConfig.emoji.unicode) {
                    option.emoji = roleConfig.emoji.name;
                } else {
                    option.emoji = {
                        id: roleConfig.emoji.id,
                        name: roleConfig.emoji.name
                    };
                }
            }

            return option;
        });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`rr_menu_${setup.setupId}`)
            .setPlaceholder(setup.menuConfig.placeholder || 'Select roles to toggle')
            .setMinValues(setup.menuConfig.minValues || 1)
            .setMaxValues(setup.menuConfig.maxValues || 1)
            .addOptions(options);

        return [new ActionRowBuilder().addComponents(selectMenu)];
    }
    
    return [];
}


async function updateReactionRoleSetup(serverId, setupId, updates, socket) {
    try {
        console.log(`${colors.blue}🔄 Updating reaction role setup ${setupId} in server ${serverId}${colors.reset}`);
        
        const reactionRole = await ReactionRole.findOneAndUpdate(
            { setupId, guildId: serverId },
            { 
                $set: { 
                    ...updates,
                    updatedAt: new Date()
                }
            },
            { returnDocument: 'after', runValidators: true }
        );

        if (!reactionRole) {
            throw new Error('Reaction role setup not found');
        }

        
        try {
            const discordClient = client || socket?.client || global.client;
            if (discordClient) {
                const channel = await discordClient.channels.fetch(reactionRole.channelId).catch(() => null);
                if (channel) {
                    let message = null;
                    try {
                        message = await channel.messages.fetch(reactionRole.messageId);
                    } catch (fetchErr) {
                        
                        console.log(`${colors.yellow}⚠️ Original message not found, sending new message${colors.reset}`);
                        message = null;
                    }

                    let accentColor = 0x6366f1;
                    if (reactionRole.color) {
                        const hex = reactionRole.color.replace('#', '');
                        const parsed = parseInt(hex, 16);
                        if (!isNaN(parsed)) accentColor = parsed;
                    }

                    const finalContainer = new ContainerBuilder()
                        .setAccentColor(accentColor)
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(
                                `# ${getEmoji('sparkles')} ${reactionRole.title}\n` +
                                (reactionRole.description ? `> ${reactionRole.description}\n\n` : '') +
                                `*${getEmoji('sparkles')} React with the ${reactionRole.type} below to get your roles!*`
                            )
                        );

                    const components = buildFinalComponents(reactionRole);
                    for (const row of components) {
                        finalContainer.addActionRowComponents(row);
                    }

                    if (message) {
                        
                        await message.edit({ components: [finalContainer], flags: MessageFlags.IsComponentsV2 });
                    } else {
                        
                        const newMessage = await channel.send({ components: [finalContainer], flags: MessageFlags.IsComponentsV2 });
                        reactionRole.messageId = newMessage.id;
                        await reactionRole.save();
                    }
                    invalidateReactionRole(serverId, reactionRole.messageId, setupId);
                }
            }
        } catch (error) {
            console.log(`${colors.red}Could not update Discord message:${colors.reset}`, error.message);
        }

        console.log(`${colors.green}✅ Reaction role setup updated for server ${serverId}${colors.reset}`);
        
        
        emitReactionRoleUpdate(serverId, { 
            type: 'reaction_role_updated', 
            setupId,
            reactionRole,
            stats: await getReactionRoleStats(serverId)
        }, socket, 'reaction_role_update');
        
        return reactionRole;
        
    } catch (error) {
        console.error(`${colors.red}❌ Error updating reaction role setup ${setupId}:${colors.reset}`, error);
        
        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'reaction_role_error',
                payload: {
                    serverId: serverId,
                    error: error.message,
                    action: 'update_reaction_role_setup',
                    setupId,
                    timestamp: Date.now()
                }
            });
        }
        
        throw error;
    }
}


async function deleteReactionRoleSetup(serverId, setupId, socket) {
    try {
        console.log(`${colors.blue}🗑️ Deleting reaction role setup ${setupId} in server ${serverId}${colors.reset}`);
        
        const reactionRole = await ReactionRole.findOneAndDelete({ setupId, guildId: serverId });

        if (!reactionRole) {
            throw new Error('Reaction role setup not found');
        }
        invalidateReactionRole(serverId, reactionRole.messageId, setupId);

        
        try {
            const discordClient = client || socket?.client || global.client;
            if (discordClient) {
                const channel = await discordClient.channels.fetch(reactionRole.channelId).catch(() => null);
                if (channel) {
                    try {
                        const message = await channel.messages.fetch(reactionRole.messageId);
                        if (message) await message.delete();
                    } catch (fetchErr) {
                        
                        console.log(`${colors.yellow}⚠️ Message already deleted or not found${colors.reset}`);
                    }
                }
            }
        } catch (error) {
            console.log(`${colors.red}Could not delete Discord message:${colors.reset}`, error.message);
        }

        console.log(`${colors.green}✅ Reaction role setup deleted for server ${serverId}${colors.reset}`);
        
        
        emitReactionRoleUpdate(serverId, { 
            type: 'reaction_role_deleted', 
            setupId,
            stats: await getReactionRoleStats(serverId)
        }, socket, 'reaction_role_update');
        
        return { deleted: true };
        
    } catch (error) {
        console.error(`${colors.red}❌ Error deleting reaction role setup ${setupId}:${colors.reset}`, error);
        
        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'reaction_role_error',
                payload: {
                    serverId: serverId,
                    error: error.message,
                    action: 'delete_reaction_role_setup',
                    setupId,
                    timestamp: Date.now()
                }
            });
        }
        
        throw error;
    }
}


async function getAllServerReactionRoles(serverId, options = {}, socket) {
    try {
        console.log(`${colors.blue}📋 Getting reaction role setups for server ${serverId}${colors.reset}`);
        
        const { page = 1, limit = 10 } = options;
        const skip = (page - 1) * limit;

        const query = { guildId: serverId };

        const [reactionRoles, total] = await Promise.all([
            ReactionRole.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            ReactionRole.countDocuments(query)
        ]);

        const pagination = {
            current: page,
            total: Math.ceil(total / limit),
            hasNext: page * limit < total,
            hasPrev: page > 1,
            totalItems: total
        };

        console.log(`${colors.green}✅ Retrieved ${reactionRoles.length} reaction role setups for server ${serverId}${colors.reset}`);
        
        
        emitReactionRoleUpdate(serverId, { 
            type: 'server_reaction_role_list', 
            reactionRoles, 
            pagination,
            stats: await getReactionRoleStats(serverId)
        }, socket, 'reaction_role_server_data');
        
        return { reactionRoles, pagination };
        
    } catch (error) {
        console.error(`${colors.red}❌ Error getting server reaction role setups:${colors.reset}`, error);
        
        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'reaction_role_error',
                payload: {
                    serverId: serverId,
                    error: error.message,
                    action: 'get_all_server_reaction_roles',
                    timestamp: Date.now()
                }
            });
        }
        
        throw error;
    }
}


async function getReactionRoleSetup(serverId, setupId, socket) {
    try {
        console.log(`${colors.blue}📋 Getting reaction role setup ${setupId} for server ${serverId}${colors.reset}`);
        
        const reactionRole = await ReactionRole.findOne({ setupId, guildId: serverId });

        if (!reactionRole) {
            throw new Error('Reaction role setup not found');
        }

        console.log(`${colors.green}✅ Retrieved reaction role setup ${setupId}${colors.reset}`);
        
        
        emitReactionRoleUpdate(serverId, { 
            type: 'single_reaction_role', 
            setupId,
            reactionRole 
        }, socket, 'reaction_role_data');
        
        return reactionRole;
        
    } catch (error) {
        console.error(`${colors.red}❌ Error getting reaction role setup ${setupId}:${colors.reset}`, error);
        
        if (socket && socket.emit) {
            socket.emit('bot_data_update', {
                type: 'reaction_role_error',
                payload: {
                    serverId: serverId,
                    error: error.message,
                    action: 'get_reaction_role_setup',
                    setupId,
                    timestamp: Date.now()
                }
            });
        }
        
        throw error;
    }
}


async function getReactionRoleStats(serverId, socket = null) {
    try {
        const [
            totalSetups,
            activeSetups,
            totalRoles,
            totalInteractions,
            totalRolesGiven,
            totalRolesRemoved,
            buttonSetups,
            menuSetups,
            recentSetups
        ] = await Promise.all([
            ReactionRole.countDocuments({ guildId: serverId }),
            ReactionRole.countDocuments({ guildId: serverId, roles: { $not: { $size: 0 } } }),
            ReactionRole.aggregate([
                { $match: { guildId: serverId } },
                { $group: { _id: null, total: { $sum: { $size: '$roles' } } } }
            ]),
            ReactionRole.aggregate([
                { $match: { guildId: serverId } },
                { $group: { _id: null, total: { $sum: '$stats.totalInteractions' } } }
            ]),
            ReactionRole.aggregate([
                { $match: { guildId: serverId } },
                { $group: { _id: null, total: { $sum: '$stats.rolesGiven' } } }
            ]),
            ReactionRole.aggregate([
                { $match: { guildId: serverId } },
                { $group: { _id: null, total: { $sum: '$stats.rolesRemoved' } } }
            ]),
            ReactionRole.countDocuments({ guildId: serverId, type: 'buttons' }),
            ReactionRole.countDocuments({ guildId: serverId, type: 'menu' }),
            ReactionRole.countDocuments({ 
                guildId: serverId, 
                createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } 
            })
        ]);

        const stats = {
            totalSetups,
            activeSetups,
            totalRoles: totalRoles[0]?.total || 0,
            totalInteractions: totalInteractions?.total || 0,
            totalRolesGiven: totalRolesGiven?.total || 0,
            totalRolesRemoved: totalRolesRemoved?.total || 0,
            buttonSetups,
            menuSetups,
            recentSetups
        };

        if (socket) {
            emitReactionRoleUpdate(serverId, { 
                type: 'server_reaction_role_stats', 
                stats 
            }, socket, 'reaction_role_stats_update');
        }
        
        return stats;
        
    } catch (error) {
        console.error(`${colors.red}❌ Error getting reaction role stats:${colors.reset}`, error);
        return {
            totalSetups: 0,
            activeSetups: 0,
            totalRoles: 0,
            totalInteractions: 0,
            totalRolesGiven: 0,
            totalRolesRemoved: 0,
            buttonSetups: 0,
            menuSetups: 0,
            recentSetups: 0
        };
    }
}

module.exports = {
    sendAllReactionRoleData,
    createReactionRoleSetup,
    updateReactionRoleSetup,
    deleteReactionRoleSetup,
    getAllServerReactionRoles,
    getReactionRoleSetup,
    getReactionRoleStats
};
