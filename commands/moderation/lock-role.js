


'use strict';

const { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
} = require('discord.js');
const LockRole = require('../../models/moderation/lockRole');
const ServerConfig = require('../../models/serverConfig/schema');
const checkPermissions = require('../../utils/checkPermissions');
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
        lockRole: createInterpolatableProxy(rawLang.moderation?.lockRole),
        common: createInterpolatableProxy(rawLang.moderation?.common),
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lock-role')
        .setDescription('Lock Role protection system')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(sub =>
            sub.setName('add')
                .setDescription('Lock a role for protection')
                .addRoleOption(opt => opt.setName('role').setDescription('Role to lock').setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('remove')
                .setDescription('Unlock a role')
                .addRoleOption(opt => opt.setName('role').setDescription('Role to unlock').setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('whitelist-add')
                .setDescription('Add user to role whitelist')
                .addRoleOption(opt => opt.setName('role').setDescription('Locked role').setRequired(true))
                .addUserOption(opt => opt.setName('user').setDescription('User to whitelist').setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('whitelist-remove')
                .setDescription('Remove user from role whitelist')
                .addRoleOption(opt => opt.setName('role').setDescription('Locked role').setRequired(true))
                .addUserOption(opt => opt.setName('user').setDescription('User to remove').setRequired(true)))
        .addSubcommand(sub =>
            sub.setName('punishment')
                .setDescription('Set punishment for unauthorized actions')
                .addRoleOption(opt => opt.setName('role').setDescription('Locked role').setRequired(true))
                .addStringOption(opt =>
                    opt.setName('type')
                        .setDescription('Punishment type')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Log Only', value: 'log' },
                            { name: 'Kick User', value: 'kick' },
                            { name: 'Ban User', value: 'ban' }
                        )))
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('List all locked roles'))
        .addSubcommand(sub =>
            sub.setName('enable')
                .setDescription('Enable Lock Role system for this server'))
        .addSubcommand(sub =>
            sub.setName('disable')
                .setDescription('Disable Lock Role system for this server')),

    async execute(interaction) {
        await deferReply(interaction);

        if (!await checkPermissions(interaction, 'admin')) return;

        if (!interaction.member?.permissions?.has(PermissionFlagsBits.Administrator)) {
            return sendV2(interaction, cards.error(
                lang.moderation.common.accessDeniedTitle || 'Access Denied',
                lang.moderation.common.adminRequired || 'Administrator permission is required to use this command.'
            ));
        }

        const subcommand = interaction.options.getSubcommand();
        const guild = interaction.guild;

        try {
            switch (subcommand) {
                case 'enable': {
                    await ServerConfig.findOneAndUpdate(
                        { serverId: guild.id },
                        { lockRoleEnabled: true },
                        { upsert: true }
                    );
                    const card = cards.success(
                        lang.moderation.lockRole.enabledTitle,
                        lang.moderation.lockRole.enabled
                    );
                    return await sendV2(interaction, card);
                }

                case 'disable': {
                    await ServerConfig.findOneAndUpdate(
                        { serverId: guild.id },
                        { lockRoleEnabled: false },
                        { upsert: true }
                    );
                    const card = cards.warning(
                        lang.moderation.lockRole.disabledTitle,
                        lang.moderation.lockRole.disabled
                    );
                    return await sendV2(interaction, card);
                }

                case 'add': {
                    const role = interaction.options.getRole('role');

                    const existing = await LockRole.findOne({ guildId: guild.id, roleId: role.id });
                    if (existing) {
                        const card = cards.warning(
                            lang.moderation.lockRole.alreadyLockedTitle,
                            lang.moderation.lockRole.alreadyLocked({ role: role.name })
                        );
                        return await sendV2(interaction, card);
                    }

                    await LockRole.create({
                        guildId: guild.id,
                        roleId: role.id,
                        whitelistedUsers: [interaction.user.id]
                    });

                    const card = cards.success(
                        lang.moderation.lockRole.lockedTitle,
                        `${lang.moderation.lockRole.locked({ role: role.name })}\n\n` +
                        `**Whitelisted:** ${interaction.user.tag}\n` +
                        `**Punishment:** ${lang.moderation.lockRole.punishments.log}`
                    );
                    return await sendV2(interaction, card);
                }

                case 'remove': {
                    const role = interaction.options.getRole('role');

                    const deleted = await LockRole.findOneAndDelete({ guildId: guild.id, roleId: role.id });
                    if (!deleted) {
                        const card = cards.error(
                            lang.moderation.lockRole.notFoundTitle,
                            lang.moderation.lockRole.notFound({ role: role.name })
                        );
                        return await sendV2(interaction, card);
                    }

                    const card = cards.success(
                        lang.moderation.lockRole.unlockedTitle,
                        lang.moderation.lockRole.unlocked({ role: role.name })
                    );
                    return await sendV2(interaction, card);
                }

                case 'whitelist-add': {
                    const role = interaction.options.getRole('role');
                    const user = interaction.options.getUser('user');

                    const lockData = await LockRole.findOne({ guildId: guild.id, roleId: role.id });
                    if (!lockData) {
                        const card = cards.error(
                            lang.moderation.lockRole.notLockedTitle,
                            lang.moderation.lockRole.notLocked({ role: role.name })
                        );
                        return await sendV2(interaction, card);
                    }

                    if (lockData.whitelistedUsers.includes(user.id)) {
                        const card = cards.warning(
                            lang.moderation.lockRole.alreadyWhitelistedTitle,
                            lang.moderation.lockRole.alreadyWhitelisted({
                                user: user.tag,
                                role: role.name
                            })
                        );
                        return await sendV2(interaction, card);
                    }

                    lockData.whitelistedUsers.push(user.id);
                    await lockData.save();

                    const card = cards.success(
                        lang.moderation.lockRole.whitelistedTitle,
                        lang.moderation.lockRole.whitelisted({
                            user: user.tag,
                            role: role.name
                        })
                    );
                    return await sendV2(interaction, card);
                }

                case 'whitelist-remove': {
                    const role = interaction.options.getRole('role');
                    const user = interaction.options.getUser('user');

                    const lockData = await LockRole.findOne({ guildId: guild.id, roleId: role.id });
                    if (!lockData) {
                        const card = cards.error(
                            lang.moderation.lockRole.notLockedTitle,
                            lang.moderation.lockRole.notLocked({ role: role.name })
                        );
                        return await sendV2(interaction, card);
                    }

                    const index = lockData.whitelistedUsers.indexOf(user.id);
                    if (index === -1) {
                        const card = cards.warning(
                            lang.moderation.lockRole.notWhitelistedTitle,
                            lang.moderation.lockRole.notWhitelisted({
                                user: user.tag,
                                role: role.name
                            })
                        );
                        return await sendV2(interaction, card);
                    }

                    lockData.whitelistedUsers.splice(index, 1);
                    await lockData.save();

                    const card = cards.success(
                        lang.moderation.lockRole.whitelistRemovedTitle,
                        lang.moderation.lockRole.whitelistRemoved({
                            user: user.tag,
                            role: role.name
                        })
                    );
                    return await sendV2(interaction, card);
                }

                case 'punishment': {
                    const role = interaction.options.getRole('role');
                    const type = interaction.options.getString('type');

                    const lockData = await LockRole.findOne({ guildId: guild.id, roleId: role.id });
                    if (!lockData) {
                        const card = cards.error(
                            lang.moderation.lockRole.notLockedTitle,
                            lang.moderation.lockRole.notLocked({ role: role.name })
                        );
                        return await sendV2(interaction, card);
                    }

                    lockData.punishment = type;
                    await lockData.save();

                    const typeLabel = lang.moderation.lockRole.punishments[type] || type;
                    const card = cards.success(
                        lang.moderation.lockRole.punishmentSetTitle,
                        lang.moderation.lockRole.punishmentSet({
                            role: role.name,
                            punishment: typeLabel
                        })
                    );
                    return await sendV2(interaction, card);
                }

                case 'list': {
                    const lockedRoles = await LockRole.find({ guildId: guild.id });

                    const title = `${getEmoji('lock')} ${lang.moderation.lockRole.listTitle}`;

                    if (lockedRoles.length === 0) {
                        const card = buildCard({
                            title,
                            description: lang.moderation.lockRole.noLockedRoles,
                            accentColor: ACCENT.primary
                        });
                        return await sendV2(interaction, card);
                    }

                    const roleList = lockedRoles.map(lr => {
                        const role = guild.roles.cache.get(lr.roleId);
                        const roleName = role ? role.name : `Unknown (${lr.roleId})`;
                        const punishmentLabel = lang.moderation.lockRole.punishments[lr.punishment] || lr.punishment;
                        return `• **${roleName}** - Punishment: ${punishmentLabel} - Whitelist: ${lr.whitelistedUsers.length} users`;
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
            console.error('[LockRole] Error:', error);
            const card = cards.error(
                'Error',
                error.message || 'An error occurred while processing the lock role request.'
            );
            return await sendV2(interaction, card);
        }
    }
};
