'use strict';

const { MessageFlags } = require('discord.js');

function payloadIsEphemeral(payload) {
    if (payload?.ephemeral === true) return true;
    const flags = Number(payload?.flags);
    return Number.isFinite(flags) && (flags & MessageFlags.Ephemeral) === MessageFlags.Ephemeral;
}

function asEphemeralPayload(payload) {
    const normalized = typeof payload === 'string' ? { content: payload } : { ...(payload || {}) };
    normalized.flags = (Number(normalized.flags) || 0) | MessageFlags.Ephemeral;
    return normalized;
}

function getRemainingAcknowledgementDelay(interaction, targetDelayMs = 2000, now = Date.now()) {
    const createdAt = Number(interaction?.createdTimestamp);
    const elapsedMs = Number.isFinite(createdAt) ? Math.max(0, now - createdAt) : 0;
    return Math.max(0, targetDelayMs - elapsedMs);
}

function installInteractionAutoDefer(interaction, {
    delayMs = 2500,
    onAutoDefer = () => {},
    onError = error => console.error('[InteractionAck] Automatic defer failed:', error)
} = {}) {
    const original = {
        reply: interaction.reply.bind(interaction),
        deferReply: interaction.deferReply.bind(interaction),
        showModal: interaction.showModal?.bind(interaction),
        editReply: interaction.editReply.bind(interaction),
        followUp: interaction.followUp.bind(interaction),
        fetchReply: interaction.fetchReply?.bind(interaction),
        deleteReply: interaction.deleteReply?.bind(interaction)
    };

    let hasResponded = false;
    let autoDeferred = false;
    let autoDeferPending = null;
    let desiredEphemeral = false;
    let privateReplacement = null;
    let timeout = null;

    const clearTimer = () => {
        if (timeout) clearTimeout(timeout);
        timeout = null;
    };

    const waitForAutoDefer = async () => {
        if (autoDeferPending) await autoDeferPending;
    };

    const retirePublicPlaceholder = async () => {
        if (original.deleteReply) await original.deleteReply().catch(() => {});
    };

    const sendPrivateReplacement = async payload => {
        if (privateReplacement?.edit) return privateReplacement.edit(payload);
        privateReplacement = await original.followUp(asEphemeralPayload(payload));
        await retirePublicPlaceholder();
        return privateReplacement;
    };

    interaction.reply = async (...args) => {
        hasResponded = true;
        clearTimer();
        await waitForAutoDefer();
        if (!autoDeferred) return original.reply(...args);

        const payload = args[0];
        if (payloadIsEphemeral(payload)) {
            desiredEphemeral = true;
            return sendPrivateReplacement(payload);
        }
        return original.editReply(payload);
    };

    interaction.deferReply = async (...args) => {
        hasResponded = true;
        clearTimer();
        await waitForAutoDefer();
        if (!autoDeferred) return original.deferReply(...args);
        desiredEphemeral = payloadIsEphemeral(args[0]);
        return undefined;
    };

    interaction.editReply = async payload => {
        await waitForAutoDefer();
        if (autoDeferred && (desiredEphemeral || payloadIsEphemeral(payload))) {
            desiredEphemeral = true;
            return sendPrivateReplacement(payload);
        }
        return original.editReply(payload);
    };

    if (original.showModal) {
        interaction.showModal = async (...args) => {
            hasResponded = true;
            clearTimer();
            await waitForAutoDefer();
            if (!autoDeferred) return original.showModal(...args);
            desiredEphemeral = true;
            const response = await sendPrivateReplacement({
                content: 'This form took too long to open. Please run the command again.'
            });
            return response;
        };
    }

    if (original.fetchReply) {
        interaction.fetchReply = async (...args) => {
            if (privateReplacement) return privateReplacement;
            await waitForAutoDefer();
            return original.fetchReply(...args);
        };
    }

    if (original.deleteReply) {
        interaction.deleteReply = async (...args) => {
            const privateMessage = privateReplacement;
            privateReplacement = null;
            if (privateMessage?.delete) await privateMessage.delete().catch(() => {});
            return original.deleteReply(...args);
        };
    }

    timeout = setTimeout(() => {
        if (hasResponded || interaction.replied || interaction.deferred) return;
        hasResponded = true;
        autoDeferPending = Promise.resolve()
            .then(() => original.deferReply())
            .then(() => {
                autoDeferred = true;
                onAutoDefer();
            })
            .catch(onError)
            .finally(() => {
                autoDeferPending = null;
            });
    }, delayMs);

    return {
        restore() {
            clearTimer();
            interaction.reply = original.reply;
            interaction.deferReply = original.deferReply;
            interaction.editReply = original.editReply;
            if (original.showModal) interaction.showModal = original.showModal;
            if (original.fetchReply) interaction.fetchReply = original.fetchReply;
            if (original.deleteReply) interaction.deleteReply = original.deleteReply;
        },
        get state() {
            return { hasResponded, autoDeferred, desiredEphemeral, hasPrivateReplacement: Boolean(privateReplacement) };
        }
    };
}

module.exports = {
    installInteractionAutoDefer,
    payloadIsEphemeral,
    asEphemeralPayload,
    getRemainingAcknowledgementDelay
};
