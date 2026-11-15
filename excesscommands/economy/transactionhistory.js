'use strict';

const { ActionRowBuilder, ComponentType } = require('discord.js');
const { buildCard, cards, btn, paginationRow, sendV2, editV2, replyUnauthorized, closeAndAutoDelete, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.transactionhistory);

function getTransactionEmoji(type, category) {
    const emojiMap = {
        income: {
            business: '🏢',
            heist: '💰',
            racing: '🏁',
            gambling: '🎰',
            work: '💼',
            family_work: '👨‍👩‍👧‍👦',
            default: '💚'
        },
        expense: {
            shop: '🛒',
            gambling: '🎲',
            heist: '🚨',
            pet_care: '🐕',
            family: '👨‍👩‍👧‍👦',
            default: '💸'
        },
        transfer: '🔄',
        investment: '📈',
        trade: '🤝',
        racing: '🏁',
        robbery: '🔓'
    };

    if (type === 'income' || type === 'expense') {
        return emojiMap[type]?.[category] || emojiMap[type]?.default || '💳';
    }

    return emojiMap[type] || '💳';
}

function buildHistoryCard(allTransactions, page, totalPages, targetUser, filterType) {
    const itemsPerPage = 8;
    const start = (page - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageTransactions = allTransactions.slice(start, end);

    const totalIncome = allTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + (t.amount || 0), 0);
    const totalExpenses = allTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + (t.amount || 0), 0);
    const netProfit = totalIncome - totalExpenses;
    const isProfitable = netProfit >= 0;

    const summaryText = `> **${lang.totalIncomeLabel}:** \`+$${totalIncome.toLocaleString()}\`\n` +
        `> **${lang.totalExpensesLabel}:** \`-$${totalExpenses.toLocaleString()}\`\n` +
        `> **${lang.netFlowLabel}:** \`${isProfitable ? '+' : ''}$${netProfit.toLocaleString()}\`\n` +
        `> **${lang.totalRecordsLabel}:** \`${allTransactions.length}\` (${page}/${totalPages})` +
        (filterType ? lang.filteredByText({ filter: filterType }) : '');

    let recordsText = '';
    for (const t of pageTransactions) {
        const emoji = getTransactionEmoji(t.type, t.category);
        const sign = t.type === 'income' ? '+' : '-';
        const amountStr = `${sign}$${(t.amount || 0).toLocaleString()}`;
        const dateStr = t.timestamp ? new Date(t.timestamp).toLocaleDateString() : lang.recentDateFallback.toString();
        const desc = t.description || lang.defaultDescription.toString();
        const catStr = t.category ? ` · \`${t.category}\`` : '';

        recordsText += `${emoji} **${amountStr}** — ${desc}\n` +
            `> ${dateStr} · \`${t.type}\`${catStr}\n\n`;
    }

    const card = buildCard({
        title: lang.title({ username: targetUser.username }),
        accentColor: isProfitable ? ACCENT.success : ACCENT.danger
    })
        .addText(`${lang.summaryHeader}\n${summaryText}`)
        .addSeparator()
        .addText(`${lang.recentTransactionsHeader({ start: start + 1, end: Math.min(end, allTransactions.length), total: allTransactions.length })}\n\n${recordsText.trim()}`)
        .addSeparator()
        .addText(`${lang.filteringTipsHeader}\n${lang.filteringTipsDesc}`);

    const rows = [];
    if (totalPages > 1) {
        rows.push(paginationRow('txhist', page - 1, totalPages));
    }

    const filterRow = new ActionRowBuilder().addComponents(
        btn.secondary('tx_filter_all', lang.btnAll),
        btn.success('tx_filter_income', lang.btnIncome),
        btn.danger('tx_filter_expense', lang.btnExpense)
    );
    if (totalPages <= 1) {
        filterRow.addComponents(btn.danger('txhist_close', lang.btnClose));
    }
    rows.push(filterRow);

    return { card, rows };
}

module.exports = {
    name: 'transactionhistory',
    aliases: ['transactions', 'th', 'history', 'ledger'],
    description: lang.cmdDesc.toString(),
    usage: '!transactions [page] [type] [category]',
    cooldown: 4000,
    async execute(message, args) {
        try {
            const targetUser = message.mentions.users.first() || message.author;

            if (targetUser.id !== message.author.id && !message.member.permissions?.has('Administrator')) {
                return sendV2(message, cards.warning(
                    lang.accessDeniedTitle,
                    lang.accessDeniedDesc
                ));
            }

            const profile = await EconomyManager.getProfile(targetUser.id, message.guild.id);

            let filterType = args.find(arg => ['income', 'expense', 'transfer', 'investment', 'trade', 'racing', 'robbery', 'family_work', 'gambling', 'shop'].includes(arg.toLowerCase())) || null;
            let filterCategory = args.find(arg => ['business', 'heist', 'racing', 'gambling', 'shop', 'family', 'work'].includes(arg.toLowerCase())) || null;

            const getFilteredTransactions = (fType, fCat) => {
                let txs = [...(profile.transactions || [])];
                if (fType) {
                    txs = txs.filter(t => t.type === fType.toLowerCase());
                }
                if (fCat) {
                    txs = txs.filter(t => t.category === fCat.toLowerCase());
                }
                txs.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
                return txs;
            };

            let transactions = getFilteredTransactions(filterType, filterCategory);

            if (transactions.length === 0) {
                const filterDesc = filterType || filterCategory
                    ? lang.filterNoMatch({ filters: [filterType, filterCategory].filter(Boolean).join(', ') })
                    : lang.ledgerEmpty.toString();

                return sendV2(message, cards.info(lang.emptyTitle, filterDesc));
            }

            const itemsPerPage = 8;
            let totalPages = Math.ceil(transactions.length / itemsPerPage);
            let currentPage = 1;

            const pageArg = args.find(arg => !isNaN(arg) && parseInt(arg, 10) > 0);
            if (pageArg) {
                currentPage = Math.min(parseInt(pageArg, 10), totalPages);
            }

            let initial = buildHistoryCard(transactions, currentPage, totalPages, targetUser, filterType);
            const sentMessage = await sendV2(message, { card: initial.card, rows: initial.rows });
            if (!sentMessage) return;

            const collector = sentMessage.createMessageComponentCollector({ time: 120000 });

            collector.on('collect', async (interaction) => {
            try {    
                    if (interaction.user.id !== message.author.id) return replyUnauthorized(interaction);
                    if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
    
                    if (interaction.customId === 'txhist_close') {
                        collector.stop('user_closed');
                        return editV2(sentMessage, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
                    }
    
                    if (interaction.customId === 'txhist_prev') {
                        currentPage = Math.max(1, currentPage - 1);
                    } else if (interaction.customId === 'txhist_next') {
                        currentPage = Math.min(totalPages, currentPage + 1);
                    } else if (interaction.customId === 'tx_filter_all') {
                        filterType = null;
                        filterCategory = null;
                        transactions = getFilteredTransactions(filterType, filterCategory);
                        totalPages = Math.max(1, Math.ceil(transactions.length / itemsPerPage));
                        currentPage = 1;
                    } else if (interaction.customId === 'tx_filter_income') {
                        filterType = 'income';
                        filterCategory = null;
                        transactions = getFilteredTransactions(filterType, filterCategory);
                        totalPages = Math.max(1, Math.ceil(transactions.length / itemsPerPage));
                        currentPage = 1;
                    } else if (interaction.customId === 'tx_filter_expense') {
                        filterType = 'expense';
                        filterCategory = null;
                        transactions = getFilteredTransactions(filterType, filterCategory);
                        totalPages = Math.max(1, Math.ceil(transactions.length / itemsPerPage));
                        currentPage = 1;
                    }
    
                    const updated = buildHistoryCard(transactions, currentPage, totalPages, targetUser, filterType);
                    return editV2(sentMessage, { card: updated.card, rows: updated.rows });
            } catch (err) {
                console.error('[transactionhistory.js] Error in component collector:', err);
            }
        });

            collector.on('end', (collected, reason) => {
                if (reason === 'time') {
                    editV2(sentMessage, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
                }
            });

        } catch (error) {
            console.error('Error in transactionhistory command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
        }
    }
};
