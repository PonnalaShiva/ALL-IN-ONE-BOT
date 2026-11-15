

const { 
    SlashCommandBuilder, 
    PermissionsBitField,
    TextDisplayBuilder,
    ContainerBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder
} = require('discord.js');
const AntiConfig = require('../../models/antiSystem/AntiConfig');
const QuarantineConfig = require('../../models/qurantine/quarantineConfig');
const checkPermissions = require('../../utils/checkPermissions');
const { invalidateAntiConfig } = require('../../utils/cacheHelpers');
const loadLanguage = require('../../events/loadLanguage');
const { cards, buildCard, getEmoji, getButtonEmoji } = require('../../UI');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-antimodules')
        .setDescription('Configure advanced anti-system protection (Core Setup)')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)

        .addSubcommand(sub => sub
            .setName('init')
            .setDescription('Initialize anti-system for this server')
            .addChannelOption(opt => opt.setName('log-channel').setDescription('Channel for anti-system logs').setRequired(true))
            .addChannelOption(opt => opt.setName('alert-channel').setDescription('Channel for critical security alerts'))
            .addChannelOption(opt => opt.setName('staff-channel').setDescription('Channel for staff activity monitoring'))
            .addStringOption(opt => opt.setName('mode').setDescription('System mode')
                .addChoices(
                    { name: 'Active - Full protection', value: 'active' },
                    { name: 'Dry-Run - Test without actions', value: 'dry-run' },
                    { name: 'Log-Only - Only logging', value: 'log-only' }
                )))
        
        .addSubcommand(sub => sub
            .setName('status')
            .setDescription('View complete anti-system status and configuration'))
        
        .addSubcommand(sub => sub
            .setName('guide')
            .setDescription('View detailed setup guide and feature explanations'))
        
        .addSubcommand(sub => sub
            .setName('reset')
            .setDescription('Reset anti-system to default settings')
            .addBooleanOption(opt => opt.setName('confirm').setDescription('Type true to confirm reset').setRequired(true)))

        .addSubcommand(sub => sub
            .setName('mode')
            .setDescription('️ Set system operation mode')
            .addStringOption(opt => opt.setName('mode').setDescription('Operation mode').setRequired(true)
                .addChoices(
                    { name: 'Active - Full protection enabled', value: 'active' },
                    { name: 'Dry-Run - Simulate actions (testing)', value: 'dry-run' },
                    { name: 'Log-Only - Only log detections', value: 'log-only' }
                ))
            .addBooleanOption(opt => opt.setName('notify-simulations').setDescription('Notify when actions are simulated')))
        
        .addSubcommand(sub => sub
            .setName('logging')
            .setDescription('Configure logging settings')
            .addChannelOption(opt => opt.setName('log-channel').setDescription('Main log channel'))
            .addChannelOption(opt => opt.setName('alert-channel').setDescription('Critical alerts channel'))
            .addChannelOption(opt => opt.setName('staff-channel').setDescription('Staff monitoring channel'))
            .addStringOption(opt => opt.setName('level').setDescription('Log detail level')
                .addChoices(
                    { name: 'Minimal - Essential logs only', value: 'minimal' },
                    { name: 'Normal - Standard logging', value: 'normal' },
                    { name: 'Verbose - Detailed logs', value: 'verbose' },
                    { name: 'Debug - Everything', value: 'debug' }
                ))
            .addBooleanOption(opt => opt.setName('include-content').setDescription('Include message content in logs')))

        .addSubcommand(sub => sub
            .setName('ai')
            .setDescription('Configure AI-powered detection')
            .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable AI detection'))
            .addStringOption(opt => opt.setName('sensitivity').setDescription('Detection sensitivity')
                .addChoices(
                    { name: 'Low - Fewer false positives', value: 'low' },
                    { name: 'Medium - Balanced', value: 'medium' },
                    { name: 'High - More sensitive', value: 'high' },
                    { name: 'Paranoid - Maximum sensitivity', value: 'paranoid' }
                ))
            .addNumberOption(opt => opt.setName('threshold').setDescription('Confidence threshold (0.1-1.0)').setMinValue(0.1).setMaxValue(1.0))
            .addBooleanOption(opt => opt.setName('use-for-spam').setDescription('Use AI for spam detection'))
            .addBooleanOption(opt => opt.setName('use-for-links').setDescription('Use AI for link analysis')))

        .addSubcommand(sub => sub
            .setName('spam')
            .setDescription('Configure anti-spam protection')
            .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable anti-spam'))
            .addIntegerOption(opt => opt.setName('message-limit').setDescription('Max messages in time window (2-30)').setMinValue(2).setMaxValue(30))
            .addIntegerOption(opt => opt.setName('time-window').setDescription('Time window in seconds (1-60)').setMinValue(1).setMaxValue(60))
            .addIntegerOption(opt => opt.setName('mention-limit').setDescription('Max mentions per message (1-50)').setMinValue(1).setMaxValue(50))
            .addIntegerOption(opt => opt.setName('emoji-limit').setDescription('Max emojis per message (3-100)').setMinValue(3).setMaxValue(100))
            .addIntegerOption(opt => opt.setName('duplicate-threshold').setDescription('Duplicate message count (2-10)').setMinValue(2).setMaxValue(10)))
        
        .addSubcommand(sub => sub
            .setName('spam-advanced')
            .setDescription('Advanced anti-spam settings')
            .addBooleanOption(opt => opt.setName('caps-enabled').setDescription('Enable caps detection'))
            .addIntegerOption(opt => opt.setName('caps-percentage').setDescription('Caps percentage threshold (50-100)').setMinValue(50).setMaxValue(100))
            .addBooleanOption(opt => opt.setName('attachment-spam').setDescription('Enable attachment spam detection'))
            .addBooleanOption(opt => opt.setName('newline-spam').setDescription('Enable newline spam detection'))
            .addIntegerOption(opt => opt.setName('max-newlines').setDescription('Max newlines allowed (5-50)').setMinValue(5).setMaxValue(50)))

        .addSubcommand(sub => sub
            .setName('link')
            .setDescription('Configure anti-link protection')
            .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable anti-link'))
            .addStringOption(opt => opt.setName('mode').setDescription('Detection mode')
                .addChoices(
                    { name: 'Strict - Block ALL links', value: 'strict' },
                    { name: '️ Moderate - Block suspicious only', value: 'moderate' },
                    { name: 'Custom - Use allow/block lists', value: 'custom' }
                ))
            .addBooleanOption(opt => opt.setName('shortener-protection').setDescription('Block URL shorteners (bit.ly etc)'))
            .addBooleanOption(opt => opt.setName('ip-protection').setDescription('Block IP-based links'))
            .addBooleanOption(opt => opt.setName('phishing-protection').setDescription('Enable phishing detection')))
        
        .addSubcommand(sub => sub
            .setName('link-invites')
            .setDescription('Configure Discord invite handling')
            .addBooleanOption(opt => opt.setName('block-all').setDescription('Block ALL Discord invites'))
            .addBooleanOption(opt => opt.setName('allow-own-server').setDescription('Allow invites to this server'))
            .addBooleanOption(opt => opt.setName('allow-partners').setDescription('Allow partner server invites'))
            .addBooleanOption(opt => opt.setName('block-vanity').setDescription('Block vanity URL invites')))

        .addSubcommand(sub => sub
            .setName('raid')
            .setDescription('Configure anti-raid protection')
            .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable anti-raid'))
            .addIntegerOption(opt => opt.setName('join-limit').setDescription('Max joins in time window (2-50)').setMinValue(2).setMaxValue(50))
            .addIntegerOption(opt => opt.setName('time-window').setDescription('Time window in seconds (5-300)').setMinValue(5).setMaxValue(300))
            .addBooleanOption(opt => opt.setName('account-age-check').setDescription('Check account age'))
            .addIntegerOption(opt => opt.setName('min-account-age').setDescription('Minimum account age in days (1-365)').setMinValue(1).setMaxValue(365))
            .addStringOption(opt => opt.setName('action').setDescription('Action for raiders')
                .addChoices(
                    { name: 'Kick', value: 'kick' },
                    { name: 'Ban', value: 'ban' },
                    { name: 'Quarantine', value: 'quarantine' },
                    { name: 'Verify', value: 'verify' }
                )))
        
        .addSubcommand(sub => sub
            .setName('raid-verification')
            .setDescription('Configure raid verification settings')
            .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable verification mode'))
            .addStringOption(opt => opt.setName('type').setDescription('Verification type')
                .addChoices(
                    { name: 'Button Click', value: 'button' },
                    { name: 'Reaction', value: 'reaction' },
                    { name: 'CAPTCHA', value: 'captcha' }
                ))
            .addIntegerOption(opt => opt.setName('timeout').setDescription('Verification timeout in minutes (1-30)').setMinValue(1).setMaxValue(30))
            .addBooleanOption(opt => opt.setName('kick-on-timeout').setDescription('Kick if verification times out')))

        .addSubcommand(sub => sub
            .setName('nuke')
            .setDescription('Configure anti-nuke protection')
            .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable anti-nuke'))
            .addIntegerOption(opt => opt.setName('channel-delete-limit').setDescription('Max channel deletions (1-10)').setMinValue(1).setMaxValue(10))
            .addIntegerOption(opt => opt.setName('role-delete-limit').setDescription('Max role deletions (1-10)').setMinValue(1).setMaxValue(10))
            .addIntegerOption(opt => opt.setName('ban-limit').setDescription('Max bans allowed (1-10)').setMinValue(1).setMaxValue(10))
            .addIntegerOption(opt => opt.setName('kick-limit').setDescription('Max kicks allowed (1-20)').setMinValue(1).setMaxValue(20))
            .addIntegerOption(opt => opt.setName('time-window').setDescription('Time window in seconds (5-60)').setMinValue(5).setMaxValue(60))
            .addBooleanOption(opt => opt.setName('lockdown-on-detection').setDescription('Lock server on nuke detection')))
        
        .addSubcommand(sub => sub
            .setName('nuke-bots')
            .setDescription('Configure bot protection')
            .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable bot protection'))
            .addBooleanOption(opt => opt.setName('block-unauthorized').setDescription('Kick unauthorized bots on add'))
            .addBooleanOption(opt => opt.setName('monitor-bot-actions').setDescription('Monitor bot actions'))
            .addStringOption(opt => opt.setName('add-bot').setDescription('Add bot ID to authorized list'))
            .addStringOption(opt => opt.setName('remove-bot').setDescription('Remove bot ID from authorized list')))

        .addSubcommand(sub => sub
            .setName('threat')
            .setDescription('Configure threat score system')
            .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable threat scoring'))
            .addIntegerOption(opt => opt.setName('warn-threshold').setDescription('Score to trigger warning (10-50)').setMinValue(10).setMaxValue(50))
            .addIntegerOption(opt => opt.setName('timeout-threshold').setDescription('Score to trigger timeout (30-70)').setMinValue(30).setMaxValue(70))
            .addIntegerOption(opt => opt.setName('quarantine-threshold').setDescription('Score to trigger quarantine (50-90)').setMinValue(50).setMaxValue(90))
            .addIntegerOption(opt => opt.setName('ban-threshold').setDescription('Score to trigger ban (70-100)').setMinValue(70).setMaxValue(100))
            .addBooleanOption(opt => opt.setName('auto-decay').setDescription('Enable score auto-decay'))
            .addIntegerOption(opt => opt.setName('decay-rate').setDescription('Points decay per hour (1-10)').setMinValue(1).setMaxValue(10)))

        .addSubcommand(sub => sub
            .setName('evasion')
            .setDescription('Configure anti-evasion detection')
            .addBooleanOption(opt => opt.setName('enabled').setDescription('Enable anti-evasion'))
            .addBooleanOption(opt => opt.setName('unicode-normalize').setDescription('Normalize Unicode characters'))
            .addBooleanOption(opt => opt.setName('zero-width-remove').setDescription('Remove zero-width characters'))
            .addBooleanOption(opt => opt.setName('homoglyph-detect').setDescription('Detect homoglyph spoofing'))
            .addBooleanOption(opt => opt.setName('leetspeak-detect').setDescription('Detect leetspeak (1337)'))
            .addBooleanOption(opt => opt.setName('url-decode').setDescription('Decode URL-encoded text')))

        .addSubcommand(sub => sub
            .setName('whitelist-member')
            .setDescription('Add/remove member from whitelist')
            .addUserOption(opt => opt.setName('user').setDescription('User to whitelist/unwhitelist').setRequired(true))
            .addStringOption(opt => opt.setName('action').setDescription('Action').setRequired(true)
                .addChoices(
                    { name: 'Add to whitelist', value: 'add' },
                    { name: 'Remove from whitelist', value: 'remove' }
                )))
        
        .addSubcommand(sub => sub
            .setName('whitelist-role')
            .setDescription('Add/remove role from whitelist')
            .addRoleOption(opt => opt.setName('role').setDescription('Role to whitelist/unwhitelist').setRequired(true))
            .addStringOption(opt => opt.setName('action').setDescription('Action').setRequired(true)
                .addChoices(
                    { name: 'Add to whitelist', value: 'add' },
                    { name: 'Remove from whitelist', value: 'remove' }
                )))
        
        .addSubcommand(sub => sub
            .setName('whitelist-channel')
            .setDescription('Add/remove channel from whitelist')
            .addChannelOption(opt => opt.setName('channel').setDescription('Channel to whitelist/unwhitelist').setRequired(true))
            .addStringOption(opt => opt.setName('action').setDescription('Action').setRequired(true)
                .addChoices(
                    { name: 'Add to whitelist', value: 'add' },
                    { name: 'Remove from whitelist', value: 'remove' }
                ))
            .addStringOption(opt => opt.setName('module').setDescription('Apply to specific module')
                .addChoices(
                    { name: 'All modules', value: 'all' },
                    { name: 'Anti-Spam only', value: 'spam' },
                    { name: 'Anti-Link only', value: 'link' }
                )))

        .addSubcommand(sub => sub
            .setName('punishment')
            .setDescription('️ Quick punishment setup')
            .addStringOption(opt => opt.setName('module').setDescription('Module to configure').setRequired(true)
                .addChoices(
                    { name: 'Anti-Spam', value: 'spam' },
                    { name: 'Anti-Link', value: 'link' },
                    { name: 'Anti-Raid', value: 'raid' },
                    { name: 'Anti-Nuke', value: 'nuke' }
                ))
            .addStringOption(opt => opt.setName('default-action').setDescription('Default action for violations')
                .addChoices(
                    { name: '️ Warn', value: 'warn' },
                    { name: '️ Delete only', value: 'delete' },
                    { name: '⏱️ Timeout', value: 'timeout' },
                    { name: 'Kick', value: 'kick' },
                    { name: 'Quarantine', value: 'quarantine' },
                    { name: 'Ban', value: 'ban' }
                ))
            .addIntegerOption(opt => opt.setName('max-warnings').setDescription('Warnings before escalation (1-10)').setMinValue(1).setMaxValue(10))
            .addIntegerOption(opt => opt.setName('timeout-duration').setDescription('Timeout duration in minutes (1-1440)').setMinValue(1).setMaxValue(1440))),

    async execute(interaction) {
        await interaction.deferReply();
        
        if (!await checkPermissions(interaction, 'admin')) return;
        
        const guildId = interaction.guild.id;
        const lang = await loadLanguage(guildId);
        const l = lang.setups?.antimodules || {};
        const subcommand = interaction.options.getSubcommand();
        
        try {
            let config = await AntiConfig.findOne({ guildId }) || new AntiConfig({ guildId });

            if (subcommand === 'init') {
                const logChannel = interaction.options.getChannel('log-channel');
                const alertChannel = interaction.options.getChannel('alert-channel');
                const staffChannel = interaction.options.getChannel('staff-channel');
                const mode = interaction.options.getString('mode') || 'active';
                
                if (!logChannel.isTextBased()) {
                    return this.sendError(interaction, 'Log channel must be a text channel!');
                }
                
                const owner = await interaction.guild.fetchOwner();
                
                
                config.enabled = true;
                config.systemMode = config.systemMode || {};
                config.systemMode.mode = mode;
                config.logging = config.logging || {};
                config.logging.logChannelId = logChannel.id;
                config.logging.alertChannelId = alertChannel?.id || logChannel.id;
                config.logging.staffChannelId = staffChannel?.id || null;
                config.whitelist = config.whitelist || {};
                config.whitelist.owners = [owner.id];
                
                
                config.logChannelId = logChannel.id;
                config.alertChannelId = alertChannel?.id || logChannel.id;
                
                await config.save();
                invalidateAntiConfig(guildId);
                
                let quarantineConfig;
                try {
                    quarantineConfig = await QuarantineConfig.findOne({ guildId });
                } catch (e) {
                    quarantineConfig = null;
                }
                
                const components = [];
                
                
                const headerContainer = new ContainerBuilder().setAccentColor(0x00ff88);
                headerContainer.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `# ${getEmoji('security')} Anti-System Initialized!\n` +
                        `## Your server is now protected\n\n` +
                        `> Advanced Wick-level security system is now active\n` +
                        `> All modules enabled with intelligent defaults`
                    )
                );
                components.push(headerContainer);
                components.push(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large));
                
                
                const configContainer = new ContainerBuilder().setAccentColor(0x00aaff);
                configContainer.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## ${getEmoji('settings')} **Configuration**\n\n` +
                        `**System Mode**\n${mode === 'active' ? `${getEmoji('tick')} Active` : mode === 'dry-run' ? `${getEmoji('time')} Dry-Run` : `${getEmoji('list')} Log-Only`}\n\n` +
                        `**Log Channel**\n<#${logChannel.id}>\n\n` +
                        `**Alert Channel**\n<#${alertChannel?.id || logChannel.id}>\n\n` +
                        `**Staff Channel**\n${staffChannel ? `<#${staffChannel.id}>` : `${getEmoji('cross')} Not Set`}\n\n` +
                        `**Quarantine System**\n${quarantineConfig?.quarantineEnabled ? `${getEmoji('tick')} Available` : `${getEmoji('warning')} Not configured - Use /setup-quarantine`}`
                    )
                );
                components.push(configContainer);
                components.push(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large));
                
                
                const modulesContainer = new ContainerBuilder().setAccentColor(0x9b59b6);
                modulesContainer.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## ${getEmoji('security')} **Active Protection Modules**\n\n` +
                        `**${getEmoji('mute')} Anti-Spam** - ${getEmoji('tick')} Enabled\n` +
                        `Detects message spam, mention spam, emoji spam, caps, duplicates\n\n` +
                        `**${getEmoji('world')} Anti-Link** - ${getEmoji('tick')} Enabled\n` +
                        `Blocks malicious links, phishing, URL shorteners\n\n` +
                        `**${getEmoji('cross')} Anti-Raid** - ${getEmoji('tick')} Enabled\n` +
                        `Detects mass joins, new accounts, similar names\n\n` +
                        `**${getEmoji('fire')} Anti-Nuke** - ${getEmoji('tick')} Enabled\n` +
                        `Monitors deletions, bans, role changes, webhooks`
                    )
                );
                components.push(modulesContainer);
                components.push(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large));
                
                
                const nextContainer = new ContainerBuilder().setAccentColor(0xf1c40f);
                nextContainer.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## ${getEmoji('list')} **Next Steps**\n\n` +
                        `1. Use \`/setup-antimodules guide\` for detailed explanations\n` +
                        `2. Configure whitelist with \`/setup-antimodules whitelist-role\`\n` +
                        `3. Adjust thresholds with \`/setup-antimodules spam/link/raid/nuke\`\n` +
                        `4. Use \`/manage-antimodules\` for advanced settings\n` +
                        `5. Test with dry-run mode before going live`
                    )
                );
                components.push(nextContainer);
                
                return interaction.editReply({ components, flags: MessageFlags.IsComponentsV2 });
            }

            if (subcommand === 'guide') {
                const components = [];
                
                const headerContainer = new ContainerBuilder().setAccentColor(0x3498db);
                headerContainer.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `# ${getEmoji('help')} Anti-System Complete Guide\n` +
                        `## Everything you need to know\n\n` +
                        `> This guide explains all features and how to configure them\n` +
                        `> Use this as a reference when setting up protection`
                    )
                );
                components.push(headerContainer);
                components.push(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large));
                
                
                const modesContainer = new ContainerBuilder().setAccentColor(0x2ecc71);
                modesContainer.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## ${getEmoji('settings')} **System Modes**\n\n` +
                        `**${getEmoji('tick')} Active Mode**\n` +
                        `Full protection - All violations are detected AND punished automatically.\n\n` +
                        `**${getEmoji('time')} Dry-Run Mode**\n` +
                        `Testing mode - Detects violations but SIMULATES actions without actually punishing. Perfect for testing your configuration.\n\n` +
                        `**${getEmoji('list')} Log-Only Mode**\n` +
                        `Passive mode - Only logs detections without any action. Use for monitoring before enabling protection.`
                    )
                );
                components.push(modesContainer);
                components.push(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large));
                
                
                const spamContainer = new ContainerBuilder().setAccentColor(0xe74c3c);
                spamContainer.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## ${getEmoji('mute')} **Anti-Spam Module**\n\n` +
                        `**What it detects:**\n` +
                        `• Rapid message flooding (X messages in Y seconds)\n` +
                        `• Duplicate/similar message spam\n` +
                        `• Excessive mentions (@everyone, role spam)\n` +
                        `• Emoji spam and caps lock abuse\n` +
                        `• Attachment/media flooding\n` +
                        `• Newline spam (wall of text)\n` +
                        `• Evasion attempts (Unicode tricks)\n\n` +
                        `**Key Settings:**\n` +
                        `\`message-limit\` - Messages allowed in time window\n` +
                        `\`time-window\` - Detection window in seconds\n` +
                        `\`mention-limit\` - Max mentions per message\n` +
                        `\`duplicate-threshold\` - Similar messages before action`
                    )
                );
                components.push(spamContainer);
                components.push(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large));
                
                const linkContainer = new ContainerBuilder().setAccentColor(0x9b59b6);
                linkContainer.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## ${getEmoji('world')} **Anti-Link Module**\n\n` +
                        `**What it detects:**\n` +
                        `• Phishing links (fake Discord, Steam, Nitro scams)\n` +
                        `• Malicious URLs and redirects\n` +
                        `• URL shorteners (bit.ly, tinyurl)\n` +
                        `• IP-based links (suspicious direct IPs)\n` +
                        `• Spoofed domains (d1scord.com, etc)\n` +
                        `• Unauthorized Discord invites\n\n` +
                        `**Modes:**\n` +
                        `\`Strict\` - Block ALL links except whitelisted\n` +
                        `\`Moderate\` - Block only suspicious links\n` +
                        `\`Custom\` - Use your allow/block domain lists`
                    )
                );
                components.push(linkContainer);
                components.push(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large));
                
                const raidContainer = new ContainerBuilder().setAccentColor(0xe67e22);
                raidContainer.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## ${getEmoji('cross')} **Anti-Raid Module**\n\n` +
                        `**What it detects:**\n` +
                        `• Mass join attacks (many joins in short time)\n` +
                        `• New account flooding (recently created accounts)\n` +
                        `• Similar username patterns (bot accounts)\n` +
                        `• Default avatar raids\n` +
                        `• Sequential/generated names\n\n` +
                        `**Progressive Response:**\n` +
                        `Level 1: Alert staff, monitor closely\n` +
                        `Level 2: Enable verification mode\n` +
                        `Level 3: Quarantine suspicious joins\n` +
                        `Level 4: Full lockdown, kick/ban raiders\n\n` +
                        `**Verification Mode:**\n` +
                        `New joins must click button/react to prove they're human`
                    )
                );
                components.push(raidContainer);
                components.push(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large));
                
                const nukeContainer = new ContainerBuilder().setAccentColor(0xc0392b);
                nukeContainer.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## ${getEmoji('fire')} **Anti-Nuke Module**\n\n` +
                        `**What it monitors:**\n` +
                        `• Channel deletions/creations\n` +
                        `• Role deletions/creations\n` +
                        `• Mass bans/kicks\n` +
                        `• Webhook abuse\n` +
                        `• Emoji/sticker mass deletion\n` +
                        `• Dangerous permission grants\n` +
                        `• Server settings changes\n` +
                        `• Unauthorized bot additions\n\n` +
                        `**Response:**\n` +
                        `When thresholds exceeded → Strip roles, quarantine/ban attacker, lock server if critical`
                    )
                );
                components.push(nukeContainer);
                components.push(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large));
                
                const threatContainer = new ContainerBuilder().setAccentColor(0x1abc9c);
                threatContainer.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## ${getEmoji('analytics')} **Threat Score System**\n\n` +
                        `**How it works:**\n` +
                        `Every user has a threat score (0-100). Violations add points, good behavior decays points.\n\n` +
                        `**Automatic Actions:**\n` +
                        `Score 30+ → Warning issued\n` +
                        `Score 50+ → Timeout applied\n` +
                        `Score 70+ → Quarantine activated\n` +
                        `Score 90+ → Automatic ban\n\n` +
                        `**Score Decay:**\n` +
                        `Scores automatically decrease over time if the user behaves. Default: 2 points/hour.`
                    )
                );
                components.push(threatContainer);
                
                return interaction.editReply({ components, flags: MessageFlags.IsComponentsV2 });
            }

            if (subcommand === 'status') {
                const components = [];
                
                const headerContainer = new ContainerBuilder().setAccentColor(0x3498db);
                headerContainer.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `# ${getEmoji('analytics')} Anti-System Status\n` +
                        `## ${interaction.guild.name}\n\n` +
                        `> Complete overview of your security configuration`
                    )
                );
                components.push(headerContainer);
                components.push(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large));
                
                const modeColors = { 'active': getEmoji('tick'), 'dry-run': getEmoji('time'), 'log-only': getEmoji('list') };
                
                const systemContainer = new ContainerBuilder().setAccentColor(config.enabled ? 0x00ff00 : 0xff0000);
                systemContainer.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## ${getEmoji('settings')} **System Status**\n\n` +
                        `**Overall Status:** ${config.enabled ? `${getEmoji('tick')} ENABLED` : `${getEmoji('cross')} DISABLED`}\n` +
                        `**Mode:** ${modeColors[config.systemMode?.mode || 'active']} ${(config.systemMode?.mode || 'active').toUpperCase()}\n` +
                        `**AI Detection:** ${config.aiSettings?.enabled !== false ? `${getEmoji('tick')} ON` : `${getEmoji('cross')} OFF`}\n` +
                        `**AI Sensitivity:** ${config.aiSettings?.sensitivity || 'medium'}\n` +
                        `**Threat System:** ${config.threatSystem?.enabled !== false ? `${getEmoji('tick')} ON` : `${getEmoji('cross')} OFF`}\n` +
                        `**Anti-Evasion:** ${config.antiEvasion?.enabled !== false ? `${getEmoji('tick')} ON` : `${getEmoji('cross')} OFF`}`
                    )
                );
                components.push(systemContainer);
                components.push(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large));
                
                const modulesContainer = new ContainerBuilder().setAccentColor(0x9b59b6);
                modulesContainer.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## ${getEmoji('security')} **Module Status**\n\n` +
                        `**${getEmoji('mute')} Anti-Spam:** ${config.antiSpam?.enabled !== false ? `${getEmoji('tick')} ON` : `${getEmoji('cross')} OFF`}\n` +
                        `└ Limit: ${config.antiSpam?.messageLimit || 5} msgs / ${(config.antiSpam?.timeWindow || 5000) / 1000}s\n\n` +
                        `**${getEmoji('world')} Anti-Link:** ${config.antiLink?.enabled !== false ? `${getEmoji('tick')} ON` : `${getEmoji('cross')} OFF`}\n` +
                        `└ Mode: ${config.antiLink?.mode || 'moderate'}\n\n` +
                        `**${getEmoji('cross')} Anti-Raid:** ${config.antiRaid?.enabled !== false ? `${getEmoji('tick')} ON` : `${getEmoji('cross')} OFF`}\n` +
                        `└ Limit: ${config.antiRaid?.joinLimit || 5} joins / ${(config.antiRaid?.timeWindow || 60000) / 1000}s\n\n` +
                        `**${getEmoji('fire')} Anti-Nuke:** ${config.antiNuke?.enabled !== false ? `${getEmoji('tick')} ON` : `${getEmoji('cross')} OFF`}\n` +
                        `└ Channel Delete Limit: ${config.antiNuke?.limits?.channelDelete || 1}`
                    )
                );
                components.push(modulesContainer);
                components.push(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large));
                
                const loggingContainer = new ContainerBuilder().setAccentColor(0xf39c12);
                loggingContainer.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## ${getEmoji('document')} **Logging**\n\n` +
                        `**Log Channel:** ${config.logging?.logChannelId || config.logChannelId ? `<#${config.logging?.logChannelId || config.logChannelId}>` : `${getEmoji('cross')} Not Set`}\n` +
                        `**Alert Channel:** ${config.logging?.alertChannelId || config.alertChannelId ? `<#${config.logging?.alertChannelId || config.alertChannelId}>` : `${getEmoji('cross')} Not Set`}\n` +
                        `**Staff Channel:** ${config.logging?.staffChannelId ? `<#${config.logging.staffChannelId}>` : `${getEmoji('cross')} Not Set`}\n` +
                        `**Log Level:** ${config.logging?.logLevel || 'normal'}`
                    )
                );
                components.push(loggingContainer);
                components.push(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large));
                
                const whitelistContainer = new ContainerBuilder().setAccentColor(0x2ecc71);
                whitelistContainer.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## ${getEmoji('tick')} **Whitelist**\n\n` +
                        `**Whitelisted Members:** ${config.whitelist?.customMembers?.length || 0}\n` +
                        `**Whitelisted Roles:** ${config.whitelist?.customRoles?.length || 0}\n` +
                        `**Whitelisted Channels:** ${config.whitelist?.customChannels?.length || 0}\n` +
                        `**Bypass Admins:** ${config.whitelist?.bypassAdmins !== false ? `${getEmoji('tick')} Yes` : `${getEmoji('cross')} No`}\n` +
                        `**Bypass Moderators:** ${config.whitelist?.bypassModerators ? `${getEmoji('tick')} Yes` : `${getEmoji('cross')} No`}`
                    )
                );
                components.push(whitelistContainer);
                
                return interaction.editReply({ components, flags: MessageFlags.IsComponentsV2 });
            }

            if (subcommand === 'mode') {
                const mode = interaction.options.getString('mode');
                const notifySimulations = interaction.options.getBoolean('notify-simulations');
                
                config.systemMode = config.systemMode || {};
                config.systemMode.mode = mode;
                if (notifySimulations !== null) config.systemMode.notifyOnSimulation = notifySimulations;
                
                await config.save();
                invalidateAntiConfig(guildId);
                
                const components = [];
                const modeContainer = new ContainerBuilder().setAccentColor(mode === 'active' ? 0x00ff00 : mode === 'dry-run' ? 0xffff00 : 0x3498db);
                modeContainer.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `# ${getEmoji('settings')} System Mode Updated\n\n` +
                        `**New Mode:** ${mode === 'active' ? `${getEmoji('tick')} ACTIVE` : mode === 'dry-run' ? `${getEmoji('time')} DRY-RUN` : `${getEmoji('list')} LOG-ONLY`}\n\n` +
                        `**What this means:**\n` +
                        `${mode === 'active' ? '• Violations are detected AND punished\n• Full protection is enabled' : 
                           mode === 'dry-run' ? '• Violations are detected but NOT punished\n• Actions are simulated and logged\n• Perfect for testing configuration' :
                           '• Violations are only logged\n• No actions taken\n• Use for passive monitoring'}\n\n` +
                        `${notifySimulations !== null ? `**Notify on Simulations:** ${notifySimulations ? `${getEmoji('tick')} Yes` : `${getEmoji('cross')} No`}` : ''}`
                    )
                );
                components.push(modeContainer);
                
                return interaction.editReply({ components, flags: MessageFlags.IsComponentsV2 });
            }

            if (subcommand === 'logging') {
                const logChannel = interaction.options.getChannel('log-channel');
                const alertChannel = interaction.options.getChannel('alert-channel');
                const staffChannel = interaction.options.getChannel('staff-channel');
                const level = interaction.options.getString('level');
                const includeContent = interaction.options.getBoolean('include-content');
                
                config.logging = config.logging || {};
                if (logChannel) {
                    config.logging.logChannelId = logChannel.id;
                    config.logChannelId = logChannel.id;
                }
                if (alertChannel) {
                    config.logging.alertChannelId = alertChannel.id;
                    config.alertChannelId = alertChannel.id;
                }
                if (staffChannel) config.logging.staffChannelId = staffChannel.id;
                if (level) config.logging.logLevel = level;
                if (includeContent !== null) config.logging.includeMessageContent = includeContent;
                
                await config.save();
                invalidateAntiConfig(guildId);
                
                return this.sendSuccess(interaction, 'Logging Settings Updated', 
                    `**Log Channel:** ${config.logging.logChannelId ? `<#${config.logging.logChannelId}>` : 'Not Set'}\n` +
                    `**Alert Channel:** ${config.logging.alertChannelId ? `<#${config.logging.alertChannelId}>` : 'Not Set'}\n` +
                    `**Staff Channel:** ${config.logging.staffChannelId ? `<#${config.logging.staffChannelId}>` : 'Not Set'}\n` +
                    `**Log Level:** ${config.logging.logLevel || 'normal'}\n` +
                    `**Include Content:** ${config.logging.includeMessageContent !== false ? `${getEmoji('tick')} Yes` : `${getEmoji('cross')} No`}`
                );
            }

            if (subcommand === 'ai') {
                const enabled = interaction.options.getBoolean('enabled');
                const sensitivity = interaction.options.getString('sensitivity');
                const threshold = interaction.options.getNumber('threshold');
                const useForSpam = interaction.options.getBoolean('use-for-spam');
                const useForLinks = interaction.options.getBoolean('use-for-links');
                
                config.aiSettings = config.aiSettings || {};
                if (enabled !== null) {
                    config.aiSettings.enabled = enabled;
                    config.aiEnabled = enabled;
                }
                if (sensitivity) {
                    config.aiSettings.sensitivity = sensitivity;
                    config.aiSensitivity = sensitivity;
                }
                if (threshold !== null) {
                    config.aiSettings.confidenceThreshold = threshold;
                    config.aiConfidenceThreshold = threshold;
                }
                if (useForSpam !== null) config.aiSettings.useForSpam = useForSpam;
                if (useForLinks !== null) config.aiSettings.useForLinks = useForLinks;
                
                await config.save();
                invalidateAntiConfig(guildId);
                
                return this.sendSuccess(interaction, 'AI Settings Updated',
                    `**AI Detection:** ${config.aiSettings.enabled !== false ? `${getEmoji('tick')} Enabled` : `${getEmoji('cross')} Disabled`}\n` +
                    `**Sensitivity:** ${config.aiSettings.sensitivity || 'medium'}\n` +
                    `**Confidence Threshold:** ${config.aiSettings.confidenceThreshold || 0.7}\n` +
                    `**Use for Spam:** ${config.aiSettings.useForSpam !== false ? `${getEmoji('tick')} Yes` : `${getEmoji('cross')} No`}\n` +
                    `**Use for Links:** ${config.aiSettings.useForLinks !== false ? `${getEmoji('tick')} Yes` : `${getEmoji('cross')} No`}\n\n` +
                    `${getEmoji('help')} **Tip:** Higher sensitivity = more detections but more false positives`
                );
            }

            if (subcommand === 'spam') {
                const enabled = interaction.options.getBoolean('enabled');
                const messageLimit = interaction.options.getInteger('message-limit');
                const timeWindow = interaction.options.getInteger('time-window');
                const mentionLimit = interaction.options.getInteger('mention-limit');
                const emojiLimit = interaction.options.getInteger('emoji-limit');
                const duplicateThreshold = interaction.options.getInteger('duplicate-threshold');
                
                config.antiSpam = config.antiSpam || {};
                if (enabled !== null) config.antiSpam.enabled = enabled;
                if (messageLimit !== null) config.antiSpam.messageLimit = messageLimit;
                if (timeWindow !== null) config.antiSpam.timeWindow = timeWindow * 1000;
                if (mentionLimit !== null) config.antiSpam.mentionLimit = mentionLimit;
                if (emojiLimit !== null) config.antiSpam.emojiLimit = emojiLimit;
                if (duplicateThreshold !== null) config.antiSpam.duplicateThreshold = duplicateThreshold;
                
                await config.save();
                invalidateAntiConfig(guildId);
                
                return this.sendSuccess(interaction, `${getEmoji('mute')} Anti-Spam Updated`,
                    `**Status:** ${config.antiSpam.enabled !== false ? `${getEmoji('tick')} Enabled` : `${getEmoji('cross')} Disabled`}\n` +
                    `**Message Limit:** ${config.antiSpam.messageLimit || 5} messages\n` +
                    `**Time Window:** ${(config.antiSpam.timeWindow || 5000) / 1000} seconds\n` +
                    `**Mention Limit:** ${config.antiSpam.mentionLimit || 5} mentions\n` +
                    `**Emoji Limit:** ${config.antiSpam.emojiLimit || 10} emojis\n` +
                    `**Duplicate Threshold:** ${config.antiSpam.duplicateThreshold || 3} similar messages\n\n` +
                    `${getEmoji('help')} **How it works:** If a user sends ${config.antiSpam.messageLimit || 5}+ messages in ${(config.antiSpam.timeWindow || 5000) / 1000}s, they get flagged.`
                );
            }

            if (subcommand === 'spam-advanced') {
                const capsEnabled = interaction.options.getBoolean('caps-enabled');
                const capsPercentage = interaction.options.getInteger('caps-percentage');
                const attachmentSpam = interaction.options.getBoolean('attachment-spam');
                const newlineSpam = interaction.options.getBoolean('newline-spam');
                const maxNewlines = interaction.options.getInteger('max-newlines');
                
                config.antiSpam = config.antiSpam || {};
                config.antiSpam.capsDetection = config.antiSpam.capsDetection || {};
                config.antiSpam.attachmentSpam = config.antiSpam.attachmentSpam || {};
                config.antiSpam.newlineSpam = config.antiSpam.newlineSpam || {};
                
                if (capsEnabled !== null) config.antiSpam.capsDetection.enabled = capsEnabled;
                if (capsPercentage !== null) config.antiSpam.capsDetection.percentage = capsPercentage;
                if (attachmentSpam !== null) config.antiSpam.attachmentSpam.enabled = attachmentSpam;
                if (newlineSpam !== null) config.antiSpam.newlineSpam.enabled = newlineSpam;
                if (maxNewlines !== null) config.antiSpam.newlineSpam.maxNewlines = maxNewlines;
                
                await config.save();
                invalidateAntiConfig(guildId);
                
                return this.sendSuccess(interaction, `${getEmoji('mute')} Advanced Spam Settings Updated`,
                    `**Caps Detection:** ${config.antiSpam.capsDetection.enabled !== false ? `${getEmoji('tick')} ON` : `${getEmoji('cross')} OFF`}\n` +
                    `└ Threshold: ${config.antiSpam.capsDetection.percentage || 70}% caps\n\n` +
                    `**Attachment Spam:** ${config.antiSpam.attachmentSpam.enabled !== false ? `${getEmoji('tick')} ON` : `${getEmoji('cross')} OFF`}\n\n` +
                    `**Newline Spam:** ${config.antiSpam.newlineSpam.enabled !== false ? `${getEmoji('tick')} ON` : `${getEmoji('cross')} OFF`}\n` +
                    `└ Max Newlines: ${config.antiSpam.newlineSpam.maxNewlines || 10}\n\n` +
                    `${getEmoji('help')} **Caps:** Messages with ${config.antiSpam.capsDetection.percentage || 70}%+ uppercase are flagged`
                );
            }

            if (subcommand === 'link') {
                const enabled = interaction.options.getBoolean('enabled');
                const mode = interaction.options.getString('mode');
                const shortenerProtection = interaction.options.getBoolean('shortener-protection');
                const ipProtection = interaction.options.getBoolean('ip-protection');
                const phishingProtection = interaction.options.getBoolean('phishing-protection');
                
                config.antiLink = config.antiLink || {};
                config.antiLink.phishingProtection = config.antiLink.phishingProtection || {};
                
                if (enabled !== null) config.antiLink.enabled = enabled;
                if (mode) config.antiLink.mode = mode;
                if (shortenerProtection !== null) config.antiLink.shortenerProtection = shortenerProtection;
                if (ipProtection !== null) config.antiLink.ipLinkProtection = ipProtection;
                if (phishingProtection !== null) config.antiLink.phishingProtection.enabled = phishingProtection;
                
                await config.save();
                invalidateAntiConfig(guildId);
                
                return this.sendSuccess(interaction, `${getEmoji('world')} Anti-Link Updated`,
                    `**Status:** ${config.antiLink.enabled !== false ? `${getEmoji('tick')} Enabled` : `${getEmoji('cross')} Disabled`}\n` +
                    `**Mode:** ${config.antiLink.mode || 'moderate'}\n` +
                    `**URL Shortener Block:** ${config.antiLink.shortenerProtection !== false ? `${getEmoji('tick')} ON` : `${getEmoji('cross')} OFF`}\n` +
                    `**IP Link Block:** ${config.antiLink.ipLinkProtection !== false ? `${getEmoji('tick')} ON` : `${getEmoji('cross')} OFF`}\n` +
                    `**Phishing Protection:** ${config.antiLink.phishingProtection.enabled !== false ? `${getEmoji('tick')} ON` : `${getEmoji('cross')} OFF`}\n\n` +
                    `${getEmoji('help')} **Modes:**\n` +
                    `• \`Strict\` = Block ALL links\n` +
                    `• \`Moderate\` = Block suspicious only\n` +
                    `• \`Custom\` = Use your domain lists`
                );
            }

            if (subcommand === 'link-invites') {
                const blockAll = interaction.options.getBoolean('block-all');
                const allowOwnServer = interaction.options.getBoolean('allow-own-server');
                const allowPartners = interaction.options.getBoolean('allow-partners');
                const blockVanity = interaction.options.getBoolean('block-vanity');
                
                config.antiLink = config.antiLink || {};
                config.antiLink.inviteHandling = config.antiLink.inviteHandling || {};
                
                if (blockAll !== null) config.antiLink.inviteHandling.blockAllInvites = blockAll;
                if (allowOwnServer !== null) config.antiLink.inviteHandling.allowOwnServerInvites = allowOwnServer;
                if (allowPartners !== null) config.antiLink.inviteHandling.allowPartnerInvites = allowPartners;
                if (blockVanity !== null) config.antiLink.inviteHandling.blockVanityUrls = blockVanity;
                
                await config.save();
                invalidateAntiConfig(guildId);
                
                return this.sendSuccess(interaction, `${getEmoji('world')} Invite Handling Updated`,
                    `**Block All Invites:** ${config.antiLink.inviteHandling.blockAllInvites ? `${getEmoji('tick')} Yes` : `${getEmoji('cross')} No`}\n` +
                    `**Allow Own Server:** ${config.antiLink.inviteHandling.allowOwnServerInvites !== false ? `${getEmoji('tick')} Yes` : `${getEmoji('cross')} No`}\n` +
                    `**Allow Partner Servers:** ${config.antiLink.inviteHandling.allowPartnerInvites !== false ? `${getEmoji('tick')} Yes` : `${getEmoji('cross')} No`}\n` +
                    `**Block Vanity URLs:** ${config.antiLink.inviteHandling.blockVanityUrls ? `${getEmoji('tick')} Yes` : `${getEmoji('cross')} No`}\n\n` +
                    `${getEmoji('help')} Use \`/manage-antimodules link-partners\` to add partner server IDs`
                );
            }

            if (subcommand === 'raid') {
                const enabled = interaction.options.getBoolean('enabled');
                const joinLimit = interaction.options.getInteger('join-limit');
                const timeWindow = interaction.options.getInteger('time-window');
                const accountAgeCheck = interaction.options.getBoolean('account-age-check');
                const minAccountAge = interaction.options.getInteger('min-account-age');
                const action = interaction.options.getString('action');
                
                config.antiRaid = config.antiRaid || {};
                if (enabled !== null) config.antiRaid.enabled = enabled;
                if (joinLimit !== null) config.antiRaid.joinLimit = joinLimit;
                if (timeWindow !== null) config.antiRaid.timeWindow = timeWindow * 1000;
                if (accountAgeCheck !== null) config.antiRaid.accountAgeCheck = accountAgeCheck;
                if (minAccountAge !== null) config.antiRaid.minAccountAge = minAccountAge * 24 * 60 * 60 * 1000;
                if (action) config.antiRaid.action = action;
                
                await config.save();
                invalidateAntiConfig(guildId);
                
                return this.sendSuccess(interaction, `${getEmoji('cross')} Anti-Raid Updated`,
                    `**Status:** ${config.antiRaid.enabled !== false ? `${getEmoji('tick')} Enabled` : `${getEmoji('cross')} Disabled`}\n` +
                    `**Join Limit:** ${config.antiRaid.joinLimit || 5} joins\n` +
                    `**Time Window:** ${(config.antiRaid.timeWindow || 60000) / 1000} seconds\n` +
                    `**Account Age Check:** ${config.antiRaid.accountAgeCheck !== false ? `${getEmoji('tick')} ON` : `${getEmoji('cross')} OFF`}\n` +
                    `**Min Account Age:** ${(config.antiRaid.minAccountAge || 604800000) / 86400000} days\n` +
                    `**Action:** ${config.antiRaid.action || 'quarantine'}\n\n` +
                    `${getEmoji('help')} **How it works:** If ${config.antiRaid.joinLimit || 5}+ users join in ${(config.antiRaid.timeWindow || 60000) / 1000}s, raid mode activates.`
                );
            }

            if (subcommand === 'raid-verification') {
                const enabled = interaction.options.getBoolean('enabled');
                const type = interaction.options.getString('type');
                const timeout = interaction.options.getInteger('timeout');
                const kickOnTimeout = interaction.options.getBoolean('kick-on-timeout');
                
                config.antiRaid = config.antiRaid || {};
                config.antiRaid.verificationMode = config.antiRaid.verificationMode || {};
                
                if (enabled !== null) config.antiRaid.verificationMode.enabled = enabled;
                if (type) config.antiRaid.verificationMode.type = type;
                if (timeout !== null) config.antiRaid.verificationMode.timeout = timeout * 60 * 1000;
                if (kickOnTimeout !== null) config.antiRaid.verificationMode.kickOnTimeout = kickOnTimeout;
                
                await config.save();
                invalidateAntiConfig(guildId);
                
                return this.sendSuccess(interaction, `${getEmoji('cross')} Raid Verification Updated`,
                    `**Status:** ${config.antiRaid.verificationMode.enabled !== false ? `${getEmoji('tick')} Enabled` : `${getEmoji('cross')} Disabled`}\n` +
                    `**Type:** ${config.antiRaid.verificationMode.type || 'button'}\n` +
                    `**Timeout:** ${(config.antiRaid.verificationMode.timeout || 300000) / 60000} minutes\n` +
                    `**Kick on Timeout:** ${config.antiRaid.verificationMode.kickOnTimeout !== false ? `${getEmoji('tick')} Yes` : `${getEmoji('cross')} No`}\n\n` +
                    `${getEmoji('help')} **Verification Types:**\n` +
                    `• \`Button\` = Click a button to verify\n` +
                    `• \`Reaction\` = React to verify\n` +
                    `• \`CAPTCHA\` = Solve a captcha`
                );
            }

            if (subcommand === 'nuke') {
                const enabled = interaction.options.getBoolean('enabled');
                const channelDeleteLimit = interaction.options.getInteger('channel-delete-limit');
                const roleDeleteLimit = interaction.options.getInteger('role-delete-limit');
                const banLimit = interaction.options.getInteger('ban-limit');
                const kickLimit = interaction.options.getInteger('kick-limit');
                const timeWindow = interaction.options.getInteger('time-window');
                const lockdownOnDetection = interaction.options.getBoolean('lockdown-on-detection');
                
                config.antiNuke = config.antiNuke || {};
                config.antiNuke.limits = config.antiNuke.limits || {};
                
                if (enabled !== null) config.antiNuke.enabled = enabled;
                if (channelDeleteLimit !== null) config.antiNuke.limits.channelDelete = channelDeleteLimit;
                if (roleDeleteLimit !== null) config.antiNuke.limits.roleDelete = roleDeleteLimit;
                if (banLimit !== null) config.antiNuke.limits.memberBan = banLimit;
                if (kickLimit !== null) config.antiNuke.limits.memberKick = kickLimit;
                if (timeWindow !== null) config.antiNuke.timeWindow = timeWindow * 1000;
                if (lockdownOnDetection !== null) config.antiNuke.lockdownOnDetection = lockdownOnDetection;
                
                await config.save();
                invalidateAntiConfig(guildId);
                
                return this.sendSuccess(interaction, `${getEmoji('fire')} Anti-Nuke Updated`,
                    `**Status:** ${config.antiNuke.enabled !== false ? `${getEmoji('tick')} Enabled` : `${getEmoji('cross')} Disabled`}\n` +
                    `**Channel Delete Limit:** ${config.antiNuke.limits.channelDelete || 1}\n` +
                    `**Role Delete Limit:** ${config.antiNuke.limits.roleDelete || 1}\n` +
                    `**Ban Limit:** ${config.antiNuke.limits.memberBan || 1}\n` +
                    `**Kick Limit:** ${config.antiNuke.limits.memberKick || 2}\n` +
                    `**Time Window:** ${(config.antiNuke.timeWindow || 10000) / 1000} seconds\n` +
                    `**Lockdown on Detection:** ${config.antiNuke.lockdownOnDetection !== false ? `${getEmoji('tick')} Yes` : `${getEmoji('cross')} No`}\n\n` +
                    `${getEmoji('help')} **Example:** If someone deletes ${config.antiNuke.limits.channelDelete || 1}+ channels in ${(config.antiNuke.timeWindow || 10000) / 1000}s, they get stopped.`
                );
            }

            if (subcommand === 'nuke-bots') {
                const enabled = interaction.options.getBoolean('enabled');
                const blockUnauthorized = interaction.options.getBoolean('block-unauthorized');
                const monitorBotActions = interaction.options.getBoolean('monitor-bot-actions');
                const addBot = interaction.options.getString('add-bot');
                const removeBot = interaction.options.getString('remove-bot');
                
                config.antiNuke = config.antiNuke || {};
                config.antiNuke.botProtection = config.antiNuke.botProtection || {};
                config.antiNuke.botProtection.allowedBots = config.antiNuke.botProtection.allowedBots || [];
                
                if (enabled !== null) config.antiNuke.botProtection.enabled = enabled;
                if (blockUnauthorized !== null) config.antiNuke.botProtection.blockUnauthorizedBots = blockUnauthorized;
                if (monitorBotActions !== null) config.antiNuke.botProtection.monitorBotActions = monitorBotActions;
                
                if (addBot) {
                    if (!config.antiNuke.botProtection.allowedBots.includes(addBot)) {
                        config.antiNuke.botProtection.allowedBots.push(addBot);
                    }
                }
                if (removeBot) {
                    config.antiNuke.botProtection.allowedBots = config.antiNuke.botProtection.allowedBots.filter(b => b !== removeBot);
                }
                
                await config.save();
                invalidateAntiConfig(guildId);
                
                return this.sendSuccess(interaction, `${getEmoji('fire')} Bot Protection Updated`,
                    `**Status:** ${config.antiNuke.botProtection.enabled !== false ? `${getEmoji('tick')} Enabled` : `${getEmoji('cross')} Disabled`}\n` +
                    `**Block Unauthorized Bots:** ${config.antiNuke.botProtection.blockUnauthorizedBots !== false ? `${getEmoji('tick')} Yes` : `${getEmoji('cross')} No`}\n` +
                    `**Monitor Bot Actions:** ${config.antiNuke.botProtection.monitorBotActions !== false ? `${getEmoji('tick')} Yes` : `${getEmoji('cross')} No`}\n` +
                    `**Authorized Bots:** ${config.antiNuke.botProtection.allowedBots.length}\n\n` +
                    `${addBot ? `${getEmoji('tick')} Added bot: ${addBot}\n` : ''}` +
                    `${removeBot ? `${getEmoji('cross')} Removed bot: ${removeBot}\n` : ''}` +
                    `\n${getEmoji('help')} When enabled, any bot added that isn't authorized will be kicked immediately.`
                );
            }

            if (subcommand === 'threat') {
                const enabled = interaction.options.getBoolean('enabled');
                const warnThreshold = interaction.options.getInteger('warn-threshold');
                const timeoutThreshold = interaction.options.getInteger('timeout-threshold');
                const quarantineThreshold = interaction.options.getInteger('quarantine-threshold');
                const banThreshold = interaction.options.getInteger('ban-threshold');
                const autoDecay = interaction.options.getBoolean('auto-decay');
                const decayRate = interaction.options.getInteger('decay-rate');
                
                config.threatSystem = config.threatSystem || {};
                config.threatSystem.autoActionThresholds = config.threatSystem.autoActionThresholds || {};
                config.threatSystem.decaySettings = config.threatSystem.decaySettings || {};
                
                if (enabled !== null) config.threatSystem.enabled = enabled;
                if (warnThreshold !== null) config.threatSystem.autoActionThresholds.warn = warnThreshold;
                if (timeoutThreshold !== null) config.threatSystem.autoActionThresholds.timeout = timeoutThreshold;
                if (quarantineThreshold !== null) config.threatSystem.autoActionThresholds.quarantine = quarantineThreshold;
                if (banThreshold !== null) config.threatSystem.autoActionThresholds.ban = banThreshold;
                if (autoDecay !== null) config.threatSystem.decaySettings.enabled = autoDecay;
                if (decayRate !== null) config.threatSystem.decaySettings.pointsPerHour = decayRate;
                
                await config.save();
                invalidateAntiConfig(guildId);
                
                return this.sendSuccess(interaction, 'Threat System Updated',
                    `**Status:** ${config.threatSystem.enabled !== false ? `${getEmoji('tick')} Enabled` : `${getEmoji('cross')} Disabled`}\n\n` +
                    `**Auto-Action Thresholds:**\n` +
                    `└ ${getEmoji('warning')} Warn at: ${config.threatSystem.autoActionThresholds.warn || 30} points\n` +
                    `└ ⏱️ Timeout at: ${config.threatSystem.autoActionThresholds.timeout || 50} points\n` +
                    `└ ${getEmoji('lock')} Quarantine at: ${config.threatSystem.autoActionThresholds.quarantine || 70} points\n` +
                    `└ ${getEmoji('hammer')} Ban at: ${config.threatSystem.autoActionThresholds.ban || 90} points\n\n` +
                    `**Score Decay:**\n` +
                    `└ Enabled: ${config.threatSystem.decaySettings.enabled !== false ? `${getEmoji('tick')} Yes` : `${getEmoji('cross')} No`}\n` +
                    `└ Rate: ${config.threatSystem.decaySettings.pointsPerHour || 2} points/hour\n\n` +
                    `${getEmoji('help')} Users accumulate points for violations. Points decay over time if they behave.`
                );
            }

            if (subcommand === 'evasion') {
                const enabled = interaction.options.getBoolean('enabled');
                const unicodeNormalize = interaction.options.getBoolean('unicode-normalize');
                const zeroWidthRemove = interaction.options.getBoolean('zero-width-remove');
                const homoglyphDetect = interaction.options.getBoolean('homoglyph-detect');
                const leetspeakDetect = interaction.options.getBoolean('leetspeak-detect');
                const urlDecode = interaction.options.getBoolean('url-decode');
                
                config.antiEvasion = config.antiEvasion || {};
                if (enabled !== null) config.antiEvasion.enabled = enabled;
                if (unicodeNormalize !== null) config.antiEvasion.normalizeUnicode = unicodeNormalize;
                if (zeroWidthRemove !== null) config.antiEvasion.removeZeroWidth = zeroWidthRemove;
                if (homoglyphDetect !== null) config.antiEvasion.detectHomoglyphs = homoglyphDetect;
                if (leetspeakDetect !== null) config.antiEvasion.detectLeetSpeak = leetspeakDetect;
                if (urlDecode !== null) config.antiEvasion.decodeUrls = urlDecode;
                
                await config.save();
                invalidateAntiConfig(guildId);
                
                return this.sendSuccess(interaction, 'Anti-Evasion Updated',
                    `**Status:** ${config.antiEvasion.enabled !== false ? `${getEmoji('tick')} Enabled` : `${getEmoji('cross')} Disabled`}\n\n` +
                    `**Detection Features:**\n` +
                    `└ Unicode Normalize: ${config.antiEvasion.normalizeUnicode !== false ? getEmoji('tick') : getEmoji('cross')}\n` +
                    `└ Zero-Width Remove: ${config.antiEvasion.removeZeroWidth !== false ? getEmoji('tick') : getEmoji('cross')}\n` +
                    `└ Homoglyph Detect: ${config.antiEvasion.detectHomoglyphs !== false ? getEmoji('tick') : getEmoji('cross')}\n` +
                    `└ Leetspeak Detect: ${config.antiEvasion.detectLeetSpeak !== false ? getEmoji('tick') : getEmoji('cross')}\n` +
                    `└ URL Decode: ${config.antiEvasion.decodeUrls !== false ? getEmoji('tick') : getEmoji('cross')}\n\n` +
                    `${getEmoji('help')} **What this catches:**\n` +
                    `• "dıscord.com" → discord.com (homoglyphs)\n` +
                    `• "f​u​c​k" → fuck (zero-width chars)\n` +
                    `• "5h1t" → shit (leetspeak)`
                );
            }

            if (subcommand === 'whitelist-member') {
                const user = interaction.options.getUser('user');
                const action = interaction.options.getString('action');
                
                config.whitelist = config.whitelist || {};
                config.whitelist.customMembers = config.whitelist.customMembers || [];
                
                if (action === 'add') {
                    if (!config.whitelist.customMembers.includes(user.id)) {
                        config.whitelist.customMembers.push(user.id);
                    }
                } else {
                    config.whitelist.customMembers = config.whitelist.customMembers.filter(id => id !== user.id);
                }
                
                await config.save();
                invalidateAntiConfig(guildId);
                
                return this.sendSuccess(interaction, `${getEmoji('tick')} Whitelist Updated`,
                    `**User:** ${user.tag}\n` +
                    `**Action:** ${action === 'add' ? '+ Added to whitelist' : '- Removed from whitelist'}\n` +
                    `**Total Whitelisted Members:** ${config.whitelist.customMembers.length}\n\n` +
                    `${getEmoji('help')} Whitelisted members bypass ALL anti-system checks.`
                );
            }

            if (subcommand === 'whitelist-role') {
                const role = interaction.options.getRole('role');
                const action = interaction.options.getString('action');
                
                config.whitelist = config.whitelist || {};
                config.whitelist.customRoles = config.whitelist.customRoles || [];
                
                if (action === 'add') {
                    if (!config.whitelist.customRoles.includes(role.id)) {
                        config.whitelist.customRoles.push(role.id);
                    }
                } else {
                    config.whitelist.customRoles = config.whitelist.customRoles.filter(id => id !== role.id);
                }
                
                await config.save();
                invalidateAntiConfig(guildId);
                
                return this.sendSuccess(interaction, `${getEmoji('tick')} Whitelist Updated`,
                    `**Role:** ${role.name}\n` +
                    `**Action:** ${action === 'add' ? '+ Added to whitelist' : '- Removed from whitelist'}\n` +
                    `**Total Whitelisted Roles:** ${config.whitelist.customRoles.length}\n\n` +
                    `${getEmoji('help')} All members with this role bypass anti-system checks.`
                );
            }

            if (subcommand === 'whitelist-channel') {
                const channel = interaction.options.getChannel('channel');
                const action = interaction.options.getString('action');
                const module = interaction.options.getString('module') || 'all';
                
                config.whitelist = config.whitelist || {};
                config.whitelist.customChannels = config.whitelist.customChannels || [];
                config.antiSpam = config.antiSpam || {};
                config.antiSpam.whitelistedChannels = config.antiSpam.whitelistedChannels || [];
                config.antiLink = config.antiLink || {};
                config.antiLink.whitelistedChannels = config.antiLink.whitelistedChannels || [];
                
                if (action === 'add') {
                    if (module === 'all' || module === 'spam') {
                        if (!config.antiSpam.whitelistedChannels.includes(channel.id)) {
                            config.antiSpam.whitelistedChannels.push(channel.id);
                        }
                    }
                    if (module === 'all' || module === 'link') {
                        if (!config.antiLink.whitelistedChannels.includes(channel.id)) {
                            config.antiLink.whitelistedChannels.push(channel.id);
                        }
                    }
                    if (module === 'all') {
                        if (!config.whitelist.customChannels.includes(channel.id)) {
                            config.whitelist.customChannels.push(channel.id);
                        }
                    }
                } else {
                    config.whitelist.customChannels = config.whitelist.customChannels.filter(id => id !== channel.id);
                    config.antiSpam.whitelistedChannels = config.antiSpam.whitelistedChannels.filter(id => id !== channel.id);
                    config.antiLink.whitelistedChannels = config.antiLink.whitelistedChannels.filter(id => id !== channel.id);
                }
                
                await config.save();
                invalidateAntiConfig(guildId);
                
                return this.sendSuccess(interaction, `${getEmoji('tick')} Channel Whitelist Updated`,
                    `**Channel:** ${channel.name}\n` +
                    `**Action:** ${action === 'add' ? '+ Added' : '- Removed'}\n` +
                    `**Applied to:** ${module === 'all' ? 'All modules' : module === 'spam' ? 'Anti-Spam only' : 'Anti-Link only'}\n\n` +
                    `${getEmoji('help')} Messages in whitelisted channels bypass configured module checks.`
                );
            }

            if (subcommand === 'punishment') {
                const module = interaction.options.getString('module');
                const defaultAction = interaction.options.getString('default-action');
                const maxWarnings = interaction.options.getInteger('max-warnings');
                const timeoutDuration = interaction.options.getInteger('timeout-duration');
                
                const moduleMap = {
                    'spam': 'antiSpam',
                    'link': 'antiLink',
                    'raid': 'antiRaid',
                    'nuke': 'antiNuke'
                };
                
                const configModule = moduleMap[module];
                config[configModule] = config[configModule] || {};
                config[configModule].punishment = config[configModule].punishment || {};
                
                if (defaultAction) config[configModule].punishment.defaultAction = defaultAction;
                if (maxWarnings !== null) config[configModule].punishment.maxWarnings = maxWarnings;
                if (timeoutDuration !== null) {
                    
                    config[configModule].punishment.actions = [
                        { threshold: 1, action: 'warn', duration: 0 },
                        { threshold: Math.ceil((maxWarnings || 3) / 2), action: 'timeout', duration: timeoutDuration * 60 * 1000 },
                        { threshold: maxWarnings || 3, action: defaultAction || 'quarantine', duration: 0 }
                    ];
                }
                
                await config.save();
                invalidateAntiConfig(guildId);
                
                const moduleNames = { 'spam': `${getEmoji('mute')} Anti-Spam`, 'link': `${getEmoji('world')} Anti-Link`, 'raid': `${getEmoji('cross')} Anti-Raid`, 'nuke': `${getEmoji('fire')} Anti-Nuke` };
                
                return this.sendSuccess(interaction, `${getEmoji('scales')} ${moduleNames[module]} Punishment Updated`,
                    `**Default Action:** ${defaultAction || 'warn'}\n` +
                    `**Max Warnings:** ${maxWarnings || 3}\n` +
                    `**Timeout Duration:** ${timeoutDuration ? `${timeoutDuration} minutes` : 'Default'}\n\n` +
                    `**Escalation Path:**\n` +
                    `1. First violation → Warning\n` +
                    `2. ${Math.ceil((maxWarnings || 3) / 2)} violations → Timeout\n` +
                    `3. ${maxWarnings || 3} violations → ${defaultAction || 'Quarantine'}\n\n` +
                    `${getEmoji('help')} Use \`/manage-antimodules punishment-advanced\` for custom escalation.`
                );
            }

            if (subcommand === 'reset') {
                const confirm = interaction.options.getBoolean('confirm');
                
                if (!confirm) {
                    return this.sendError(interaction, 'You must confirm the reset by setting confirm to true!');
                }
                
                await AntiConfig.findOneAndDelete({ guildId });
                invalidateAntiConfig(guildId);
                
                const components = [];
                const resetContainer = new ContainerBuilder().setAccentColor(0xff6600);
                resetContainer.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `# ${getEmoji('loop')} Anti-System Reset\n\n` +
                        `All anti-system settings have been reset to defaults.\n\n` +
                        `**What was reset:**\n` +
                        `• All module configurations\n` +
                        `• All whitelists and blacklists\n` +
                        `• All punishment settings\n` +
                        `• All threshold values\n` +
                        `• Log channel settings\n\n` +
                        `Use \`/setup-antimodules init\` to reconfigure.`
                    )
                );
                components.push(resetContainer);
                
                return interaction.editReply({ components, flags: MessageFlags.IsComponentsV2 });
            }
            
        } catch (error) {
            console.error('Setup-antimodules error:', error);
            return this.sendError(interaction, 'An error occurred. Please try again.');
        }
    },

    sendSuccess(interaction, title, description) {
        const container = cards.success(title, description);
        return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    },
    
    sendError(interaction, message) {
        const container = cards.error(undefined, message);
        return interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }
};
