'use strict';

const config = require('../../config.js');

const { EMOJIS, REDWHITE_CUSTOMS, SERVER_EMOJIS } = require('./emojiData');

function useCustomEmoji() {
    return config.customEmoji !== false;
}

function getTheme() {
    const theme = config.emojiTheme || 'redwhite';
    return String(theme).toLowerCase();
}

const UNICODE_TO_KEY = Object.freeze({
    
    '❌': 'cross',
    '✖️': 'cross',
    '✖': 'cross',
    '❎': 'cross',
    '🚫': 'cross',
    '⛔': 'cross',
    '✅': 'tick',
    '✔️': 'tick',
    '✔': 'tick',
    '☑️': 'tick',
    '☑': 'tick',
    '⚠️': 'warning',
    '⚠': 'warning',
    '🚨': 'warning',

    
    '📊': 'analytics',
    '📈': 'trend',
    '📉': 'trend',

    
    '💡': 'sparkles',
    '✨': 'sparkles',
    '🪄': 'sparkles',
    '⭐': 'star',
    '🌟': 'star',
    '💎': 'sparkles',

    
    '📋': 'list',
    '📝': 'document',
    '📄': 'document',
    '📑': 'document',
    '📜': 'document',
    '📁': 'folder',
    '📂': 'sfolder1',
    '🗄️': 'database',
    '🗄': 'database',

    
    '⚙️': 'settings',
    '⚙': 'settings',
    '🛠️': 'settings',
    '🛠': 'settings',
    '🔧': 'settings',
    '✏️': 'settings',
    '✏': 'settings',

    
    '🌐': 'world',
    '🌍': 'world',
    '🌎': 'world',
    '🌏': 'world',
    '🔗': 'world',
    '📶': 'world',
    '🌤️': 'world',
    '☀️': 'world',
    '⛅': 'world',

    
    '💰': 'cart',
    '💵': 'cart',
    '💸': 'cart',
    '💳': 'cart',
    '🛒': 'cart',
    '🛍️': 'cart',
    '🛍': 'cart',
    '🪙': 'medal',
    '🏦': 'home',
    '🏠': 'home',
    '🏛️': 'home',
    '🏛': 'home',
    '🏢': 'home',

    
    '🏆': 'crown',
    '👑': 'crown',
    '🥇': 'medal',
    '🥈': 'medal',
    '🥉': 'medal',
    '🏅': 'medal',
    '🎖️': 'medal',
    '🎖': 'medal',
    '🎁': 'gift',
    '📦': 'box',

    
    '🗑️': 'delete',
    '🗑': 'delete',
    '➕': 'tick',

    
    '🔒': 'lock',
    '🔓': 'lock',
    '🔐': 'lock',
    '🔏': 'lock',
    '🔑': 'lock',
    '🛡️': 'security',
    '🛡': 'security',

    
    '👥': 'groupusers',
    '👨‍👩‍👧‍👦': 'groupusers',
    '👪': 'groupusers',
    '👤': 'user',
    '❤️': 'heart',
    '❤': 'heart',
    '💖': 'heart',
    '💗': 'heart',
    '💓': 'heart',
    '💕': 'heart',
    '💘': 'heart',
    '💝': 'heart',
    '🙂': 'smile',
    '😊': 'smile',
    '😀': 'smile',

    
    '🎮': 'games',
    '🎲': 'games',
    '🎰': 'games',
    '🕹️': 'games',
    '🕹': 'games',
    '🎬': 'games',
    '🤖': 'bot',
    '🖥️': 'bot',
    '💻': 'bot',
    '🚀': 'rocket',
    '🎯': 'rocket',
    '🎨': 'sparkles',
    '🔥': 'fire',
    '⚡': 'fire',
    '🔞': 'nsfw',

    
    '🎵': 'music',
    '🎶': 'music',
    '🎧': 'music',
    '💿': 'music',
    '📀': 'music',
    '🎼': 'music',
    '🎙️': 'mic',
    '🎙': 'mic',
    '🎤': 'mic',
    '🔊': 'volume_high',
    '🔉': 'volume_low',
    '🔈': 'volume_low',
    '🔇': 'mute',

    
    '⏰': 'time',
    '⏱️': 'time',
    '⏱': 'time',
    '⏳': 'time',
    '⌛': 'time',
    '📅': 'calendar',
    '📆': 'calendar',

    
    '💬': 'chat',
    '🗨️': 'chat',
    '🗨': 'chat',
    '❓': 'help',
    '❔': 'help',
    'ℹ️': 'help',
    'ℹ': 'help',

    
    '🔁': 'loop',
    '🔄': 'loop',
    '🔀': 'loop',
    '◀️': 'arrleft',
    '◀': 'arrleft',
    '⬅️': 'arrleft',
    '⬅': 'arrleft',
    '▶️': 'play',
    '▶': 'play',
    '➡️': 'arrright',
    '➡': 'arrright',
    '⏮️': 'previoussong',
    '⏮': 'previoussong',
    '⏭️': 'nextsong',
    '⏭': 'nextsong',
    '⏸️': 'pause',
    '⏸': 'pause',
    '⏹️': 'stop',
    '⏹': 'stop',
    '🔴': 'stop',

    
    '🟢': 'tick',
    '🔵': 'analytics',
    '🟣': 'star',
    '🟡': 'warning',
    '⚪': 'box',
    '⚫': 'box',
    '🔹': 'star',
    '🔶': 'star',

    
    '🔫': 'security',
    '⚔️': 'security',
    '⚔': 'security',
    '⚖️': 'security',
    '⚖': 'security',
    '🚔': 'security',
    '💊': 'security',
    '💀': 'cross',
    '🐟': 'games',
    '🎣': 'games',
    '🪱': 'games',
    '🌾': 'box',
    '🌱': 'sparkles',
    '🍀': 'sparkles',
    '❄️': 'sparkles',
    '❄': 'sparkles',
    '🔮': 'sparkles',
    '💥': 'fire',
    '🚗': 'rocket',
    '🏎️': 'rocket',
    '🏎': 'rocket',
    '🏁': 'rocket',
    '⛽': 'rocket',
    '🏡': 'home',
    '🏘️': 'home',
    '🏘': 'home',
    '🏥': 'home',
    '🍽️': 'home',
    '🍽': 'home',
    '🏪': 'home',
    '🏭': 'home',
    '👨': 'user',
    '👩': 'user',
    '👧': 'user',
    '👦': 'user',
    '🐾': 'heart',
    '🐕': 'heart',
    '💚': 'heart',
    '💞': 'heart',
    '🤝': 'groupusers',
    '🏷️': 'document',
    '🏷': 'document',
    '📘': 'document',
    '💼': 'folder',
    '💾': 'database',
    '🧪': 'settings',
    '⛏️': 'settings',
    '⛏': 'settings',
    '🔔': 'settings',
    '💍': 'star',
    '🎒': 'cart',
    '👛': 'cart',
    '🥩': 'box',
    '🦌': 'heart',
    '⚱️': 'box',
    '⚱': 'box',
    '📺': 'games',
    '📸': 'games',
    '🎭': 'games',
    '🐦': 'chat',
    '🍒': 'games',
    '🍋': 'games',
    '🍊': 'games',
    '🍇': 'games',
    '7️⃣': 'games',
    '🏖️': 'world',
    '🏖': 'world',
    '🎡': 'world',
    '⛰️': 'world',
    '⛰': 'world',
    '🗽': 'world',
    '🏕️': 'world',
    '🏕': 'world',
    '🎉': 'gift',
    '🎪': 'world',
    '😅': 'smile',
    '😰': 'smile'
});

const KEY_ALIASES = Object.freeze({
    bell: 'time',
    notify: 'time',
    reminder: 'time',
    clock: 'time',
    note: 'chat',
    message: 'chat',
    reafk: 'loop',
    welcome: 'heart',
    giveaway: 'gift',
    tada: 'gift',
    prize: 'gift',
    winner: 'crown',
    party: 'sparkles',
    entries: 'groupusers',
    participants: 'groupusers',
    report: 'warning',
    claim: 'user',
    resolve: 'tick',
    escalate: 'warning',
    dismiss: 'cross',
    timeout: 'time',
    ban: 'security',
    modmail: 'chat',
    reply: 'chat',
    anon: 'user',
    staff: 'security',
    priority: 'fire',
    streak: 'fire'
});


const UNICODE_PATTERN = new RegExp(
    Object.keys(UNICODE_TO_KEY)
        .sort((a, b) => b.length - a.length)
        .map(e => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|'),
    'gu'
);

function parseRawCustomEmoji(raw) {
    if (typeof raw !== 'string') return null;
    const match = raw.trim().match(/^<a?:(\w+):(\d+)>$/);
    if (!match) return null;

    return {
        name: match[1],
        id: match[2]
    };
}

function resolveCustomEntry(entry) {
    if (!entry) return null;

    if (typeof entry.custom === 'string' && entry.custom.trim()) {
        return { raw: entry.custom.trim() };
    }

    if (entry.custom && typeof entry.custom === 'object') {
        const themed = entry.custom[getTheme()] || entry.custom.redwhite || entry.custom.default;
        if (typeof themed === 'string' && themed.trim()) {
            return { raw: themed.trim() };
        }

        if (themed && themed.name && themed.id) {
            return { name: themed.name, id: themed.id, animated: Boolean(themed.animated) };
        }
    }

    if (entry.name && entry.id) {
        return { name: entry.name, id: entry.id, animated: Boolean(entry.animated) };
    }

    if (entry.customName && entry.customId) {
        return { name: entry.customName, id: entry.customId };
    }

    return null;
}

function buildCustomEmoji(entry) {
    const custom = resolveCustomEntry(entry);
    if (!custom) return null;

    if (custom.raw) return custom.raw;
    if (custom.name && custom.id) {
        const prefix = custom.animated ? '<a:' : '<:';
        return `${prefix}${custom.name}:${custom.id}>`;
    }

    return null;
}

function getEmoji(key, fallback = '') {
    if (!key) return fallback || '';

    
    if (typeof key === 'object') {
        if (key.emojiKey) return getEmoji(key.emojiKey, fallback);
        if (key.name && key.id) {
            const prefix = key.animated ? '<a:' : '<:';
            return `${prefix}${key.name}:${key.id}>`;
        }
        if (key.id) return `<:emoji:${key.id}>`;
        return fallback || '';
    }

    let lookupKey = String(key).trim();
    if (!lookupKey) return fallback || '';

    
    if (/^<a?:[a-zA-Z0-9_]+:\d+>$/.test(lookupKey)) {
        return lookupKey;
    }

    
    if (KEY_ALIASES[lookupKey]) {
        lookupKey = KEY_ALIASES[lookupKey];
    }
    if (UNICODE_TO_KEY[lookupKey]) {
        lookupKey = UNICODE_TO_KEY[lookupKey];
    }
    if (KEY_ALIASES[lookupKey]) {
        lookupKey = KEY_ALIASES[lookupKey];
    }

    const entry = EMOJIS[lookupKey] || SERVER_EMOJIS[lookupKey];
    if (!entry) {
        
        if (/^[\p{Emoji}\u200d]+$/u.test(lookupKey)) {
            return lookupKey;
        }
        return fallback || '';
    }

    if (useCustomEmoji()) {
        const custom = buildCustomEmoji(entry);
        if (custom) return custom;
    }

    return entry.default || fallback || '';
}

function getButtonEmoji(key) {
    if (!key) return null;

    
    if (typeof key === 'object') {
        if (key.emojiKey) return getButtonEmoji(key.emojiKey);
        if (key.name && key.id) {
            return {
                name: key.name,
                id: key.id,
                animated: Boolean(key.animated)
            };
        }
        if (key.name) return key.name;
        return null;
    }

    let lookupKey = String(key).trim();
    if (!lookupKey) return null;

    
    if (/^<a?:[a-zA-Z0-9_]+:\d+>$/.test(lookupKey)) {
        const parsed = parseRawCustomEmoji(lookupKey);
        if (parsed) return parsed;
    }

    
    if (KEY_ALIASES[lookupKey]) {
        lookupKey = KEY_ALIASES[lookupKey];
    }
    if (UNICODE_TO_KEY[lookupKey]) {
        lookupKey = UNICODE_TO_KEY[lookupKey];
    }
    if (KEY_ALIASES[lookupKey]) {
        lookupKey = KEY_ALIASES[lookupKey];
    }

    const entry = EMOJIS[lookupKey] || SERVER_EMOJIS[lookupKey];
    if (!entry) {
        
        if (/^[\p{Emoji}\u200d]+$/u.test(lookupKey)) {
            return lookupKey;
        }
        return null;
    }

    if (useCustomEmoji()) {
        const custom = resolveCustomEntry(entry);
        if (custom?.name && custom?.id) {
            return {
                name: custom.name,
                id: custom.id,
                animated: Boolean(custom.animated)
            };
        }

        if (custom?.raw) {
            const parsed = parseRawCustomEmoji(custom.raw);
            if (parsed) return parsed;
        }
    }

    return entry.default || null;
}

function replaceWithCustomEmojis(text) {
    if (typeof text !== 'string' || !text) return text;
    if (!useCustomEmoji()) return text;

    return text.replace(UNICODE_PATTERN, match => {
        const key = UNICODE_TO_KEY[match];
        if (!key) return match;
        const custom = getEmoji(key);
        return custom || match;
    });
}

module.exports = {
    EMOJIS,
    REDWHITE_CUSTOMS,
    SERVER_EMOJIS,
    UNICODE_TO_KEY,
    getEmoji,
    getButtonEmoji,
    replaceWithCustomEmojis
};
