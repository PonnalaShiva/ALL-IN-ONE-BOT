


'use strict';

const { 
    SlashCommandBuilder, 
    PermissionsBitField, 
    PermissionFlagsBits,
} = require('discord.js');
const checkPermissions = require('../../utils/checkPermissions');
const { EDITABLE_ROLE_PERMISSIONS, buildRolePermissionUpdate } = require('../../utils/rolePermissionEditor');
const {
    canManageRole,
    canManageMemberRole,
    canGrantRolePermissions
} = require('../../utils/roleAuthorization');
const { 
    buildCard, 
    cards, 
    sendV2, 
    deferReply, 
    ACCENT, createInterpolatableProxy } = require('../../UI');

const rawLang = require('../../events/loadLanguage');
const lang = {
    ...rawLang,
    moderation: {
        ...rawLang.moderation,
        role: createInterpolatableProxy(rawLang.moderation?.role),
        common: createInterpolatableProxy(rawLang.moderation?.common),
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('role')
        .setDescription('Advanced role management and administration system')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a role to a user with logging')
                .addUserOption(option =>
                    option.setName('target')
                        .setDescription('User to give the role to')
                        .setRequired(true))
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('Role to be added')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for adding the role')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a role from a user with logging')
                .addUserOption(option =>
                    option.setName('target')
                        .setDescription('User to remove the role from')
                        .setRequired(true))
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('Role to be removed')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for removing the role')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create a new role with advanced settings')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Name of the new role')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('type')
                        .setDescription('Role template type')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Administrator', value: 'administrator' },
                            { name: 'Moderator', value: 'moderator' },
                            { name: 'Staff', value: 'staff' },
                            { name: 'Helper', value: 'helper' },
                            { name: 'VIP', value: 'vip' },
                            { name: 'Booster', value: 'booster' },
                            { name: 'Member', value: 'member' },
                            { name: 'Custom', value: 'custom' }
                        ))
                .addStringOption(option =>
                    option.setName('color')
                        .setDescription('Role color (hex or name: red, blue, green, etc.)')
                        .setRequired(false))
                .addBooleanOption(option =>
                    option.setName('hoist')
                        .setDescription('Display role separately in member list')
                        .setRequired(false))
                .addBooleanOption(option =>
                    option.setName('mentionable')
                        .setDescription('Allow role to be mentioned by everyone')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('edit')
                .setDescription('Edit an existing role properties')
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('Role to edit')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('New role name')
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('color')
                        .setDescription('New role color')
                        .setRequired(false))
                .addBooleanOption(option =>
                    option.setName('hoist')
                        .setDescription('Display separately in member list')
                        .setRequired(false))
                .addBooleanOption(option =>
                    option.setName('mentionable')
                        .setDescription('Allow role mentions')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Delete a role with confirmation')
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('Role to delete')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for deletion')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('clone')
                .setDescription('Clone an existing role with all settings')
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('Role to clone')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Name for the cloned role')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('info')
                .setDescription('Get detailed information about a role')
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('Role to analyze')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('members')
                .setDescription('List all members with a specific role')
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('Role to check members for')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('limit')
                        .setDescription('Maximum members to show (1-50)')
                        .setRequired(false)
                        .setMinValue(1)
                        .setMaxValue(50)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all server roles with details')
                .addStringOption(option =>
                    option.setName('filter')
                        .setDescription('Filter roles by type')
                        .setRequired(false)
                        .addChoices(
                            { name: 'All Roles', value: 'all' },
                            { name: 'Administrative', value: 'admin' },
                            { name: 'Mentionable', value: 'mentionable' },
                            { name: 'Hoisted', value: 'hoisted' },
                            { name: 'Bot Roles', value: 'bot' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('addall')
                .setDescription('Add a role to all server members')
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('Role to add to all members')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for adding role to all members')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('removeall')
                .setDescription('Remove a role from all server members')
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('Role to remove from all members')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for removing role from all members')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('massadd')
                .setDescription('Add a role to multiple users at once')
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('Role to add to users')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('users')
                        .setDescription('User IDs separated by spaces (max 10)')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for mass role addition')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('massremove')
                .setDescription('Remove a role from multiple users at once')
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('Role to remove from users')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('users')
                        .setDescription('User IDs separated by spaces (max 10)')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for mass role removal')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('member')
                .setDescription('Show all roles for a specific member')
                .addUserOption(option =>
                    option.setName('target')
                        .setDescription('Member to check roles for')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('hierarchy')
                .setDescription('Show server role hierarchy and permissions')
                .addIntegerOption(option =>
                    option.setName('limit')
                        .setDescription('Number of roles to display (1-20)')
                        .setRequired(false)
                        .setMinValue(1)
                        .setMaxValue(20)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('permissions')
                .setDescription('Manage role permissions in detail')
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('Role to manage permissions for')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('action')
                        .setDescription('Permission action')
                        .setRequired(true)
                        .addChoices(
                            { name: 'View Permissions', value: 'view' },
                            { name: 'Add Permissions', value: 'add' },
                            { name: 'Remove Permissions', value: 'remove' },
                            { name: 'Reset Permissions', value: 'reset' }
                        ))
                .addStringOption(option =>
                    option.setName('permission')
                        .setDescription('Permission to add or remove; required for those actions')
                        .setRequired(false)
                        .addChoices(...Object.keys(EDITABLE_ROLE_PERMISSIONS).map(name => ({ name, value: name }))))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for changing role permissions')
                        .setRequired(false)
                        .setMaxLength(400)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('cleanup')
                .setDescription('Remove roles from inactive or left members')
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('Role to clean up')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('days')
                        .setDescription('Days of inactivity (default: 30)')
                        .setRequired(false)
                        .setMinValue(1)
                        .setMaxValue(365)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('Show comprehensive role statistics')
                .addIntegerOption(option =>
                    option.setName('limit')
                        .setDescription('Number of roles to analyze (1-50)')
                        .setRequired(false)
                        .setMinValue(1)
                        .setMaxValue(50)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('help')
                .setDescription('Show comprehensive role management help')),
    
    async execute(interaction) {
        if (!await checkPermissions(interaction, 'admin')) return;

        let sender = interaction.user;
        let subcommand;

        if (interaction.isCommand && interaction.isCommand()) {
            await deferReply(interaction);
            subcommand = interaction.options.getSubcommand();
        } else {
            return;
        }

        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
            const errorCard = cards.error(
                lang.moderation.role.accessDeniedTitle,
                lang.moderation.role.accessDenied
            );
            return sendV2(interaction, errorCard);
        }

        const guild = interaction.guild;
        const denyRoleHierarchy = role => sendV2(interaction, cards.error(
            lang.moderation.role.insufficientHierarchyTitle,
            lang.moderation.role.insufficientHierarchy({ role: role?.name || 'selected role' })
        ));

        const getColorValue = (color) => {
            const colorOptions = {
                red: 0xFF0000, blue: 0x0000FF, green: 0x008000, yellow: 0xFFFF00,
                purple: 0x800080, orange: 0xFFA500, cyan: 0x00FFFF, pink: 0xFFC0CB,
                white: 0xFFFFFF, black: 0x000000, gold: 0xFFD700, silver: 0xC0C0C0
            };

            if (colorOptions[color?.toLowerCase()]) {
                return colorOptions[color.toLowerCase()];
            } else if (/^#?([0-9A-F]{3}){1,2}$/i.test(color)) {
                return parseInt(color.replace('#', ''), 16);
            }
            return null;
        };

        const getRoleTemplate = (type) => {
            const templates = {
                administrator: {
                    permissions: [PermissionFlagsBits.Administrator],
                    color: 0xFF0000
                },
                moderator: {
                    permissions: [
                        PermissionFlagsBits.KickMembers,
                        PermissionFlagsBits.BanMembers,
                        PermissionFlagsBits.ModerateMembers,
                        PermissionFlagsBits.ManageMessages
                    ],
                    color: 0xFF6B6B
                },
                staff: {
                    permissions: [
                        PermissionFlagsBits.ModerateMembers,
                        PermissionFlagsBits.ManageMessages
                    ],
                    color: 0x3498DB
                },
                helper: {
                    permissions: [PermissionFlagsBits.ManageMessages],
                    color: 0x2ECC71
                },
                vip: {
                    permissions: [PermissionFlagsBits.UseExternalEmojis],
                    color: 0xF39C12
                },
                booster: {
                    permissions: [PermissionFlagsBits.UseExternalEmojis],
                    color: 0xE91E63
                },
                member: {
                    permissions: [],
                    color: 0x95A5A6
                },
                custom: {
                    permissions: [],
                    color: 0x9B59B6
                }
            };
            return templates[type] || templates.custom;
        };

        switch (subcommand) {
            case 'help': {
                const helpCard = buildCard({
                    accent: ACCENT.primary,
                    title: lang.moderation.role.helpTitle,
                    body: [
                        '**Comprehensive Role Administration**\nPowerful tools for complete role management and server organization',
                        '**User Role Management:**\n• `add` - Add role to a user\n• `remove` - Remove role from a user\n• `addall` - Add role to ALL server members\n• `removeall` - Remove role from ALL server members\n• `massadd` - Add role to multiple users (by IDs)\n• `massremove` - Remove role from multiple users (by IDs)\n• `member` - Show all roles for a specific member',
                        '**Role Creation & Editing:**\n• `create` - Create roles with templates\n• `edit` - Modify existing role properties\n• `clone` - Duplicate roles with settings\n• `delete` - Remove roles safely',
                        '**Information & Analytics:**\n• `info` - Detailed role information\n• `members` - List role members\n• `list` - Server role directory\n• `stats` - Role usage statistics',
                        '**Advanced Features:**\n• `hierarchy` - Role hierarchy display\n• `permissions` - Advanced permission management\n• `cleanup` - Remove inactive member roles\n• **Role Templates** - Pre-configured role types',
                        '**Template Types:**\nAdministrator • Moderator • Staff • Helper\nVIP • Booster • Member • Custom',
                        `**Usage Examples:**\n• \`/role add @user @role\`\n• \`/role create "Support Staff" type:staff color:blue\`\n• \`/role massadd @role "123 456 789"\`\n\nHelp requested by ${sender.tag}`
                    ].join('\n\n'),
                    thumbnail: sender.displayAvatarURL({ dynamic: true })
                });

                return sendV2(interaction, helpCard);
            }

            case 'add': {
                const target = interaction.options.getUser('target');
                const role = interaction.options.getRole('role');
                const reason = interaction.options.getString('reason') || lang.moderation.role.noReason;
                const member = guild.members.cache.get(target.id) || await guild.members.fetch(target.id).catch(() => null);

                if (!member) {
                    return sendV2(interaction, cards.error(
                        lang.moderation.role.memberNotFoundTitle,
                        lang.moderation.role.memberNotFound({ user: target.tag })
                    ));
                }

                if (!canManageMemberRole(interaction.member, member, role, guild) ||
                    !canGrantRolePermissions(interaction.member, role.permissions)) {
                    return denyRoleHierarchy(role);
                }

                if (member.roles.cache.has(role.id)) {
                    return sendV2(interaction, cards.warning(
                        lang.moderation.role.roleAlreadyAssignedTitle,
                        lang.moderation.role.roleAlreadyAssigned({ user: target.tag, role: role.name })
                    ));
                }

                if (role.position >= interaction.guild.members.me.roles.highest.position) {
                    return sendV2(interaction, cards.error(
                        lang.moderation.role.insufficientHierarchyTitle,
                        lang.moderation.role.insufficientHierarchy({ role: role.name })
                    ));
                }

                try {
                    await member.roles.add(role, `${reason} | Added by ${sender.tag}`);

                    const successCard = buildCard({
                        accent: ACCENT.success,
                        title: lang.moderation.role.addedTitle,
                        body: [
                            `**Target:** ${target.tag}`,
                            `**Role Added:** ${role.name}`,
                            `**Added By:** ${sender.tag}`,
                            `**Reason:** ${reason}`,
                            `**Role Color:** ${role.hexColor}`,
                            `**Role Position:** ${role.position}`,
                            `**Total Roles:** ${member.roles.cache.size + 1}`,
                            `**Timestamp:** <t:${Math.floor(Date.now() / 1000)}:F>`
                        ].join('\n'),
                        thumbnail: target.displayAvatarURL({ dynamic: true })
                    });

                    return sendV2(interaction, successCard);
                } catch (error) {
                    return sendV2(interaction, cards.error(
                        'Role Addition Failed',
                        `Failed to add **${role.name}** to **${target.tag}**.\n\n**Possible causes:** Insufficient permissions, role hierarchy issues, or API error.`
                    ));
                }
            }

            case 'remove': {
                const target = interaction.options.getUser('target');
                const role = interaction.options.getRole('role');
                const reason = interaction.options.getString('reason') || lang.moderation.role.noReason;
                const member = guild.members.cache.get(target.id) || await guild.members.fetch(target.id).catch(() => null);

                if (!member) {
                    return sendV2(interaction, cards.error(
                        lang.moderation.role.memberNotFoundTitle,
                        lang.moderation.role.memberNotFound({ user: target.tag })
                    ));
                }

                if (!canManageMemberRole(interaction.member, member, role, guild)) {
                    return denyRoleHierarchy(role);
                }

                if (!member.roles.cache.has(role.id)) {
                    return sendV2(interaction, cards.warning(
                        lang.moderation.role.roleNotAssignedTitle,
                        lang.moderation.role.roleNotAssigned({ user: target.tag, role: role.name })
                    ));
                }

                if (role.position >= interaction.guild.members.me.roles.highest.position) {
                    return sendV2(interaction, cards.error(
                        lang.moderation.role.insufficientHierarchyTitle,
                        lang.moderation.role.insufficientHierarchy({ role: role.name })
                    ));
                }

                try {
                    await member.roles.remove(role, `${reason} | Removed by ${sender.tag}`);

                    const successCard = buildCard({
                        accent: ACCENT.danger,
                        title: lang.moderation.role.removedTitle,
                        body: [
                            `**Target:** ${target.tag}`,
                            `**Role Removed:** ${role.name}`,
                            `**Removed By:** ${sender.tag}`,
                            `**Reason:** ${reason}`,
                            `**Role Color:** ${role.hexColor}`,
                            `**Role Position:** ${role.position}`,
                            `**Remaining Roles:** ${member.roles.cache.size - 1}`,
                            `**Timestamp:** <t:${Math.floor(Date.now() / 1000)}:F>`
                        ].join('\n'),
                        thumbnail: target.displayAvatarURL({ dynamic: true })
                    });

                    return sendV2(interaction, successCard);
                } catch (error) {
                    return sendV2(interaction, cards.error(
                        'Role Removal Failed',
                        `Failed to remove **${role.name}** from **${target.tag}**.\n\n**Possible causes:** Insufficient permissions, role hierarchy issues, or API error.`
                    ));
                }
            }

            case 'create': {
                const name = interaction.options.getString('name');
                const type = interaction.options.getString('type') || 'custom';
                const color = interaction.options.getString('color');
                const hoist = interaction.options.getBoolean('hoist') ?? false;
                const mentionable = interaction.options.getBoolean('mentionable') ?? false;

                const template = getRoleTemplate(type);
                const roleColor = getColorValue(color) ?? template.color;

                if (!canGrantRolePermissions(interaction.member, template.permissions)) {
                    return denyRoleHierarchy({ name });
                }

                try {
                    const role = await guild.roles.create({
                        name: name,
                        color: roleColor,
                        permissions: template.permissions,
                        hoist: hoist,
                        mentionable: mentionable,
                        reason: `Role created by ${sender.tag} using role management system`
                    });

                    const createCard = buildCard({
                        accent: roleColor || ACCENT.success,
                        title: lang.moderation.role.createdTitle,
                        body: [
                            `**Role Name:** ${role.name}`,
                            `**Template:** ${type}`,
                            `**Created By:** ${sender.tag}`,
                            `**Color:** ${role.hexColor}`,
                            `**Hoisted:** ${hoist ? 'Yes' : 'No'}`,
                            `**Mentionable:** ${mentionable ? 'Yes' : 'No'}`,
                            `**Position:** ${role.position}`,
                            `**Role ID:** \`${role.id}\``,
                            `**Timestamp:** <t:${Math.floor(Date.now() / 1000)}:F>`
                        ].join('\n'),
                        thumbnail: sender.displayAvatarURL({ dynamic: true })
                    });

                    return sendV2(interaction, createCard);
                } catch (error) {
                    return sendV2(interaction, cards.error(
                        'Role Creation Failed',
                        `Failed to create role **${name}**.\n\n**Possible causes:** Invalid name, server role limit reached (250 max), or insufficient permissions.`
                    ));
                }
            }

            case 'edit': {
                const role = interaction.options.getRole('role');
                const name = interaction.options.getString('name');
                const color = interaction.options.getString('color');
                const hoist = interaction.options.getBoolean('hoist');
                const mentionable = interaction.options.getBoolean('mentionable');

                if (!canManageRole(interaction.member, role, guild) ||
                    role.position >= interaction.guild.members.me.roles.highest.position) {
                    return denyRoleHierarchy(role);
                }

                try {
                    const editData = {};
                    if (name) editData.name = name;
                    if (color) editData.color = getColorValue(color);
                    if (hoist !== null && hoist !== undefined) editData.hoist = hoist;
                    if (mentionable !== null && mentionable !== undefined) editData.mentionable = mentionable;

                    await role.edit(editData);

                    const editCard = buildCard({
                        accent: role.color || ACCENT.info,
                        title: 'Role Edited Successfully',
                        body: [
                            `**Role:** ${role.name}`,
                            `**Updated By:** ${sender.tag}`,
                            `**Color:** ${role.hexColor}`,
                            `**Hoisted:** ${role.hoist ? 'Yes' : 'No'}`,
                            `**Mentionable:** ${role.mentionable ? 'Yes' : 'No'}`
                        ].join('\n')
                    });

                    return sendV2(interaction, editCard);
                } catch (err) {
                    return sendV2(interaction, cards.error(lang.moderation.role.editFailedTitle, err.message));
                }
            }

            case 'delete': {
                const role = interaction.options.getRole('role');
                const reason = interaction.options.getString('reason') || lang.moderation.role.noReason;

                if (!canManageRole(interaction.member, role, guild) ||
                    role.position >= interaction.guild.members.me.roles.highest.position) {
                    return denyRoleHierarchy(role);
                }

                try {
                    const roleName = role.name;
                    await role.delete(`${reason} | Deleted by ${sender.tag}`);

                    return sendV2(interaction, cards.success(
                        lang.moderation.role.deletedTitle,
                        lang.moderation.role.deleted({ role: roleName })
                    ));
                } catch (err) {
                    return sendV2(interaction, cards.error(lang.moderation.role.deleteFailedTitle, err.message));
                }
            }

            case 'clone': {
                const role = interaction.options.getRole('role');
                const name = interaction.options.getString('name');

                if (!canManageRole(interaction.member, role, guild) ||
                    !canGrantRolePermissions(interaction.member, role.permissions)) {
                    return denyRoleHierarchy(role);
                }

                try {
                    const clonedRole = await guild.roles.create({
                        name: name,
                        color: role.color,
                        hoist: role.hoist,
                        permissions: role.permissions,
                        mentionable: role.mentionable,
                        reason: `Cloned from ${role.name} by ${sender.tag}`
                    });

                    return sendV2(interaction, cards.success(
                        lang.moderation.role.clonedTitle,
                        lang.moderation.role.cloned({ role: clonedRole.name, source: role.name })
                    ));
                } catch (err) {
                    return sendV2(interaction, cards.error(lang.moderation.role.cloneFailedTitle, err.message));
                }
            }

            case 'info': {
                const role = interaction.options.getRole('role');
                const permissions = role.permissions.toArray();
                const members = role.members;

                const infoCard = buildCard({
                    accent: role.color || ACCENT.info,
                    title: lang.moderation.role.infoTitleHeader,
                    body: [
                        `**Role Name:** ${role.name}`,
                        `**Role ID:** \`${role.id}\``,
                        `**Color:** ${role.hexColor}`,
                        `**Position:** ${role.position}`,
                        `**Total Members:** ${members.size} (${((members.size / (guild.memberCount || 1)) * 100).toFixed(1)}%)`,
                        `**Created:** <t:${Math.floor(role.createdTimestamp / 1000)}:F>`,
                        `**Hoisted:** ${role.hoist ? 'Yes' : 'No'} | **Mentionable:** ${role.mentionable ? 'Yes' : 'No'} | **Managed:** ${role.managed ? 'Yes' : 'No'}`,
                        `**Permissions:** ${permissions.length} total (Administrator: ${permissions.includes('Administrator') ? 'Yes' : 'No'})`,
                        members.size > 0 ? `**Top Members:** ${members.first(5).map(m => m.user.username).join(', ')}${members.size > 5 ? ` (+${members.size - 5} more)` : ''}` : ''
                    ].filter(Boolean).join('\n'),
                    thumbnail: guild.iconURL({ dynamic: true }) || sender.displayAvatarURL({ dynamic: true })
                });

                return sendV2(interaction, infoCard);
            }

            case 'list': {
                const filter = interaction.options.getString('filter') || 'all';
                let roles = guild.roles.cache;

                switch (filter) {
                    case 'admin':
                        roles = roles.filter(role => role.permissions.has(PermissionFlagsBits.Administrator));
                        break;
                    case 'mentionable':
                        roles = roles.filter(role => role.mentionable);
                        break;
                    case 'hoisted':
                        roles = roles.filter(role => role.hoist);
                        break;
                    case 'bot':
                        roles = roles.filter(role => role.managed);
                        break;
                    default:
                        roles = roles.filter(role => role.name !== '@everyone');
                        break;
                }

                const sortedRoles = roles.sort((a, b) => b.position - a.position).first(15);

                const roleLines = sortedRoles.map(role => {
                    const memberCount = role.members.size;
                    const permCount = role.permissions.toArray().length;
                    const indicators = [];
                    if (role.hoist) indicators.push('[Hoisted]');
                    if (role.mentionable) indicators.push('[Mentionable]');
                    if (role.managed) indicators.push('[Bot]');
                    if (role.permissions.has(PermissionFlagsBits.Administrator)) indicators.push('[Admin]');
                    
                    return `• **${role.name}** ${indicators.join(' ')}\n   └ ${memberCount} members • ${permCount} perms • Pos: ${role.position}`;
                }).join('\n\n');

                const listCard = buildCard({
                    accent: ACCENT.info,
                    title: lang.moderation.role.listTitleHeader,
                    body: [
                        `**Filter:** ${filter.toUpperCase()} | **Showing:** ${sortedRoles.length} of ${guild.roles.cache.size} roles`,
                        roleLines,
                        `Directory requested by ${sender.tag}`
                    ].join('\n\n'),
                    thumbnail: guild.iconURL({ dynamic: true }) || sender.displayAvatarURL({ dynamic: true })
                });

                return sendV2(interaction, listCard);
            }

            case 'stats': {
                const limit = interaction.options.getInteger('limit') || 20;
                const roles = guild.roles.cache
                    .filter(role => role.name !== '@everyone')
                    .sort((a, b) => b.members.size - a.members.size)
                    .first(limit);

                const totalMembers = guild.memberCount;
                const adminRoles = guild.roles.cache.filter(r => r.permissions.has(PermissionFlagsBits.Administrator)).size;
                const managedRoles = guild.roles.cache.filter(r => r.managed).size;
                const hoistedRoles = guild.roles.cache.filter(r => r.hoist).size;

                const topRoleLines = roles.slice(0, 10).map((role, i) => {
                    const percentage = ((role.members.size / (totalMembers || 1)) * 100).toFixed(1);
                    return `${i + 1}. **${role.name}** - ${role.members.size} members (${percentage}%)`;
                }).join('\n');

                const statsCard = buildCard({
                    accent: ACCENT.info,
                    title: lang.moderation.role.statsTitleHeader,
                    body: [
                        `**Server:** ${guild.name} (${totalMembers.toLocaleString()} members)`,
                        `**Role Breakdown:**\n• **Total Roles:** ${guild.roles.cache.size}\n• **Admin Roles:** ${adminRoles}\n• **Bot Roles:** ${managedRoles}\n• **Hoisted Roles:** ${hoistedRoles}\n• **Mentionable:** ${guild.roles.cache.filter(r => r.mentionable).size}`,
                        `**Most Popular Roles:**\n${topRoleLines}`,
                        `**Role Health:**\n• **Empty Roles:** ${guild.roles.cache.filter(r => r.members.size === 0 && !r.managed).size}\n• **Single Member:** ${guild.roles.cache.filter(r => r.members.size === 1).size}\n• **Utilization:** ${((guild.roles.cache.filter(r => r.members.size > 0).size / (guild.roles.cache.size || 1)) * 100).toFixed(1)}%\n\nStatistics requested by ${sender.tag}`
                    ].join('\n\n'),
                    thumbnail: guild.iconURL({ dynamic: true }) || sender.displayAvatarURL({ dynamic: true })
                });

                return sendV2(interaction, statsCard);
            }

            case 'addall': {
                const role = interaction.options.getRole('role');
                const reason = interaction.options.getString('reason') || lang.moderation.role.noReason;

                if (role.position >= interaction.guild.members.me.roles.highest.position ||
                    !canManageRole(interaction.member, role, guild) ||
                    !canGrantRolePermissions(interaction.member, role.permissions)) {
                    return denyRoleHierarchy(role);
                }

                try {
                    const members = await guild.members.fetch().catch(() => null);
                    if (!members) {
                        return sendV2(interaction, cards.error(lang.moderation.role.fetchFailedTitle, lang.moderation.role.fetchFailedMembers));
                    }

                    let success = 0;
                    let failed = 0;
                    const membersToProcess = Array.from(members.values()).filter(m => !m.roles.cache.has(role.id) && !m.user.bot);
                    const totalToProcess = membersToProcess.length;
                    let processed = 0;

                    for (const member of membersToProcess) {
                        try {
                            if (!canManageMemberRole(interaction.member, member, role, guild)) {
                                failed++;
                                processed++;
                                continue;
                            }
                            await member.roles.add(role, `${reason} | Added to all by ${sender.tag}`);
                            success++;
                        } catch (err) {
                            failed++;
                        }
                        processed++;
                        
                        if (processed % 5 === 0) {
                            await new Promise(resolve => setTimeout(resolve, 100));
                        }
                    }

                    const resultCard = buildCard({
                        accent: ACCENT.success,
                        title: lang.moderation.role.addallTitle,
                        body: [
                            `**Role:** ${role.name}`,
                            `**Total Server Members:** ${members.size}`,
                            `**Processed:** ${totalToProcess}`,
                            `**Successfully Added:** ${success}`,
                            `**Failed:** ${failed}`,
                            `**Skipped:** ${members.size - totalToProcess} (already had role or bots)`,
                            `**Reason:** ${reason}`,
                            `**Executed By:** ${sender.tag}`
                        ].join('\n')
                    });

                    return sendV2(interaction, resultCard);
                } catch (error) {
                    console.error('Addall error:', error);
                    return sendV2(interaction, cards.error(lang.moderation.role.operationFailedTitle, error.message));
                }
            }

            case 'removeall': {
                const role = interaction.options.getRole('role');
                const reason = interaction.options.getString('reason') || lang.moderation.role.noReason;

                if (role.position >= interaction.guild.members.me.roles.highest.position ||
                    !canManageRole(interaction.member, role, guild)) {
                    return denyRoleHierarchy(role);
                }

                try {
                    const members = await guild.members.fetch().catch(() => null);
                    if (!members) {
                        return sendV2(interaction, cards.error(lang.moderation.role.fetchFailedTitle, lang.moderation.role.fetchFailedMembers));
                    }

                    let success = 0;
                    let failed = 0;
                    const membersToProcess = Array.from(members.values()).filter(m => m.roles.cache.has(role.id));
                    const totalToProcess = membersToProcess.length;
                    let processed = 0;

                    for (const member of membersToProcess) {
                        try {
                            if (!canManageMemberRole(interaction.member, member, role, guild)) {
                                failed++;
                                processed++;
                                continue;
                            }
                            await member.roles.remove(role, `${reason} | Removed from all by ${sender.tag}`);
                            success++;
                        } catch (err) {
                            failed++;
                        }
                        processed++;
                        
                        if (processed % 5 === 0) {
                            await new Promise(resolve => setTimeout(resolve, 100));
                        }
                    }

                    const resultCard = buildCard({
                        accent: ACCENT.danger,
                        title: lang.moderation.role.removeallTitle,
                        body: [
                            `**Role:** ${role.name}`,
                            `**Total Server Members:** ${members.size}`,
                            `**Processed:** ${totalToProcess}`,
                            `**Successfully Removed:** ${success}`,
                            `**Failed:** ${failed}`,
                            `**Skipped:** ${members.size - totalToProcess} (did not have role)`,
                            `**Reason:** ${reason}`,
                            `**Executed By:** ${sender.tag}`
                        ].join('\n')
                    });

                    return sendV2(interaction, resultCard);
                } catch (error) {
                    console.error('Removeall error:', error);
                    return sendV2(interaction, cards.error(lang.moderation.role.operationFailedTitle, error.message));
                }
            }

            case 'member': {
                const target = interaction.options.getUser('target');
                const member = guild.members.cache.get(target.id) || await guild.members.fetch(target.id).catch(() => null);

                if (!member) {
                    return sendV2(interaction, cards.error(
                        lang.moderation.role.memberNotFoundTitle,
                        lang.moderation.role.memberNotFound({ user: target.tag })
                    ));
                }

                const memberRoles = member.roles.cache
                    .filter(role => role.id !== guild.id)
                    .sort((a, b) => b.position - a.position);

                const roleEntries = memberRoles.size > 0 
                    ? memberRoles.map((role, i) => `${i + 1}. ${role} (Pos: ${role.position})`).join('\n')
                    : 'No roles assigned';

                const memberCard = buildCard({
                    accent: ACCENT.info,
                    title: lang.moderation.role.memberTitle,
                    body: [
                        `**Member:** ${target.tag} (\`${target.id}\`)`,
                        `**Total Roles:** ${memberRoles.size}`,
                        `**Joined Server:** <t:${Math.floor(member.joinedTimestamp / 1000)}:R>`,
                        `\n**Roles:**\n${roleEntries}`,
                        `\n**Summary:** Hoisted: ${memberRoles.filter(r => r.hoist).size} | Admin: ${memberRoles.filter(r => r.permissions.has(PermissionFlagsBits.Administrator)).size}`
                    ].join('\n'),
                    thumbnail: target.displayAvatarURL({ dynamic: true })
                });

                return sendV2(interaction, memberCard);
            }

            case 'members': {
                const role = interaction.options.getRole('role');
                const limit = interaction.options.getInteger('limit') || 20;

                const roleMembers = role.members;
                const memberList = Array.from(roleMembers.values()).slice(0, limit);

                const memberEntries = memberList.length > 0 
                    ? memberList.map((m, i) => `${i + 1}. **${m.user.tag}** (\`${m.user.id}\`)`).join('\n')
                    : 'No members found';

                const membersCard = buildCard({
                    accent: role.color || ACCENT.info,
                    title: lang.moderation.role.membersTitleHeader,
                    body: [
                        `**Role:** ${role.name} (\`${role.id}\`)`,
                        `**Total Members:** ${roleMembers.size} (${((roleMembers.size / (guild.memberCount || 1)) * 100).toFixed(1)}%)`,
                        `**Showing:** ${memberList.length} members`,
                        `\n**Member List:**\n${memberEntries}`,
                        roleMembers.size > limit ? `\n*+${roleMembers.size - limit} more members...*` : ''
                    ].filter(Boolean).join('\n'),
                    thumbnail: guild.iconURL({ dynamic: true }) || sender.displayAvatarURL({ dynamic: true })
                });

                return sendV2(interaction, membersCard);
            }

            case 'hierarchy': {
                const limit = interaction.options.getInteger('limit') || 20;
                const roles = guild.roles.cache
                    .filter(role => role.name !== '@everyone')
                    .sort((a, b) => b.position - a.position)
                    .first(limit);

                const hierarchyLines = roles.map((role, i) => {
                    const indicators = [];
                    if (role.hoist) indicators.push('[Hoisted]');
                    if (role.mentionable) indicators.push('[Mentionable]');
                    if (role.managed) indicators.push('[Bot]');
                    if (role.permissions.has(PermissionFlagsBits.Administrator)) indicators.push('[Admin]');
                    return `${i + 1}. **${role.name}** ${indicators.join(' ')}\n   └ Pos: ${role.position} | Members: ${role.members.size} | Perms: ${role.permissions.toArray().length}`;
                }).join('\n\n');

                const hierarchyCard = buildCard({
                    accent: ACCENT.primary,
                    title: lang.moderation.role.hierarchyTitle,
                    body: [
                        `**Server:** ${guild.name} | **Showing:** ${roles.length} roles (Highest to Lowest)`,
                        hierarchyLines,
                        `Hierarchy requested by ${sender.tag}`
                    ].join('\n\n'),
                    thumbnail: guild.iconURL({ dynamic: true }) || sender.displayAvatarURL({ dynamic: true })
                });

                return sendV2(interaction, hierarchyCard);
            }

            case 'massadd': {
                const role = interaction.options.getRole('role');
                const usersInput = interaction.options.getString('users');
                const reason = interaction.options.getString('reason') || lang.moderation.role.noReason;

                if (role.position >= interaction.guild.members.me.roles.highest.position ||
                    !canManageRole(interaction.member, role, guild)) {
                    return denyRoleHierarchy(role);
                }

                const userIds = usersInput.split(/\s+/).filter(id => id.match(/^\d+$/)).slice(0, 10);
                if (userIds.length === 0) {
                    return sendV2(interaction, cards.error(
                        'Invalid Input',
                        'Please provide valid user IDs separated by spaces.'
                    ));
                }

                let success = 0;
                let failed = 0;
                const results = [];

                for (const userId of userIds) {
                    try {
                        const member = guild.members.cache.get(userId) || await guild.members.fetch(userId).catch(() => null);
                        if (!member) {
                            failed++;
                            results.push(`• \`${userId}\` — Not in server`);
                            continue;
                        }
                        if (!canManageMemberRole(interaction.member, member, role, guild)) {
                            failed++;
                            results.push(`• **${member.user.tag}** — Outside your role hierarchy`);
                            continue;
                        }
                        if (member.roles.cache.has(role.id)) {
                            results.push(`• **${member.user.tag}** — Already has role`);
                            continue;
                        }
                        await member.roles.add(role, `${reason} | Mass added by ${sender.tag}`);
                        success++;
                        results.push(`• **${member.user.tag}** — Added`);
                    } catch (err) {
                        failed++;
                        results.push(`• \`${userId}\` — Failed`);
                    }
                }

                const resultCard = buildCard({
                    accent: ACCENT.success,
                    title: lang.moderation.role.addallTitle,
                    body: [
                        `**Role:** ${role.name}`,
                        `**Total Users:** ${userIds.length} | **Success:** ${success} | **Failed:** ${failed}`,
                        `\n**Results:**\n${results.join('\n')}`,
                        `\n**Reason:** ${reason}\n**Executed By:** ${sender.tag}`
                    ].join('\n')
                });

                return sendV2(interaction, resultCard);
            }

            case 'massremove': {
                const role = interaction.options.getRole('role');
                const usersInput = interaction.options.getString('users');
                const reason = interaction.options.getString('reason') || lang.moderation.role.noReason;

                if (role.position >= interaction.guild.members.me.roles.highest.position ||
                    !canManageRole(interaction.member, role, guild)) {
                    return denyRoleHierarchy(role);
                }

                const userIds = usersInput.split(/\s+/).filter(id => id.match(/^\d+$/)).slice(0, 10);
                if (userIds.length === 0) {
                    return sendV2(interaction, cards.error(
                        'Invalid Input',
                        'Please provide valid user IDs separated by spaces.'
                    ));
                }

                let success = 0;
                let failed = 0;
                const results = [];

                for (const userId of userIds) {
                    try {
                        const member = guild.members.cache.get(userId) || await guild.members.fetch(userId).catch(() => null);
                        if (!member) {
                            failed++;
                            results.push(`• \`${userId}\` — Not in server`);
                            continue;
                        }
                        if (!canManageMemberRole(interaction.member, member, role, guild)) {
                            failed++;
                            results.push(`• **${member.user.tag}** — Outside your role hierarchy`);
                            continue;
                        }
                        if (!member.roles.cache.has(role.id)) {
                            results.push(`• **${member.user.tag}** — Does not have role`);
                            continue;
                        }
                        await member.roles.remove(role, `${reason} | Mass removed by ${sender.tag}`);
                        success++;
                        results.push(`• **${member.user.tag}** — Removed`);
                    } catch (err) {
                        failed++;
                        results.push(`• \`${userId}\` — Failed`);
                    }
                }

                const resultCard = buildCard({
                    accent: ACCENT.danger,
                    title: lang.moderation.role.removeallTitle,
                    body: [
                        `**Role:** ${role.name}`,
                        `**Total Users:** ${userIds.length} | **Success:** ${success} | **Failed:** ${failed}`,
                        `\n**Results:**\n${results.join('\n')}`,
                        `\n**Reason:** ${reason}\n**Executed By:** ${sender.tag}`
                    ].join('\n')
                });

                return sendV2(interaction, resultCard);
            }

            case 'permissions': {
                const role = interaction.options.getRole('role');
                const action = interaction.options.getString('action');
                if (action === 'view') {
                    const permissions = role.permissions.toArray();

                    const permsCard = buildCard({
                        accent: role.color || ACCENT.info,
                        title: `Role Permissions: ${role.name}`,
                        body: [
                            `**Action:** ${action.toUpperCase()}`,
                            `**Total Permissions:** ${permissions.length}`,
                            `**Administrator:** ${permissions.includes('Administrator') ? 'Yes' : 'No'}`,
                            `\n**Key Permissions:**\n${permissions.slice(0, 15).map(p => `• ${p}`).join('\n')}${permissions.length > 15 ? `\n*+${permissions.length - 15} more permissions...*` : ''}`
                        ].join('\n')
                    });

                    return sendV2(interaction, permsCard);
                }

                if (role.id === guild.id) {
                    return sendV2(interaction, cards.warning(
                        'Everyone Role Protected',
                        'The @everyone role cannot be changed through this command.'
                    ));
                }

                if (!canManageRole(interaction.member, role, guild)) return denyRoleHierarchy(role);
                const botMember = guild.members.me;
                if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles) || role.position >= botMember.roles.highest.position) {
                    return sendV2(interaction, cards.error(
                        lang.moderation.role.insufficientHierarchyTitle,
                        'The bot needs Manage Roles and a role above the selected role to edit its permissions.'
                    ));
                }

                const permissionName = interaction.options.getString('permission');
                if ((action === 'add' || action === 'remove') && !permissionName) {
                    return sendV2(interaction, cards.warning(
                        'Permission Required',
                        'Choose a permission when adding or removing one.'
                    ));
                }

                let updatedPermissions;
                try {
                    updatedPermissions = buildRolePermissionUpdate(
                        role.permissions,
                        action,
                        permissionName,
                        interaction.member.permissions
                    );
                } catch (error) {
                    return sendV2(interaction, cards.error(
                        'Permission Change Denied',
                        error.message
                    ));
                }

                const reason = interaction.options.getString('reason') || `Role permissions ${action} by ${sender.tag}`;
                try {
                    await role.setPermissions(updatedPermissions, reason);
                } catch (error) {
                    console.error('[Role] Permission update failed:', error);
                    return sendV2(interaction, cards.error(
                        'Permission Update Failed',
                        'Discord could not update this role. Confirm the bot has Manage Roles and is above the selected role, then try again.'
                    ));
                }

                const updatedNames = updatedPermissions.toArray();
                return sendV2(interaction, cards.success(
                    'Role Permissions Updated',
                    `**Role:** ${role.name}\n**Action:** ${action}\n**Permission count:** ${updatedNames.length}\n**Reason:** ${reason}`
                ));
            }

            case 'cleanup': {
                return sendV2(interaction, cards.warning(
                    'Role Cleanup Unavailable',
                    'This command does not track member activity yet, so it cannot safely identify inactive members. No roles were changed.'
                ));
            }

            default: {
                return sendV2(interaction, cards.error(
                    lang.moderation.role.unknownSubcommandTitle,
                    lang.moderation.role.unknownSubcommand({ command: subcommand })
                ));
            }
        }
    }
};
