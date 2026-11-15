


const { PermissionsBitField, AuditLogEvent, MessageFlags } = require('discord.js');
const { buildCard } = require('../UI');
const { getEmoji } = require('../UI/emojis/emoji');
const loadLanguage = require('../events/loadLanguage');
const AntiConfig = require('../models/antiSystem/AntiConfig');
const UserViolation = require('../models/antiSystem/UserViolation');
const ThreatScore = require('../models/antiSystem/ThreatScore');
const { getActionQueue, ACTION_TYPES, PRIORITY } = require('../utils/actionQueue');

class AntiNukeModule {
    constructor(client) {
        this.client = client;
        this.actionTracker = new Map();        
        this.thresholdBreaches = new Map();    
        this.lockedServers = new Map();        
        this.webhookCache = new Map();         
        this.roleCache = new Map();            
        this.channelCache = new Map();         
        this.actionQueue = null;
        this.clientListeners = [];
        this.cleanupTimer = null;

        
        this.MONITORED_ACTIONS = {
            CHANNEL_CREATE: 'channelCreate',
            CHANNEL_DELETE: 'channelDelete',
            ROLE_CREATE: 'roleCreate',
            ROLE_DELETE: 'roleDelete',
            ROLE_UPDATE: 'roleUpdate',
            MEMBER_BAN: 'memberBan',
            MEMBER_KICK: 'memberKick',
            MEMBER_PRUNE: 'memberPrune',
            WEBHOOK_CREATE: 'webhookCreate',
            WEBHOOK_DELETE: 'webhookDelete',
            EMOJI_DELETE: 'emojiDelete',
            BOT_ADD: 'botAdd',
            GUILD_UPDATE: 'guildUpdate',
            PERMISSION_UPDATE: 'permissionUpdate',
            INTEGRATION_CREATE: 'integrationCreate'
        };

        
        this.DEFAULT_THRESHOLDS = {
            channelDelete: { limit: 3, window: 60000 },
            channelCreate: { limit: 5, window: 60000 },
            roleDelete: { limit: 3, window: 60000 },
            roleCreate: { limit: 5, window: 60000 },
            memberBan: { limit: 5, window: 60000 },
            memberKick: { limit: 5, window: 60000 },
            webhookCreate: { limit: 3, window: 60000 },
            emojiDelete: { limit: 5, window: 60000 },
            permissionUpdate: { limit: 3, window: 60000 }
        };
        this.initialize();
    }

    initialize() {
        
        this.bindClientEvent('channelCreate', channel => this.handleChannelCreate(channel));
        this.bindClientEvent('channelDelete', channel => this.handleChannelDelete(channel));
        this.bindClientEvent('channelUpdate', (oldChannel, newChannel) => this.handleChannelUpdate(oldChannel, newChannel));

        
        this.bindClientEvent('roleCreate', role => this.handleRoleCreate(role));
        this.bindClientEvent('roleDelete', role => this.handleRoleDelete(role));
        this.bindClientEvent('roleUpdate', (oldRole, newRole) => this.handleRoleUpdate(oldRole, newRole));

        
        this.bindClientEvent('guildBanAdd', ban => this.handleMemberBan(ban));
        this.bindClientEvent('guildMemberRemove', member => this.handleMemberRemove(member));

        
        this.bindClientEvent('guildUpdate', (oldGuild, newGuild) => this.handleGuildUpdate(oldGuild, newGuild));

        
        this.bindClientEvent('webhookUpdate', channel => this.handleWebhookUpdate(channel));

        
        this.bindClientEvent('emojiDelete', emoji => this.handleEmojiDelete(emoji));

        
        this.bindClientEvent('guildMemberAdd', member => this.handleMemberAdd(member));

        
        this.bindClientEvent('guildIntegrationsUpdate', guild => this.handleIntegrationsUpdate(guild));

        
        this.bindClientEvent('clientReady', () => this.cacheGuilds(), true);

        
        this.cleanupTimer = setInterval(() => this.cleanup(), 60 * 1000);
        this.cleanupTimer.unref?.();

        
        this.actionQueue = getActionQueue(this.client);
    }

    bindClientEvent(eventName, callback, once = false) {
        const listener = (...args) => callback(...args);
        this.clientListeners.push({ eventName, listener });
        (once ? this.client.once : this.client.on).call(this.client, eventName, listener);
    }

    stop() {
        for (const { eventName, listener } of this.clientListeners) this.client.off(eventName, listener);
        this.clientListeners = [];
        if (this.cleanupTimer) clearInterval(this.cleanupTimer);
        this.cleanupTimer = null;
        this.actionTracker.clear();
        this.thresholdBreaches.clear();
        this.lockedServers.clear();
        this.webhookCache.clear();
        this.roleCache.clear();
        this.channelCache.clear();
    }

    async cacheGuilds() {
        for (const [guildId, guild] of this.client.guilds.cache) {
            await this.cacheGuildState(guild);
        }
    }

    async cacheGuildState(guild) {
        
        try {
            const webhooks = await guild.fetchWebhooks();
            this.webhookCache.set(guild.id, Array.from(webhooks.values()).map(w => ({
                id: w.id,
                name: w.name,
                channelId: w.channelId,
                owner: w.owner?.id
            })));
        } catch (e) { }

        
        const roleData = new Map();
        for (const [roleId, role] of guild.roles.cache) {
            roleData.set(roleId, {
                name: role.name,
                permissions: role.permissions.bitfield,
                position: role.position,
                managed: role.managed
            });
        }
        this.roleCache.set(guild.id, roleData);

        
        this.channelCache.set(guild.id, guild.channels.cache.map(c => ({
            id: c.id,
            name: c.name,
            type: c.type,
            parentId: c.parentId
        })));
    }

    async handleChannelCreate(channel) {
        if (!channel.guild) return;

        const config = await this.getConfig(channel.guild.id);
        if (!config?.antiNuke?.enabled) return;
        if (!config.antiNuke.monitoredActions?.channelCreate) return;

        const executor = await this.getAuditLogExecutor(channel.guild, AuditLogEvent.ChannelCreate);
        if (!executor) return;

        if (await this.isWhitelisted(executor, channel.guild, config)) return;

        await this.trackAction(channel.guild, executor.id, 'channelCreate', {
            channelId: channel.id,
            channelName: channel.name,
            channelType: channel.type
        }, config);
    }

    async handleChannelDelete(channel) {
        if (!channel.guild) return;

        const config = await this.getConfig(channel.guild.id);
        if (!config?.antiNuke?.enabled) return;
        if (!config.antiNuke.monitoredActions?.channelDelete) return;

        const executor = await this.getAuditLogExecutor(channel.guild, AuditLogEvent.ChannelDelete);
        if (!executor) return;

        if (await this.isWhitelisted(executor, channel.guild, config)) {
            if (config.staffMonitoring?.logWhitelistedActions) {
                await this.logStaffAction(executor, channel.guild, 'channelDelete', { channel: channel.name }, config);
            }
            return;
        }

        await this.trackAction(channel.guild, executor.id, 'channelDelete', {
            channelId: channel.id,
            channelName: channel.name,
            channelType: channel.type
        }, config);
    }

    async handleChannelUpdate(oldChannel, newChannel) {
        if (!newChannel.guild) return;

        const config = await this.getConfig(newChannel.guild.id);
        if (!config?.antiNuke?.enabled) return;
        if (!config.antiNuke.monitoredActions?.permissionUpdate) return;

        
        const oldPerms = oldChannel.permissionOverwrites.cache;
        const newPerms = newChannel.permissionOverwrites.cache;

        const dangerousChanges = this.detectDangerousPermChanges(oldPerms, newPerms);
        if (dangerousChanges.length === 0) return;

        const executor = await this.getAuditLogExecutor(newChannel.guild, AuditLogEvent.ChannelOverwriteUpdate);
        if (!executor) return;

        if (await this.isWhitelisted(executor, newChannel.guild, config)) return;

        await this.trackAction(newChannel.guild, executor.id, 'permissionUpdate', {
            channelId: newChannel.id,
            channelName: newChannel.name,
            changes: dangerousChanges
        }, config);
    }

    async handleRoleCreate(role) {
        const config = await this.getConfig(role.guild.id);
        if (!config?.antiNuke?.enabled) return;
        if (!config.antiNuke.monitoredActions?.roleCreate) return;

        const executor = await this.getAuditLogExecutor(role.guild, AuditLogEvent.RoleCreate);
        if (!executor) return;

        if (await this.isWhitelisted(executor, role.guild, config)) return;

        
        const dangerousPerms = this.hasDangerousPermissions(role.permissions);

        await this.trackAction(role.guild, executor.id, 'roleCreate', {
            roleId: role.id,
            roleName: role.name,
            permissions: role.permissions.bitfield,
            hasDangerousPerms: dangerousPerms.length > 0,
            dangerousPerms
        }, config);

        
        const roleData = this.roleCache.get(role.guild.id) || new Map();
        roleData.set(role.id, {
            name: role.name,
            permissions: role.permissions.bitfield,
            position: role.position,
            managed: role.managed
        });
        this.roleCache.set(role.guild.id, roleData);
    }

    async handleRoleDelete(role) {
        const config = await this.getConfig(role.guild.id);
        if (!config?.antiNuke?.enabled) return;
        if (!config.antiNuke.monitoredActions?.roleDelete) return;

        const executor = await this.getAuditLogExecutor(role.guild, AuditLogEvent.RoleDelete);
        if (!executor) return;

        if (await this.isWhitelisted(executor, role.guild, config)) {
            if (config.staffMonitoring?.logWhitelistedActions) {
                await this.logStaffAction(executor, role.guild, 'roleDelete', { role: role.name }, config);
            }
            return;
        }

        await this.trackAction(role.guild, executor.id, 'roleDelete', {
            roleId: role.id,
            roleName: role.name,
            permissions: role.permissions.bitfield
        }, config);
    }

    async handleRoleUpdate(oldRole, newRole) {
        const config = await this.getConfig(newRole.guild.id);
        if (!config?.antiNuke?.enabled) return;
        if (!config.antiNuke.monitoredActions?.roleUpdate) return;

        
        const oldDangerous = this.hasDangerousPermissions(oldRole.permissions);
        const newDangerous = this.hasDangerousPermissions(newRole.permissions);

        const grantedDangerous = newDangerous.filter(p => !oldDangerous.includes(p));
        if (grantedDangerous.length === 0) return;

        const executor = await this.getAuditLogExecutor(newRole.guild, AuditLogEvent.RoleUpdate);
        if (!executor) return;

        if (await this.isWhitelisted(executor, newRole.guild, config)) {
            if (config.staffMonitoring?.logWhitelistedActions) {
                await this.logStaffAction(executor, newRole.guild, 'roleUpdate', {
                    role: newRole.name,
                    grantedPerms: grantedDangerous
                }, config);
            }
            return;
        }

        await this.trackAction(newRole.guild, executor.id, 'roleUpdate', {
            roleId: newRole.id,
            roleName: newRole.name,
            oldPermissions: oldRole.permissions.bitfield,
            newPermissions: newRole.permissions.bitfield,
            grantedDangerous
        }, config);

        
        const roleData = this.roleCache.get(newRole.guild.id) || new Map();
        roleData.set(newRole.id, {
            name: newRole.name,
            permissions: newRole.permissions.bitfield,
            position: newRole.position,
            managed: newRole.managed
        });
        this.roleCache.set(newRole.guild.id, roleData);
    }

    async handleMemberBan(ban) {
        const config = await this.getConfig(ban.guild.id);
        if (!config?.antiNuke?.enabled) return;
        if (!config.antiNuke.monitoredActions?.memberBan) return;

        const executor = await this.getAuditLogExecutor(ban.guild, AuditLogEvent.MemberBanAdd);
        if (!executor) return;

        if (await this.isWhitelisted(executor, ban.guild, config)) {
            if (config.staffMonitoring?.logWhitelistedActions) {
                await this.logStaffAction(executor, ban.guild, 'memberBan', { user: ban.user.tag }, config);
            }
            return;
        }

        await this.trackAction(ban.guild, executor.id, 'memberBan', {
            userId: ban.user.id,
            userTag: ban.user.tag,
            reason: ban.reason
        }, config);
    }

    async handleMemberRemove(member) {
        const config = await this.getConfig(member.guild.id);
        if (!config?.antiNuke?.enabled) return;
        if (!config.antiNuke.monitoredActions?.memberKick) return;

        
        const executor = await this.getAuditLogExecutor(member.guild, AuditLogEvent.MemberKick, member.id);
        if (!executor) return; 

        if (await this.isWhitelisted(executor, member.guild, config)) {
            if (config.staffMonitoring?.logWhitelistedActions) {
                await this.logStaffAction(executor, member.guild, 'memberKick', { user: member.user.tag }, config);
            }
            return;
        }

        await this.trackAction(member.guild, executor.id, 'memberKick', {
            userId: member.id,
            userTag: member.user.tag
        }, config);
    }

    async handleGuildUpdate(oldGuild, newGuild) {
        const config = await this.getConfig(newGuild.id);
        if (!config?.antiNuke?.enabled) return;
        if (!config.antiNuke.monitoredActions?.guildUpdate) return;

        
        const criticalChanges = [];

        if (oldGuild.name !== newGuild.name) criticalChanges.push('name');
        if (oldGuild.iconURL() !== newGuild.iconURL()) criticalChanges.push('icon');
        if (oldGuild.vanityURLCode !== newGuild.vanityURLCode) criticalChanges.push('vanityURL');
        if (oldGuild.verificationLevel !== newGuild.verificationLevel) criticalChanges.push('verificationLevel');

        if (criticalChanges.length === 0) return;

        const executor = await this.getAuditLogExecutor(newGuild, AuditLogEvent.GuildUpdate);
        if (!executor) return;

        if (await this.isWhitelisted(executor, newGuild, config)) {
            if (config.staffMonitoring?.logWhitelistedActions) {
                await this.logStaffAction(executor, newGuild, 'guildUpdate', { changes: criticalChanges }, config);
            }
            return;
        }

        await this.trackAction(newGuild, executor.id, 'guildUpdate', {
            changes: criticalChanges,
            oldName: oldGuild.name,
            newName: newGuild.name
        }, config);
    }

    async handleWebhookUpdate(channel) {
        if (!channel.guild) return;

        const config = await this.getConfig(channel.guild.id);
        if (!config?.antiNuke?.enabled) return;
        if (!config.antiNuke.monitoredActions?.webhookCreate) return;

        try {
            const currentWebhooks = await channel.fetchWebhooks();
            const cachedWebhooks = this.webhookCache.get(channel.guild.id) || [];

            
            const newWebhooks = currentWebhooks.filter(w =>
                !cachedWebhooks.some(cw => cw.id === w.id)
            );

            for (const webhook of newWebhooks.values()) {
                const executor = await this.getAuditLogExecutor(channel.guild, AuditLogEvent.WebhookCreate);
                if (!executor) continue;

                if (await this.isWhitelisted(executor, channel.guild, config)) continue;

                await this.trackAction(channel.guild, executor.id, 'webhookCreate', {
                    webhookId: webhook.id,
                    webhookName: webhook.name,
                    channelId: channel.id,
                    channelName: channel.name
                }, config);
            }

            
            this.webhookCache.set(channel.guild.id, Array.from(currentWebhooks.values()).map(w => ({
                id: w.id,
                name: w.name,
                channelId: w.channelId,
                owner: w.owner?.id
            })));

        } catch (e) { }
    }

    async handleEmojiDelete(emoji) {
        const config = await this.getConfig(emoji.guild.id);
        if (!config?.antiNuke?.enabled) return;
        if (!config.antiNuke.monitoredActions?.emojiDelete) return;

        const executor = await this.getAuditLogExecutor(emoji.guild, AuditLogEvent.EmojiDelete);
        if (!executor) return;

        if (await this.isWhitelisted(executor, emoji.guild, config)) return;

        await this.trackAction(emoji.guild, executor.id, 'emojiDelete', {
            emojiId: emoji.id,
            emojiName: emoji.name
        }, config);
    }

    async handleMemberAdd(member) {
        if (!member.user.bot) return;

        const config = await this.getConfig(member.guild.id);
        if (!config?.antiNuke?.enabled) return;
        if (!config.antiNuke.monitoredActions?.botAdd) return;

        const executor = await this.getAuditLogExecutor(member.guild, AuditLogEvent.BotAdd);
        if (!executor) return;

        if (await this.isWhitelisted(executor, member.guild, config)) {
            if (config.staffMonitoring?.logWhitelistedActions) {
                await this.logStaffAction(executor, member.guild, 'botAdd', { bot: member.user.tag }, config);
            }
            return;
        }

        await this.trackAction(member.guild, executor.id, 'botAdd', {
            botId: member.id,
            botTag: member.user.tag,
            permissions: member.permissions.bitfield
        }, config);

        
        if (config.antiNuke.botProtection?.kickUnauthorizedBots) {
            const authorizedBots = config.antiNuke.botProtection?.authorizedBots || [];

            if (!authorizedBots.includes(member.id)) {
                await this.handleUnauthorizedBot(member, executor, config);
            }
        }
    }

    async handleIntegrationsUpdate(guild) {
        const config = await this.getConfig(guild.id);
        if (!config?.antiNuke?.enabled) return;
        if (!config.antiNuke.monitoredActions?.integrationCreate) return;

        const executor = await this.getAuditLogExecutor(guild, AuditLogEvent.IntegrationCreate);
        if (!executor) return;

        if (await this.isWhitelisted(executor, guild, config)) return;

        await this.trackAction(guild, executor.id, 'integrationCreate', {
            type: 'integration'
        }, config);
    }

    async trackAction(guild, executorId, actionType, data, config) {
        const guildId = guild.id;

        
        if (!this.actionTracker.has(guildId)) {
            this.actionTracker.set(guildId, new Map());
        }

        const guildTracker = this.actionTracker.get(guildId);

        if (!guildTracker.has(executorId)) {
            guildTracker.set(executorId, []);
        }

        const userActions = guildTracker.get(executorId);
        const now = Date.now();

        
        userActions.push({
            type: actionType,
            timestamp: now,
            data
        });

        
        const thresholds = config.antiNuke.thresholds || this.DEFAULT_THRESHOLDS;
        const threshold = thresholds[actionType] || { limit: 5, window: 60000 };

        
        const windowActions = userActions.filter(a =>
            a.type === actionType && now - a.timestamp < threshold.window
        );

        
        if (windowActions.length >= threshold.limit) {
            await this.handleThresholdBreach(guild, executorId, actionType, windowActions, config);
        }

        
        const multiActionCheck = this.detectMultiActionNuke(userActions, now, config);
        if (multiActionCheck.isNuke) {
            await this.handleNukeDetected(guild, executorId, multiActionCheck, config);
        }

        
        await this.logAction(guild, executorId, actionType, data, config);

        
        await this.updateThreatScore(executorId, guildId, actionType, data);
    }

    detectMultiActionNuke(actions, now, config) {
        const nukeWindow = config.antiNuke.nukeDetectionWindow || 120000;
        const recentActions = actions.filter(a => now - a.timestamp < nukeWindow);

        
        const actionCounts = {};
        for (const action of recentActions) {
            actionCounts[action.type] = (actionCounts[action.type] || 0) + 1;
        }

        const destructiveActions = ['channelDelete', 'roleDelete', 'memberBan', 'memberKick'];
        const destructiveCount = destructiveActions.reduce((sum, type) => sum + (actionCounts[type] || 0), 0);

        
        const nukeThreshold = config.antiNuke.nukeDetectionThreshold || 5;

        if (destructiveCount >= nukeThreshold) {
            return {
                isNuke: true,
                severity: destructiveCount >= nukeThreshold * 2 ? 'critical' : 'high',
                actions: recentActions,
                counts: actionCounts
            };
        }

        return { isNuke: false };
    }

    async handleThresholdBreach(guild, executorId, actionType, actions, config) {
        const executor = await guild.members.fetch(executorId).catch(() => null);
        if (!executor) return;

        
        const isDryRun = config.systemMode?.mode === 'dry-run' || config.systemMode?.mode === 'log-only';

        
        const punishment = config.getModulePunishment('nuke');

        
        const criticalActions = ['channelDelete', 'roleDelete', 'memberBan', 'guildUpdate'];
        const isCritical = criticalActions.includes(actionType);

        
        const action = await this.determineAction(executorId, guild.id, punishment, isCritical, config);

        if (!isDryRun) {
            await this.executeAction(executor, action, actionType, actions, config);
        }

        
        await this.logThresholdBreach(guild, executor, actionType, actions, action, isDryRun, config);

        
        if (isCritical) {
            await this.notifyOwner(guild, executor, actionType, actions, config);
        }

        
        if (!this.thresholdBreaches.has(guild.id)) {
            this.thresholdBreaches.set(guild.id, new Map());
        }

        this.thresholdBreaches.get(guild.id).set(executorId, {
            actionType,
            timestamp: Date.now(),
            count: actions.length,
            action: isDryRun ? `${action.type} (simulated)` : action.type
        });
    }

    async handleNukeDetected(guild, executorId, nukeData, config) {
        const executor = await guild.members.fetch(executorId).catch(() => null);
        if (!executor) return;

        const isDryRun = config.systemMode?.mode === 'dry-run' || config.systemMode?.mode === 'log-only';

        
        await this.logNukeDetected(guild, executor, nukeData, isDryRun, config);

        if (!isDryRun) {
            
            if (executor.bannable) {
                await this.actionQueue.enqueue({
                    type: ACTION_TYPES.BAN_USER,
                    guildId: guild.id,
                    targetId: executorId,
                    data: { deleteMessageDays: 7 },
                    priority: PRIORITY.CRITICAL,
                    module: 'nuke',
                    reason: 'Anti-nuke: Server nuke attempt detected',
                    undoData: { action: 'ban' }
                });
            }

            
            await this.stripRoles(executor);

            
            if (nukeData.severity === 'critical') {
                await this.emergencyLockdown(guild, executor, config);
            }
        }

        
        await this.notifyOwner(guild, executor, 'NUKE_ATTEMPT', nukeData.actions, config);

        
        let threatScore = await ThreatScore.getOrCreate(executorId, guild.id);
        await threatScore.addViolation({
            type: 'nuke_attempt',
            severity: 'critical',
            module: 'nuke',
            reason: `Nuke attempt detected: ${Object.entries(nukeData.counts).map(([k, v]) => `${k}: ${v}`).join(', ')}`
        });

        threatScore.scores.nuke = 100;
        threatScore.statusFlags.isBanned = !isDryRun;
        threatScore.statusFlags.requiresReview = true;

        await threatScore.save();
    }

    async handleUnauthorizedBot(bot, executor, config) {
        const guild = bot.guild;

        
        if (bot.kickable) {
            await this.actionQueue.enqueue({
                type: ACTION_TYPES.KICK_USER,
                guildId: guild.id,
                targetId: bot.id,
                priority: PRIORITY.CRITICAL,
                module: 'nuke',
                reason: 'Anti-nuke: Unauthorized bot added'
            });
        }

        
        const member = guild.members.cache.get(executor.id);
        if (member && config.antiNuke.botProtection?.punishAdder) {
            const punishment = config.getModulePunishment('nuke');
            const action = await this.determineAction(executor.id, guild.id, punishment, true, config);
            await this.executeAction(member, action, 'botAdd', [{ data: { botTag: bot.user.tag } }], config);
        }

        
        await this.logUnauthorizedBot(guild, bot, executor, config);
    }

    async determineAction(executorId, guildId, punishment, isCritical, config) {
        
        const breachCount = await UserViolation.countDocuments({
            userId: executorId,
            guildId: guildId,
            violationType: { $in: ['channelDelete', 'roleDelete', 'memberBan', 'nuke_attempt'] },
            violatedAt: { $gte: new Date(Date.now() - 86400000) }
        });

        
        if (isCritical && breachCount > 0) {
            return { type: 'ban', reason: 'repeated_critical' };
        }

        if (isCritical) {
            return { type: 'quarantine', duration: 3600000, reason: 'critical_action' };
        }

        
        if (punishment?.actions?.length > 0) {
            const sortedActions = [...punishment.actions].sort((a, b) => b.threshold - a.threshold);

            for (const actionConfig of sortedActions) {
                if (breachCount >= actionConfig.threshold) {
                    return {
                        type: actionConfig.action,
                        duration: actionConfig.duration,
                        reason: 'escalation'
                    };
                }
            }
        }

        return { type: punishment?.defaultAction || 'quarantine', duration: 3600000, reason: 'default' };
    }

    async executeAction(member, action, actionType, actions, config) {
        switch (action.type) {
            case 'warn':
                await this.actionQueue.enqueue({
                    type: ACTION_TYPES.SEND_WARNING,
                    guildId: member.guild.id,
                    targetId: member.id,
                    data: {},
                    priority: PRIORITY.MEDIUM,
                    module: 'nuke',
                    reason: `Anti-nuke: ${actionType} threshold exceeded`
                });
                break;

            case 'strip_roles':
                await this.stripRoles(member);
                break;

            case 'quarantine':
                await this.quarantineUser(member, `Anti-nuke: ${actionType}`, config);
                break;

            case 'kick':
                if (member.kickable) {
                    await this.actionQueue.enqueue({
                        type: ACTION_TYPES.KICK_USER,
                        guildId: member.guild.id,
                        targetId: member.id,
                        priority: PRIORITY.HIGH,
                        module: 'nuke',
                        reason: `Anti-nuke: ${actionType} threshold exceeded`
                    });
                }
                break;

            case 'ban':
                if (member.bannable) {
                    await this.actionQueue.enqueue({
                        type: ACTION_TYPES.BAN_USER,
                        guildId: member.guild.id,
                        targetId: member.id,
                        data: { deleteMessageDays: 7 },
                        priority: PRIORITY.CRITICAL,
                        module: 'nuke',
                        reason: `Anti-nuke: ${actionType} threshold exceeded`,
                        undoData: { action: 'ban' }
                    });
                }
                break;
        }
    }

    async stripRoles(member) {
        if (!member.manageable) return;

        const rolesToKeep = member.roles.cache.filter(role =>
            role.id === member.guild.id || 
            role.managed 
        );

        try {
            await member.roles.set(rolesToKeep);
        } catch (e) {
            console.error('[ANTI-NUKE] Failed to strip roles:', e.message);
        }
    }

    async quarantineUser(member, reason, config) {
        const QuarantineConfig = require('../models/qurantine/quarantineConfig');
        const UserQuarantine = require('../models/qurantine/userQuarantine');

        const quarantineConfig = await QuarantineConfig.findOne({ guildId: member.guild.id });

        if (quarantineConfig?.quarantineEnabled && quarantineConfig.quarantineRoleId) {
            const quarantineRole = member.guild.roles.cache.get(quarantineConfig.quarantineRoleId);

            if (quarantineRole) {
                const originalRoles = member.roles.cache
                    .filter(role => role.id !== member.guild.id && role.id !== quarantineConfig.quarantineRoleId)
                    .map(role => role.id);

                await this.actionQueue.enqueue({
                    type: ACTION_TYPES.QUARANTINE_USER,
                    guildId: member.guild.id,
                    targetId: member.id,
                    data: {
                        quarantineRoleId: quarantineConfig.quarantineRoleId,
                        originalRoles
                    },
                    priority: PRIORITY.HIGH,
                    module: 'nuke',
                    reason,
                    undoData: { originalRoles, quarantineRoleId: quarantineConfig.quarantineRoleId }
                });

                await UserQuarantine.findOneAndUpdate(
                    { userId: member.id, guildId: member.guild.id },
                    {
                        isQuarantined: true,
                        quarantinedAt: new Date(),
                        reason
                    },
                    { upsert: true }
                );

                quarantineConfig.userRoles.set(member.id, originalRoles);
                await quarantineConfig.save();

                return;
            }
        }

        
        await this.stripRoles(member);
    }

    async emergencyLockdown(guild, executor, config) {
        await this.actionQueue.enqueue({
            type: ACTION_TYPES.SERVER_LOCKDOWN,
            guildId: guild.id,
            priority: PRIORITY.CRITICAL,
            module: 'nuke',
            reason: `Anti-nuke: Nuke attempt by ${executor.user.tag}`
        });

        this.lockedServers.set(guild.id, {
            locked: true,
            timestamp: Date.now(),
            executor: executor.id
        });
    }

    async updateThreatScore(executorId, guildId, actionType, data) {
        const severityMap = {
            channelDelete: 'high',
            roleDelete: 'high',
            memberBan: 'medium',
            memberKick: 'medium',
            webhookCreate: 'medium',
            botAdd: 'high',
            guildUpdate: 'critical',
            permissionUpdate: 'high',
            roleUpdate: 'medium'
        };

        let threatScore = await ThreatScore.getOrCreate(executorId, guildId);

        await threatScore.addViolation({
            type: actionType,
            severity: severityMap[actionType] || 'medium',
            module: 'nuke',
            reason: `${actionType}: ${JSON.stringify(data).slice(0, 200)}`
        });

        await threatScore.save();
    }

    async getConfig(guildId) {
        const { getAntiConfig } = require('../utils/cacheHelpers');
        return await getAntiConfig(guildId);
    }

    async getAuditLogExecutor(guild, eventType, targetId = null) {
        try {
            const auditLogs = await guild.fetchAuditLogs({
                limit: 1,
                type: eventType
            });

            const log = auditLogs.entries.first();
            if (!log) return null;

            
            if (Date.now() - log.createdTimestamp > 5000) return null;

            
            if (targetId && log.target?.id !== targetId) return null;

            
            if (log.executor.id === this.client.user.id) return null;

            return log.executor;

        } catch (e) {
            return null;
        }
    }

    async isWhitelisted(executor, guild, config) {
        if (executor.id === guild.ownerId) return true;
        if (config.whitelist?.owners?.includes(executor.id)) return true;
        if (config.whitelist?.customMembers?.includes(executor.id)) return true;
        if (config.antiNuke?.whitelistedUsers?.includes(executor.id)) return true;

        const member = guild.members.cache.get(executor.id);
        if (!member) return false;

        const hasWhitelistedRole = member.roles.cache.some(role =>
            config.whitelist?.customRoles?.includes(role.id) ||
            config.antiNuke?.whitelistedRoles?.includes(role.id)
        );

        return hasWhitelistedRole;
    }

    hasDangerousPermissions(permissions) {
        const dangerous = [];

        if (permissions.has(PermissionsBitField.Flags.Administrator)) dangerous.push('ADMINISTRATOR');
        if (permissions.has(PermissionsBitField.Flags.ManageGuild)) dangerous.push('MANAGE_GUILD');
        if (permissions.has(PermissionsBitField.Flags.ManageChannels)) dangerous.push('MANAGE_CHANNELS');
        if (permissions.has(PermissionsBitField.Flags.ManageRoles)) dangerous.push('MANAGE_ROLES');
        if (permissions.has(PermissionsBitField.Flags.BanMembers)) dangerous.push('BAN_MEMBERS');
        if (permissions.has(PermissionsBitField.Flags.KickMembers)) dangerous.push('KICK_MEMBERS');
        if (permissions.has(PermissionsBitField.Flags.ManageWebhooks)) dangerous.push('MANAGE_WEBHOOKS');
        if (permissions.has(PermissionsBitField.Flags.MentionEveryone)) dangerous.push('MENTION_EVERYONE');

        return dangerous;
    }

    detectDangerousPermChanges(oldPerms, newPerms) {
        const changes = [];

        for (const [id, newPerm] of newPerms) {
            const oldPerm = oldPerms.get(id);

            
            if (newPerm.id === newPerm.channel?.guild?.id) {
                const dangerous = [
                    PermissionsBitField.Flags.Administrator,
                    PermissionsBitField.Flags.ManageChannels,
                    PermissionsBitField.Flags.ManageGuild,
                    PermissionsBitField.Flags.BanMembers
                ];

                for (const perm of dangerous) {
                    const wasAllowed = oldPerm?.allow?.has(perm);
                    const isAllowed = newPerm.allow.has(perm);

                    if (!wasAllowed && isAllowed) {
                        changes.push({
                            type: 'dangerous_grant',
                            target: '@everyone',
                            permission: perm.toString()
                        });
                    }
                }
            }
        }

        return changes;
    }

    async logAction(guild, executorId, actionType, data, config) {
        const logChannelId = config.logging?.logChannelId || config.logChannelId;
        if (!logChannelId) return;

        const logChannel = guild.channels.cache.get(logChannelId);
        if (!logChannel) return;

        const lang = loadLanguage(guild.id);
        const n = lang.antimodules?.nuke || {};

        const card = buildCard({
            title: `${getEmoji('security')} ${n.actionTrackedTitle || 'Anti-Nuke: Action Tracked'}`,
            fields: [
                { name: 'Executor', value: `<@${executorId}> (${executorId})`, inline: true },
                { name: 'Action', value: actionType, inline: true },
                { name: 'Details', value: `\`\`\`json\n${JSON.stringify(data, null, 2).slice(0, 900)}\`\`\``, inline: false }
            ],
            tone: 'warning'
        });

        await logChannel.send({ components: [card], flags: MessageFlags.IsComponentsV2 }).catch(() => { });
    }

    async logThresholdBreach(guild, executor, actionType, actions, action, isDryRun, config) {
        const logChannelId = config.logging?.logChannelId || config.logChannelId;
        const alertChannelId = config.logging?.alertChannelId || config.alertChannelId;

        const lang = loadLanguage(guild.id);
        const n = lang.antimodules?.nuke || {};
        const titleText = isDryRun ? (n.thresholdBreachDryRunTitle || 'Threshold Breach (DRY RUN)') : (n.thresholdBreachTitle || 'Threshold Breach Detected');

        const card = buildCard({
            title: `${getEmoji('warning')} ${titleText}`,
            description: `User **${executor.user.tag}** exceeded ${actionType} threshold`,
            fields: [
                { name: 'Executor', value: `<@${executor.id}> (${executor.id})`, inline: true },
                { name: 'Action Type', value: actionType, inline: true },
                { name: 'Count', value: actions.length.toString(), inline: true },
                { name: 'Response', value: isDryRun ? `${action.type.toUpperCase()} (SIMULATED)` : action.type.toUpperCase(), inline: true }
            ],
            tone: 'danger'
        });

        
        const logChannel = guild.channels.cache.get(logChannelId);
        if (logChannel) {
            await logChannel.send({ components: [card], flags: MessageFlags.IsComponentsV2 }).catch(() => { });
        }

        
        if (alertChannelId && alertChannelId !== logChannelId) {
            const alertChannel = guild.channels.cache.get(alertChannelId);
            if (alertChannel) {
                await alertChannel.send({ content: '@here Anti-nuke threshold breach!' }).catch(() => {});
                await alertChannel.send({
                    components: [card],
                    flags: MessageFlags.IsComponentsV2
                }).catch(() => { });
            }
        }
    }

    async logNukeDetected(guild, executor, nukeData, isDryRun, config) {
        const alertChannelId = config.logging?.alertChannelId || config.alertChannelId || config.logging?.logChannelId;

        const lang = loadLanguage(guild.id);
        const n = lang.antimodules?.nuke || {};
        const titleText = isDryRun ? (n.nukeAttemptDryRunTitle || 'NUKE ATTEMPT DETECTED (DRY RUN)') : (n.nukeAttemptTitle || 'NUKE ATTEMPT DETECTED');

        const card = buildCard({
            title: `${getEmoji('fire')} ${titleText}`,
            description: `**CRITICAL**: ${executor.user.tag} is attempting to nuke the server!`,
            fields: [
                { name: 'Executor', value: `<@${executor.id}> (${executor.id})`, inline: true },
                { name: 'Severity', value: nukeData.severity.toUpperCase(), inline: true },
                { name: 'Actions', value: Object.entries(nukeData.counts).map(([k, v]) => `${k}: ${v}`).join('\n'), inline: false }
            ],
            tone: 'danger'
        });

        const alertChannel = guild.channels.cache.get(alertChannelId);
        if (alertChannel) {
            await alertChannel.send({ content: '@everyone NUKE ATTEMPT!' }).catch(() => {});
            await alertChannel.send({
                components: [card],
                flags: MessageFlags.IsComponentsV2
            }).catch(() => { });
        }
    }

    async logUnauthorizedBot(guild, bot, executor, config) {
        const logChannelId = config.logging?.logChannelId || config.logChannelId;
        const logChannel = guild.channels.cache.get(logChannelId);
        if (!logChannel) return;

        const lang = loadLanguage(guild.id);
        const n = lang.antimodules?.nuke || {};

        const card = buildCard({
            title: `${getEmoji('bot')} ${n.botKickedTitle || 'Unauthorized Bot Kicked'}`,
            description: 'An unauthorized bot was added and kicked',
            fields: [
                { name: 'Bot', value: `${bot.user.tag} (${bot.id})`, inline: true },
                { name: 'Added By', value: `<@${executor.id}> (${executor.id})`, inline: true }
            ],
            tone: 'danger'
        });

        await logChannel.send({ components: [card], flags: MessageFlags.IsComponentsV2 }).catch(() => { });
    }

    async logStaffAction(executor, guild, actionType, data, config) {
        const staffChannelId = config.logging?.staffChannelId;
        if (!staffChannelId) return;

        const staffChannel = guild.channels.cache.get(staffChannelId);
        if (!staffChannel) return;

        const lang = loadLanguage(guild.id);
        const n = lang.antimodules?.nuke || {};

        const card = buildCard({
            title: `${getEmoji('document')} ${n.staffActionTitle || 'Staff Action (Whitelisted)'}`,
            fields: [
                { name: 'Staff Member', value: `${executor.tag} (${executor.id})`, inline: true },
                { name: 'Action', value: actionType, inline: true },
                { name: 'Details', value: JSON.stringify(data).slice(0, 500), inline: false }
            ],
            tone: 'info'
        });

        await staffChannel.send({ components: [card], flags: MessageFlags.IsComponentsV2 }).catch(() => { });
    }

    async notifyOwner(guild, executor, actionType, actions, config) {
        const owner = await guild.fetchOwner().catch(() => null);
        if (!owner) return;

        const lang = loadLanguage(guild.id);
        const n = lang.antimodules?.nuke || {};

        const card = buildCard({
            title: `${getEmoji('fire')} ${n.criticalAlertTitle || 'Critical Security Alert'}`,
            description: `Potential server threat detected in **${guild.name}**`,
            fields: [
                { name: 'Executor', value: `${executor.user?.tag || executor.tag} (${executor.id || executor})`, inline: true },
                { name: 'Threat Type', value: actionType, inline: true },
                { name: 'Actions Count', value: actions.length?.toString() || 'N/A', inline: true }
            ],
            tone: 'danger'
        });

        await owner.send({ components: [card], flags: MessageFlags.IsComponentsV2 }).catch(() => { });
    }

    cleanup() {
        const now = Date.now();
        const MAX_AGE = 5 * 60 * 1000;

        
        for (const [guildId, guildTracker] of this.actionTracker.entries()) {
            for (const [userId, actions] of guildTracker.entries()) {
                const filtered = actions.filter(a => now - a.timestamp < MAX_AGE);
                if (filtered.length === 0) {
                    guildTracker.delete(userId);
                } else {
                    guildTracker.set(userId, filtered);
                }
            }

            if (guildTracker.size === 0) {
                this.actionTracker.delete(guildId);
            }
        }

        
        for (const [guildId, breaches] of this.thresholdBreaches.entries()) {
            for (const [userId, data] of breaches.entries()) {
                if (now - data.timestamp > 10 * 60 * 1000) {
                    breaches.delete(userId);
                }
            }
        }
    }
}

module.exports = AntiNukeModule;
