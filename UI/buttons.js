'use strict';

const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');

const { getButtonEmoji } = require('../UI/emojis/emoji');
const lang = require('../events/loadLanguage');

function btn(firstArg, secondArg, thirdArg, fourthArg, fifthArg) {
    let finalLabel = '';
    let finalCustomId = '';
    let finalEmoji = null;
    let finalStyle = ButtonStyle.Secondary;
    let finalDisabled = false;

    if (typeof firstArg === 'number') {
        
        finalStyle = firstArg;
        finalLabel = secondArg !== undefined && secondArg !== null ? String(secondArg) : '';

        if (typeof thirdArg === 'object' && thirdArg !== null) {
            finalCustomId = thirdArg.id || thirdArg.customId || '';
            finalEmoji = thirdArg.emoji || getButtonEmoji(thirdArg.emojiKey);
            finalDisabled = Boolean(thirdArg.disabled);
            if (thirdArg.style !== undefined) finalStyle = thirdArg.style;
        } else if (typeof thirdArg === 'string') {
            finalCustomId = thirdArg;
            finalEmoji = getButtonEmoji(fourthArg) || fourthArg;
            finalDisabled = Boolean(fifthArg);
        }
    } else if (typeof firstArg === 'object' && firstArg !== null) {
        
        finalLabel = firstArg.label !== undefined && firstArg.label !== null ? String(firstArg.label) : '';
        finalCustomId = firstArg.customId || firstArg.id || '';
        finalEmoji = firstArg.emoji || getButtonEmoji(firstArg.emojiKey);
        finalStyle = firstArg.style ?? ButtonStyle.Secondary;
        finalDisabled = Boolean(firstArg.disabled);
    } else {
        
        finalLabel = firstArg !== undefined && firstArg !== null ? String(firstArg) : '';

        if (typeof secondArg === 'object' && secondArg !== null) {
            finalCustomId = secondArg.customId || secondArg.id || '';
            finalEmoji = secondArg.emoji || getButtonEmoji(secondArg.emojiKey);
            finalStyle = secondArg.style ?? ButtonStyle.Secondary;
            finalDisabled = Boolean(secondArg.disabled);
        } else {
            finalCustomId = secondArg || '';
            finalEmoji = getButtonEmoji(thirdArg) || thirdArg;
            finalStyle = fourthArg ?? ButtonStyle.Secondary;
            finalDisabled = Boolean(fifthArg);
        }
    }

    const b = new ButtonBuilder()
        .setStyle(finalStyle)
        .setDisabled(finalDisabled);

    if (finalLabel) b.setLabel(finalLabel);
    if (finalCustomId) b.setCustomId(finalCustomId);
    if (finalEmoji) {
        const resolved = getButtonEmoji(finalEmoji);
        b.setEmoji(resolved || finalEmoji);
    }

    return b;
}

function linkBtn(labelOrOpts, emojiKey, url) {
    if (typeof labelOrOpts === 'object' && labelOrOpts !== null) {
        const { label, emojiKey: eKey, emoji, url: linkUrl } = labelOrOpts;
        const b = new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setURL(linkUrl);
        if (label) b.setLabel(label);
        const resolvedEmoji = getButtonEmoji(eKey || emoji) || emoji;
        if (resolvedEmoji) b.setEmoji(resolvedEmoji);
        return b;
    }
    const b = new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setURL(url);
    if (labelOrOpts) b.setLabel(labelOrOpts);
    const e = getButtonEmoji(emojiKey) || emojiKey;
    if (e) b.setEmoji(e);
    return b;
}

function paginationRow(namespace, page, totalPages, labels = {}) {
    const prevLabel = labels.previous || lang.previous || 'Previous';
    const nextLabel = labels.next || lang.next || 'Next';
    const closeLabel = labels.close || lang.close || 'Close';

    return new ActionRowBuilder().addComponents(
        btn(prevLabel, `${namespace}_prev`, 'previoussong', ButtonStyle.Secondary, page <= 0),
        btn(nextLabel, `${namespace}_next`, 'nextsong', ButtonStyle.Secondary, page >= totalPages - 1),
        btn(closeLabel, `${namespace}_close`, 'stop', ButtonStyle.Danger)
    );
}

function closeBtn(namespace, label = null) {
    return btn(label || lang.close || 'Close', `${namespace}_close`, 'stop', ButtonStyle.Danger);
}

function buttonRow(...buttons) {
    return new ActionRowBuilder().addComponents(...buttons);
}

btn.primary = function(customId, label, emojiKey, disabled = false) {
    return btn(ButtonStyle.Primary, label, customId, emojiKey, disabled);
};
btn.secondary = function(customId, label, emojiKey, disabled = false) {
    return btn(ButtonStyle.Secondary, label, customId, emojiKey, disabled);
};
btn.warning = function(customId, label, emojiKey, disabled = false) {
    return btn(ButtonStyle.Secondary, label, customId, emojiKey, disabled);
};
btn.success = function(customId, label, emojiKey, disabled = false) {
    return btn(ButtonStyle.Success, label, customId, emojiKey, disabled);
};
btn.danger = function(customId, label, emojiKey, disabled = false) {
    return btn(ButtonStyle.Danger, label, customId, emojiKey, disabled);
};
btn.link = function(label, url, emojiKey) {
    return linkBtn(label, emojiKey, url);
};

module.exports = { btn, linkBtn, paginationRow, closeBtn, buttonRow };

