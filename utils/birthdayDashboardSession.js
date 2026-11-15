'use strict';

const SUPPORTED_MODAL_TYPES = new Set(['time_timezone', 'message']);
const { createDashboardModalId, parseDashboardModalId } = require('./dashboardModalSession');

function createBirthdayModalId(type, messageId) {
    if (!SUPPORTED_MODAL_TYPES.has(type)) {
        throw new TypeError('Birthday dashboard modal requires a supported type and a valid message ID.');
    }
    return createDashboardModalId(`setup-birthday_modal_${type}`, messageId);
}

function parseBirthdayModalId(customId) {
    const parsed = parseDashboardModalId(customId);
    const match = parsed?.baseCustomId.match(/^setup-birthday_modal_(time_timezone|message)$/);
    return match ? { type: match[1], messageId: parsed.messageId } : null;
}

module.exports = { createBirthdayModalId, parseBirthdayModalId };
