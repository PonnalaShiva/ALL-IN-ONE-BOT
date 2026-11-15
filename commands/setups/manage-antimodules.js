

const {
    SlashCommandBuilder,
    PermissionFlagsBits
} = require('discord.js');
const AntiConfig = require('../../models/antiSystem/AntiConfig');
const ThreatScore = require('../../models/antiSystem/ThreatScore');
const checkPermissions = require('../../utils/checkPermissions');
const { invalidateAntiConfig } = require('../../utils/cacheHelpers');
const { getEmoji } = require('../../UI/emojis/emoji');
const { buildCard, cards, sendV2, replyEphemeral, deferReply, ACCENT } = require('../../UI');
const lang = require('../../events/loadLanguage');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('manage-antimodules')
        .setDescription('Advanced anti-system management & configuration')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

        .addSubcommand(sub => sub
            .setName('blacklist-add')
            .setDescription('Add user to blacklist')
            .addUserOption(opt => opt.setName('user').setDescription('User to blacklist').setRequired(true))
            .addStringOption(opt => opt.setName('reason').setDescription('Reason for blacklisting').setRequired(true))
            .addIntegerOption(opt => opt.setName('days').setDescription('Duration in days (0 = permanent)').setMinValue(0).setMaxValue(365)))

        .addSubcommand(sub => sub
            .setName('blacklist-remove')
            .setDescription('Remove user from blacklist')
            .addUserOption(opt => opt.setName('user').setDescription('User to remove').setRequired(true)))

        .addSubcommand(sub => sub
            .setName('blacklist-view')
            .setDescription('View all blacklisted users'))

        .addSubcommand(sub => sub
            .setName('trust-role')
            .setDescription('Set trust level for a role')
            .addRoleOption(opt => opt.setName('role').setDescription('Role to configure').setRequired(true))
            .addIntegerOption(opt => opt.setName('level').setDescription('Trust level (1-100)').setRequired(true).setMinValue(1).setMaxValue(100))
            .addBooleanOption(opt => opt.setName('bypass-spam').setDescription('Bypass anti-spam checks'))
            .addBooleanOption(opt => opt.setName('bypass-link').setDescription('Bypass anti-link checks'))
            .addBooleanOption(opt => opt.setName('bypass-raid').setDescription('Bypass anti-raid checks')))

        .addSubcommand(sub => sub
            .setName('trust-view')
            .setDescription('View all role trust levels'))

        .addSubcommand(sub => sub
            .setName('trust-remove')
            .setDescription('Remove trust level from a role')
            .addRoleOption(opt => opt.setName('role').setDescription('Role to remove').setRequired(true)))

        .addSubcommand(sub => sub
            .setName('staff-monitoring')
            .setDescription('Configure staff action monitoring')
            .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable staff monitoring'))
            .addBooleanOption(opt => opt.setName('log-role-changes').setDescription('Log staff role changes'))
            .addBooleanOption(opt => opt.setName('log-channel-edits').setDescription('Log staff channel edits'))
            .addBooleanOption(opt => opt.setName('log-bans').setDescription('Log staff bans/kicks'))
            .addBooleanOption(opt => opt.setName('log-permission-changes').setDescription('Log permission modifications'))
            .addBooleanOption(opt => opt.setName('alert-on-suspicious').setDescription('Alert when suspicious staff activity detected')))

        .addSubcommand(sub => sub
            .setName('recovery')
            .setDescription('Configure automatic recovery system')
            .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable auto-recovery'))
            .addBooleanOption(opt => opt.setName('restore-roles').setDescription('Restore deleted roles'))
            .addBooleanOption(opt => opt.setName('restore-channels').setDescription('Restore deleted channels'))
            .addBooleanOption(opt => opt.setName('restore-bans').setDescription('Undo mass bans'))
            .addIntegerOption(opt => opt.setName('backup-interval').setDescription('Backup interval in hours (1-24)').setMinValue(1).setMaxValue(24)))

        .addSubcommand(sub => sub
            .setName('appeals')
            .setDescription('Configure appeal system')
            .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable appeal system'))
            .addChannelOption(opt => opt.setName('channel').setDescription('Channel for appeals'))
            .addIntegerOption(opt => opt.setName('cooldown').setDescription('Appeal cooldown in hours (1-168)').setMinValue(1).setMaxValue(168))
            .addBooleanOption(opt => opt.setName('dm-notifications').setDescription('DM users about appeal status')))

        .addSubcommand(sub => sub
            .setName('rate-limit')
            .setDescription('Configure action rate limiting')
            .addIntegerOption(opt => opt.setName('max-actions').setDescription('Max actions per minute (10-100)').setMinValue(10).setMaxValue(100))
            .addIntegerOption(opt => opt.setName('cooldown').setDescription('Cooldown after limit in seconds (30-300)').setMinValue(30).setMaxValue(300))
            .addBooleanOption(opt => opt.setName('queue-actions').setDescription('Queue actions instead of dropping')))

        .addSubcommand(sub => sub
            .setName('link-domains')
            .setDescription('Manage allowed/blocked domains')
            .addStringOption(opt => opt.setName('action').setDescription('Action').setRequired(true)
                .addChoices(
                    { name: 'Allow domain', value: 'allow' },
                    { name: 'Block domain', value: 'block' },
                    { name: 'Remove from list', value: 'remove' },
                    { name: 'View lists', value: 'view' }
                ))
            .addStringOption(opt => opt.setName('domain').setDescription('Domain (e.g., youtube.com)')))

        .addSubcommand(sub => sub
            .setName('link-partners')
            .setDescription('Manage partner server invites')
            .addStringOption(opt => opt.setName('action').setDescription('Action').setRequired(true)
                .addChoices(
                    { name: 'Add partner', value: 'add' },
                    { name: 'Remove partner', value: 'remove' },
                    { name: 'View partners', value: 'view' }
                ))
            .addStringOption(opt => opt.setName('server-id').setDescription('Partner server ID')))

        .addSubcommand(sub => sub
            .setName('raid-progressive')
            .setDescription('Configure progressive raid response')
            .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable progressive response'))
            .addIntegerOption(opt => opt.setName('level-1-threshold').setDescription('Joins to trigger Level 1 (alert)').setMinValue(3).setMaxValue(20))
            .addIntegerOption(opt => opt.setName('level-2-threshold').setDescription('Joins to trigger Level 2 (verify)').setMinValue(5).setMaxValue(30))
            .addIntegerOption(opt => opt.setName('level-3-threshold').setDescription('Joins to trigger Level 3 (quarantine)').setMinValue(10).setMaxValue(50))
            .addIntegerOption(opt => opt.setName('level-4-threshold').setDescription('Joins to trigger Level 4 (lockdown)').setMinValue(15).setMaxValue(100)))

        .addSubcommand(sub => sub
            .setName('raid-patterns')
            .setDescription('Configure raid pattern detection')
            .addBooleanOption(opt => opt.setName('similar-names').setDescription('Detect similar username patterns'))
            .addBooleanOption(opt => opt.setName('default-avatars').setDescription('Flag default avatar accounts'))
            .addBooleanOption(opt => opt.setName('sequential-names').setDescription('Detect sequential/numbered names'))
            .addIntegerOption(opt => opt.setName('similarity-threshold').setDescription('Name similarity % (50-95)').setMinValue(50).setMaxValue(95)))

        .addSubcommand(sub => sub
            .setName('nuke-events')
            .setDescription('Toggle monitored nuke events')
            .addBooleanOption(opt => opt.setName('channel-delete').setDescription('Monitor channel deletions'))
            .addBooleanOption(opt => opt.setName('channel-create').setDescription('Monitor mass channel creation'))
            .addBooleanOption(opt => opt.setName('role-delete').setDescription('Monitor role deletions'))
            .addBooleanOption(opt => opt.setName('role-create').setDescription('Monitor mass role creation'))
            .addBooleanOption(opt => opt.setName('member-ban').setDescription('Monitor mass bans'))
            .addBooleanOption(opt => opt.setName('member-kick').setDescription('Monitor mass kicks'))
            .addBooleanOption(opt => opt.setName('webhook-create').setDescription('Monitor webhook creation'))
            .addBooleanOption(opt => opt.setName('permission-change').setDescription('Monitor dangerous permission changes')))

        .addSubcommand(sub => sub
            .setName('nuke-owner-alerts')
            .setDescription('Configure owner notification settings')
            .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable owner DM alerts'))
            .addBooleanOption(opt => opt.setName('immediate-dm').setDescription('DM owner immediately on detection'))
            .addBooleanOption(opt => opt.setName('include-attacker-info').setDescription('Include attacker details in alert'))
            .addBooleanOption(opt => opt.setName('include-recovery-options').setDescription('Include recovery instructions')))

        .addSubcommand(sub => sub
            .setName('punishment-advanced')
            .setDescription('️ Advanced punishment escalation')
            .addStringOption(opt => opt.setName('module').setDescription('Module to configure').setRequired(true)
                .addChoices(
                    { name: 'Anti-Spam', value: 'antiSpam' },
                    { name: 'Anti-Link', value: 'antiLink' },
                    { name: 'Anti-Raid', value: 'antiRaid' },
                    { name: 'Anti-Nuke', value: 'antiNuke' }
                ))
            .addIntegerOption(opt => opt.setName('step-1-threshold').setDescription('Violations for step 1').setMinValue(1).setMaxValue(5))
            .addStringOption(opt => opt.setName('step-1-action').setDescription('Step 1 action')
                .addChoices(
                    { name: '️ Warn', value: 'warn' },
                    { name: '️ Delete', value: 'delete' },
                    { name: '⏱️ Timeout (5m)', value: 'timeout-5' },
                    { name: '⏱️ Timeout (30m)', value: 'timeout-30' }
                ))
            .addIntegerOption(opt => opt.setName('step-2-threshold').setDescription('Violations for step 2').setMinValue(2).setMaxValue(10))
            .addStringOption(opt => opt.setName('step-2-action').setDescription('Step 2 action')
                .addChoices(
                    { name: '⏱️ Timeout (1h)', value: 'timeout-60' },
                    { name: '⏱️ Timeout (6h)', value: 'timeout-360' },
                    { name: 'Quarantine', value: 'quarantine' },
                    { name: 'Kick', value: 'kick' }
                ))
            .addIntegerOption(opt => opt.setName('step-3-threshold').setDescription('Violations for step 3').setMinValue(3).setMaxValue(15))
            .addStringOption(opt => opt.setName('step-3-action').setDescription('Step 3 action')
                .addChoices(
                    { name: 'Quarantine', value: 'quarantine' },
                    { name: 'Kick', value: 'kick' },
                    { name: 'Ban', value: 'ban' },
                    { name: 'Softban', value: 'softban' }
                )))

        .addSubcommand(sub => sub
            .setName('threat-view')
            .setDescription('View threat score for a user')
            .addUserOption(opt => opt.setName('user').setDescription('User to check').setRequired(true)))

        .addSubcommand(sub => sub
            .setName('threat-reset')
            .setDescription('Reset threat score for a user')
            .addUserOption(opt => opt.setName('user').setDescription('User to reset').setRequired(true)))

        .addSubcommand(sub => sub
            .setName('threat-modify')
            .setDescription('Manually modify threat score')
            .addUserOption(opt => opt.setName('user').setDescription('User to modify').setRequired(true))
            .addIntegerOption(opt => opt.setName('points').setDescription('Points to add/remove (-100 to 100)').setRequired(true).setMinValue(-100).setMaxValue(100))
            .addStringOption(opt => opt.setName('reason').setDescription('Reason for modification')))

        .addSubcommand(sub => sub
            .setName('threat-leaderboard')
            .setDescription('View highest threat score users'))

        .addSubcommand(sub => sub
            .setName('whitelist-bypass')
            .setDescription('Configure whitelist bypass settings')
            .addBooleanOption(opt => opt.setName('bypass-admins').setDescription('Admins bypass all checks'))
            .addBooleanOption(opt => opt.setName('bypass-moderators').setDescription('Moderators bypass checks'))
            .addBooleanOption(opt => opt.setName('bypass-boosters').setDescription('Server boosters bypass checks'))
            .addIntegerOption(opt => opt.setName('account-age-bypass').setDescription('Account age (days) to bypass new account checks').setMinValue(0).setMaxValue(365)))

        .addSubcommand(sub => sub
            .setName('whitelist-view')
            .setDescription('View all whitelist entries'))

        .addSubcommand(sub => sub
            .setName('export-config')
            .setDescription('Export current configuration'))

        .addSubcommand(sub => sub
            .setName('quick-preset')
            .setDescription('Apply a quick preset configuration')
            .addStringOption(opt => opt.setName('preset').setDescription('Preset to apply').setRequired(true)
                .addChoices(
                    { name: 'Relaxed - Light protection', value: 'relaxed' },
                    { name: 'Balanced - Moderate protection', value: 'balanced' },
                    { name: 'Strict - Strong protection', value: 'strict' },
                    { name: 'Paranoid - Maximum protection', value: 'paranoid' },
                    { name: 'Gaming - Optimized for gaming servers', value: 'gaming' },
                    { name: 'Community - Optimized for large communities', value: 'community' }
                ))),

    async execute(interaction) {
        const langData = await lang(interaction.guildId);
        if (!interaction.isCommand || !interaction.isCommand()) {
            return replyEphemeral(interaction, cards.warning(langData.warning, langData.setups?.antimodules?.warningUseSlash));
        }

        await deferReply(interaction, true);

        if (!await checkPermissions(interaction, 'admin')) return;

        const guildId = interaction.guild.id;
        const subcommand = interaction.options.getSubcommand();

        try {
            let config = await AntiConfig.findOne({ guildId });
            if (!config) {
                return sendV2(interaction, cards.error(langData.errorTitle, langData.setups?.antimodules?.notInitialized));
            }

            if (subcommand === 'blacklist-add') {
                const user = interaction.options.getUser('user');
                const reason = interaction.options.getString('reason');
                const days = interaction.options.getInteger('days') || 0;

                config.blacklist = config.blacklist || [];

                
                const existing = config.blacklist.find(b => b.memberId === user.id);
                if (existing) {
                    return this.sendError(interaction, `${user.tag} is already blacklisted!`);
                }

                const entry = {
                    memberId: user.id,
                    reason: reason,
                    addedBy: interaction.user.id,
                    addedAt: new Date(),
                    expiresAt: days > 0 ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null
                };

                config.blacklist.push(entry);
                await config.save();
                invalidateAntiConfig(guildId);

                return this.sendSuccess(interaction, `${getEmoji('cross')} User Blacklisted`,
                    `**User:** ${user.tag} (${user.id})\n` +
                    `**Reason:** ${reason}\n` +
                    `**Duration:** ${days > 0 ? `${days} days` : 'Permanent'}\n` +
                    `**Expires:** ${days > 0 ? `<t:${Math.floor(entry.expiresAt.getTime() / 1000)}:R>` : 'Never'}\n\n` +
                    `${getEmoji('help')} **What happens:**\n` +
                    `• All actions from this user are automatically blocked\n` +
                    `• User receives maximum threat score\n` +
                    `• All modules treat this user as high-risk`
                );
            }

            if (subcommand === 'blacklist-remove') {
                const user = interaction.options.getUser('user');

                config.blacklist = config.blacklist || [];
                const index = config.blacklist.findIndex(b => b.memberId === user.id);

                if (index === -1) {
                    return this.sendError(interaction, `${user.tag} is not blacklisted!`);
                }

                config.blacklist.splice(index, 1);
                await config.save();
                invalidateAntiConfig(guildId);

                return this.sendSuccess(interaction, `${getEmoji('tick')} User Removed from Blacklist`,
                    `**User:** ${user.tag}\n\n` +
                    `User can now interact normally with the server.`
                );
            }

            if (subcommand === 'blacklist-view') {
                config.blacklist = config.blacklist || [];

                if (config.blacklist.length === 0) {
                    return this.sendSuccess(interaction, `${getEmoji('cross')} Blacklist`, 'No users are blacklisted.');
                }

                const card = buildCard({ accent: ACCENT.danger })
                    .addText(`**Blacklisted Users**`)
                    .addSeparator()
                    .addText(`**Total:** ${config.blacklist.length} users\n\n> Blacklisted users are automatically blocked from all actions`)
                    .addSeparator()
                    .addText(listText || 'No entries');

                return sendV2(interaction, card);
            }

            if (subcommand === 'trust-role') {
                const role = interaction.options.getRole('role');
                const level = interaction.options.getInteger('level');
                const bypassSpam = interaction.options.getBoolean('bypass-spam');
                const bypassLink = interaction.options.getBoolean('bypass-link');
                const bypassRaid = interaction.options.getBoolean('bypass-raid');

                config.roleTrustLevels = config.roleTrustLevels || [];

                
                let entry = config.roleTrustLevels.find(r => r.roleId === role.id);
                if (!entry) {
                    entry = { roleId: role.id };
                    config.roleTrustLevels.push(entry);
                }

                entry.level = level;
                entry.bypassModules = entry.bypassModules || [];

                if (bypassSpam === true && !entry.bypassModules.includes('spam')) {
                    entry.bypassModules.push('spam');
                } else if (bypassSpam === false) {
                    entry.bypassModules = entry.bypassModules.filter(m => m !== 'spam');
                }

                if (bypassLink === true && !entry.bypassModules.includes('link')) {
                    entry.bypassModules.push('link');
                } else if (bypassLink === false) {
                    entry.bypassModules = entry.bypassModules.filter(m => m !== 'link');
                }

                if (bypassRaid === true && !entry.bypassModules.includes('raid')) {
                    entry.bypassModules.push('raid');
                } else if (bypassRaid === false) {
                    entry.bypassModules = entry.bypassModules.filter(m => m !== 'raid');
                }

                await config.save();
                invalidateAntiConfig(guildId);

                return this.sendSuccess(interaction, 'Trust Level Set',
                    `**Role:** ${role.name}\n` +
                    `**Trust Level:** ${level}/100\n` +
                    `**Bypass Modules:** ${entry.bypassModules.length > 0 ? entry.bypassModules.join(', ') : 'None'}\n\n` +
                    `${getEmoji('help')} **Trust Levels:**\n` +
                    `• 1-25: Low trust - Standard checks apply\n` +
                    `• 26-50: Medium trust - Relaxed thresholds\n` +
                    `• 51-75: High trust - Minimal checking\n` +
                    `• 76-100: Maximum trust - Near-whitelist status`
                );
            }

            if (subcommand === 'trust-view') {
                config.roleTrustLevels = config.roleTrustLevels || [];

                if (config.roleTrustLevels.length === 0) {
                    return this.sendSuccess(interaction, 'Role Trust Levels', 'No custom trust levels configured.\n\nUse `/manage-antimodules trust-role` to set trust levels.');
                }

                let listText = '';
                for (const entry of config.roleTrustLevels) {
                    const role = interaction.guild.roles.cache.get(entry.roleId);
                    if (role) {
                        const levelBar = '█'.repeat(Math.floor(entry.level / 10)) + '░'.repeat(10 - Math.floor(entry.level / 10));
                        listText += `**${role.name}**\n`;
                        listText += `└ Level: ${entry.level}/100 [${levelBar}]\n`;
                        listText += `└ Bypasses: ${entry.bypassModules?.length > 0 ? entry.bypassModules.join(', ') : 'None'}\n\n`;
                    }
                }

                return this.sendSuccess(interaction, 'Role Trust Levels', listText || 'No valid entries');
            }

            if (subcommand === 'trust-remove') {
                const role = interaction.options.getRole('role');

                config.roleTrustLevels = config.roleTrustLevels || [];
                const index = config.roleTrustLevels.findIndex(r => r.roleId === role.id);

                if (index === -1) {
                    return this.sendError(interaction, `${role.name} has no custom trust level!`);
                }

                config.roleTrustLevels.splice(index, 1);
                await config.save();
                invalidateAntiConfig(guildId);

                return this.sendSuccess(interaction, `${getEmoji('tick')} Trust Level Removed`,
                    `**Role:** ${role.name}\n\n` +
                    `Role now uses default trust settings.`
                );
            }

            if (subcommand === 'staff-monitoring') {
                const enabled = interaction.options.getBoolean('enabled');
                const logRoleChanges = interaction.options.getBoolean('log-role-changes');
                const logChannelEdits = interaction.options.getBoolean('log-channel-edits');
                const logBans = interaction.options.getBoolean('log-bans');
                const logPermissionChanges = interaction.options.getBoolean('log-permission-changes');
                const alertOnSuspicious = interaction.options.getBoolean('alert-on-suspicious');

                config.staffMonitoring = config.staffMonitoring || {};
                config.staffMonitoring.monitoredActions = config.staffMonitoring.monitoredActions || {};

                if (enabled !== null) config.staffMonitoring.enabled = enabled;
                if (logRoleChanges !== null) config.staffMonitoring.monitoredActions.roleChanges = logRoleChanges;
                if (logChannelEdits !== null) config.staffMonitoring.monitoredActions.channelEdits = logChannelEdits;
                if (logBans !== null) config.staffMonitoring.monitoredActions.bansKicks = logBans;
                if (logPermissionChanges !== null) config.staffMonitoring.monitoredActions.permissionChanges = logPermissionChanges;
                if (alertOnSuspicious !== null) config.staffMonitoring.alertOnSuspicious = alertOnSuspicious;

                await config.save();
                invalidateAntiConfig(guildId);

                return this.sendSuccess(interaction, 'Staff Monitoring Updated',
                    `**Status:** ${config.staffMonitoring.enabled ? `${getEmoji('tick')} Enabled` : `${getEmoji('cross')} Disabled`}\n\n` +
                    `**Monitored Actions:**\n` +
                    `└ Role Changes: ${config.staffMonitoring.monitoredActions.roleChanges !== false ? getEmoji('tick') : getEmoji('cross')}\n` +
                    `└ Channel Edits: ${config.staffMonitoring.monitoredActions.channelEdits !== false ? getEmoji('tick') : getEmoji('cross')}\n` +
                    `└ Bans/Kicks: ${config.staffMonitoring.monitoredActions.bansKicks !== false ? getEmoji('tick') : getEmoji('cross')}\n` +
                    `└ Permission Changes: ${config.staffMonitoring.monitoredActions.permissionChanges !== false ? getEmoji('tick') : getEmoji('cross')}\n\n` +
                    `**Alert on Suspicious:** ${config.staffMonitoring.alertOnSuspicious !== false ? `${getEmoji('tick')} Yes` : `${getEmoji('cross')} No`}\n\n` +
                    `${getEmoji('help')} **Why monitor staff?**\n` +
                    `• Detect compromised staff accounts\n` +
                    `• Track unusual activity patterns\n` +
                    `• Audit trail for all moderation actions`
                );
            }

            if (subcommand === 'recovery') {
                const enabled = interaction.options.getBoolean('enabled');
                const restoreRoles = interaction.options.getBoolean('restore-roles');
                const restoreChannels = interaction.options.getBoolean('restore-channels');
                const restoreBans = interaction.options.getBoolean('restore-bans');
                const backupInterval = interaction.options.getInteger('backup-interval');

                config.recoverySystem = config.recoverySystem || {};
                config.recoverySystem.features = config.recoverySystem.features || {};

                if (enabled !== null) config.recoverySystem.enabled = enabled;
                if (restoreRoles !== null) config.recoverySystem.features.restoreRoles = restoreRoles;
                if (restoreChannels !== null) config.recoverySystem.features.restoreChannels = restoreChannels;
                if (restoreBans !== null) config.recoverySystem.features.undoBans = restoreBans;
                if (backupInterval !== null) config.recoverySystem.backupInterval = backupInterval * 60 * 60 * 1000;

                await config.save();
                invalidateAntiConfig(guildId);

                return this.sendSuccess(interaction, 'Recovery System Updated',
                    `**Status:** ${config.recoverySystem.enabled ? `${getEmoji('tick')} Enabled` : `${getEmoji('cross')} Disabled`}\n\n` +
                    `**Recovery Features:**\n` +
                    `└ Restore Roles: ${config.recoverySystem.features.restoreRoles !== false ? getEmoji('tick') : getEmoji('cross')}\n` +
                    `└ Restore Channels: ${config.recoverySystem.features.restoreChannels !== false ? getEmoji('tick') : getEmoji('cross')}\n` +
                    `└ Undo Mass Bans: ${config.recoverySystem.features.undoBans !== false ? getEmoji('tick') : getEmoji('cross')}\n\n` +
                    `**Backup Interval:** ${(config.recoverySystem.backupInterval || 3600000) / 3600000} hours\n\n` +
                    `${getEmoji('help')} **How it works:**\n` +
                    `• Server state is backed up periodically\n` +
                    `• When nuke detected, system can auto-restore\n` +
                    `• Deleted roles/channels recreated from backup`
                );
            }

            if (subcommand === 'appeals') {
                const enabled = interaction.options.getBoolean('enabled');
                const channel = interaction.options.getChannel('channel');
                const cooldown = interaction.options.getInteger('cooldown');
                const dmNotifications = interaction.options.getBoolean('dm-notifications');

                config.appealSystem = config.appealSystem || {};

                if (enabled !== null) config.appealSystem.enabled = enabled;
                if (channel) config.appealSystem.channelId = channel.id;
                if (cooldown !== null) config.appealSystem.cooldown = cooldown * 60 * 60 * 1000;
                if (dmNotifications !== null) config.appealSystem.dmNotifications = dmNotifications;

                await config.save();
                invalidateAntiConfig(guildId);

                return this.sendSuccess(interaction, 'Appeal System Updated',
                    `**Status:** ${config.appealSystem.enabled ? `${getEmoji('tick')} Enabled` : `${getEmoji('cross')} Disabled`}\n` +
                    `**Appeal Channel:** ${config.appealSystem.channelId ? `<#${config.appealSystem.channelId}>` : `${getEmoji('cross')} Not Set`}\n` +
                    `**Cooldown:** ${(config.appealSystem.cooldown || 86400000) / 3600000} hours\n` +
                    `**DM Notifications:** ${config.appealSystem.dmNotifications !== false ? `${getEmoji('tick')} Yes` : `${getEmoji('cross')} No`}\n\n` +
                    `${getEmoji('help')} **How appeals work:**\n` +
                    `• Punished users can submit appeals\n` +
                    `• Appeals appear in the designated channel\n` +
                    `• Staff can approve/deny with one click`
                );
            }

            if (subcommand === 'rate-limit') {
                const maxActions = interaction.options.getInteger('max-actions');
                const cooldown = interaction.options.getInteger('cooldown');
                const queueActions = interaction.options.getBoolean('queue-actions');

                config.actionRateLimit = config.actionRateLimit || {};

                if (maxActions !== null) config.actionRateLimit.maxActionsPerMinute = maxActions;
                if (cooldown !== null) config.actionRateLimit.cooldownPeriod = cooldown * 1000;
                if (queueActions !== null) config.actionRateLimit.queueExcess = queueActions;

                await config.save();
                invalidateAntiConfig(guildId);

                return this.sendSuccess(interaction, '⏱️ Rate Limiting Updated',
                    `**Max Actions/Minute:** ${config.actionRateLimit.maxActionsPerMinute || 30}\n` +
                    `**Cooldown Period:** ${(config.actionRateLimit.cooldownPeriod || 60000) / 1000} seconds\n` +
                    `**Queue Excess:** ${config.actionRateLimit.queueExcess !== false ? `${getEmoji('tick')} Yes` : `${getEmoji('cross')} No (dropped)`}\n\n` +
                    `${getEmoji('help')} **Why rate limit?**\n` +
                    `• Prevents bot from being rate-limited by Discord\n` +
                    `• Ensures actions are processed smoothly\n` +
                    `• Avoids overwhelming the API during attacks`
                );
            }

            if (subcommand === 'link-domains') {
                const action = interaction.options.getString('action');
                const domain = interaction.options.getString('domain');

                config.antiLink = config.antiLink || {};
                config.antiLink.allowedDomains = config.antiLink.allowedDomains || [];
                config.antiLink.blockedDomains = config.antiLink.blockedDomains || [];

                if (action === 'view') {
                    const allowedList = config.antiLink.allowedDomains.slice(0, 20).join('\n') || 'None';
                    const blockedList = config.antiLink.blockedDomains.slice(0, 20).join('\n') || 'None';

                    return this.sendSuccess(interaction, `${getEmoji('world')} Domain Lists`,
                        `**${getEmoji('tick')} Allowed Domains (${config.antiLink.allowedDomains.length}):**\n\`\`\`\n${allowedList}\n\`\`\`\n` +
                        `**${getEmoji('cross')} Blocked Domains (${config.antiLink.blockedDomains.length}):**\n\`\`\`\n${blockedList}\n\`\`\``
                    );
                }

                if (!domain) {
                    return this.sendError(interaction, 'Please provide a domain!');
                }

                const cleanDomain = domain.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];

                if (action === 'allow') {
                    if (!config.antiLink.allowedDomains.includes(cleanDomain)) {
                        config.antiLink.allowedDomains.push(cleanDomain);
                        
                        config.antiLink.blockedDomains = config.antiLink.blockedDomains.filter(d => d !== cleanDomain);
                    }
                } else if (action === 'block') {
                    if (!config.antiLink.blockedDomains.includes(cleanDomain)) {
                        config.antiLink.blockedDomains.push(cleanDomain);
                        
                        config.antiLink.allowedDomains = config.antiLink.allowedDomains.filter(d => d !== cleanDomain);
                    }
                } else if (action === 'remove') {
                    config.antiLink.allowedDomains = config.antiLink.allowedDomains.filter(d => d !== cleanDomain);
                    config.antiLink.blockedDomains = config.antiLink.blockedDomains.filter(d => d !== cleanDomain);
                }

                await config.save();
                invalidateAntiConfig(guildId);

                const actionText = action === 'allow' ? `${getEmoji('tick')} Added to allowed list` : action === 'block' ? `${getEmoji('cross')} Added to blocked list` : '- Removed from all lists';

                return this.sendSuccess(interaction, `${getEmoji('world')} Domain Updated`,
                    `**Domain:** ${cleanDomain}\n` +
                    `**Action:** ${actionText}\n\n` +
                    `**Total Allowed:** ${config.antiLink.allowedDomains.length}\n` +
                    `**Total Blocked:** ${config.antiLink.blockedDomains.length}`
                );
            }

            if (subcommand === 'link-partners') {
                const action = interaction.options.getString('action');
                const serverId = interaction.options.getString('server-id');

                config.antiLink = config.antiLink || {};
                config.antiLink.inviteHandling = config.antiLink.inviteHandling || {};
                config.antiLink.inviteHandling.partnerServers = config.antiLink.inviteHandling.partnerServers || [];

                if (action === 'view') {
                    const partnerList = config.antiLink.inviteHandling.partnerServers.map(id => `• ${id}`).join('\n') || 'None';
                    return this.sendSuccess(interaction, `${getEmoji('world')} Partner Servers`,
                        `**Partner servers can have their invites posted:**\n\n${partnerList}\n\n` +
                        `**Total:** ${config.antiLink.inviteHandling.partnerServers.length} servers`
                    );
                }

                if (!serverId) {
                    return this.sendError(interaction, 'Please provide a server ID!');
                }

                if (action === 'add') {
                    if (!config.antiLink.inviteHandling.partnerServers.includes(serverId)) {
                        config.antiLink.inviteHandling.partnerServers.push(serverId);
                    }
                } else if (action === 'remove') {
                    config.antiLink.inviteHandling.partnerServers = config.antiLink.inviteHandling.partnerServers.filter(id => id !== serverId);
                }

                await config.save();
                invalidateAntiConfig(guildId);

                return this.sendSuccess(interaction, `${getEmoji('world')} Partner Server Updated`,
                    `**Server ID:** ${serverId}\n` +
                    `**Action:** ${action === 'add' ? '+ Added as partner' : '- Removed from partners'}\n\n` +
                    `**Total Partners:** ${config.antiLink.inviteHandling.partnerServers.length}`
                );
            }

            if (subcommand === 'raid-progressive') {
                const enabled = interaction.options.getBoolean('enabled');
                const l1 = interaction.options.getInteger('level-1-threshold');
                const l2 = interaction.options.getInteger('level-2-threshold');
                const l3 = interaction.options.getInteger('level-3-threshold');
                const l4 = interaction.options.getInteger('level-4-threshold');

                config.antiRaid = config.antiRaid || {};
                config.antiRaid.progressiveResponse = config.antiRaid.progressiveResponse || {};
                config.antiRaid.progressiveResponse.levels = config.antiRaid.progressiveResponse.levels || {};

                if (enabled !== null) config.antiRaid.progressiveResponse.enabled = enabled;
                if (l1 !== null) config.antiRaid.progressiveResponse.levels.level1 = { threshold: l1, action: 'alert' };
                if (l2 !== null) config.antiRaid.progressiveResponse.levels.level2 = { threshold: l2, action: 'verify' };
                if (l3 !== null) config.antiRaid.progressiveResponse.levels.level3 = { threshold: l3, action: 'quarantine' };
                if (l4 !== null) config.antiRaid.progressiveResponse.levels.level4 = { threshold: l4, action: 'lockdown' };

                await config.save();
                invalidateAntiConfig(guildId);

                const levels = config.antiRaid.progressiveResponse.levels;

                return this.sendSuccess(interaction, `${getEmoji('cross')} Progressive Raid Response Updated`,
                    `**Status:** ${config.antiRaid.progressiveResponse.enabled !== false ? `${getEmoji('tick')} Enabled` : `${getEmoji('cross')} Disabled`}\n\n` +
                    `**Response Levels:**\n` +
                    `└ ${getEmoji('tick')} Level 1: ${levels.level1?.threshold || 5} joins → Alert staff\n` +
                    `└ ${getEmoji('time')} Level 2: ${levels.level2?.threshold || 10} joins → Verification mode\n` +
                    `└ ${getEmoji('warning')} Level 3: ${levels.level3?.threshold || 15} joins → Quarantine\n` +
                    `└ ${getEmoji('cross')} Level 4: ${levels.level4?.threshold || 25} joins → Full lockdown\n\n` +
                    `${getEmoji('help')} Response escalates as more suspicious joins occur`
                );
            }

            if (subcommand === 'raid-patterns') {
                const similarNames = interaction.options.getBoolean('similar-names');
                const defaultAvatars = interaction.options.getBoolean('default-avatars');
                const sequentialNames = interaction.options.getBoolean('sequential-names');
                const similarityThreshold = interaction.options.getInteger('similarity-threshold');

                config.antiRaid = config.antiRaid || {};
                config.antiRaid.patternDetection = config.antiRaid.patternDetection || {};

                if (similarNames !== null) config.antiRaid.patternDetection.similarNames = similarNames;
                if (defaultAvatars !== null) config.antiRaid.patternDetection.defaultAvatars = defaultAvatars;
                if (sequentialNames !== null) config.antiRaid.patternDetection.sequentialNames = sequentialNames;
                if (similarityThreshold !== null) config.antiRaid.patternDetection.similarityThreshold = similarityThreshold;

                await config.save();
                invalidateAntiConfig(guildId);

                return this.sendSuccess(interaction, `${getEmoji('cross')} Raid Pattern Detection Updated`,
                    `**Similar Names:** ${config.antiRaid.patternDetection.similarNames !== false ? `${getEmoji('tick')} ON` : `${getEmoji('cross')} OFF`}\n` +
                    `**Default Avatars:** ${config.antiRaid.patternDetection.defaultAvatars !== false ? `${getEmoji('tick')} ON` : `${getEmoji('cross')} OFF`}\n` +
                    `**Sequential Names:** ${config.antiRaid.patternDetection.sequentialNames !== false ? `${getEmoji('tick')} ON` : `${getEmoji('cross')} OFF`}\n` +
                    `**Similarity Threshold:** ${config.antiRaid.patternDetection.similarityThreshold || 70}%\n\n` +
                    `${getEmoji('help')} **Pattern Detection:**\n` +
                    `• Similar names: "User1, User2, User3"\n` +
                    `• Sequential: "raid001, raid002, raid003"\n` +
                    `• Default avatars: Many joins without custom avatar`
                );
            }

            if (subcommand === 'nuke-events') {
                const channelDelete = interaction.options.getBoolean('channel-delete');
                const channelCreate = interaction.options.getBoolean('channel-create');
                const roleDelete = interaction.options.getBoolean('role-delete');
                const roleCreate = interaction.options.getBoolean('role-create');
                const memberBan = interaction.options.getBoolean('member-ban');
                const memberKick = interaction.options.getBoolean('member-kick');
                const webhookCreate = interaction.options.getBoolean('webhook-create');
                const permissionChange = interaction.options.getBoolean('permission-change');

                config.antiNuke = config.antiNuke || {};
                config.antiNuke.monitoredEvents = config.antiNuke.monitoredEvents || {};

                if (channelDelete !== null) config.antiNuke.monitoredEvents.channelDelete = channelDelete;
                if (channelCreate !== null) config.antiNuke.monitoredEvents.channelCreate = channelCreate;
                if (roleDelete !== null) config.antiNuke.monitoredEvents.roleDelete = roleDelete;
                if (roleCreate !== null) config.antiNuke.monitoredEvents.roleCreate = roleCreate;
                if (memberBan !== null) config.antiNuke.monitoredEvents.memberBan = memberBan;
                if (memberKick !== null) config.antiNuke.monitoredEvents.memberKick = memberKick;
                if (webhookCreate !== null) config.antiNuke.monitoredEvents.webhookCreate = webhookCreate;
                if (permissionChange !== null) config.antiNuke.monitoredEvents.permissionOverwrite = permissionChange;

                await config.save();
                invalidateAntiConfig(guildId);

                const events = config.antiNuke.monitoredEvents;

                return this.sendSuccess(interaction, `${getEmoji('fire')} Monitored Events Updated`,
                    `**Channel Delete:** ${events.channelDelete !== false ? getEmoji('tick') : getEmoji('cross')}\n` +
                    `**Channel Create:** ${events.channelCreate !== false ? getEmoji('tick') : getEmoji('cross')}\n` +
                    `**Role Delete:** ${events.roleDelete !== false ? getEmoji('tick') : getEmoji('cross')}\n` +
                    `**Role Create:** ${events.roleCreate !== false ? getEmoji('tick') : getEmoji('cross')}\n` +
                    `**Member Ban:** ${events.memberBan !== false ? getEmoji('tick') : getEmoji('cross')}\n` +
                    `**Member Kick:** ${events.memberKick !== false ? getEmoji('tick') : getEmoji('cross')}\n` +
                    `**Webhook Create:** ${events.webhookCreate !== false ? getEmoji('tick') : getEmoji('cross')}\n` +
                    `**Permission Change:** ${events.permissionOverwrite !== false ? getEmoji('tick') : getEmoji('cross')}\n\n` +
                    `${getEmoji('help')} Disabled events will not trigger anti-nuke protection`
                );
            }

            if (subcommand === 'nuke-owner-alerts') {
                const enabled = interaction.options.getBoolean('enabled');
                const immediateDm = interaction.options.getBoolean('immediate-dm');
                const includeAttacker = interaction.options.getBoolean('include-attacker-info');
                const includeRecovery = interaction.options.getBoolean('include-recovery-options');

                config.antiNuke = config.antiNuke || {};
                config.antiNuke.ownerNotification = config.antiNuke.ownerNotification || {};

                if (enabled !== null) config.antiNuke.ownerNotification.enabled = enabled;
                if (immediateDm !== null) config.antiNuke.ownerNotification.immediateDm = immediateDm;
                if (includeAttacker !== null) config.antiNuke.ownerNotification.includeAttackerInfo = includeAttacker;
                if (includeRecovery !== null) config.antiNuke.ownerNotification.includeRecoveryOptions = includeRecovery;

                await config.save();
                invalidateAntiConfig(guildId);

                return this.sendSuccess(interaction, `${getEmoji('fire')} Owner Alerts Updated`,
                    `**Status:** ${config.antiNuke.ownerNotification.enabled !== false ? `${getEmoji('tick')} Enabled` : `${getEmoji('cross')} Disabled`}\n` +
                    `**Immediate DM:** ${config.antiNuke.ownerNotification.immediateDm !== false ? `${getEmoji('tick')} Yes` : `${getEmoji('cross')} No`}\n` +
                    `**Include Attacker Info:** ${config.antiNuke.ownerNotification.includeAttackerInfo !== false ? `${getEmoji('tick')} Yes` : `${getEmoji('cross')} No`}\n` +
                    `**Include Recovery Options:** ${config.antiNuke.ownerNotification.includeRecoveryOptions !== false ? `${getEmoji('tick')} Yes` : `${getEmoji('cross')} No`}\n\n` +
                    `${getEmoji('help')} When a nuke is detected, the server owner will receive a DM with all details.`
                );
            }

            if (subcommand === 'punishment-advanced') {
                const module = interaction.options.getString('module');
                const step1Threshold = interaction.options.getInteger('step-1-threshold');
                const step1Action = interaction.options.getString('step-1-action');
                const step2Threshold = interaction.options.getInteger('step-2-threshold');
                const step2Action = interaction.options.getString('step-2-action');
                const step3Threshold = interaction.options.getInteger('step-3-threshold');
                const step3Action = interaction.options.getString('step-3-action');

                config[module] = config[module] || {};
                config[module].punishment = config[module].punishment || {};
                config[module].punishment.actions = [];

                const actionDurations = {
                    'warn': 0,
                    'delete': 0,
                    'timeout-5': 5 * 60 * 1000,
                    'timeout-30': 30 * 60 * 1000,
                    'timeout-60': 60 * 60 * 1000,
                    'timeout-360': 360 * 60 * 1000,
                    'quarantine': 0,
                    'kick': 0,
                    'ban': 0,
                    'softban': 0
                };

                if (step1Threshold && step1Action) {
                    config[module].punishment.actions.push({
                        threshold: step1Threshold,
                        action: step1Action.replace('-5', '').replace('-30', '').replace('-60', '').replace('-360', ''),
                        duration: actionDurations[step1Action] || 0
                    });
                }

                if (step2Threshold && step2Action) {
                    config[module].punishment.actions.push({
                        threshold: step2Threshold,
                        action: step2Action.replace('-60', '').replace('-360', ''),
                        duration: actionDurations[step2Action] || 0
                    });
                }

                if (step3Threshold && step3Action) {
                    config[module].punishment.actions.push({
                        threshold: step3Threshold,
                        action: step3Action,
                        duration: actionDurations[step3Action] || 0
                    });
                }

                await config.save();
                invalidateAntiConfig(guildId);

                const moduleNames = {
                    'antiSpam': `${getEmoji('mute')} Anti-Spam`,
                    'antiLink': `${getEmoji('world')} Anti-Link`,
                    'antiRaid': `${getEmoji('cross')} Anti-Raid`,
                    'antiNuke': `${getEmoji('fire')} Anti-Nuke`
                };

                let escalationText = '';
                for (const action of config[module].punishment.actions) {
                    const durationText = action.duration > 0 ? ` (${action.duration / 60000}m)` : '';
                    escalationText += `• ${action.threshold} violations → ${action.action}${durationText}\n`;
                }

                return this.sendSuccess(interaction, `${getEmoji('scales')} ${moduleNames[module]} Escalation Updated`,
                    `**Escalation Path:**\n${escalationText || 'No steps configured'}\n\n` +
                    `${getEmoji('help')} Violations reset after 24 hours of good behavior`
                );
            }

            if (subcommand === 'threat-view') {
                const user = interaction.options.getUser('user');

                const threat = await ThreatScore.findOne({ guildId, memberId: user.id });

                if (!threat) {
                    return this.sendSuccess(interaction, 'Threat Score',
                        `**User:** ${user.tag}\n` +
                        `**Score:** 0/100\n` +
                        `**Status:** ${getEmoji('tick')} Clean\n\n` +
                        `This user has no recorded violations.`
                    );
                }

                const scoreBar = '█'.repeat(Math.floor(threat.score / 10)) + '░'.repeat(10 - Math.floor(threat.score / 10));
                const status = threat.score < 30 ? `${getEmoji('tick')} Low Risk` : threat.score < 50 ? `${getEmoji('time')} Moderate` : threat.score < 70 ? `${getEmoji('warning')} High Risk` : `${getEmoji('cross')} Critical`;

                let historyText = '';
                const recentHistory = threat.history?.slice(-5) || [];
                for (const entry of recentHistory) {
                    historyText += `• ${entry.type}: +${entry.pointsAdded} (<t:${Math.floor(new Date(entry.timestamp).getTime() / 1000)}:R>)\n`;
                }

                return this.sendSuccess(interaction, 'Threat Score',
                    `**User:** ${user.tag}\n` +
                    `**Score:** ${threat.score}/100 [${scoreBar}]\n` +
                    `**Status:** ${status}\n\n` +
                    `**Recent Violations:**\n${historyText || 'None'}\n\n` +
                    `**Last Decay:** ${threat.lastDecayAt ? `<t:${Math.floor(new Date(threat.lastDecayAt).getTime() / 1000)}:R>` : 'Never'}`
                );
            }

            if (subcommand === 'threat-reset') {
                const user = interaction.options.getUser('user');

                await ThreatScore.findOneAndDelete({ guildId, memberId: user.id });

                return this.sendSuccess(interaction, 'Threat Score Reset',
                    `**User:** ${user.tag}\n` +
                    `**New Score:** 0/100\n\n` +
                    `All violation history has been cleared.`
                );
            }

            if (subcommand === 'threat-modify') {
                const user = interaction.options.getUser('user');
                const points = interaction.options.getInteger('points');
                const reason = interaction.options.getString('reason') || 'Manual adjustment';

                let threat = await ThreatScore.findOne({ guildId, memberId: user.id });
                if (!threat) {
                    threat = new ThreatScore({ guildId, memberId: user.id, score: 0 });
                }

                const oldScore = threat.score;
                threat.score = Math.max(0, Math.min(100, threat.score + points));
                threat.history = threat.history || [];
                threat.history.push({
                    type: 'manual_adjustment',
                    pointsAdded: points,
                    reason: reason,
                    moderator: interaction.user.id,
                    timestamp: new Date()
                });

                await threat.save();

                return this.sendSuccess(interaction, 'Threat Score Modified',
                    `**User:** ${user.tag}\n` +
                    `**Old Score:** ${oldScore}\n` +
                    `**Change:** ${points > 0 ? '+' : ''}${points}\n` +
                    `**New Score:** ${threat.score}\n` +
                    `**Reason:** ${reason}`
                );
            }

            if (subcommand === 'threat-leaderboard') {
                const threats = await ThreatScore.find({ guildId })
                    .sort({ score: -1 })
                    .limit(10);

                if (threats.length === 0) {
                    return this.sendSuccess(interaction, 'Threat Leaderboard', 'No users have threat scores.');
                }

                let leaderboardText = '';
                for (let i = 0; i < threats.length; i++) {
                    const t = threats[i];
                    const member = await interaction.guild.members.fetch(t.memberId).catch(() => null);
                    const name = member?.user?.tag || `Unknown (${t.memberId})`;
                    const status = t.score < 30 ? getEmoji('tick') : t.score < 50 ? getEmoji('time') : t.score < 70 ? getEmoji('warning') : getEmoji('cross');
                    leaderboardText += `${i + 1}. ${status} **${name}** - ${t.score} points\n`;
                }

                return this.sendSuccess(interaction, 'Threat Leaderboard',
                    `**Highest Risk Users:**\n\n${leaderboardText}`
                );
            }

            if (subcommand === 'whitelist-bypass') {
                const bypassAdmins = interaction.options.getBoolean('bypass-admins');
                const bypassModerators = interaction.options.getBoolean('bypass-moderators');
                const bypassBoosters = interaction.options.getBoolean('bypass-boosters');
                const accountAgeBypass = interaction.options.getInteger('account-age-bypass');

                config.whitelist = config.whitelist || {};

                if (bypassAdmins !== null) config.whitelist.bypassAdmins = bypassAdmins;
                if (bypassModerators !== null) config.whitelist.bypassModerators = bypassModerators;
                if (bypassBoosters !== null) config.whitelist.bypassBoosters = bypassBoosters;
                if (accountAgeBypass !== null) config.whitelist.accountAgeBypass = accountAgeBypass * 24 * 60 * 60 * 1000;

                await config.save();
                invalidateAntiConfig(guildId);

                return this.sendSuccess(interaction, `${getEmoji('tick')} Whitelist Bypass Updated`,
                    `**Bypass Admins:** ${config.whitelist.bypassAdmins !== false ? `${getEmoji('tick')} Yes` : `${getEmoji('cross')} No`}\n` +
                    `**Bypass Moderators:** ${config.whitelist.bypassModerators ? `${getEmoji('tick')} Yes` : `${getEmoji('cross')} No`}\n` +
                    `**Bypass Boosters:** ${config.whitelist.bypassBoosters ? `${getEmoji('tick')} Yes` : `${getEmoji('cross')} No`}\n` +
                    `**Account Age Bypass:** ${config.whitelist.accountAgeBypass ? `${config.whitelist.accountAgeBypass / 86400000} days` : 'Disabled'}\n\n` +
                    `${getEmoji('help')} Users matching these criteria bypass anti-system checks`
                );
            }

            if (subcommand === 'whitelist-view') {
                config.whitelist = config.whitelist || {};

                const members = config.whitelist.customMembers || [];
                const roles = config.whitelist.customRoles || [];
                const channels = config.whitelist.customChannels || [];

                const card = buildCard({ accent: ACCENT.success })
                    .addText(`**Whitelist Overview**`)
                    .addSeparator()
                    .addText(
                        `**Whitelisted Members:** ${members.length}\n` +
                        `**Whitelisted Roles:** ${roles.length}\n` +
                        `**Whitelisted Channels:** ${channels.length}`
                    )
                    .addSeparator()
                    .addText(
                        `**Members:** ${members.length ? members.map(m => `<@${m}>`).join(', ') : 'None'}\n` +
                        `**Roles:** ${roles.length ? roles.map(r => `<@&${r}>`).join(', ') : 'None'}\n` +
                        `**Channels:** ${channels.length ? channels.map(c => `<#${c}>`).join(', ') : 'None'}`
                    );

                return sendV2(interaction, card);
            }

            if (subcommand === 'export-config') {
                const exportData = {
                    systemMode: config.systemMode,
                    aiSettings: config.aiSettings,
                    antiSpam: config.antiSpam,
                    antiLink: config.antiLink,
                    antiRaid: config.antiRaid,
                    antiNuke: config.antiNuke,
                    threatSystem: config.threatSystem,
                    antiEvasion: config.antiEvasion,
                    whitelist: {
                        bypassAdmins: config.whitelist?.bypassAdmins,
                        bypassModerators: config.whitelist?.bypassModerators
                    },
                    roleTrustLevels: config.roleTrustLevels
                };

                const jsonString = JSON.stringify(exportData, null, 2);

                return this.sendSuccess(interaction, 'Configuration Export',
                    `**Server:** ${interaction.guild.name}\n` +
                    `**Exported:** ${new Date().toISOString()}\n\n` +
                    `\`\`\`json\n${jsonString.slice(0, 1500)}${jsonString.length > 1500 ? '\n...(truncated)' : ''}\n\`\`\`\n\n` +
                    `${getEmoji('help')} Save this configuration to restore later or share with other servers.`
                );
            }

            if (subcommand === 'quick-preset') {
                const preset = interaction.options.getString('preset');

                const presets = {
                    relaxed: {
                        name: 'Relaxed',
                        desc: 'Light protection for trusted communities',
                        antiSpam: { messageLimit: 10, timeWindow: 5000, mentionLimit: 10 },
                        antiLink: { mode: 'moderate' },
                        antiRaid: { joinLimit: 15, timeWindow: 120000 },
                        antiNuke: { limits: { channelDelete: 3, roleDelete: 3 } }
                    },
                    balanced: {
                        name: 'Balanced',
                        desc: 'Moderate protection for most servers',
                        antiSpam: { messageLimit: 5, timeWindow: 5000, mentionLimit: 5 },
                        antiLink: { mode: 'moderate' },
                        antiRaid: { joinLimit: 8, timeWindow: 60000 },
                        antiNuke: { limits: { channelDelete: 2, roleDelete: 2 } }
                    },
                    strict: {
                        name: 'Strict',
                        desc: 'Strong protection for larger servers',
                        antiSpam: { messageLimit: 3, timeWindow: 5000, mentionLimit: 3 },
                        antiLink: { mode: 'strict' },
                        antiRaid: { joinLimit: 5, timeWindow: 30000 },
                        antiNuke: { limits: { channelDelete: 1, roleDelete: 1 } }
                    },
                    paranoid: {
                        name: 'Paranoid',
                        desc: 'Maximum protection for high-risk servers',
                        antiSpam: { messageLimit: 2, timeWindow: 3000, mentionLimit: 2 },
                        antiLink: { mode: 'strict', shortenerProtection: true, ipLinkProtection: true },
                        antiRaid: { joinLimit: 3, timeWindow: 20000, accountAgeCheck: true },
                        antiNuke: { limits: { channelDelete: 1, roleDelete: 1 }, lockdownOnDetection: true }
                    },
                    gaming: {
                        name: 'Gaming',
                        desc: 'Optimized for gaming communities',
                        antiSpam: { messageLimit: 7, timeWindow: 5000, emojiLimit: 20 },
                        antiLink: { mode: 'custom' },
                        antiRaid: { joinLimit: 10, timeWindow: 60000 },
                        antiNuke: { limits: { channelDelete: 2, roleDelete: 2 } }
                    },
                    community: {
                        name: 'Community',
                        desc: 'Optimized for large public communities',
                        antiSpam: { messageLimit: 5, timeWindow: 5000, mentionLimit: 5, duplicateThreshold: 3 },
                        antiLink: { mode: 'moderate', inviteHandling: { blockAllInvites: true } },
                        antiRaid: { joinLimit: 10, timeWindow: 60000, accountAgeCheck: true, minAccountAge: 604800000 },
                        antiNuke: { limits: { channelDelete: 1, roleDelete: 1, memberBan: 3 } }
                    }
                };

                const selectedPreset = presets[preset];

                
                Object.assign(config.antiSpam, selectedPreset.antiSpam);
                Object.assign(config.antiLink, selectedPreset.antiLink);
                Object.assign(config.antiRaid, selectedPreset.antiRaid);
                config.antiNuke.limits = selectedPreset.antiNuke.limits;
                if (selectedPreset.antiNuke.lockdownOnDetection) {
                    config.antiNuke.lockdownOnDetection = true;
                }

                await config.save();
                invalidateAntiConfig(guildId);

                return this.sendSuccess(interaction, `${selectedPreset.name} Preset Applied`,
                    `**Description:** ${selectedPreset.desc}\n\n` +
                    `**Settings Applied:**\n` +
                    `• Anti-Spam: ${selectedPreset.antiSpam.messageLimit} msgs/${selectedPreset.antiSpam.timeWindow / 1000}s\n` +
                    `• Anti-Link: ${selectedPreset.antiLink.mode} mode\n` +
                    `• Anti-Raid: ${selectedPreset.antiRaid.joinLimit} joins/${selectedPreset.antiRaid.timeWindow / 1000}s\n` +
                    `• Anti-Nuke: ${selectedPreset.antiNuke.limits.channelDelete} channel deletions\n\n` +
                    `${getEmoji('help')} Use individual commands to fine-tune settings.`
                );
            }

        } catch (error) {
            console.error('Manage-antimodules error:', error);
            return this.sendError(interaction, 'An error occurred. Please try again.');
        }
    },

    sendSuccess(interaction, title, description) {
        const cleanTitle = typeof title === 'string' ? title.replace(/^[\p{Emoji}\s]+/u, '') : 'Success';
        const card = buildCard({ accent: ACCENT.success })
            .addText(`**${cleanTitle}**`)
            .addSeparator()
            .addText(description);
        return sendV2(interaction, card);
    },

    sendError(interaction, message) {
        const card = cards.error(lang.errorTitle, message);
        return sendV2(interaction, card);
    }
};
