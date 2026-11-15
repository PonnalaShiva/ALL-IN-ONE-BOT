'use strict';

const { Message } = require('discord.js');

const collectorsByMessage = new Map();
const collectorClaims = new WeakMap();
const PATCHED = Symbol.for('aio.componentCollectorRegistry.patched');

function registerComponentCollector(message, collector) {
    const messageId = message?.id;
    if (!messageId || !collector || typeof collector.on !== 'function') return () => {};
    let collectors = collectorsByMessage.get(messageId);
    if (!collectors) collectorsByMessage.set(messageId, collectors = new Set());
    collectors.add(collector);
    let removed = false;
    const unregister = () => {
        if (removed) return;
        removed = true;
        const current = collectorsByMessage.get(messageId);
        current?.delete(collector);
        if (current && current.size === 0) collectorsByMessage.delete(messageId);
    };
    collector.once('end', unregister);
    return unregister;
}

function hasLiveComponentCollector(messageId, channelId) {
    if (!messageId) return false;
    const collectors = collectorsByMessage.get(String(messageId));
    if (!collectors?.size) return false;
    for (const collector of collectors) {
        if (collector.ended) continue;
        const collectedMessageId = collector.messageId || collector.message?.id || collector.options?.message?.id;
        const collectedChannelId = collector.channelId || collector.channel?.id || collector.message?.channelId || collector.options?.channel?.id;
        if (collectedMessageId && String(collectedMessageId) !== String(messageId)) continue;
        if (channelId && collectedChannelId && String(collectedChannelId) !== String(channelId)) continue;
        return true;
    }
    return false;
}

function getCollectorClaimStatus(interaction) {
    const status = interaction && collectorClaims.get(interaction);
    if (!status) return 'unknown';
    if (status.accepted) return 'accepted';
    if (status.pending > 0) return 'pending';
    if (status.rejected > 0) return 'rejected';
    return 'unknown';
}

function installComponentCollectorTracking(MessageClass = Message) {
    const prototype = MessageClass?.prototype;
    if (!prototype || typeof prototype.createMessageComponentCollector !== 'function' || prototype[PATCHED]) return false;
    const original = prototype.createMessageComponentCollector;
    Object.defineProperty(prototype, PATCHED, { value: true, configurable: false });
    prototype.createMessageComponentCollector = function trackedCreateMessageComponentCollector(...args) {
        const [options = {}, ...rest] = args;
        const originalFilter = options.filter;
        const wrappedOptions = {
            ...options,
            filter: async function trackedComponentFilter(interaction, ...filterArgs) {
                let status = collectorClaims.get(interaction);
                if (!status) collectorClaims.set(interaction, status = { pending: 0, accepted: false, rejected: 0 });
                status.pending++;
                try {
                    const accepted = originalFilter ? await originalFilter.call(this, interaction, ...filterArgs) : true;
                    status.pending--;
                    if (accepted) status.accepted = true;
                    else status.rejected++;
                    return accepted;
                } catch (error) {
                    status.pending--;
                    status.rejected++;
                    throw error;
                }
            }
        };
        const collector = original.apply(this, [wrappedOptions, ...rest]);
        registerComponentCollector(this, collector);
        return collector;
    };
    return true;
}

installComponentCollectorTracking();

module.exports = { registerComponentCollector, hasLiveComponentCollector, getCollectorClaimStatus, installComponentCollectorTracking };
