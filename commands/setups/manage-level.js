


const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    UserSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');
const levelingController = require('../../models/leveling/levelingController');
const checkPermissions = require('../../utils/checkPermissions');
const { createDashboardModalId, parseDashboardModalId, resolveDashboardMessage, getDashboardSessionOwnerId } = require('../../utils/dashboardModalSession');
const { runWithinAcknowledgementWindow } = require('../../utils/interactionRouter');
const { getEmoji, getButtonEmoji } = require('../../UI/emojis/emoji');
const loadLanguage = require('../../events/loadLanguage');
const { buildCard, cards, replyEphemeral, createSessionManager, btn, formatCommandLink, cacheCommandIds
} = require('../../UI');

const sessionManager = createSessionManager({
    ttlMs: 10 * 60 * 1000,
    onExpire: async (session, client) => {
        try {
            const lang = await loadLanguage(session.guildId);
            const l = lang.setups?.managelevel || {};
            const channel = client.channels.cache.get(session.channelId) || await client.channels.fetch(session.channelId).catch(() => null);
            if (channel) {
                const message = await channel.messages.fetch(session.messageId).catch(() => null);
                if (message) {
                    const expiredCard = cards.warning(
                        (l.sessionExpiredTitle || '{emoji} Session Expired').replace('{emoji}', getEmoji('warning')),
                        (l.sessionExpiredDesc || 'This management panel has timed out due to inactivity. Run {command} to open a new dashboard.').replace('{command}', formatCommandLink('manage-level', 'panel'))
                    );
                    await message.edit({ components: [expiredCard], flags: MessageFlags.IsComponentsV2 }).catch(() => { });
                    setTimeout(() => { message.delete().catch(() => {}); }, 3000);
                }
            }
        } catch (_) { }
    }
});

async function resolveUser(guild, input) {
    if (!input) return null;
    const mentionMatch = input.match(/^<@!?(\d+)>$/);
    if (mentionMatch) {
        const userId = mentionMatch[1];
        return await guild.members.fetch(userId).then(m => m.user).catch(() => null);
    }
    if (/^\d+$/.test(input)) {
        return await guild.members.fetch(input).then(m => m.user).catch(() => null);
    }
    const username = input.toLowerCase();
    const foundMember = guild.members.cache.find(m => m.user.username.toLowerCase() === username || m.displayName?.toLowerCase() === username);
    if (foundMember) return foundMember.user;
    
    return null;
}


async function getOrInitializeUserStats(userId, guildId) {
    try {
        let rankData = await levelingController.getUserRank(userId, guildId);
        if (!rankData) {
            await levelingController.addUserXP(userId, guildId, 0);
            rankData = await levelingController.getUserRank(userId, guildId);
        }
        return rankData || {
            level: 1,
            xp: 0,
            totalXp: 0,
            rank: 1,
            messageCount: 0,
            voiceStats: { totalMinutes: 0 }
        };
    } catch (e) {
        return {
            level: 1,
            xp: 0,
            totalXp: 0,
            rank: 1,
            messageCount: 0,
            voiceStats: { totalMinutes: 0 }
        };
    }
}

async function editResponse(interaction, payload) {
    try {
        if (interaction.deferred || interaction.replied) {
            return await interaction.editReply(payload);
        }
        return await interaction.reply(payload);
    } catch {
        return null;
    }
}
function buildOverviewPanel(lang) {
    const l = lang.setups?.managelevel || {};
    const title = (l.overviewTitle || '{emoji} Level & XP Manager').replace('{emoji}', getEmoji('tools'));
    const sections = [
        l.overviewDesc || 'Select a member using the dropdown below to view stats and manage their leveling records.',
        l.overviewDetails || '• **Allowed Actions**: Add XP, Remove XP, Set Level, Reset Data.\n• **Permissions**: Requires Administrator / Level Manager role permissions.'
    ];
    const rows = [
        new ActionRowBuilder().addComponents(
            new UserSelectMenuBuilder()
                .setCustomId('manage-level_user_select')
                .setPlaceholder(l.userSelectPlaceholder || 'Select a member to manage levels')
        ),
        new ActionRowBuilder().addComponents(
            btn(l.btnCloseDashboard || 'Close Dashboard', 'manage-level_close', 'stop', ButtonStyle.Danger)
        )
    ];
    return buildCard(title, sections, rows, 0x5865F2);
}

async function buildTargetUserPanel(guildId, targetUser, resetType = 'all', lang) {
    const l = lang.setups?.managelevel || {};
    const rankData = await getOrInitializeUserStats(targetUser.id, guildId);

    const title = (l.targetPanelTitle || '{emoji} Managing Leveling Stats').replace('{emoji}', getEmoji('user'));
    const statsLine = (l.statsLine || '• **Current Level**: {level}\n• **Global Rank**: #{rank}\n• **Total Experience (XP)**: {xp} XP\n• **Message Count**: {messages}\n• **Voice Minutes**: {voice} mins')
        .replace('{level}', String(rankData.level))
        .replace('{rank}', String(rankData.rank))
        .replace('{xp}', rankData.totalXp.toLocaleString())
        .replace('{messages}', rankData.messageCount.toLocaleString())
        .replace('{voice}', (rankData.voiceStats?.totalMinutes || 0).toLocaleString());

    const sections = [
        `### **${targetUser.displayName || targetUser.username}**\nUser ID: \`${targetUser.id}\``,
        `**${l.statsHeader || `${getEmoji('crown')} Leveling Statistics`}**\n${statsLine}`,
        `### ${getEmoji('settings')} **${l.chooseActionHeader || 'Choose Level Action'}**`
    ];

    const rows = [
        new ActionRowBuilder().addComponents(
            btn(l.btnAddXp || 'Add XP', 'manage-level_btn_add_xp', 'sparkles', ButtonStyle.Primary),
            btn(l.btnRemoveXp || 'Remove XP', 'manage-level_btn_remove_xp', 'warning', ButtonStyle.Secondary),
            btn(l.btnSetLevel || 'Set Level', 'manage-level_btn_set_level', 'crown', ButtonStyle.Secondary)
        ),
        new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('manage-level_select_reset_type')
                .setPlaceholder(l.resetPlaceholder || 'Select stats reset type')
                .addOptions([
                    { label: l.resetAllLabel || 'Everything - Complete Reset', description: l.resetAllDesc || 'Deletes all leveling logs & stats', value: 'all', emoji: getButtonEmoji('delete'), default: resetType === 'all' },
                    { label: l.resetXpLabel || 'XP & Levels Only', description: l.resetXpDesc || 'Resets user back to Level 1 and 0 XP', value: 'xp', emoji: getButtonEmoji('database'), default: resetType === 'xp' },
                    { label: l.resetVoiceLabel || 'Voice Stats Only', description: l.resetVoiceDesc || 'Clears total voice chat session logs', value: 'voice', emoji: getButtonEmoji('mic'), default: resetType === 'voice' },
                    { label: l.resetWeeklyLabel || 'Weekly Stats Only', description: l.resetWeeklyDesc || 'Clears current weekly stats back to 0', value: 'weekly', emoji: getButtonEmoji('calendar'), default: resetType === 'weekly' }
                ])
        ),
        new ActionRowBuilder().addComponents(
            btn(l.btnResetLeveling || 'Reset Leveling', 'manage-level_btn_reset', 'warning', ButtonStyle.Danger),
            btn(l.btnSelectAnother || 'Select Another Member', 'manage-level_btn_back', 'back', ButtonStyle.Secondary),
            btn(l.btnClosePanel || 'Close Panel', 'manage-level_close', 'stop', ButtonStyle.Danger)
        )
    ];

    return buildCard(title, sections, rows, 0x3498db);
}


async function runAdminAction(interaction, subcommand, targetUser, amountOrLevel, reason, lang) {
    let result;
    let successMessage = '';
    const guildId = interaction.guild.id;
    const l = lang.setups?.managelevel || {};

    switch (subcommand) {
        case 'add-xp':
            result = await levelingController.addUserXP(targetUser.id, guildId, amountOrLevel);
            successMessage = (l.addedXpSuccess || 'Added **{amount} XP** to **{user}**')
                .replace('{amount}', amountOrLevel.toLocaleString())
                .replace('{user}', targetUser.username);
            break;
        case 'remove-xp':
            result = await levelingController.removeUserXP(targetUser.id, guildId, amountOrLevel);
            successMessage = (l.removedXpSuccess || 'Removed **{amount} XP** from **{user}**')
                .replace('{amount}', amountOrLevel.toLocaleString())
                .replace('{user}', targetUser.username);
            break;
        case 'set-level':
            result = await levelingController.setUserLevel(targetUser.id, guildId, amountOrLevel);
            successMessage = (l.setLevelSuccess || 'Set **{user}** to Level **{level}**')
                .replace('{user}', targetUser.username)
                .replace('{level}', String(amountOrLevel));
            break;
        case 'reset-user':
            result = await levelingController.resetUserData(targetUser.id, guildId, amountOrLevel);
            successMessage = (l.resetUserSuccess || 'Reset leveling stats (**type: {type}**) for **{user}**')
                .replace('{type}', String(amountOrLevel))
                .replace('{user}', targetUser.username);
            break;
    }

    if (!result && subcommand !== 'reset-user') {
        throw new Error('Action failed - target leveling document not found.');
    }

    const freshLevel = result?.level ?? 1;
    const freshTotalXp = result?.totalXp ?? 0;
    const freshMessages = result?.messageCount ?? 0;
    const freshVoice = result?.voiceStats?.totalMinutes ?? 0;

    const title = (l.modSuccessTitle || '{emoji} Admin Level Modification Completed').replace('{emoji}', getEmoji('tick'));
    const modDetails = (l.modDetails || '• **Modification**: {msg}\n• **Admin Officer**: <@{adminId}>\n• **Reason**: {reason}')
        .replace('{msg}', successMessage)
        .replace('{adminId}', interaction.user?.id || interaction.author?.id)
        .replace('{reason}', reason || (l.noReason || 'No reason provided'));

    const updatedStatsLine = (l.updatedStatsLine || '• **Level**: {level}\n• **Total XP**: {xp} XP\n• **Message Count**: {messages}\n• **Voice Minutes**: {voice} mins')
        .replace('{level}', String(freshLevel))
        .replace('{xp}', freshTotalXp.toLocaleString())
        .replace('{messages}', freshMessages.toLocaleString())
        .replace('{voice}', freshVoice.toLocaleString());

    const sections = [
        l.modSuccessDesc || '*Successfully updated target leveling logs.*',
        modDetails,
        `### ${getEmoji('analytics')} **${l.updatedStatsHeader || 'Updated Level Statistics'}**\n${updatedStatsLine}`
    ];

    return buildCard(title, sections, [], 0x00FF88);
}


async function renderState(client, guildId, state, lang) {
    const l = lang.setups?.managelevel || {};
    if (state.mode === 'overview' || !state.targetUserId) {
        return buildOverviewPanel(lang);
    } else {
        const targetUser = await client.users.fetch(state.targetUserId).catch(() => null);
        if (!targetUser) {
            const errTitle = (l.fetchErrorTitle || '{emoji} Fetch Error').replace('{emoji}', getEmoji('cross'));
            const errSections = [l.fetchErrorDesc || 'Selected member could not be fetched from Discord API.'];
            const errRows = [
                new ActionRowBuilder().addComponents(
                    btn(l.btnBackSelection || 'Back to Selection', 'manage-level_btn_back', 'back', ButtonStyle.Secondary)
                )
            ];
            return buildCard(errTitle, errSections, errRows, 0xFF0000);
        }
        return await buildTargetUserPanel(guildId, targetUser, state.resetType, lang);
    }
}


module.exports = {
    data: new SlashCommandBuilder()
        .setName('manage-level')
        .setDescription('Admin commands to manage user leveling metrics & experience records')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand.setName('panel')
                .setDescription('Open the leveling manager interactive setup dashboard'))
        .addSubcommand(subcommand =>
            subcommand.setName('add-xp')
                .setDescription('Add experience points (XP) to a member')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('Member to add XP to')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Amount of XP to add')
                        .setMinValue(1)
                        .setMaxValue(100000)
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for the modification')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand.setName('remove-xp')
                .setDescription('Deduct experience points (XP) from a member')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('Member to deduct XP from')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Amount of XP to remove')
                        .setMinValue(1)
                        .setMaxValue(100000)
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for the modification')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand.setName('set-level')
                .setDescription('Override user level value directly')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('Member to set level for')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('level')
                        .setDescription('Target level (1 to 1000)')
                        .setMinValue(1)
                        .setMaxValue(1000)
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for the modification')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand.setName('reset-user')
                .setDescription('Clear leveling databases logs for a user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('Member to wipe leveling stats for')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('type')
                        .setDescription('Stats category to clear')
                        .addChoices(
                            { name: 'Everything - Complete Reset', value: 'all' },
                            { name: 'XP & Levels Only', value: 'xp' },
                            { name: 'Voice Stats Only', value: 'voice' },
                            { name: 'Weekly Stats Only', value: 'weekly' }
                        )
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for the reset')
                        .setRequired(false))),

    async handleComponent(interaction) {
        if (!interaction.customId?.startsWith('manage-level_')) return false;
        if (!interaction.guild) return replyEphemeral(interaction, { content: 'This panel can only be used inside a server.' });

        const modalSession = interaction.isModalSubmit() ? parseDashboardModalId(interaction.customId) : null;
        const messageId = modalSession?.messageId || interaction.message?.id;
        if (!messageId) return replyEphemeral(interaction, { content: 'This dashboard session has expired. Please open a new panel.' });
        const clickerId = interaction.user.id;
        const client = interaction.client;
        const guildId = interaction.guild.id;

        const langLookup = await runWithinAcknowledgementWindow(
            interaction,
            () => loadLanguage(guildId),
            'Leveling settings are taking too long to load. Please try again shortly.'
        );
        if (!langLookup.completed) return true;
        const lang = langLookup.value;
        const l = lang.setups?.managelevel || {};

        
        if (interaction.customId === 'manage-level_close') {
            const session = sessionManager.get(messageId);
            const ownerId = getDashboardSessionOwnerId(session);
            if (session && clickerId !== ownerId) {
                const ownerMention = ownerId ? `<@${ownerId}>` : 'another user';
                const belongsMsg = (l.sessionBelongsTo || `${getEmoji('cross')} This panel belongs to {userId}. Run /manage-level to open your own dashboard!`)
                    .replace('<@{userId}>', ownerMention)
                    .replace('{userId}', ownerMention);
                return replyEphemeral(interaction, { content: belongsMsg });
            }

            try { await interaction.deferUpdate(); } catch { return true; }
            sessionManager.delete(messageId);

            const closedCard = cards.warning(
                (l.panelClosedTitle || '{emoji} Leveling Panel Closed').replace('{emoji}', getEmoji('warning')),
                l.panelClosedDesc || 'This dashboard has been closed by the administrator.'
            );
            await interaction.message.edit({ components: [closedCard], flags: MessageFlags.IsComponentsV2 }).catch(() => { });
            setTimeout(() => {
                interaction.message.delete().catch(() => {});
            }, 2000);
            return true;
        }

        
        const session = sessionManager.get(messageId);
        if (!session) {
            const expiredMsg = (l.sessionExpiredNotice || '{emoji} Session expired. Run `/manage-level panel` to spawn a new dashboard.').replace('{emoji}', getEmoji('warning'));
            return replyEphemeral(interaction, { content: expiredMsg });
        }

        
        const ownerId = getDashboardSessionOwnerId(session);
        if (clickerId !== ownerId) {
            const ownerMention = ownerId ? `<@${ownerId}>` : 'another user';
            const belongsMsg = (l.sessionBelongsTo || `${getEmoji('cross')} This panel belongs to {userId}. Run /manage-level to open your own dashboard!`)
                .replace('<@{userId}>', ownerMention)
                .replace('{userId}', ownerMention);
            return replyEphemeral(interaction, { content: belongsMsg });
        }

        const state = session.state;
        const customId = modalSession?.baseCustomId || interaction.customId;

        
        if (interaction.isModalSubmit()) {
            try {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            } catch {
                return true;
            }
            if (!await checkPermissions(interaction, 'admin')) return true;
            sessionManager.touch(messageId);
            const dashboardMessage = await resolveDashboardMessage(interaction, session, messageId);

            const targetUser = await client.users.fetch(state.targetUserId).catch(() => null);
            if (!targetUser) {
                const err = cards.error(
                    (l.fetchErrorTitle || '{emoji} Error').replace('{emoji}', getEmoji('cross')),
                    l.targetNotFound || 'Target member could not be fetched.'
                );
                if (dashboardMessage) await dashboardMessage.edit({ components: [err], flags: MessageFlags.IsComponentsV2 });
                await interaction.editReply({ content: l.targetNotFound || 'Target member could not be fetched.' });
                return true;
            }

            let subcommand = '';
            let amountOrLevel = 0;
            let reason = interaction.fields.getTextInputValue('reason') || (l.noReason || 'No reason provided');

            if (customId === 'manage-level_modal_add_xp') {
                subcommand = 'add-xp';
                amountOrLevel = parseInt(interaction.fields.getTextInputValue('amount'), 10);
                if (isNaN(amountOrLevel) || amountOrLevel <= 0 || amountOrLevel > 100000) {
                    return interaction.editReply({ content: l.invalidAmount || `${getEmoji('cross')} Invalid input: amount must be a number between 1 and 100,000.` });
                }
            } else if (customId === 'manage-level_modal_remove_xp') {
                subcommand = 'remove-xp';
                amountOrLevel = parseInt(interaction.fields.getTextInputValue('amount'), 10);
                if (isNaN(amountOrLevel) || amountOrLevel <= 0 || amountOrLevel > 100000) {
                    return interaction.editReply({ content: l.invalidAmount || `${getEmoji('cross')} Invalid input: amount must be a number between 1 and 100,000.` });
                }
            } else if (customId === 'manage-level_modal_set_level') {
                subcommand = 'set-level';
                amountOrLevel = parseInt(interaction.fields.getTextInputValue('level'), 10);
                if (isNaN(amountOrLevel) || amountOrLevel < 1 || amountOrLevel > 1000) {
                    return interaction.editReply({ content: l.invalidLevel || `${getEmoji('cross')} Invalid input: level must be a number between 1 and 1,000.` });
                }
            } else if (customId === 'manage-level_modal_reset') {
                subcommand = 'reset-user';
                amountOrLevel = state.resetType || 'all';
            }

            try {
                const resultCard = await runAdminAction(interaction, subcommand, targetUser, amountOrLevel, reason, lang);
                
                const navRow = new ActionRowBuilder().addComponents(
                    btn(l.btnManageAgain || 'Manage Member Again', 'manage-level_btn_remanage', 'back', ButtonStyle.Primary),
                    btn(l.btnSelectAnother || 'Select Another Member', 'manage-level_btn_back', 'users', ButtonStyle.Secondary),
                    btn(l.btnClosePanel || 'Close Panel', 'manage-level_close', 'stop', ButtonStyle.Danger)
                );
                resultCard.addActionRowComponents(navRow);

                if (dashboardMessage) await dashboardMessage.edit({ components: [resultCard], flags: MessageFlags.IsComponentsV2 });
                await interaction.editReply({ content: l.modSuccessDesc || 'Leveling changes applied.' });
            } catch (error) {
                console.error('[Manage Level Modal Submit Error]:', error);
                const errMsg = l.updateFailedGeneric || 'Failed to apply updates. Please try again.';
                const errCard = cards.error(
                    (l.fetchErrorTitle || '{emoji} Error').replace('{emoji}', getEmoji('cross')),
                    errMsg
                );
                if (dashboardMessage) await dashboardMessage.edit({ components: [errCard], flags: MessageFlags.IsComponentsV2 });
                await interaction.editReply({ content: errMsg }).catch(() => {});
            }
            return true;
        }

        
        try {
            if (interaction.customId === 'manage-level_btn_add_xp' || 
                interaction.customId === 'manage-level_btn_remove_xp' || 
                interaction.customId === 'manage-level_btn_set_level' || 
                interaction.customId === 'manage-level_btn_reset') {
                
            } else {
                await interaction.deferUpdate();
            }
        } catch {
            return true;
        }

        const opensModal = [
            'manage-level_btn_add_xp',
            'manage-level_btn_remove_xp',
            'manage-level_btn_set_level',
            'manage-level_btn_reset'
        ].includes(interaction.customId);
        if (!opensModal && !await checkPermissions(interaction, 'admin')) return true;

        sessionManager.touch(messageId);
        await cacheCommandIds(client, interaction).catch(() => { });

        
        if (customId === 'manage-level_user_select') {
            state.targetUserId = interaction.values[0];
            state.resetType = 'all';
            state.mode = 'target';
            const panel = await renderState(client, guildId, state, lang);
            await interaction.message.edit({ components: [panel], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
        }

        
        else if (customId === 'manage-level_select_reset_type') {
            state.resetType = interaction.values[0] || 'all';
            const panel = await renderState(client, guildId, state, lang);
            await interaction.message.edit({ components: [panel], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
        }

        
        else if (customId === 'manage-level_btn_back') {
            state.targetUserId = null;
            state.resetType = 'all';
            state.mode = 'overview';
            const panel = await renderState(client, guildId, state, lang);
            await interaction.message.edit({ components: [panel], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
        }

        
        else if (customId === 'manage-level_btn_remanage') {
            state.mode = 'target';
            const panel = await renderState(client, guildId, state, lang);
            await interaction.message.edit({ components: [panel], flags: MessageFlags.IsComponentsV2 }).catch(() => {});
        }

        
        else if (customId === 'manage-level_btn_add_xp') {
            const modal = new ModalBuilder()
                .setCustomId(createDashboardModalId('manage-level_modal_add_xp', messageId))
                .setTitle(l.modalAddXpTitle || 'Add XP to Member');

            const amtInput = new TextInputBuilder()
                .setCustomId('amount')
                .setLabel(l.lblAmountAdd || 'Amount of XP (1 to 100,000)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder(l.placeholderAmountAdd || 'e.g. 1000')
                .setRequired(true);

            const reasonInput = new TextInputBuilder()
                .setCustomId('reason')
                .setLabel(l.lblReason || 'Reason')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder(l.placeholderReasonAdd || 'e.g. Active participation bonus')
                .setRequired(false);

            modal.addComponents(
                new ActionRowBuilder().addComponents(amtInput),
                new ActionRowBuilder().addComponents(reasonInput)
            );

            await interaction.showModal(modal).catch(() => {});
        }

        
        else if (customId === 'manage-level_btn_remove_xp') {
            const modal = new ModalBuilder()
                .setCustomId(createDashboardModalId('manage-level_modal_remove_xp', messageId))
                .setTitle(l.modalRemoveXpTitle || 'Remove XP from Member');

            const amtInput = new TextInputBuilder()
                .setCustomId('amount')
                .setLabel(l.lblAmountRemove || 'Amount of XP to deduct (1 to 100,000)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder(l.placeholderAmountRemove || 'e.g. 500')
                .setRequired(true);

            const reasonInput = new TextInputBuilder()
                .setCustomId('reason')
                .setLabel(l.lblReason || 'Reason')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder(l.placeholderReasonRemove || 'e.g. Inappropriate behavior')
                .setRequired(false);

            modal.addComponents(
                new ActionRowBuilder().addComponents(amtInput),
                new ActionRowBuilder().addComponents(reasonInput)
            );

            await interaction.showModal(modal).catch(() => {});
        }

        
        else if (customId === 'manage-level_btn_set_level') {
            const modal = new ModalBuilder()
                .setCustomId(createDashboardModalId('manage-level_modal_set_level', messageId))
                .setTitle(l.modalSetLevelTitle || 'Set User Level');

            const lvlInput = new TextInputBuilder()
                .setCustomId('level')
                .setLabel(l.lblNewLevel || 'New Level (1 to 1000)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder(l.placeholderNewLevel || 'e.g. 10')
                .setRequired(true);

            const reasonInput = new TextInputBuilder()
                .setCustomId('reason')
                .setLabel(l.lblReason || 'Reason')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder(l.placeholderReasonLevel || 'e.g. Prestige level adjustment')
                .setRequired(false);

            modal.addComponents(
                new ActionRowBuilder().addComponents(lvlInput),
                new ActionRowBuilder().addComponents(reasonInput)
            );

            await interaction.showModal(modal).catch(() => {});
        }

        
        else if (customId === 'manage-level_btn_reset') {
            const resetTypeLabel = state.resetType === 'all' ? (l.resetAllLabel || 'Everything') : 
                                   state.resetType === 'xp' ? (l.resetXpLabel || 'XP & Levels') : 
                                   state.resetType === 'voice' ? (l.resetVoiceLabel || 'Voice Stats') : (l.resetWeeklyLabel || 'Weekly Stats');

            const modal = new ModalBuilder()
                .setCustomId(createDashboardModalId('manage-level_modal_reset', messageId))
                .setTitle((l.modalResetTitle || 'Reset level logs: {type}').replace('{type}', resetTypeLabel));

            const reasonInput = new TextInputBuilder()
                .setCustomId('reason')
                .setLabel(l.lblReasonReset || 'Reason for Reset (Wipe)')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder(l.placeholderReasonReset || 'Provide a reason for wiping these leveling metrics')
                .setRequired(false);

            modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
            await interaction.showModal(modal).catch(() => {});
        }

        return true;
    },

    async execute(interaction) {
        const isSlash = Boolean(interaction.isChatInputCommand?.());

        try {
            if (isSlash && !interaction.deferred && !interaction.replied) {
                await interaction.deferReply();
            }
        } catch (err) {
            console.error('[Manage Level] deferReply failed:', err.message);
            return;
        }

        if (!await checkPermissions(interaction, 'admin')) return;

        const client = interaction.client;
        await cacheCommandIds(client, interaction).catch(() => { });

        const subcommand = isSlash 
            ? (interaction.options.getSubcommand(false) || 'panel')
            : (String(interaction.content || '').split(' ').slice(1)[0] || 'panel').toLowerCase();

        const userId = isSlash ? interaction.user.id : interaction.author.id;
        const guildId = interaction.guild.id;
        const lang = await loadLanguage(guildId);
        const l = lang.setups?.managelevel || {};

        
        if (subcommand !== 'panel') {
            try {
                let targetUser = null;
                let amountOrType = null;
                let reason = l.noReason || 'No reason provided';

                if (isSlash) {
                    targetUser = interaction.options.getUser('user');
                    reason = interaction.options.getString('reason') || (l.noReason || 'No reason provided');
                    if (subcommand === 'add-xp' || subcommand === 'remove-xp') {
                        amountOrType = interaction.options.getInteger('amount');
                    } else if (subcommand === 'set-level') {
                        amountOrType = interaction.options.getInteger('level');
                    } else if (subcommand === 'reset-user') {
                        amountOrType = interaction.options.getString('type') || 'all';
                    }
                } else {
                    const args = String(interaction.content || '').split(' ').slice(2);
                    targetUser = await resolveUser(interaction.guild, args[0]);
                    if (!targetUser) {
                        const err = cards.error(
                            (l.fetchErrorTitle || '{emoji} Error').replace('{emoji}', getEmoji('cross')),
                            l.resolveUserFailed || 'Could not resolve target user. Please mention a member or supply a valid ID.'
                        );
                        await editResponse(interaction, { components: [err], flags: MessageFlags.IsComponentsV2 });
                        return;
                    }

                    if (subcommand === 'add-xp' || subcommand === 'remove-xp') {
                        amountOrType = parseInt(args[1], 10);
                        if (isNaN(amountOrType) || amountOrType <= 0) {
                            const err = cards.error(
                                (l.fetchErrorTitle || '{emoji} Error').replace('{emoji}', getEmoji('cross')),
                                l.invalidPositiveIntXp || 'XP Amount must be a valid positive integer.'
                            );
                            await editResponse(interaction, { components: [err], flags: MessageFlags.IsComponentsV2 });
                            return;
                        }
                        reason = args.slice(2).join(' ') || (l.noReason || 'No reason provided');
                    } else if (subcommand === 'set-level') {
                        amountOrType = parseInt(args[1], 10);
                        if (isNaN(amountOrType) || amountOrType < 1) {
                            const err = cards.error(
                                (l.fetchErrorTitle || '{emoji} Error').replace('{emoji}', getEmoji('cross')),
                                l.invalidPositiveIntLevel || 'Level must be a valid positive integer.'
                            );
                            await editResponse(interaction, { components: [err], flags: MessageFlags.IsComponentsV2 });
                            return;
                        }
                        reason = args.slice(2).join(' ') || (l.noReason || 'No reason provided');
                    } else if (subcommand === 'reset-user') {
                        const validTypes = ['all', 'xp', 'voice', 'weekly'];
                        amountOrType = validTypes.includes(args[1]?.toLowerCase()) ? args[1].toLowerCase() : 'all';
                        reason = args.slice(validTypes.includes(args[1]?.toLowerCase()) ? 2 : 1).join(' ') || (l.noReason || 'No reason provided');
                    }
                }

                
                const successCard = await runAdminAction(interaction, subcommand, targetUser, amountOrType, reason, lang);
                await editResponse(interaction, { components: [successCard], flags: MessageFlags.IsComponentsV2 });

            } catch (error) {
                console.error('[Manage Level Direct Execution Error]:', error);
                const errMsg = l.updateFailedGeneric || 'Failed to apply level modification. Please try again.';
                const errCard = cards.error(
                    (l.fetchErrorTitle || '{emoji} Error').replace('{emoji}', getEmoji('cross')),
                    errMsg
                );
                await editResponse(interaction, { components: [errCard], flags: MessageFlags.IsComponentsV2 });
            }
            return;
        }

        
        const state = {
            mode: 'overview',
            userId,
            targetUserId: null,
            resetType: 'all',
            interaction
        };

        try {
            const panel = await renderState(client, guildId, state, lang);
            const payload = { components: [panel], flags: MessageFlags.IsComponentsV2 };

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
        } catch (err) {
            console.error('[Manage Level Initial Panel Error]:', err.message);
            const errCard = cards.error(
                (l.fetchErrorTitle || '{emoji} Error').replace('{emoji}', getEmoji('cross')),
                l.initFailed || 'Failed to initialize level manager dashboard.'
            );
            const errPayload = { components: [errCard], flags: MessageFlags.IsComponentsV2 };
            if (interaction.deferred || interaction.replied) {
                interaction.editReply(errPayload).catch(() => { });
            } else {
                interaction.reply(errPayload).catch(() => { });
            }
        }
    }
};
