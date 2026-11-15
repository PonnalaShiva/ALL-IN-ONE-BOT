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
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');

const checkPermissions = require('../../utils/checkPermissions');
const { getEmoji, getButtonEmoji } = require('../../UI/emojis/emoji');
const { invalidateAutoResponders } = require('../../utils/cacheHelpers');
const { runWithinAcknowledgementWindow } = require('../../utils/interactionRouter');
const { createDashboardModalId, parseDashboardModalId, resolveDashboardMessage, getDashboardSessionOwnerId } = require('../../utils/dashboardModalSession');
const AutoResponder = require('../../models/autoresponses/schema');
const loadLanguage = require('../../events/loadLanguage');
const { buildCard, cards, replyEphemeral, createSessionManager, btn
} = require('../../UI');


const sessionManager = createSessionManager({
    ttlMs: 15 * 60 * 1000,
    onExpire: async (session, client) => {
        try {
            const lang = await loadLanguage(session.guildId);
            const channel = client.channels.cache.get(session.channelId) || await client.channels.fetch(session.channelId).catch(() => null);
            if (channel) {
                const message = await channel.messages.fetch(session.messageId).catch(() => null);
                if (message) {
                    const expiredCard = cards.warning(
                        (lang.setups?.autoresponders?.sessionExpiredTitle || '{emoji} Session Expired').replace('{emoji}', getEmoji('warning')),
                        lang.setups?.autoresponders?.sessionExpiredDesc || 'This configuration panel has expired, run `/setup-autoresponders` to open a new dashboard.'
                    );
                    await message.edit({ components: [expiredCard], flags: MessageFlags.IsComponentsV2 }).catch(() => { });
                    setTimeout(() => { message.delete().catch(() => {}); }, 3000);
                }
            }
        } catch (_) { }
    }
});
function isValidUrl(str) {
    if (!str) return true;
    try {
        const url = new URL(str);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
        return false;
    }
}

function getEmbedTextLength(title, description, footer, fields, authorName) {
    let len = (title || '').length + (description || '').length;
    if (footer) len += footer.length;
    if (authorName) len += authorName.length;
    if (Array.isArray(fields)) {
        for (const f of fields) {
            len += (f.name || '').length + (f.value || '').length;
        }
    }
    return len;
}


async function renderState(client, guild, state, lang) {
    const guildId = guild.id;
    const l = lang.setups?.autoresponders || {};
    let title = '';
    let sections = [];
    let componentsList = [];
    let accentColor = 0x1E90FF; 

    if (state.mode === 'view') {
        const ar = await AutoResponder.findOne({ guildId, trigger: state.trigger });
        if (!ar) {
            state.mode = 'list';
            state.trigger = null;
        } else {
            title = (l.responderTitle || '{emoji} AutoResponder: {trigger}')
                .replace('{emoji}', getEmoji('settings'))
                .replace('{trigger}', ar.trigger);
            accentColor = ar.status ? 0x2ECC71 : 0xE74C3C;

            const channelScope = ar.channels.includes('all')
                ? (l.allChannels || 'All Channels')
                : ar.channels.map(id => `<#${id}>`).join(', ');

            let responsePreview = '';
            if (ar.embedData) {
                const lines = [
                    (l.lblType || '• **Type:** {type}').replace('{type}', l.typeEmbed || 'Embed Response'),
                    (l.lblTitle || '• **Title:** {title}').replace('{title}', ar.embedData.title || (l.notSet || '*Not Set*')),
                    (l.lblDescription || '• **Description:** {description}').replace('{description}', ar.embedData.description ? (ar.embedData.description.substring(0, 150) + (ar.embedData.description.length > 150 ? '...' : '')) : (l.notSet || '*Not Set*')),
                    (l.lblFieldsCount || '• **Fields Count:** {count}').replace('{count}', ar.embedData.fields?.length || 0),
                    (l.lblHexColor || '• **Hex Color:** {color}').replace('{color}', ar.embedData.color || '#FF00FF')
                ];
                if (ar.embedData.author?.name) {
                    lines.push((l.lblAuthorName || '• **Author Name:** {name}').replace('{name}', ar.embedData.author.name));
                }
                if (ar.embedData.author?.url) {
                    lines.push((l.lblAuthorLink || '• **Author Link:** {url}').replace('{url}', ar.embedData.author.url));
                }
                if (ar.embedData.author?.iconURL) {
                    lines.push((l.lblAuthorIcon || '• **Author Icon:** {url}').replace('{url}', ar.embedData.author.iconURL));
                }
                if (ar.embedData.image) {
                    lines.push((l.lblImageUrl || '• **Image URL:** {url}').replace('{url}', ar.embedData.image));
                }
                if (ar.embedData.thumbnail) {
                    lines.push((l.lblThumbnailUrl || '• **Thumbnail URL:** {url}').replace('{url}', ar.embedData.thumbnail));
                }
                responsePreview = lines.join('\n');
            } else {
                const text = ar.textResponse || (l.noResponseConfigured || '*No response configured*');
                responsePreview = `${(l.lblType || '• **Type:** {type}').replace('{type}', l.typeText || 'Text Response')}\n${(l.lblContent || '• **Content:** {content}').replace('{content}', text.substring(0, 200) + (text.length > 200 ? '...' : ''))}`;
            }

            const statusText = ar.status ? `${getEmoji('success')} ENABLED` : `${getEmoji('error')} DISABLED`;
            const statusLine = (l.statusLine || '• Status: **{status}**\n• Match Type: **{matchType}**')
                .replace('{status}', statusText)
                .replace('{matchType}', ar.matchType.toUpperCase());

            sections = [
                `### ${getEmoji('star')} ${l.statusHeader || 'Status & Matching'}\n${statusLine}`,
                `### ${getEmoji('world')} ${l.channelScopeHeader || 'Channel Scope'}\n${channelScope}`,
                `### ${getEmoji('document')} ${l.configuredResponseHeader || 'Configured Response'}\n${responsePreview}`
            ];

            const controlRow1 = new ActionRowBuilder().addComponents(
                btn(l.btnBackToList || 'Back to List', 'setup-autoresponders_btn_back', 'arrleft', ButtonStyle.Secondary),
                btn(
                    ar.status ? (l.btnDeactivate || 'Deactivate') : (l.btnActivate || 'Activate'),
                    'setup-autoresponders_btn_toggle_active',
                    ar.status ? 'warning' : 'sparkles',
                    ar.status ? ButtonStyle.Danger : ButtonStyle.Success
                ),
                btn(l.btnDeleteResponder || 'Delete Responder', 'setup-autoresponders_btn_delete', 'delete', ButtonStyle.Danger)
            );

            const controlRow2 = new ActionRowBuilder();
            if (ar.embedData) {
                controlRow2.addComponents(
                    btn(l.btnEditEmbed || 'Edit Embed Details', 'setup-autoresponders_btn_edit_embed', 'settings', ButtonStyle.Primary),
                    btn(l.btnEditMedia || 'Edit Embed Media', 'setup-autoresponders_btn_edit_media', 'sparkles', ButtonStyle.Primary),
                    btn(l.btnSwitchToText || 'Switch to Text Mode', 'setup-autoresponders_btn_toggle_embed', 'loop', ButtonStyle.Secondary)
                );
            } else {
                controlRow2.addComponents(
                    btn(l.btnEditText || 'Edit Text Response', 'setup-autoresponders_btn_edit_text', 'document', ButtonStyle.Primary),
                    btn(l.btnSwitchToEmbed || 'Switch to Embed Mode', 'setup-autoresponders_btn_toggle_embed', 'loop', ButtonStyle.Secondary)
                );
            }

            const optExactDesc = (l.optExactDesc || 'Triggers only when message is exactly the trigger.').trim().slice(0, 100) || undefined;
            const optPartialDesc = (l.optPartialDesc || 'Triggers if message contains trigger word/phrase.').trim().slice(0, 100) || undefined;
            const optWholeDesc = (l.optWholeDesc || 'Matches when a line is exactly the trimmed phrase.').trim().slice(0, 100) || undefined;

            const selectMatchTypeRow = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('setup-autoresponders_select_match_type')
                    .setPlaceholder((l.selectMatchTypePlaceholder || 'Set Match Type (Exact, Partial, Whole Line)').slice(0, 100))
                    .addOptions([
                        {
                            label: (l.optExactLabel || 'Exact Match').slice(0, 100),
                            value: 'exact',
                            description: optExactDesc,
                            emoji: getButtonEmoji('target'),
                            default: ar.matchType === 'exact'
                        },
                        {
                            label: (l.optPartialLabel || 'Partial Match').slice(0, 100),
                            value: 'partial',
                            description: optPartialDesc,
                            emoji: getButtonEmoji('sparkles'),
                            default: ar.matchType === 'partial'
                        },
                        {
                            label: (l.optWholeLabel || 'Whole Line Match').slice(0, 100),
                            value: 'whole',
                            description: optWholeDesc,
                            emoji: getButtonEmoji('list'),
                            default: ar.matchType === 'whole'
                        }
                    ])
            );

            const selectChannelsRow = new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder()
                    .setCustomId('setup-autoresponders_select_channels')
                    .setPlaceholder(l.selectChannelsPlaceholder || 'Set Specific Trigger Channels')
                    .setChannelTypes([ChannelType.GuildText, ChannelType.GuildAnnouncement])
                    .setMinValues(1)
                    .setMaxValues(10)
            );

            const allChannelsRow = new ActionRowBuilder().addComponents(
                btn(l.btnAllChannels || 'Set Scope to All Channels', 'setup-autoresponders_btn_all_channels', 'world', ButtonStyle.Secondary, ar.channels.includes('all'))
            );

            componentsList = [
                controlRow1,
                controlRow2,
                selectMatchTypeRow,
                selectChannelsRow,
                allChannelsRow
            ];
        }
    }

    if (state.mode === 'list') {
        const responders = await AutoResponder.find({ guildId }).catch(() => []) || [];
        title = (l.dashboardTitle || '{emoji} AutoResponders Config Dashboard').replace('{emoji}', getEmoji('list'));
        accentColor = 0x1E90FF;

        let respondersListText = '';
        if (responders.length > 0) {
            respondersListText = responders.map((ar, index) => {
                const status = ar.status ? `${getEmoji('success')} Active` : `${getEmoji('error')} Inactive`;
                const type = ar.embedData ? (l.typeEmbed || 'Embed') : (l.typeText || 'Text');
                const chans = ar.channels.includes('all') ? 'All' : `${ar.channels.length} chans`;
                return `**#${index + 1}. \`${ar.trigger}\`**\n• Status: ${status} | Type: **${type}** | Scope: **${chans}** | Match: **${ar.matchType}**`;
            }).join('\n\n');
        } else {
            respondersListText = l.noRespondersText || '*No AutoResponders configured yet. Click "Create AutoResponder" to start!*';
        }

        sections = [
            l.dashboardIntro || 'Configure automated trigger-based message replies. AutoResponders support partial/exact matches, custom text, rich embeds, and native channel filters.',
            `### ${getEmoji('list')} ${l.configuredHeader || 'Configured AutoResponders'}\n${respondersListText}`
        ];

        const actionsRow = new ActionRowBuilder();
        if (responders.length > 0) {
            const seenValues = new Set();
            const selectOpts = [];
            for (const ar of responders) {
                if (selectOpts.length >= 25) break;
                const rawTrigger = String(ar.trigger || '').trim();
                const value = (rawTrigger || String(ar._id)).slice(0, 100);
                if (seenValues.has(value)) continue;
                seenValues.add(value);
                const label = (rawTrigger || 'AutoResponder').slice(0, 100);
                const rawDesc = (l.selectResponderDesc || 'Configure responder: {trigger}')
                    .replace('{trigger}', rawTrigger);
                const description = rawDesc.trim().slice(0, 100) || undefined;
                selectOpts.push({
                    label,
                    description,
                    value,
                    emoji: getButtonEmoji('settings')
                });
            }

            const selectResponderRow = selectOpts.length > 0
                ? new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('setup-autoresponders_select_responder')
                        .setPlaceholder((l.selectResponderPlaceholder || 'Select an AutoResponder to configure').slice(0, 100))
                        .addOptions(selectOpts)
                )
                : null;

            actionsRow.addComponents(
                btn(l.btnCreate || 'Create AutoResponder', 'setup-autoresponders_btn_create', 'sparkles', ButtonStyle.Success),
                btn(l.btnHelpGuide || 'Help Guide', 'setup-autoresponders_btn_help', 'help', ButtonStyle.Secondary),
                btn(l.btnClose || 'Close', 'setup-autoresponders_btn_close', 'stop', ButtonStyle.Danger)
            );

            componentsList = selectResponderRow
                ? [selectResponderRow, actionsRow]
                : [actionsRow];
        } else {
            actionsRow.addComponents(
                btn(l.btnCreate || 'Create AutoResponder', 'setup-autoresponders_btn_create', 'sparkles', ButtonStyle.Success),
                btn(l.btnHelpGuide || 'Help Guide', 'setup-autoresponders_btn_help', 'help', ButtonStyle.Secondary),
                btn(l.btnClose || 'Close', 'setup-autoresponders_btn_close', 'stop', ButtonStyle.Danger)
            );

            componentsList = [
                actionsRow
            ];
        }
    }

    if (state.mode === 'help') {
        title = (l.guideTitle || '{emoji} AutoResponder Guide').replace('{emoji}', getEmoji('list'));
        accentColor = 0x9B59B6;

        sections = [
            `### ${getEmoji('list')} ${l.guideWalkthroughHeader || 'Workflow Walkthrough'}\n${l.guideWalkthroughText || '1. **Create responder**: Click **Create AutoResponder** and input trigger.\n2. **Configure Mode**: Switch between simple Text or Rich Embed response.\n3. **Set Channels**: Pick allowed channels using dropdown or lock to all channels.\n4. **Status**: Toggle **Activate** to enable the responder in your server!'}`,
            `### ${getEmoji('settings')} ${l.guideMatchHeader || 'Match Types'}\n${l.guideMatchText || '• **Exact Match**: Triggers only when message is exactly the trigger word.\n• **Partial Match**: Triggers if message contains trigger word.\n• **Whole Line**: Matches when the line contains the exact trimmed phrase.'}`
        ];

        const navRow = new ActionRowBuilder().addComponents(
            btn(l.btnBackToDashboard || 'Back to Dashboard', 'setup-autoresponders_btn_back', 'arrleft', ButtonStyle.Secondary),
            btn(l.btnClose || 'Close', 'setup-autoresponders_btn_close', 'stop', ButtonStyle.Danger)
        );

        componentsList = [navRow];
    }

    return [buildCard({
        title,
        sections,
        rows: componentsList,
        accentColor
    })];
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-autoresponders')
        .setDescription('Manage server autoresponders.')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('show')
                .setDescription('Show dashboard to manage autoresponders.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Set a new AutoResponder.')
                .addStringOption(option =>
                    option.setName('trigger')
                        .setDescription('The trigger word or phrase.')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('channels')
                        .setDescription('Channel(s) (comma-separated IDs or "all").')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('match')
                        .setDescription('Match type')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Exact Match', value: 'exact' },
                            { name: 'Partial Match', value: 'partial' },
                            { name: 'Whole Line Match', value: 'whole' }
                        ))
                .addBooleanOption(option =>
                    option.setName('status')
                        .setDescription('Enable or disable the AutoResponder.')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('text_response')
                        .setDescription('Non-embed response.')
                        .setRequired(false))),

    async handleComponent(interaction) {
        if (!interaction.customId?.startsWith('setup-autoresponders_')) return false;

        const modalSession = interaction.isModalSubmit() ? parseDashboardModalId(interaction.customId) : null;
        const messageId = modalSession?.messageId || interaction.message?.id;
        const clickerId = interaction.user.id;
        const client = interaction.client;
        const guild = interaction.guild;

        if (!guild) {
            return replyEphemeral(interaction, { content: `${getEmoji('cross')} Guild context missing.` });
        }
        if (!messageId) {
            return replyEphemeral(interaction, { content: `${getEmoji('warning')} This dashboard session has expired. Please open a new one.` });
        }

        const langLookup = await runWithinAcknowledgementWindow(
            interaction,
            () => loadLanguage(guild.id),
            'AutoResponder settings are taking too long to load. Please try again shortly.'
        );
        if (!langLookup.completed) return true;
        const lang = langLookup.value;
        const l = lang.setups?.autoresponders || {};

        if (interaction.customId === 'setup-autoresponders_btn_close') {
            const session = sessionManager.get(messageId);
            const ownerId = getDashboardSessionOwnerId(session);
            if (session && clickerId !== ownerId) {
                const ownerMention = ownerId ? `<@${ownerId}>` : 'another user';
                const belongsMsg = (l.sessionBelongsTo || '{emoji} This dashboard belongs to {userId}. Run `/setup-autoresponders` to open your own!')
                    .replace('{emoji}', getEmoji('cross'))
                    .replace('<@{userId}>', ownerMention)
                    .replace('{userId}', ownerMention);
                return replyEphemeral(interaction, { content: belongsMsg });
            }

            try { await interaction.deferUpdate(); } catch { return true; }
            sessionManager.delete(messageId);

            const closed = cards.warning(
                (l.dashboardClosedTitle || '{emoji} Dashboard Closed').replace('{emoji}', getEmoji('warning')),
                `${l.dashboardClosedDesc || 'This AutoResponder configuration dashboard has been closed.'}\n${(l.dashboardClosedReopen || '{emoji} Run `/setup-autoresponders` again to reopen it.').replace('{emoji}', getEmoji('settings'))}`
            );
            await interaction.message.edit({ components: [closed], flags: MessageFlags.IsComponentsV2 }).catch(() => { });
            setTimeout(() => {
                interaction.message.delete().catch(() => { });
            }, 2000);
            return true;
        }

        const session = sessionManager.get(messageId);
        if (!session) {
            const expiredMsg = (l.sessionExpiredNotice || '{emoji} Session expired or this panel has timed out. Run `/setup-autoresponders` again.').replace('{emoji}', getEmoji('warning'));
            return replyEphemeral(interaction, { content: expiredMsg });
        }

        const ownerId = getDashboardSessionOwnerId(session);
        if (clickerId !== ownerId) {
            const ownerMention = ownerId ? `<@${ownerId}>` : 'another user';
            const belongsMsg = (l.sessionBelongsTo || '{emoji} This dashboard belongs to {userId}. Run `/setup-autoresponders` to open your own!')
                .replace('{emoji}', getEmoji('cross'))
                .replace('<@{userId}>', ownerMention)
                .replace('{userId}', ownerMention);
            return replyEphemeral(interaction, { content: belongsMsg });
        }

        const customId = modalSession?.baseCustomId || interaction.customId;
        const state = session.state;

        
        if (customId === 'setup-autoresponders_btn_create') {
            const modal = new ModalBuilder()
                .setCustomId(createDashboardModalId('setup-autoresponders_modal_create', messageId))
                .setTitle(l.modalCreateTitle || 'Create AutoResponder');

            const triggerInput = new TextInputBuilder()
                .setCustomId('ar_trigger')
                .setLabel(l.lblTrigger || 'Trigger Word/Phrase')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder(l.placeholderTrigger || 'e.g. support')
                .setRequired(true)
                .setMaxLength(100);

            const responseInput = new TextInputBuilder()
                .setCustomId('ar_response')
                .setLabel(l.lblResponse || 'Response Text')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder(l.placeholderResponse || 'Type response here...')
                .setRequired(true)
                .setMaxLength(2000);

            modal.addComponents(
                new ActionRowBuilder().addComponents(triggerInput),
                new ActionRowBuilder().addComponents(responseInput)
            );
            await interaction.showModal(modal);
            return true;
        }

        if (customId === 'setup-autoresponders_btn_edit_text') {
            const lookup = await runWithinAcknowledgementWindow(
                interaction,
                () => AutoResponder.findOne({ guildId: guild.id, trigger: state.trigger }),
                'AutoResponder details are taking too long to load. Please try again shortly.'
            );
            if (!lookup.completed) return true;
            const ar = lookup.value;
            if (ar) {
                const modal = new ModalBuilder()
                    .setCustomId(createDashboardModalId('setup-autoresponders_modal_edit_text', messageId))
                    .setTitle(l.modalEditTextTitle || 'Edit Text Response');

                const responseInput = new TextInputBuilder()
                    .setCustomId('ar_response')
                    .setLabel(l.lblResponse || 'Response Text')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder(l.placeholderResponse || 'Type response here...')
                    .setValue(ar.textResponse || '')
                    .setRequired(true)
                    .setMaxLength(2000);

                modal.addComponents(new ActionRowBuilder().addComponents(responseInput));
                await interaction.showModal(modal);
            }
            return true;
        }

        if (customId === 'setup-autoresponders_btn_edit_embed') {
            const lookup = await runWithinAcknowledgementWindow(
                interaction,
                () => AutoResponder.findOne({ guildId: guild.id, trigger: state.trigger }),
                'AutoResponder details are taking too long to load. Please try again shortly.'
            );
            if (!lookup.completed) return true;
            const ar = lookup.value;
            if (ar) {
                const modal = new ModalBuilder()
                    .setCustomId(createDashboardModalId('setup-autoresponders_modal_edit_embed', messageId))
                    .setTitle(l.modalEditEmbedTitle || 'Edit Embed Details');

                const titleInput = new TextInputBuilder()
                    .setCustomId('embed_title')
                    .setLabel(l.lblEmbedTitle || 'Embed Title')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder(l.lblEmbedTitle || 'Embed Title')
                    .setValue(ar.embedData?.title || '')
                    .setRequired(true)
                    .setMaxLength(256);

                const descInput = new TextInputBuilder()
                    .setCustomId('embed_desc')
                    .setLabel(l.lblEmbedDesc || 'Embed Description')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder(l.placeholderEmbedDesc || 'Embed body description text...')
                    .setValue(ar.embedData?.description || '')
                    .setRequired(true)
                    .setMaxLength(2000);

                const colorInput = new TextInputBuilder()
                    .setCustomId('embed_color')
                    .setLabel(l.lblEmbedColor || 'Hex Color')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder(l.placeholderEmbedColor || 'e.g. #FF00FF')
                    .setValue(ar.embedData?.color || '')
                    .setRequired(false)
                    .setMaxLength(7);

                const footerInput = new TextInputBuilder()
                    .setCustomId('embed_footer')
                    .setLabel(l.lblEmbedFooter || 'Footer Text')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder(l.placeholderEmbedFooter || 'Footer text')
                    .setValue(ar.embedData?.footer?.text || '')
                    .setRequired(false)
                    .setMaxLength(256);

                const fieldsInput = new TextInputBuilder()
                    .setCustomId('embed_fields')
                    .setLabel(l.lblEmbedFields || 'Fields JSON Array (min 2, max 25)')
                    .setStyle(TextInputStyle.Paragraph)
                    .setPlaceholder(l.placeholderEmbedFields || '[{"name":"Info","value":"details","inline":true}]')
                    .setValue(ar.embedData?.fields ? JSON.stringify(ar.embedData.fields) : '')
                    .setRequired(false);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(titleInput),
                    new ActionRowBuilder().addComponents(descInput),
                    new ActionRowBuilder().addComponents(colorInput),
                    new ActionRowBuilder().addComponents(footerInput),
                    new ActionRowBuilder().addComponents(fieldsInput)
                );
                await interaction.showModal(modal);
            }
            return true;
        }

        if (customId === 'setup-autoresponders_btn_edit_media') {
            const lookup = await runWithinAcknowledgementWindow(
                interaction,
                () => AutoResponder.findOne({ guildId: guild.id, trigger: state.trigger }),
                'AutoResponder details are taking too long to load. Please try again shortly.'
            );
            if (!lookup.completed) return true;
            const ar = lookup.value;
            if (ar) {
                const modal = new ModalBuilder()
                    .setCustomId(createDashboardModalId('setup-autoresponders_modal_edit_media', messageId))
                    .setTitle(l.modalEditMediaTitle || 'Edit Embed Media & Author');

                const authorNameInput = new TextInputBuilder()
                    .setCustomId('author_name')
                    .setLabel(l.lblAuthorNameField || 'Author Name')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder(l.placeholderAuthorName || 'Author name display text')
                    .setValue(ar.embedData?.author?.name || '')
                    .setRequired(false)
                    .setMaxLength(256);

                const authorUrlInput = new TextInputBuilder()
                    .setCustomId('author_url')
                    .setLabel(l.lblAuthorUrlField || 'Author Link URL')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder(l.placeholderAuthorUrl || 'https://example.com')
                    .setValue(ar.embedData?.author?.url || '')
                    .setRequired(false);

                const authorIconInput = new TextInputBuilder()
                    .setCustomId('author_icon')
                    .setLabel(l.lblAuthorIconField || 'Author Icon URL')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder(l.placeholderAuthorIcon || 'https://example.com/icon.png')
                    .setValue(ar.embedData?.author?.iconURL || '')
                    .setRequired(false);

                const imageInput = new TextInputBuilder()
                    .setCustomId('embed_image')
                    .setLabel(l.lblImageField || 'Image URL')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder(l.placeholderImage || 'https://example.com/image.png')
                    .setValue(ar.embedData?.image || '')
                    .setRequired(false);

                const thumbnailInput = new TextInputBuilder()
                    .setCustomId('embed_thumbnail')
                    .setLabel(l.lblThumbnailField || 'Thumbnail URL')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder(l.placeholderThumbnail || 'https://example.com/thumbnail.png')
                    .setValue(ar.embedData?.thumbnail || '')
                    .setRequired(false);

                modal.addComponents(
                    new ActionRowBuilder().addComponents(authorNameInput),
                    new ActionRowBuilder().addComponents(authorUrlInput),
                    new ActionRowBuilder().addComponents(authorIconInput),
                    new ActionRowBuilder().addComponents(imageInput),
                    new ActionRowBuilder().addComponents(thumbnailInput)
                );
                await interaction.showModal(modal);
            }
            return true;
        }

        
        if (interaction.isModalSubmit()) {
            try { await interaction.deferUpdate(); } catch { return true; }
            sessionManager.touch(messageId);

            if (customId === 'setup-autoresponders_modal_create') {
                const trigger = interaction.fields.getTextInputValue('ar_trigger').toLowerCase().trim();
                const response = interaction.fields.getTextInputValue('ar_response');

                if (!trigger) {
                    const errText = (l.valTriggerEmpty || '{emoji} **Validation Error:** Trigger cannot be empty.').replace('{emoji}', getEmoji('cross'));
                    return replyEphemeral(interaction, { content: errText });
                }
                if (trigger.length > 100) {
                    const errText = (l.valTriggerMax || '{emoji} **Validation Error:** Trigger must be 100 characters or fewer.').replace('{emoji}', getEmoji('cross'));
                    return replyEphemeral(interaction, { content: errText });
                }
                if (!response || response.trim().length === 0) {
                    const errText = (l.valResponseEmpty || '{emoji} **Validation Error:** Response cannot be empty.').replace('{emoji}', getEmoji('cross'));
                    return replyEphemeral(interaction, { content: errText });
                }
                if (response.length > 2000) {
                    const errText = (l.valResponseMax || '{emoji} **Validation Error:** Response must be 2000 characters or fewer.').replace('{emoji}', getEmoji('cross'));
                    return replyEphemeral(interaction, { content: errText });
                }

                
                const badWords = require('bad-words');
                const Filter = badWords.Filter || badWords;
                const filter = new Filter();
                if (filter.isProfane(trigger)) {
                    const errCard = cards.error(
                        l.inappropriateTriggerTitle || 'Inappropriate Trigger',
                        l.inappropriateTriggerDesc || 'Profanity is not allowed in triggers.'
                    );
                    return replyEphemeral(interaction, { components: [errCard] });
                }

                const existing = await AutoResponder.findOne({ guildId: guild.id, trigger });
                if (!existing) {
                    const newAr = new AutoResponder({
                        userId: clickerId,
                        guildId: guild.id,
                        trigger,
                        matchType: 'exact',
                        channels: ['all'],
                        textResponse: response,
                        embedData: null,
                        status: false
                    });
                    await newAr.save();
                    invalidateAutoResponders(guild.id);
                    state.mode = 'view';
                    state.trigger = trigger;
                } else {
                    const existsMsg = (l.alreadyExists || '{emoji} AutoResponder with trigger `{trigger}` already exists.')
                        .replace('{emoji}', getEmoji('cross'))
                        .replace('{trigger}', trigger);
                    return replyEphemeral(interaction, { content: existsMsg });
                }
            } else if (customId === 'setup-autoresponders_modal_edit_text') {
                const response = interaction.fields.getTextInputValue('ar_response');
                if (!response || response.trim().length === 0) {
                    const errText = (l.valResponseEmpty || '{emoji} **Validation Error:** Response cannot be empty.').replace('{emoji}', getEmoji('cross'));
                    return replyEphemeral(interaction, { content: errText });
                }
                if (response.length > 2000) {
                    const errText = (l.valResponseMax || '{emoji} **Validation Error:** Response must be 2000 characters or fewer.').replace('{emoji}', getEmoji('cross'));
                    return replyEphemeral(interaction, { content: errText });
                }
                await AutoResponder.findOneAndUpdate(
                    { guildId: guild.id, trigger: state.trigger },
                    { textResponse: response, embedData: null }
                );
                invalidateAutoResponders(guild.id);
            } else if (customId === 'setup-autoresponders_modal_edit_embed') {
                const title = interaction.fields.getTextInputValue('embed_title')?.trim();
                const description = interaction.fields.getTextInputValue('embed_desc')?.trim();
                const color = interaction.fields.getTextInputValue('embed_color')?.trim() || '#FF00FF';
                const footer = interaction.fields.getTextInputValue('embed_footer')?.trim();
                const fieldsJson = interaction.fields.getTextInputValue('embed_fields')?.trim();

                if (!title) {
                    const errText = (l.valTitleEmpty || '{emoji} **Validation Error:** Title is required.').replace('{emoji}', getEmoji('cross'));
                    return replyEphemeral(interaction, { content: errText });
                }
                if (title.length > 256) {
                    const errText = (l.valTitleMax || '{emoji} **Validation Error:** Title cannot exceed 256 characters.').replace('{emoji}', getEmoji('cross'));
                    return replyEphemeral(interaction, { content: errText });
                }
                if (!description) {
                    const errText = (l.valDescEmpty || '{emoji} **Validation Error:** Description is required.').replace('{emoji}', getEmoji('cross'));
                    return replyEphemeral(interaction, { content: errText });
                }
                if (description.length > 2000) {
                    const errText = (l.valDescMax || '{emoji} **Validation Error:** Description cannot exceed 2000 characters.').replace('{emoji}', getEmoji('cross'));
                    return replyEphemeral(interaction, { content: errText });
                }

                if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) {
                    const errText = (l.valColorInvalid || '{emoji} **Validation Error:** Color must be a valid hex color starting with \'#\' (e.g. #FF00FF).').replace('{emoji}', getEmoji('cross'));
                    return replyEphemeral(interaction, { content: errText });
                }

                if (footer && footer.length > 2048) {
                    const errText = (l.valFooterMax || '{emoji} **Validation Error:** Footer text cannot exceed 2048 characters.').replace('{emoji}', getEmoji('cross'));
                    return replyEphemeral(interaction, { content: errText });
                }

                let fields = [];
                if (fieldsJson) {
                    try {
                        const parsed = JSON.parse(fieldsJson);
                        if (!Array.isArray(parsed)) {
                            const errText = (l.valFieldsArray || '{emoji} **Validation Error:** Fields JSON must be a JSON array.').replace('{emoji}', getEmoji('cross'));
                            return replyEphemeral(interaction, { content: errText });
                        }
                        if (parsed.length < 2 || parsed.length > 25) {
                            const errText = (l.valFieldsCount || '{emoji} **Validation Error:** Embed fields must contain between 2 and 25 items.').replace('{emoji}', getEmoji('cross'));
                            return replyEphemeral(interaction, { content: errText });
                        }
                        for (let i = 0; i < parsed.length; i++) {
                            const f = parsed[i];
                            if (!f.name || typeof f.name !== 'string' || f.name.trim().length === 0) {
                                const errText = (l.valFieldNameRequired || '{emoji} **Validation Error:** Field #{num} must have a non-empty string \'name\'.')
                                    .replace('{emoji}', getEmoji('cross'))
                                    .replace('{num}', String(i + 1));
                                return replyEphemeral(interaction, { content: errText });
                            }
                            if (f.name.length > 256) {
                                const errText = (l.valFieldNameMax || '{emoji} **Validation Error:** Field #{num} name cannot exceed 256 characters.')
                                    .replace('{emoji}', getEmoji('cross'))
                                    .replace('{num}', String(i + 1));
                                return replyEphemeral(interaction, { content: errText });
                            }
                            if (!f.value || typeof f.value !== 'string' || f.value.trim().length === 0) {
                                const errText = (l.valFieldValueRequired || '{emoji} **Validation Error:** Field #{num} must have a non-empty string \'value\'.')
                                    .replace('{emoji}', getEmoji('cross'))
                                    .replace('{num}', String(i + 1));
                                return replyEphemeral(interaction, { content: errText });
                            }
                            if (f.value.length > 1024) {
                                const errText = (l.valFieldValueMax || '{emoji} **Validation Error:** Field #{num} value cannot exceed 1024 characters.')
                                    .replace('{emoji}', getEmoji('cross'))
                                    .replace('{num}', String(i + 1));
                                return replyEphemeral(interaction, { content: errText });
                            }
                            fields.push({
                                name: f.name.trim(),
                                value: f.value.trim(),
                                inline: Boolean(f.inline)
                            });
                        }
                    } catch (e) {
                        const errText = (l.valFieldsInvalidJson || '{emoji} **Validation Error:** Invalid JSON format for fields. Error: {error}')
                            .replace('{emoji}', getEmoji('cross'))
                            .replace('{error}', e.message);
                        return replyEphemeral(interaction, { content: errText });
                    }
                }

                
                const ar = await AutoResponder.findOne({ guildId: guild.id, trigger: state.trigger });
                if (ar) {
                    const authorName = ar.embedData?.author?.name || '';
                    const totalEmbedLength = getEmbedTextLength(title, description, footer, fields, authorName);
                    if (totalEmbedLength > 6000) {
                        const errText = (l.valEmbedLengthExceeded || '{emoji} **Validation Error:** Total embed characters ({length}) exceeds the Discord limit of 6000.')
                            .replace('{emoji}', getEmoji('cross'))
                            .replace('{length}', String(totalEmbedLength));
                        return replyEphemeral(interaction, { content: errText });
                    }

                    ar.textResponse = null;
                    if (!ar.embedData) {
                        ar.embedData = { title, description };
                    }
                    ar.embedData.title = title;
                    ar.embedData.description = description;
                    ar.embedData.color = color;
                    ar.embedData.footer = footer ? { text: footer } : undefined;
                    ar.embedData.fields = fields.length >= 2 ? fields : undefined;
                    await ar.save();
                    invalidateAutoResponders(guild.id);
                }
            } else if (customId === 'setup-autoresponders_modal_edit_media') {
                const authorName = interaction.fields.getTextInputValue('author_name')?.trim() || '';
                const authorUrl = interaction.fields.getTextInputValue('author_url')?.trim() || '';
                const authorIcon = interaction.fields.getTextInputValue('author_icon')?.trim() || '';
                const image = interaction.fields.getTextInputValue('embed_image')?.trim() || '';
                const thumbnail = interaction.fields.getTextInputValue('embed_thumbnail')?.trim() || '';

                if (authorName && authorName.length > 256) {
                    const errText = (l.valAuthorNameMax || '{emoji} **Validation Error:** Author Name cannot exceed 256 characters.').replace('{emoji}', getEmoji('cross'));
                    return replyEphemeral(interaction, { content: errText });
                }

                if (authorUrl && !isValidUrl(authorUrl)) {
                    const errText = (l.valAuthorUrlInvalid || '{emoji} **Validation Error:** Author Link URL must start with http:// or https://.').replace('{emoji}', getEmoji('cross'));
                    return replyEphemeral(interaction, { content: errText });
                }

                if (authorIcon && !isValidUrl(authorIcon)) {
                    const errText = (l.valAuthorIconInvalid || '{emoji} **Validation Error:** Author Icon URL must start with http:// or https://.').replace('{emoji}', getEmoji('cross'));
                    return replyEphemeral(interaction, { content: errText });
                }

                if (image && !isValidUrl(image)) {
                    const errText = (l.valImageUrlInvalid || '{emoji} **Validation Error:** Image URL must start with http:// or https://.').replace('{emoji}', getEmoji('cross'));
                    return replyEphemeral(interaction, { content: errText });
                }

                if (thumbnail && !isValidUrl(thumbnail)) {
                    const errText = (l.valThumbnailUrlInvalid || '{emoji} **Validation Error:** Thumbnail URL must start with http:// or https://.').replace('{emoji}', getEmoji('cross'));
                    return replyEphemeral(interaction, { content: errText });
                }

                if ((authorUrl || authorIcon) && !authorName) {
                    const errText = (l.valAuthorNameRequired || '{emoji} **Validation Error:** Author Link URL or Icon URL is set, but Author Name is empty. Please set an Author Name.').replace('{emoji}', getEmoji('cross'));
                    return replyEphemeral(interaction, { content: errText });
                }

                const ar = await AutoResponder.findOne({ guildId: guild.id, trigger: state.trigger });
                if (ar && ar.embedData) {
                    const fields = ar.embedData.fields || [];
                    const totalEmbedLength = getEmbedTextLength(
                        ar.embedData.title,
                        ar.embedData.description,
                        ar.embedData.footer?.text,
                        fields,
                        authorName
                    );

                    if (totalEmbedLength > 6000) {
                        const errText = (l.valEmbedLengthExceeded || '{emoji} **Validation Error:** Total embed characters ({length}) exceeds the Discord limit of 6000.')
                            .replace('{emoji}', getEmoji('cross'))
                            .replace('{length}', String(totalEmbedLength));
                        return replyEphemeral(interaction, { content: errText });
                    }

                    ar.embedData.author = (authorName || authorUrl || authorIcon) ? {
                        name: authorName || undefined,
                        url: authorUrl || undefined,
                        iconURL: authorIcon || undefined
                    } : undefined;
                    ar.embedData.image = image || undefined;
                    ar.embedData.thumbnail = thumbnail || undefined;

                    await ar.save();
                    invalidateAutoResponders(guild.id);
                }
            }

            try {
                const components = await renderState(client, guild, state, lang);
                const dashboardMessage = await resolveDashboardMessage(interaction, session, messageId);
                if (dashboardMessage) await dashboardMessage.edit({ components, flags: MessageFlags.IsComponentsV2 });
            } catch (err) {
                console.error('[SetupAutoResponders Modal Submit Error]:', err.message);
                await interaction.followUp({
                    content: 'Your AutoResponder change was saved, but the dashboard could not refresh. Reopen the setup panel to see the latest state.',
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
            }
            return true;
        }

        
        try { await interaction.deferUpdate(); } catch { return true; }
        sessionManager.touch(messageId);

        if (customId === 'setup-autoresponders_btn_back') {
            state.mode = 'list';
            state.trigger = null;
        } else if (customId === 'setup-autoresponders_btn_help') {
            state.mode = 'help';
        } else if (customId === 'setup-autoresponders_select_responder') {
            state.mode = 'view';
            state.trigger = interaction.values[0];
        } else if (customId === 'setup-autoresponders_btn_toggle_active') {
            const ar = await AutoResponder.findOne({ guildId: guild.id, trigger: state.trigger });
            if (ar) {
                ar.status = !ar.status;
                await ar.save();
                invalidateAutoResponders(guild.id);
            }
        } else if (customId === 'setup-autoresponders_btn_delete') {
            await AutoResponder.findOneAndDelete({ guildId: guild.id, trigger: state.trigger });
            invalidateAutoResponders(guild.id);
            state.mode = 'list';
            state.trigger = null;
        } else if (customId === 'setup-autoresponders_btn_toggle_embed') {
            const ar = await AutoResponder.findOne({ guildId: guild.id, trigger: state.trigger });
            if (ar) {
                if (ar.embedData) {
                    
                    ar.textResponse = l.defaultTextResponse || 'Triggered AutoResponder!';
                    ar.embedData = null;
                } else {
                    
                    ar.textResponse = null;
                    ar.embedData = {
                        title: l.defaultEmbedTitle || 'AutoResponder Alert',
                        description: l.defaultEmbedDesc || 'This is an automatic reply embed.',
                        color: '#0099FF',
                        fields: [
                            { name: l.defaultFieldTrigger || 'Trigger Word', value: `\`${ar.trigger}\``, inline: true },
                            { name: l.defaultFieldStatus || 'System Status', value: l.defaultStatusActive || 'Active', inline: true }
                        ]
                    };
                }
                await ar.save();
                invalidateAutoResponders(guild.id);
            }
        } else if (customId === 'setup-autoresponders_select_match_type') {
            const matchType = interaction.values[0];
            await AutoResponder.findOneAndUpdate(
                { guildId: guild.id, trigger: state.trigger },
                { matchType }
            );
            invalidateAutoResponders(guild.id);
        } else if (customId === 'setup-autoresponders_select_channels') {
            const vals = interaction.values;
            await AutoResponder.findOneAndUpdate(
                { guildId: guild.id, trigger: state.trigger },
                { channels: vals }
            );
            invalidateAutoResponders(guild.id);
        } else if (customId === 'setup-autoresponders_btn_all_channels') {
            await AutoResponder.findOneAndUpdate(
                { guildId: guild.id, trigger: state.trigger },
                { channels: ['all'] }
            );
            invalidateAutoResponders(guild.id);
        }

        try {
            const components = await renderState(client, guild, state, lang);
            await interaction.message.edit({ components, flags: MessageFlags.IsComponentsV2 });
        } catch (err) {
            console.error('[SetupAutoResponders Component Interaction Error]:', err.message);
        }

        return true;
    },

    async execute(interaction, client = interaction.client) {
        const guild = interaction.guild;
        const isSlash = Boolean(interaction.isChatInputCommand?.());
        try {
            if (isSlash && !interaction.deferred && !interaction.replied) {
                await interaction.deferReply();
            }
        } catch (err) {
            console.error('[SetupAutoResponders] deferReply failed:', err.message);
            return;
        }

        const lang = await loadLanguage(guild?.id);
        const l = lang.setups?.autoresponders || {};

        if (!guild) {
            const errorContainer = cards.error(
                l.serverRequiredTitle || 'Server Required',
                l.serverRequiredDesc || 'This command must be executed inside a guild.'
            );
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
            trigger: null,
            interaction
        };

        try {
            if (subcommand === 'set') {
                const trigger = isSlash ? interaction.options.getString('trigger').toLowerCase().trim() : '';
                const chansStr = isSlash ? interaction.options.getString('channels') : '';
                const matchType = isSlash ? interaction.options.getString('match') : 'exact';
                const status = isSlash ? interaction.options.getBoolean('status') : true;
                const textResponse = isSlash ? interaction.options.getString('text_response') : (l.defaultTextResponse || 'Triggered!');

                if (trigger) {
                    const badWords = require('bad-words');
                    const Filter = badWords.Filter || badWords;
                    const filter = new Filter();
                    if (filter.isProfane(trigger)) {
                        const err = cards.error(
                            l.inappropriateTriggerTitle || 'Inappropriate Trigger',
                            l.inappropriateTriggerDesc || 'Profanity is not allowed in triggers.'
                        );
                        const payload = { components: [err], flags: MessageFlags.IsComponentsV2 };
                        if (isSlash) await interaction.editReply(payload);
                        else await interaction.reply(payload);
                        return;
                    }

                    const channels = (chansStr === 'all')
                        ? ['all']
                        : chansStr.split(',').map(id => id.trim()).filter(Boolean);

                    
                    if (channels[0] !== 'all') {
                        const invalidChannels = channels.filter(id => !guild.channels.cache.has(id));
                        if (invalidChannels.length > 0) {
                            const desc = (l.invalidChannelsDesc || 'The following channel IDs do not exist: `{channels}`')
                                .replace('{channels}', invalidChannels.join('`, `'));
                            const err = cards.warning(
                                (l.invalidChannelsTitle || '{emoji} Invalid Channels').replace('{emoji}', getEmoji('warning')),
                                desc
                            );
                            const payload = { components: [err], flags: MessageFlags.IsComponentsV2 };
                            if (isSlash) await interaction.editReply(payload);
                            else await interaction.reply(payload);
                            return;
                        }
                    }

                    await AutoResponder.findOneAndUpdate(
                        { guildId: guild.id, trigger },
                        {
                            userId: state.userId,
                            matchType,
                            channels,
                            status,
                            textResponse,
                            embedData: null
                        },
                        { upsert: true }
                    );
                    invalidateAutoResponders(guild.id);
                    state.mode = 'view';
                    state.trigger = trigger;
                }
            } else if (subcommand === 'delete') {
                const index = isSlash ? interaction.options.getInteger('index') - 1 : -1;
                const userResponders = await AutoResponder.find({ userId: state.userId, guildId: guild.id });
                if (userResponders[index]) {
                    await AutoResponder.deleteOne({ _id: userResponders[index]._id });
                    invalidateAutoResponders(guild.id);
                }
            } else if (subcommand === 'view') {
                state.mode = 'list';
            }
        } catch (err) {
            console.error('[SetupAutoResponders execute error]:', err.message);
        }

        try {
            const components = await renderState(client, guild, state, lang);
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
            console.error('[SetupAutoResponders Initial Render Error]:', err.errors || err.message, err.stack);
            const errCard = cards.error(
                l.errorTitle || 'AutoResponders Error',
                l.loadFailed || 'Failed to load the AutoResponders setup dashboard.'
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
