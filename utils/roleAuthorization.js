'use strict';

const { PermissionFlagsBits } = require('discord.js');

const UNSAFE_SELF_ASSIGNABLE_PERMISSIONS = [
    PermissionFlagsBits.Administrator,
    PermissionFlagsBits.ManageGuild,
    PermissionFlagsBits.ManageRoles,
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.ManageWebhooks,
    PermissionFlagsBits.ManageEvents,
    PermissionFlagsBits.ManageThreads,
    PermissionFlagsBits.ManageMessages,
    PermissionFlagsBits.ViewAuditLog,
    PermissionFlagsBits.KickMembers,
    PermissionFlagsBits.BanMembers,
    PermissionFlagsBits.ModerateMembers,
    PermissionFlagsBits.ManageNicknames,
    PermissionFlagsBits.MentionEveryone,
    PermissionFlagsBits.ManageEmojisAndStickers
].filter(Boolean);

function hasGuildOwnerBypass(actor, guild) {
    return Boolean(actor?.id && guild?.ownerId && actor.id === guild.ownerId);
}

function canManageRole(actor, role, guild) {
    if (!actor?.id || !role || !guild?.ownerId) return false;
    if (hasGuildOwnerBypass(actor, guild)) return true;

    const actorPosition = actor.roles?.highest?.position;
    return Number.isFinite(actorPosition) && Number.isFinite(role.position) && actorPosition > role.position;
}

function canManageMemberRole(actor, targetMember, role, guild) {
    if (!actor?.id || !targetMember?.id || !role || !guild?.ownerId) return false;
    if (targetMember.id === guild.ownerId) return false;
    if (hasGuildOwnerBypass(actor, guild)) return true;

    const actorPosition = actor.roles?.highest?.position;
    const targetPosition = targetMember.roles?.highest?.position;
    return Number.isFinite(actorPosition) && Number.isFinite(targetPosition) &&
        Number.isFinite(role.position) && actorPosition > targetPosition && actorPosition > role.position;
}

function canGrantRolePermissions(actor, permissions) {
    if (!actor?.permissions?.has) return false;
    const permissionList = Array.isArray(permissions) ? permissions : permissions?.toArray?.();
    if (!Array.isArray(permissionList)) return false;
    return permissionList.every(permission => actor.permissions.has(permission));
}

function isSafeSelfAssignableRole(role) {
    return Boolean(role?.permissions?.has) &&
        !UNSAFE_SELF_ASSIGNABLE_PERMISSIONS.some(permission => role.permissions.has(permission));
}

module.exports = {
    canManageRole,
    canManageMemberRole,
    canGrantRolePermissions,
    isSafeSelfAssignableRole
};
