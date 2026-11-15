

'use strict';

const { SlashCommandBuilder } = require('@discordjs/builders');
const {
    ActionRowBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    AttachmentBuilder,
    MessageFlags,
} = require('discord.js');
const qr = require('qrcode');
const rawLang = require('../../events/loadLanguage');
const { getEmoji, getButtonEmoji } = require('../../UI/emojis/emoji');
const { createDashboardModalId, parseDashboardModalId, resolveDashboardMessage } = require('../../utils/dashboardModalSession');
const {
    createSessionManager,
    buildCard,
    cards,
    btn,
    closeBtn,
    deferUpdate,
    deferReply,
    sendV2,
    editV2,
    closeAndAutoDelete,
    replyUnauthorized,
    replyEphemeral,
    ACCENT, createInterpolatableProxy, card
} = require('../../UI');

const lang = { ...rawLang, qr: createInterpolatableProxy(rawLang.qr) };

const COLOR_PRESETS = {
    classic: { dark: '#000000FF', light: '#FFFFFFFF', accent: 0x000000 },
    ocean: { dark: '#0066CCFF', light: '#E6F3FFFF', accent: 0x0066CC },
    forest: { dark: '#2E7D32FF', light: '#E8F5E8FF', accent: 0x2E7D32 },
    royal: { dark: '#6A1B9AFF', light: '#F3E5F5FF', accent: 0x6A1B9A },
    fire: { dark: '#D32F2FFF', light: '#FFEBEEFF', accent: 0xD32F2F },
    gold: { dark: '#F57C00FF', light: '#FFF8E1FF', accent: 0xF57C00 },
    pink: { dark: '#E91E63FF', light: '#FCE4ECFF', accent: 0xE91E63 },
    minimal: { dark: '#424242FF', light: '#FFFFFFFF', accent: 0x424242 }
};

const SIZE_PRESETS = {
    small: 300,
    medium: 500,
    large: 800,
    xlarge: 1200
};

const sessions = createSessionManager({
    ttlMs: 10 * 60 * 1000,
    buildExpiredCard: () => cards.error(
        lang.qr.panel.expiredTitle({ emoji: getEmoji('warning') }),
        lang.qr.panel.expiredDesc
    ),
});

async function generateQRBuffer(text, style, size, errorCorrection) {
    const colors = COLOR_PRESETS[style] || COLOR_PRESETS.classic;
    const qrOptions = {
        width: SIZE_PRESETS[size] || 500,
        margin: 2,
        color: {
            dark: colors.dark,
            light: colors.light
        },
        errorCorrectionLevel: errorCorrection
    };
    return qr.toBuffer(text, qrOptions);
}

function tabsRow(active) {
    const s = m => active === m ? ButtonStyle.Danger : ButtonStyle.Secondary;
    return new ActionRowBuilder().addComponents(
        btn(lang.qr.nav.overview, 'qr_tab_overview', 'home', s('overview')),
        btn(lang.qr.nav.colorPreset, 'qr_tab_style', 'sparkles', s('style')),
        btn(lang.qr.nav.resolutionQuality, 'qr_tab_settings', 'settings', s('settings'))
    );
}

function quickPresetSelectRow(current) {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('qr_sel_style').setPlaceholder(lang.qr.select.stylePlaceholder).addOptions(
            Object.entries(COLOR_PRESETS).map(([key]) => ({
                label: lang.qr.presets[key] || key,
                value: key,
                emoji: getButtonEmoji('sparkles'),
                default: key === current
            }))
        )
    );
}

function sizeSelectRow(current) {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('qr_sel_size').setPlaceholder(lang.qr.select.sizePlaceholder).addOptions([
            { label: lang.qr.select.sizeSmall, value: 'small', default: current === 'small' },
            { label: lang.qr.select.sizeMedium, value: 'medium', default: current === 'medium' },
            { label: lang.qr.select.sizeLarge, value: 'large', default: current === 'large' },
            { label: lang.qr.select.sizeXLarge, value: 'xlarge', default: current === 'xlarge' }
        ])
    );
}

function errorCorrectionSelectRow(current) {
    return new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('qr_sel_ecc').setPlaceholder(lang.qr.select.eccPlaceholder).addOptions([
            { label: lang.qr.select.eccLow, value: 'L', default: current === 'L' },
            { label: lang.qr.select.eccMedium, value: 'M', default: current === 'M' },
            { label: lang.qr.select.eccQuartile, value: 'Q', default: current === 'Q' },
            { label: lang.qr.select.eccHigh, value: 'H', default: current === 'H' }
        ])
    );
}

function overviewControlsRow() {
    return new ActionRowBuilder().addComponents(
        btn(lang.qr.nav.editText, 'qr_btn_change_text', 'document', ButtonStyle.Success),
        btn(lang.qr.nav.regenerateImage, 'qr_btn_regenerate', 'loop', ButtonStyle.Primary),
        closeBtn(lang.qr.nav.closePanel, 'qr_close')
    );
}

function viewOverview(state) {
    const preset = COLOR_PRESETS[state.style] || COLOR_PRESETS.classic;
    const styleName = lang.qr.presets[state.style] || state.style;
    const eccMap = {
        L: lang.qr.ecc.L,
        M: lang.qr.ecc.M,
        Q: lang.qr.ecc.Q,
        H: lang.qr.ecc.H,
    };
    const sizeVal = SIZE_PRESETS[state.size];

    const sec1 = `### ${lang.qr.panel.detailsHeading({ emoji: getEmoji('security') })}\n${lang.qr.panel.detailsContent({
        text: String(state.text || '').slice(0, 100),
        style: styleName,
        size: sizeVal,
        ecc: eccMap[state.errorCorrection] || state.errorCorrection
    })}`;

    const sec2 = `### ${lang.qr.panel.tipsHeading({ emoji: getEmoji('info') })}\n${lang.qr.panel.tipsContent}`;

    return buildCard({
        title: lang.qr.panel.overviewTitle,
        bannerURL: 'attachment://qrcode.png',
        sections: [sec1, sec2],
        rows: [tabsRow('overview'), overviewControlsRow()],
        accentColor: preset.accent,
    });
}

function viewStyle(state) {
    const preset = COLOR_PRESETS[state.style] || COLOR_PRESETS.classic;
    return card(
        lang.qr.panel.styleTitle,
        [
            `### ${lang.qr.panel.stylePresetHeading({ emoji: getEmoji('sparkles') })}`,
            lang.qr.panel.stylePresetDesc,
        ],
        [
            tabsRow('style'),
            quickPresetSelectRow(state.style),
            new ActionRowBuilder().addComponents(closeBtn(lang.qr.nav.closePanel, 'qr_close'))
        ],
        preset.accent
    );
}

function viewSettings(state) {
    const preset = COLOR_PRESETS[state.style] || COLOR_PRESETS.classic;
    return card(
        lang.qr.panel.settingsTitle,
        [
            `### ${lang.qr.panel.settingsSizeHeading}`,
            `### ${lang.qr.panel.settingsEccHeading}`,
        ],
        [
            tabsRow('settings'),
            sizeSelectRow(state.size),
            errorCorrectionSelectRow(state.errorCorrection),
            new ActionRowBuilder().addComponents(closeBtn(lang.qr.nav.closePanel, 'qr_close'))
        ],
        preset.accent
    );
}

function renderState(state) {
    switch (state.mode) {
        case 'style': return [viewStyle(state)];
        case 'settings': return [viewSettings(state)];
        default: return [viewOverview(state)];
    }
}

function applyInteraction(customId, values, state) {
    
    if (customId === 'qr_tab_overview') return Object.assign(state, { mode: 'overview' });
    if (customId === 'qr_tab_style') return Object.assign(state, { mode: 'style' });
    if (customId === 'qr_tab_settings') return Object.assign(state, { mode: 'settings' });

    
    if (customId === 'qr_sel_style') {
        state.style = String(values[0] || 'classic');
        return;
    }
    if (customId === 'qr_sel_size') {
        state.size = String(values[0] || 'medium');
        return;
    }
    if (customId === 'qr_sel_ecc') {
        state.errorCorrection = String(values[0] || 'M');
        return;
    }
}

async function handleComponent(interaction) {
    if (!interaction.customId?.startsWith('qr_')) return false;

    const modalSession = interaction.isModalSubmit() ? parseDashboardModalId(interaction.customId) : null;
    const messageId = modalSession?.messageId || interaction.message?.id;
    if (!messageId) {
        await replyEphemeral(interaction, lang.qr.session.expired({ emoji: getEmoji('warning') }));
        return true;
    }
    const clickerId = interaction.user.id;

    
    if (interaction.customId === 'qr_close') {
        const session = sessions.get(messageId);
        if (session && clickerId !== session.state.userId) {
            await replyUnauthorized(interaction, lang.qr.session.unauthorized({ emoji: getEmoji('cross'), userId: session.state.userId }));
            return true;
        }

        await deferUpdate(interaction);
        sessions.delete(messageId);

        const closed = cards.info(
            lang.qr.panel.closedTitle({ emoji: getEmoji('warning') }),
            lang.qr.panel.closedDesc
        );
        await closeAndAutoDelete(interaction, closed, 2000);
        return true;
    }

    const session = sessions.get(messageId);
    if (!session) {
        await replyEphemeral(interaction, lang.qr.session.expired({ emoji: getEmoji('warning') }));
        return true;
    }

    if (clickerId !== session.state.userId) {
        await replyUnauthorized(interaction, lang.qr.session.unauthorized({ emoji: getEmoji('cross'), userId: session.state.userId }));
        return true;
    }

    
    const customId = modalSession?.baseCustomId || interaction.customId;
    if (customId === 'qr_btn_change_text') {
        const modal = new ModalBuilder()
            .setCustomId(createDashboardModalId('qr_modal_text', messageId))
            .setTitle(lang.qr.modal.title)
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('qr_input_text')
                        .setLabel(lang.qr.modal.label)
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(true)
                        .setMaxLength(2000)
                        .setValue(session.state.text)
                )
            );
        await interaction.showModal(modal).catch(() => { });
        return true;
    }

    
    if (interaction.isModalSubmit() && customId === 'qr_modal_text') {
        await deferUpdate(interaction);
        sessions.touch(interaction.client, interaction.channelId, messageId);
        const dashboardMessage = await resolveDashboardMessage(interaction, session, messageId);

        const newText = interaction.fields.getTextInputValue('qr_input_text');
        session.state.text = newText || session.state.text;
        if (!dashboardMessage) {
            await interaction.followUp({
                content: 'The QR dashboard is no longer available. Open a new QR code panel and try again.',
                flags: MessageFlags.Ephemeral
            }).catch(() => { });
            return true;
        }

        try {
            const buffer = await generateQRBuffer(session.state.text, session.state.style, session.state.size, session.state.errorCorrection);
            const attachment = new AttachmentBuilder(buffer, { name: 'qrcode.png' });
            const components = renderState(session.state);
            if (dashboardMessage) await editV2(dashboardMessage, { components, files: [attachment] });
        } catch (err) {
            console.error('[QR] Edit text submit error:', err);
            await interaction.followUp({
                content: 'The QR code could not be updated. Please try again.',
                flags: MessageFlags.Ephemeral
            }).catch(() => { });
        }
        return true;
    }

    
    await deferUpdate(interaction);
    sessions.touch(interaction.client, interaction.channelId, messageId);

    
    const { state } = session;
    try {
        applyInteraction(customId, interaction.values ?? [], state);
    } catch (e) {
        console.error('[QR] applyInteraction error:', e);
        return true;
    }

    
    try {
        let files = [];
        if (customId === 'qr_btn_regenerate' || customId === 'qr_sel_style' || customId === 'qr_sel_size' || customId === 'qr_sel_ecc') {
            const buffer = await generateQRBuffer(state.text, state.style, state.size, state.errorCorrection);
            files = [new AttachmentBuilder(buffer, { name: 'qrcode.png' })];
        }

        const components = renderState(state);
        const payload = { components };
        if (files.length) payload.files = files;

        await editV2(interaction, payload);
    } catch (err) {
        console.error('[QR] message.edit error:', err);
        try {
            const errCard = card(
                lang.qr.panel.renderErrorTitle({ emoji: getEmoji('warning') }),
                [`\`${String(err.message || '').slice(0, 120)}\``, lang.qr.panel.renderErrorSub],
                [tabsRow(state.mode || 'overview')],
                ACCENT.danger
            );
            await editV2(interaction, { components: [errCard], files: [] });
        } catch { }
    }

    return true;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('qrgenerator')
        .setDescription('Generate a customized scan-ready QR code')
        .addStringOption(o =>
            o.setName('text')
                .setDescription('Text or URL to encode into QR code')
                .setRequired(false)
                .setMaxLength(2000))
        .addStringOption(o =>
            o.setName('style')
                .setDescription('Choose starting color theme preset')
                .setRequired(false)
                .addChoices(
                    { name: 'Classic (Black & White)', value: 'classic' },
                    { name: 'Ocean Blue', value: 'ocean' },
                    { name: 'Forest Green', value: 'forest' },
                    { name: 'Royal Purple', value: 'royal' },
                    { name: 'Fire Red', value: 'fire' },
                    { name: 'Golden Sun', value: 'gold' },
                    { name: '🩷 Pink Sunset', value: 'pink' },
                    { name: 'Minimal White preset', value: 'minimal' }
                ))
        .addStringOption(o =>
            o.setName('size')
                .setDescription('QR size dimensions preset')
                .setRequired(false)
                .addChoices(
                    { name: 'Small (300px)', value: 'small' },
                    { name: 'Medium (500px)', value: 'medium' },
                    { name: '️ Large (800px)', value: 'large' },
                    { name: 'Extra Large (1200px)', value: 'xlarge' }
                ))
        .addStringOption(o =>
            o.setName('error_correction')
                .setDescription('Error correction module resistance quality')
                .setRequired(false)
                .addChoices(
                    { name: 'Low (~7% resistance)', value: 'L' },
                    { name: '️ Medium (~15% resistance)', value: 'M' },
                    { name: '️ Quartile (~25% resistance)', value: 'Q' },
                    { name: 'High (~30% resistance)', value: 'H' }
                )),

    aliases: ['qr', 'qrcode', 'genqr'],
    category: 'utility',
    description: 'Generate a customized scan-ready QR code',
    handleComponent,

    async execute(interaction, args = []) {
        const isSlash = Boolean(interaction.isChatInputCommand?.());

        try {
            if (isSlash && !interaction.deferred && !interaction.replied) {
                await deferReply(interaction);
            }
        } catch (err) {
            console.error('[QR] deferReply failed:', err.message);
            return;
        }

        const channelId = interaction.channelId;
        const userId = isSlash ? interaction.user.id : interaction.author.id;

        
        let text = 'https://fluenosity.com';
        let style = 'classic';
        let size = 'medium';
        let errorCorrection = 'M';

        if (isSlash) {
            text = interaction.options.getString('text') || text;
            style = interaction.options.getString('style') || style;
            size = interaction.options.getString('size') || size;
            errorCorrection = interaction.options.getString('error_correction') || errorCorrection;
        } else if (args && args.length > 0) {
            text = args.join(' ');
        }

        
        const state = {
            mode: 'overview',
            userId,
            text,
            style,
            size,
            errorCorrection
        };

        try {
            const buffer = await generateQRBuffer(text, style, size, errorCorrection);
            const attachment = new AttachmentBuilder(buffer, { name: 'qrcode.png' });

            const components = renderState(state);
            const payload = { components, files: [attachment] };

            const message = await sendV2(interaction, payload);
            if (message) sessions.open(interaction.client, channelId, message.id, state);
        } catch (err) {
            console.error('[QR] Initial render failed:', err.message);
            const errCard = cards.error(
                lang.qr.panel.loadError({ emoji: getEmoji('cross') })
            );
            await sendV2(interaction, errCard);
        }
    }
};


