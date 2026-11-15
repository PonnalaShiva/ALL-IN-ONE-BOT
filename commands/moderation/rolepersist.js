


'use strict';

const { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
} = require('discord.js');
const RolePersist = require('../../models/moderation/rolePersist');
const ServerConfig = require('../../models/serverConfig/schema');
const checkPermissions = require('../../utils/checkPermissions');
const { canManageRole, canGrantRolePermissions } = require('../../utils/roleAuthorization');
const { getEmoji } = require('../../UI/emojis/emoji');
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
        rolePersist: createInterpolatableProxy(rawLang.moderation?.rolePersist),
        common: createInterpolatableProxy(rawLang.moderation?.common),
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rolepersist')
        .setDescription('Persist roles for members even after leaving')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Add a persistent role for a user')
                .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
                .addRoleOption(opt => opt.setName('role').setDescription('Role to persist').setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Remove a persistent role from a user')
                .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true))
                .addRoleOption(opt => opt.setName('role').setDescription('Role to remove').setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('List persistent roles for a user')
                .addUserOption(opt => opt.setName('user').setDescription('Target user').setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('enable')
                .setDescription('Enable Role Persist system for this server'))
        .addSubcommand(sub =>
            sub.setName('disable')
                .setDescription('Disable Role Persist system for this server')),

    async execute(interaction) {
        await deferReply(interaction);

        if (!await checkPermissions(interaction, 'admin')) return;

        if (!interaction.member?.permissions?.has(PermissionFlagsBits.ManageRoles)) {
            return sendV2(interaction, cards.error(
                lang.moderation.common.accessDeniedTitle || 'Access Denied',
                lang.moderation.common.manageRolesRequired || 'You need Manage Roles to configure persistent roles.'
            ));
        }

        const subcommand = interaction.options.getSubcommand();
        const guild = interaction.guild;

        try {
            switch (subcommand) {
                case 'enable': {
                    await ServerConfig.findOneAndUpdate(
                        { serverId: guild.id },
                        { rolePersistEnabled: true },
                        { upsert: true }
                    );
                    const card = cards.success(
                        lang.moderation.rolePersist.enabledTitle,
                        lang.moderation.rolePersist.enabled
                    );
                    return await sendV2(interaction, card);
                }

                case 'disable': {
                    await ServerConfig.findOneAndUpdate(
                        { serverId: guild.id },
                        { rolePersistEnabled: false },
                        { upsert: true }
                    );
                    const card = cards.warning(
                        lang.moderation.rolePersist.disabledTitle,
                        lang.moderation.rolePersist.disabled
                    );
                    return await sendV2(interaction, card);
                }

                case 'add': {
                    const user = interaction.options.getUser('user');
                    const role = interaction.options.getRole('role');

                    
                    const botMember = guild.members.me;
                    if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles) ||
                        role.position >= botMember.roles.highest.position ||
                        !canManageRole(interaction.member, role, guild) ||
                        !canGrantRolePermissions(interaction.member, role.permissions)) {
                        const card = cards.error(
                            lang.moderation.rolePersist.roleTooHighTitle,
                            lang.moderation.rolePersist.roleTooHigh ||
                                'You or the bot cannot safely assign this role under the current permissions and role hierarchy.'
                        );
                        return await sendV2(interaction, card);
                    }

                    const userData = await RolePersist.findOne({ guildId: guild.id, $or: [{ userId: user.id }, { oderId: user.id }] });

                    if (userData && userData.roles.includes(role.id)) {
                        const card = cards.warning(
                            lang.moderation.rolePersist.alreadyPersistentTitle,
                            lang.moderation.rolePersist.alreadyPersistent({
                                role: role.name,
                                user: user.tag
                            })
                        );
                        return await sendV2(interaction, card);
                    }

                    await RolePersist.findOneAndUpdate(
                        { guildId: guild.id, userId: user.id },
                        { $addToSet: { roles: role.id }, $set: { oderId: user.id } },
                        { upsert: true }
                    );

                    const card = cards.success(
                        lang.moderation.rolePersist.roleAddedTitle,
                        lang.moderation.rolePersist.roleAdded({
                            role: role.name,
                            user: user.tag
                        })
                    );
                    return await sendV2(interaction, card);
                }

                case 'remove': {
                    const user = interaction.options.getUser('user');
                    const role = interaction.options.getRole('role');

                    const userData = await RolePersist.findOne({ guildId: guild.id, $or: [{ userId: user.id }, { oderId: user.id }] });

                    if (!userData || !userData.roles.includes(role.id)) {
                        const card = cards.error(
                            lang.moderation.rolePersist.notFoundTitle,
                            lang.moderation.rolePersist.notFound({
                                role: role.name,
                                user: user.tag
                            })
                        );
                        return await sendV2(interaction, card);
                    }

                    await RolePersist.findOneAndUpdate(
                        { guildId: guild.id, $or: [{ userId: user.id }, { oderId: user.id }] },
                        { $pull: { roles: role.id } }
                    );

                    const card = cards.success(
                        lang.moderation.rolePersist.roleRemovedTitle,
                        lang.moderation.rolePersist.roleRemoved({
                            role: role.name,
                            user: user.tag
                        })
                    );
                    return await sendV2(interaction, card);
                }

                case 'list': {
                    const user = interaction.options.getUser('user');

                    const userData = await RolePersist.findOne({ guildId: guild.id, $or: [{ userId: user.id }, { oderId: user.id }] });

                    const title = `${getEmoji('list')} ${lang.moderation.rolePersist.listTitle({ user: user.tag })}`;

                    if (!userData || userData.roles.length === 0) {
                        const card = buildCard({
                            title,
                            description: lang.moderation.rolePersist.noRoles({ user: user.tag }),
                            accentColor: ACCENT.primary
                        });
                        return await sendV2(interaction, card);
                    }

                    const roleList = userData.roles.map(roleId => {
                        const role = guild.roles.cache.get(roleId);
                        return role ? `• ${role.name}` : `• Unknown (${roleId})`;
                    }).join('\n');

                    const card = buildCard({
                        title,
                        description: roleList,
                        accentColor: ACCENT.primary
                    });
                    return await sendV2(interaction, card);
                }
            }
        } catch (error) {
            console.error('[RolePersist] Error:', error);
            const card = cards.error(
                'Error',
                error.message || 'An error occurred while processing the role persist request.'
            );
            return await sendV2(interaction, card);
        }
    }
};
