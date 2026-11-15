'use strict';

const ACCENT = Object.freeze({
    primary:   0x5865F2,   
    success:   0x57F287,   
    danger:    0xED4245,   
    warning:   0xFEE75C,   
    info:      0x0099FF,   
    neutral:   0x2B2D31,   
    birthday:  0xFF69B4,   
    setup:     0x1E90FF,   
    music:     0x1DB954,   
    economy:   0xFFD700,   
    moderation:0xE74C3C,   
    nsfw:      0xFF69B4,   
});


const STATUS = Object.freeze({
    online:  '🟢',
    idle:    '🟡',
    dnd:     '🔴',
    offline: '⚪',
});

module.exports = { ACCENT, STATUS };
