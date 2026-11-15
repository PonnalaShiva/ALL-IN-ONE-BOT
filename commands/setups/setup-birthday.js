const {
    SlashCommandBuilder,
    ChannelType,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    RoleSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags
} = require('discord.js');

const GuildBirthdaySettings = require('../../models/birthday/setup');
const { invalidateBirthdaySettings } = require('../../utils/cacheHelpers');
const { runWithinAcknowledgementWindow } = require('../../utils/interactionRouter');
const { createBirthdayModalId, parseBirthdayModalId } = require('../../utils/birthdayDashboardSession');
const { getDashboardSessionOwnerId } = require('../../utils/dashboardModalSession');
const checkPermissions = require('../../utils/checkPermissions');
const lang = require('../../events/loadLanguage');
const { getEmoji, getButtonEmoji } = require('../../UI/emojis/emoji');
const { buildCard, cards, replyEphemeral, createSessionManager, btn
} = require('../../UI');


const sessionManager = createSessionManager({
    ttlMs: 15 * 60 * 1000,
    onExpire: async (session) => {
        try {
            const { client, channelId, messageId } = session;
            const channel = client.channels.cache.get(channelId) || await client.channels.fetch(channelId).catch(() => null);
            if (channel) {
                const message = await channel.messages.fetch(messageId).catch(() => null);
                if (message) {
                    const expiredCard = buildCard({
                        title: `${getEmoji('warning')} ${lang.setups.birthday.sessionExpiredTitle}`,
                        description: lang.setups.birthday.sessionExpiredDesc,
                        tone: 'danger'
                    });
                    await message.edit({ components: [expiredCard], flags: MessageFlags.IsComponentsV2 }).catch(() => { });
                    setTimeout(() => { message.delete().catch(() => {}); }, 3000);
                }
            }
        } catch (_) { }
    }
});
function validateTime(timeString) {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(timeString)) {
        return lang.setups.birthday.errTimeFormat;
    }
    return null;
}

function validateTimezone(tz) {
    try {
        Intl.DateTimeFormat(undefined, { timeZone: tz });
        return null;
    } catch (_) {
        return lang.setups.birthday.errTimezoneFormat;
    }
}

function validateMessageText(msg) {
    if (msg && msg.length > 500) {
        return lang.setups.birthday.errMsgLength;
    }
    const forbiddenPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /drop\s+table\s+/gi,
        /select\s+\*\s+from\s+/gi,
        /[`$|<>]/g
    ];
    if (msg && forbiddenPatterns.some(pattern => pattern.test(msg))) {
        return lang.setups.birthday.errForbiddenScript;
    }
    return null;
}


async function renderState(client, guild, state) {
    const guildId = guild.id;
    let settings = await GuildBirthdaySettings.findOne({ guildId });
    if (!settings) {
        settings = new GuildBirthdaySettings({ guildId });
        await settings.save();
    }

    let title = '';
    let sections = [];
    let rows = [];
    let tone = 'accent';

    if (state.mode === 'dashboard') {
        title = `${getEmoji('gift')} ${lang.setups.birthday.title}`;

        const channel = settings.settings.announcementChannelId
            ? `<#${settings.settings.announcementChannelId}>`
            : `${getEmoji('cross')} ${lang.setups.birthday.notSet}`;

        const role = settings.settings.mentionRole
            ? `<@&${settings.settings.mentionRole}>`
            : `${getEmoji('cross')} ${lang.setups.birthday.none}`;

        const customMessage = settings.settings.customMessage
            ? `"${settings.settings.customMessage}"`
            : lang.setups.birthday.defaultMessage;

        const dailyStatus = settings.settings.enableDailyAnnouncements ? `${getEmoji('tick')} ${lang.setups.birthday.enabled}` : `${getEmoji('cross')} ${lang.setups.birthday.disabled}`;
        const weeklyStatus = settings.settings.enableWeeklyReminders ? `${getEmoji('tick')} ${lang.setups.birthday.enabled}` : `${getEmoji('cross')} ${lang.setups.birthday.disabled}`;
        const monthlyStatus = settings.settings.enableMonthlyStats ? `${getEmoji('tick')} ${lang.setups.birthday.enabled}` : `${getEmoji('cross')} ${lang.setups.birthday.disabled}`;

        sections = [
            lang.setups.birthday.headerDesc,
            `### ${getEmoji('settings')} ${lang.setups.birthday.currentSettingsHeader}\n` +
            `${lang.setups.birthday.announcementChannelField.replace('{channel}', channel)}\n` +
            `${lang.setups.birthday.announcementTimeField.replace('{time}', settings.settings.announcementTime)}\n` +
            `${lang.setups.birthday.serverTimezoneField.replace('{timezone}', settings.settings.timezone)}\n` +
            `${lang.setups.birthday.mentionRoleField.replace('{role}', role)}\n` +
            `${lang.setups.birthday.dailyAnnouncementsField.replace('{status}', dailyStatus)}\n` +
            `${lang.setups.birthday.weeklyRemindersField.replace('{status}', weeklyStatus)}\n` +
            `${lang.setups.birthday.monthlyStatsField.replace('{status}', monthlyStatus)}`,
            `### ${getEmoji('document')} ${lang.setups.birthday.customMessageHeader}\n${customMessage}`
        ];

        
        const channelSelect = new ChannelSelectMenuBuilder()
            .setCustomId('setup-birthday_select_channel')
            .setPlaceholder(lang.setups.birthday.channelPlaceholder)
            .addChannelTypes(ChannelType.GuildText);

        
        const roleSelect = new RoleSelectMenuBuilder()
            .setCustomId('setup-birthday_select_role')
            .setPlaceholder(lang.setups.birthday.rolePlaceholder);

        
        const buttonRow = new ActionRowBuilder().addComponents(
            btn(lang.setups.birthday.btnTimeTimezone, 'setup-birthday_btn_time_timezone', 'settings', ButtonStyle.Primary),
            btn(lang.setups.birthday.btnCustomMessage, 'setup-birthday_btn_custom_message', 'document', ButtonStyle.Primary),
            btn(lang.setups.birthday.btnRemoveRole, 'setup-birthday_btn_remove_role', 'delete', ButtonStyle.Secondary, !settings.settings.mentionRole)
        );

        
        const featuresSelect = new StringSelectMenuBuilder()
            .setCustomId('setup-birthday_select_features')
            .setPlaceholder(lang.setups.birthday.featuresPlaceholder)
            .addOptions([
                {
                    label: lang.setups.birthday.optDaily,
                    value: 'daily',
                    description: lang.setups.birthday.currentlyStatus.replace('{status}', settings.settings.enableDailyAnnouncements ? lang.setups.birthday.enabled : lang.setups.birthday.disabled),
                    emoji: getButtonEmoji('calendar')
                },
                {
                    label: lang.setups.birthday.optWeekly,
                    value: 'weekly',
                    description: lang.setups.birthday.currentlyStatus.replace('{status}', settings.settings.enableWeeklyReminders ? lang.setups.birthday.enabled : lang.setups.birthday.disabled),
                    emoji: getButtonEmoji('document')
                },
                {
                    label: lang.setups.birthday.optMonthly,
                    value: 'monthly',
                    description: lang.setups.birthday.currentlyStatus.replace('{status}', settings.settings.enableMonthlyStats ? lang.setups.birthday.enabled : lang.setups.birthday.disabled),
                    emoji: getButtonEmoji('analytics')
                }
            ]);

        
        const controlRow = new ActionRowBuilder().addComponents(
            btn(lang.setups.birthday.btnHelp, 'setup-birthday_btn_help', 'help', ButtonStyle.Secondary),
            btn(lang.setups.birthday.btnReset, 'setup-birthday_btn_reset', 'loop', ButtonStyle.Danger),
            btn(lang.setups.birthday.btnClose, 'setup-birthday_btn_close', 'stop', ButtonStyle.Danger)
        );

        rows = [
            new ActionRowBuilder().addComponents(channelSelect),
            new ActionRowBuilder().addComponents(roleSelect),
            buttonRow,
            new ActionRowBuilder().addComponents(featuresSelect),
            controlRow
        ];
    }

    if (state.mode === 'help') {
        title = `${getEmoji('gift')} ${lang.setups.birthday.helpTitle}`;
        tone = 'primary';

        sections = [
            `### ${getEmoji('settings')} ${lang.setups.birthday.helpConfigHeader}\n${lang.setups.birthday.helpConfigSteps}`,
            `### ${getEmoji('chat')} ${lang.setups.birthday.helpFormatHeader}\n${lang.setups.birthday.helpFormatVars}`,
            `### ${getEmoji('lock')} ${lang.setups.birthday.helpSecurityHeader}\n${lang.setups.birthday.helpSecurityRules}`
        ];

        const controlRow = new ActionRowBuilder().addComponents(
            btn(lang.setups.birthday.btnBack, 'setup-birthday_btn_back', 'arrleft', ButtonStyle.Secondary),
            btn(lang.setups.birthday.btnClose, 'setup-birthday_btn_close', 'stop', ButtonStyle.Danger)
        );

        rows = [controlRow];
    }

    return [buildCard({ title, sections, rows, tone })];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-birthday')
        .setDescription('Configure birthday system for your server')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('show')
                .setDescription('Open the interactive birthday system dashboard'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('channel')
                .setDescription('Set the birthday announcement channel')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Channel for birthday announcements')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('toggle')
                .setDescription('Toggle birthday system features')
                .addStringOption(option =>
                    option.setName('feature')
                        .setDescription('Feature to toggle')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Daily Announcements', value: 'daily' },
                            { name: 'Weekly Reminders', value: 'weekly' },
                            { name: 'Monthly Statistics', value: 'monthly' }
                        ))
                .addBooleanOption(option =>
                    option.setName('enabled')
                        .setDescription('Enable or disable the feature')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('time')
                .setDescription('Set announcement time')
                .addStringOption(option =>
                    option.setName('time')
                        .setDescription('Time in HH:MM format (24-hour)')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('role')
                .setDescription('Set mention role for birthday announcements')
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('Role to mention in birthday announcements')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('message')
                .setDescription('Set custom birthday announcement message')
                .addStringOption(option =>
                    option.setName('message')
                        .setDescription('Custom message (use {user} for username, {age} for age)')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('timezone')
                .setDescription('Set server timezone')
                .addStringOption(option =>
                    option.setName('timezone')
                        .setDescription('Timezone (e.g., America/New_York, Europe/London)')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('View current birthday system configuration'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('reset')
                .setDescription('Reset birthday system to default settings'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Delete birthday system setup for this server')),

    async handleComponent(interaction) {
        if (!interaction.customId?.startsWith('setup-birthday_')) return false;

        const modalSession = interaction.isModalSubmit() ? parseBirthdayModalId(interaction.customId) : null;
        const messageId = interaction.isModalSubmit() ? modalSession?.messageId : interaction.message?.id;
        const clickerId = interaction.user.id;
        const client = interaction.client;
        const guild = interaction.guild;

        if (!guild) {
            return replyEphemeral(interaction, cards.error(lang.error, lang.setups.birthday.guildContextMissing));
        }
        if (!messageId) {
            return replyEphemeral(interaction, cards.warning(lang.warning, lang.setups.birthday.expiredNotice));
        }

        if (interaction.customId === 'setup-birthday_btn_close') {
            const session = sessionManager.get(messageId);
            const ownerId = getDashboardSessionOwnerId(session);
            if (session && clickerId !== ownerId) {
                const ownerMention = ownerId ? `<@${ownerId}>` : 'another user';
                return replyEphemeral(interaction, cards.warning(lang.warning, lang.setups.birthday.notYourDashboard.replace('<@{user}>', ownerMention).replace('{user}', ownerMention)));
            }

            try { await interaction.deferUpdate(); } catch { return true; }
            sessionManager.delete(messageId);

            const closed = buildCard({
                title: `${getEmoji('warning')} ${lang.setups.birthday.dashboardClosedTitle}`,
                sections: [lang.setups.birthday.dashboardClosedDesc, `${getEmoji('settings')} ${lang.setups.birthday.reopenNotice}`],
                tone: 'danger'
            });
            await interaction.message.edit({ components: [closed], flags: MessageFlags.IsComponentsV2 }).catch(() => { });
            setTimeout(() => {
                interaction.message.delete().catch(() => { });
            }, 3000);
            return true;
        }

        const session = sessionManager.get(messageId);
        if (!session) {
            if (interaction.isModalSubmit()) {
                return replyEphemeral(interaction, cards.warning(lang.warning, lang.setups.birthday.expiredNotice));
            }
            return replyEphemeral(interaction, cards.warning(lang.warning, lang.setups.birthday.timedOutNotice));
        }

        const ownerId = getDashboardSessionOwnerId(session);
        if (clickerId !== ownerId) {
            const ownerMention = ownerId ? `<@${ownerId}>` : 'another user';
            return replyEphemeral(interaction, cards.warning(lang.warning, lang.setups.birthday.notYourDashboard.replace('<@{user}>', ownerMention).replace('{user}', ownerMention)));
        }

        const customId = interaction.customId;
        const { state } = session;

        
        if (customId === 'setup-birthday_btn_time_timezone') {
            const lookup = await runWithinAcknowledgementWindow(
                interaction,
                () => GuildBirthdaySettings.findOne({ guildId: guild.id }),
                'Birthday settings are taking too long to load. Please try again shortly.'
            );
            if (!lookup.completed) return true;
            const settings = lookup.value || {};
            const currentSettings = settings.settings || {};

            const modal = new ModalBuilder()
                .setCustomId(createBirthdayModalId('time_timezone', messageId))
                .setTitle(lang.setups.birthday.modalTimeTitle);

            const timeInput = new TextInputBuilder()
                .setCustomId('announcement_time')
                .setLabel(lang.setups.birthday.lblTime)
                .setStyle(TextInputStyle.Short)
                .setValue(currentSettings.announcementTime || '09:00')
                .setPlaceholder(lang.setups.birthday.placeholderTime)
                .setRequired(true)
                .setMaxLength(5);

            const timezoneInput = new TextInputBuilder()
                .setCustomId('announcement_timezone')
                .setLabel(lang.setups.birthday.lblTimezone)
                .setStyle(TextInputStyle.Short)
                .setValue(currentSettings.timezone || 'UTC')
                .setPlaceholder(lang.setups.birthday.placeholderTimezone)
                .setRequired(true)
                .setMaxLength(50);

            modal.addComponents(
                new ActionRowBuilder().addComponents(timeInput),
                new ActionRowBuilder().addComponents(timezoneInput)
            );
            await interaction.showModal(modal);
            return true;
        }

        if (customId === 'setup-birthday_btn_custom_message') {
            const lookup = await runWithinAcknowledgementWindow(
                interaction,
                () => GuildBirthdaySettings.findOne({ guildId: guild.id }),
                'Birthday settings are taking too long to load. Please try again shortly.'
            );
            if (!lookup.completed) return true;
            const settings = lookup.value || {};
            const currentSettings = settings.settings || {};

            const modal = new ModalBuilder()
                .setCustomId(createBirthdayModalId('message', messageId))
                .setTitle(lang.setups.birthday.modalMsgTitle);

            const messageInput = new TextInputBuilder()
                .setCustomId('custom_message')
                .setLabel(lang.setups.birthday.lblMsg)
                .setStyle(TextInputStyle.Paragraph)
                .setValue(currentSettings.customMessage || '')
                .setPlaceholder(lang.setups.birthday.placeholderMsg)
                .setRequired(false)
                .setMaxLength(500);

            modal.addComponents(new ActionRowBuilder().addComponents(messageInput));
            await interaction.showModal(modal);
            return true;
        }

        
        if (interaction.isModalSubmit()) {
            try { await interaction.deferUpdate(); } catch { return true; }
            sessionManager.touch(messageId);

            if (modalSession?.type === 'time_timezone') {
                const timeStr = interaction.fields.getTextInputValue('announcement_time').trim();
                const tzStr = interaction.fields.getTextInputValue('announcement_timezone').trim();

                const timeErr = validateTime(timeStr);
                if (timeErr) {
                    await interaction.followUp({
                        components: [cards.error(lang.error, lang.setups.birthday.validationErrorPrefix.replace('{error}', timeErr))],
                        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
                    }).catch(() => { });
                    return true;
                }

                const tzErr = validateTimezone(tzStr);
                if (tzErr) {
                    await interaction.followUp({
                        components: [cards.error(lang.error, lang.setups.birthday.validationErrorPrefix.replace('{error}', tzErr))],
                        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
                    }).catch(() => { });
                    return true;
                }

                await GuildBirthdaySettings.findOneAndUpdate(
                    { guildId: guild.id },
                    { 
                        $set: { 
                            'settings.announcementTime': timeStr,
                            'settings.timezone': tzStr
                        },
                        $setOnInsert: { guildId: guild.id }
                    },
                    { upsert: true }
                );
                invalidateBirthdaySettings(guild.id);
            } else if (modalSession?.type === 'message') {
                const rawMsg = interaction.fields.getTextInputValue('custom_message');
                const msg = rawMsg ? rawMsg.trim() : null;

                const msgErr = validateMessageText(msg);
                if (msgErr) {
                    await interaction.followUp({
                        components: [cards.error(lang.error, lang.setups.birthday.validationErrorPrefix.replace('{error}', msgErr))],
                        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
                    }).catch(() => { });
                    return true;
                }

                await GuildBirthdaySettings.findOneAndUpdate(
                    { guildId: guild.id },
                    { 
                        $set: { 'settings.customMessage': msg },
                        $setOnInsert: { guildId: guild.id }
                    },
                    { upsert: true }
                );
                invalidateBirthdaySettings(guild.id);
            }

            try {
                const components = await renderState(client, guild, state);
                await interaction.message.edit({ components, flags: MessageFlags.IsComponentsV2 });
            } catch (err) {
                console.error('[SetupBirthday Modal Submit Error]:', err.message);
            }
            return true;
        }

        
        try { await interaction.deferUpdate(); } catch { return true; }
        sessionManager.touch(messageId);

        if (customId === 'setup-birthday_select_channel') {
            const channelId = interaction.values[0];
            const channel = interaction.guild.channels.cache.get(channelId);
            if (channel) {
                const permissions = channel.permissionsFor(interaction.guild.members.me);
                if (!permissions.has(['SendMessages', 'EmbedLinks', 'ViewChannel'])) {
                    await interaction.followUp({
                        components: [cards.error(lang.error, lang.setups.birthday.permissionErrorPrefix.replace('{error}', lang.setups.birthday.permissionDesc.replace('{channel}', `<#${channelId}>`)))],
                        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
                    }).catch(() => { });
                    return true;
                }

                await GuildBirthdaySettings.findOneAndUpdate(
                    { guildId: guild.id },
                    { 
                        $set: { 'settings.announcementChannelId': channelId },
                        $setOnInsert: { guildId: guild.id }
                    },
                    { upsert: true }
                );
                invalidateBirthdaySettings(guild.id);

                try {
                    const testCard = buildCard({
                        title: lang.setups.birthday.configuredTitle,
                        sections: [lang.setups.birthday.configuredDesc],
                        tone: 'success'
                    });
                    await channel.send({ components: [testCard], flags: MessageFlags.IsComponentsV2 });
                } catch (_) {}
            }
        } else if (customId === 'setup-birthday_select_role') {
            const roleId = interaction.values[0];
            await GuildBirthdaySettings.findOneAndUpdate(
                { guildId: guild.id },
                { 
                    $set: { 'settings.mentionRole': roleId },
                    $setOnInsert: { guildId: guild.id }
                },
                { upsert: true }
            );
            invalidateBirthdaySettings(guild.id);
        } else if (customId === 'setup-birthday_btn_remove_role') {
            await GuildBirthdaySettings.findOneAndUpdate(
                { guildId: guild.id },
                { 
                    $set: { 'settings.mentionRole': null },
                    $setOnInsert: { guildId: guild.id }
                },
                { upsert: true }
            );
            invalidateBirthdaySettings(guild.id);
        } else if (customId === 'setup-birthday_select_features') {
            const feature = interaction.values[0];
            const settings = await GuildBirthdaySettings.findOne({ guildId: guild.id }) || { settings: {} };
            const current = settings.settings || {};

            let updateField = '';
            let newValue = true;
            if (feature === 'daily') {
                updateField = 'settings.enableDailyAnnouncements';
                newValue = !current.enableDailyAnnouncements;
            } else if (feature === 'weekly') {
                updateField = 'settings.enableWeeklyReminders';
                newValue = !current.enableWeeklyReminders;
            } else if (feature === 'monthly') {
                updateField = 'settings.enableMonthlyStats';
                newValue = !current.enableMonthlyStats;
            }

            if (updateField) {
                await GuildBirthdaySettings.findOneAndUpdate(
                    { guildId: guild.id },
                    { 
                        $set: { [updateField]: newValue },
                        $setOnInsert: { guildId: guild.id }
                    },
                    { upsert: true }
                );
                invalidateBirthdaySettings(guild.id);
            }
        } else if (customId === 'setup-birthday_btn_help') {
            state.mode = 'help';
        } else if (customId === 'setup-birthday_btn_back') {
            state.mode = 'dashboard';
        } else if (customId === 'setup-birthday_btn_reset') {
            await GuildBirthdaySettings.findOneAndDelete({ guildId: guild.id });
            invalidateBirthdaySettings(guild.id);
        }

        try {
            const components = await renderState(client, guild, state);
            await interaction.message.edit({ components, flags: MessageFlags.IsComponentsV2 });
        } catch (err) {
            console.error('[SetupBirthday Component Interaction Error]:', err.message);
        }

        return true;
    },

    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return replyEphemeral(interaction, cards.error(lang.error, lang.setups.birthday.adminOnly));
        }

        const isSlash = Boolean(interaction.isChatInputCommand?.());
        try {
            if (isSlash && !interaction.deferred && !interaction.replied) {
                await interaction.deferReply();
            }
        } catch (err) {
            console.error('[SetupBirthday] deferReply failed:', err.message);
            return;
        }

        if (!await checkPermissions(interaction)) return;

        const subcommand = isSlash ? (interaction.options.getSubcommand(false) || 'show') : 'show';
        const guildId = interaction.guild.id;
        const client = interaction.client;

        try {
            if (subcommand === 'show' || subcommand === 'status') {
                let state = {
                    mode: 'dashboard',
                    userId: isSlash ? interaction.user.id : interaction.author.id,
                    interaction
                };

                const components = await renderState(client, interaction.guild, state);
                const payload = { components, flags: MessageFlags.IsComponentsV2 };

                const message = (interaction.deferred || interaction.replied)
                    ? await interaction.editReply(payload)
                    : await interaction.reply({ ...payload, fetchReply: true });

                if (message) {
                    sessionManager.set(message.id, {
                        client,
                        channelId: interaction.channelId,
                        messageId: message.id,
                        userId: state.userId,
                        state
                    });
                }
                return;
            }

            
            switch (subcommand) {
                case 'channel':
                    await this.handleChannelSetup(interaction, guildId);
                    break;
                case 'toggle':
                    await this.handleFeatureToggle(interaction, guildId);
                    break;
                case 'time':
                    await this.handleTimeSetup(interaction, guildId);
                    break;
                case 'role':
                    await this.handleRoleSetup(interaction, guildId);
                    break;
                case 'message':
                    await this.handleMessageSetup(interaction, guildId);
                    break;
                case 'timezone':
                    await this.handleTimezoneSetup(interaction, guildId);
                    break;
                case 'reset':
                    await this.handleReset(interaction, guildId);
                    break;
                case 'delete':
                    await this.handleDelete(interaction, guildId);
                    break;
            }
        } catch (error) {
            console.error('[Setup-Birthday] Error:', error);
            const errCard = cards.error(lang.error, lang.setups.birthday.setupError);
            const errPayload = { components: [errCard], flags: MessageFlags.IsComponentsV2 };
            if (isSlash) {
                await interaction.editReply(errPayload).catch(() => { });
            } else {
                await interaction.reply(errPayload).catch(() => { });
            }
        }
    },

    async handleChannelSetup(interaction, guildId) {
        const channel = interaction.options.getChannel('channel');
        
        const permissions = channel.permissionsFor(interaction.guild.members.me);
        if (!permissions.has(['SendMessages', 'EmbedLinks', 'ViewChannel'])) {
            return interaction.editReply({
                components: [cards.error(lang.error, lang.setups.birthday.permissionDesc.replace('{channel}', `${channel}`))],
                flags: MessageFlags.IsComponentsV2
            });
        }

        await GuildBirthdaySettings.findOneAndUpdate(
            { guildId },
            { 
                $set: { 'settings.announcementChannelId': channel.id },
                $setOnInsert: { guildId }
            },
            { upsert: true }
        );

        invalidateBirthdaySettings(guildId);

        const card = cards.success(lang.success, lang.setups.birthday.channelSetDesc.replace('{channel}', `${channel}`));
        await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });

        try {
            const testCard = buildCard({
                title: lang.setups.birthday.configuredTitle,
                sections: [lang.setups.birthday.configuredDesc],
                tone: 'success'
            });
            await channel.send({ components: [testCard], flags: MessageFlags.IsComponentsV2 });
        } catch (error) {
            console.error('[Setup-Birthday] Error sending test message:', error);
        }
    },

    async handleFeatureToggle(interaction, guildId) {
        const feature = interaction.options.getString('feature');
        const enabled = interaction.options.getBoolean('enabled');

        const updatePath = {
            'daily': 'settings.enableDailyAnnouncements',
            'weekly': 'settings.enableWeeklyReminders',
            'monthly': 'settings.enableMonthlyStats'
        };

        await GuildBirthdaySettings.findOneAndUpdate(
            { guildId },
            { 
                $set: { [updatePath[feature]]: enabled },
                $setOnInsert: { guildId }
            },
            { upsert: true }
        );

        invalidateBirthdaySettings(guildId);

        const featureNames = {
            'daily': lang.setups.birthday.optDaily,
            'weekly': lang.setups.birthday.optWeekly,
            'monthly': lang.setups.birthday.optMonthly
        };

        const statusText = enabled ? lang.setups.birthday.enabled : lang.setups.birthday.disabled;
        const titleText = lang.setups.birthday.featureUpdatedTitle.replace('{status}', statusText).replace('{name}', featureNames[feature]);
        const descText = lang.setups.birthday.featureUpdatedDesc.replace('{name}', featureNames[feature]).replace('{status}', statusText);

        const card = buildCard({
            title: titleText,
            sections: [descText],
            tone: enabled ? 'success' : 'warning'
        });

        await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
    },

    async handleTimeSetup(interaction, guildId) {
        const timeString = interaction.options.getString('time');
        
        const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(timeString)) {
            return interaction.editReply({
                components: [cards.error(lang.error, lang.setups.birthday.errTimeFormat)],
                flags: MessageFlags.IsComponentsV2
            });
        }

        await GuildBirthdaySettings.findOneAndUpdate(
            { guildId },
            { 
                $set: { 'settings.announcementTime': timeString },
                $setOnInsert: { guildId }
            },
            { upsert: true }
        );

        invalidateBirthdaySettings(guildId);

        const card = buildCard({
            title: lang.setups.birthday.timeUpdatedTitle,
            sections: [lang.setups.birthday.timeUpdatedDesc.replace('{time}', timeString)],
            tone: 'success'
        });

        await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
    },

    async handleRoleSetup(interaction, guildId) {
        const role = interaction.options.getRole('role');

        await GuildBirthdaySettings.findOneAndUpdate(
            { guildId },
            { 
                $set: { 'settings.mentionRole': role?.id || null },
                $setOnInsert: { guildId }
            },
            { upsert: true }
        );

        invalidateBirthdaySettings(guildId);

        const card = buildCard({
            title: lang.setups.birthday.roleUpdatedTitle,
            sections: [role ? lang.setups.birthday.roleUpdatedDesc.replace('{role}', `${role}`) : lang.setups.birthday.roleRemovedDesc],
            tone: 'success'
        });

        await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
    },

    async handleMessageSetup(interaction, guildId) {
        const customMessage = interaction.options.getString('message');

        if (customMessage.length > 500) {
            return interaction.editReply({
                components: [cards.error(lang.error, lang.setups.birthday.errMsgLength)],
                flags: MessageFlags.IsComponentsV2
            });
        }

        await GuildBirthdaySettings.findOneAndUpdate(
            { guildId },
            { 
                $set: { 'settings.customMessage': customMessage },
                $setOnInsert: { guildId }
            },
            { upsert: true }
        );

        invalidateBirthdaySettings(guildId);

        const card = buildCard({
            title: lang.setups.birthday.msgSetTitle,
            sections: [
                lang.setups.birthday.msgSetSuccess,
                lang.setups.birthday.msgPreview.replace('{msg}', customMessage),
                lang.setups.birthday.msgVariables
            ],
            tone: 'success'
        });

        await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
    },

    async handleTimezoneSetup(interaction, guildId) {
        const timezone = interaction.options.getString('timezone');

        const timezoneRegex = /^[A-Za-z]+\/[A-Za-z_]+$/;
        if (!timezoneRegex.test(timezone)) {
            return interaction.editReply({
                components: [cards.error(lang.error, lang.setups.birthday.errTimezoneFormat)],
                flags: MessageFlags.IsComponentsV2
            });
        }

        await GuildBirthdaySettings.findOneAndUpdate(
            { guildId },
            { 
                $set: { 'settings.timezone': timezone },
                $setOnInsert: { guildId }
            },
            { upsert: true }
        );

        invalidateBirthdaySettings(guildId);

        const card = buildCard({
            title: lang.setups.birthday.timezoneUpdatedTitle,
            sections: [lang.setups.birthday.timezoneUpdatedDesc.replace('{timezone}', timezone)],
            tone: 'success'
        });

        await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
    },

    async handleReset(interaction, guildId) {
        await GuildBirthdaySettings.findOneAndDelete({ guildId });

        invalidateBirthdaySettings(guildId);

        const card = buildCard({
            title: lang.setups.birthday.resetTitle,
            sections: [
                lang.setups.birthday.resetDesc,
                lang.setups.birthday.resetNextSteps
            ],
            tone: 'warning'
        });

        await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
    },

    async handleDelete(interaction, guildId) {
        const settings = await GuildBirthdaySettings.findOne({ guildId });
        if (!settings) {
            return interaction.editReply({
                components: [cards.warning(lang.warning, lang.setups.birthday.notConfiguredDesc)],
                flags: MessageFlags.IsComponentsV2
            });
        }

        try {
            await GuildBirthdaySettings.findOneAndDelete({ guildId });

            invalidateBirthdaySettings(guildId);

            const card = buildCard({
                title: lang.setups.birthday.deletedTitle,
                sections: [
                    lang.setups.birthday.deletedDesc,
                    lang.setups.birthday.deletedNote
                ],
                tone: 'success'
            });

            await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 });
        } catch (error) {
            console.error('[Setup-Birthday] Error deleting setup:', error);
            await interaction.editReply({
                components: [cards.error(lang.error, lang.setups.birthday.deleteErrorDesc)],
                flags: MessageFlags.IsComponentsV2
            });
        }
    }
};
