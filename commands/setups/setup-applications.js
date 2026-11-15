const {
    SlashCommandBuilder,
    PermissionsBitField,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    MessageFlags,
    StringSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    ContainerBuilder,
    SectionBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');

const checkPermissions = require('../../utils/checkPermissions');
const { getEmoji, getButtonEmoji } = require('../../UI/emojis/emoji');
const { invalidateGuildApplications, invalidateApplication } = require('../../utils/cacheHelpers');
const { sendMainApplicationEmbed } = require('../../dashboard/modules/applications/activation');
const { runWithinAcknowledgementWindow } = require('../../utils/interactionRouter');
const { createDashboardModalId, parseDashboardModalId, resolveDashboardMessage, getDashboardSessionOwnerId } = require('../../utils/dashboardModalSession');
const lang = require('../../events/loadLanguage');
const { buildCard, cards, replyEphemeral, createSessionManager, btn
} = require('../../UI');

const {
    createApplication,
    addQuestion,
    updateQuestion,
    removeQuestion,
    deleteApplication,
    activateApplication,
    deactivateApplication,
    getApplication,
    getAllApplications
} = require('../../models/applications/controller');


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
                        title: `${getEmoji('warning')} ${lang.setups.applications.sessionExpiredTitle}`,
                        description: lang.setups.applications.sessionExpiredDesc,
                        tone: 'danger'
                    });
                    await message.edit({ components: [expiredCard], flags: MessageFlags.IsComponentsV2 }).catch(() => { });
                    setTimeout(() => { message.delete().catch(() => {}); }, 3000);
                }
            }
        } catch (_) { }
    }
});
async function handleAppActivationAndEmbed(guild, appName, mainChannelId, responseChannelId) {
    await activateApplication(guild.id, appName, mainChannelId, responseChannelId);
    await sendMainApplicationEmbed(guild, appName, mainChannelId);
}


async function renderState(client, guild, state) {
    const guildId = guild.id;
    let title = '';
    let sections = [];
    let rows = [];
    let tone = 'primary';

    if (state.mode === 'view') {
        const app = await getApplication(guildId, state.appName);
        if (!app) {
            state.mode = 'list';
            state.appName = null;
        } else {
            title = `${getEmoji('list')} ${lang.setups.applications.title.replace('{name}', app.appName)}`;
            tone = app.isActive ? 'success' : 'danger';

            const mainChannelText = app.mainChannel ? `<#${app.mainChannel}>` : lang.setups.applications.notConfigured;
            const responseChannelText = app.responseChannel ? `<#${app.responseChannel}>` : lang.setups.applications.notConfigured;

            const questionsText = app.questions.length > 0
                ? app.questions.map((q, i) => `**Q${i + 1}:** ${q.text}`).join('\n')
                : lang.setups.applications.noQuestionsNotice;

            const statusLabel = app.isActive ? `${getEmoji('success')} ${lang.setups.applications.statusActive}` : `${getEmoji('error')} ${lang.setups.applications.statusInactive}`;

            sections = [
                `### ${getEmoji('settings')} ${lang.setups.applications.statusHeader}\n` +
                lang.setups.applications.systemStatusField
                    .replace('{status}', statusLabel)
                    .replace('{count}', app.questions.length),
                `### ${getEmoji('world')} ${lang.setups.applications.channelsHeader}\n` +
                lang.setups.applications.channelsField
                    .replace('{main}', mainChannelText)
                    .replace('{review}', responseChannelText),
                `### ${getEmoji('list')} ${lang.setups.applications.questionsHeader}\n${questionsText}`
            ];

            const controlButtonsRow = new ActionRowBuilder().addComponents(
                btn(lang.setups.applications.btnBackToList, 'setup-applications_btn_back', 'arrleft', ButtonStyle.Secondary),
                btn(
                    app.isActive ? lang.setups.applications.btnDeactivate : lang.setups.applications.btnActivate,
                    'setup-applications_btn_toggle_active',
                    app.isActive ? 'warning' : 'sparkles',
                    app.isActive ? ButtonStyle.Danger : ButtonStyle.Success,
                    !app.mainChannel || !app.responseChannel || app.questions.length === 0
                ),
                btn(lang.setups.applications.btnAddQuestion, 'setup-applications_btn_add_question', 'help', ButtonStyle.Primary, app.questions.length >= 5),
                btn(lang.setups.applications.btnDeleteApp, 'setup-applications_btn_delete', 'delete', ButtonStyle.Danger)
            );

            const selectMainChannelRow = new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('setup-applications_select_main_channel')
                    .setPlaceholder(lang.setups.applications.selectMainChannelPlaceholder)
                    .setChannelTypes([ChannelType.GuildText, ChannelType.GuildAnnouncement])
            );

            const selectResponseChannelRow = new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('setup-applications_select_response_channel')
                    .setPlaceholder(lang.setups.applications.selectResponseChannelPlaceholder)
                    .setChannelTypes([ChannelType.GuildText, ChannelType.GuildAnnouncement])
            );

            rows = [
                controlButtonsRow,
                selectMainChannelRow,
                selectResponseChannelRow
            ];

            if (app.questions.length > 0) {
                const editOpts = app.questions.slice(0, 25).map((q, i) => ({
                    label: `Q${i + 1}: ${q.text.substring(0, 50)}`,
                    value: String(i),
                    emoji: getButtonEmoji('settings')
                }));
                const editQuestionMenuRow = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('setup-applications_select_edit_question')
                        .setPlaceholder(lang.setups.applications.selectEditQuestionPlaceholder)
                        .addOptions(editOpts)
                );

                const removeOpts = app.questions.slice(0, 25).map((q, i) => ({
                    label: `Q${i + 1}: ${q.text.substring(0, 50)}`,
                    value: String(i),
                    emoji: getButtonEmoji('delete')
                }));
                const removeQuestionMenuRow = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('setup-applications_select_remove_question')
                        .setPlaceholder(lang.setups.applications.selectRemoveQuestionPlaceholder)
                        .addOptions(removeOpts)
                );

                rows.push(editQuestionMenuRow, removeQuestionMenuRow);
            }
        }
    }

    if (state.mode === 'list') {
        const apps = await getAllApplications(guildId).catch(() => []) || [];
        title = `${getEmoji('list')} ${lang.setups.applications.dashboardTitle}`;
        tone = 'primary';

        let appsListText = '';
        if (apps.length > 0) {
            appsListText = apps.map((app, index) => {
                const status = app.isActive ? `${getEmoji('success')} ${lang.setups.applications.statusActive}` : `${getEmoji('error')} ${lang.setups.applications.statusInactive}`;
                const main = app.mainChannel ? `<#${app.mainChannel}>` : lang.setups.applications.notConfigured;
                const review = app.responseChannel ? `<#${app.responseChannel}>` : lang.setups.applications.notConfigured;
                return `**${index + 1}. ${app.appName}**\n• Status: ${status} | Questions: **${app.questions.length}/5**\n• Main: ${main} | Review: ${review}`;
            }).join('\n\n');
        } else {
            appsListText = lang.setups.applications.emptyList;
        }

        sections = [
            lang.setups.applications.dashboardDesc,
            `### ${getEmoji('list')} ${lang.setups.applications.configuredHeader}\n${appsListText}`
        ];

        const actionsRow = new ActionRowBuilder();
        if (apps.length > 0) {
            const selectOpts = apps.slice(0, 25).map(app => ({
                label: app.appName,
                description: lang.setups.applications.manageAppDesc.replace('{name}', app.appName),
                value: app.appName,
                emoji: getButtonEmoji('settings'),
                default: false
            }));
            const selectAppRow = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('setup-applications_select_app')
                    .setPlaceholder(lang.setups.applications.selectAppPlaceholder)
                    .addOptions(selectOpts)
            );

            actionsRow.addComponents(
                btn(lang.setups.applications.btnCreateApp, 'setup-applications_btn_create', 'sparkles', ButtonStyle.Success),
                btn(lang.setups.applications.btnHelpGuide, 'setup-applications_btn_help', 'help', ButtonStyle.Secondary),
                btn(lang.setups.applications.btnClose, 'setup-applications_btn_close', 'stop', ButtonStyle.Danger)
            );

            rows = [selectAppRow, actionsRow];
        } else {
            actionsRow.addComponents(
                btn(lang.setups.applications.btnCreateApp, 'setup-applications_btn_create', 'sparkles', ButtonStyle.Success),
                btn(lang.setups.applications.btnHelpGuide, 'setup-applications_btn_help', 'help', ButtonStyle.Secondary),
                btn(lang.setups.applications.btnClose, 'setup-applications_btn_close', 'stop', ButtonStyle.Danger)
            );

            rows = [actionsRow];
        }
    }

    if (state.mode === 'help') {
        title = `${getEmoji('list')} ${lang.setups.applications.guideTitle}`;
        tone = 'accent';

        sections = [
            `### ${getEmoji('list')} ${lang.setups.applications.guideWalkthroughHeader}\n${lang.setups.applications.guideWalkthroughSteps}`,
            `### ${getEmoji('settings')} ${lang.setups.applications.guideMentionsHeader}\n${lang.setups.applications.guideMentionsDetails}`
        ];

        const navRow = new ActionRowBuilder().addComponents(
            btn(lang.setups.applications.btnBackToDashboard, 'setup-applications_btn_back', 'arrleft', ButtonStyle.Secondary),
            btn(lang.setups.applications.btnClose, 'setup-applications_btn_close', 'stop', ButtonStyle.Danger)
        );

        rows = [navRow];
    }

    return [buildCard({ title, sections, rows, tone })];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-applications')
        .setDescription('Manage application setup.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('show')
                .setDescription('Show all applications and their details.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create a new application.')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('The name of the application.')
                        .setRequired(true)
                        .setMaxLength(30)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Delete an application.')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('The name of the application.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('activate')
                .setDescription('Activate an application.')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('The name of the application.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('addquestion')
                .setDescription('Add a question to an application.')
                .addStringOption(option =>
                    option.setName('appname')
                        .setDescription('The application name.')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('question')
                        .setDescription('The question to add (max 45 characters).')
                        .setRequired(true)
                        .setMaxLength(45)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('removequestion')
                .setDescription('Remove a question from an application.')
                .addStringOption(option =>
                    option.setName('appname')
                        .setDescription('The application name.')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('index')
                        .setDescription('The question index to remove.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('setmainchannel')
                .setDescription('Set the main channel for an application.')
                .addStringOption(option =>
                    option.setName('appname')
                        .setDescription('The application name.')
                        .setRequired(true))
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('The main channel for applications.')
                        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('setresponsechannel')
                .setDescription('Set the response channel for application reviews.')
                .addStringOption(option =>
                    option.setName('appname')
                        .setDescription('The application name.')
                        .setRequired(true))
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('The response channel for application reviews.')
                        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('help')
                .setDescription('Get help with setting up applications.')),

    async handleComponent(interaction) {
        if (!interaction.customId?.startsWith('setup-applications_')) return false;

        const modalSession = interaction.isModalSubmit() ? parseDashboardModalId(interaction.customId) : null;
        const messageId = modalSession?.messageId || interaction.message?.id;
        const clickerId = interaction.user.id;
        const client = interaction.client;
        const guild = interaction.guild;

        if (!guild) {
            return replyEphemeral(interaction, cards.error(lang.error, lang.setups.applications.guildContextMissing));
        }
        if (!messageId) {
            return replyEphemeral(interaction, cards.warning(lang.warning, lang.setups.applications.expiredNotice));
        }

        if (interaction.customId === 'setup-applications_btn_close') {
            const session = sessionManager.get(messageId);
            const ownerId = getDashboardSessionOwnerId(session);
            if (session && clickerId !== ownerId) {
                const ownerMention = ownerId ? `<@${ownerId}>` : 'another user';
                return replyEphemeral(interaction, cards.warning(lang.warning, lang.setups.applications.notYourDashboard.replace('<@{user}>', ownerMention).replace('{user}', ownerMention)));
            }

            try { await interaction.deferUpdate(); } catch { return true; }
            sessionManager.delete(messageId);

            const closed = buildCard({
                title: `${getEmoji('warning')} ${lang.setups.applications.dashboardClosedTitle}`,
                sections: [lang.setups.applications.dashboardClosedDesc, `${getEmoji('settings')} ${lang.setups.applications.reopenNotice}`],
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
                return replyEphemeral(interaction, cards.warning(lang.warning, lang.setups.applications.expiredNotice));
            }
            return replyEphemeral(interaction, cards.warning(lang.warning, lang.setups.applications.timedOutNotice));
        }

        const ownerId = getDashboardSessionOwnerId(session);
        if (clickerId !== ownerId) {
            const ownerMention = ownerId ? `<@${ownerId}>` : 'another user';
            return replyEphemeral(interaction, cards.warning(lang.warning, lang.setups.applications.notYourDashboard.replace('<@{user}>', ownerMention).replace('{user}', ownerMention)));
        }

        const customId = modalSession?.baseCustomId || interaction.customId;
        const { state } = session;

        if (customId === 'setup-applications_btn_create') {
            const modal = new ModalBuilder()
                .setCustomId(createDashboardModalId('setup-applications_modal_create', messageId))
                .setTitle(lang.setups.applications.modalCreateTitle);

            const nameInput = new TextInputBuilder()
                .setCustomId('app_name')
                .setLabel(lang.setups.applications.lblAppName)
                .setStyle(TextInputStyle.Short)
                .setPlaceholder(lang.setups.applications.placeholderAppName)
                .setRequired(true)
                .setMaxLength(30);

            modal.addComponents(new ActionRowBuilder().addComponents(nameInput));
            await interaction.showModal(modal);
            return true;
        }

        if (customId === 'setup-applications_btn_add_question') {
            const modal = new ModalBuilder()
                .setCustomId(createDashboardModalId('setup-applications_modal_add_question', messageId))
                .setTitle(lang.setups.applications.modalAddQuestionTitle);

            const questionInput = new TextInputBuilder()
                .setCustomId('question_text')
                .setLabel(lang.setups.applications.lblQuestionText)
                .setStyle(TextInputStyle.Short)
                .setPlaceholder(lang.setups.applications.placeholderQuestionText)
                .setRequired(true)
                .setMaxLength(45);

            modal.addComponents(new ActionRowBuilder().addComponents(questionInput));
            await interaction.showModal(modal);
            return true;
        }

        if (customId === 'setup-applications_select_edit_question') {
            const qIdx = parseInt(interaction.values[0], 10);
            const lookup = await runWithinAcknowledgementWindow(
                interaction,
                () => getApplication(guild.id, state.appName),
                'Application settings are taking too long to load. Please try again shortly.'
            );
            if (!lookup.completed) return true;
            const app = lookup.value;
            if (app && app.questions[qIdx]) {
                const modal = new ModalBuilder()
                    .setCustomId(createDashboardModalId(`setup-applications_modal_edit_question_${qIdx}`, messageId))
                    .setTitle(lang.setups.applications.modalEditQuestionTitle.replace('{num}', qIdx + 1));

                const questionInput = new TextInputBuilder()
                    .setCustomId('question_text')
                    .setLabel(lang.setups.applications.lblQuestionText)
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder(lang.setups.applications.placeholderQuestionText)
                    .setValue(app.questions[qIdx].text)
                    .setRequired(true)
                    .setMaxLength(45);

                modal.addComponents(new ActionRowBuilder().addComponents(questionInput));
                await interaction.showModal(modal);
                return true;
            }
            return true;
        }

        if (interaction.isModalSubmit()) {
            try { await interaction.deferUpdate(); } catch { return true; }

            sessionManager.touch(messageId);

            if (customId === 'setup-applications_modal_create') {
                const name = interaction.fields.getTextInputValue('app_name');
                const badWords = require('bad-words');
                const Filter = badWords.Filter || badWords;
                const filter = new Filter();
                if (filter.isProfane(name)) {
                    return replyEphemeral(interaction, cards.error(lang.error, lang.setups.applications.inappropriateNameDesc));
                }
                const existing = await getApplication(guild.id, name);
                if (!existing) {
                    await createApplication(guild.id, name);
                    state.mode = 'view';
                    state.appName = name;
                }
            } else if (customId === 'setup-applications_modal_add_question') {
                const text = interaction.fields.getTextInputValue('question_text');
                const app = await getApplication(guild.id, state.appName);
                if (app && app.questions.length < 5) {
                    await addQuestion(guild.id, state.appName, text);
                }
            } else if (customId.startsWith('setup-applications_modal_edit_question_')) {
                const qIdx = parseInt(customId.replace('setup-applications_modal_edit_question_', ''), 10);
                const text = interaction.fields.getTextInputValue('question_text');
                const app = await getApplication(guild.id, state.appName);
                if (app && app.questions[qIdx]) {
                    await updateQuestion(guild.id, state.appName, app.questions[qIdx].id, { text });
                }
            }

            try {
                const components = await renderState(client, guild, state);
                const dashboardMessage = await resolveDashboardMessage(interaction, session, messageId);
                if (dashboardMessage) await dashboardMessage.edit({ components, flags: MessageFlags.IsComponentsV2 });
            } catch (err) {
                console.error('[SetupApplications Modal Submit Error]:', err.message);
                await interaction.followUp({
                    content: 'Your application settings were saved, but the dashboard could not refresh. Reopen the setup panel to see the latest state.',
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
            }

            return true;
        }

        try {
            await interaction.deferUpdate();
        } catch {
            return true;
        }

        sessionManager.touch(messageId);

        if (customId === 'setup-applications_btn_back') {
            state.mode = 'list';
            state.appName = null;
        } else if (customId === 'setup-applications_btn_help') {
            state.mode = 'help';
        } else if (customId === 'setup-applications_select_app') {
            state.mode = 'view';
            state.appName = interaction.values[0];
        } else if (customId === 'setup-applications_btn_toggle_active') {
            const app = await getApplication(guild.id, state.appName);
            if (app) {
                if (app.isActive) {
                    await deactivateApplication(guild.id, state.appName);
                } else {
                    await handleAppActivationAndEmbed(guild, state.appName, app.mainChannel, app.responseChannel);
                }
            }
        } else if (customId === 'setup-applications_btn_delete') {
            await deleteApplication(guild.id, state.appName);
            state.mode = 'list';
            state.appName = null;
        } else if (customId === 'setup-applications_select_main_channel') {
            const channelId = interaction.values[0];
            const app = await getApplication(guild.id, state.appName);
            if (app) {
                if (app.responseChannel && app.questions.length > 0) {
                    await handleAppActivationAndEmbed(guild, state.appName, channelId, app.responseChannel);
                } else {
                    const ApplicationModel = require('../../models/applications/applications');
                    await ApplicationModel.findOneAndUpdate(
                        { guildId: guild.id, appName: state.appName },
                        { mainChannel: channelId }
                    );
                    invalidateApplication(guild.id, state.appName);
                }
            }
        } else if (customId === 'setup-applications_select_response_channel') {
            const channelId = interaction.values[0];
            const app = await getApplication(guild.id, state.appName);
            if (app) {
                if (app.mainChannel && app.questions.length > 0) {
                    await handleAppActivationAndEmbed(guild, state.appName, app.mainChannel, channelId);
                } else {
                    const ApplicationModel = require('../../models/applications/applications');
                    await ApplicationModel.findOneAndUpdate(
                        { guildId: guild.id, appName: state.appName },
                        { responseChannel: channelId }
                    );
                    invalidateApplication(guild.id, state.appName);
                }
            }
        } else if (customId === 'setup-applications_select_remove_question') {
            const qIdx = parseInt(interaction.values[0], 10);
            await removeQuestion(guild.id, state.appName, qIdx);
        }

        try {
            const components = await renderState(client, guild, state);
            await interaction.message.edit({ components, flags: MessageFlags.IsComponentsV2 });
        } catch (err) {
            console.error('[SetupApplications Component Error]:', err.message);
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
            console.error('[SetupApplications] deferReply failed:', err.message);
            return;
        }

        const client = interaction.client;
        const guild = interaction.guild;

        if (!guild) {
            const errorContainer = cards.error(lang.error, lang.setups.applications.serverRequired);
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

        const subcommand = isSlash ? (interaction.options.getSubcommand(false) || 'show') : 'show';

        let state = {
            mode: 'list',
            userId: isSlash ? interaction.user.id : interaction.author.id,
            appName: null,
            interaction
        };

        try {
            if (subcommand === 'create') {
                const name = isSlash ? interaction.options.getString('name') : String(interaction.content).split(' ').slice(2).join(' ');
                if (name) {
                    const badWords = require('bad-words');
                    const Filter = badWords.Filter || badWords;
                    const filter = new Filter();
                    if (filter.isProfane(name)) {
                        const errorCard = cards.error(lang.error, lang.setups.applications.inappropriateNameDesc);
                        const payload = { components: [errorCard], flags: MessageFlags.IsComponentsV2 };
                        if (isSlash) {
                            await interaction.editReply(payload).catch(() => { });
                        } else {
                            await interaction.reply(payload).catch(() => { });
                        }
                        return;
                    }
                    const existing = await getApplication(guild.id, name);
                    if (!existing) {
                        await createApplication(guild.id, name);
                    }
                    state.mode = 'view';
                    state.appName = name;
                }
            } else if (subcommand === 'delete') {
                const name = isSlash ? interaction.options.getString('name') : String(interaction.content).split(' ').slice(2).join(' ');
                if (name) {
                    await deleteApplication(guild.id, name);
                }
            } else if (subcommand === 'activate') {
                const name = isSlash ? interaction.options.getString('name') : String(interaction.content).split(' ').slice(2).join(' ');
                if (name) {
                    const app = await getApplication(guild.id, name);
                    if (app && app.mainChannel && app.responseChannel && app.questions.length > 0) {
                        await activateApplication(guild.id, name, app.mainChannel, app.responseChannel);
                        const mainChannel = guild.channels.cache.get(app.mainChannel);
                        if (mainChannel) {
                            const appFormContainer = new ContainerBuilder()
                                .setAccentColor(0x0099ff)
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder()
                                        .setContent(`# ${getEmoji('list')} ${lang.setups.applications.applyFormTitle}\n## ${lang.setups.applications.applyFormHeader.replace('{name}', name)}`)
                                )
                                .addSeparatorComponents(
                                    new SeparatorBuilder()
                                        .setSpacing(SeparatorSpacingSize.Large)
                                )
                                .addSectionComponents(
                                    new SectionBuilder()
                                        .addTextDisplayComponents(
                                            new TextDisplayBuilder()
                                                .setContent(lang.setups.applications.guidelinesContent)
                                        )
                                        .setButtonAccessory(
                                            new ButtonBuilder()
                                                .setCustomId(`open_application_modal_${name}`)
                                                .setLabel(lang.setups.applications.btnApplyNow)
                                                .setStyle(ButtonStyle.Primary)
                                                .setEmoji(getButtonEmoji('sparkles'))
                                        )
                                );

                            await mainChannel.send({
                                components: [appFormContainer],
                                flags: MessageFlags.IsComponentsV2
                            }).catch(() => { });
                        }
                    }
                    state.mode = 'view';
                    state.appName = name;
                }
            } else if (subcommand === 'addquestion') {
                const appname = isSlash ? interaction.options.getString('appname') : '';
                const question = isSlash ? interaction.options.getString('question') : '';
                if (appname && question) {
                    const app = await getApplication(guild.id, appname);
                    if (app && app.questions.length < 5) {
                        await addQuestion(guild.id, appname, question);
                    }
                    state.mode = 'view';
                    state.appName = appname;
                }
            } else if (subcommand === 'removequestion') {
                const appname = isSlash ? interaction.options.getString('appname') : '';
                const index = isSlash ? interaction.options.getInteger('index') : null;
                if (appname && index !== null) {
                    await removeQuestion(guild.id, appname, index);
                    state.mode = 'view';
                    state.appName = appname;
                }
            } else if (subcommand === 'setmainchannel') {
                const appname = isSlash ? interaction.options.getString('appname') : '';
                const channel = isSlash ? interaction.options.getChannel('channel') : null;
                if (appname && channel) {
                    const app = await getApplication(guild.id, appname);
                    if (app) {
                        await activateApplication(guild.id, appname, channel.id, app.responseChannel).catch(() => { });
                    }
                    state.mode = 'view';
                    state.appName = appname;
                }
            } else if (subcommand === 'setresponsechannel') {
                const appname = isSlash ? interaction.options.getString('appname') : '';
                const channel = isSlash ? interaction.options.getChannel('channel') : null;
                if (appname && channel) {
                    const app = await getApplication(guild.id, appname);
                    if (app) {
                        await activateApplication(guild.id, appname, app.mainChannel, channel.id).catch(() => { });
                    }
                    state.mode = 'view';
                    state.appName = appname;
                }
            } else if (subcommand === 'help') {
                state.mode = 'help';
            }
        } catch (err) {
            console.error('[SetupApplications execute sub-action error]:', err.message);
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
            console.error('[SetupApplications Initial Render Error]:', err.message);
            const errCard = cards.error(lang.error, lang.setups.applications.loadFailed);
            const errPayload = { components: [errCard], flags: MessageFlags.IsComponentsV2 };
            if (interaction.deferred || interaction.replied) {
                interaction.editReply(errPayload).catch(() => { });
            } else {
                interaction.reply(errPayload).catch(() => { });
            }
        }
    }
};
