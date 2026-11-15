

'use strict';

const {
    SlashCommandBuilder,
    PermissionFlagsBits
} = require('discord.js');
const QuarantineConfig = require('../../models/qurantine/quarantineConfig');
const UserQuarantine = require('../../models/qurantine/userQuarantine');
const LogConfig = require('../../models/serverLogs/LogConfig');
const checkPermissions = require('../../utils/checkPermissions');
const { canModerateMember } = require('../../utils/moderationPermissionPolicy');
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
        quarantine: createInterpolatableProxy(rawLang.moderation?.quarantine),
        common: createInterpolatableProxy(rawLang.moderation?.common),
    }
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('quarantine')
        .setDescription('Advanced quarantine system management')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild | PermissionFlagsBits.ManageRoles)
        .addSubcommand(subcommand =>
            subcommand.setName('add')
                .setDescription('Put a user in quarantine with role isolation')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to quarantine')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for quarantine')
                        .setRequired(false))
        )
        .addSubcommand(subcommand =>
            subcommand.setName('remove')
                .setDescription('Release a user from quarantine and restore roles')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to release')
                        .setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand.setName('status')
                .setDescription('Check quarantine status of a user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to check')
                        .setRequired(true))
        )
        .addSubcommand(subcommand =>
            subcommand.setName('list')
                .setDescription('List all quarantined users in the server')
                .addIntegerOption(option =>
                    option.setName('limit')
                        .setDescription('Maximum users to show (1-20)')
                        .setRequired(false)
                        .setMinValue(1)
                        .setMaxValue(20))
        )
        .addSubcommand(subcommand =>
            subcommand.setName('help')
                .setDescription('Show comprehensive quarantine system help')
        ),

    async execute(interaction) {
        await deferReply(interaction);

        if (!await checkPermissions(interaction, 'admin')) return;

        const subcommand = interaction.options.getSubcommand();
        const target = interaction.options.getUser('user');
        const guildId = interaction.guild.id;
        const guild = interaction.guild;
        const sender = interaction.user;
        const member = target
            ? guild.members.cache.get(target.id) || await guild.members.fetch(target.id).catch(() => null)
            : null;

        if (['add', 'remove'].includes(subcommand) &&
            !interaction.member?.permissions?.has(PermissionFlagsBits.ManageRoles)) {
            return sendV2(interaction, cards.error(
                lang.moderation.quarantine.accessDeniedTitle || 'Access Denied',
                'You need the Manage Roles permission to quarantine or release members.'
            ));
        }

        const sendModerationLog = async (action, targetMember, reason, moderator) => {
            try {
                const logConfig = await LogConfig.findOne({ guildId, eventType: 'moderationLogs' });
                if (!logConfig || !logConfig.channelId) return;

                const logChannel = guild.channels.cache.get(logConfig.channelId);
                if (!logChannel) return;

                const title = action === 'quarantine'
                    ? `${getEmoji('warning')} User Quarantined`
                    : `${getEmoji('tick')} User Released from Quarantine`;

                const logCard = buildCard({
                    title,
                    description: `**User:** ${targetMember.user.tag} (${targetMember.id})\n` +
                        `**Moderator:** ${moderator.tag} (${moderator.id})\n` +
                        `**Action:** ${action === 'quarantine' ? 'Quarantined' : 'Released'}\n` +
                        `**Reason:** ${reason || lang.moderation.quarantine.noReason}\n` +
                        `**Timestamp:** <t:${Math.floor(Date.now() / 1000)}:F>`,
                    accentColor: action === 'quarantine' ? ACCENT.danger : ACCENT.success
                });

                await sendV2(logChannel, logCard);
            } catch (error) {
                console.error('[Quarantine Log Error]:', error);
            }
        };

        const config = await QuarantineConfig.findOne({ guildId });
        if (!config || !config.quarantineEnabled) {
            const card = cards.error(
                'Quarantine Disabled',
                lang.moderation.quarantine.disabledTitle
            );
            return await sendV2(interaction, card);
        }

        if (subcommand === 'help') {
            const card = buildCard({
                title: `${getEmoji('security')} ${lang.moderation.quarantine.helpTitle}`,
                thumbnailURL: sender.displayAvatarURL({ dynamic: true }),
                sections: [
                    lang.moderation.quarantine.helpDesc,
                    lang.moderation.quarantine.helpCommands,
                    lang.moderation.quarantine.helpFeatures,
                    lang.moderation.quarantine.helpExamples,
                    lang.moderation.quarantine.helpNotes({ user: sender.tag })
                ],
                accentColor: ACCENT.primary
            });

            return await sendV2(interaction, card);
        }

        if (subcommand === 'status') {
            if (!member) {
                const card = cards.error(
                    'Member Not Found',
                    lang.moderation.quarantine.userNotFoundMsg({ user: target.tag })
                );
                return await sendV2(interaction, card);
            }

            const userQuarantine = await UserQuarantine.findOne({ userId: target.id, guildId });
            const isQuarantined = Boolean(userQuarantine && userQuarantine.isQuarantined);

            const details = isQuarantined
                ? lang.moderation.quarantine.detailsQuarantined({
                    reason: userQuarantine.reason || lang.moderation.quarantine.noReason,
                    since: `<t:${Math.floor(userQuarantine.quarantinedAt / 1000)}:F>`,
                    duration: `<t:${Math.floor(userQuarantine.quarantinedAt / 1000)}:R>`,
                    count: String(config.userRoles?.get(target.id)?.length || 0)
                })
                : lang.moderation.quarantine.detailsFree({
                    count: String(member.roles.cache.size - 1),
                    last: userQuarantine ? `<t:${Math.floor(userQuarantine.quarantinedAt / 1000)}:F>` : lang.moderation.quarantine.neverQuarantined
                });

            const card = buildCard({
                title: `${getEmoji('search')} ${lang.moderation.quarantine.statusCheck}`,
                thumbnailURL: target.displayAvatarURL({ dynamic: true }),
                sections: [
                    lang.moderation.quarantine.statusTarget({
                        user: target.tag,
                        status: isQuarantined ? lang.moderation.quarantine.statusQuarantined : lang.moderation.quarantine.statusFree,
                        moderator: sender.tag,
                        time: `<t:${Math.floor(Date.now() / 1000)}:F>`
                    }),
                    details,
                    lang.moderation.quarantine.statusFooter({ id: target.id })
                ],
                accentColor: isQuarantined ? ACCENT.danger : ACCENT.success
            });

            return await sendV2(interaction, card);
        }

        if (subcommand === 'list') {
            const limit = interaction.options.getInteger('limit') || 10;
            const quarantinedUsers = await UserQuarantine.find({
                guildId,
                isQuarantined: true
            }).limit(limit);

            let contentSection;
            if (quarantinedUsers.length === 0) {
                contentSection = lang.moderation.quarantine.noQuarantinedMsg;
            } else {
                const userList = await Promise.all(quarantinedUsers.map(async (userData, index) => {
                    try {
                        const u = guild.members.cache.get(userData.userId) || await guild.members.fetch(userData.userId).catch(() => null);
                        if (!u) {
                            return lang.moderation.quarantine.unknownUser({
                                index: String(index + 1),
                                id: userData.userId,
                                reason: userData.reason || lang.moderation.quarantine.noReason
                            });
                        }
                        const quarantineDuration = Math.floor((Date.now() - userData.quarantinedAt) / (1000 * 60 * 60 * 24));
                        return lang.moderation.quarantine.activeUserEntry({
                            index: String(index + 1),
                            user: u.user.tag,
                            reason: userData.reason || lang.moderation.quarantine.noReason,
                            duration: String(quarantineDuration),
                            id: userData.userId
                        });
                    } catch (_) {
                        return lang.moderation.quarantine.unknownUser({
                            index: String(index + 1),
                            id: userData.userId,
                            reason: userData.reason || lang.moderation.quarantine.noReason
                        });
                    }
                }));

                contentSection = lang.moderation.quarantine.activeQuarantinesHeader({ list: userList.join('\n\n') });
            }

            const statsSection = lang.moderation.quarantine.listStats({
                count: String(quarantinedUsers.length),
                status: config.quarantineEnabled ? lang.moderation.quarantine.active : lang.moderation.quarantine.disabled,
                role: guild.roles.cache.get(config.quarantineRoleId)?.name || lang.moderation.quarantine.roleNotFoundShort,
                moderator: sender.tag
            });

            const card = buildCard({
                title: `${getEmoji('warning')} ${lang.moderation.quarantine.listTitleHeader}`,
                thumbnailURL: guild.iconURL({ dynamic: true }) || sender.displayAvatarURL({ dynamic: true }),
                sections: [
                    lang.moderation.quarantine.listHeader({
                        guild: guild.name,
                        count: String(quarantinedUsers.length),
                        showing: String(Math.min(quarantinedUsers.length, limit)),
                        time: `<t:${Math.floor(Date.now() / 1000)}:F>`
                    }),
                    contentSection,
                    statsSection
                ],
                accentColor: ACCENT.warning
            });

            return await sendV2(interaction, card);
        }

        if (subcommand === 'add') {
            if (!member) {
                const card = cards.error(
                    'Member Not Found',
                    lang.moderation.quarantine.userNotFoundMsg({ user: target.tag })
                );
                return await sendV2(interaction, card);
            }

            const reason = interaction.options.getString('reason') || lang.moderation.quarantine.noReason;
            const quarantineRole = interaction.guild.roles.cache.get(config.quarantineRoleId);

            if (!quarantineRole) {
                const card = cards.error(
                    'Role Not Found',
                    lang.moderation.quarantine.roleNotFound
                );
                return await sendV2(interaction, card);
            }

            const botMember = guild.members.me;
            if (!member.manageable || !canModerateMember(interaction.member, member, guild) ||
                !canManageRole(interaction.member, quarantineRole, guild) ||
                !botMember?.permissions.has(PermissionFlagsBits.ManageRoles) ||
                quarantineRole.position >= botMember.roles.highest.position) {
                return sendV2(interaction, cards.error(
                    lang.moderation.quarantine.hierarchyErrorTitle || 'Hierarchy Error',
                    lang.moderation.quarantine.hierarchyError || 'You or the bot cannot manage this member or the quarantine role.'
                ));
            }

            const restorableRoles = member.roles.cache
                .filter(role => role.id !== guild.id && role.id !== quarantineRole.id && !role.managed);
            const cannotRestoreRoles = restorableRoles.filter(role =>
                !canManageRole(interaction.member, role, guild) ||
                !canGrantRolePermissions(interaction.member, role.permissions) ||
                role.position >= botMember.roles.highest.position
            );
            if (cannotRestoreRoles.size) {
                return sendV2(interaction, cards.error(
                    lang.moderation.quarantine.hierarchyErrorTitle || 'Hierarchy Error',
                    'You or the bot cannot safely restore one or more of this member’s existing roles. No changes were made.'
                ));
            }

            const existingQuarantine = await UserQuarantine.findOne({ userId: target.id, guildId });
            if (existingQuarantine && existingQuarantine.isQuarantined) {
                const card = cards.warning(
                    'Already Quarantined',
                    lang.moderation.quarantine.alreadyQuarantinedMsg({
                        user: target.tag,
                        reason: existingQuarantine.reason || lang.moderation.quarantine.noReason,
                        since: `<t:${Math.floor(existingQuarantine.quarantinedAt / 1000)}:R>`
                    })
                );
                return await sendV2(interaction, card);
            }

            try {
                const userRoles = member.roles.cache.map(role => role.id);
                await member.roles.set([quarantineRole]);

                await UserQuarantine.findOneAndUpdate(
                    { userId: target.id, guildId },
                    { isQuarantined: true, quarantinedAt: new Date(), reason },
                    { upsert: true }
                );

                config.userRoles.set(target.id, userRoles);
                await config.save();

                await sendModerationLog('quarantine', member, reason, sender);

                const dmCard = buildCard({
                    title: `${getEmoji('warning')} ${lang.moderation.quarantine.addDmTitle}`,
                    thumbnailURL: interaction.guild.iconURL({ dynamic: true }) || sender.displayAvatarURL({ dynamic: true }),
                    sections: [
                        lang.moderation.quarantine.addDmInfo({
                            guild: interaction.guild.name,
                            time: `<t:${Math.floor(Date.now() / 1000)}:F>`
                        }),
                        lang.moderation.quarantine.addDmReason({ reason }),
                        lang.moderation.quarantine.addDmImportant,
                        lang.moderation.quarantine.addDmFooter({
                            id: target.id,
                            guild: interaction.guild.name
                        })
                    ],
                    accentColor: ACCENT.danger
                });

                try {
                    await sendV2(member, dmCard);
                } catch (_) { }

                const successCard = buildCard({
                    title: `${getEmoji('tick')} ${lang.moderation.quarantine.addSuccessTitle}`,
                    thumbnailURL: target.displayAvatarURL({ dynamic: true }),
                    sections: [
                        lang.moderation.quarantine.addSuccessInfo({
                            user: target.tag,
                            moderator: sender.tag,
                            time: `<t:${Math.floor(Date.now() / 1000)}:F>`,
                            role: quarantineRole.name
                        }),
                        lang.moderation.quarantine.addSuccessDetails({
                            reason,
                            roles: String(userRoles.length - 1),
                            dmStatus: member.dmChannel ? lang.moderation.quarantine.dmSent : lang.moderation.quarantine.dmFailed
                        }),
                        lang.moderation.quarantine.addSuccessSecurity({ id: target.id })
                    ],
                    accentColor: ACCENT.danger
                });

                return await sendV2(interaction, successCard);
            } catch (error) {
                console.error('[Quarantine Add Error]:', error);
                const card = cards.error(
                    'Operation Failed',
                    lang.moderation.quarantine.addFailed({ user: target.tag })
                );
                return await sendV2(interaction, card);
            }
        }

        if (subcommand === 'remove') {
            if (!member) {
                const card = cards.error(
                    'Member Not Found',
                    lang.moderation.quarantine.userNotFoundMsg({ user: target.tag })
                );
                return await sendV2(interaction, card);
            }

            const userQuarantine = await UserQuarantine.findOne({ userId: target.id, guildId });

            if (!userQuarantine || !userQuarantine.isQuarantined) {
                const card = cards.warning(
                    'Not Quarantined',
                    lang.moderation.quarantine.notQuarantinedMsg({ user: target.tag })
                );
                return await sendV2(interaction, card);
            }

            const botMember = guild.members.me;
            const quarantineRole = guild.roles.cache.get(config.quarantineRoleId);
            const previousRoleIds = config.userRoles.get(target.id) || [];
            const restorableRoles = previousRoleIds
                .map(roleId => guild.roles.cache.get(roleId))
                .filter(role => role && role.id !== config.quarantineRoleId && role.id !== guild.id && !role.managed);
            const quarantineRoleIsManageable = !quarantineRole || canManageRole(interaction.member, quarantineRole, guild);
            const cannotRestoreRoles = restorableRoles.filter(role =>
                !canManageRole(interaction.member, role, guild) ||
                !canGrantRolePermissions(interaction.member, role.permissions) ||
                !botMember || role.position >= botMember.roles.highest.position
            );
            if (!member.manageable || !canModerateMember(interaction.member, member, guild) ||
                !quarantineRoleIsManageable || !botMember?.permissions.has(PermissionFlagsBits.ManageRoles) ||
                (quarantineRole && quarantineRole.position >= botMember.roles.highest.position) ||
                cannotRestoreRoles.size) {
                return sendV2(interaction, cards.error(
                    lang.moderation.quarantine.hierarchyErrorTitle || 'Hierarchy Error',
                    'You or the bot cannot safely release this member and restore the saved roles.'
                ));
            }

            try {
                await UserQuarantine.findOneAndUpdate(
                    { userId: target.id, guildId },
                    { isQuarantined: false }
                );


                const validRoles = previousRoleIds
                    .map(roleId => interaction.guild.roles.cache.get(roleId))
                    .filter(role => role && role.id !== config.quarantineRoleId && role.id !== interaction.guild.id);

                if (quarantineRole && member.roles.cache.has(quarantineRole.id)) {
                    await member.roles.remove(quarantineRole).catch(() => { });
                }

                if (validRoles.length > 0) {
                    const currentRoles = member.roles.cache
                        .filter(role => role.id !== interaction.guild.id && role.id !== config.quarantineRoleId)
                        .map(role => role);

                    const rolesToSet = [...new Set([...currentRoles, ...validRoles].map(r => r.id))]
                        .map(id => interaction.guild.roles.cache.get(id))
                        .filter(role => role && role.id !== interaction.guild.id && role.id !== config.quarantineRoleId);

                    await member.roles.set(rolesToSet).catch(err => {
                        for (const role of validRoles) {
                            member.roles.add(role).catch(() => { });
                        }
                    });
                } else {
                    if (quarantineRole && member.roles.cache.has(quarantineRole.id)) {
                        await member.roles.remove(quarantineRole).catch(() => { });
                    }
                }

                config.userRoles.delete(target.id);
                await config.save();

                await sendModerationLog('release', member, userQuarantine.reason, sender);

                const dmCard = buildCard({
                    title: `${getEmoji('tick')} ${lang.moderation.quarantine.removeDmTitle}`,
                    thumbnailURL: interaction.guild.iconURL({ dynamic: true }) || sender.displayAvatarURL({ dynamic: true }),
                    sections: [
                        lang.moderation.quarantine.removeDmInfo({
                            guild: interaction.guild.name,
                            time: `<t:${Math.floor(Date.now() / 1000)}:F>`
                        }),
                        lang.moderation.quarantine.removeDmWelcome,
                        lang.moderation.quarantine.removeDmDetails({
                            count: String(validRoles.length),
                            duration: `<t:${Math.floor(userQuarantine.quarantinedAt / 1000)}:R>`
                        }),
                        lang.moderation.quarantine.removeDmFooter({
                            id: target.id,
                            guild: interaction.guild.name
                        })
                    ],
                    accentColor: ACCENT.success
                });

                try {
                    await sendV2(member, dmCard);
                } catch (_) { }

                const successCard = buildCard({
                    title: `${getEmoji('tick')} ${lang.moderation.quarantine.removeSuccessTitle}`,
                    thumbnailURL: target.displayAvatarURL({ dynamic: true }),
                    sections: [
                        lang.moderation.quarantine.removeSuccessInfo({
                            user: target.tag,
                            moderator: sender.tag,
                            time: `<t:${Math.floor(Date.now() / 1000)}:F>`,
                            duration: `<t:${Math.floor(userQuarantine.quarantinedAt / 1000)}:R>`
                        }),
                        lang.moderation.quarantine.removeSuccessDetails({
                            reason: userQuarantine.reason || lang.moderation.quarantine.noReason,
                            count: String(validRoles.length),
                            dmStatus: member.dmChannel ? lang.moderation.quarantine.dmSent : lang.moderation.quarantine.dmFailed
                        }),
                        lang.moderation.quarantine.removeSuccessRestored({ id: target.id })
                    ],
                    accentColor: ACCENT.success
                });

                return await sendV2(interaction, successCard);
            } catch (error) {
                console.error('[Quarantine Remove Error]:', error);
                const card = cards.error(
                    'Operation Failed',
                    lang.moderation.quarantine.removeFailed({ user: target.tag })
                );
                return await sendV2(interaction, card);
            }
        }
    }
};
