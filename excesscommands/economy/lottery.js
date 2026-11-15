'use strict';

const { ActionRowBuilder } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const { LOTTERY_CONFIG } = require('../../models/economy/constants/systemData');
const { buyLotteryTickets, getRoundForDisplay } = require('../../models/economy/lotteryService');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.lottery);

function roundInfo(round) {
    if (!round) return lang.noActiveDraw.toString();
    if (round.status === 'completed') return lang.lastRoundInfo({ numbers: (round.winningNumbers || []).join(', '), winners: round.winnersCount || 0, paid: (round.paidAmount || 0).toLocaleString(), carryover: (round.carryover || 0).toLocaleString() });
    if (round.status === 'drawing') return lang.drawInProgress({ numbers: (round.winningNumbers || []).join(', ') });
    return lang.roundInfo({ drawAt: new Date(round.drawAt).toLocaleString(), pool: (round.prizePool || 0).toLocaleString() });
}

function buildOverviewCard(profile, round = null) {
    const maxTickets = LOTTERY_CONFIG.maxTicketsPerUser || LOTTERY_CONFIG.maxTickets || 50;

    const card = buildCard({
        title: lang.guildLotteryTitle,
        accentColor: ACCENT.primary
    })
        .addText(
            lang.rulesOverview({
                numbers: LOTTERY_CONFIG.numbersPerTicket || 6,
                maxNumber: LOTTERY_CONFIG.numberRange.max,
                price: LOTTERY_CONFIG.ticketPrice.toLocaleString(),
                maxTickets,
                held: profile.lotteryTickets || 0,
                wins: profile.lotteryWins || 0
            })
        )
        .addSeparator()
        .addText(roundInfo(round))
        .addSeparator()
        .addText(`${lang.commandsHeader}\n${lang.commandsGuide}`);

    const rows = [
        new ActionRowBuilder().addComponents(
            btn.primary('lotto_buy_1', lang.btnBuyOne),
            btn.primary('lotto_buy_5', lang.btnBuyFive),
            btn.primary('lotto_buy_10', lang.btnBuyTen),
            btn.secondary('lotto_tiers', lang.btnTiers),
            btn.danger('lotto_close', lang.btnClose)
        )
    ];

    return { card, rows };
}

function buildTiersCard(profile, round = null) {
    const activeTickets = round?.status === 'open'
        ? (profile.lotteryEntries || []).filter(entry => entry.roundId === round.roundId)
        : [];
    const card = buildCard({
        title: lang.statusTitle,
        accentColor: ACCENT.primary
    })
        .addText(
            lang.statusActiveTickets({
                held: profile.lotteryTickets || 0,
                wins: profile.lotteryWins || 0,
                price: LOTTERY_CONFIG.ticketPrice.toLocaleString()
            })
        )
        .addSeparator()
        .addText(roundInfo(round))
        .addSeparator()
        .addText(lang.prizeTiersHeader.toString())
        .addText(
            lang.prizeTiersDesc({
                tier2: (LOTTERY_CONFIG.ticketPrice * 500).toLocaleString(),
                tier3: (LOTTERY_CONFIG.ticketPrice * 50).toLocaleString(),
                tier4: (LOTTERY_CONFIG.ticketPrice * 5).toLocaleString()
            })
        )
        .addSeparator()
        .addText(activeTickets.length
            ? `${lang.yourNumbersHeader}${activeTickets.map((ticket, index) => lang.ticketLine({ index: index + 1, numbers: ticket.numbers.join(' - ') })).join('\n')}`
            : lang.noActiveTickets.toString());

    const rows = [
        new ActionRowBuilder().addComponents(
            btn.primary('lotto_overview', lang.btnOverview),
            btn.secondary('lotto_close', lang.btnClose)
        )
    ];

    return { card, rows };
}

async function handleBuyTickets(profile, quantity, referenceId) {
    const mutation = await buyLotteryTickets(profile, quantity, referenceId);
    if (!mutation?.success) {
        const error = mutation?.duplicate ? 'duplicate' : mutation?.error || 'failed';
        const card = error === 'funds'
            ? cards.warning(lang.notEnoughCashTitle, lang.notEnoughCashDesc({ cost: (quantity * LOTTERY_CONFIG.ticketPrice).toLocaleString(), quantity, wallet: (mutation.wallet || 0).toLocaleString() }))
            : error === 'limit'
                ? cards.warning(lang.ticketLimitTitle, lang.ticketLimitDesc({ max: mutation.maxTickets, held: mutation.held }))
                : error === 'draw_pending'
                    ? cards.warning(lang.statusTitle, lang.drawPending.toString())
                    : cards.warning(lang.errorTitle, lang.errorMessage);
        return { error, card };
    }
    profile = mutation.profile;
    const { tickets, currentTickets, totalCost, maxTickets, drawAt, prizePool } = mutation;

    const ticketLines = tickets.map((nums, i) =>
        lang.ticketLine({ index: currentTickets + i + 1, numbers: nums.join(' - ') }).toString()
    ).join('\n');

    const card = buildCard({
        title: lang.ticketsPurchasedTitle,
        accentColor: ACCENT.success
    })
        .addText(
            lang.ticketsPurchasedHeader({
                quantity,
                cost: totalCost.toLocaleString(),
                held: profile.lotteryTickets,
                maxTickets
            })
        )
        .addSeparator()
        .addText(`${lang.yourNumbersHeader}${ticketLines}`)
        .addSeparator()
        .addText(lang.roundInfo({ drawAt: new Date(drawAt).toLocaleString(), pool: (prizePool || 0).toLocaleString() }))
        .addSeparator()
        .addText(lang.automaticDrawFooter.toString());

    const rows = [
        new ActionRowBuilder().addComponents(
            btn.primary('lotto_overview', lang.btnOverview),
            btn.secondary('lotto_close', lang.btnClose)
        )
    ];

    return { success: true, card, rows };
}

module.exports = {
    name: 'lottery',
    aliases: ['lotto', 'jackpot'],
    description: lang.cmdDesc.toString(),
    usage: '!lottery | !lottery buy [qty] | !lottery check',
    cooldown: 3000,
    async execute(message, args) {
        try {
            const userId = message.author.id;
            const guildId = message.guild.id;
            const profile = await EconomyManager.getProfile(userId, guildId);
            const lotteryRound = await getRoundForDisplay(guildId);
            const action = args[0]?.toLowerCase();

            const attachLotteryCollector = (sentMsg) => {
                if (!sentMsg) return null;
                const collector = sentMsg.createMessageComponentCollector({ time: 60000 });
                collector.on('collect', async (interaction) => {
                    try {
                        if (interaction.user.id !== userId) return replyUnauthorized(interaction);
                        await interaction.deferUpdate();

                        if (interaction.customId === 'lotto_close') {
                            collector.stop('user_closed');
                            return editV2(sentMsg, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
                        }

                        if (interaction.customId === 'lotto_overview') {
                            const freshProfile = await EconomyManager.getProfile(userId, guildId);
                            const ov = buildOverviewCard(freshProfile, await getRoundForDisplay(guildId));
                            return editV2(sentMsg, { card: ov.card, rows: ov.rows });
                        }

                        if (interaction.customId === 'lotto_tiers') {
                            const freshProfile = await EconomyManager.getProfile(userId, guildId);
                            const tc = buildTiersCard(freshProfile, await getRoundForDisplay(guildId));
                            return editV2(sentMsg, { card: tc.card, rows: tc.rows });
                        }

                        let buyQty = 0;
                        if (interaction.customId === 'lotto_buy_1') buyQty = 1;
                        else if (interaction.customId === 'lotto_buy_5') buyQty = 5;
                        else if (interaction.customId === 'lotto_buy_10') buyQty = 10;

                        if (buyQty > 0) {
                            const freshProfile = await EconomyManager.getProfile(userId, guildId);
                            const result = await handleBuyTickets(freshProfile, buyQty, `lottery:${interaction.id}:buy`);
                            const receiptRows = result.rows || [new ActionRowBuilder().addComponents(btn.primary('lotto_overview', lang.btnOverview), btn.danger('lotto_close', lang.btnClose))];
                            return editV2(sentMsg, { card: result.card, rows: receiptRows });
                        }
                    } catch (err) {
                        console.error('Error in lottery collector:', err);
                    }
                });

                collector.on('end', (_, reason) => {
                    if (reason === 'time') {
                        editV2(sentMsg, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
                    }
                });
                return collector;
            };

            
            if (action === 'buy') {
                const maxTickets = LOTTERY_CONFIG.maxTicketsPerUser || LOTTERY_CONFIG.maxTickets || 50;
                const quantity = Math.min(Math.max(parseInt(args[1], 10) || 1, 1), maxTickets);
                const result = await handleBuyTickets(profile, quantity, `lottery:${message.id}:buy`);

                if (result.rows) {
                    const sentMessage = await sendV2(message, { card: result.card, rows: result.rows });
                    attachLotteryCollector(sentMessage);
                    return;
                }

                return sendV2(message, result.card);
            }

            
            if (action === 'check' || action === 'results') {
                const tiersRes = buildTiersCard(profile, lotteryRound);
                const sentMessage = await sendV2(message, { card: tiersRes.card, rows: tiersRes.rows });
                attachLotteryCollector(sentMessage);
                return;
            }

            
            const initial = buildOverviewCard(profile, lotteryRound);
            const sentMessage = await sendV2(message, { card: initial.card, rows: initial.rows });
            attachLotteryCollector(sentMessage);

        } catch (error) {
            console.error('Error in lottery command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
        }
    }
};
