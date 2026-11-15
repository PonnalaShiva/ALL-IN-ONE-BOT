'use strict';

function createDashboardModalId(baseCustomId, messageId) {
    if (typeof baseCustomId !== 'string' || !baseCustomId.trim() || baseCustomId.length > 70 || baseCustomId.includes('__')) {
        throw new TypeError('Dashboard modal requires a valid base custom ID.');
    }
    if (!/^\d{17,20}$/.test(String(messageId || ''))) {
        throw new TypeError('Dashboard modal requires a valid message ID.');
    }
    return `${baseCustomId}__${messageId}`;
}

function parseDashboardModalId(customId) {
    if (typeof customId !== 'string') return null;
    const match = customId.match(/^(.{1,70})__(\d{17,20})$/);
    if (!match) return null;
    return { baseCustomId: match[1], messageId: match[2] };
}

function getDashboardSessionOwnerId(session) {
    const ownerId = session?.userId || session?.state?.userId;
    return typeof ownerId === 'string' && ownerId ? ownerId : null;
}

async function resolveDashboardMessage(interaction, session, messageId = session?.messageId) {
    if (interaction?.message && (!messageId || interaction.message.id === messageId)) {
        return interaction.message;
    }

    const client = session?.client || interaction?.client;
    const channelId = session?.channelId || interaction?.channelId;
    if (!client || !channelId || !messageId) return null;

    let channel = client.channels?.cache?.get(channelId) || null;
    if (!channel && typeof client.channels?.fetch === 'function') {
        channel = await client.channels.fetch(channelId).catch(() => null);
    }
    if (!channel?.messages?.fetch) return null;
    return channel.messages.fetch(messageId).catch(() => null);
}

module.exports = {
    createDashboardModalId,
    parseDashboardModalId,
    resolveDashboardMessage,
    getDashboardSessionOwnerId
};
