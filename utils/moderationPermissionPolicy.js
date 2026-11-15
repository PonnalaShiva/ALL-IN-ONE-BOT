'use strict';

const { PermissionFlagsBits } = require('discord.js');

const REQUIRED_PERMISSION_BY_SUBCOMMAND = Object.freeze({
    ban: PermissionFlagsBits.BanMembers,
    unban: PermissionFlagsBits.BanMembers,
    softban: PermissionFlagsBits.BanMembers,
    massban: PermissionFlagsBits.BanMembers,
    kick: PermissionFlagsBits.KickMembers,
    timeout: PermissionFlagsBits.ModerateMembers,
    removetimeout: PermissionFlagsBits.ModerateMembers,
    'temp-mute': PermissionFlagsBits.MuteMembers,
    nickname: PermissionFlagsBits.ManageNicknames,
    warn: PermissionFlagsBits.ManageMessages,
    dm: PermissionFlagsBits.ManageMessages
});

function getRequiredModerationPermission(subcommand) {
    return REQUIRED_PERMISSION_BY_SUBCOMMAND[subcommand] || null;
}

function hasModerationPermission(subcommand, permissions) {
    const requiredPermission = getRequiredModerationPermission(subcommand);
    return requiredPermission === null || Boolean(permissions?.has?.(requiredPermission));
}

function canModerateMember(actor, target, guild) {
    if (!actor?.id || !target?.id || !guild?.ownerId || actor.id === target.id) return false;
    if (target.id === guild.ownerId) return false;
    if (actor.id === guild.ownerId) return true;

    const actorPosition = actor.roles?.highest?.position;
    const targetPosition = target.roles?.highest?.position;
    return Number.isFinite(actorPosition) && Number.isFinite(targetPosition) && actorPosition > targetPosition;
}

module.exports = {
    REQUIRED_PERMISSION_BY_SUBCOMMAND,
    getRequiredModerationPermission,
    hasModerationPermission,
    canModerateMember
};
