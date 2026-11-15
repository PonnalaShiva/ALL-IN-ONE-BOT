'use strict';

const { ActionRowBuilder } = require('discord.js');
const { buildCard, cards, btn, sendV2, editV2, replyUnauthorized, ACCENT, createInterpolatableProxy } = require('../../UI');
const { EconomyManager } = require('../../models/economy/economy');
const rawLang = require('../../events/loadLanguage');

const lang = createInterpolatableProxy(rawLang.economy?.blackjack);

const DECK = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function drawCard() {
    return DECK[Math.floor(Math.random() * DECK.length)];
}

function calculateHand(hand) {
    let total = 0;
    let aces = 0;

    for (const card of hand) {
        if (card === 'A') {
            aces += 1;
            total += 11;
        } else if (['K', 'Q', 'J', '10'].includes(card)) {
            total += 10;
        } else {
            total += parseInt(card, 10);
        }
    }

    while (total > 21 && aces > 0) {
        total -= 10;
        aces -= 1;
    }

    return total;
}

function buildPlayingCard(playerCards, dealerCards, betAmount) {
    const playerTotal = calculateHand(playerCards);
    const dealerTotal = calculateHand([dealerCards[0]]);

    return buildCard({
        title: lang.playingTitle,
        accentColor: ACCENT.primary
    })
        .addText(`> **${lang.betLabel}:** \`$${betAmount.toLocaleString()}\``)
        .addSeparator()
        .addText(
            lang.dealerUpcard({
                dealerCards: `${dealerCards[0]} 🂠`,
                dealerTotal
            }) + '\n' +
            lang.playerHand({
                playerCards: playerCards.join(' '),
                playerTotal
            })
        );
}

async function finalizeBlackjack(profile, message, playerCards, dealerCards, betAmount, sessionToken) {
    let playerTotal = calculateHand(playerCards);
    let dealerTotal = calculateHand(dealerCards);

    
    while (dealerTotal < 17) {
        dealerCards.push(drawCard());
        dealerTotal = calculateHand(dealerCards);
    }

    const luckMultiplier = EconomyManager.getGamblingLuck(profile);
    let won = false;
    let winnings = 0;
    let multiplier = 0;
    let resultKey = '';

    const isPlayerBJ = playerCards.length === 2 && playerTotal === 21;
    const isDealerBJ = dealerCards.length === 2 && dealerTotal === 21;

    if (playerTotal > 21) {
        won = false;
        resultKey = 'resBust';
    } else if (isPlayerBJ && !isDealerBJ) {
        won = true;
        multiplier = 2.5 * luckMultiplier;
        resultKey = 'resBlackjack';
    } else if (isDealerBJ && !isPlayerBJ) {
        won = false;
        resultKey = 'resDealerBlackjack';
    } else if (dealerTotal > 21) {
        won = true;
        multiplier = 2.0 * luckMultiplier;
        resultKey = 'resDealerBust';
    } else if (playerTotal > dealerTotal) {
        won = true;
        multiplier = 2.0 * luckMultiplier;
        resultKey = 'resWin';
    } else if (dealerTotal > playerTotal) {
        won = false;
        resultKey = 'resDealerWins';
    } else {
        won = false;
        resultKey = 'resPush';
    }

    const resultText = lang[resultKey]?.toString() || resultKey;

    if (won) {
        winnings = Math.floor(betAmount * multiplier);
    } else if (resultKey === 'resPush') {
        winnings = betAmount;
    }

    const profit = won ? winnings - betAmount : (resultKey === 'resPush' ? 0 : -betAmount);
    const settlement = await EconomyManager.settleGamblingBet({
        userId: profile.userId,
        guildId: profile.guildId,
        betAmount,
        winnings: won ? winnings : (resultKey === 'resPush' ? betAmount : 0),
        won,
        push: resultKey === 'resPush',
        referenceId: `blackjack-settle:${message.id}`,
        sessionToken,
        description: lang.txBlackjack({ result: resultText, player: playerTotal, dealer: dealerTotal }).toString()
    });
    if (!settlement.success) {
        const reason = settlement.insufficientFunds
            ? cards.warning(lang.insufficientTitle, lang.insufficientDesc({ wallet: (settlement.profile?.wallet || 0).toLocaleString(), bet: betAmount.toLocaleString() }))
            : cards.info(lang.sessionExpiredTitle, lang.sessionExpiredDesc);
        return { card: reason, rows: [] };
    }
    profile = settlement.profile;

    const cardTitle = won ? lang.winTitle : (resultKey === 'resPush' ? lang.pushTitle : lang.loseTitle);
    const accent = won ? ACCENT.success : (resultKey === 'resPush' ? ACCENT.warning : ACCENT.error);

    const card = buildCard({
        title: cardTitle,
        accentColor: accent
    })
        .addText(`> **${lang.resultLabel}:** \`${resultText}\``)
        .addSeparator()
        .addText(
            lang.resultCards({
                playerCards: playerCards.join(' '),
                playerTotal,
                dealerCards: dealerCards.join(' '),
                dealerTotal
            })
        )
        .addSeparator();

    if (won) {
        card.addText(
            `**💵 ${lang.betLabel}:** \`$${betAmount.toLocaleString()}\`\n` +
            `**🎯 ${lang.multiplierLabel}:** \`${multiplier.toFixed(2)}x\`\n` +
            `**💎 ${lang.winningsLabel}:** \`$${winnings.toLocaleString()}\`\n` +
            `**📈 ${lang.profitLabel}:** \`+$${profit.toLocaleString()}\`\n` +
            `**💳 ${lang.balanceLabel}:** \`$${profile.wallet.toLocaleString()}\``
        );
        if (luckMultiplier > 1) {
            card.addText(`> **🍀 ${lang.luckBonusLabel}:** \`${luckMultiplier.toFixed(2)}x\``);
        }
    } else if (resultKey === 'resPush') {
        card.addText(
            `**💵 ${lang.betLabel}:** \`$${betAmount.toLocaleString()}\`\n` +
            `**💰 ${lang.returnedLabel}:** \`$${betAmount.toLocaleString()}\`\n` +
            `**💳 ${lang.balanceLabel}:** \`$${profile.wallet.toLocaleString()}\`\n` +
            lang.pushNote.toString()
        );
    } else {
        card.addText(
            `**💵 ${lang.betLabel}:** \`$${betAmount.toLocaleString()}\`\n` +
            `**💸 ${lang.lossLabel}:** \`$${betAmount.toLocaleString()}\`\n` +
            `**💳 ${lang.balanceLabel}:** \`$${profile.wallet.toLocaleString()}\``
        );
    }

    const endButtons = [];
    if (won && profile.wallet > 0) {
        endButtons.push(btn.success('bj_deposit_bank', lang.btnDepositBank));
    }
    endButtons.push(btn.secondary('bj_close', lang.btnClose));

    return { card, rows: [new ActionRowBuilder().addComponents(endButtons)] };
}

module.exports = {
    name: 'blackjack',
    aliases: ['bj', '21'],
    description: lang.cmdDesc.toString(),
    usage: '!blackjack <bet>',
    cooldown: 4000,
    async execute(message, args) {
        try {
            let profile = await EconomyManager.getProfile(message.author.id, message.guild.id);

            const cooldownCheck = EconomyManager.checkCooldown(profile, 'gambling');
            if (cooldownCheck.onCooldown) {
                return sendV2(message, cards.warning(
                    lang.cooldownTitle,
                    lang.cooldownDesc({ seconds: cooldownCheck.timeLeft.seconds })
                ));
            }

            let betAmount;
            if (args[0] === 'all' || args[0] === 'max') {
                betAmount = profile.wallet || 0;
            } else {
                betAmount = /^\d+$/.test(args[0]) ? Number(args[0]) : NaN;
            }

            if (!Number.isSafeInteger(betAmount) || betAmount <= 0 || !Number.isSafeInteger(Math.floor(betAmount * 12.5))) {
                return sendV2(message, cards.warning(lang.invalidBetTitle, lang.invalidBetDesc));
            }

            if ((profile.wallet || 0) < betAmount) {
                return sendV2(message, cards.warning(
                    lang.insufficientTitle,
                    lang.insufficientDesc({ wallet: (profile.wallet || 0).toLocaleString(), bet: betAmount.toLocaleString() })
                ));
            }

            profile = await EconomyManager.claimGamblingSession(message.author.id, message.guild.id, message.id);
            if (!profile) {
                const fresh = await EconomyManager.getProfile(message.author.id, message.guild.id);
                const check = EconomyManager.checkCooldown(fresh, 'gambling');
                return sendV2(message, cards.warning(
                    lang.cooldownTitle,
                    lang.cooldownDesc({ seconds: check.timeLeft?.seconds || 30 })
                ));
            }

            const playerCards = [drawCard(), drawCard()];
            const dealerCards = [drawCard(), drawCard()];

            const playerTotal = calculateHand(playerCards);
            const canDouble = (profile.wallet || 0) >= betAmount * 2 && Number.isSafeInteger(betAmount * 2);
            let gameSettled = playerTotal === 21;
            let resolving = false;

            let initialCard;
            let initialRows;

            
            if (playerTotal === 21) {
                const finalResult = await finalizeBlackjack(profile, message, playerCards, dealerCards, betAmount, message.id);
                initialCard = finalResult.card;
                initialRows = finalResult.rows;
            } else {
                initialCard = buildPlayingCard(playerCards, dealerCards, betAmount);
                const playButtons = [
                    btn.primary('bj_hit', lang.btnHit),
                    btn.secondary('bj_stand', lang.btnStand)
                ];
                if (canDouble) {
                    playButtons.push(btn.warning('bj_double', lang.btnDouble));
                }
                playButtons.push(btn.danger('bj_close', lang.btnClose));
                initialRows = [new ActionRowBuilder().addComponents(playButtons)];
            }

            const sentMessage = await sendV2(message, { card: initialCard, rows: initialRows });
            if (!sentMessage) return;

            const collector = sentMessage.createMessageComponentCollector({ time: 60000 });

            collector.on('collect', async (interaction) => {
                try {
                    if (interaction.user.id !== message.author.id) return replyUnauthorized(interaction);
                    await interaction.deferUpdate();

                    if (interaction.customId === 'bj_close') {
                        collector.stop('user_closed');
                        return editV2(sentMessage, { card: cards.info(lang.closedTitle, lang.closedDesc), rows: [] });
                    }

                    if (interaction.customId === 'bj_deposit_bank') {
                        const freshProfile = await EconomyManager.getProfile(message.author.id, message.guild.id);
                        const deposit = await EconomyManager.transferBank({
                            userId: message.author.id, guildId: message.guild.id, direction: 'deposit', amount: 'all',
                            referenceId: `blackjack-deposit:${interaction.message.id}`,
                            description: lang.txDepositBlackjack({ amount: (freshProfile.wallet || 0).toLocaleString() }).toString()
                        });
                        const canDeposit = deposit.amount || 0;
                        collector.stop('deposited');
                        return editV2(sentMessage, { card: cards.success(lang.depositedTitle, lang.depositedAlert({ amount: canDeposit.toLocaleString() })), rows: [] });
                    }

                    if (interaction.customId === 'bj_hit') {
                        if (gameSettled || resolving) return;
                        playerCards.push(drawCard());
                        const currentTotal = calculateHand(playerCards);

                        if (currentTotal >= 21) {
                            resolving = true;
                            gameSettled = true;
                            const freshProfile = await EconomyManager.getProfile(message.author.id, message.guild.id);
                            const finalResult = await finalizeBlackjack(freshProfile, message, playerCards, dealerCards, betAmount, message.id);
                            return editV2(sentMessage, { card: finalResult.card, rows: finalResult.rows });
                        }

                        const updatedPlayCard = buildPlayingCard(playerCards, dealerCards, betAmount);
                        const hitRows = [
                            new ActionRowBuilder().addComponents(
                                btn.primary('bj_hit', lang.btnHit),
                                btn.secondary('bj_stand', lang.btnStand),
                                btn.danger('bj_close', lang.btnClose)
                            )
                        ];
                        return editV2(sentMessage, { card: updatedPlayCard, rows: hitRows });
                    }

                    if (interaction.customId === 'bj_double') {
                        if (gameSettled || resolving || !canDouble) return;
                        resolving = true;
                        betAmount *= 2;
                        playerCards.push(drawCard());
                        const freshProfile = await EconomyManager.getProfile(message.author.id, message.guild.id);
                        gameSettled = true;
                        const finalResult = await finalizeBlackjack(freshProfile, message, playerCards, dealerCards, betAmount, message.id);
                        return editV2(sentMessage, { card: finalResult.card, rows: finalResult.rows });
                    }

                    if (interaction.customId === 'bj_stand') {
                        if (gameSettled || resolving) return;
                        resolving = true;
                        gameSettled = true;
                        const freshProfile = await EconomyManager.getProfile(message.author.id, message.guild.id);
                        const finalResult = await finalizeBlackjack(freshProfile, message, playerCards, dealerCards, betAmount, message.id);
                        return editV2(sentMessage, { card: finalResult.card, rows: finalResult.rows });
                    }
                } catch (err) {
                    console.error('Error handling blackjack interaction:', err);
                    editV2(sentMessage, { card: cards.error(lang.errorTitle, lang.errorMessage), rows: [] }).catch(() => {});
                }
            });

            collector.on('end', async (collected, reason) => {
                if (reason === 'time' && !gameSettled && !resolving) {
                    resolving = true;
                    gameSettled = true;
                    const freshProfile = await EconomyManager.getProfile(message.author.id, message.guild.id);
                    const finalResult = await finalizeBlackjack(freshProfile, message, playerCards, dealerCards, betAmount, message.id);
                    editV2(sentMessage, { card: finalResult.card, rows: [] }).catch(() => {});
                }
            });

        } catch (error) {
            console.error('Error in blackjack command:', error);
            return sendV2(message, cards.error(lang.errorTitle, lang.errorMessage));
        }
    }
};
