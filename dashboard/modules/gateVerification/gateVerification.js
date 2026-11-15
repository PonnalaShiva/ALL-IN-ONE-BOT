const VerificationConfig = require('../../../models/gateVerification/verificationConfig');
const { invalidateVerificationConfig } = require('../../../utils/cacheHelpers');
const { captureRolePermissionBackups, restoreRolePermissionBackups } = require('../../../utils/verificationPermissionBackups');
const colors = require('../../../UI/colors/colors');
let client = null;

function setClient(discordClient) {
    client = discordClient || null;
}
const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    MessageFlags
} = require('discord.js');
const { getEmoji, getButtonEmoji } = require('../../../UI/emojis/emoji');
const { verificationBanner } = require('../../../UI/banners/SetupBanners');

function buildVerificationCard(guild) {
    const container = new ContainerBuilder()
        .setAccentColor(0x0099FF);

    container.addTextDisplayComponents(
        new TextDisplayBuilder()
            .setContent(`## ${getEmoji('lock')} **Verification System**`)
    );

    container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );

    container.addTextDisplayComponents(
        new TextDisplayBuilder()
            .setContent(
                `### ${getEmoji('security')} **Member Security Gate**\n` +
                `\u2022 Click the **Verify** button below to complete verification.\n` +
                `\u2022 Enter the security code presented in the popup modal.\n` +
                `\u2022 Once verified, you will gain full access to **${guild?.name || 'the server'}**!`
            )
    );

    if (verificationBanner) {
        container.addSeparatorComponents(
            new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
        );
        const mediaItem = new MediaGalleryItemBuilder()
            .setURL(verificationBanner)
            .setDescription('Verification Banner');
        const gallery = new MediaGalleryBuilder().addItems(mediaItem);
        container.addMediaGalleryComponents(gallery);
    }

    container.addSeparatorComponents(
        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );

    const button = new ButtonBuilder()
        .setCustomId('verify_button')
        .setLabel('Verify')
        .setStyle(ButtonStyle.Primary);

    const btnEmoji = getButtonEmoji('tick') || getButtonEmoji('security') || getButtonEmoji('lock');
    if (btnEmoji) {
        button.setEmoji(btnEmoji);
    }

    const row = new ActionRowBuilder().addComponents(button);
    container.addActionRowComponents(row);

    return container;
}


function emitVerificationUpdate(serverId, verificationConfig, socket) {
    const guild = client.guilds.cache.get(serverId);

    
    const channel = guild?.channels.cache.get(verificationConfig.verificationChannelId);
    const unverifiedRole = guild?.roles.cache.get(verificationConfig.unverifiedRoleId);
    const verifiedRole = guild?.roles.cache.get(verificationConfig.verifiedRoleId);

    socket.emit('bot_data_update', {
        type: 'verification_config',
        payload: {
            guildId: serverId,
            verificationEnabled: verificationConfig.verificationEnabled,
            unverifiedRoleId: verificationConfig.unverifiedRoleId,
            verifiedRoleId: verificationConfig.verifiedRoleId,
            verificationChannelId: verificationConfig.verificationChannelId,
            
            verificationChannelName: channel?.name || null,
            unverifiedRoleName: unverifiedRole?.name || null,
            verifiedRoleName: verifiedRole?.name || null,
            _id: verificationConfig._id
        }
    });
}


async function getVerificationConfig(guildId, socket) {
    try {
        const config = await VerificationConfig.findOne({ guildId });
        const guild = client.guilds.cache.get(guildId);

        if (socket) {
            let configPayload = null;

            if (config) {
                
                const channel = guild?.channels.cache.get(config.verificationChannelId);
                const unverifiedRole = guild?.roles.cache.get(config.unverifiedRoleId);
                const verifiedRole = guild?.roles.cache.get(config.verifiedRoleId);

                configPayload = {
                    guildId: config.guildId,
                    verificationEnabled: config.verificationEnabled,
                    unverifiedRoleId: config.unverifiedRoleId,
                    verifiedRoleId: config.verifiedRoleId,
                    verificationChannelId: config.verificationChannelId,
                    
                    verificationChannelName: channel?.name || null,
                    unverifiedRoleName: unverifiedRole?.name || null,
                    verifiedRoleName: verifiedRole?.name || null,
                    _id: config._id
                };
            }

            socket.emit('bot_data_update', {
                type: 'server_verification',
                payload: {
                    guildId,
                    config: configPayload
                }
            });
        }

        return config;
    } catch (error) {
        console.error(`${colors.red}❌ Error getting verification config:${colors.reset}`, error);

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'verification_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'get_verification_config'
                }
            });
        }

        throw error;
    }
}


async function enableVerificationSystem(guildId, configData, socket) {
    try {
        console.log(`[DEBUG] Enabling verification system for Guild: ${guildId}`);

        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            throw new Error('Guild not found');
        }

        
        let config = await VerificationConfig.findOne({ guildId });
        if (config?.verificationEnabled) {
            const existingChannel = guild.channels.cache.get(config.verificationChannelId);
            if (existingChannel) {
                throw new Error('Verification system is already enabled for this server');
            }
            
            await restoreRolePermissionBackups(guild, config.unverifiedRoleId, config.channelPermissionBackups || []);
            config.verificationEnabled = false;
            config.verificationChannelId = null;
            config.channelPermissionBackups = [];
            await config.save();
        }

        
        let unverifiedRole, verifiedRole;

        if (configData.unverifiedRoleId) {
            unverifiedRole = guild.roles.cache.get(configData.unverifiedRoleId);
            if (!unverifiedRole) {
                throw new Error('Specified unverified role not found');
            }
        } else {
            unverifiedRole = await guild.roles.create({
                name: 'Unverified',
                color: '#ff0000',
                permissions: []
            });
        }

        if (configData.verifiedRoleId) {
            verifiedRole = guild.roles.cache.get(configData.verifiedRoleId);
            if (!verifiedRole) {
                throw new Error('Specified verified role not found');
            }
        } else {
            verifiedRole = await guild.roles.create({
                name: 'Verified',
                color: '#00ff00',
                permissions: []
            });
        }

        if (unverifiedRole.id === verifiedRole.id) {
            throw new Error('Verified and unverified roles must be different roles');
        }

        const permissionBackups = captureRolePermissionBackups(guild, unverifiedRole.id);
        await VerificationConfig.findOneAndUpdate(
            { guildId },
            { $set: {
                guildId,
                verificationEnabled: false,
                unverifiedRoleId: unverifiedRole.id,
                verifiedRoleId: verifiedRole.id,
                verificationChannelId: null,
                channelPermissionBackups: permissionBackups
            } },
            { upsert: true, returnDocument: 'after' }
        );

        const permissionFailures = [];
        for (const channel of guild.channels.cache.values()) {
            try {
                if (channel.permissionOverwrites && typeof channel.permissionOverwrites.edit === 'function') {
                    await channel.permissionOverwrites.edit(unverifiedRole, { ViewChannel: false });
                }
            } catch (error) {
                console.warn(`Failed to update permissions for channel: ${channel.name}`, error);
                permissionFailures.push(channel.id);
            }
        }
        if (permissionFailures.length) {
            throw new Error(`Could not apply verification access rules in ${permissionFailures.length} channel(s). Disable verification to restore permissions, then retry.`);
        }

        
        const verificationChannel = await guild.channels.create({
            name: configData.channelName || 'verify-here',
            type: 0,
            permissionOverwrites: [
                { id: guild.id, deny: ['ViewChannel'] },
                { id: unverifiedRole.id, allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'] }
            ]
        });

        
        const updatedConfig = await VerificationConfig.findOneAndUpdate(
            { guildId },
            { $set: {
                guildId,
                verificationEnabled: true,
                unverifiedRoleId: unverifiedRole.id,
                verifiedRoleId: verifiedRole.id,
                verificationChannelId: verificationChannel.id,
                channelPermissionBackups: permissionBackups
            } },
            { upsert: true, returnDocument: 'after' }
        );

        invalidateVerificationConfig(guildId);

        if (socket) {
            emitVerificationUpdate(guildId, updatedConfig, socket);
        }

        try {
            await sendVerificationMessageToChannel(verificationChannel, guild, socket);
        } catch (msgError) {
            console.error(`${colors.yellow}⚠️ Failed to send verification message, but system is enabled:${colors.reset}`, msgError.message);
        }

        console.log(`${colors.green}✅ Enabled verification system for server ${guildId}${colors.reset}`);

        return updatedConfig;
    } catch (error) {
        console.error(`${colors.red}❌ Error enabling verification system:${colors.reset}`, error);

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'verification_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'enable_verification_system'
                }
            });
        }

        throw error;
    }
}


async function disableVerificationSystem(guildId, socket) {
    try {
        console.log(`[DEBUG] Disabling verification system for Guild: ${guildId}`);

        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            throw new Error('Guild not found');
        }

        const config = await VerificationConfig.findOne({ guildId });
        if (!config || (!config.verificationEnabled && !(config.channelPermissionBackups || []).length)) {
            throw new Error('Verification system is not currently enabled');
        }

        if (config.unverifiedRoleId && (config.channelPermissionBackups || []).length) {
            await restoreRolePermissionBackups(guild, config.unverifiedRoleId, config.channelPermissionBackups);
        }

        
        const channel = guild.channels.cache.get(config.verificationChannelId);
        if (channel) {
            await channel.delete().catch(() => { });
        }

        
        config.verificationEnabled = false;
        config.verificationChannelId = null;
        config.channelPermissionBackups = [];
        await config.save();

        invalidateVerificationConfig(guildId);

        if (socket) {
            emitVerificationUpdate(guildId, config, socket);
        }

        console.log(`${colors.yellow}⚠️ Disabled verification system for server ${guildId}${colors.reset}`);

        return config;
    } catch (error) {
        console.error(`${colors.red}❌ Error disabling verification system:${colors.reset}`, error);

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'verification_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'disable_verification_system'
                }
            });
        }

        throw error;
    }
}


async function updateVerificationConfig(guildId, updateData, socket) {
    try {
        const config = await VerificationConfig.findOne({ guildId });
        if (!config) {
            throw new Error('Verification configuration not found');
        }

        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            throw new Error('Guild not found');
        }

        const safeUpdates = {};
        if (Object.hasOwn(updateData, 'unverifiedRoleId')) {
            if (config.verificationEnabled && updateData.unverifiedRoleId !== config.unverifiedRoleId) {
                throw new Error('Disable verification before changing the unverified role');
            }
            const role = guild.roles.cache.get(updateData.unverifiedRoleId);
            if (!role) {
                throw new Error('Unverified role not found');
            }
            safeUpdates.unverifiedRoleId = updateData.unverifiedRoleId;
        }

        if (Object.hasOwn(updateData, 'verifiedRoleId')) {
            const role = guild.roles.cache.get(updateData.verifiedRoleId);
            if (!role) {
                throw new Error('Verified role not found');
            }
            if (updateData.verifiedRoleId === (safeUpdates.unverifiedRoleId || config.unverifiedRoleId)) {
                throw new Error('Verified and unverified roles must be different roles');
            }
            safeUpdates.verifiedRoleId = updateData.verifiedRoleId;
        }

        Object.assign(config, safeUpdates);
        await config.save();

        invalidateVerificationConfig(guildId);

        if (socket) {
            emitVerificationUpdate(guildId, config, socket);
        }

        console.log(`${colors.cyan}🔄 Updated verification config for server ${guildId}${colors.reset}`);

        return config;
    } catch (error) {
        console.error(`${colors.red}❌ Error updating verification config:${colors.reset}`, error);

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'verification_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'update_verification_config'
                }
            });
        }

        throw error;
    }
}


async function deleteVerificationConfig(guildId, socket) {
    try {
        const existingConfig = await VerificationConfig.findOne({ guildId });
        if (!existingConfig) {
            throw new Error('Verification configuration not found');
        }
        const guild = client.guilds.cache.get(guildId);
        if (guild && existingConfig.unverifiedRoleId && (existingConfig.channelPermissionBackups || []).length) {
            await restoreRolePermissionBackups(guild, existingConfig.unverifiedRoleId, existingConfig.channelPermissionBackups);
        }

        const deletedConfig = await VerificationConfig.findOneAndDelete({ guildId });
        if (!deletedConfig) throw new Error('Verification configuration could not be deleted');

        invalidateVerificationConfig(guildId);

        
        if (guild && deletedConfig.verificationChannelId) {
            const channel = guild.channels.cache.get(deletedConfig.verificationChannelId);
            if (channel) {
                await channel.delete().catch(() => { });
            }
        }

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'verification_deleted',
                payload: {
                    guildId,
                    _id: deletedConfig._id
                }
            });
        }

        console.log(`${colors.red}🗑️ Deleted verification configuration for server ${guildId}${colors.reset}`);

        return deletedConfig;
    } catch (error) {
        console.error(`${colors.red}❌ Error deleting verification config:${colors.reset}`, error);

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'verification_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'delete_verification_config'
                }
            });
        }

        throw error;
    }
}


async function getVerificationStats(guildId, socket) {
    try {
        const config = await VerificationConfig.findOne({ guildId });
        const guild = client.guilds.cache.get(guildId);

        const stats = {
            hasConfig: !!config,
            isEnabled: config?.verificationEnabled || false,
            channelExists: config?.verificationChannelId ? !!guild?.channels?.cache?.get(config.verificationChannelId) : false,
            unverifiedRoleExists: config?.unverifiedRoleId ? !!guild?.roles?.cache?.get(config.unverifiedRoleId) : false,
            verifiedRoleExists: config?.verifiedRoleId ? !!guild?.roles?.cache?.get(config.verifiedRoleId) : false,
            guildMemberCount: guild?.memberCount || 0,
            unverifiedMemberCount: config?.unverifiedRoleId ? guild?.roles?.cache?.get(config.unverifiedRoleId)?.members?.size || 0 : 0,
            verifiedMemberCount: config?.verifiedRoleId ? guild?.roles?.cache?.get(config.verifiedRoleId)?.members?.size || 0 : 0
        };

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'verification_stats',
                payload: {
                    guildId,
                    stats
                }
            });
        }

        return stats;
    } catch (error) {
        console.error(`${colors.red}❌ Error getting verification stats:${colors.reset}`, error);

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'verification_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'get_verification_stats'
                }
            });
        }

        throw error;
    }
}


async function sendVerificationMessageToChannel(channel, guild, socket) {
    try {
        const card = buildVerificationCard(guild);
        const sentMessage = await channel.send({
            components: [card],
            flags: MessageFlags.IsComponentsV2
        });

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'verification_message_sent',
                payload: {
                    guildId: guild.id,
                    channelId: channel.id,
                    messageId: sentMessage.id
                }
            });
        }

        console.log(`${colors.green}📨 Sent verification message for server ${guild.id} to channel ${channel.id}${colors.reset}`);

        return { messageId: sentMessage.id };
    } catch (error) {
        console.error(`${colors.red}❌ Error sending verification message to channel:${colors.reset}`, error);
        throw error;
    }
}


async function sendVerificationMessage(guildId, socket) {
    try {
        const config = await VerificationConfig.findOne({ guildId });
        if (!config?.verificationEnabled) {
            throw new Error('Verification system is not enabled');
        }

        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            throw new Error('Guild not found');
        }

        const channel = guild.channels.cache.get(config.verificationChannelId);
        if (!channel) {
            throw new Error('Verification channel not found');
        }

        const card = buildVerificationCard(guild);
        const sentMessage = await channel.send({
            components: [card],
            flags: MessageFlags.IsComponentsV2
        });

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'verification_message_sent',
                payload: {
                    guildId,
                    channelId: config.verificationChannelId,
                    messageId: sentMessage.id
                }
            });
        }

        console.log(`${colors.green}📨 Sent verification message for server ${guildId} to channel ${config.verificationChannelId}${colors.reset}`);

        return { messageId: sentMessage.id };
    } catch (error) {
        console.error(`${colors.red}❌ Error sending verification message:${colors.reset}`, error);

        if (socket) {
            socket.emit('bot_data_update', {
                type: 'verification_error',
                payload: {
                    guildId,
                    error: error.message,
                    action: 'send_verification_message'
                }
            });
        }

        throw error;
    }
}

async function sendAllVerificationConfigs(socket) {
    try {
        const configs = await VerificationConfig.find({});

        for (const config of configs) {
            socket.emit('bot_data_update', {
                type: 'verification_config',
                payload: {
                    guildId: config.guildId,
                    verificationEnabled: config.verificationEnabled,
                    unverifiedRoleId: config.unverifiedRoleId,
                    verifiedRoleId: config.verifiedRoleId,
                    verificationChannelId: config.verificationChannelId,
                    _id: config._id
                }
            });
        }

        console.log(`${colors.green}📊 Sent ${configs.length} verification configs to middleware${colors.reset}`);
    } catch (error) {
        console.error(`${colors.red}❌ Error sending all verification configs:${colors.reset}`, error);
    }
}

module.exports = {
    setClient,
    buildVerificationCard,
    getVerificationConfig,
    enableVerificationSystem,
    disableVerificationSystem,
    updateVerificationConfig,
    deleteVerificationConfig,
    getVerificationStats,
    sendVerificationMessage,
    sendVerificationMessageToChannel,
    sendAllVerificationConfigs
};
