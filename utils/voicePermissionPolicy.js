'use strict';

const { PermissionFlagsBits } = require('discord.js');

const REQUIRED_PERMISSION_BY_ACTION = Object.freeze({
    kick: PermissionFlagsBits.MoveMembers,
    move: PermissionFlagsBits.MoveMembers,
    'mass-disconnect': PermissionFlagsBits.MoveMembers,
    'mass-move': PermissionFlagsBits.MoveMembers,
    pull: PermissionFlagsBits.MoveMembers,
    mute: PermissionFlagsBits.MuteMembers,
    unmute: PermissionFlagsBits.MuteMembers,
    'mass-mute': PermissionFlagsBits.MuteMembers,
    'mass-unmute': PermissionFlagsBits.MuteMembers,
    'stage-speaker': PermissionFlagsBits.MuteMembers,
    'stage-audience': PermissionFlagsBits.MuteMembers,
    deafen: PermissionFlagsBits.DeafenMembers,
    undeafen: PermissionFlagsBits.DeafenMembers,
    'mass-deafen': PermissionFlagsBits.DeafenMembers,
    'mass-undeafen': PermissionFlagsBits.DeafenMembers,
    hide: PermissionFlagsBits.ManageChannels,
    unhide: PermissionFlagsBits.ManageChannels,
    lock: PermissionFlagsBits.ManageChannels,
    unlock: PermissionFlagsBits.ManageChannels,
    limit: PermissionFlagsBits.ManageChannels
});

function getRequiredVoicePermission(action) {
    return REQUIRED_PERMISSION_BY_ACTION[action] || null;
}

function hasVoiceActionPermission(action, permissions) {
    const required = getRequiredVoicePermission(action);
    return required === null || Boolean(permissions?.has?.(required));
}

module.exports = { REQUIRED_PERMISSION_BY_ACTION, getRequiredVoicePermission, hasVoiceActionPermission };
