'use strict';

const { MessageFlags } = require('discord.js');
const { cards } = require('./cards');
const { replaceWithCustomEmojis } = require('../UI/emojis/emoji');

async function deferUpdate(interaction) {
    if (!interaction.deferred && !interaction.replied) {
        try {
            await interaction.deferUpdate();
            return true;
        } catch (err) {
            if (err.code === 10062 || err.code === 40060) return false;
            throw err;
        }
    }
    return true;
}

async function deferReply(interaction, ephemeral = false) {
    if (typeof interaction?.deferReply !== 'function') return false;
    if (!interaction.deferred && !interaction.replied) {
        try {
            await interaction.deferReply({
                flags: ephemeral ? MessageFlags.Ephemeral : undefined,
            });
            return true;
        } catch (err) {
            if (err.code === 10062 || err.code === 40060) return false;
            throw err;
        }
    }
    return true;
}

async function replyEphemeral(interaction, contentOrCard) {
    const isCard = typeof contentOrCard === 'object' && contentOrCard !== null;

    if (interaction.replied || interaction.deferred) {
        try {
            if (isCard) {
                return await interaction.followUp({
                    components: [contentOrCard],
                    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
                });
            }
            return await interaction.followUp({
                content: replaceWithCustomEmojis(String(contentOrCard)),
                flags: MessageFlags.Ephemeral,
            });
        } catch (_) {
            return null;
        }
    }

    try {
        if (!isCard) {
            return await interaction.reply({
                content: replaceWithCustomEmojis(String(contentOrCard)),
                flags: MessageFlags.Ephemeral,
            });
        }
        
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        return await interaction.editReply({
            components: [contentOrCard],
            flags: MessageFlags.IsComponentsV2,
        });
    } catch (_) {
        return null;
    }
}

function normalizeComponents(raw) {
    
    if (raw && typeof raw === 'object' && !Array.isArray(raw) && raw.card) {
        const { card, rows, row } = raw;
        const actionRows = rows ?? (row ? [row] : []);
        if (actionRows.length > 0 && typeof card.addRow === 'function') {
            card.addRow(...actionRows);
        }
        return [card];
    }
    
    if (Array.isArray(raw)) return raw;
    
    return [raw];
}

async function sendV2(interaction, components, files = []) {
    let comps = normalizeComponents(components);
    
    comps = comps.filter(c => {
        if (!c) return false;
        const type = c.data?.type ?? c.type;
        return type !== 14 && type !== 10;
    });

    const isOptionsObj = typeof files === 'object' && files !== null && !Array.isArray(files);
    const options = isOptionsObj ? files : {};
    const actualFiles = Array.isArray(files) ? files : (Array.isArray(options.files) ? options.files : []);
    const isEphemeral = Boolean(options.ephemeral || options.flags === MessageFlags.Ephemeral);

    let flags = MessageFlags.IsComponentsV2;
    if (isEphemeral) {
        flags |= MessageFlags.Ephemeral;
    }

    const payload = {
        components: comps,
        files: actualFiles,
        flags,
    };

    
    if (typeof interaction?.deferReply !== 'function') {
        if (interaction.responseMessage?.edit) {
            return await interaction.responseMessage.edit(payload);
        }
        if (typeof interaction?.reply === 'function') {
            const msg = await interaction.reply(payload);
            interaction.responseMessage = msg;
            return msg;
        }
        if (typeof interaction?.send === 'function') {
            return await interaction.send(payload);
        }
    }

    if (interaction.deferred || interaction.replied) {
        return await interaction.editReply(payload);
    }

    await deferReply(interaction, isEphemeral);
    return await interaction.editReply(payload);
}

async function editV2(interaction, components, files = []) {
    let comps = normalizeComponents(components);
    
    comps = comps.filter(c => {
        if (!c) return false;
        const type = c.data?.type ?? c.type;
        return type !== 14 && type !== 10;
    });

    const payload = {
        components: comps,
        files: Array.isArray(files) ? files : [],
        flags: MessageFlags.IsComponentsV2,
    };

    let resultMsg = null;

    if (interaction?.responseMessage?.edit) {
        resultMsg = await interaction.responseMessage.edit(payload);
    } else if (interaction?.message?.edit) {
        resultMsg = await interaction.message.edit(payload);
    } else if (typeof interaction?.editReply === 'function') {
        resultMsg = await interaction.editReply(payload);
    } else if (typeof interaction?.edit === 'function') {
        resultMsg = await interaction.edit(payload);
    } else if (typeof interaction?.reply === 'function') {
        resultMsg = await interaction.reply(payload);
    }

    
    const rawOptions = (typeof files === 'object' && !Array.isArray(files)) ? files : {};
    let autoDeleteMs = rawOptions.autoDeleteMs ?? rawOptions.autoDelete;

    if (autoDeleteMs === undefined && components && typeof components === 'object') {
        autoDeleteMs = components.autoDeleteMs ?? components.autoDelete;
    }

    if (autoDeleteMs === undefined) {
        
        const isClosedOrExpired = comps.some(c => {
            if (c._isTerminalSessionCard) return true;
            try {
                const jsonStr = JSON.stringify(typeof c.toJSON === 'function' ? c.toJSON() : c);
                return /closed|expired/i.test(jsonStr);
            } catch {
                return false;
            }
        });
        if (isClosedOrExpired) {
            autoDeleteMs = 3000;
        }
    }

    if (typeof autoDeleteMs === 'number' && autoDeleteMs > 0) {
        setTimeout(() => {
            const msg = resultMsg || interaction?.message || (typeof interaction?.delete === 'function' ? interaction : null);
            msg?.delete?.().catch(() => { });
        }, autoDeleteMs);
    }

    return resultMsg || interaction;
}

const { getEmoji } = require('../UI/emojis/emoji');

function chunkText(text, maxLen = 1800) {
    if (!text || text.length <= maxLen) return [text || ''];

    const chunks = [];
    let remaining = text;

    while (remaining.length > maxLen) {
        let cutAt = -1;

        
        const paraBreak = remaining.lastIndexOf('\n\n', maxLen);
        if (paraBreak > 0) {
            cutAt = paraBreak;
        } else {
            
            const lineBreak = remaining.lastIndexOf('\n', maxLen);
            if (lineBreak > 0) {
                cutAt = lineBreak;
            } else {
                
                cutAt = maxLen;
            }
        }

        chunks.push(remaining.slice(0, cutAt).trim());
        remaining = remaining.slice(cutAt).trim();
    }

    if (remaining.length > 0) chunks.push(remaining.trim());
    return chunks.filter(Boolean);
}

async function sendLongV2(interaction, cardBuilder, fullText, maxLen = 1800, delayMs = 600) {
    const chunks = chunkText(fullText, maxLen);
    const total = chunks.length;

    for (let i = 0; i < chunks.length; i++) {
        const card = cardBuilder(chunks[i], i + 1, total);
        const comps = Array.isArray(card) ? card : [card];
        const payload = { components: comps, flags: MessageFlags.IsComponentsV2 };

        if (i === 0) {
            
            await sendV2(interaction, card);
        } else {
            
            if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));

            if (typeof interaction?.followUp === 'function') {
                await interaction.followUp(payload).catch(() => { });
            } else if (typeof interaction?.reply === 'function') {
                
                await interaction.reply(payload).catch(() => { });
            }
        }
    }
}

async function replyUnauthorized(interaction, ownerId, commandName) {
    if (typeof ownerId === 'string' && (ownerId.includes(' ') || ownerId.length > 25)) {
        return replyEphemeral(interaction, ownerId);
    }
    const mention = ownerId ? `<@${ownerId}>` : 'another user';
    const cmd = commandName ? ` \`/${commandName}\`` : '';
    const msg = `${getEmoji('cross') || '❌'} This panel belongs to ${mention}. Run${cmd} to open your own panel!`;
    return replyEphemeral(interaction, msg);
}

async function closeAndAutoDelete(interaction, closedCard = null, delayMs = 3000) {
    if (interaction?.deferUpdate && !interaction.deferred && !interaction.replied) {
        await deferUpdate(interaction).catch(() => { });
    }
    const card = closedCard || cards.closed();
    const resultMsg = await editV2(interaction, card, { autoDeleteMs: delayMs }).catch(() => { });
    setTimeout(() => {
        if (typeof interaction?.deleteReply === 'function') {
            interaction.deleteReply().catch(() => { });
        }
        if (interaction?.message && typeof interaction.message.delete === 'function') {
            interaction.message.delete().catch(() => { });
        }
        if (typeof interaction?.delete === 'function') {
            interaction.delete().catch(() => { });
        }
        if (resultMsg && typeof resultMsg.delete === 'function') {
            resultMsg.delete().catch(() => { });
        }
    }, delayMs);
    return resultMsg;
}

async function sendWithCloseCollector(target, payload, ownerId = null, options = {}) {
    const sentMessage = await sendV2(target, payload);
    if (!sentMessage || typeof sentMessage.createMessageComponentCollector !== 'function') {
        return sentMessage;
    }
    const timeoutMs = options.time || 60000;
    const collector = sentMessage.createMessageComponentCollector({ time: timeoutMs });

    collector.on('collect', async (i) => {
        if (ownerId && i.user.id !== ownerId) {
            return replyUnauthorized(i, ownerId);
        }
        if (typeof options.onCollect === 'function') {
            const handled = await options.onCollect(i, collector);
            if (handled) return;
        }
        const cid = i.customId || '';
        if (cid === 'close' || cid.endsWith('_close') || cid.startsWith('close_')) {
            collector.stop('user_closed');
            return closeAndAutoDelete(i);
        }
    });

    collector.on('end', (_, reason) => {
        if (reason === 'time') {
            editV2(sentMessage, { card: cards.info('Session Expired', 'This session has timed out.'), rows: [] }).catch(() => { });
        }
    });

    return sentMessage;
}

function chunkArray(arr, size) {
    if (!Array.isArray(arr) || size <= 0) return [];
    return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
        arr.slice(i * size, i * size + size)
    );
}

module.exports = {
    chunkArray,
    deferUpdate,
    deferReply,
    replyEphemeral,
    sendV2,
    editV2,
    replyUnauthorized,
    closeAndAutoDelete,
    sendWithCloseCollector,
    chunkText,
    sendLongV2,
};
