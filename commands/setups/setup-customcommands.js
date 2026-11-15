const {
    SlashCommandBuilder,
    PermissionsBitField,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags
} = require('discord.js');

const checkPermissions = require('../../utils/checkPermissions');
const { getEmoji, getButtonEmoji } = require('../../UI/emojis/emoji');
const { invalidateCustomCommands, getServerConfig } = require('../../utils/cacheHelpers');
const { runWithinAcknowledgementWindow } = require('../../utils/interactionRouter');
const { createDashboardModalId, parseDashboardModalId, resolveDashboardMessage, getDashboardSessionOwnerId } = require('../../utils/dashboardModalSession');
const CustomCommand = require('../../models/customCommands/schema');
const config = require('../../config.js');
const lang = require('../../events/loadLanguage');
const { buildCard, cards, replyEphemeral, createSessionManager, btn
} = require('../../UI');

async function getGuildPrefix(guildId) {
    try {
        const serverConfig = await getServerConfig(guildId);
        return serverConfig?.prefix || config.prefix || '!';
    } catch (err) {
        return config.prefix || '!';
    }
}


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
                        title: `${getEmoji('warning')} ${lang.setups.customcommands.sessionExpiredTitle}`,
                        description: lang.setups.customcommands.sessionExpiredDesc,
                        tone: 'danger'
                    });
                    await message.edit({ components: [expiredCard], flags: MessageFlags.IsComponentsV2 }).catch(() => { });
                    setTimeout(() => { message.delete().catch(() => {}); }, 3000);
                }
            }
        } catch (_) { }
    }
});
function validateResponseText(response) {
    if (!response || response.trim().length === 0) {
        return lang.setups.customcommands.errResponseEmpty;
    }
    if (response.length > 2000) {
        return lang.setups.customcommands.errResponseLength;
    }

    const forbiddenPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /drop\s+table\s+/gi,
        /select\s+\*\s+from\s+/gi,
        /[`$|{}<>;]/g
    ];
    if (forbiddenPatterns.some(pattern => pattern.test(response))) {
        return lang.setups.customcommands.errForbiddenScript;
    }

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const isUrl = urlRegex.test(response);
    const isText = /^[\p{L}\p{N}\p{Emoji}\s.,!?'"\-:;()@#&*+=/\\\[\]~]+$/u.test(response);
    if (!isUrl && !isText) {
        return lang.setups.customcommands.errAllowedFormat;
    }

    return null;
}


async function renderState(client, guild, state) {
    const serverId = guild.id;
    const prefix = await getGuildPrefix(serverId);
    let title = '';
    let sections = [];
    let rows = [];
    let tone = 'primary';

    if (state.mode === 'view') {
        const cmd = await CustomCommand.findOne({ serverId, commandName: state.commandName });
        if (!cmd) {
            state.mode = 'list';
            state.commandName = null;
        } else {
            title = `${getEmoji('settings')} ${lang.setups.customcommands.title.replace('{prefix}', prefix).replace('{name}', cmd.commandName)}`;
            tone = 'success';

            const ownerInfo = `<@${cmd.userId}>`;
            const previewText = cmd.response.substring(0, 500) + (cmd.response.length > 500 ? '...' : '');

            sections = [
                `### ${getEmoji('star')} ${lang.setups.customcommands.commandDetailsHeader}\n` +
                lang.setups.customcommands.commandDetailsName
                    .replace('{prefix}', prefix)
                    .replace('{name}', cmd.commandName)
                    .replace('{owner}', ownerInfo)
                    .replace('{time}', Math.floor(cmd.createdAt.getTime() / 1000)),
                `### ${getEmoji('document')} ${lang.setups.customcommands.responseTextHeader}\n"${previewText}"`
            ];

            const controlRow1 = new ActionRowBuilder().addComponents(
                btn(lang.setups.customcommands.btnBackToList, 'setup-customcommands_btn_back', 'arrleft', ButtonStyle.Secondary),
                btn(lang.setups.customcommands.btnDeleteCommand, 'setup-customcommands_btn_delete', 'delete', ButtonStyle.Danger)
            );

            const controlRow2 = new ActionRowBuilder().addComponents(
                btn(lang.setups.customcommands.btnEditResponse, 'setup-customcommands_btn_edit_response', 'document', ButtonStyle.Primary)
            );

            rows = [controlRow1, controlRow2];
        }
    }

    if (state.mode === 'list') {
        const commands = await CustomCommand.find({ serverId }).catch(() => []) || [];
        title = `${getEmoji('list')} ${lang.setups.customcommands.dashboardTitle}`;
        tone = 'primary';

        let listText = '';
        if (commands.length > 0) {
            listText = commands.map((cmd, index) => {
                const preview = cmd.response.length > 60 ? `${cmd.response.substring(0, 60)}...` : cmd.response;
                return `**#${index + 1}. \`${prefix}${cmd.commandName}\`**\n• Response: "${preview}"\n• Creator: <@${cmd.userId}>`;
            }).join('\n\n');
        } else {
            listText = lang.setups.customcommands.emptyList;
        }

        sections = [
            lang.setups.customcommands.dashboardDesc,
            `### ${getEmoji('list')} ${lang.setups.customcommands.configuredHeader}\n${listText}`
        ];

        const actionsRow = new ActionRowBuilder();
        if (commands.length > 0) {
            const selectOpts = commands.slice(0, 25).map(cmd => ({
                label: `${prefix}${cmd.commandName}`,
                description: lang.setups.customcommands.manageCommandDesc.replace('{prefix}', prefix).replace('{name}', cmd.commandName),
                value: cmd.commandName,
                emoji: getButtonEmoji('settings')
            }));

            const selectCommandRow = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('setup-customcommands_select_command')
                    .setPlaceholder(lang.setups.customcommands.selectCommandPlaceholder)
                    .addOptions(selectOpts)
            );

            actionsRow.addComponents(
                btn(lang.setups.customcommands.btnCreateCommand, 'setup-customcommands_btn_create', 'sparkles', ButtonStyle.Success),
                btn(lang.setups.customcommands.btnHelpGuide, 'setup-customcommands_btn_help', 'help', ButtonStyle.Secondary),
                btn(lang.setups.customcommands.btnClose, 'setup-customcommands_btn_close', 'stop', ButtonStyle.Danger)
            );

            rows = [selectCommandRow, actionsRow];
        } else {
            actionsRow.addComponents(
                btn(lang.setups.customcommands.btnCreateCommand, 'setup-customcommands_btn_create', 'sparkles', ButtonStyle.Success),
                btn(lang.setups.customcommands.btnHelpGuide, 'setup-customcommands_btn_help', 'help', ButtonStyle.Secondary),
                btn(lang.setups.customcommands.btnClose, 'setup-customcommands_btn_close', 'stop', ButtonStyle.Danger)
            );

            rows = [actionsRow];
        }
    }

    if (state.mode === 'help') {
        title = `${getEmoji('list')} ${lang.setups.customcommands.guideTitle}`;
        tone = 'accent';

        sections = [
            `### ${getEmoji('list')} ${lang.setups.customcommands.guideWorkflowHeader}\n` +
            lang.setups.customcommands.guideWorkflowSteps.replace(/{prefix}/g, prefix),
            `### ${getEmoji('lock')} ${lang.setups.customcommands.guideSafetyHeader}\n${lang.setups.customcommands.guideSafetyRules}`
        ];

        const navRow = new ActionRowBuilder().addComponents(
            btn(lang.setups.customcommands.btnBackToDashboard, 'setup-customcommands_btn_back', 'arrleft', ButtonStyle.Secondary),
            btn(lang.setups.customcommands.btnClose, 'setup-customcommands_btn_close', 'stop', ButtonStyle.Danger)
        );

        rows = [navRow];
    }

    return [buildCard({ title, sections, rows, tone })];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-customcommands')
        .setDescription('Manage server custom commands.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('show')
                .setDescription('Show dashboard to manage custom commands.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Set a new custom command.')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('The command name (no spaces, max 20 chars).')
                        .setRequired(true)
                        .setMaxLength(20))
                .addStringOption(option =>
                    option.setName('response')
                        .setDescription('The response text (max 2000 chars).')
                        .setRequired(true)
                        .setMaxLength(2000)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Delete a custom command.')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('The command name.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('audit')
                .setDescription('List all custom commands (Admin only).')),

    async handleComponent(interaction) {
        if (!interaction.customId?.startsWith('setup-customcommands_')) return false;

        const modalSession = interaction.isModalSubmit() ? parseDashboardModalId(interaction.customId) : null;
        const messageId = modalSession?.messageId || interaction.message?.id;
        const clickerId = interaction.user.id;
        const client = interaction.client;
        const guild = interaction.guild;

        if (!guild) {
            return replyEphemeral(interaction, cards.error(lang.error, lang.setups.customcommands.guildContextMissing));
        }
        if (!messageId) {
            return replyEphemeral(interaction, cards.warning(lang.warning, lang.setups.customcommands.expiredNotice));
        }

        if (interaction.customId === 'setup-customcommands_btn_close') {
            const session = sessionManager.get(messageId);
            const ownerId = getDashboardSessionOwnerId(session);
            if (session && clickerId !== ownerId) {
                const ownerMention = ownerId ? `<@${ownerId}>` : 'another user';
                return replyEphemeral(interaction, cards.warning(lang.warning, lang.setups.customcommands.notYourDashboard.replace('<@{user}>', ownerMention).replace('{user}', ownerMention)));
            }

            try { await interaction.deferUpdate(); } catch { return true; }
            sessionManager.delete(messageId);

            const closed = buildCard({
                title: `${getEmoji('warning')} ${lang.setups.customcommands.dashboardClosedTitle}`,
                sections: [lang.setups.customcommands.dashboardClosedDesc, `${getEmoji('settings')} ${lang.setups.customcommands.reopenNotice}`],
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
                return replyEphemeral(interaction, cards.warning(lang.warning, lang.setups.customcommands.expiredNotice));
            }
            return replyEphemeral(interaction, cards.warning(lang.warning, lang.setups.customcommands.timedOutNotice));
        }

        const ownerId = getDashboardSessionOwnerId(session);
        if (clickerId !== ownerId) {
            const ownerMention = ownerId ? `<@${ownerId}>` : 'another user';
            return replyEphemeral(interaction, cards.warning(lang.warning, lang.setups.customcommands.notYourDashboard.replace('<@{user}>', ownerMention).replace('{user}', ownerMention)));
        }

        const customId = modalSession?.baseCustomId || interaction.customId;
        const { state } = session;

        
        if (customId === 'setup-customcommands_btn_create') {
            const modal = new ModalBuilder()
                .setCustomId(createDashboardModalId('setup-customcommands_modal_create', messageId))
                .setTitle(lang.setups.customcommands.modalCreateTitle);

            const nameInput = new TextInputBuilder()
                .setCustomId('cmd_name')
                .setLabel(lang.setups.customcommands.lblTriggerName)
                .setStyle(TextInputStyle.Short)
                .setPlaceholder(lang.setups.customcommands.placeholderTriggerName)
                .setRequired(true)
                .setMaxLength(20);

            const responseInput = new TextInputBuilder()
                .setCustomId('cmd_response')
                .setLabel(lang.setups.customcommands.lblResponseText)
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder(lang.setups.customcommands.placeholderResponseText)
                .setRequired(true)
                .setMaxLength(2000);

            modal.addComponents(
                new ActionRowBuilder().addComponents(nameInput),
                new ActionRowBuilder().addComponents(responseInput)
            );
            await interaction.showModal(modal);
            return true;
        }

        if (customId === 'setup-customcommands_btn_edit_response') {
            const lookup = await runWithinAcknowledgementWindow(
                interaction,
                () => CustomCommand.findOne({ serverId: guild.id, commandName: state.commandName }),
                'Custom command details are taking too long to load. Please try again shortly.'
            );
            if (!lookup.completed) return true;
            const cmd = lookup.value;
            if (cmd) {
                const modal = new ModalBuilder()
                    .setCustomId(createDashboardModalId('setup-customcommands_modal_edit_response', messageId))
                    .setTitle(lang.setups.customcommands.modalEditTitle);

                const responseInput = new TextInputBuilder()
                    .setCustomId('cmd_response')
                    .setLabel(lang.setups.customcommands.lblResponseText)
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder(lang.setups.customcommands.placeholderEditResponse)
                    .setValue(cmd.response || '')
                    .setRequired(true)
                    .setMaxLength(2000);

                modal.addComponents(new ActionRowBuilder().addComponents(responseInput));
                await interaction.showModal(modal);
            }
            return true;
        }

        
        if (interaction.isModalSubmit()) {
            try { await interaction.deferUpdate(); } catch { return true; }
            sessionManager.touch(messageId);

            if (customId === 'setup-customcommands_modal_create') {
                const rawName = interaction.fields.getTextInputValue('cmd_name');
                const name = rawName.toLowerCase().trim();
                const response = interaction.fields.getTextInputValue('cmd_response');

                
                if (!name || name.length === 0) {
                    return replyEphemeral(interaction, cards.error(lang.error, lang.setups.customcommands.errNameEmpty));
                }

                
                if (!/^[a-z0-9_-]+$/.test(name)) {
                    return replyEphemeral(interaction, cards.error(lang.error, lang.setups.customcommands.errNameFormat));
                }

                
                const restrictedNames = ['nuke', 'raid', 'hack', 'shutdown', 'ban', 'delete', 'hentai', 'love'];
                if (restrictedNames.includes(name)) {
                    return replyEphemeral(interaction, cards.error(lang.error, lang.setups.customcommands.errNameRestricted.replace('{name}', name)));
                }

                const badWords = require('bad-words');
                const Filter = badWords.Filter || badWords;
                const filter = new Filter();
                if (filter.isProfane(name)) {
                    return replyEphemeral(interaction, cards.error(lang.error, lang.setups.customcommands.errProfanity));
                }

                const responseErr = validateResponseText(response);
                if (responseErr) {
                    return replyEphemeral(interaction, cards.error(lang.error, responseErr));
                }

                const existing = await CustomCommand.findOne({ serverId: guild.id, commandName: name });
                if (!existing) {
                    const newCmd = new CustomCommand({
                        serverId: guild.id,
                        userId: clickerId,
                        commandName: name,
                        response
                    });
                    await newCmd.save();
                    invalidateCustomCommands(guild.id);
                    state.mode = 'view';
                    state.commandName = name;
                } else {
                    const prefix = await getGuildPrefix(guild.id);
                    return replyEphemeral(interaction, cards.error(lang.error, lang.setups.customcommands.errAlreadyExists.replace('{prefix}', prefix).replace('{name}', name)));
                }
            } else if (customId === 'setup-customcommands_modal_edit_response') {
                const response = interaction.fields.getTextInputValue('cmd_response');

                const responseErr = validateResponseText(response);
                if (responseErr) {
                    return replyEphemeral(interaction, cards.error(lang.error, responseErr));
                }

                await CustomCommand.findOneAndUpdate(
                    { serverId: guild.id, commandName: state.commandName },
                    { response: response.trim() }
                );
                invalidateCustomCommands(guild.id);
            }

            try {
                const components = await renderState(client, guild, state);
                const dashboardMessage = await resolveDashboardMessage(interaction, session, messageId);
                if (dashboardMessage) await dashboardMessage.edit({ components, flags: MessageFlags.IsComponentsV2 });
            } catch (err) {
                console.error('[SetupCustomCommands Modal Submit Error]:', err.message);
                await interaction.followUp({
                    content: 'Your custom command change was saved, but the dashboard could not refresh. Reopen the setup panel to see the latest state.',
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
            }
            return true;
        }

        
        try { await interaction.deferUpdate(); } catch { return true; }
        sessionManager.touch(messageId);

        if (customId === 'setup-customcommands_btn_back') {
            state.mode = 'list';
            state.commandName = null;
        } else if (customId === 'setup-customcommands_btn_help') {
            state.mode = 'help';
        } else if (customId === 'setup-customcommands_select_command') {
            state.mode = 'view';
            state.commandName = interaction.values[0];
        } else if (customId === 'setup-customcommands_btn_delete') {
            await CustomCommand.findOneAndDelete({ serverId: guild.id, commandName: state.commandName });
            invalidateCustomCommands(guild.id);
            state.mode = 'list';
            state.commandName = null;
        }

        try {
            const components = await renderState(client, guild, state);
            await interaction.message.edit({ components, flags: MessageFlags.IsComponentsV2 });
        } catch (err) {
            console.error('[SetupCustomCommands Component Interaction Error]:', err.message);
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
            console.error('[SetupCustomCommands] deferReply failed:', err.message);
            return;
        }

        const client = interaction.client;
        const guild = interaction.guild;

        if (!guild) {
            const errorContainer = cards.error(lang.error, lang.setups.customcommands.serverRequired);
            const payload = { components: [errorContainer], flags: MessageFlags.IsComponentsV2 };
            if (isSlash) {
                await interaction.editReply(payload).catch(() => { });
            } else {
                await interaction.reply(payload).catch(() => { });
            }
            return;
        }

        if (!await checkPermissions(interaction, 'botmanager')) {
            return;
        }

        const prefix = await getGuildPrefix(guild.id);
        const subcommand = isSlash ? (interaction.options.getSubcommand(false) || 'show') : 'show';

        let state = {
            mode: 'list',
            userId: isSlash ? interaction.user.id : interaction.author.id,
            commandName: null,
            interaction
        };

        try {
            if (subcommand === 'set') {
                const name = isSlash ? interaction.options.getString('name').toLowerCase().trim() : '';
                const response = isSlash ? interaction.options.getString('response') : '';

                if (name && response) {
                    if (!/^[a-z0-9_-]+$/.test(name)) {
                        const err = cards.error(lang.error, lang.setups.customcommands.errNameFormat);
                        const payload = { components: [err], flags: MessageFlags.IsComponentsV2 };
                        if (isSlash) await interaction.editReply(payload);
                        else await interaction.reply(payload);
                        return;
                    }

                    const restrictedNames = ['nuke', 'raid', 'hack', 'shutdown', 'ban', 'delete', 'hentai', 'love'];
                    if (restrictedNames.includes(name)) {
                        const err = cards.error(lang.error, lang.setups.customcommands.errNameRestricted.replace('{name}', name));
                        const payload = { components: [err], flags: MessageFlags.IsComponentsV2 };
                        if (isSlash) await interaction.editReply(payload);
                        else await interaction.reply(payload);
                        return;
                    }

                    const badWords = require('bad-words');
                    const Filter = badWords.Filter || badWords;
                    const filter = new Filter();
                    if (filter.isProfane(name)) {
                        const err = cards.error(lang.error, lang.setups.customcommands.errProfanity);
                        const payload = { components: [err], flags: MessageFlags.IsComponentsV2 };
                        if (isSlash) await interaction.editReply(payload);
                        else await interaction.reply(payload);
                        return;
                    }

                    const responseErr = validateResponseText(response);
                    if (responseErr) {
                        const err = cards.error(lang.error, responseErr);
                        const payload = { components: [err], flags: MessageFlags.IsComponentsV2 };
                        if (isSlash) await interaction.editReply(payload);
                        else await interaction.reply(payload);
                        return;
                    }

                    await CustomCommand.findOneAndUpdate(
                        { serverId: guild.id, commandName: name },
                        { $set: { userId: state.userId, response } },
                        { upsert: true }
                    );
                    invalidateCustomCommands(guild.id);
                    state.mode = 'view';
                    state.commandName = name;
                }
            } else if (subcommand === 'delete') {
                const name = isSlash ? interaction.options.getString('name').toLowerCase().trim() : '';
                if (name) {
                    const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
                    const query = isAdmin ? { serverId: guild.id, commandName: name } : { serverId: guild.id, userId: state.userId, commandName: name };
                    const deleted = await CustomCommand.findOneAndDelete(query);
                    if (deleted) {
                        invalidateCustomCommands(guild.id);
                    } else {
                        const err = cards.error(lang.error, lang.setups.customcommands.cmdNotFound.replace('{prefix}', prefix).replace('{name}', name));
                        const payload = { components: [err], flags: MessageFlags.IsComponentsV2 };
                        if (isSlash) await interaction.editReply(payload);
                        else await interaction.reply(payload);
                        return;
                    }
                }
            } else if (subcommand === 'audit') {
                const allCommands = await CustomCommand.find({ serverId: guild.id }).lean();
                if (allCommands.length === 0) {
                    const container = cards.info(lang.setups.customcommands.auditTitle, lang.setups.customcommands.auditEmpty);
                    const payload = { components: [container], flags: MessageFlags.IsComponentsV2 };
                    if (isSlash) await interaction.editReply(payload);
                    else await interaction.reply(payload);
                    return;
                }

                const MAX_AUDIT_ITEMS = 25;
                const visible = allCommands.slice(0, MAX_AUDIT_ITEMS);
                let list = visible.map(cmd => {
                    const cleanResp = (cmd.response || '').replace(/\n/g, ' ');
                    const truncated = cleanResp.length > 60 ? cleanResp.slice(0, 57) + '...' : cleanResp;
                    return `${getEmoji('user')} <@${cmd.userId}> | \`${prefix}${cmd.commandName}\` → ${truncated}`;
                }).join('\n');
                if (allCommands.length > MAX_AUDIT_ITEMS) {
                    list += `\n\n*...and ${allCommands.length - MAX_AUDIT_ITEMS} more commands.*`;
                }
                const container = buildCard({
                    title: lang.setups.customcommands.auditTitle,
                    sections: [lang.setups.customcommands.auditHeader.replace('{guild}', guild.name).replace('{list}', list)],
                    tone: 'primary'
                });
                const payload = { components: [container], flags: MessageFlags.IsComponentsV2 };
                if (isSlash) await interaction.editReply(payload);
                else await interaction.reply(payload);
                return;
            }
        } catch (err) {
            console.error('[SetupCustomCommands execute error]:', err.message);
        }

        try {
            const components = await renderState(client, guild, state);
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
        } catch (err) {
            console.error('[SetupCustomCommands Initial Render Error]:', err.message);
            const errCard = cards.error(lang.error, lang.setups.customcommands.loadFailed);
            const errPayload = { components: [errCard], flags: MessageFlags.IsComponentsV2 };
            if (interaction.deferred || interaction.replied) {
                interaction.editReply(errPayload).catch(() => { });
            } else {
                interaction.reply(errPayload).catch(() => { });
            }
        }
    }
};
