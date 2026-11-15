'use strict';

const STAFF_ACTION_PREFIXES = Object.freeze([
    'reply_modmail_', 'anon_reply_', 'close_modmail_', 'priority_modmail_', 'add_modmail_note_',
    'reply_modal_', 'anon_modal_', 'note_modal_', 'close_modal_', 'priority_select_'
]);
const ACTOR_BOUND_PREFIXES = Object.freeze([
    'reply_modal_', 'anon_modal_', 'note_modal_', 'close_modal_', 'priority_select_'
]);

function parseStaffAction(customId) {
    if (typeof customId !== 'string') return null;
    const prefix = STAFF_ACTION_PREFIXES.find(candidate => customId.startsWith(candidate));
    if (!prefix) return null;

    const parts = customId.slice(prefix.length).split('_');
    const threadId = parts[0];
    const actorId = ACTOR_BOUND_PREFIXES.includes(prefix) ? parts[1] : null;
    if (!threadId || (actorId !== null && !actorId)) return null;
    return { threadId, actorId };
}

module.exports = { parseStaffAction };
