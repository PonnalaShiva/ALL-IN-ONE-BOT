'use strict';

const { ActionRowBuilder } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.dice);

async function handleDiceDeposit(userId, guildId, referenceId) {
    const freshProfile = await EconomyManager.getProfile(userId, guildId);
    const result = await EconomyManager.transferBank({
        userId, guildId, direction: 'deposit', amount: 'all',
        referenceId: `dice-deposit:${referenceId}`,
        description: lang.txDepositDice({ amount: (freshProfile.wallet || 0).toLocaleString() }).toString()
    });
    return result.amount || 0;
}

async function executeDiceRoll(profile, betAmount, guess = null, referenceId, bypassCooldown = false) {
    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;
    const total = die1 + die2;

    const luckMultiplier = EconomyManager.getGamblingLuck(profile);
    let won = false;
    let winnings = 0;
    let multiplier = 0;

    if (guess !== null) {
        if (total === guess) {
            won = true;
            multiplier = 6.0 * luckMultiplier;
            winnings = Math.floor(betAmount * multiplier);
        }
    } else {
        if (total >= 7 && total <= 11) {
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
        description: lang.txDice({ outcome: won ? lang.txWin.toString() : lang.txLoss.toString(), total }).toString()
    });
    if (!settlement.success) {
        if (settlement.cooldown) return { card: cards.warning(lang.cooldownTitle, lang.cooldownDesc({ seconds: Math.max(1, Math.ceil((settlement.nextBet - Date.now()) / 1000)) })), rows: [] };
        if (settlement.insufficientFunds) return { card: cards.warning(lang.insufficientFundsTitle, lang.insufficientFundsDesc({ wallet: (settlement.profile?.wallet || 0).toLocaleString(), bet: betAmount.toLocaleString() })), rows: [] };
        return { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] };
    }
    profile = settlement.profile;

    const card = buildCard({
        title: won ? lang.winTitle : lang.lossTitle,
        accentColor: won ? ACCENT.success : ACCENT.danger
    })
        .addText(`> **${lang.rollSummary({ die1, die2, total })}**${guess !== null ? `\n> **${lang.guessSummary({ guess })}**` : ''}`)
        .addSeparator()
        .addText(`### ${won ? lang.winSubtitle : lang.lossSubtitle}`);

    if (won) {
        card.addText(
            `**💵 ${lang.betLabel}:** \`$${betAmount.toLocaleString()}\`\n` +
            `**🎯 ${lang.multiplierLabel}:** \`${multiplier.toFixed(2)}x\`\n` +
            `**💎 ${lang.payoutLabel}:** \`$${winnings.toLocaleString()}\`\n` +
            `**📈 ${lang.profitLabel}:** \`+$${profit.toLocaleString()}\`\n` +
            `**💳 ${lang.newBalanceLabel}:** \`$${(profile.wallet || 0).toLocaleString()}\`` +
            (luckMultiplier > 1 ? `\n**🍀 ${lang.luckBonusLabel}:** \`${luckMultiplier.toFixed(2)}x\`` : '')
        );
    } else {
        card.addText(
            `**💵 ${lang.betLabel}:** \`$${betAmount.toLocaleString()}\`\n` +
            `**💸 ${lang.lossLabel}:** \`-$${betAmount.toLocaleString()}\`\n` +
            `**💳 ${lang.remainingBalanceLabel}:** \`$${(profile.wallet || 0).toLocaleString()}\`\n\n` +
            `> **💡 Tip:** ${lang.tipsDesc}`
        );
    }

    const buttons = [];
    if (won && (profile.wallet || 0) > 0) {
        buttons.push(btn.success('dice_deposit_bank', lang.btnDepositBank));
    }
    buttons.push(btn.secondary('dice_close', lang.btnClose));

    const rows = [new ActionRowBuilder().addComponents(buttons)];
    return { card, rows };
}

module.exports = {
    name: 'dice',
    aliases: ['rolldice', 'diceroll'],
    description: lang.cmdDesc.toString(),
    usage: '!dice [bet] [guess]',
    cooldown: 4000,
    async execute(message, args) {
        try {
            const profile = await EconomyManager.getProfile(message.author.id, message.guild.id);

            const cooldownCheck = EconomyManager.checkCooldown(profile, 'gambling');
            if (cooldownCheck && cooldownCheck.onCooldown) {
                return sendV2(message, cards.warning(
                    lang.cooldownTitle,
                    lang.cooldownDesc({
                        seconds: cooldownCheck.timeLeft?.seconds || 30
                    })
                ));
            }

            
            if (!args[0]) {
                const guideCard = buildCard({
                    title: lang.winSubtitle,
                    accentColor: ACCENT.primary
                }).addText(
                    `> **${lang.invalidBetTitle}**\n${lang.invalidBetDesc}\n\n` +
                    `${lang.walletBalance({ wallet: (profile.wallet || 0).toLocaleString() })}`
                );

                const quickRows = [
                    new ActionRowBuilder().addComponents(
                        btn.primary('dice_over_500', lang.btnOver500),
                        btn.warning('dice_seven_500', lang.btnSeven500),
                        btn.primary('dice_over_1000', lang.btnOver1k),
                        btn.warning('dice_seven_1000', lang.btnSeven1k),
                        btn.danger('dice_close', lang.btnClose)
                    )
                ];

                const sentMessage = await sendV2(message, { card: guideCard, rows: quickRows });
                if (!sentMessage) return;

                const collector = sentMessage.createMessageComponentCollector({ time: 60000 });
                collector.on('collect', async (interaction) => {
                    try {
                        if (interaction.user.id !== message.author.id) return replyUnauthorized(interaction);
                        await interaction.deferUpdate();

                        if (interaction.customId === 'dice_close') {
                            collector.stop('user_closed');
                            return editV2(sentMessage, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
                        }

                        if (interaction.customId === 'dice_deposit_bank') {
                            const deposited = await handleDiceDeposit(message.author.id, message.guild.id, interaction.message.id);
                            collector.stop('deposited');
                            return editV2(sentMessage, { card: cards.success(lang.depositedTitle, lang.depositedAlert({ amount: deposited.toLocaleString() })), rows: [] });
                        }

                        let qBet = 500;
                        let qGuess = null;
                        if (interaction.customId === 'dice_over_500') { qBet = 500; qGuess = null; }
                        else if (interaction.customId === 'dice_seven_500') { qBet = 500; qGuess = 7; }
                        else if (interaction.customId === 'dice_over_1000') { qBet = 1000; qGuess = null; }
                        else if (interaction.customId === 'dice_seven_1000') { qBet = 1000; qGuess = 7; }

                        const freshProfile = await EconomyManager.getProfile(message.author.id, message.guild.id);
                        if ((freshProfile.wallet || 0) < qBet) {
                            collector.stop('funds');
                            return editV2(sentMessage, {
                                card: cards.warning(lang.insufficientFundsTitle, lang.insufficientFundsDesc({ wallet: (freshProfile.wallet || 0).toLocaleString(), bet: qBet.toLocaleString() })),
                                rows: []
                            });
                        }

                        const diceRes = await executeDiceRoll(freshProfile, qBet, qGuess, interaction.id, true);
                        return editV2(sentMessage, { card: diceRes.card, rows: diceRes.rows || [] });
                    } catch (err) {
                        console.error('[Dice] Collector 1 interaction error:', err);
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

            if (!Number.isSafeInteger(betAmount) || betAmount <= 0 || !Number.isSafeInteger(Math.floor(betAmount * 15))) {
                return sendV2(message, cards.warning(
                    lang.invalidBetTitle,
                    lang.invalidBetDesc()
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

            const guess = args[1] ? (/^\d+$/.test(args[1]) ? Number(args[1]) : NaN) : null;
            if (guess !== null && (!Number.isInteger(guess) || guess < 2 || guess > 12)) {
                return sendV2(message, cards.warning(
                    lang.invalidGuessTitle,
                    lang.invalidGuessDesc({ guess })
                ));
            }

            const diceRes = await executeDiceRoll(profile, betAmount, guess, message.id);
            const sentMessage = await sendV2(message, { card: diceRes.card, rows: diceRes.rows });
            if (!sentMessage) return;

            const collector = sentMessage.createMessageComponentCollector({ time: 60000 });
            collector.on('collect', async (interaction) => {
                try {
                    if (interaction.user.id !== message.author.id) return replyUnauthorized(interaction);
                    await interaction.deferUpdate();

                    if (interaction.customId === 'dice_close') {
                        collector.stop('user_closed');
                        return editV2(sentMessage, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
                    }

                    if (interaction.customId === 'dice_deposit_bank') {
                        const deposited = await handleDiceDeposit(message.author.id, message.guild.id, interaction.message.id);
                        collector.stop('deposited');
                        return editV2(sentMessage, { card: cards.success(lang.depositedTitle, lang.depositedAlert({ amount: deposited.toLocaleString() })), rows: [] });
                    }
                } catch (err) {
                    console.error('[Dice] Collector 2 interaction error:', err);
                }
            });

            collector.on('end', (_, reason) => {
                if (reason === 'time') {
                    editV2(sentMessage, { card: cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc), rows: [] }).catch(() => {});
                }
            });

        } catch (error) {
            console.error('Error in dice command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
        }
    }
};
