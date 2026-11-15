'use strict';

const { MessageFlags } = require('discord.js');
const { cards } = require('./cards');

const DEFAULT_TTL = 10 * 60 * 1000; 
const sessionManagers = new Set();

function createSessionManager(options = {}) {
    const ttl = options.ttl || options.ttlMs || DEFAULT_TTL;
    const onExpire = typeof options.onExpire === 'function' ? options.onExpire : (typeof options.buildExpiredCard === 'function' ? options.buildExpiredCard : null);
    const store = new Map();

    function _scheduleExpiry(client, channelId, messageId, state, extra = {}) {
        const timer = setTimeout(async () => {
            store.delete(messageId);
            try {
                const channel = client.channels.cache.get(channelId) || await client.channels.fetch(channelId).catch(() => null);
                if (!channel) return;

                const message = await channel.messages.fetch(messageId).catch(() => null);
                if (!message) return;

                const sessionObj = { client, channelId, messageId, state, ...extra };
                let expiredCard = null;
                if (onExpire) {
                    try {
                        expiredCard = await onExpire(state, sessionObj, client);
                        if (!expiredCard) {
                            expiredCard = await onExpire(sessionObj, client);
                        }
                    } catch (_) {}
                }
                if (!expiredCard) {
                    expiredCard = cards.expired();
                }

                if (expiredCard && typeof expiredCard === 'object') {
                    await message.edit({
                        components: [expiredCard],
                        flags: MessageFlags.IsComponentsV2,
                    }).catch(() => {});
                }

                setTimeout(() => {
                    message.delete().catch(() => {});
                }, 3000);
            } catch (_) {
                
            }
        }, ttl);

        if (timer.unref) timer.unref();
        return timer;
    }

    const manager = {
        

        open(client, channelId, messageId, state, extra = {}) {
            const prev = store.get(messageId);
            if (prev?.timer) clearTimeout(prev.timer);

            const timer = _scheduleExpiry(client, channelId, messageId, state, extra);
            const entry = {
                state,
                timer,
                channelId,
                messageId,
                client,
                userId: extra.userId || state?.userId,
                guildId: extra.guildId || state?.guildId,
                ...extra
            };
            store.set(messageId, entry);
            return entry;
        },

        set(first, second, third, fourth, fifth) {
            if (first?.channels || first?.user) {
                return this.open(first, second, third, fourth, fifth);
            }
            if (typeof second === 'object' && second !== null && (second.client || second.channelId || second.userId || second.state)) {
                const messageId = first;
                const client = second.client || third;
                const channelId = second.channelId || fourth;
                const state = second.state !== undefined ? second.state : second;
                const extra = { ...second };
                delete extra.client;
                delete extra.channelId;
                delete extra.messageId;
                delete extra.state;
                if (typeof fifth === 'object') Object.assign(extra, fifth);
                return this.open(client, channelId, messageId, state, extra);
            }
            const messageId = first;
            const state = second;
            const client = third;
            const channelId = fourth;
            const extra = typeof fifth === 'object' ? fifth : { guildId: fifth };
            return this.open(client, channelId, messageId, state, extra);
        },

        touch(first, second, third) {
            const messageId = third || (typeof first === 'string' ? first : null);
            const entry = store.get(messageId);
            if (!entry) return null;

            if (entry.timer) clearTimeout(entry.timer);
            const client = entry.client || (first?.channels ? first : null);
            const channelId = entry.channelId || second;
            entry.timer = _scheduleExpiry(client, channelId, messageId, entry.state, entry);
            return entry;
        },

        get(messageId) {
            const entry = store.get(messageId);
            if (!entry) return null;
            if (!entry.userId && entry.state?.userId) {
                entry.userId = entry.state.userId;
            }
            if (!entry.guildId && entry.state?.guildId) {
                entry.guildId = entry.state.guildId;
            }
            return entry;
        },

        has(messageId) {
            return store.has(messageId);
        },

        close(messageId) {
            const entry = store.get(messageId);
            if (entry) {
                if (entry.timer) clearTimeout(entry.timer);
                store.delete(messageId);
            }
        },

        delete(messageId) {
            this.close(messageId);
        },

        clear() {
            for (const [, entry] of store) {
                if (entry?.timer) clearTimeout(entry.timer);
            }
            store.clear();
        },

        get size() {
            return store.size;
        },
    };
    sessionManagers.add(manager);
    return manager;
}

function clearAllSessionManagers() {
    for (const manager of sessionManagers) manager.clear();
}

module.exports = { createSessionManager, clearAllSessionManagers, DEFAULT_TTL };
