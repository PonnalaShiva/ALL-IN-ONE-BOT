'use strict';

const { ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, closeAndAutoDelete, ACCENT, createInterpolatableProxy } = require('../../UI');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.guide);

function getPageTitle(page, idx) {
    const key = `p${idx + 1}Title`;
    const localized = lang[key];
    const str = localized ? localized.toString() : '';
    return str || page?.title || `Page ${idx + 1}`;
}

function buildGuideCard(pageIndex) {
    const pages = rawLang.economy?.guide?.pages || [];
    const page = pages[pageIndex] || {};
    const total = pages.length;
    const pageTitle = getPageTitle(page, pageIndex);

    const card = buildCard({
        title: `${lang.title} — ${pageTitle}`,
        description: lang.masterySubtitle,
        accentColor: ACCENT.primary
    }).addText(`> **${lang.pageInfo({ current: pageIndex + 1, total })}** • ${pageTitle}`);

    if (page.sections && Array.isArray(page.sections)) {
        for (const sec of page.sections) {
            card.addSeparator()
                .addText(`### ${sec.heading}`)
                .addText(sec.content);
        }
    }

    return card;
}

function buildNavRows(pageIndex) {
    const pages = rawLang.economy?.guide?.pages || [];
    const total = pages.length;

    const selectOptions = pages.map((p, idx) => ({
        label: `${idx + 1}. ${getPageTitle(p, idx)}`,
        value: `${idx}`,
        description: lang.pageInfo({ current: idx + 1, total }).toString(),
        emoji: p.emoji,
        default: idx === pageIndex
    }));

    const selectRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('eco_topic_select')
            .setPlaceholder(lang.selectPagePlaceholder.toString())
            .addOptions(selectOptions)
    );

    const btnRow = new ActionRowBuilder().addComponents(
        btn.secondary('eco_prev', lang.prevLabel).setDisabled(pageIndex === 0),
        btn.secondary('eco_next', lang.nextLabel).setDisabled(pageIndex === total - 1),
        btn.danger('eco_close', lang.closeLabel)
    );

    return [selectRow, btnRow];
}

module.exports = {
    name: 'economy',
    aliases: ['eco', 'help-economy', 'guide'],
    description: lang.cmdDesc.toString(),
    usage: '!economy',
    cooldown: 3000,
    async execute(message) {
        try {
            const pages = rawLang.economy?.guide?.pages || [];
            let currentPage = 0;
            const initialCard = buildGuideCard(currentPage);
            const initialRows = buildNavRows(currentPage);

            const sentMessage = await sendV2(message, {
                card: initialCard,
                rows: initialRows
            });

            if (!sentMessage) return;

            const collector = sentMessage.createMessageComponentCollector({
                time: 600000
            });

            collector.on('collect', async (interaction) => {
                try {    
                    if (interaction.user.id !== message.author.id) return replyUnauthorized(interaction);
                    if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
    
                    if (interaction.customId === 'eco_close') {
                        collector.stop('closed');
                        return editV2(sentMessage, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
                    }
    
                    if (interaction.customId === 'eco_prev') {
                        if (currentPage > 0) currentPage--;
                    } else if (interaction.customId === 'eco_next') {
                        if (currentPage < pages.length - 1) currentPage++;
                    } else if (interaction.customId === 'eco_topic_select') {
                        currentPage = parseInt(interaction.values[0], 10) || 0;
                    }
    
                    const updatedCard = buildGuideCard(currentPage);
                    const updatedRows = buildNavRows(currentPage);
    
                    await editV2(sentMessage, {
                        card: updatedCard,
                        rows: updatedRows});
            
                } catch (err) {
                    console.error('[economy.js] Error in component collector:', err);
                }
            });

            collector.on('end', async (_, reason) => {
                if (reason === 'closed') return;
                const expiredCard = buildGuideCard(currentPage);
                await editV2(sentMessage, {
                    card: expiredCard,
                    rows: []
                }).catch(() => {});
            });
        } catch (error) {
            console.error('Error in economy guide command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
        }
    }
};
