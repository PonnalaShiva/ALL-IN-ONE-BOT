'use strict';

const MODERATOR_ACTIONS = [
    /^report_(?:claim|resolve|escalate|dismiss|timeout|ban|info)_/,
    /^add_note_/,
    /^resolve_modal_/,
    /^confirm_(?:dismiss|timeout|ban)_/,
    /^cancel_(?:dismiss|timeout|ban)_/
];

function isReportModeratorAction(interaction) {
    if (interaction?.isModalSubmit?.() && interaction.customId?.startsWith('report_modal_')) return false;
    return MODERATOR_ACTIONS.some(pattern => pattern.test(interaction?.customId || ''));
}

function canManageReports(interaction, permissionFlag) {
    return Boolean(
        interaction?.guild &&
        interaction?.memberPermissions &&
        typeof interaction.memberPermissions.has === 'function' &&
        interaction.memberPermissions.has(permissionFlag)
    );
}

module.exports = { isReportModeratorAction, canManageReports };
