


'use strict';

const {
    SlashCommandBuilder,
    PermissionFlagsBits
} = require('discord.js');
const LogConfig = require('../../models/serverLogs/LogConfig');
const logHandlersIcons = require('../../UI/icons/loghandlers');
const checkPermissions = require('../../utils/checkPermissions');
const {
    hasModerationPermission,
    canModerateMember
} = require('../../utils/moderationPermissionPolicy');
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
        member: createInterpolatableProxy(rawLang.moderation?.member),
        common: createInterpolatableProxy(rawLang.moderation?.common),
    }
};

async function logModerationAction(action, executor, target, reason, guild, extra = {}) {
    try {
        const config = await LogConfig.findOne({
            guildId: guild.id,
            eventType: 'moderationLogs'
        });

        if (!config || !config.channelId) return;

        const logChannel = guild.channels.cache.get(config.channelId);
        if (!logChannel) return;

        const actionConfig = {
            'ban': {
                color: ACCENT.danger,
                title: 'Member Banned',
                description: 'User permanently removed from server'
            },
            'unban': {
                color: ACCENT.success,
                title: 'Member Unbanned',
                description: 'User ban removed, can rejoin'
            },
            'kick': {
                color: ACCENT.warning,
                title: 'Member Kicked',
                description: 'User removed from server'
            },
            'timeout': {
                color: 0x9b59b6,
                title: 'Member Timed Out',
                description: 'Communication restrictions applied'
            },
            'removetimeout': {
                color: ACCENT.success,
                title: 'Timeout Removed',
                description: 'Communication restrictions lifted'
            },
            'nickname': {
                color: ACCENT.info,
                title: 'Nickname Changed',
                description: 'Member nickname modified'
            },
            'warn': {
                color: 0xf1c40f,
                title: 'Warning Issued',
                description: 'Official warning sent to member'
            },
            'softban': {
                color: 0xff6b6b,
                title: 'Member Softbanned',
                description: 'Messages cleaned, user can rejoin'
            },
            'dm': {
                color: ACCENT.info,
                title: 'DM Sent',
                description: 'Official message delivered'
            },
            'massban': {
                color: 0x8b0000,
                title: 'Mass Ban Operation',
                description: 'Multiple users banned simultaneously'
            }
        };

        const actionData = actionConfig[action] || {
            color: ACCENT.info,
            title: 'Moderation Action',
            description: 'Moderation action executed'
        };

        const details = buildActionDetails(action, executor, target, reason, extra);

        const logContainer = buildCard({
            accent: actionData.color,
            title: actionData.title,
            body: [
                `*${actionData.description}*`,
                `> Executed by: ${executor.tag} | Action: \`${action.toUpperCase()}\``,
                details,
                `*Moderation Logs System • <t:${Math.floor(Date.now() / 1000)}:R>*`
            ].join('\n\n'),
            thumbnail: logHandlersIcons.modIcon
        });

        await sendV2(logChannel, logContainer);

    } catch (error) {
        console.error('Moderation logging error:', error);
    }
}

function buildActionDetails(action, executor, target, reason, extra) {
    const baseDetails = [
        `**Target User:** ${target ? target.tag : (extra.userId || 'Unknown User')}`,
        `**Moderator:** ${executor.tag}`,
        `**Reason:** ${reason || lang.moderation.member.noReason}`,
        `**Timestamp:** <t:${Math.floor(Date.now() / 1000)}:F>`
    ];

    switch (action) {
        case 'ban':
            if (extra.days !== undefined) {
                baseDetails.push(`**Messages Deleted:** ${extra.days} days`);
            }
            break;
        case 'unban':
            if (extra.previousReason) {
                baseDetails.push(`**Previous Ban Reason:** ${extra.previousReason}`);
            }
            break;
        case 'timeout':
            if (extra.duration) {
                baseDetails.push(`**Duration:** ${extra.duration}`);
                baseDetails.push(`**Expires:** <t:${Math.floor((Date.now() + extra.durationMs) / 1000)}:F>`);
            }
            break;
        case 'removetimeout':
            if (extra.previousTimeout) {
                baseDetails.push(`**Previous Timeout:** <t:${Math.floor(extra.previousTimeout / 1000)}:F>`);
            }
            break;
        case 'nickname':
            if (extra.oldNickname || extra.newNickname) {
                baseDetails.push(`**Previous Nickname:** ${extra.oldNickname || 'No nickname'}`);
                baseDetails.push(`**New Nickname:** ${extra.newNickname || 'No nickname'}`);
                baseDetails.push(`**Action:** ${extra.nicknameAction || 'Modified'}`);
            }
            break;
        case 'warn':
            if (extra.severity) {
                baseDetails.push(`**Severity:** ${extra.severity.toUpperCase()}`);
            }
            if (extra.dmStatus) {
                baseDetails.push(`**DM Status:** ${extra.dmStatus}`);
            }
            break;
        case 'softban':
            if (extra.days !== undefined) {
                baseDetails.push(`**Messages Cleaned:** ${extra.days} days`);
            }
            break;
        case 'dm':
            if (extra.messageType) {
                baseDetails.push(`**Message Type:** ${extra.messageType.toUpperCase()}`);
            }
            if (extra.messagePreview) {
                baseDetails.push(`**Preview:** ${extra.messagePreview}`);
            }
            break;
        case 'massban':
            if (extra.attempted && extra.successful !== undefined && extra.failed !== undefined) {
                baseDetails.push(`**Results:** ${extra.successful}/${extra.attempted} successful`);
                baseDetails.push(`**Failed:** ${extra.failed} users`);
            }
            break;
    }

    if (target) {
        baseDetails.push(`**User ID:** \`${target.id}\``);
    } else if (extra.userId) {
        baseDetails.push(`**User ID:** \`${extra.userId}\``);
    }

    return baseDetails.join('\n');
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('member')
        .setDescription('Advanced server member management and moderation tools')
        .addSubcommand(subcommand =>
            subcommand
                .setName('ban')
                .setDescription('Ban a user from the server with advanced options')
                .addUserOption(option =>
                    option.setName('target')
                        .setDescription('User to ban')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for the ban')
                        .setRequired(false))
                .addIntegerOption(option =>
                    option.setName('days')
                        .setDescription('Delete messages from last X days (0-7)')
                        .setRequired(false)
                        .setMinValue(0)
                        .setMaxValue(7)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('unban')
                .setDescription('Unban a user via their ID with detailed logging')
                .addStringOption(option =>
                    option.setName('userid')
                        .setDescription('User ID to unban')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for the unban')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('kick')
                .setDescription('Kick a user from the server with logging')
                .addUserOption(option =>
                    option.setName('target')
                        .setDescription('User to kick')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for the kick')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('timeout')
                .setDescription('Put a user in timeout with flexible duration')
                .addUserOption(option =>
                    option.setName('target')
                        .setDescription('User to timeout')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('duration')
                        .setDescription('Duration (e.g., 5m, 1h, 2d)')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for the timeout')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('removetimeout')
                .setDescription('Remove timeout from a user')
                .addUserOption(option =>
                    option.setName('target')
                        .setDescription('User to remove timeout from')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for removing timeout')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('nickname')
                .setDescription('Advanced nickname management')
                .addUserOption(option =>
                    option.setName('target')
                        .setDescription('User to manage')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('action')
                        .setDescription('Action to perform')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Set Nickname', value: 'set' },
                            { name: 'Remove Nickname', value: 'remove' },
                            { name: 'View Info', value: 'info' }
                        ))
                .addStringOption(option =>
                    option.setName('nickname')
                        .setDescription('New nickname (required for set action)')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('warn')
                .setDescription('Issue a warning to a user with logging')
                .addUserOption(option =>
                    option.setName('target')
                        .setDescription('User to warn')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for the warning')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('severity')
                        .setDescription('Warning severity level')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Low', value: 'low' },
                            { name: 'Medium', value: 'medium' },
                            { name: 'High', value: 'high' },
                            { name: 'Critical', value: 'critical' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('softban')
                .setDescription('Softban a user (ban + unban to delete messages)')
                .addUserOption(option =>
                    option.setName('target')
                        .setDescription('User to softban')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for softban')
                        .setRequired(false))
                .addIntegerOption(option =>
                    option.setName('days')
                        .setDescription('Delete messages from last X days (0-7)')
                        .setRequired(false)
                        .setMinValue(0)
                        .setMaxValue(7)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('dm')
                .setDescription('Send a professional DM to a user')
                .addUserOption(option =>
                    option.setName('target')
                        .setDescription('User to message')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('message')
                        .setDescription('Message to send')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('type')
                        .setDescription('Message type')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Information', value: 'info' },
                            { name: 'Warning', value: 'warning' },
                            { name: 'Announcement', value: 'announcement' },
                            { name: 'Support', value: 'support' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('info')
                .setDescription('Get detailed information about a member')
                .addUserOption(option =>
                    option.setName('target')
                        .setDescription('Member to analyze')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List members with filters')
                .addStringOption(option =>
                    option.setName('filter')
                        .setDescription('Filter criteria')
                        .setRequired(false)
                        .addChoices(
                            { name: 'Recently Joined', value: 'recent' },
                            { name: 'In Timeout', value: 'timeout' },
                            { name: 'Boosters', value: 'boosters' },
                            { name: 'Bots', value: 'bots' },
                            { name: 'No Avatar', value: 'no_avatar' }
                        ))
                .addIntegerOption(option =>
                    option.setName('limit')
                        .setDescription('Maximum number of results (1-20)')
                        .setRequired(false)
                        .setMinValue(1)
                        .setMaxValue(20)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('help')
                .setDescription('Show detailed help for member commands'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('massban')
                .setDescription('Mass ban multiple users (Admin only)')
                .addStringOption(option =>
                    option.setName('userids')
                        .setDescription('User IDs separated by spaces')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for mass ban')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('temp-mute')
                .setDescription('Temporarily mute a user in voice channel')
                .addUserOption(option =>
                    option.setName('target')
                        .setDescription('User to mute')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('duration')
                        .setDescription('Duration (e.g., 30s, 5m, 1h)')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for the mute')
                        .setRequired(false))),

    async execute(interaction) {
        if (!await checkPermissions(interaction, 'moderator')) return;
        let sender = interaction.user;
        let subcommand;
        let isSlashCommand = false;

        if (interaction.isCommand && interaction.isCommand()) {
            isSlashCommand = true;
            await deferReply(interaction);
            subcommand = interaction.options.getSubcommand();
        } else {
            const message = interaction;
            sender = message.author;
            const args = message.content.split(' ');
            args.shift();
            subcommand = args[0] || 'help';
        }

        const parseDuration = (duration) => {
            const match = duration.match(/^(\d+)([smhd])$/);
            if (!match) return null;

            const [, amount, unit] = match;
            const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
            return parseInt(amount, 10) * multipliers[unit];
        };

        const hasPermission = (permission) => {
            return interaction.member?.permissions.has(permission);
        };

        const getOption = (name, type = 'string') => {
            if (isSlashCommand) {
                switch (type) {
                    case 'user': return interaction.options.getUser(name);
                    case 'integer': return interaction.options.getInteger(name);
                    default: return interaction.options.getString(name);
                }
            } else {
                const args = interaction.content.split(' ');
                const index = args.indexOf(`--${name}`);
                if (index !== -1 && index + 1 < args.length) {
                    return args[index + 1];
                }
                return null;
            }
        };

        if (subcommand === 'help') {
            const helpCard = buildCard({
                accent: ACCENT.primary,
                title: lang.moderation.member.helpTitle,
                body: [
                    lang.moderation.member.helpAvailable,
                    lang.moderation.member.helpActions,
                    lang.moderation.member.helpTimeout,
                    lang.moderation.member.helpUser,
                    lang.moderation.member.helpFooter({ user: sender.tag })
                ].join('\n\n'),
                thumbnail: sender.displayAvatarURL({ dynamic: true })
            });

            return sendV2(interaction, helpCard);
        }

        if (!hasModerationPermission(subcommand, interaction.member?.permissions)) {
            const denialMessage = subcommand === 'nickname'
                ? lang.moderation.member.accessDeniedNick
                : ['warn', 'dm'].includes(subcommand)
                    ? lang.moderation.member.accessDeniedMsg
                    : lang.moderation.member.accessDeniedMod;
            return sendV2(interaction, cards.error(
                lang.moderation.member.accessDeniedTitle,
                denialMessage
            ));
        }

        if (subcommand === 'ban') {
            const target = getOption('target', 'user');
            const reason = getOption('reason') || lang.moderation.member.noReason;
            const days = getOption('days', 'integer') || 0;
            const member = interaction.guild.members.cache.get(target.id) || await interaction.guild.members.fetch(target.id).catch(() => null);

            if (!member) {
                return sendV2(interaction, cards.error(
                    lang.moderation.member.userNotFoundTitle,
                    lang.moderation.member.userNotFound
                ));
            }

            if (!member.bannable || !canModerateMember(interaction.member, member, interaction.guild)) {
                return sendV2(interaction, cards.error(
                    lang.moderation.member.hierarchyErrorTitle,
                    lang.moderation.member.hierarchyError
                ));
            }

            try {
                await member.ban({
                    reason: `${reason} | Banned by ${sender.tag}`,
                    deleteMessageDays: days
                });

                const banCard = buildCard({
                    accent: ACCENT.danger,
                    title: lang.moderation.member.bannedTitle,
                    body: [
                        `**Target:** ${target.tag}`,
                        `**Moderator:** ${sender.tag}`,
                        `**Reason:** ${reason}`,
                        `**Messages Deleted:** ${days} days`,
                        `**Ban ID:** \`${target.id}\``,
                        `**Timestamp:** <t:${Math.floor(Date.now() / 1000)}:F>`
                    ].join('\n'),
                    thumbnail: target.displayAvatarURL({ dynamic: true })
                });

                await logModerationAction('ban', sender, target, reason, interaction.guild, {
                    days: days
                });
                return sendV2(interaction, banCard);

            } catch (error) {
                console.error('Ban error:', error);
                return sendV2(interaction, cards.error(
                    'Ban Failed',
                    `Failed to ban **${target.tag}**. Please check permissions and role hierarchy.`
                ));
            }
        }

        if (subcommand === 'unban') {
            const userId = getOption('userid');
            const reason = getOption('reason') || lang.moderation.member.noReason;

            try {
                const bannedUser = await interaction.guild.bans.fetch(userId);
                await interaction.guild.members.unban(userId, `${reason} | Unbanned by ${sender.tag}`);

                const unbanCard = buildCard({
                    accent: ACCENT.success,
                    title: lang.moderation.member.unbannedTitle,
                    body: [
                        `**User:** ${bannedUser.user.tag} (\`${userId}\`)`,
                        `**Moderator:** ${sender.tag}`,
                        `**Previous Ban Reason:** ${bannedUser.reason || 'No reason recorded'}`,
                        `**Unban Reason:** ${reason}`,
                        `**Timestamp:** <t:${Math.floor(Date.now() / 1000)}:F>`
                    ].join('\n'),
                    thumbnail: bannedUser.user.displayAvatarURL({ dynamic: true })
                });

                await logModerationAction('unban', sender, bannedUser.user, reason, interaction.guild, {
                    previousReason: bannedUser.reason,
                    userId: userId
                });
                return sendV2(interaction, unbanCard);

            } catch (error) {
                return sendV2(interaction, cards.error(
                    'Unban Failed',
                    `No banned user found with ID \`${userId}\`.`
                ));
            }
        }

        if (subcommand === 'kick') {
            const target = getOption('target', 'user');
            const reason = getOption('reason') || lang.moderation.member.noReason;
            const member = interaction.guild.members.cache.get(target.id) || await interaction.guild.members.fetch(target.id).catch(() => null);

            if (!member || !member.kickable || !canModerateMember(interaction.member, member, interaction.guild)) {
                return sendV2(interaction, cards.error(
                    lang.moderation.member.hierarchyErrorTitle,
                    `Cannot kick **${target.tag}**. Check permissions and role hierarchy.`
                ));
            }

            try {
                await member.kick(`${reason} | Kicked by ${sender.tag}`);

                const kickCard = buildCard({
                    accent: ACCENT.warning,
                    title: lang.moderation.member.kickedTitle,
                    body: [
                        `**Target:** ${target.tag}`,
                        `**Moderator:** ${sender.tag}`,
                        `**Reason:** ${reason}`,
                        `**Kick ID:** \`${target.id}\``,
                        `**Timestamp:** <t:${Math.floor(Date.now() / 1000)}:F>`
                    ].join('\n'),
                    thumbnail: target.displayAvatarURL({ dynamic: true })
                });

                await logModerationAction('kick', sender, target, reason, interaction.guild);
                return sendV2(interaction, kickCard);

            } catch (error) {
                return sendV2(interaction, cards.error(
                    'Kick Failed',
                    `Failed to kick **${target.tag}**. Please try again.`
                ));
            }
        }

        if (subcommand === 'timeout') {
            const target = getOption('target', 'user');
            const durationStr = getOption('duration');
            const reason = getOption('reason') || lang.moderation.member.noReason;
            const member = interaction.guild.members.cache.get(target.id) || await interaction.guild.members.fetch(target.id).catch(() => null);

            if (!member || !member.moderatable || !canModerateMember(interaction.member, member, interaction.guild)) {
                return sendV2(interaction, cards.error(
                    lang.moderation.member.hierarchyErrorTitle,
                    `Cannot timeout **${target.tag}**. Check permissions and role hierarchy.`
                ));
            }

            const duration = parseDuration(durationStr);
            if (!duration) {
                return sendV2(interaction, cards.error(
                    'Invalid Duration',
                    lang.moderation.member.invalidDuration
                ));
            }

            try {
                await member.timeout(duration, `${reason} | Timed out by ${sender.tag}`);

                const timeoutCard = buildCard({
                    accent: ACCENT.info,
                    title: lang.moderation.member.timedOutTitle,
                    body: [
                        `**Target:** ${target.tag}`,
                        `**Duration:** ${durationStr}`,
                        `**Expires:** <t:${Math.floor((Date.now() + duration) / 1000)}:F>`,
                        `**Moderator:** ${sender.tag}`,
                        `**Reason:** ${reason}`,
                        `**Timeout ID:** \`${target.id}\``
                    ].join('\n'),
                    thumbnail: target.displayAvatarURL({ dynamic: true })
                });

                await logModerationAction('timeout', sender, target, reason, interaction.guild, {
                    duration: durationStr,
                    durationMs: duration
                });

                return sendV2(interaction, timeoutCard);

            } catch (error) {
                return sendV2(interaction, cards.error(
                    'Timeout Failed',
                    `Failed to timeout **${target.tag}**. Please try again.`
                ));
            }
        }

        if (subcommand === 'removetimeout') {
            const target = getOption('target', 'user');
            const reason = getOption('reason') || lang.moderation.member.noReason;
            const member = interaction.guild.members.cache.get(target.id) || await interaction.guild.members.fetch(target.id).catch(() => null);

            if (!member || !canModerateMember(interaction.member, member, interaction.guild)) {
                return sendV2(interaction, cards.error(
                    lang.moderation.member.hierarchyErrorTitle,
                    'You cannot moderate a member with an equal or higher role.'
                ));
            }

            if (!member.communicationDisabledUntilTimestamp) {
                return sendV2(interaction, cards.warning(
                    lang.moderation.member.timeoutRemovedTitle,
                    lang.moderation.member.notInTimeout
                ));
            }

            try {
                const previousTimeout = member.communicationDisabledUntilTimestamp;
                await member.timeout(null, `${reason} | Timeout removed by ${sender.tag}`);

                const removeTimeoutCard = buildCard({
                    accent: ACCENT.success,
                    title: lang.moderation.member.timeoutRemovedTitle,
                    body: [
                        `**Target:** ${target.tag}`,
                        `**Moderator:** ${sender.tag}`,
                        `**Reason:** ${reason}`,
                        `**Removal ID:** \`${target.id}\``,
                        `**Timestamp:** <t:${Math.floor(Date.now() / 1000)}:F>`
                    ].join('\n'),
                    thumbnail: target.displayAvatarURL({ dynamic: true })
                });

                await logModerationAction('removetimeout', sender, target, reason, interaction.guild, {
                    previousTimeout: previousTimeout
                });

                return sendV2(interaction, removeTimeoutCard);

            } catch (error) {
                return sendV2(interaction, cards.error(
                    'Timeout Removal Failed',
                    `Failed to remove timeout for **${target.tag}**. Please try again.`
                ));
            }
        }

        if (subcommand === 'nickname') {
            const target = getOption('target', 'user');
            const action = getOption('action');
            const nickname = getOption('nickname');
            const member = interaction.guild.members.cache.get(target.id) || await interaction.guild.members.fetch(target.id).catch(() => null);

            if (!member || !member.manageable || !canModerateMember(interaction.member, member, interaction.guild)) {
                return sendV2(interaction, cards.error(
                    lang.moderation.member.hierarchyErrorTitle,
                    `Cannot manage nickname for **${target.tag}**. Check permissions and role hierarchy.`
                ));
            }

            if (action === 'set') {
                if (!nickname) {
                    return sendV2(interaction, cards.error(
                        'Nickname Required',
                        'Please provide a new nickname to set.'
                    ));
                }

                try {
                    const oldNickname = member.nickname || member.user.username;
                    await member.setNickname(nickname);

                    const nickCard = buildCard({
                        accent: ACCENT.primary,
                        title: lang.moderation.member.nicknameChangedTitle,
                        body: [
                            `**Target:** ${target.tag}`,
                            `**Old Nickname:** ${oldNickname}`,
                            `**New Nickname:** ${nickname}`,
                            `**Moderator:** ${sender.tag}`,
                            `**Timestamp:** <t:${Math.floor(Date.now() / 1000)}:F>`
                        ].join('\n'),
                        thumbnail: target.displayAvatarURL({ dynamic: true })
                    });

                    await logModerationAction('nickname', sender, target, `Nickname set to ${nickname}`, interaction.guild, {
                        oldNickname: oldNickname,
                        newNickname: nickname,
                        nicknameAction: 'set'
                    });

                    return sendV2(interaction, nickCard);

                } catch (error) {
                    return sendV2(interaction, cards.error(
                        'Nickname Update Failed',
                        `Failed to set nickname for **${target.tag}**. Please try again.`
                    ));
                }
            }

            if (action === 'remove') {
                try {
                    const oldNickname = member.nickname || 'No nickname';
                    await member.setNickname(null);

                    const removeNickCard = buildCard({
                        accent: ACCENT.danger,
                        title: lang.moderation.member.nicknameRemovedTitle,
                        body: [
                            `**Target:** ${target.tag}`,
                            `**Previous Nickname:** ${oldNickname}`,
                            `**Moderator:** ${sender.tag}`,
                            `**Timestamp:** <t:${Math.floor(Date.now() / 1000)}:F>`
                        ].join('\n'),
                        thumbnail: target.displayAvatarURL({ dynamic: true })
                    });

                    await logModerationAction('nickname', sender, target, 'Nickname removed', interaction.guild, {
                        oldNickname: oldNickname,
                        newNickname: null,
                        nicknameAction: 'remove'
                    });

                    return sendV2(interaction, removeNickCard);

                } catch (error) {
                    return sendV2(interaction, cards.error(
                        'Nickname Removal Failed',
                        `Failed to remove nickname for **${target.tag}**. Please try again.`
                    ));
                }
            }

            if (action === 'info') {
                const infoCard = buildCard({
                    accent: 0x95a5a6,
                    title: lang.moderation.member.nicknameInfoTitle,
                    body: [
                        `**Target:** ${target.tag}`,
                        `**Current Nickname:** ${member.nickname || 'No nickname set'}`,
                        `**Display Name:** ${member.displayName}`,
                        `**Username:** ${target.username}`,
                        `**Can Modify:** ${member.manageable ? 'Yes' : 'No'}`,
                        `**Hierarchy:** ${interaction.member.roles.highest.position > member.roles.highest.position ? 'Above' : 'Below/Equal'}`
                    ].join('\n'),
                    thumbnail: target.displayAvatarURL({ dynamic: true })
                });

                return sendV2(interaction, infoCard);
            }
        }

        if (subcommand === 'warn') {
            const target = getOption('target', 'user');
            const reason = getOption('reason');
            const severity = getOption('severity') || 'medium';

            const severityColors = {
                low: 0xf1c40f,
                medium: 0xe67e22,
                high: 0xe74c3c,
                critical: 0x8e44ad
            };

            const warnDMCard = buildCard({
                accent: severityColors[severity] || ACCENT.warning,
                title: 'Official Warning',
                body: [
                    `**Server:** ${interaction.guild.name}`,
                    `**Severity:** ${severity.toUpperCase()}`,
                    `**Issued By:** ${sender.tag}`,
                    `**Reason:** ${reason}`,
                    `**Date:** <t:${Math.floor(Date.now() / 1000)}:F>`,
                    `\n**Important Notice:** Continued violations may lead to timeout, kick, or ban. Please review the server rules.`
                ].join('\n'),
                thumbnail: interaction.guild.iconURL({ dynamic: true }) || sender.displayAvatarURL({ dynamic: true })
            });

            let dmSent = false;
            try {
                await sendV2(target, warnDMCard);
                dmSent = true;
            } catch (_) {
                dmSent = false;
            }

            const confirmCard = buildCard({
                accent: severityColors[severity] || ACCENT.warning,
                title: lang.moderation.member.warnedTitle,
                body: [
                    `**Target:** ${target.tag}`,
                    `**Severity:** ${severity.toUpperCase()}`,
                    `**Moderator:** ${sender.tag}`,
                    `**Reason:** ${reason}`,
                    `**DM Status:** ${dmSent ? 'Delivered' : 'Failed (DMs Closed)'}`
                ].join('\n'),
                thumbnail: target.displayAvatarURL({ dynamic: true })
            });

            await logModerationAction('warn', sender, target, reason, interaction.guild, {
                severity: severity,
                dmStatus: dmSent ? 'Delivered' : 'DMs Closed'
            });

            return sendV2(interaction, confirmCard);
        }

        if (subcommand === 'softban') {
            const target = getOption('target', 'user');
            const reason = getOption('reason') || lang.moderation.member.noReason;
            const days = getOption('days', 'integer') || 7;
            const member = interaction.guild.members.cache.get(target.id) || await interaction.guild.members.fetch(target.id).catch(() => null);

            if (!member || !member.bannable || !canModerateMember(interaction.member, member, interaction.guild)) {
                return sendV2(interaction, cards.error(
                    lang.moderation.member.hierarchyErrorTitle,
                    `Cannot softban **${target.tag}**. Check permissions and role hierarchy.`
                ));
            }

            try {
                await member.ban({
                    reason: `Softban: ${reason} | By ${sender.tag}`,
                    deleteMessageDays: days
                });
                await interaction.guild.members.unban(target.id, 'Softban unban');

                const softbanCard = buildCard({
                    accent: 0xff6b6b,
                    title: lang.moderation.member.softbannedTitle,
                    body: [
                        `**Target:** ${target.tag}`,
                        `**Moderator:** ${sender.tag}`,
                        `**Reason:** ${reason}`,
                        `**Messages Purged:** ${days} days`,
                        `**Status:** Messages cleaned, user can rejoin`,
                        `**Timestamp:** <t:${Math.floor(Date.now() / 1000)}:F>`
                    ].join('\n'),
                    thumbnail: target.displayAvatarURL({ dynamic: true })
                });

                await logModerationAction('softban', sender, target, reason, interaction.guild, {
                    days: days
                });
                return sendV2(interaction, softbanCard);

            } catch (error) {
                return sendV2(interaction, cards.error(
                    'Softban Failed',
                    `Failed to softban **${target.tag}**. Please try again.`
                ));
            }
        }

        if (subcommand === 'dm') {
            const target = getOption('target', 'user');
            const message = getOption('message');
            const type = getOption('type') || 'info';

            const typeColors = {
                info: 0x3498db,
                warning: 0xf39c12,
                announcement: 0x9b59b6,
                support: 0x2ecc71
            };

            const dmCard = buildCard({
                accent: typeColors[type] || ACCENT.info,
                title: `Message from ${interaction.guild.name}`,
                body: [
                    `**Type:** ${type.toUpperCase()}`,
                    `**From:** ${sender.tag}`,
                    `**Date:** <t:${Math.floor(Date.now() / 1000)}:F>`,
                    `\n**Message:**\n${message}`,
                    `\n*This is an official message from the server staff.*`
                ].join('\n'),
                thumbnail: interaction.guild.iconURL({ dynamic: true }) || sender.displayAvatarURL({ dynamic: true })
            });

            try {
                await sendV2(target, dmCard);

                const confirmCard = buildCard({
                    accent: typeColors[type] || ACCENT.info,
                    title: lang.moderation.member.dmSentTitle,
                    body: [
                        `**Recipient:** ${target.tag}`,
                        `**Type:** ${type.toUpperCase()}`,
                        `**Sender:** ${sender.tag}`,
                        `**Status:** Delivered successfully`,
                        `**Message Preview:** ${message.length > 100 ? message.substring(0, 100) + '...' : message}`
                    ].join('\n'),
                    thumbnail: target.displayAvatarURL({ dynamic: true })
                });

                await logModerationAction('dm', sender, target, `Official ${type} message sent`, interaction.guild, {
                    messageType: type,
                    messagePreview: message.length > 100 ? message.substring(0, 100) + '...' : message
                });

                return sendV2(interaction, confirmCard);

            } catch (error) {
                return sendV2(interaction, cards.error(
                    lang.moderation.member.dmFailedTitle,
                    lang.moderation.member.dmFailed({ user: target.tag })
                ));
            }
        }

        if (subcommand === 'info') {
            const target = getOption('target', 'user');
            const member = interaction.guild.members.cache.get(target.id) || await interaction.guild.members.fetch(target.id).catch(() => null);

            if (!member) {
                return sendV2(interaction, cards.error(
                    lang.moderation.member.userNotFoundTitle,
                    lang.moderation.member.userNotFound
                ));
            }

            const roles = member.roles.cache
                .filter(role => role.name !== '@everyone')
                .map(role => role.toString())
                .slice(0, 10);

            const joinedDays = Math.floor((Date.now() - member.joinedTimestamp) / (1000 * 60 * 60 * 24));

            const memberInfoCard = buildCard({
                accent: 0x34495e,
                title: `Member Information: ${target.tag}`,
                body: [
                    `**User:** ${target.tag} (\`${target.id}\`)`,
                    `**Display Name:** ${member.displayName}`,
                    `**Nickname:** ${member.nickname || 'None'} | **Bot:** ${target.bot ? 'Yes' : 'No'}`,
                    `**Account Created:** <t:${Math.floor(target.createdTimestamp / 1000)}:F>`,
                    `**Joined Server:** <t:${Math.floor(member.joinedTimestamp / 1000)}:F> (${joinedDays} days ago)`,
                    `**Boosting:** ${member.premiumSince ? `Since <t:${Math.floor(member.premiumSince / 1000)}:R>` : 'No'}`,
                    `**Highest Role:** ${member.roles.highest.name}`,
                    `**Timeout Status:** ${member.communicationDisabledUntilTimestamp ? `Until <t:${Math.floor(member.communicationDisabledUntilTimestamp / 1000)}:F>` : 'None'}`,
                    `**Moderation Eligibility:** Kickable: ${member.kickable ? 'Yes' : 'No'} | Bannable: ${member.bannable ? 'Yes' : 'No'}`,
                    `\n**Roles (${member.roles.cache.size - 1}):**\n${roles.length ? roles.join(', ') : 'No roles'}${roles.length > 10 ? ` (+${member.roles.cache.size - 11} more)` : ''}`
                ].join('\n'),
                thumbnail: target.displayAvatarURL({ dynamic: true, size: 512 })
            });

            return sendV2(interaction, memberInfoCard);
        }

        if (subcommand === 'list') {
            const filter = getOption('filter') || 'recent';
            const limit = getOption('limit', 'integer') || 10;
            let members = [];

            switch (filter) {
                case 'recent':
                    members = Array.from(interaction.guild.members.cache.values())
                        .sort((a, b) => b.joinedTimestamp - a.joinedTimestamp)
                        .slice(0, limit);
                    break;
                case 'timeout':
                    members = Array.from(interaction.guild.members.cache.values())
                        .filter(member => member.communicationDisabledUntilTimestamp)
                        .slice(0, limit);
                    break;
                case 'boosters':
                    members = Array.from(interaction.guild.members.cache.values())
                        .filter(member => member.premiumSince)
                        .slice(0, limit);
                    break;
                case 'bots':
                    members = Array.from(interaction.guild.members.cache.values())
                        .filter(member => member.user.bot)
                        .slice(0, limit);
                    break;
                case 'no_avatar':
                    members = Array.from(interaction.guild.members.cache.values())
                        .filter(member => !member.user.avatar)
                        .slice(0, limit);
                    break;
            }

            const memberLines = members.length > 0
                ? members.map((member, index) => {
                    const joinedDays = Math.floor((Date.now() - member.joinedTimestamp) / (1000 * 60 * 60 * 24));
                    return `**${index + 1}.** ${member.displayName} (\`${member.user.tag}\`) — Joined ${joinedDays}d ago`;
                }).join('\n')
                : 'No members found matching this filter.';

            const listCard = buildCard({
                accent: 0x2c3e50,
                title: `Member List: ${filter.toUpperCase()}`,
                body: [
                    `**Filter:** ${filter.toUpperCase()} | **Showing:** ${members.length} of ${limit} | **Total Members:** ${interaction.guild.memberCount}`,
                    memberLines,
                    `List requested by ${sender.tag}`
                ].join('\n\n'),
                thumbnail: interaction.guild.iconURL({ dynamic: true }) || sender.displayAvatarURL({ dynamic: true })
            });

            return sendV2(interaction, listCard);
        }

        if (subcommand === 'massban') {
            if (!hasPermission(PermissionFlagsBits.Administrator)) {
                return sendV2(interaction, cards.error(
                    lang.moderation.member.accessDeniedTitle,
                    'You need Administrator permission for mass ban operations.'
                ));
            }

            const userIds = getOption('userids').split(' ').filter(id => id.length > 0);
            const reason = getOption('reason') || 'Mass ban operation';

            if (userIds.length > 10) {
                return sendV2(interaction, cards.error(
                    'Too Many Users',
                    'Maximum 10 users can be banned at once for safety.'
                ));
            }

            const results = { success: [], failed: [] };

            for (const userId of userIds) {
                try {
                    const targetMember = interaction.guild.members.cache.get(userId) ||
                        await interaction.guild.members.fetch(userId).catch(() => null);
                    if (targetMember && !canModerateMember(interaction.member, targetMember, interaction.guild)) {
                        results.failed.push(userId);
                        continue;
                    }
                    await interaction.guild.members.ban(userId, {
                        reason: `Mass ban: ${reason} | By ${sender.tag}`
                    });
                    results.success.push(userId);
                } catch (error) {
                    results.failed.push(userId);
                }
            }

            const massbanCard = buildCard({
                accent: ACCENT.danger,
                title: lang.moderation.member.massBannedTitle,
                body: [
                    `**Moderator:** ${sender.tag}`,
                    `**Attempted:** ${userIds.length} | **Successful:** ${results.success.length} | **Failed:** ${results.failed.length}`,
                    `**Reason:** ${reason}`,
                    `\n**Successfully Banned:**\n${results.success.map(id => `• \`${id}\``).join('\n') || 'None'}`,
                    results.failed.length > 0 ? `\n**Failed to Ban:**\n${results.failed.map(id => `• \`${id}\``).join('\n')}` : ''
                ].filter(Boolean).join('\n'),
                thumbnail: sender.displayAvatarURL({ dynamic: true })
            });

            await logModerationAction('massban', sender, null, reason, interaction.guild, {
                attempted: userIds.length,
                successful: results.success.length,
                failed: results.failed.length,
                userId: 'Multiple Users'
            });

            return sendV2(interaction, massbanCard);
        }

        if (subcommand === 'temp-mute') {
            const TempVcMute = require('../../models/moderation/tempVcMute');
            const target = getOption('target', 'user');
            const durationStr = getOption('duration');
            const reason = getOption('reason') || lang.moderation.member.noReason;

            const member = interaction.guild.members.cache.get(target.id) || await interaction.guild.members.fetch(target.id).catch(() => null);
            if (!member) {
                return sendV2(interaction, cards.error(
                    lang.moderation.member.userNotFoundTitle,
                    lang.moderation.member.userNotFound
                ));
            }

            if (!canModerateMember(interaction.member, member, interaction.guild)) {
                return sendV2(interaction, cards.error(
                    lang.moderation.member.hierarchyErrorTitle,
                    'You cannot moderate a member with an equal or higher role.'
                ));
            }

            if (!member.voice.channel) {
                return sendV2(interaction, cards.error(
                    'Not In Voice',
                    lang.moderation.member.notInVoice
                ));
            }

            const parseTempDuration = (str) => {
                const match = str.match(/^(\d+)(s|m|h)$/);
                if (!match) return null;
                const [, amount, unit] = match;
                const multipliers = { s: 1000, m: 60000, h: 3600000 };
                return parseInt(amount, 10) * multipliers[unit];
            };

            const durationMs = parseTempDuration(durationStr);
            if (!durationMs) {
                return sendV2(interaction, cards.error(
                    'Invalid Duration',
                    'Use format: 30s, 5m, or 1h'
                ));
            }

            if (durationMs > 3600000) {
                return sendV2(interaction, cards.error(
                    'Duration Too Long',
                    'Maximum temp mute is 1 hour.'
                ));
            }

            try {
                await member.voice.setMute(true, `Temp mute by ${sender.tag}: ${reason}`);
                const endTime = Date.now() + durationMs;

                await TempVcMute.findOneAndUpdate(
                    { guildId: interaction.guild.id, userId: target.id },
                    { endTime, mutedBy: sender.id },
                    { upsert: true, returnDocument: 'after' }
                );

                setTimeout(async () => {
                    try {
                        const freshMember = await interaction.guild.members.fetch(target.id).catch(() => null);
                        if (freshMember && freshMember.voice.serverMute) {
                            await freshMember.voice.setMute(false, 'Temp mute expired');
                        }
                        await TempVcMute.deleteOne({ guildId: interaction.guild.id, userId: target.id });
                    } catch (err) {
                        console.error('[Temp Mute] Auto-unmute error:', err);
                    }
                }, durationMs);

                const muteCard = buildCard({
                    accent: ACCENT.info,
                    title: lang.moderation.member.tempMutedTitle,
                    body: [
                        `**Target:** ${target.tag}`,
                        `**Moderator:** ${sender.tag}`,
                        `**Duration:** ${durationStr}`,
                        `**Reason:** ${reason}`,
                        `**Expires:** <t:${Math.floor(endTime / 1000)}:R>`,
                        `*Auto-unmute scheduled upon expiration.*`
                    ].join('\n'),
                    thumbnail: target.displayAvatarURL({ dynamic: true })
                });

                return sendV2(interaction, muteCard);
            } catch (error) {
                console.error('Temp mute error:', error);
                return sendV2(interaction, cards.error(
                    'Mute Failed',
                    `Failed to mute **${target.tag}**. Check permissions.`
                ));
            }
        }

        return sendV2(interaction, cards.error(
            'Invalid Subcommand',
            'Use `/member help` for available commands.'
        ));
    }
};
