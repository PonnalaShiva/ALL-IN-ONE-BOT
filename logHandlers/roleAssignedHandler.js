const { getEmoji } = require('../UI/emojis/emoji');
const loadLanguage = require('../events/loadLanguage');
const { MessageFlags, PermissionFlagsBits } = require('discord.js');
const { getLogConfig, getRoleNickConfig } = require('../utils/cacheHelpers');
const QuarantineConfig = require('../models/qurantine/quarantineConfig');
const UserQuarantine = require('../models/qurantine/userQuarantine');
const logHandlersIcons = require('../UI/icons/loghandlers');
const { buildCard, ACCENT } = require('../UI');

module.exports = async function guildMemberUpdateHandler(client) {
    client.on('guildMemberUpdate', async (oldMember, newMember) => {
        if (!newMember.guild) return;
        const guildId = newMember.guild.id;

        try {
            const addedRoles = typeof newMember.roles.cache.filter === 'function'
                ? newMember.roles.cache.filter(role => !oldMember.roles.cache.has(role.id))
                : new Map(Array.from(newMember.roles.cache.entries()).filter(([id]) => !oldMember.roles.cache.has(id)));

            
            if (addedRoles.size > 0) {
                const config = await getLogConfig(guildId, 'roleAssigned');
                if (config?.channelId) {
                    const logChannel = client.channels.cache.get(config.channelId)
                        || await client.channels.fetch(config.channelId).catch(() => null);
                    if (logChannel) {
                        const lang = loadLanguage(guildId);
                        const s = lang?.serverlogs || {};
                        const userAvatar = newMember.user?.displayAvatarURL?.({ dynamic: true, size: 256 }) || logHandlersIcons.assignedIcon;

                        for (const [, role] of addedRoles) {
                            const card = buildCard({
                                title: `${getEmoji('sparkles')} ${s.roleAssignedTitle || 'Role Assigned'}`,
                                accentColor: role.color || ACCENT.info,
                                thumbnailURL: userAvatar,
                                sections: [
                                    `> **${s.roleAssignedDesc || 'Role assignment event detected'}**\n\n• **${s.memberLabel || 'Member'}:** <@${newMember.id}> (\`${newMember.user.tag || newMember.user.username}\`)\n• **${s.userIdLabel || 'User ID'}:** \`${newMember.id}\`\n• **${s.assignedRoleLabel || 'Assigned Role'}:** <@&${role.id}> (\`${role.name}\`)`,
                                    `### ${getEmoji('settings')} ${s.roleSpecsHeader || 'Role Specifications'}\n• **${s.roleIdLabel || 'Role ID'}:** \`${role.id}\`\n• **${s.roleColorLabel || 'Role Color'}:** \`${role.hexColor || '#000000'}\`\n• **${s.positionLabel || 'Position'}:** \`${role.position} of ${newMember.guild.roles.cache.size}\`\n• **${s.mentionableLabel || 'Mentionable'}:** ${role.mentionable ? `${getEmoji('tick')} ${s.yes || 'Yes'}` : `${getEmoji('cross')} ${s.no || 'No'}`}\n• **${s.hoistedLabel || 'Hoisted'}:** ${role.hoist ? `${getEmoji('tick')} ${s.hoistedSeparately || 'Yes (Displayed Separately)'}` : `${getEmoji('cross')} ${s.no || 'No'}`}\n\n• **${s.assignedLabel || 'Assigned At'}:** <t:${Math.floor(Date.now() / 1000)}:F> (<t:${Math.floor(Date.now() / 1000)}:R>)`
                                ],
                                footer: (s.footers?.roleLogs || 'Role Audit • {time}').replace('{time}', `<t:${Math.floor(Date.now() / 1000)}:R>`)
                            });

                            try {
                                await logChannel.send({
                                    components: [card],
                                    flags: MessageFlags.IsComponentsV2
                                });
                            } catch (e) {
                                console.error('[RoleAssignedHandler] Error sending log:', e);
                            }
                        }
                    }
                }
            }

            
            const quarantineConfig = await QuarantineConfig.findOne({ guildId });
            if (quarantineConfig?.quarantineEnabled) {
                const quarantineRole = newMember.guild.roles.cache.get(quarantineConfig.quarantineRoleId);
                if (quarantineRole) {
                    const userQuarantine = await UserQuarantine.findOne({ userId: newMember.id, guildId });
                    if (
                        userQuarantine?.isQuarantined &&
                        oldMember.roles.cache.has(quarantineRole.id) &&
                        !newMember.roles.cache.has(quarantineRole.id)
                    ) {
                        const botMember = newMember.guild.members.me;
                        if (!botMember?.permissions?.has(PermissionFlagsBits.ManageRoles) ||
                            quarantineRole.position >= botMember.roles.highest.position ||
                            newMember.roles.highest.position >= botMember.roles.highest.position) {
                            console.warn(`[RoleAssignedHandler] Cannot safely reapply quarantine role in guild ${guildId} for member ${newMember.id}`);
                        } else {
                            let roleRestored = false;
                            try {
                                await newMember.roles.add(quarantineRole);
                                roleRestored = true;
                            } catch (err) {
                                console.warn(`Failed to reapply quarantine role: ${err.message}`);
                            }

                            if (roleRestored) {
                                try {
                                    const lang = loadLanguage(newMember.guild?.id);
                                    const s = lang?.serverlogs || {};
                                    await newMember.send(`${getEmoji('warning')} ${s.quarantineRoleWarning || 'Quarantine Role cannot be removed manually.'}`);
                                } catch {
                                    
                                }
                            }
                        }
                    }
                }
            }

            
            const nickConfig = await getRoleNickConfig(guildId);
            if (nickConfig?.roles?.length > 0 && addedRoles.size > 0) {
                const botMember = newMember.guild.members.me;
                const canSetNickname = botMember?.permissions?.has(PermissionFlagsBits.ManageNicknames) &&
                    newMember.id !== newMember.guild.ownerId &&
                    newMember.roles.highest.position < botMember.roles.highest.position;
                for (const roleEntry of canSetNickname ? nickConfig.roles : []) {
                    if (addedRoles.has(roleEntry.roleId)) {
                        const role = newMember.guild.roles.cache.get(roleEntry.roleId);
                        if (!role) continue;

                        const baseName = newMember.displayName;

                        let formattedNickname = roleEntry.nicknameFormat
                            .replace('{ROLE}', role.name)
                            .replace('{USERNAME}', baseName)
                            .trim();

                        if (!formattedNickname.includes(baseName)) {
                            formattedNickname += ` ${baseName}`;
                        }

                        if (formattedNickname.length > 32) {
                            formattedNickname = formattedNickname.slice(0, 32);
                        }

                        try {
                            await newMember.setNickname(formattedNickname);
                        } catch (err) {
                            
                        }

                        break;
                    }
                }
            }

            
            if (nickConfig?.roles?.length > 0) {
                const removedRoles = oldMember.roles.cache.filter(role => !newMember.roles.cache.has(role.id));
                const botMember = newMember.guild.members.me;
                const canSetNickname = botMember?.permissions?.has(PermissionFlagsBits.ManageNicknames) &&
                    newMember.id !== newMember.guild.ownerId &&
                    newMember.roles.highest.position < botMember.roles.highest.position;
                
                if (canSetNickname && removedRoles.size > 0) {
                    
                    const removedRoleWithNick = nickConfig.roles.find(roleEntry => removedRoles.has(roleEntry.roleId));
                    
                    if (removedRoleWithNick) {
                        
                        const remainingRoleWithNick = nickConfig.roles.find(roleEntry => 
                            roleEntry.roleId !== removedRoleWithNick.roleId && 
                            newMember.roles.cache.has(roleEntry.roleId)
                        );
                        
                        if (remainingRoleWithNick) {
                            
                            const role = newMember.guild.roles.cache.get(remainingRoleWithNick.roleId);
                            if (role) {
                                try {
                                    const baseName = newMember.user.username;
                                    let formattedNickname = remainingRoleWithNick.nicknameFormat
                                        .replace('{role}', role.name)
                                        .replace('{ROLE}', role.name)
                                        .replace('{USERNAME}', baseName)
                                        .replace('{username}', baseName);
                                    
                                    if (formattedNickname.length > 32) {
                                        formattedNickname = formattedNickname.substring(0, 32);
                                    }
                                    
                                    await newMember.setNickname(formattedNickname, `Switched to role nickname: ${role.name}`);
                                    console.log(`[RoleNick] Applied remaining role nickname "${formattedNickname}" for ${newMember.user.tag} after role removal`);
                                } catch (err) {
                                    console.warn(`[RoleNick] Failed to apply remaining role nickname for ${newMember.user.tag}: ${err.message}`);
                                }
                            }
                        } else {
                            
                            const currentNickname = newMember.nickname;
                            if (currentNickname) {
                                try {
                                    await newMember.setNickname(null, `Role removed: ${removedRoleWithNick.roleId}`);
                                    console.log(`[RoleNick] Reset nickname for ${newMember.user.tag} after role removal (no other role nicks)`);
                                } catch (err) {
                                    console.warn(`[RoleNick] Failed to reset nickname for ${newMember.user.tag}: ${err.message}`);
                                }
                            }
                        }
                    }
                }
            }

        } catch (err) {
            console.error('[RoleAssignedHandler] Error in handler:', err);
        }
    });
};
