

const { EventEmitter } = require('events');

const ACTION_TYPES = {
    DELETE_MESSAGE: 'delete_message',
    TIMEOUT_USER: 'timeout_user',
    KICK_USER: 'kick_user',
    BAN_USER: 'ban_user',
    QUARANTINE_USER: 'quarantine_user',
    UNBAN_USER: 'unban_user',
    UNQUARANTINE_USER: 'unquarantine_user',
    SEND_WARNING: 'send_warning',
    SEND_LOG: 'send_log',
    LOCK_CHANNEL: 'lock_channel',
    UNLOCK_CHANNEL: 'unlock_channel',
    DELETE_CHANNEL: 'delete_channel', 
    DELETE_ROLE: 'delete_role',       
    RESTORE_ROLES: 'restore_roles',
    SERVER_LOCKDOWN: 'server_lockdown',
    SERVER_UNLOCK: 'server_unlock'
};

const PRIORITY = {
    CRITICAL: 0,    
    HIGH: 1,        
    MEDIUM: 2,      
    LOW: 3,         
    BACKGROUND: 4   
};

class ActionQueue extends EventEmitter {
    constructor(client, config = {}) {
        super();
        this.client = client;

        
        this.config = {
            maxActionsPerMinute: config.maxActionsPerMinute || 15,
            burstAllowed: config.burstAllowed || 5,
            cooldownMs: config.cooldownMs || 500,
            queueOverflowBehavior: config.queueOverflowBehavior || 'escalate', 
            maxQueueSize: config.maxQueueSize || 100,
            enableUndo: config.enableUndo !== false,
            undoTimeLimit: config.undoTimeLimit || 3600000, 
            dryRun: config.dryRun || false,
            logActions: config.logActions !== false
        };

        
        this.queue = [];                    
        this.processing = false;
        this.actionHistory = new Map();     
        this.rateLimitState = new Map();    
        this.undoStack = new Map();         

        
        this.stats = {
            totalQueued: 0,
            totalExecuted: 0,
            totalDropped: 0,
            totalFailed: 0,
            totalUndone: 0,
            byType: {},
            byGuild: new Map()
        };

        
        this._startCleanup();
    }

    async enqueue(action) {
        const {
            type,
            guildId,
            targetId,
            executorId,
            reason,
            data = {},
            priority = PRIORITY.MEDIUM,
            module = 'system',
            skipRateLimit = false,
            undoData = null
        } = action;

        
        const actionId = `${guildId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const queuedAction = {
            id: actionId,
            type,
            guildId,
            targetId,
            executorId,
            reason,
            data,
            priority,
            module,
            skipRateLimit,
            undoData,
            queuedAt: Date.now(),
            status: 'queued',
            retries: 0,
            maxRetries: 3
        };

        
        if (this.queue.length >= this.config.maxQueueSize) {
            return this._handleOverflow(queuedAction);
        }

        
        this._insertSorted(queuedAction);
        this.stats.totalQueued++;

        
        this.stats.byType[type] = (this.stats.byType[type] || 0) + 1;

        this.emit('actionQueued', queuedAction);

        
        if (!this.processing) {
            this._processQueue();
        }

        return actionId;
    }

    async enqueueMany(actions) {
        const ids = [];
        for (const action of actions) {
            ids.push(await this.enqueue(action));
        }
        return ids;
    }

    _insertSorted(action) {
        let inserted = false;
        for (let i = 0; i < this.queue.length; i++) {
            if (action.priority < this.queue[i].priority) {
                this.queue.splice(i, 0, action);
                inserted = true;
                break;
            }
        }
        if (!inserted) {
            this.queue.push(action);
        }
    }

    _handleOverflow(action) {
        switch (this.config.queueOverflowBehavior) {
            case 'escalate':
                
                this.emit('overflow', { action, behavior: 'escalate' });
                return this._executeImmediate(action);

            case 'drop':
                
                this.stats.totalDropped++;
                this.emit('actionDropped', action);

                
                const lowest = this.queue.pop();
                if (lowest) {
                    this.emit('actionDropped', lowest);
                }

                this._insertSorted(action);
                return action.id;

            case 'delay':
            default:
                
                return new Promise((resolve) => {
                    const checkInterval = setInterval(() => {
                        if (this.queue.length < this.config.maxQueueSize) {
                            clearInterval(checkInterval);
                            this._insertSorted(action);
                            resolve(action.id);
                        }
                    }, 100);
                });
        }
    }

    async _processQueue() {
        if (this.processing || this.queue.length === 0) return;

        this.processing = true;

        while (this.queue.length > 0) {
            const action = this.queue.shift();

            
            if (!action.skipRateLimit && this._isRateLimited(action.guildId)) {
                
                action.retries++;
                if (action.retries < action.maxRetries) {
                    await this._delay(this.config.cooldownMs);
                    this._insertSorted(action);
                    continue;
                } else {
                    this.emit('actionRateLimited', action);
                    this.stats.totalDropped++;
                    continue;
                }
            }

            
            try {
                const result = await this._executeAction(action);
                action.status = 'completed';
                action.result = result;
                action.completedAt = Date.now();

                this.stats.totalExecuted++;
                this._trackAction(action);

                
                if (this.config.enableUndo && action.undoData) {
                    this._storeUndoData(action);
                }

                this.emit('actionCompleted', action);

            } catch (error) {
                action.status = 'failed';
                action.error = error.message;
                action.retries++;

                if (action.retries < action.maxRetries) {
                    
                    await this._delay(this.config.cooldownMs * action.retries);
                    this._insertSorted(action);
                } else {
                    this.stats.totalFailed++;
                    this.emit('actionFailed', action);
                }
            }

            
            await this._delay(this.config.cooldownMs);
        }

        this.processing = false;
    }

    _isRateLimited(guildId) {
        const state = this.rateLimitState.get(guildId);
        const now = Date.now();

        if (!state || now > state.resetTime) {
            
            this.rateLimitState.set(guildId, {
                count: 1,
                resetTime: now + 60000, 
                burstUsed: 0
            });
            return false;
        }

        
        if (state.burstUsed < this.config.burstAllowed) {
            state.burstUsed++;
            state.count++;
            return false;
        }

        
        if (state.count >= this.config.maxActionsPerMinute) {
            return true;
        }

        state.count++;
        return false;
    }

    async _executeAction(action) {
        const { type, guildId, targetId, data, reason } = action;

        
        if (this.config.dryRun) {
            console.log(`[DRY-RUN] Would execute: ${type} on ${targetId} in ${guildId}`);
            return { dryRun: true, action: type };
        }

        const guild = this.client.guilds.cache.get(guildId);
        if (!guild) throw new Error('Guild not found');

        switch (type) {
            case ACTION_TYPES.DELETE_MESSAGE:
                return await this._deleteMessage(data.channelId, data.messageId);

            case ACTION_TYPES.TIMEOUT_USER:
                return await this._timeoutUser(guild, targetId, data.duration, reason);

            case ACTION_TYPES.KICK_USER:
                return await this._kickUser(guild, targetId, reason);

            case ACTION_TYPES.BAN_USER:
                return await this._banUser(guild, targetId, reason, data.deleteMessageDays);

            case ACTION_TYPES.QUARANTINE_USER:
                return await this._quarantineUser(guild, targetId, reason, data);

            case ACTION_TYPES.UNBAN_USER:
                return await this._unbanUser(guild, targetId, reason);

            case ACTION_TYPES.UNQUARANTINE_USER:
                return await this._unquarantineUser(guild, targetId, data);

            case ACTION_TYPES.SEND_WARNING:
                return await this._sendWarning(guild, targetId, data.channelId, reason);

            case ACTION_TYPES.SEND_LOG:
                return await this._sendLog(guild, data.channelId, data.embed);

            case ACTION_TYPES.LOCK_CHANNEL:
                return await this._lockChannel(guild, targetId, reason);

            case ACTION_TYPES.UNLOCK_CHANNEL:
                return await this._unlockChannel(guild, targetId);

            case ACTION_TYPES.SERVER_LOCKDOWN:
                return await this._serverLockdown(guild, reason);

            case ACTION_TYPES.SERVER_UNLOCK:
                return await this._serverUnlock(guild);

            case ACTION_TYPES.RESTORE_ROLES:
                return await this._restoreRoles(guild, targetId, data.roles);

            default:
                throw new Error(`Unknown action type: ${type}`);
        }
    }

    async _executeImmediate(action) {
        try {
            const result = await this._executeAction(action);
            this.emit('actionCompleted', { ...action, result, immediate: true });
            return action.id;
        } catch (error) {
            this.emit('actionFailed', { ...action, error: error.message, immediate: true });
            return action.id;
        }
    }

    async _deleteMessage(channelId, messageId) {
        const channel = this.client.channels.cache.get(channelId);
        if (!channel) throw new Error('Channel not found');

        const message = await channel.messages.fetch(messageId).catch(() => null);
        if (message) {
            await message.delete();
            return { deleted: true };
        }
        return { deleted: false, reason: 'Message not found' };
    }

    async _timeoutUser(guild, userId, duration, reason) {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) throw new Error('Member not found');

        await member.timeout(duration, reason);
        return { timedOut: true, duration };
    }

    async _kickUser(guild, userId, reason) {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) throw new Error('Member not found');

        if (!member.kickable) throw new Error('Member not kickable');

        await member.kick(reason);
        return { kicked: true };
    }

    async _banUser(guild, userId, reason, deleteMessageDays = 0) {
        await guild.members.ban(userId, {
            reason,
            deleteMessageDays: Math.min(7, deleteMessageDays)
        });
        return { banned: true };
    }

    async _quarantineUser(guild, userId, reason, data) {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) throw new Error('Member not found');

        const { quarantineRoleId, originalRoles } = data;

        
        const currentRoles = member.roles.cache
            .filter(r => r.id !== guild.id && r.id !== quarantineRoleId)
            .map(r => r.id);

        
        await member.roles.set([quarantineRoleId]);

        return {
            quarantined: true,
            originalRoles: originalRoles || currentRoles
        };
    }

    async _unbanUser(guild, userId, reason) {
        await guild.members.unban(userId, reason);
        return { unbanned: true };
    }

    async _unquarantineUser(guild, userId, data) {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) throw new Error('Member not found');

        const { originalRoles, quarantineRoleId } = data;

        
        if (originalRoles && originalRoles.length > 0) {
            const validRoles = originalRoles.filter(id => guild.roles.cache.has(id));
            await member.roles.set(validRoles);
        } else {
            
            await member.roles.remove(quarantineRoleId);
        }

        return { unquarantined: true };
    }

    async _sendWarning(guild, userId, channelId, reason) {
        const channel = this.client.channels.cache.get(channelId);
        if (!channel) return { sent: false, reason: 'Channel not found' };

        const msg = await channel.send(`⚠️ <@${userId}>, warning: ${reason}`);

        
        setTimeout(() => msg.delete().catch(() => { }), 10000);

        return { sent: true };
    }

    async _sendLog(guild, channelId, embed) {
        const channel = this.client.channels.cache.get(channelId);
        if (!channel) return { sent: false, reason: 'Channel not found' };

        await channel.send({ embeds: [embed] });
        return { sent: true };
    }

    async _lockChannel(guild, channelId, reason) {
        const channel = guild.channels.cache.get(channelId);
        if (!channel) throw new Error('Channel not found');

        await channel.permissionOverwrites.edit(guild.roles.everyone, {
            SendMessages: false,
            AddReactions: false
        });

        return { locked: true };
    }

    async _unlockChannel(guild, channelId) {
        const channel = guild.channels.cache.get(channelId);
        if (!channel) throw new Error('Channel not found');

        await channel.permissionOverwrites.edit(guild.roles.everyone, {
            SendMessages: null,
            AddReactions: null
        });

        return { unlocked: true };
    }

    async _serverLockdown(guild, reason) {
        const results = { channels: 0, invites: 0 };

        
        for (const channel of guild.channels.cache.values()) {
            if (channel.isTextBased()) {
                try {
                    await channel.permissionOverwrites.edit(guild.roles.everyone, {
                        SendMessages: false,
                        AddReactions: false,
                        CreatePublicThreads: false,
                        CreatePrivateThreads: false
                    });
                    results.channels++;
                } catch (e) { }
            }
        }

        
        try {
            const invites = await guild.invites.fetch();
            for (const invite of invites.values()) {
                await invite.delete(reason);
                results.invites++;
            }
        } catch (e) { }

        return { lockdown: true, ...results };
    }

    async _serverUnlock(guild) {
        const results = { channels: 0 };

        for (const channel of guild.channels.cache.values()) {
            if (channel.isTextBased()) {
                try {
                    await channel.permissionOverwrites.edit(guild.roles.everyone, {
                        SendMessages: null,
                        AddReactions: null,
                        CreatePublicThreads: null,
                        CreatePrivateThreads: null
                    });
                    results.channels++;
                } catch (e) { }
            }
        }

        return { unlocked: true, ...results };
    }

    async _restoreRoles(guild, userId, roles) {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (!member) throw new Error('Member not found');

        const validRoles = roles.filter(id => guild.roles.cache.has(id));
        await member.roles.set(validRoles);

        return { restored: true, rolesRestored: validRoles.length };
    }

    _storeUndoData(action) {
        this.undoStack.set(action.id, {
            action,
            undoData: action.undoData,
            storedAt: Date.now(),
            expiresAt: Date.now() + this.config.undoTimeLimit
        });
    }

    async undo(actionId) {
        const undoEntry = this.undoStack.get(actionId);

        if (!undoEntry) {
            return { success: false, reason: 'Action not found or expired' };
        }

        if (Date.now() > undoEntry.expiresAt) {
            this.undoStack.delete(actionId);
            return { success: false, reason: 'Undo time limit expired' };
        }

        const { action, undoData } = undoEntry;

        try {
            
            const reverseAction = this._createReverseAction(action, undoData);

            if (reverseAction) {
                await this.enqueue({
                    ...reverseAction,
                    priority: PRIORITY.HIGH,
                    skipRateLimit: true,
                    reason: `Undo: ${action.reason || 'No reason'}`
                });

                this.undoStack.delete(actionId);
                this.stats.totalUndone++;

                return { success: true, reverseAction: reverseAction.type };
            }

            return { success: false, reason: 'Cannot create reverse action' };

        } catch (error) {
            return { success: false, reason: error.message };
        }
    }

    _createReverseAction(action, undoData) {
        const reverseMap = {
            [ACTION_TYPES.BAN_USER]: () => ({
                type: ACTION_TYPES.UNBAN_USER,
                guildId: action.guildId,
                targetId: action.targetId
            }),
            [ACTION_TYPES.QUARANTINE_USER]: () => ({
                type: ACTION_TYPES.UNQUARANTINE_USER,
                guildId: action.guildId,
                targetId: action.targetId,
                data: {
                    originalRoles: undoData.originalRoles,
                    quarantineRoleId: undoData.quarantineRoleId
                }
            }),
            [ACTION_TYPES.LOCK_CHANNEL]: () => ({
                type: ACTION_TYPES.UNLOCK_CHANNEL,
                guildId: action.guildId,
                targetId: action.targetId
            }),
            [ACTION_TYPES.SERVER_LOCKDOWN]: () => ({
                type: ACTION_TYPES.SERVER_UNLOCK,
                guildId: action.guildId
            }),
            [ACTION_TYPES.TIMEOUT_USER]: () => ({
                type: ACTION_TYPES.TIMEOUT_USER,
                guildId: action.guildId,
                targetId: action.targetId,
                data: { duration: null } 
            })
        };

        const creator = reverseMap[action.type];
        return creator ? creator() : null;
    }

    _trackAction(action) {
        const guildActions = this.actionHistory.get(action.guildId) || [];
        guildActions.push({
            id: action.id,
            type: action.type,
            targetId: action.targetId,
            module: action.module,
            timestamp: action.completedAt,
            reason: action.reason
        });

        
        if (guildActions.length > 100) {
            guildActions.shift();
        }

        this.actionHistory.set(action.guildId, guildActions);

        
        const guildStats = this.stats.byGuild.get(action.guildId) || { total: 0, byType: {} };
        guildStats.total++;
        guildStats.byType[action.type] = (guildStats.byType[action.type] || 0) + 1;
        this.stats.byGuild.set(action.guildId, guildStats);
    }

    getHistory(guildId, limit = 50) {
        const actions = this.actionHistory.get(guildId) || [];
        return actions.slice(-limit);
    }

    getStats(guildId = null) {
        if (guildId) {
            return {
                ...this.stats.byGuild.get(guildId),
                queueLength: this.queue.filter(a => a.guildId === guildId).length
            };
        }

        return {
            ...this.stats,
            queueLength: this.queue.length,
            processing: this.processing
        };
    }

    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    _startCleanup() {
        
        this._undoCleanupInterval = setInterval(() => {
            const now = Date.now();
            for (const [id, entry] of this.undoStack) {
                if (now > entry.expiresAt) {
                    this.undoStack.delete(id);
                }
            }
        }, 60000); 
        this._undoCleanupInterval.unref?.();

        
        this._rateLimitCleanupInterval = setInterval(() => {
            const now = Date.now();
            for (const [guildId, state] of this.rateLimitState) {
                if (now > state.resetTime) {
                    this.rateLimitState.delete(guildId);
                }
            }
        }, 60000);
        this._rateLimitCleanupInterval.unref?.();
    }

    destroy() {
        if (this._undoCleanupInterval) {
            clearInterval(this._undoCleanupInterval);
            this._undoCleanupInterval = null;
        }
        if (this._rateLimitCleanupInterval) {
            clearInterval(this._rateLimitCleanupInterval);
            this._rateLimitCleanupInterval = null;
        }
        this.queue = [];
        this.processing = false;
    }

    clearQueue(guildId = null) {
        if (guildId) {
            this.queue = this.queue.filter(a => a.guildId !== guildId);
        } else {
            this.queue = [];
        }
    }

    setDryRun(enabled) {
        this.config.dryRun = enabled;
    }

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }
}


let instance = null;

function getActionQueue(client, config = {}) {
    if (!instance && client) {
        instance = new ActionQueue(client, config);
    }
    return instance;
}

function destroyActionQueue() {
    if (!instance) return;
    instance.destroy();
    instance = null;
}

module.exports = {
    ActionQueue,
    getActionQueue,
    destroyActionQueue,
    ACTION_TYPES,
    PRIORITY
};
