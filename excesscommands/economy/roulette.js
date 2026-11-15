'use strict';

const { ActionRowBuilder } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.roulette);

const RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const BLACK_NUMBERS = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];

async function handleRouletteDeposit(userId, guildId, referenceId) {
    const freshProfile = await EconomyManager.getProfile(userId, guildId);
    const result = await EconomyManager.transferBank({
        userId, guildId, direction: 'deposit', amount: 'all',
        referenceId: `roulette-deposit:${referenceId}`,
        description: lang.txDepositRoulette({ amount: (freshProfile.wallet || 0).toLocaleString() }).toString()
    });
    return result.amount || 0;
}

async function executeRouletteSpin(profile, betAmount, betType = 'red', referenceId, bypassCooldown = false) {
    let betOnNumber = null;
    let betOnColor = null;

    if (betType === 'red' || betType === 'r') {
        betOnColor = 'red';
    } else if (betType === 'black' || betType === 'b') {
        betOnColor = 'black';
    } else {
        const num = /^\d+$/.test(String(betType)) ? Number(betType) : NaN;
        if (Number.isInteger(num) && num >= 0 && num <= 36) {
            betOnNumber = num;
        } else {
            return {
                error: 'invalid_choice',
                card: cards.warning(
                    lang.invalidChoiceTitle,
                    lang.invalidChoiceDesc({ choice: betType })
                )
            };
        }
    }

    
    const winningNumber = Math.floor(Math.random() * 37);
    const winningColor = winningNumber === 0 ? 'green' :
        RED_NUMBERS.includes(winningNumber) ? 'red' : 'black';

    const luckMultiplier = EconomyManager.getGamblingLuck ? EconomyManager.getGamblingLuck(profile) : 1;
    let won = false;
    let winnings = 0;
    let multiplier = 0;

    if (betOnNumber !== null) {
        if (winningNumber === betOnNumber) {
            won = true;
            multiplier = 36.0 * luckMultiplier;
            winnings = Math.floor(betAmount * multiplier);
        }
    } else if (betOnColor) {
        if (winningColor === betOnColor) {
            won = true;
            multiplier = 2.0 * luckMultiplier;
            winnings = Math.floor(betAmount * multiplier);
        }
    }

    const profit = won ? winnings - betAmount : -betAmount;

    const settlement = await EconomyManager.settleGamblingBet({
        userId: profile.userId,
        guildId: profile.guildId,
        betAmount,
        winnings: won ? winnings : 0,
        won,
        referenceId,
        bypassCooldown,
        description: lang.txRoulette({ outcome: won ? lang.txWin.toString() : lang.txLoss.toString(), number: winningNumber, color: winningColor }).toString()
    });
    if (!settlement.success) {
        if (settlement.cooldown) return { success: false, card: cards.warning(lang.cooldownTitle, lang.cooldownDesc({ seconds: Math.max(1, Math.ceil((settlement.nextBet - Date.now()) / 1000)) })), rows: [] };
        if (settlement.insufficientFunds) return { success: false, card: cards.warning(lang.insufficientFundsTitle, lang.insufficientFundsDesc({ wallet: (settlement.profile?.wallet || 0).toLocaleString(), bet: betAmount.toLocaleString() })), rows: [] };
        return { success: false, card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] };
    }
    profile = settlement.profile;

    const colorEmoji = winningColor === 'red' ? '🔴' : winningColor === 'black' ? '⚫' : '🟢';
    const betDescription = betOnNumber !== null
        ? lang.betExactNumber({ num: betOnNumber }).toString()
        : lang.betColor({ color: (betOnColor || 'red').toUpperCase() }).toString();

    let resultSection = lang.resultHeader({
        colorEmoji,
        number: winningNumber,
        color: winningColor.toUpperCase(),
        betDesc: betDescription,
        bet: betAmount.toLocaleString()
    });

    if (won) {
        resultSection += lang.payoutHeader.toString() +
            lang.payoutDetails({
                multiplier: multiplier.toFixed(2),
                winnings: winnings.toLocaleString(),
                profit: profit.toLocaleString(),
                wallet: (profile.wallet || 0).toLocaleString()
            });
        if (luckMultiplier > 1) {
            resultSection += lang.luckBonusActive({ multiplier: luckMultiplier.toFixed(2) });
        }
    } else {
        resultSection += lang.lossHeader.toString() +
            lang.lossDetails({
                bet: betAmount.toLocaleString(),
                wallet: (profile.wallet || 0).toLocaleString()
            });
    }

    const spinCard = buildCard({
        title: lang.spinCardTitle({ status: won ? lang.statusWinner : lang.statusBetterLuck }),
        accentColor: won ? ACCENT.success : ACCENT.danger
    }).addText(resultSection);

    const buttons = [];
    if (won && (profile.wallet || 0) > 0) {
        buttons.push(btn.success('roulette_deposit_bank', lang.btnDepositBank));
    }
    buttons.push(btn.secondary('roulette_close', lang.btnClose));

    const rows = [new ActionRowBuilder().addComponents(buttons)];
    return { success: true, won, card: spinCard, rows };
}

module.exports = {
    name: 'roulette',
    aliases: ['spin', 'wheel'],
    description: lang.cmdDesc.toString(),
    usage: '!roulette [bet] [red/black/number]',
    cooldown: 4000,
    async execute(message, args) {
        try {
            const profile = await EconomyManager.getProfile(message.author.id, message.guild.id);

            const cooldownCheck = EconomyManager.checkCooldown(profile, 'gambling');
            if (cooldownCheck.onCooldown) {
                return sendV2(message, cards.warning(
                    lang.cooldownTitle,
                    lang.cooldownDesc({ seconds: cooldownCheck.timeLeft.seconds })
                ));
            }

            
            if (!args[0]) {
                const guideCard = buildCard({
                    title: lang.title,
                    description: lang.subtitle,
                    accentColor: ACCENT.primary
                }).addText(
                    `> **${lang.invalidBetTitle}**\n${lang.invalidBetDesc}\n\n` +
                    `${lang.walletBalance({ wallet: (profile.wallet || 0).toLocaleString() })}`
                );

                const quickRows = [
                    new ActionRowBuilder().addComponents(
                        btn.danger('roulette_red_500', lang.btnRed500),
                        btn.secondary('roulette_black_500', lang.btnBlack500),
                        btn.danger('roulette_red_1000', lang.btnRed1k),
                        btn.secondary('roulette_black_1000', lang.btnBlack1k),
                        btn.danger('roulette_close', lang.btnClose)
                    )
                ];

                const sentMessage = await sendV2(message, { card: guideCard, rows: quickRows });
                if (!sentMessage) return;

                const collector = sentMessage.createMessageComponentCollector({ time: 60000 });
                collector.on('collect', async (interaction) => {
                    try {
                        if (interaction.user.id !== message.author.id) return replyUnauthorized(interaction);
                        await interaction.deferUpdate();

                        if (interaction.customId === 'roulette_close') {
                            collector.stop('user_closed');
                            return editV2(sentMessage, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
                        }

                        if (interaction.customId === 'roulette_deposit_bank') {
                            const deposited = await handleRouletteDeposit(message.author.id, message.guild.id, interaction.message.id);
                            collector.stop('deposited');
                            return editV2(sentMessage, { card: cards.success(lang.depositedTitle, lang.depositedAlert({ amount: deposited.toLocaleString() })), rows: [] });
                        }

                        let qBet = 500;
                        let qChoice = 'red';
                        if (interaction.customId === 'roulette_red_500') { qBet = 500; qChoice = 'red'; }
                        else if (interaction.customId === 'roulette_black_500') { qBet = 500; qChoice = 'black'; }
                        else if (interaction.customId === 'roulette_red_1000') { qBet = 1000; qChoice = 'red'; }
                        else if (interaction.customId === 'roulette_black_1000') { qBet = 1000; qChoice = 'black'; }

                        const freshProfile = await EconomyManager.getProfile(message.author.id, message.guild.id);
                        if ((freshProfile.wallet || 0) < qBet) {
                            collector.stop('funds');
                            return editV2(sentMessage, {
                                card: cards.warning(lang.insufficientFundsTitle, lang.insufficientFundsDesc({ wallet: (freshProfile.wallet || 0).toLocaleString(), bet: qBet.toLocaleString() })),
                                rows: []
                            });
                        }

                        const spinRes = await executeRouletteSpin(freshProfile, qBet, qChoice, interaction.id, true);
                        return editV2(sentMessage, { card: spinRes.card, rows: spinRes.rows || [] });
                    } catch (err) {
                        console.error('[Roulette] Collector 1 interaction error:', err);
                    }
                });

                collector.on('end', (_, reason) => {
                    if (reason === 'time') {
                        editV2(sentMessage, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
                    }
                });

                return;
            }

            let betAmount;
            if (args[0] === 'all' || args[0] === 'max') {
                betAmount = profile.wallet || 0;
            } else {
                betAmount = /^\d+$/.test(args[0]) ? Number(args[0]) : NaN;
            }

            if (!Number.isSafeInteger(betAmount) || betAmount <= 0 || !Number.isSafeInteger(Math.floor(betAmount * 90))) {
                return sendV2(message, cards.warning(
                    lang.invalidBetTitle,
                    lang.invalidBetDesc
                ));
            }

            if ((profile.wallet || 0) < betAmount) {
                return sendV2(message, cards.warning(
                    lang.insufficientFundsTitle,
                    lang.insufficientFundsDesc({
                        wallet: (profile.wallet || 0).toLocaleString(),
                        bet: betAmount.toLocaleString()
                    })
                ));
            }

            const betType = args[1]?.toLowerCase() || 'red';
            const spinRes = await executeRouletteSpin(profile, betAmount, betType, message.id);
            if (spinRes.rows) {
                const sentMessage = await sendV2(message, { card: spinRes.card, rows: spinRes.rows });
                if (!sentMessage) return;

                const collector = sentMessage.createMessageComponentCollector({ time: 60000 });
                collector.on('collect', async (interaction) => {
                    try {
                        if (interaction.user.id !== message.author.id) return replyUnauthorized(interaction);
                        await interaction.deferUpdate();

                        if (interaction.customId === 'roulette_close') {
                            collector.stop('user_closed');
                            return editV2(sentMessage, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
                        }

                        if (interaction.customId === 'roulette_deposit_bank') {
                            const deposited = await handleRouletteDeposit(message.author.id, message.guild.id, interaction.message.id);
                            collector.stop('deposited');
                            return editV2(sentMessage, { card: cards.success(lang.depositedTitle, lang.depositedAlert({ amount: deposited.toLocaleString() })), rows: [] });
                        }
                    } catch (err) {
                        console.error('[Roulette] Collector 2 interaction error:', err);
                    }
                });

                collector.on('end', (_, reason) => {
                    if (reason === 'time') {
                        editV2(sentMessage, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
                    }
                });

                return;
            }

            return sendV2(message, spinRes.card);

        } catch (error) {
            console.error('Error in roulette command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
        }
    }
};
