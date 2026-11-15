'use strict';

const { PermissionsBitField } = require('discord.js');
const ReactionRole = require('../models/reactionroles/schema');
const checkPermissions = require('./checkPermissions');

function canManageReactionRoleSetup(interaction, setup) {
    if (!interaction?.guild || !interaction.user || !setup || setup.guildId !== interaction.guild.id) {
        return false;
    }

    const permissions = new PermissionsBitField(interaction.member?.permissions || 0);
    return permissions.has(PermissionsBitField.Flags.ManageRoles) ||
        permissions.has(PermissionsBitField.Flags.Administrator);
}

async function findManageableReactionRoleSetup(interaction, setupId) {
    if (!interaction?.guild || !setupId) return { status: 'missing', setup: null };

    const setup = await ReactionRole.findOne({ setupId, guildId: interaction.guild.id });
    if (!setup) return { status: 'missing', setup: null };
    if (!canManageReactionRoleSetup(interaction, setup) ||
        !await checkPermissions.hasPermission(interaction, 'botmanager')) {
        return { status: 'forbidden', setup: null };
    }
    return { status: 'ok', setup };
}

module.exports = {
    canManageReactionRoleSetup,
    findManageableReactionRoleSetup
};
