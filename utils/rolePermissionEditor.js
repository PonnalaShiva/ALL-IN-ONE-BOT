'use strict';

const { PermissionFlagsBits, PermissionsBitField } = require('discord.js');

const EDITABLE_ROLE_PERMISSIONS = Object.freeze({
    ViewChannel: PermissionFlagsBits.ViewChannel,
    SendMessages: PermissionFlagsBits.SendMessages,
    SendMessagesInThreads: PermissionFlagsBits.SendMessagesInThreads,
    ReadMessageHistory: PermissionFlagsBits.ReadMessageHistory,
    AddReactions: PermissionFlagsBits.AddReactions,
    EmbedLinks: PermissionFlagsBits.EmbedLinks,
    AttachFiles: PermissionFlagsBits.AttachFiles,
    UseExternalEmojis: PermissionFlagsBits.UseExternalEmojis,
    MentionEveryone: PermissionFlagsBits.MentionEveryone,
    ManageMessages: PermissionFlagsBits.ManageMessages,
    ManageChannels: PermissionFlagsBits.ManageChannels,
    ManageRoles: PermissionFlagsBits.ManageRoles,
    ManageGuild: PermissionFlagsBits.ManageGuild,
    ManageNicknames: PermissionFlagsBits.ManageNicknames,
    ChangeNickname: PermissionFlagsBits.ChangeNickname,
    KickMembers: PermissionFlagsBits.KickMembers,
    BanMembers: PermissionFlagsBits.BanMembers,
    ModerateMembers: PermissionFlagsBits.ModerateMembers,
    Connect: PermissionFlagsBits.Connect,
    Speak: PermissionFlagsBits.Speak,
    Stream: PermissionFlagsBits.Stream,
    MuteMembers: PermissionFlagsBits.MuteMembers,
    DeafenMembers: PermissionFlagsBits.DeafenMembers,
    MoveMembers: PermissionFlagsBits.MoveMembers,
    UseVAD: PermissionFlagsBits.UseVAD
});

function resolveEditableRolePermission(name) {
    return Object.hasOwn(EDITABLE_ROLE_PERMISSIONS, name)
        ? EDITABLE_ROLE_PERMISSIONS[name]
        : null;
}

function buildRolePermissionUpdate(currentPermissions, action, permissionName, actorPermissions) {
    const updated = new PermissionsBitField(currentPermissions?.bitfield ?? currentPermissions ?? 0n);

    if (action === 'reset') return updated.remove(updated.bitfield);
    if (action !== 'add' && action !== 'remove') {
        throw new TypeError('Permission update action must be add, remove, or reset.');
    }

    const permission = resolveEditableRolePermission(permissionName);
    if (!permission) throw new TypeError('Choose a supported role permission.');
    if (action === 'add') {
        if (!actorPermissions?.has?.(permission)) {
            throw new Error('You cannot grant a permission your account does not have.');
        }
        updated.add(permission);
    } else {
        updated.remove(permission);
    }

    return updated;
}

module.exports = {
    EDITABLE_ROLE_PERMISSIONS,
    resolveEditableRolePermission,
    buildRolePermissionUpdate
};
